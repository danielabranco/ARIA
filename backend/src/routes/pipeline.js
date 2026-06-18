const router = require('express').Router();
const fetch = require('node-fetch');
const { driver } = require('../lib/neo4j');
const { httpsAgent } = require('../lib/https-agent');
const { auditLog } = require('../lib/audit');
const { enforceGetOnly } = require('../lib/glpi'); // SECURITY: all GLPI calls are GET-only

// ── STAGE DEFINITIONS ────────────────────────────────────────────────────────
// Mirrors the IT Governance Cockpit sync pipeline.
// tier: 'live' runs every execution, 'hourly'/'nightly'/'weekly' only on those tiers.

const STAGES = [
  { id: 'session_auth',         label: 'Session Auth',           tier: 'live',    desc: 'Authenticate with GLPI and obtain session token',                                                              endpoint: 'POST /apirest.php/initSession' },
  { id: 'groups_categories',    label: 'Groups & Categories',    tier: 'nightly', desc: 'Discover all groups and ITIL categories',                                                                       endpoint: 'GET /Group → GET /ITILCategory' },
  { id: 'entity_map',           label: 'Entity Map',             tier: 'live',    desc: 'Fetch all GLPI entities and build the entity ID → path map',                                                   endpoint: 'GET /Entity' },
  { id: 'tickets_incremental',  label: 'Tickets (incremental)',  tier: 'live',    desc: 'Fetch all tickets modified since last sync — single global query, all groups, all statuses',                   endpoint: 'GET /search/Ticket {global_modified_since}' },
  { id: 'tickets_full',         label: 'Tickets (full reconcile)', tier: 'nightly', desc: 'Nightly full reconciliation — fetches every ticket in the 2yr window, all groups, all statuses, upserts 1:1', endpoint: 'GET /search/Ticket {2yr window, unrestricted}' },
  { id: 'user_directory',       label: 'User Directory',         tier: 'nightly', desc: 'Fetch GLPI users and group memberships — incremental (skipped if synced within 1h; manual trigger forces full re-fetch)', endpoint: 'GET /User' },
  { id: 'followup_analysis',    label: 'Followup Analysis',      tier: 'live',    desc: 'Determine last-touch author type per open ticket (pull-in-count)',                                             endpoint: 'GET /Ticket/{id}/ITILFollowup {open tickets}' },
  { id: 'reopen_detection',     label: 'Reopen Detection',       tier: 'nightly', desc: 'Detect tickets closed more than once — incremental (new tickets only)',                                        endpoint: 'GET /Ticket/{id}/ITILSolution {closed, incremental}' },
  { id: 'escalation_history',   label: 'Escalation History',     tier: 'nightly', desc: 'Check assignment logs for group escalations (C1k calculations)',                                               endpoint: 'GET /Ticket/{id}/Log {closed, incremental}' },
  { id: 'task_records',         label: 'Task Records',           tier: 'live',    desc: 'Fetch ticket task records for open tickets — incremental (only re-fetches tickets whose last_update changed)', endpoint: 'GET /TicketTask {paginated}' },
  { id: 'rescore',              label: 'Re-score',               tier: 'live',    desc: 'Compute risk scores from raw data using current weight config',                                                endpoint: 'local — no network call' },
  { id: 'change_field_discovery', label: 'Change Field Discovery', tier: 'nightly', desc: 'Discover plugin field IDs (runs once, cached in meta table)',                                               endpoint: 'GET /listSearchOptions/Change' },
  { id: 'change_records',       label: 'Change Records',         tier: 'hourly',  desc: 'Fetch Change records — incremental after first run (only re-fetches records modified since last sync, full on first run or force flag trigger)', endpoint: 'GET /search/Change {2yr window}' },
];

const TIER_ORDER = { live: 0, hourly: 1, nightly: 2, weekly: 3 };

// Which stages run on each tier (cumulative — nightly includes live + hourly + nightly)
const stagesForTier = (tier) => {
  const rank = TIER_ORDER[tier] ?? 0;
  return STAGES.filter(s => (TIER_ORDER[s.tier] ?? 0) <= rank);
};

// ── GLPI HELPERS ─────────────────────────────────────────────────────────────

const glpiHeaders = (sessionToken, appToken) => ({
  'Session-Token': sessionToken,
  'App-Token': appToken,
  'Content-Type': 'application/json',
});

