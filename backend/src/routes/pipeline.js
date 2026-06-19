const router = require('express').Router();
const fetch = require('node-fetch');
const { v4: uuid } = require('uuid');
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
  { id: 'change_field_discovery', label: 'Change Field Discovery', tier: 'nightly', desc: 'Discover plugin field IDs (runs once, cached in meta table)',                                               endpoint: 'GET /listSearchOptions/Change' },
  { id: 'change_records',            label: 'Change Records',              tier: 'hourly',  desc: 'Fetch Change records — incremental after first run (only re-fetches records modified since last sync, full on first run or force flag trigger)',   endpoint: 'GET /search/Change {2yr window}' },
  { id: 'problem_records',          label: 'Problem Records',             tier: 'hourly',  desc: 'Fetch Problem records — incremental after first run, upserts Problem nodes with name, status, priority, urgency, impact',                         endpoint: 'GET /search/Problem {2yr window}' },
  { id: 'release_records',           label: 'Release Records',             tier: 'hourly',  desc: 'Fetch GLPI release objects and sub-documents',                                                                                                         endpoint: 'GET /PluginReleaseRelease' },
  { id: 'ticket_change_links',       label: 'Ticket-Change Links',         tier: 'hourly',  desc: 'Resolve ticket↔change links for active changes',                                                                                                       endpoint: 'GET /Change/{id}/Change_Ticket {active changes only}' },
  { id: 'cab_validations',           label: 'CAB Validations',             tier: 'hourly',  desc: 'Fetch change-approval records for active changes',                                                                                                      endpoint: 'GET /Change/{id}/ChangeValidation {active changes only}' },
  { id: 'ticket_validations',        label: 'Ticket Validations',          tier: 'hourly',  desc: 'Fetch all pending ticket validations (status=2)',                                                                                                       endpoint: 'GET /TicketValidation {status=2, all pending}' },
  { id: 'release_history',           label: 'Release History',             tier: 'nightly', desc: 'Fetch change logs for active changes (release traceability)',                                                                                           endpoint: 'GET /Change/{id}/log {active changes only}' },
  { id: 'followup_history_tickets',  label: 'Followup History (Tickets)',  tier: 'live',    desc: 'Incremental followup history for open tickets',                                                                                                         endpoint: 'GET /Ticket/{id}/ITILFollowup {open tickets, incremental}' },
  { id: 'followup_history_changes',  label: 'Followup History (Changes)',  tier: 'live',    desc: 'Fetch followup history for all change records (incremental)',                                                                                           endpoint: 'GET /Change/{id}/ITILFollowup {incremental}' },
  { id: 'solution_history',          label: 'Solution History',            tier: 'live',    desc: 'Incremental solution records for all tickets',                                                                                                          endpoint: 'GET /Ticket/{id}/ITILSolution {incremental}' },
  { id: 'validation_history',        label: 'Validation History',          tier: 'live',    desc: 'Fetch ticket and change validation records incrementally',                                                                                              endpoint: 'GET /Ticket/{id}/TicketValidation + Change/{id}/ChangeValidation {incremental}' },
  { id: 'field_change_history',      label: 'Field Change History',        tier: 'live',    desc: 'Fetch field-level change logs for open tickets (incremental)',                                                                                          endpoint: 'GET /Ticket/{id}/log {open tickets, incremental}' },
  { id: 'app_structures',            label: 'App Structures',               tier: 'nightly', desc: 'Fetch application structures — upserts Application nodes and Knowledge entries, builds appIdMap for dataflow resolution',                                      endpoint: 'GET /PluginArchiswSwcomponent {expand_dropdowns, is_deleted=0}' },
  { id: 'app_structures_history',    label: 'App Structures History',       tier: 'nightly', desc: 'Fetch field-change logs for all application nodes — stores AppLog nodes, updates lastActivity and lastEditor on each Application node (incremental by log ID)',      endpoint: 'GET /PluginArchiswSwcomponent/{id}/Log {all apps, incremental}' },
  { id: 'dataflow_lookups',          label: 'Dataflow Lookups',             tier: 'weekly',  desc: 'Fetch GLPI dataflow dropdown tables (GDPR/holiday actions, states, types, protocols, etc.) — upserts DataflowLookup nodes used by the dataflows stage for meaning resolution', endpoint: 'GET /PluginDataflowsHolidayAction + States + Types + Protocols (10 tables)' },
  { id: 'dataflow_history',          label: 'Dataflow History',             tier: 'nightly', desc: 'Fetch field-change logs for all dataflows — stores DataflowLog nodes with HAS_LOG rels, updates lastActivity/lastEditor/lastLogId on each Dataflow node (incremental by log ID)', endpoint: 'GET /PluginDataflowsDataflow/{id}/Log {all dataflows, incremental}' },
  { id: 'dataflows',                 label: 'Dataflows',                    tier: 'nightly', desc: 'Fetch dataflows — upserts Dataflow nodes, resolves src/dst apps, builds FEEDS_INTO / CONNECTS_TO relationships and Knowledge entries',                         endpoint: 'GET /PluginDataflowsDataflow {expand_dropdowns, is_deleted=0}' },
  { id: 'dataflow_itsm_links',       label: 'Dataflow ITSM Links',          tier: 'hourly',  desc: 'Fetch all tickets, changes, problems and projects linked to dataflows via GLPI junction tables — creates HAS_TICKET, HAS_CHANGE, HAS_PROBLEM, HAS_PROJECT relationships',  endpoint: 'GET /Item_Ticket + Change_Item + Item_Problem + Item_Project {searchText[itemtype]=PluginDataflowsDataflow, all at once}' },
  { id: 'dataflow_associated_items', label: 'Dataflow Associated Items',   tier: 'nightly', desc: 'Fetch items associated with each dataflow from PluginDataflowsDataflow_Item (apps, etc.) — groups client-side, creates ASSOCIATED_WITH relationships',         endpoint: 'GET /PluginDataflowsDataflow_Item {all at once, grouped client-side}' },
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

async function runProblemRecords(ctx) {
  const { baseUrl, sessionToken, appToken, s, meta, force } = ctx;
  const lastSync = !force && meta.problem_records?.lastSuccessAt
    ? meta.problem_records.lastSuccessAt.slice(0, 19).replace('T', ' ')
    : null;
  const from = lastSync || twoYearsAgo();
  const criteria = [
    `criteria[0][field]=19&criteria[0][searchtype]=morethan&criteria[0][value]=${encodeURIComponent(from)}`,
    'forcedisplay[0]=1&forcedisplay[1]=2&forcedisplay[2]=12&forcedisplay[3]=3&forcedisplay[4]=10&forcedisplay[5]=11&forcedisplay[6]=15&forcedisplay[7]=19',
  ].join('&');
  const items = await fetchSearchPages(baseUrl, `search/Problem?${criteria}&order=DESC&sort=19`, sessionToken, appToken);

  let count = 0;
  for (const item of items) {
    const id       = String(item['1']  || item.id       || '');
    const name     = String(item['2']  || item.name     || '');
    const status   = String(item['12'] || item.status   || '');
    const priority = String(item['3']  || item.priority || '');
    const urgency  = String(item['10'] || item.urgency  || '');
    const impact   = String(item['11'] || item.impact   || '');
    const date     = String(item['15'] || item.date     || '');
    const dateMod  = String(item['19'] || item.date_mod || '');
    if (!id) continue;
    await s.run(
      `MERGE (p:Problem { glpiId: $id })
       SET p.name = $name, p.status = $status, p.priority = $priority,
           p.urgency = $urgency, p.impact = $impact,
           p.date = $date, p.dateMod = $dateMod, p.updatedAt = $now`,
      { id, name, status, priority, urgency, impact, date, dateMod, now: new Date().toISOString() }
    );
    count++;
  }
  return { count, incremental: !!lastSync };
}

async function runReleaseRecords(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const releases = await fetchAllPages(baseUrl, 'PluginReleaseRelease?expand_dropdowns=true', sessionToken, appToken);
  let count = 0;
  for (const r of releases) {
    await s.run(
      `MERGE (r:Release { glpiId: $id }) SET r.name = $name, r.status = $status, r.date = $date, r.updatedAt = $now`,
      { id: String(r.id), name: r.name || '', status: String(r.status || ''), date: r.date || '', now: new Date().toISOString() }
    );
    count++;
  }
  return { count };
}

async function runTicketChangeLinks(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const changeRes = await s.run(`MATCH (c:Change) WHERE c.status IN ['1','2','3','4'] RETURN c.glpiId AS id LIMIT 200`);
  const changeIds = changeRes.records.map(r => r.get('id'));
  let count = 0;
  const BATCH = 20;
  for (let i = 0; i < changeIds.length; i += BATCH) {
    const batch = changeIds.slice(i, i + BATCH);
    await Promise.all(batch.map(async (cid) => {
      try {
        const links = await fetchAllPages(baseUrl, `Change/${cid}/Change_Ticket?expand_dropdowns=true`, sessionToken, appToken);
        for (const link of links) {
          const tid = String(link.tickets_id || link['2'] || '');
          if (!tid) continue;
          await s.run(
            `MATCH (c:Change { glpiId: $cid }), (t:Ticket { glpiId: $tid }) MERGE (c)-[:LINKED_TICKET]->(t)`,
            { cid: String(cid), tid }
          );
          count++;
        }
      } catch {}
    }));
  }
  return { count, changesProcessed: changeIds.length };
}

async function runCabValidations(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const changeRes = await s.run(`MATCH (c:Change) WHERE c.status IN ['1','2','3','4'] RETURN c.glpiId AS id LIMIT 200`);
  const changeIds = changeRes.records.map(r => r.get('id'));
  let count = 0;
  const BATCH = 20;
  for (let i = 0; i < changeIds.length; i += BATCH) {
    const batch = changeIds.slice(i, i + BATCH);
    await Promise.all(batch.map(async (cid) => {
      try {
        const validations = await fetchAllPages(baseUrl, `Change/${cid}/ChangeValidation?expand_dropdowns=true`, sessionToken, appToken);
        for (const v of validations) {
          await s.run(
            `MERGE (cv:ChangeValidation { glpiId: $id })
             SET cv.changeId = $changeId, cv.status = $status, cv.userId = $userId,
                 cv.date = $date, cv.comment = $comment, cv.updatedAt = $now
             WITH cv MATCH (c:Change { glpiId: $changeId })
             MERGE (c)-[:HAS_VALIDATION]->(cv)`,
            {
              id: String(v.id), changeId: String(cid), status: String(v.status || ''),
              userId: String(v.users_id || ''), date: v.date || '',
              comment: (v.comment || '').substring(0, 500), now: new Date().toISOString()
            }
          );
          count++;
        }
      } catch {}
    }));
  }
  return { count, changesProcessed: changeIds.length };
}

async function runTicketValidations(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const validations = await fetchAllPages(baseUrl, 'TicketValidation?expand_dropdowns=true', sessionToken, appToken);
  let count = 0;
  for (const v of validations) {
    const ticketId = String(v.tickets_id || '');
    if (!ticketId) continue;
    await s.run(
      `MERGE (tv:TicketValidation { glpiId: $id })
       SET tv.ticketId = $ticketId, tv.status = $status, tv.userId = $userId,
           tv.date = $date, tv.comment = $comment, tv.updatedAt = $now
       WITH tv MATCH (t:Ticket { glpiId: $ticketId })
       MERGE (t)-[:HAS_VALIDATION]->(tv)`,
      {
        id: String(v.id), ticketId, status: String(v.status || ''),
        userId: String(v.users_id || ''), date: v.date || '',
        comment: (v.comment || '').substring(0, 500), now: new Date().toISOString()
      }
    );
    count++;
  }
  return { count };
}

async function runReleaseHistory(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const changeRes = await s.run(`MATCH (c:Change) WHERE c.status IN ['1','2','3','4'] RETURN c.glpiId AS id LIMIT 200`);
  const changeIds = changeRes.records.map(r => r.get('id'));
  let count = 0;
  const BATCH = 20;
  for (let i = 0; i < changeIds.length; i += BATCH) {
    const batch = changeIds.slice(i, i + BATCH);
    await Promise.all(batch.map(async (cid) => {
      try {
        const logs = await fetchAllPages(baseUrl, `Change/${cid}/Log?expand_dropdowns=true`, sessionToken, appToken);
        count += logs.length;
      } catch {}
    }));
  }
  return { count, changesProcessed: changeIds.length };
}

async function runFollowupHistoryTickets(ctx) {
  const { baseUrl, sessionToken, appToken, s, ticketIds, meta, force } = ctx;
  const ids = ticketIds?.open || [];
  const lastSyncMs = !force && meta.followup_history_tickets?.lastSuccessAt
    ? new Date(meta.followup_history_tickets.lastSuccessAt).getTime()
    : 0;
  const BATCH = 50;
  let count = 0;
  const toProcess = ids.slice(0, 2000);
  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    await Promise.all(batch.map(async (tid) => {
      try {
        const followups = await fetchAllPages(baseUrl, `Ticket/${tid}/ITILFollowup?expand_dropdowns=true`, sessionToken, appToken);
        for (const f of followups) {
          if (lastSyncMs && new Date(f.date_mod || f.date || 0).getTime() < lastSyncMs) continue;
          await s.run(
            `MERGE (fh:Followup { glpiId: $id })
             SET fh.ticketId = $ticketId, fh.date = $date, fh.content = $content,
                 fh.authorType = $authorType, fh.userId = $userId, fh.updatedAt = $now
             WITH fh MATCH (t:Ticket { glpiId: $ticketId })
             MERGE (t)-[:HAS_FOLLOWUP]->(fh)`,
            {
              id: String(f.id), ticketId: String(tid), date: f.date || '',
              content: (f.content || '').substring(0, 500),
              authorType: String(f.requesttypes_id || 'unknown'),
              userId: String(f.users_id || ''), now: new Date().toISOString()
            }
          );
          count++;
        }
      } catch {}
    }));
  }
  return { count, ticketsProcessed: toProcess.length };
}

async function runFollowupHistoryChanges(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const changeRes = await s.run(`MATCH (c:Change) RETURN c.glpiId AS id LIMIT 500`);
  const changeIds = changeRes.records.map(r => r.get('id'));
  let count = 0;
  const BATCH = 30;
  for (let i = 0; i < changeIds.length; i += BATCH) {
    const batch = changeIds.slice(i, i + BATCH);
    await Promise.all(batch.map(async (cid) => {
      try {
        const followups = await fetchAllPages(baseUrl, `Change/${cid}/ITILFollowup?expand_dropdowns=true`, sessionToken, appToken);
        count += followups.length;
      } catch {}
    }));
  }
  return { count, changesProcessed: changeIds.length };
}

async function runSolutionHistory(ctx) {
  const { baseUrl, sessionToken, appToken, s, ticketIds, meta, force } = ctx;
  const ids = ticketIds?.all || [];
  const lastSyncMs = !force && meta.solution_history?.lastSuccessAt
    ? new Date(meta.solution_history.lastSuccessAt).getTime()
    : 0;
  const BATCH = 30;
  let count = 0;
  const toProcess = ids.slice(0, 1000);
  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    await Promise.all(batch.map(async (tid) => {
      try {
        const solutions = await fetchAllPages(baseUrl, `Ticket/${tid}/ITILSolution?expand_dropdowns=true`, sessionToken, appToken);
        for (const sol of solutions) {
          if (lastSyncMs && new Date(sol.date_mod || sol.date || 0).getTime() < lastSyncMs) continue;
          await s.run(
            `MERGE (sol:TicketSolution { glpiId: $id })
             SET sol.ticketId = $ticketId, sol.count = $solCount, sol.date = $date, sol.updatedAt = $now
             WITH sol MATCH (t:Ticket { glpiId: $ticketId })
             MERGE (t)-[:HAS_SOLUTION]->(sol)`,
            {
              id: String(sol.id || `${tid}_sol`), ticketId: String(tid),
              solCount: solutions.length, date: sol.date || '', now: new Date().toISOString()
            }
          );
          count++;
        }
      } catch {}
    }));
  }
  return { count, ticketsProcessed: toProcess.length };
}