const glpiFetch = async (baseUrl, endpoint, sessionToken, appToken) => {
  enforceGetOnly('GET');
  const agent = baseUrl.startsWith('https') ? httpsAgent : undefined;
  const r = await fetch(`${baseUrl}/apirest.php/${endpoint}`, {
    method: 'GET',
    headers: glpiHeaders(sessionToken, appToken),
    agent,
  });
  if (!r.ok) return { data: [], totalcount: 0, error: r.status };
  const body = await r.json();
  return body;
};

// Paginate through a GLPI list endpoint (GET /SomeType?range=0-999)
const fetchAllPages = async (baseUrl, endpoint, sessionToken, appToken, pageSize = 999) => {
  enforceGetOnly('GET');
  const agent = baseUrl.startsWith('https') ? httpsAgent : undefined;
  const all = [];
  let offset = 0;
  const base = endpoint.includes('?') ? endpoint : endpoint + '?';
  const sep  = endpoint.includes('?') ? '&' : '?';
  while (true) {
    const url = `${baseUrl}/apirest.php/${endpoint}${sep}range=${offset}-${offset + pageSize - 1}`;
    const r = await fetch(url, { method: 'GET', headers: glpiHeaders(sessionToken, appToken), agent });
    if (r.status === 206 || r.status === 200) {
      const body = await r.json();
      const items = Array.isArray(body) ? body : (body.data || []);
      if (items.length === 0) break;
      all.push(...items);
      if (items.length < pageSize) break;
      offset += pageSize;
    } else break;
  }
  return all;
};

// Paginate through a GLPI search endpoint (returns { data, totalcount })
const fetchSearchPages = async (baseUrl, searchEndpoint, sessionToken, appToken, pageSize = 999) => {
  enforceGetOnly('GET');
  const agent = baseUrl.startsWith('https') ? httpsAgent : undefined;
  const all = [];
  let offset = 0;
  const sep = searchEndpoint.includes('?') ? '&' : '?';
  while (true) {
    const url = `${baseUrl}/apirest.php/${searchEndpoint}${sep}range=${offset}-${offset + pageSize - 1}`;
    const r = await fetch(url, { method: 'GET', headers: glpiHeaders(sessionToken, appToken), agent });
    if (r.status === 206 || r.status === 200) {
      const body = await r.json();
      const items = Array.isArray(body) ? body : (body.data || []);
      all.push(...items);
      const totalcount = body.totalcount || items.length;
      if (offset + pageSize >= totalcount || items.length < pageSize) break;
      offset += pageSize;
    } else break;
  }
  return all;
};

// ── META HELPERS (Neo4j PipelineMeta nodes) ───────────────────────────────────

const getMeta = async (s, stageId) => {
  const r = await s.run(
    `MERGE (m:PipelineMeta { stage: $stage }) ON CREATE SET m.tier = $tier, m.status = 'never_run', m.lastRun = null, m.lastSuccessAt = null, m.count = 0, m.errorMessage = '' RETURN m`,
    { stage: stageId, tier: STAGES.find(s => s.id === stageId)?.tier || 'live' }
  );
  return r.records[0]?.get('m').properties || {};
};

const setMeta = async (s, stageId, patch) => {
  const setClauses = Object.keys(patch).map(k => `m.${k} = $${k}`).join(', ');
  await s.run(
    `MERGE (m:PipelineMeta { stage: $stage }) SET ${setClauses}`,
    { stage: stageId, ...patch }
  );
};

// ── STAGE RUNNERS ─────────────────────────────────────────────────────────────

async function runSessionAuth(ctx) {
  const { baseUrl, userToken, appToken } = ctx;
  enforceGetOnly('GET');
  const agent = baseUrl.startsWith('https') ? httpsAgent : undefined;
  const r = await fetch(`${baseUrl}/apirest.php/initSession`, {
    method: 'GET',
    headers: { 'Authorization': `user_token ${userToken}`, 'App-Token': appToken },
    agent,
  });
  const data = await r.json();
  if (!data.session_token) throw new Error(`GLPI auth failed: ${JSON.stringify(data)}`);
  ctx.sessionToken = data.session_token;
  return { count: 1 };
}

async function runGroupsCategories(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const groups = await fetchAllPages(baseUrl, 'Group?expand_dropdowns=true&is_deleted=0', sessionToken, appToken);
  const cats   = await fetchAllPages(baseUrl, 'ITILCategory?expand_dropdowns=true', sessionToken, appToken);

  for (const g of groups) {
    await s.run(
      `MERGE (g:Group { glpiId: $id }) SET g.name = $name, g.comment = $comment, g.entity = $entity, g.updatedAt = $now`,
      { id: String(g.id), name: g.name || '', comment: g.comment || '', entity: String(g.entities_id || ''), now: new Date().toISOString() }
    );
  }
  for (const c of cats) {
    await s.run(
      `MERGE (c:ITILCategory { glpiId: $id }) SET c.name = $name, c.fullname = $fullname, c.comment = $comment, c.entity = $entity, c.updatedAt = $now`,
      { id: String(c.id), name: c.name || '', fullname: c.completename || c.name || '', comment: c.comment || '', entity: String(c.entities_id || ''), now: new Date().toISOString() }
    );
  }
  return { count: groups.length + cats.length, groups: groups.length, categories: cats.length };
}

async function runEntityMap(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const entities = await fetchAllPages(baseUrl, 'Entity?expand_dropdowns=true', sessionToken, appToken);
  ctx.entityMap = {};
  for (const e of entities) {
    ctx.entityMap[String(e.id)] = e.completename || e.name || String(e.id);
    await s.run(
      `MERGE (e:Entity { glpiId: $id }) SET e.name = $name, e.completename = $completename, e.level = $level, e.updatedAt = $now`,
      { id: String(e.id), name: e.name || '', completename: e.completename || e.name || '', level: String(e.level || '0'), now: new Date().toISOString() }
    );
  }
  return { count: entities.length };
}

async function runTicketsIncremental(ctx) {
  const { baseUrl, sessionToken, appToken, s, meta, force } = ctx;
  const lastSync = !force && meta.tickets_incremental?.lastSuccessAt
    ? meta.tickets_incremental.lastSuccessAt.slice(0, 19).replace('T', ' ')
    : null;

  // field 19 = date_mod (last modification date) in GLPI
  const criteria = lastSync
    ? `criteria[0][field]=19&criteria[0][searchtype]=morethan&criteria[0][value]=${encodeURIComponent(lastSync)}`
    : `criteria[0][field]=19&criteria[0][searchtype]=morethan&criteria[0][value]=${encodeURIComponent(twoYearsAgo())}`;

  const displayFields = ticketDisplayFields();
  const endpoint = `search/Ticket?${criteria}&${displayFields}&order=DESC&sort=19`;
  const items = await fetchSearchPages(baseUrl, endpoint, sessionToken, appToken);

  let count = 0;
  for (const item of items) {
    const t = mapTicketFields(item);
    await s.run(
      `MERGE (t:Ticket { glpiId: $id })
       SET t.name = $name, t.status = $status, t.statusLabel = $statusLabel,
           t.date = $date, t.dateMod = $dateMod, t.dateSolved = $dateSolved,
           t.priority = $priority, t.priorityLabel = $priorityLabel,
           t.urgency = $urgency, t.impact = $impact,
           t.category = $category, t.entity = $entity,
           t.requestType = $requestType, t.assigneeUser = $assigneeUser,
           t.assigneeGroup = $assigneeGroup, t.requester = $requester,
           t.updatedAt = $now`,
      { ...t, now: new Date().toISOString() }
    );
    count++;
  }
  ctx.ticketIds = { open: [], all: [] };
  const openRes = await s.run(`MATCH (t:Ticket) WHERE t.status IN ['1','2','3','4'] RETURN t.glpiId AS id`);
  ctx.ticketIds.open = openRes.records.map(r => r.get('id'));
  const allRes = await s.run(`MATCH (t:Ticket) RETURN t.glpiId AS id`);
  ctx.ticketIds.all = allRes.records.map(r => r.get('id'));

  return { count, incremental: !!lastSync };
}