async function runValidationHistory(ctx) {
  const { baseUrl, sessionToken, appToken, s, ticketIds } = ctx;
  const tids = (ticketIds?.all || []).slice(0, 1000);
  let count = 0;
  const BATCH = 30;
  for (let i = 0; i < tids.length; i += BATCH) {
    const batch = tids.slice(i, i + BATCH);
    await Promise.all(batch.map(async (tid) => {
      try {
        const validations = await fetchAllPages(baseUrl, `Ticket/${tid}/TicketValidation?expand_dropdowns=true`, sessionToken, appToken);
        for (const v of validations) {
          await s.run(
            `MERGE (tv:TicketValidation { glpiId: $id })
             SET tv.ticketId = $ticketId, tv.status = $status, tv.userId = $userId,
                 tv.date = $date, tv.updatedAt = $now
             WITH tv MATCH (t:Ticket { glpiId: $ticketId })
             MERGE (t)-[:HAS_VALIDATION]->(tv)`,
            {
              id: String(v.id), ticketId: String(tid), status: String(v.status || ''),
              userId: String(v.users_id || ''), date: v.date || '', now: new Date().toISOString()
            }
          );
          count++;
        }
      } catch {}
    }));
  }
  // Also pull change validations
  const changeRes = await s.run(`MATCH (c:Change) RETURN c.glpiId AS id LIMIT 200`);
  const changeIds = changeRes.records.map(r => r.get('id'));
  for (let i = 0; i < changeIds.length; i += BATCH) {
    const batch = changeIds.slice(i, i + BATCH);
    await Promise.all(batch.map(async (cid) => {
      try {
        const validations = await fetchAllPages(baseUrl, `Change/${cid}/ChangeValidation?expand_dropdowns=true`, sessionToken, appToken);
        count += validations.length;
      } catch {}
    }));
  }
  return { count };
}

async function runFieldChangeHistory(ctx) {
  const { baseUrl, sessionToken, appToken, s, ticketIds, meta, force } = ctx;
  const ids = ticketIds?.open || [];
  const lastSyncMs = !force && meta.field_change_history?.lastSuccessAt
    ? new Date(meta.field_change_history.lastSuccessAt).getTime()
    : 0;
  const BATCH = 30;
  let count = 0;
  const toProcess = ids.slice(0, 1000);
  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    await Promise.all(batch.map(async (tid) => {
      try {
        const logs = await fetchAllPages(baseUrl, `Ticket/${tid}/Log?expand_dropdowns=true`, sessionToken, appToken);
        for (const log of logs) {
          if (lastSyncMs && new Date(log.date_mod || 0).getTime() < lastSyncMs) continue;
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
      } catch {}
    }));
  }
  return { count, ticketsProcessed: toProcess.length };
}