async function runTicketsFull(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const from = twoYearsAgo();
  const criteria = `criteria[0][field]=19&criteria[0][searchtype]=morethan&criteria[0][value]=${encodeURIComponent(from)}`;
  const displayFields = ticketDisplayFields();
  const endpoint = `search/Ticket?${criteria}&${displayFields}&order=ASC&sort=1`;
  const items = await fetchSearchPages(baseUrl, endpoint, sessionToken, appToken);

  let count = 0;
  for (const item of items) {
    const t = mapTicketFields(item);
    await s.run(
      `MERGE (t:Ticket { glpiId: $id })
       SET t.name = $name, t.status = $status, t.statusLabel = $statusLabel,
           t.date = $date, t.dateMod = $dateMod, t.dateSolved = $dateSolved,
           t.priority = $priority, t.priorityLabel = $priorityLabel,
           t.urgency = $urgency, t.impact = $impact,
           t.category = $category, t.entity = $entity,
           t.requestType = $requestType, t.assigneeUser = $assigneeUser,
           t.assigneeGroup = $assigneeGroup, t.requester = $requester,
           t.updatedAt = $now`,
      { ...t, now: new Date().toISOString() }
    );
    count++;
  }

  // Refresh ticket ID lists after full reconcile
  ctx.ticketIds = { open: [], all: [] };
  const openRes = await s.run(`MATCH (t:Ticket) WHERE t.status IN ['1','2','3','4'] RETURN t.glpiId AS id`);
  ctx.ticketIds.open = openRes.records.map(r => r.get('id'));
  const allRes = await s.run(`MATCH (t:Ticket) RETURN t.glpiId AS id`);
  ctx.ticketIds.all = allRes.records.map(r => r.get('id'));

  return { count };
}

async function runUserDirectory(ctx) {
  const { baseUrl, sessionToken, appToken, s, meta, force } = ctx;
  // Skip if synced within the last hour (unless forced)
  if (!force && meta.user_directory?.lastSuccessAt) {
    const age = Date.now() - new Date(meta.user_directory.lastSuccessAt).getTime();
    if (age < 3600 * 1000) return { count: 0, skipped: true };
  }

  const users = await fetchAllPages(baseUrl, 'User?expand_dropdowns=true&is_deleted=0', sessionToken, appToken);
  let count = 0;
  for (const u of users) {
    const name = [u.firstname, u.realname].filter(Boolean).join(' ') || u.name || String(u.id);
    await s.run(
      `MERGE (u:User { glpiId: $id })
       SET u.name = $name, u.login = $login, u.email = $email,
           u.phone = $phone, u.groupId = $groupId, u.entity = $entity, u.updatedAt = $now`,
      {
        id: String(u.id), name, login: u.name || '', email: u.email || '',
        phone: u.phone || '', groupId: String(u.groups_id || ''), entity: String(u.entities_id || ''),
        now: new Date().toISOString()
      }
    );
    count++;
  }
  return { count };
}

async function runFollowupAnalysis(ctx) {
  const { baseUrl, sessionToken, appToken, s, ticketIds } = ctx;
  const ids = ticketIds?.open || [];
  // Process in batches of 50 to avoid overwhelming GLPI
  const BATCH = 50;
  let count = 0;
  for (let i = 0; i < Math.min(ids.length, 2000); i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await Promise.all(batch.map(async (tid) => {
      try {
        const followups = await fetchAllPages(baseUrl, `Ticket/${tid}/ITILFollowup?expand_dropdowns=true`, sessionToken, appToken);
        for (const f of followups) {
          await s.run(
            `MERGE (f:Followup { glpiId: $id })
             SET f.ticketId = $ticketId, f.date = $date, f.content = $content,
                 f.authorType = $authorType, f.userId = $userId, f.updatedAt = $now
             WITH f
             MATCH (t:Ticket { glpiId: $ticketId })
             MERGE (t)-[:HAS_FOLLOWUP]->(f)`,
            {
              id: String(f.id), ticketId: String(tid),
              date: f.date || '', content: (f.content || '').substring(0, 500),
              authorType: f.requesttypes_id ? String(f.requesttypes_id) : 'unknown',
              userId: String(f.users_id || ''), now: new Date().toISOString()
            }
          );
          count++;
        }
      } catch {}
    }));
  }
  return { count, ticketsProcessed: Math.min(ids.length, 2000) };
}

async function runReopenDetection(ctx) {
  const { baseUrl, sessionToken, appToken, s, ticketIds, meta, force } = ctx;
  // Incremental: only check tickets not yet analysed, or all on force/first run
  const newTicketRes = await s.run(
    `MATCH (t:Ticket) WHERE t.reopenChecked IS NULL OR $force = true RETURN t.glpiId AS id LIMIT 500`,
    { force: force || false }
  );
  const ids = newTicketRes.records.map(r => r.get('id'));
  const BATCH = 30;
  let count = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await Promise.all(batch.map(async (tid) => {
      try {
        const solutions = await fetchAllPages(baseUrl, `Ticket/${tid}/ITILSolution?expand_dropdowns=true`, sessionToken, appToken);
        const reopenCount = Math.max(0, solutions.length - 1); // >1 solution = reopened
        await s.run(
          `MATCH (t:Ticket { glpiId: $id }) SET t.reopenCount = $count, t.reopenChecked = $now`,
          { id: String(tid), count: reopenCount, now: new Date().toISOString() }
        );
        if (solutions.length > 0) {
          await s.run(
            `MATCH (t:Ticket { glpiId: $ticketId })
             MERGE (sol:TicketSolution { glpiId: $id })
             SET sol.ticketId = $ticketId, sol.count = $count, sol.updatedAt = $now
             MERGE (t)-[:HAS_SOLUTION]->(sol)`,
            { id: `${tid}_sol`, ticketId: String(tid), count: solutions.length, now: new Date().toISOString() }
          );
        }
        count += solutions.length;
      } catch {}
    }));
  }
  return { count, ticketsProcessed: ids.length };
}

async function runEscalationHistory(ctx) {
  const { baseUrl, sessionToken, appToken, s, ticketIds, force } = ctx;
  const newTicketRes = await s.run(
    `MATCH (t:Ticket) WHERE t.escalationChecked IS NULL OR $force = true RETURN t.glpiId AS id LIMIT 500`,
    { force: force || false }
  );
  const ids = newTicketRes.records.map(r => r.get('id'));
  const BATCH = 30;
  let count = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await Promise.all(batch.map(async (tid) => {
      try {
        const logs = await fetchAllPages(baseUrl, `Ticket/${tid}/Log?expand_dropdowns=true`, sessionToken, appToken);
        let escalationCount = 0;
        for (const log of logs) {
          // Detect group reassignment (field 8 = assigned group in GLPI logs)
          if (log.field === 'Group' || log.field === '8' || String(log.itemtype_link) === 'Group') {
            escalationCount++;
            await s.run(
              `MERGE (l:TicketLog { glpiId: $id })
               SET l.ticketId = $ticketId, l.date = $date, l.field = $field,
                   l.oldValue = $oldValue, l.newValue = $newValue, l.updatedAt = $now
               WITH l MATCH (t:Ticket { glpiId: $ticketId })
               MERGE (t)-[:HAS_LOG]->(l)`,
              {
                id: String(log.id), ticketId: String(tid), date: log.date_mod || '',
                field: String(log.field || ''), oldValue: String(log.old_value || ''),
                newValue: String(log.new_value || ''), now: new Date().toISOString()
              }
            );
            count++;
          }
        }
        await s.run(
          `MATCH (t:Ticket { glpiId: $id }) SET t.escalationCount = $count, t.escalationChecked = $now`,
          { id: String(tid), count: escalationCount, now: new Date().toISOString() }
        );
      } catch {}
    }));
  }
  return { count, ticketsProcessed: ids.length };
}

async function runTaskRecords(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const tasks = await fetchAllPages(baseUrl, 'TicketTask?expand_dropdowns=true', sessionToken, appToken);
  let count = 0;
  for (const t of tasks) {
    await s.run(
      `MERGE (tk:TicketTask { glpiId: $id })
       SET tk.ticketId = $ticketId, tk.content = $content, tk.state = $state,
           tk.date = $date, tk.userId = $userId, tk.duration = $duration, tk.updatedAt = $now
       WITH tk MATCH (t:Ticket { glpiId: $ticketId })
       MERGE (t)-[:HAS_TASK]->(tk)`,
      {
        id: String(t.id), ticketId: String(t.tickets_id || ''),
        content: (t.content || '').substring(0, 500), state: String(t.state || ''),
        date: t.date || '', userId: String(t.users_id_tech || t.users_id || ''),
        duration: String(t.actiontime || '0'), now: new Date().toISOString()
      }
    );
    count++;
  }
  return { count };
}

async function runRescore(ctx) {
  const { s } = ctx;
  // Compute a simple risk score per ticket: priority × urgency × (1 + reopenCount)
  const r = await s.run(
    `MATCH (t:Ticket)
     SET t.riskScore = toFloat(coalesce(t.priority, '3')) * toFloat(coalesce(t.urgency, '3')) * (1 + coalesce(t.reopenCount, 0))
     RETURN count(t) AS c`
  );
  return { count: r.records[0]?.get('c').toNumber() || 0 };
}