async function runAppStructures(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const items = await fetchAllPages(baseUrl, 'PluginArchiswSwcomponent?expand_dropdowns=true', sessionToken, appToken);
  ctx.appIdMap = new Map();
  let count = 0;

  const stripHtml = str => (str || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#60;/g, '<').replace(/&#62;/g, '>').replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ').trim();

  const dec = str => (str || '').toString()
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#60;/g, '<').replace(/&#62;/g, '>').replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

  const row = (label, value) => {
    const v = dec(String(value || '')).replace(/^0$/, '').trim();
    return v ? `| ${label} | ${v} |` : null;
  };
  const linkRow = (label, url) => url ? `| ${label} | [${url}](${url}) |` : null;

  for (const item of items) {
    const appId          = String(item.id);
    const appName        = item.name || appId;
    ctx.appIdMap.set(appId, appName);

    const appType        = String(item.plugin_archisw_swcomponenttypes_id || '');
    const appEntity      = String(item.entities_id || '');
    const appDesc        = stripHtml(item.shortdescription || item.description || '');
    const appComment     = stripHtml(item.comment || '');
    const appStatus      = String(item.plugin_archisw_swcomponentstates_id || '');
    const appStatusDate  = item.statedate ? String(item.statedate).substring(0, 10) : '';
    const appSupplier    = String(item.suppliers_id || '');
    const appUrlProd     = item.address     || '';
    const appUrlQA       = item.address_qa  || '';
    const appOwner       = String(item.groups_id || '');
    const appSla         = String(item.plugin_archisw_swcomponentslas_id || '');
    const appDataClass   = String(item.plugin_archisw_swcomponentusers_id || '');
    const appDatabase    = String(item.plugin_archisw_swcomponentdbs_id   || '');
    const appLocation    = String(item.locations_id || '');
    const appTargets     = String(item.plugin_archisw_swcomponenttargets_id || '');
    const appDevLang     = String(item.plugin_archisw_swcomponenttechnics_id || '');
    const appInUseSince  = String(item.plugin_archisw_inusesinceyear || '');
    const appInstances   = String(item.plugin_archisw_swcomponentinstances_id || '');
    const appRepo        = item.repo         || '';
    const appHealthCheck = item.health_check || '';
    const appVersion     = item.version      || '';
    const appDateMod     = item.date_mod ? String(item.date_mod).substring(0, 10) : '';
    const now            = new Date().toISOString();

    await s.run(
      `MERGE (a:Application { name: $name })
       SET a.glpiId = $id, a.type = $type, a.entity = $entity,
           a.description = $desc, a.comment = $comment,
           a.supplier = $supplier, a.urlProd = $urlProd, a.urlQA = $urlQA,
           a.owner = $owner, a.sla = $sla, a.instances = $instances,
           a.database = $database, a.location = $location, a.targets = $targets,
           a.status = $status, a.statusDate = $statusDate, a.devLanguage = $devLang,
           a.inUseSince = $inUseSince, a.dataClassification = $dataClass,
           a.repo = $repo, a.healthCheck = $healthCheck, a.version = $version,
           a.updatedAt = $now`,
      {
        name: appName, id: appId, type: appType, entity: appEntity,
        desc: appDesc, comment: appComment, status: appStatus, statusDate: appStatusDate,
        supplier: appSupplier, urlProd: appUrlProd, urlQA: appUrlQA,
        owner: appOwner, sla: appSla, instances: appInstances,
        database: appDatabase, location: appLocation, targets: appTargets,
        devLang: appDevLang, inUseSince: appInUseSince, dataClass: appDataClass,
        repo: appRepo, healthCheck: appHealthCheck, version: appVersion, now,
      }
    );

    try {
      const appTopic = `Application #${appId} — ${appName}`;
      const glpiLink = `${baseUrl}/plugins/archisw/front/swcomponent.form.php?id=${appId}`;

      const content = [
        `## Application #${appId} — ${appName}`,
        '',
        appDesc ? `> ${appDesc}` : null,
        '',
        '### General',
        '| Field | Value |',
        '|---|---|',
        `| GLPI ID | [${appId}](${glpiLink}) |`,
        row('Status',        appStatus),
        row('Status Since',  appStatusDate),
        row('Entity',        appEntity),
        row('Last Modified', appDateMod),
        `| Last Synced | ${now.substring(0, 10)} |`,
        '',
        '### Classification',
        '| Field | Value |',
        '|---|---|',
        row('Type',                appType),
        row('Data Classification', appDataClass),
        row('Targets',             appTargets),
        row('SLA',                 appSla),
        row('Version',             appVersion),
        row('In Use Since',        appInUseSince),
        row('Database',            appDatabase),
        row('Dev Language',        appDevLang),
        '',
        '### Ownership',
        '| Field | Value |',
        '|---|---|',
        row('Owner Group', appOwner),
        row('Supplier',    appSupplier),
        '',
        '### Access',
        '| Field | Value |',
        '|---|---|',
        linkRow('Production URL', appUrlProd),
        linkRow('QA URL',         appUrlQA),
        linkRow('Health Check',   appHealthCheck),
        linkRow('Repository',     appRepo),
      ].filter(v => v !== null && v !== undefined).join('\n');

      // toString() handles glpiId stored as integer by older sync runs
      const kRes = await s.run(
        `MATCH (k:Knowledge) WHERE k.category = 'application' AND toString(k.glpiId) = $glpiId
         RETURN k.id AS id ORDER BY k.createdAt ASC`,
        { glpiId: appId }
      );
      if (kRes.records.length > 0) {
        const keepId = kRes.records[0].get('id');
        // Remove duplicates created by the type mismatch
        if (kRes.records.length > 1) {
          const dupeIds = kRes.records.slice(1).map(r => r.get('id'));
          await s.run(`MATCH (k:Knowledge) WHERE k.id IN $ids DETACH DELETE k`, { ids: dupeIds });
        }
        await s.run(
          `MATCH (k:Knowledge) WHERE k.id = $id
           SET k.topic = $topic, k.content = $content, k.glpiId = $glpiId,
               k.supplier = $supplier, k.urlProd = $urlProd, k.urlQA = $urlQA,
               k.owner = $owner, k.sla = $sla, k.glpiSyncedAt = $now`,
          { id: keepId, topic: appTopic, content, glpiId: appId,
            supplier: appSupplier, urlProd: appUrlProd, urlQA: appUrlQA,
            owner: appOwner, sla: appSla, now }
        );
      } else {
        await s.run(
          `CREATE (k:Knowledge {
             id: $id, topic: $topic, content: $content,
             category: 'application', source: 'glpi-sync',
             glpiId: $glpiId, reviewStatus: 'to_be_reviewed',
             supplier: $supplier, urlProd: $urlProd, urlQA: $urlQA,
             owner: $owner, sla: $sla, glpiSyncedAt: $now,
             tags: ['application','glpi'], createdAt: $now
           })`,
          { id: uuid(), topic: appTopic, content, glpiId: appId,
            supplier: appSupplier, urlProd: appUrlProd, urlQA: appUrlQA,
            owner: appOwner, sla: appSla, now }
        );
      }
    } catch {}

    count++;
  }
  return { count };
}

// Fetch items linked to an app via GLPI sub-item junction (e.g. Item_Ticket → Ticket details).
// 1. Fetches PluginArchiswSwcomponent/{id}/{subType}/ to get the linking rows.
// 2. Extracts each item ID from the rel-link href.
// 3. Batch-fetches the actual item records for full details.
const fetchAppLinkedItems = async (base, appId, subType, glpiType, sessionToken, appToken) => {
  const agent = base.startsWith('https') ? httpsAgent : undefined;
  const hdrs  = { 'Session-Token': sessionToken, 'App-Token': appToken, 'Content-Type': 'application/json' };
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    enforceGetOnly('GET');
    const linkRes = await fetch(
      `${base}/apirest.php/PluginArchiswSwcomponent/${appId}/${subType}/?range=0-99&expand_dropdowns=true`,
      { method: 'GET', headers: hdrs, agent, signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!linkRes.ok) return [];
    const linkData = await linkRes.json();
    if (!Array.isArray(linkData)) return [];

    const ids = linkData.map(entry => {
      const link = (entry.links || []).find(l => l.rel === glpiType);
      if (!link) return null;
      const m = link.href.match(/\/(\d+)\/?$/);
      return m ? m[1] : null;
    }).filter(Boolean);

    if (!ids.length) return [];

    const items = await Promise.all(ids.map(async itemId => {
      try {
        enforceGetOnly('GET');
        const r = await fetch(
          `${base}/apirest.php/${glpiType}/${itemId}?expand_dropdowns=true`,
          { method: 'GET', headers: hdrs, agent }
        );
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    }));
    return items.filter(Boolean);
  } catch { clearTimeout(timer); return []; }
};

async function runAppStructuresHistory(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const now = new Date().toISOString();

  // Load all Application nodes with their last-seen log ID for incremental sync
  const appRes = await s.run(`MATCH (a:Application) WHERE a.glpiId IS NOT NULL AND a.glpiId <> '' RETURN a.glpiId AS id, coalesce(a.lastLogId, '0') AS lastLogId`);
  const apps = appRes.records.map(r => ({ id: r.get('id'), lastLogId: parseInt(r.get('lastLogId'), 10) || 0 }));

  const BATCH = 10;
  let count = 0;

  for (let i = 0; i < apps.length; i += BATCH) {
    const batch = apps.slice(i, i + BATCH);

    const fetched = await Promise.all(
      batch.map(async ({ id, lastLogId }) => {
        const logs = await fetchAppSub(baseUrl, id, 'Log', sessionToken, appToken);
        const newLogs = logs.filter(l => l.id > lastLogId);
        return { id, newLogs };
      })
    );

    for (const { id, newLogs } of fetched) {
      if (!newLogs.length) continue;

      for (const log of newLogs) {
        try {
          await s.run(
            `MERGE (l:AppLog { glpiId: $logId })
             SET l.appId       = $appId,
                 l.action      = $action,
                 l.user        = $user,
                 l.date        = $date,
                 l.fieldOption = $fieldOpt,
                 l.oldValue    = $old,
                 l.newValue    = $new,
                 l.updatedAt   = $now
             WITH l
             MATCH (a:Application { glpiId: $appId })
             MERGE (a)-[:HAS_LOG]->(l)`,
            {
              logId:    String(log.id),
              appId:    String(id),
              action:   String(log.linked_action ?? ''),
              user:     String(log.user_name || ''),
              date:     String(log.date_mod || ''),
              fieldOpt: String(log.id_search_option ?? ''),
              old:      String(log.old_value || ''),
              new:      String(log.new_value || ''),
              now,
            }
          );
          count++;
        } catch {}
      }

      // Update lastActivity, lastEditor and lastLogId on the Application node
      const latest = newLogs.reduce((a, b) => (a.id > b.id ? a : b));
      try {
        await s.run(
          `MATCH (a:Application { glpiId: $appId })
           SET a.lastActivity = $date,
               a.lastEditor   = $user,
               a.lastLogId    = $logId`,
          {
            appId:  String(id),
            date:   String(latest.date_mod || ''),
            user:   String(latest.user_name || ''),
            logId:  String(latest.id),
          }
        );
      } catch {}
    }
  }

  return { count, appsProcessed: apps.length };
}

// ── DATAFLOW LOOKUP HELPERS ───────────────────────────────────────────────────

async function runDataflowLookups(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const LOOKUP_TABLES = [
    { endpoint: 'PluginDataflowsHolidayAction',   table: 'holiday_action' },
    { endpoint: 'PluginDataflowsState',            table: 'state' },
    { endpoint: 'PluginDataflowsType',             table: 'type' },
    { endpoint: 'PluginDataflowsTransferProtocol', table: 'protocol' },
    { endpoint: 'PluginDataflowsTriggerType',      table: 'trigger_type' },
    { endpoint: 'PluginDataflowsTransferFreq',     table: 'frequency' },
    { endpoint: 'PluginDataflowsPattern',          table: 'pattern' },
    { endpoint: 'PluginDataflowsMode',             table: 'mode' },
    { endpoint: 'PluginDataflowsErrorHandling',    table: 'error_handling' },
    { endpoint: 'PluginDataflowsIndicator',        table: 'indicator' },
  ];
  const GDPR_PREFIX = {
    'Level 1': '🔴 Customer Confidential Data',
    'Level 2': '🟡 Indirect Customer Identification',
    'Level 3': '🟢 Nonidentifiable / anonymous data',
  };
  let count = 0;
  for (const { endpoint, table } of LOOKUP_TABLES) {
    try {
      const items = await fetchAllPages(baseUrl, `${endpoint}?range=0-999`, sessionToken, appToken);
      for (const item of items) {
        const rawMeaning = String(item.name || item.completename || '');
        const meaning = table === 'holiday_action' ? (GDPR_PREFIX[rawMeaning] || rawMeaning) : rawMeaning;
        await s.run(
          `MERGE (l:DataflowLookup { table: $table, glpiId: $id })
           SET l.name = $name, l.meaning = $meaning, l.updatedAt = $now`,
          { table, id: String(item.id), name: rawMeaning, meaning, now: new Date().toISOString() }
        ).catch(() => {});
        count++;
      }
    } catch {}
  }
  // Cache in ctx so runDataflows can use it without another Neo4j query
  ctx.lookupMap = {};
  const lRes = await s.run(`MATCH (l:DataflowLookup) RETURN l.table AS t, l.glpiId AS id, l.name AS name, l.meaning AS meaning`);
  for (const rec of lRes.records) {
    const t = rec.get('t');
    if (!ctx.lookupMap[t]) ctx.lookupMap[t] = new Map();
    ctx.lookupMap[t].set(rec.get('id'), { name: rec.get('name'), meaning: rec.get('meaning') });
  }
  return { count };
}

async function runDataflowHistory(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const dfRes = await s.run(`MATCH (d:Dataflow) RETURN d.glpiId AS id, coalesce(d.lastLogId, '0') AS lastLogId`);
  const dataflows = dfRes.records.map(r => ({ id: r.get('id'), lastLogId: parseInt(r.get('lastLogId'), 10) || 0 }));
  const BATCH = 10;
  let count = 0;
  for (let i = 0; i < dataflows.length; i += BATCH) {
    const batch = dataflows.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map(async ({ id, lastLogId }) => {
        const logs = await fetchDataflowSub(baseUrl, id, 'Log', sessionToken, appToken);
        return { id, newLogs: logs.filter(l => l.id > lastLogId) };
      })
    );
    for (const { id, newLogs } of fetched) {
      if (!newLogs.length) continue;
      for (const log of newLogs) {
        try {
          await s.run(
            `MERGE (l:DataflowLog { glpiId: $logId })
             SET l.dataflowId = $dfId, l.action = $action, l.user = $user,
                 l.date = $date, l.fieldOption = $fieldOpt,
                 l.oldValue = $old, l.newValue = $new, l.updatedAt = $now
             WITH l MATCH (d:Dataflow { glpiId: $dfId }) MERGE (d)-[:HAS_LOG]->(l)`,
            {
              logId: String(log.id), dfId: String(id),
              action: String(log.itemtype || ''), user: String(log.user_name || ''),
              date: String(log.date_mod || ''), fieldOpt: String(log.field || ''),
              old: String(log.old_value || ''), new: String(log.new_value || ''),
              now: new Date().toISOString(),
            }
          );
          count++;
        } catch {}
      }
      const latest = newLogs.reduce((a, b) => (a.id > b.id ? a : b));
      try {
        await s.run(
          `MATCH (d:Dataflow { glpiId: $dfId })
           SET d.lastActivity = $date, d.lastEditor = $user, d.lastLogId = $logId`,
          { dfId: String(id), date: String(latest.date_mod || ''), user: String(latest.user_name || ''), logId: String(latest.id) }
        );
      } catch {}
    }
  }
  return { count, dataflowsProcessed: dataflows.length };
}

// Resolve a lookup value (by numeric ID or label string) from ctx.lookupMap
const resolveLookup = (table, val, ctx) => {
  if (!val || val === '0') return '';
  const v = String(val);
  const map = ctx.lookupMap ? ctx.lookupMap[table] : null;
  if (!map) return v;
  const entry = map.get(v);
  if (entry) return entry.meaning || entry.name || v;
  // Fallback: search by name match
  for (const e of map.values()) {
    if (e.name === v) return e.meaning || e.name || v;
  }
  return v;
};

async function runDataflows(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;
  const INACTIVE = ['removed', 'stopped', 'inactive', 'deleted'];

  // Load lookup map from Neo4j if dataflow_lookups didn't already populate it this run
  if (!ctx.lookupMap) {
    ctx.lookupMap = {};
    try {
      const lRes = await s.run(`MATCH (l:DataflowLookup) RETURN l.table AS t, l.glpiId AS id, l.name AS name, l.meaning AS meaning`);
      for (const rec of lRes.records) {
        const t = rec.get('t');
        if (!ctx.lookupMap[t]) ctx.lookupMap[t] = new Map();
        ctx.lookupMap[t].set(rec.get('id'), { name: rec.get('name'), meaning: rec.get('meaning') });
      }
    } catch {}
  }

  // Use appIdMap built by runAppStructures if available, else fetch it now
  if (!ctx.appIdMap) {
    ctx.appIdMap = new Map();
    try {
      const apps = await fetchAllPages(baseUrl, 'PluginArchiswSwcomponent?expand_dropdowns=true', sessionToken, appToken);
      for (const a of apps) { if (a.id && a.name) ctx.appIdMap.set(String(a.id), a.name); }
    } catch {}
  }
  // Reverse map: name → glpiId (needed for building GLPI links when expand_dropdowns returns labels)
  const appNameToId = new Map();
  for (const [id, name] of ctx.appIdMap) appNameToId.set(name, id);

  const resolveApp = (val) => {
    if (!val || val === '0') return '';
    const v = String(val);
    return /^\d+$/.test(v) ? (ctx.appIdMap.get(v) || v) : v;
  };

  const items = await fetchAllPages(baseUrl, 'PluginDataflowsDataflow?expand_dropdowns=true', sessionToken, appToken);
  let count = 0;

  for (const item of items) {
    const rawStatus = String(item.plugin_dataflows_states_id || '').toLowerCase();
    if (INACTIVE.some(s => rawStatus.includes(s))) continue;

    const dfId         = String(item.id);
    const dfName       = item.name || dfId;
    const dfStatusRaw  = String(item.plugin_dataflows_states_id || '');
    const dfComplexity = String(item.plugin_dataflows_types_id || '');
    const dfProtocol   = String(item.plugin_dataflows_transferprotocols_id || '');
    const dfFlowGroup  = String(item.plugin_dataflows_flowgroups_id || '');
    const dfDesc       = item.shortdescription || '';
    const src          = resolveApp(item.plugin_dataflows_fromswcomponents_id);
    const dst          = resolveApp(item.plugin_dataflows_toswcomponents_id);
    const now          = new Date().toISOString();

    await s.run(
      `MERGE (d:Dataflow { glpiId: $id })
       SET d.name = $name, d.status = $status, d.complexity = $complexity,
           d.protocol = $protocol, d.flowGroup = $flowGroup,
           d.trigger = $trigger, d.frequency = $frequency,
           d.sourceApp = $src, d.destApp = $dst,
           d.owner = $owner, d.group = $grp,
           d.indicator = $indicator, d.mappingDoc = $mDoc,
           d.technicalDoc = $tDoc, d.description = $desc,
           d.updatedAt = $now`,
      {
        id: dfId, name: dfName, status: dfStatusRaw,
        complexity: dfComplexity, protocol: dfProtocol, flowGroup: dfFlowGroup,
        trigger: String(item.plugin_dataflows_triggertypes_id || ''),
        frequency: String(item.plugin_dataflows_transferfreqs_id || ''),
        src, dst, owner: String(item.users_id || ''), grp: String(item.groups_id || ''),
        indicator: String(item.plugin_dataflows_indicators_id || ''),
        mDoc: item.mappingdocurl || '', tDoc: item.technicaldocurl || '',
        desc: dfDesc, now,
      }
    );

    // Knowledge upsert — full markdown table format
    try {
      const dfTopic   = `Dataflow #${dfId} — ${dfName}`;
      const dfGdpr    = resolveLookup('holiday_action', item.plugin_dataflows_holidayactions_id, ctx);
      const dfIndicator = String(item.plugin_dataflows_indicators_id || '');
      const srcGlpiId = src ? appNameToId.get(src) : null;
      const dstGlpiId = dst ? appNameToId.get(dst) : null;
      const srcLink   = src && srcGlpiId
        ? `[${src}](${baseUrl}/plugins/archisw/front/swcomponent.form.php?id=${srcGlpiId})`
        : (src || 'unknown');
      const dstLink   = dst && dstGlpiId
        ? `[${dst}](${baseUrl}/plugins/archisw/front/swcomponent.form.php?id=${dstGlpiId})`
        : (dst || 'unknown');
      const dateMod   = String(item.date_mod || '').substring(0, 10);
      const row = (k, v) => v ? `| ${k} | ${v} |` : '';
      const dfContent = [
        `## Dataflow #${dfId} — ${dfName}`,
        '',
        dfDesc ? `> ${dfDesc}` : '',
        '',
        '### General',
        '| Field | Value |',
        '|---|---|',
        row('GLPI ID',        dfId),
        row('Name',           dfName),
        row('Status',         dfStatusRaw),
        row('Flow Group',     dfFlowGroup),
        row('GDPR Level',     dfGdpr),
        row('Indicator',      dfIndicator),
        dateMod ? `| Last Modified | ${dateMod} |` : '',
        `| Last Synced | ${now.split('T')[0]} |`,
        '',
        '### Flow',
        '| Field | Value |',
        '|---|---|',
        `| From | ${srcLink} |`,
        `| To | ${dstLink} |`,
        row('From Auth',         String(item.plugin_dataflows_fromauthtypes_id || '')),
        row('To Auth',           String(item.plugin_dataflows_toauthtypes_id   || '')),
        row('From External URL', item.plugin_dataflows_fromexternal || ''),
        row('To External URL',   item.plugin_dataflows_toexternal   || ''),
        '',
        '### Technical',
        '| Field | Value |',
        '|---|---|',
        row('Complexity', dfComplexity),
        row('Protocol',   dfProtocol),
        row('Pattern',          String(item.plugin_dataflows_patterns_id          || '')),
        row('Mode',             String(item.plugin_dataflows_modes_id              || '')),
        row('Trigger',          String(item.plugin_dataflows_triggertypes_id       || '')),
        row('Frequency',        String(item.plugin_dataflows_transferfreqs_id      || '')),
        row('Error Handling',   String(item.plugin_dataflows_errorhandlings_id     || '')),
        row('Source Connector', String(item.plugin_dataflows_sourceconnectors_id   || '')),
        '',
        '### Ownership',
        '| Field | Value |',
        '|---|---|',
        row('Owner',         String(item.users_id  || '')),
        row('Group',         String(item.groups_id || '')),
        row('Support Group', String(item.plugin_dataflows_supportgroups_id || '')),
        '',
        '### Documentation',
        '| Field | Value |',
        '|---|---|',
        row('Mapping Doc',   item.mappingdocurl  || ''),
        row('Technical Doc', item.technicaldocurl || ''),
      ].filter(v => v !== undefined && v !== null).join('\n');

      const kRes = await s.run(
        `MATCH (k:Knowledge) WHERE k.category = 'dataflow' AND k.glpiId = $glpiId RETURN k.id AS id`,
        { glpiId: dfId }
      );
      if (kRes.records.length === 0) {
        await s.run(
          `CREATE (k:Knowledge {
             id: $id, topic: $topic, content: $content,
             category: 'dataflow', source: 'glpi-sync',
             glpiId: $glpiId, reviewStatus: 'to_be_reviewed',
             tags: ['dataflow','glpi'], createdAt: $now
           })`,
          { id: uuid(), topic: dfTopic, content: dfContent, glpiId: dfId, now }
        );
      } else {
        for (const rec of kRes.records) {
          await s.run(
            `MATCH (k:Knowledge) WHERE k.id = $id SET k.topic = $topic, k.content = $content, k.glpiSyncedAt = $now`,
            { id: rec.get('id'), topic: dfTopic, content: dfContent, now }
          );
        }
      }
    } catch {}

    // Relationships — mirrors sync.js exactly
    if (src) await s.run(
      `MERGE (a:Application { name: $name }) SET a.updatedAt = $now
       WITH a MATCH (d:Dataflow { glpiId: $dfId }) MERGE (a)-[:FEEDS_INTO]->(d)`,
      { name: src, dfId, now }
    ).catch(() => {});
    if (dst) await s.run(
      `MERGE (a:Application { name: $name }) SET a.updatedAt = $now
       WITH a MATCH (d:Dataflow { glpiId: $dfId }) MERGE (d)-[:FEEDS_INTO]->(a)`,
      { name: dst, dfId, now }
    ).catch(() => {});
    if (src && dst) await s.run(
      `MERGE (s:Application { name: $src })
       MERGE (t:Application { name: $dst })
       MERGE (s)-[r:CONNECTS_TO]->(t)
       SET r.via = coalesce(r.via, $via), r.updatedAt = $now`,
      { src, dst, via: dfName, now }
    ).catch(() => {});

    count++;
  }
  return { count };
}

// ── DATAFLOW SUB-ITEM HELPERS ─────────────────────────────────────────────────

// Fetch one dataflow's sub-items (Ticket, Change, PluginArchiswSwcomponent) with a 20 s hard timeout.
// Returns [] on any error or timeout so a single bad dataflow never blocks the batch.
const fetchDataflowSub = async (baseUrl, dfId, subType, sessionToken, appToken) => {
  const agent = baseUrl.startsWith('https') ? httpsAgent : undefined;
  const url = `${baseUrl}/apirest.php/PluginDataflowsDataflow/${dfId}/${subType}?range=0-999&expand_dropdowns=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    enforceGetOnly('GET');
    const r = await fetch(url, {
      method: 'GET',
      headers: { 'Session-Token': sessionToken, 'App-Token': appToken, 'Content-Type': 'application/json' },
      agent,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (r.status !== 200 && r.status !== 206) return [];
    const body = await r.json();
    return Array.isArray(body) ? body : (body.data || []);
  } catch {
    clearTimeout(timer);
    return [];
  }
};

async function runDataflowITSMLinks(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;

  // ① Fetch all 4 junction tables in parallel — one request each, all dataflows covered
  const [itemTickets, changeItems, itemProblems, itemProjects] = await Promise.all([
    fetchAllPages(baseUrl, 'Item_Ticket?searchText[itemtype]=PluginDataflowsDataflow', sessionToken, appToken),
    fetchAllPages(baseUrl, 'Change_Item?searchText[itemtype]=PluginDataflowsDataflow', sessionToken, appToken),
    fetchAllPages(baseUrl, 'Item_Problem?searchText[itemtype]=PluginDataflowsDataflow', sessionToken, appToken),
    fetchAllPages(baseUrl, 'Item_Project?searchText[itemtype]=PluginDataflowsDataflow', sessionToken, appToken),
  ]);

  // ② Group by dataflow ID client-side
  const byDf = {};
  const ensure = id => { if (!byDf[id]) byDf[id] = { tickets: [], changes: [], problems: [], projects: [] }; };
  for (const row of itemTickets)  { const id = String(row.items_id);     ensure(id); byDf[id].tickets.push(String(row.tickets_id)); }
  for (const row of changeItems)  { const id = String(row.items_id);     ensure(id); byDf[id].changes.push(String(row.changes_id)); }
  for (const row of itemProblems) { const id = String(row.items_id);     ensure(id); byDf[id].problems.push(String(row.problems_id)); }
  for (const row of itemProjects) { const id = String(row.items_id);     ensure(id); byDf[id].projects.push(String(row.projects_id)); }

  // ③ Write stub nodes + rels to Neo4j sequentially — MERGE is idempotent
  let count = 0;
  for (const [dfId, links] of Object.entries(byDf)) {
    for (const ticketId of links.tickets) {
      try {
        await s.run(
          `MERGE (t:Ticket { glpiId: $id }) WITH t MATCH (d:Dataflow { glpiId: $dfId }) MERGE (d)-[:HAS_TICKET]->(t)`,
          { id: ticketId, dfId }
        );
        count++;
      } catch {}
    }
    for (const changeId of links.changes) {
      try {
        await s.run(
          `MERGE (c:Change { glpiId: $id }) WITH c MATCH (d:Dataflow { glpiId: $dfId }) MERGE (d)-[:HAS_CHANGE]->(c)`,
          { id: changeId, dfId }
        );
        count++;
      } catch {}
    }
    for (const problemId of links.problems) {
      try {
        await s.run(
          `MERGE (p:Problem { glpiId: $id }) WITH p MATCH (d:Dataflow { glpiId: $dfId }) MERGE (d)-[:HAS_PROBLEM]->(p)`,
          { id: problemId, dfId }
        );
        count++;
      } catch {}
    }
    for (const projectId of links.projects) {
      try {
        await s.run(
          `MERGE (p:Project { glpiId: $id }) WITH p MATCH (d:Dataflow { glpiId: $dfId }) MERGE (d)-[:HAS_PROJECT]->(p)`,
          { id: projectId, dfId }
        );
        count++;
      } catch {}
    }
  }

  return {
    count,
    tickets: itemTickets.length,
    changes: changeItems.length,
    problems: itemProblems.length,
    projects: itemProjects.length,
  };
}

async function runDataflowAssociatedItems(ctx) {
  const { baseUrl, sessionToken, appToken, s } = ctx;

  // ① Fetch all PluginDataflowsDataflow_Item rows at once — avoids LIKE-match issue with per-id searchText
  const items = await fetchAllPages(baseUrl, 'PluginDataflowsDataflow_Item', sessionToken, appToken);

  // ② Group by dataflow ID client-side (field is numeric, no expand_dropdowns needed)
  const byDf = {};
  for (const row of items) {
    const dfId = String(row.plugin_dataflows_dataflows_id);
    (byDf[dfId] ??= []).push(row);
  }

  // ③ Write ASSOCIATED_WITH rels to Neo4j sequentially
  let count = 0;
  for (const [dfId, dfItems] of Object.entries(byDf)) {
    for (const item of dfItems) {
      if (item.itemtype !== 'PluginArchiswSwcomponent') continue;
      try {
        await s.run(
          `MATCH (a:Application { glpiId: $itemId })
           WITH a
           MATCH (d:Dataflow { glpiId: $dfId })
           MERGE (d)-[:ASSOCIATED_WITH]->(a)`,
          { itemId: String(item.items_id), dfId }
        );
        count++;
      } catch {}
    }
  }

  return { count, totalItems: items.length };
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
  followup_analysis:         runFollowupAnalysis,
  change_field_discovery:    runChangeFieldDiscovery,
  change_records:            runChangeRecords,
  problem_records:           runProblemRecords,
  release_records:           runReleaseRecords,
  ticket_change_links:       runTicketChangeLinks,
  cab_validations:           runCabValidations,
  ticket_validations:        runTicketValidations,
  release_history:           runReleaseHistory,
  followup_history_tickets:  runFollowupHistoryTickets,
  followup_history_changes:  runFollowupHistoryChanges,
  solution_history:          runSolutionHistory,
  validation_history:        runValidationHistory,
  field_change_history:      runFieldChangeHistory,
  app_structures:            runAppStructures,
  app_structures_history:    runAppStructuresHistory,
  dataflow_lookups:          runDataflowLookups,
  dataflow_history:          runDataflowHistory,
  dataflows:                 runDataflows,
  dataflow_itsm_links:       runDataflowITSMLinks,
  dataflow_associated_items: runDataflowAssociatedItems,
};

// ── ENDPOINTS ─────────────────────────────────────────────────────────────────

// ── ABORT FLAG ────────────────────────────────────────────────────────────────
let abortRequested = false;

// POST /api/pipeline/abort — request a running pipeline to stop after its current stage
router.post('/abort', async (req, res) => {
  abortRequested = true;
  // Also mark any "running" stage as aborted in Neo4j so the UI reflects it immediately
  const s = driver.session();
  try {
    await s.run(
      `MATCH (m:PipelineMeta { status: 'running' })
       SET m.status = 'error', m.errorMessage = 'Aborted by user', m.lastRunEnd = $now`,
      { now: new Date().toISOString() }
    );
  } catch {} finally { await s.close(); }
  res.json({ success: true, message: 'Abort requested — pipeline stops after current stage' });
});

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

    // Store counts — run sequentially (Neo4j sessions do not support concurrent queries)
    const countOf = async (q) => { const r = await s.run(q); return r.records[0]?.get('c').toNumber() || 0; };
    const store = {
      tickets:      await countOf('MATCH (t:Ticket) RETURN count(t) AS c'),
      followups:    await countOf('MATCH (f:Followup) RETURN count(f) AS c'),
      reopens:      await countOf('MATCH (s:TicketSolution) RETURN count(s) AS c'),
      history:      await countOf('MATCH (l:TicketLog) RETURN count(l) AS c'),
      tasks:        await countOf('MATCH (t:TicketTask) RETURN count(t) AS c'),
      users:        await countOf('MATCH (u:User) RETURN count(u) AS c'),
      groups:       await countOf('MATCH (g:Group) RETURN count(g) AS c'),
      categories:   await countOf('MATCH (c:ITILCategory) RETURN count(c) AS c'),
      changes:      await countOf('MATCH (c:Change) RETURN count(c) AS c'),
      dataflows:    await countOf('MATCH (d:Dataflow) RETURN count(d) AS c'),
      applications: await countOf('MATCH (a:Application) RETURN count(a) AS c'),
    };

    // Merge stage defs with metadata
    const stages = STAGES.map(def => ({
      ...def,
      status:        stagesMeta[def.id]?.status        || 'never_run',
      lastRun:       stagesMeta[def.id]?.lastRun       || null,
      lastRunEnd:    stagesMeta[def.id]?.lastRunEnd     || null,
      lastSuccessAt: stagesMeta[def.id]?.lastSuccessAt || null,
      duration:      stagesMeta[def.id]?.duration      || null,
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
    const countOf = async (q) => { const r = await s.run(q); return r.records[0]?.get('c').toNumber() || 0; };
    res.json({
      tickets:      await countOf('MATCH (t:Ticket) RETURN count(t) AS c'),
      followups:    await countOf('MATCH (f:Followup) RETURN count(f) AS c'),
      reopens:      await countOf('MATCH (s:TicketSolution) RETURN count(s) AS c'),
      history:      await countOf('MATCH (l:TicketLog) RETURN count(l) AS c'),
      tasks:        await countOf('MATCH (t:TicketTask) RETURN count(t) AS c'),
      users:        await countOf('MATCH (u:User) RETURN count(u) AS c'),
      groups:       await countOf('MATCH (g:Group) RETURN count(g) AS c'),
      categories:   await countOf('MATCH (c:ITILCategory) RETURN count(c) AS c'),
      changes:      await countOf('MATCH (c:Change) RETURN count(c) AS c'),
      dataflows:    await countOf('MATCH (d:Dataflow) RETURN count(d) AS c'),
      applications: await countOf('MATCH (a:Application) RETURN count(a) AS c'),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await s.close();
  }
});

// POST /api/pipeline/run — execute the pipeline
// Body: { glpiUrl, userToken, appToken, tier?, force?, stages? }
// Credentials are optional if PipelineConfig is stored in Neo4j.
router.post('/run', async (req, res) => {
  let { glpiUrl, userToken, appToken, tier = 'live', force = false, stages: stageOverride } = req.body;
  if (!glpiUrl || !userToken || !appToken) {
    // fall back to stored config
    const { getConfig } = require('../lib/scheduler');
    const cfg = await getConfig();
    if (!cfg || !cfg.glpiUrl || !cfg.glpiUserToken || !cfg.glpiAppToken)
      return res.status(400).json({ error: 'glpiUrl, userToken and appToken are required' });
    glpiUrl   = glpiUrl   || cfg.glpiUrl;
    userToken = userToken || cfg.glpiUserToken;
    appToken  = appToken  || cfg.glpiAppToken;
  }

  abortRequested = false; // clear any previous abort request

  const s = driver.session();
  const startedAt = new Date().toISOString();
  const results = {};
  const errors  = {};

  const targetStages = stageOverride
    ? STAGES.filter(st => st.id === 'session_auth' || stageOverride.includes(st.id))
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
    const startMs = Date.now();
    await setMeta(s, stageDef.id, { status: 'running', lastRun: now });
    try {
      const result = await runner(ctx);
      const endMs = Date.now();
      const lastRunEnd = new Date(endMs).toISOString();
      const duration = String(((endMs - startMs) / 1000).toFixed(2));
      results[stageDef.id] = result;
      await setMeta(s, stageDef.id, {
        status: 'success', lastRun: now, lastRunEnd, lastSuccessAt: now,
        count: result?.count ?? 0, duration, errorMessage: '',
      });
      ctx.meta[stageDef.id] = { ...(ctx.meta[stageDef.id] || {}), lastSuccessAt: now };
    } catch (e) {
      const endMs = Date.now();
      const lastRunEnd = new Date(endMs).toISOString();
      const duration = String(((endMs - startMs) / 1000).toFixed(2));
      errors[stageDef.id] = e.message;
      results[stageDef.id] = { error: e.message };
      await setMeta(s, stageDef.id, { status: 'error', lastRun: now, lastRunEnd, duration, errorMessage: e.message });
    }
  };

  try {
    for (const stageDef of targetStages) {
      if (abortRequested) {
        errors[stageDef.id] = 'Aborted by user';
        break;
      }
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

// GET /api/pipeline/dataflow/:id/linked — tickets, changes and associated apps for a dataflow (from Neo4j)
router.get('/dataflow/:id/linked', async (req, res) => {
  const s = driver.session();
  try {
    const id = String(req.params.id);
    const tRes = await s.run(`MATCH (d:Dataflow { glpiId: $id })-[:HAS_TICKET]->(t:Ticket) RETURN t { .* } AS t ORDER BY t.dateMod DESC LIMIT 200`, { id });
    const cRes = await s.run(`MATCH (d:Dataflow { glpiId: $id })-[:HAS_CHANGE]->(c:Change)  RETURN c { .* } AS c ORDER BY c.dateMod DESC LIMIT 200`, { id });
    const aRes = await s.run(`MATCH (d:Dataflow { glpiId: $id })-[:ASSOCIATED_WITH]->(a:Application) RETURN a { .* } AS a ORDER BY a.name`, { id });
    const mapTicket = r => ({ id: r.get('t').glpiId, name: r.get('t').name, status: r.get('t').status, priority: r.get('t').priority, itilcategories_id: r.get('t').category, date_mod: r.get('t').dateMod, date: r.get('t').date });
    const mapChange = r => ({ id: r.get('c').glpiId, name: r.get('c').name, status: r.get('c').status, priority: r.get('c').priority, itilcategories_id: r.get('c').category, date_mod: r.get('c').dateMod, date: r.get('c').date });
    const mapApp    = r => ({ id: r.get('a').glpiId, name: r.get('a').name, plugin_archisw_swcomponenttypes_id: r.get('a').type, entities_id: r.get('a').entity, shortdescription: r.get('a').desc });
    res.json({ tickets: tRes.records.map(mapTicket), changes: cRes.records.map(mapChange), apps: aRes.records.map(mapApp) });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// GET /api/pipeline/app/:id/linked — tickets, changes and dataflows for an application
// Tickets/changes are fetched from GLPI on-demand; dataflows come from Neo4j.
router.get('/app/:id/linked', async (req, res) => {
  const s = driver.session();
  try {
    const id  = String(req.params.id);
    const { getConfig } = require('../lib/scheduler');
    const cfg = await getConfig();
    if (!cfg || !cfg.glpiUrl) return res.status(503).json({ error: 'No stored pipeline config' });

    const base  = cfg.glpiUrl.replace(/\/$/, '');
    const agent = base.startsWith('https') ? httpsAgent : undefined;

    // Authenticate with GLPI
    enforceGetOnly('GET');
    const sessRes = await fetch(`${base}/apirest.php/initSession`, {
      method: 'GET',
      headers: { 'Authorization': `user_token ${cfg.glpiUserToken}`, 'App-Token': cfg.glpiAppToken },
      agent,
    });
    const sessData = await sessRes.json();
    if (!sessData.session_token) return res.status(401).json({ error: 'GLPI auth failed', detail: sessData });
    const sessionToken = sessData.session_token;

    // Parallel: GLPI ticket/change fetches (via junction tables) + Neo4j dataflow query
    const [tickets, changes, dfRes] = await Promise.all([
      fetchAppLinkedItems(base, id, 'Item_Ticket', 'Ticket', sessionToken, cfg.glpiAppToken)
        .then(rows => rows.map(t => ({ id: t.id, name: t.name, status: t.status, priority: t.priority, itilcategories_id: t.itilcategories_id, date_mod: t.date_mod, date: t.date }))),
      fetchAppLinkedItems(base, id, 'Item_Change', 'Change', sessionToken, cfg.glpiAppToken)
        .then(rows => rows.map(c => ({ id: c.id, name: c.name, status: c.status, priority: c.priority, itilcategories_id: c.itilcategories_id, date_mod: c.date_mod, date: c.date }))),
      s.run(
        `MATCH (a:Application { glpiId: $id })-[:FEEDS_INTO|CONNECTS_TO]-(d:Dataflow)
         WHERE d.glpiId IS NOT NULL AND d.glpiId <> ''
         RETURN DISTINCT d { .* } AS d ORDER BY d.name`,
        { id }
      ),
    ]);

    // Kill GLPI session (best-effort)
    fetch(`${base}/apirest.php/killSession`, { method: 'GET', headers: glpiHeaders(sessionToken, cfg.glpiAppToken), agent }).catch(() => {});

    const dataflows = dfRes.records.map(r => {
      const d = r.get('d');
      return { id: d.glpiId, name: d.name, desc: d.desc || d.description || '', status: d.status };
    });

    res.json({ tickets, changes, dataflows });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// GET /api/pipeline/config — read scheduler config (creds redacted)
router.get('/config', async (req, res) => {
  const s = driver.session();
  try {
    const r = await s.run(`MATCH (c:PipelineConfig { id: 'default' }) RETURN c`);
    if (!r.records.length) return res.json({ config: null });
    const p = { ...r.records[0].get('c').properties };
    delete p.glpiUserToken;
    delete p.glpiAppToken;
    res.json({ config: p });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// PUT /api/pipeline/config — save scheduler config and restart scheduler
router.put('/config', async (req, res) => {
  const { glpiUrl, userToken, appToken, liveIntervalMin, nightlyTime, enabled } = req.body;
  if (!glpiUrl || !userToken || !appToken) return res.status(400).json({ error: 'glpiUrl, userToken, appToken required' });
  const s = driver.session();
  try {
    await s.run(
      `MERGE (c:PipelineConfig { id: 'default' })
       SET c.glpiUrl = $glpiUrl, c.glpiUserToken = $userToken, c.glpiAppToken = $appToken,
           c.liveIntervalMin = $liveMin, c.nightlyTime = $nightlyTime,
           c.enabled = $enabled, c.updatedAt = $now`,
      {
        glpiUrl, userToken, appToken,
        liveMin:     String(liveIntervalMin || '5'),
        nightlyTime: nightlyTime || '02:00',
        enabled:     enabled !== false,
        now:         new Date().toISOString(),
      }
    );
    const { startScheduler } = require('../lib/scheduler');
    await startScheduler();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// GET /api/pipeline/glpi-raw?endpoint=... — fetch raw GLPI using stored config (diagnostic)
router.get('/glpi-raw', async (req, res) => {
  const { endpoint } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'endpoint query param required' });
  const { getConfig } = require('../lib/scheduler');
  const cfg = await getConfig();
  if (!cfg || !cfg.glpiUrl) return res.status(503).json({ error: 'No stored pipeline config' });
  const base = cfg.glpiUrl.replace(/\/$/, '');
  const agent = base.startsWith('https') ? httpsAgent : undefined;
  try {
    enforceGetOnly('GET');
    const sessRes = await fetch(`${base}/apirest.php/initSession`, {
      method: 'GET',
      headers: { 'Authorization': `user_token ${cfg.glpiUserToken}`, 'App-Token': cfg.glpiAppToken },
      agent,
    });
    const sessData = await sessRes.json();
    if (!sessData.session_token) return res.status(401).json({ error: 'GLPI auth failed', detail: sessData });
    const token = sessData.session_token;
    const r = await fetch(`${base}/apirest.php/${endpoint}`, {
      headers: glpiHeaders(token, cfg.glpiAppToken),
      agent,
    });
    const body = await r.json().catch(() => ({}));
    await fetch(`${base}/apirest.php/killSession`, { headers: glpiHeaders(token, cfg.glpiAppToken), agent }).catch(() => {});
    res.json({ status: r.status, body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