async function runChangeFieldDiscovery(ctx) {
  const { baseUrl, sessionToken, appToken, s, meta, force } = ctx;
  // Only run once unless forced
  if (!force && meta.change_field_discovery?.lastSuccessAt) {
    return { count: 0, skipped: true };
  }
  const data = await glpiFetch(baseUrl, 'listSearchOptions/Change', sessionToken, appToken);
  const fields = typeof data === 'object' && !Array.isArray(data) ? Object.entries(data) : [];
  const fieldMap = fields.reduce((acc, [id, def]) => {
    if (def && def.name) acc[id] = def.name;
    return acc;
  }, {});
  // Cache in Neo4j
  await s.run(
    `MERGE (m:PipelineMeta { stage: 'change_fields_cache' })
     SET m.fieldMap = $map, m.updatedAt = $now`,
    { map: JSON.stringify(fieldMap), now: new Date().toISOString() }
  );
  return { count: fields.length };
}

async function runChangeRecords(ctx) {
  const { baseUrl, sessionToken, appToken, s, meta, force } = ctx;
  const lastSync = !force && meta.change_records?.lastSuccessAt
    ? meta.change_records.lastSuccessAt.slice(0, 19).replace('T', ' ')
    : null;
  const from = lastSync || twoYearsAgo();
  const criteria = `criteria[0][field]=19&criteria[0][searchtype]=morethan&criteria[0][value]=${encodeURIComponent(from)}&forcedisplay[0]=1&forcedisplay[1]=2&forcedisplay[2]=12&forcedisplay[3]=15&forcedisplay[4]=19`;
  const items = await fetchSearchPages(baseUrl, `search/Change?${criteria}&order=DESC&sort=19`, sessionToken, appToken);

  let count = 0;
  for (const item of items) {
    const id   = String(item['1'] || item.id || '');
    const name = String(item['2'] || item.name || '');
    const status = String(item['12'] || item.status || '');
    const date   = String(item['15'] || item.date || '');
    const dateMod = String(item['19'] || item.date_mod || '');
    if (!id) continue;
    await s.run(
      `MERGE (c:Change { glpiId: $id })
       SET c.name = $name, c.status = $status, c.date = $date, c.dateMod = $dateMod, c.updatedAt = $now`,
      { id, name, status, date, dateMod, now: new Date().toISOString() }
    );
    count++;
  }
  return { count, incremental: !!lastSync };
}

// ── KILL SESSION ──────────────────────────────────────────────────────────────

const killSession = async (baseUrl, sessionToken, appToken) => {
  try {
    enforceGetOnly('GET');
    const agent = baseUrl.startsWith('https') ? httpsAgent : undefined;
    await fetch(`${baseUrl}/apirest.php/killSession`, {
      method: 'GET',
      headers: glpiHeaders(sessionToken, appToken),
      agent,
    });
  } catch {}
};

// ── UTILITY ───────────────────────────────────────────────────────────────────

const twoYearsAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10);
};

const ticketDisplayFields = () =>
  'forcedisplay[0]=1&forcedisplay[1]=2&forcedisplay[2]=3&forcedisplay[3]=12&forcedisplay[4]=14&forcedisplay[5]=15&forcedisplay[6]=19&forcedisplay[7]=45&forcedisplay[8]=9&forcedisplay[9]=5&forcedisplay[10]=4&forcedisplay[11]=10&forcedisplay[12]=6';

const TICKET_STATUS = { 1: 'New', 2: 'Processing (assigned)', 3: 'Processing (planned)', 4: 'Pending', 5: 'Solved', 6: 'Closed' };
const TICKET_PRIORITY = { 1: 'Very low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very high', 6: 'Major' };

const mapTicketFields = (item) => ({
  id:              String(item['1']  || item.id              || ''),
  name:            String(item['2']  || item.name            || ''),
  date:            String(item['3']  || item.date            || ''),
  status:          String(item['12'] || item.status          || ''),
  statusLabel:     TICKET_STATUS[item['12'] || item.status]  || '',
  dateMod:         String(item['19'] || item.date_mod        || ''),
  dateSolved:      String(item['15'] || item.date_solved     || ''),
  priority:        String(item['9']  || item.priority        || ''),
  priorityLabel:   TICKET_PRIORITY[item['9'] || item.priority] || '',
  urgency:         String(item['10'] || item.urgency         || ''),
  impact:          String(item['11'] || item.impact          || ''),
  category:        String(item['45'] || item.itilcategories_id || ''),
  entity:          String(item['80'] || item.entities_id     || ''),
  requestType:     String(item['14'] || item.requesttypes_id || ''),
  assigneeUser:    String(item['5']  || item.users_id_assign || ''),
  assigneeGroup:   String(item['8']  || item.groups_id_assign || ''),
  requester:       String(item['4']  || item.users_id_requester || ''),
});

// ── RUNNER MAP ────────────────────────────────────────────────────────────────

const RUNNERS = {
  session_auth:          runSessionAuth,
  groups_categories:     runGroupsCategories,
  entity_map:            runEntityMap,
  tickets_incremental:   runTicketsIncremental,
  tickets_full:          runTicketsFull,
  user_directory:        runUserDirectory,
  followup_analysis:     runFollowupAnalysis,
  reopen_detection:      runReopenDetection,
  escalation_history:    runEscalationHistory,
  task_records:          runTaskRecords,
  rescore:               runRescore,
  change_field_discovery: runChangeFieldDiscovery,
  change_records:        runChangeRecords,
};

// ── ENDPOINTS ─────────────────────────────────────────────────────────────────

// GET /api/pipeline/stages — list all stage definitions
router.get('/stages', (req, res) => res.json({ stages: STAGES }));

// GET /api/pipeline/status — current pipeline state (stage metadata + store stats)
router.get('/status', async (req, res) => {
  const s = driver.session();
  try {
    // Stage metadata
    const metaRes = await s.run(`MATCH (m:PipelineMeta) WHERE m.stage <> 'change_fields_cache' RETURN m`);
    const stagesMeta = {};
    for (const rec of metaRes.records) {
      const m = rec.get('m').properties;
      stagesMeta[m.stage] = m;
    }

    // Store counts
    const [tickets, followups, solutions, logs, tasks, users, groups, cats, changes] = await Promise.all([
      s.run('MATCH (t:Ticket) RETURN count(t) AS c'),
      s.run('MATCH (f:Followup) RETURN count(f) AS c'),
      s.run('MATCH (s:TicketSolution) RETURN count(s) AS c'),
      s.run('MATCH (l:TicketLog) RETURN count(l) AS c'),
      s.run('MATCH (t:TicketTask) RETURN count(t) AS c'),
      s.run('MATCH (u:User) RETURN count(u) AS c'),
      s.run('MATCH (g:Group) RETURN count(g) AS c'),
      s.run('MATCH (c:ITILCategory) RETURN count(c) AS c'),
      s.run('MATCH (c:Change) RETURN count(c) AS c'),
    ]);

    const store = {
      tickets:    tickets.records[0]?.get('c').toNumber()   || 0,
      followups:  followups.records[0]?.get('c').toNumber() || 0,
      reopens:    solutions.records[0]?.get('c').toNumber() || 0,
      history:    logs.records[0]?.get('c').toNumber()      || 0,
      tasks:      tasks.records[0]?.get('c').toNumber()     || 0,
      users:      users.records[0]?.get('c').toNumber()     || 0,
      groups:     groups.records[0]?.get('c').toNumber()    || 0,
      categories: cats.records[0]?.get('c').toNumber()      || 0,
      changes:    changes.records[0]?.get('c').toNumber()   || 0,
    };

    // Merge stage defs with metadata
    const stages = STAGES.map(def => ({
      ...def,
      status:        stagesMeta[def.id]?.status        || 'never_run',
      lastRun:       stagesMeta[def.id]?.lastRun       || null,
      lastSuccessAt: stagesMeta[def.id]?.lastSuccessAt || null,
      count:         Number(stagesMeta[def.id]?.count) || 0,
      errorMessage:  stagesMeta[def.id]?.errorMessage  || '',
    }));

    res.json({ stages, store });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await s.close();
  }
});

// GET /api/pipeline/stats — store counts only (lightweight)
router.get('/stats', async (req, res) => {
  const s = driver.session();
  try {
    const [tickets, followups, solutions, logs, tasks, users, groups, cats, changes] = await Promise.all([
      s.run('MATCH (t:Ticket) RETURN count(t) AS c'),
      s.run('MATCH (f:Followup) RETURN count(f) AS c'),
      s.run('MATCH (s:TicketSolution) RETURN count(s) AS c'),
      s.run('MATCH (l:TicketLog) RETURN count(l) AS c'),
      s.run('MATCH (t:TicketTask) RETURN count(t) AS c'),
      s.run('MATCH (u:User) RETURN count(u) AS c'),
      s.run('MATCH (g:Group) RETURN count(g) AS c'),
      s.run('MATCH (c:ITILCategory) RETURN count(c) AS c'),
      s.run('MATCH (c:Change) RETURN count(c) AS c'),
    ]);
    res.json({
      tickets:    tickets.records[0]?.get('c').toNumber()   || 0,
      followups:  followups.records[0]?.get('c').toNumber() || 0,
      reopens:    solutions.records[0]?.get('c').toNumber() || 0,
      history:    logs.records[0]?.get('c').toNumber()      || 0,
      tasks:      tasks.records[0]?.get('c').toNumber()     || 0,
      users:      users.records[0]?.get('c').toNumber()     || 0,
      groups:     groups.records[0]?.get('c').toNumber()    || 0,
      categories: cats.records[0]?.get('c').toNumber()      || 0,
      changes:    changes.records[0]?.get('c').toNumber()   || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await s.close();
  }
});

// POST /api/pipeline/run — execute the pipeline
// Body: { glpiUrl, userToken, appToken, tier?, force?, stages? }
router.post('/run', async (req, res) => {
  const { glpiUrl, userToken, appToken, tier = 'live', force = false, stages: stageOverride } = req.body;
  if (!glpiUrl || !userToken || !appToken) return res.status(400).json({ error: 'glpiUrl, userToken and appToken are required' });

  const s = driver.session();
  const startedAt = new Date().toISOString();
  const results = {};
  const errors  = {};

  const targetStages = stageOverride
    ? STAGES.filter(st => stageOverride.includes(st.id))
    : stagesForTier(tier);

  const ctx = {
    baseUrl:      glpiUrl.replace(/\/$/, ''),
    userToken,
    appToken,
    sessionToken: null,
    s,
    force,
    meta:         {},
    ticketIds:    { open: [], all: [] },
  };

  // Pre-load all stage metadata for incremental decisions
  try {
    const metaRes = await s.run(`MATCH (m:PipelineMeta) RETURN m`);
    for (const rec of metaRes.records) {
      const m = rec.get('m').properties;
      ctx.meta[m.stage] = m;
    }
  } catch {}

  // Stream-friendly: send headers early so client sees progress
  res.setHeader('Content-Type', 'application/json');

  const runStage = async (stageDef) => {
    const runner = RUNNERS[stageDef.id];
    if (!runner) return;
    const now = new Date().toISOString();
    await setMeta(s, stageDef.id, { status: 'running', lastRun: now });
    try {
      const result = await runner(ctx);
      results[stageDef.id] = result;
      await setMeta(s, stageDef.id, {
        status: 'success',
        lastRun: now,
        lastSuccessAt: now,
        count: result?.count ?? 0,
        errorMessage: '',
      });
      // Refresh meta for subsequent stages
      ctx.meta[stageDef.id] = { ...(ctx.meta[stageDef.id] || {}), lastSuccessAt: now };
    } catch (e) {
      errors[stageDef.id] = e.message;
      results[stageDef.id] = { error: e.message };
      await setMeta(s, stageDef.id, { status: 'error', lastRun: now, errorMessage: e.message });
    }
  };

  try {
    for (const stageDef of targetStages) {
      await runStage(stageDef);
    }

    // Kill GLPI session if one was established
    if (ctx.sessionToken) await killSession(ctx.baseUrl, ctx.sessionToken, appToken);

    const stagesCompleted = targetStages.filter(st => !errors[st.id]).length;
    auditLog('PIPELINE_RUN', 'System', 'pipeline', { tier, stagesCompleted, stagesTotal: targetStages.length }, 'system');

    res.json({
      success: Object.keys(errors).length === 0,
      tier,
      startedAt,
      completedAt: new Date().toISOString(),
      stagesRun: targetStages.length,
      stagesCompleted,
      results,
      errors,
    });
  } catch (e) {
    if (ctx.sessionToken) await killSession(ctx.baseUrl, ctx.sessionToken, appToken).catch(() => {});
    res.status(500).json({ error: e.message, results, errors });
  } finally {
    await s.close();
  }
});

module.exports = router;
