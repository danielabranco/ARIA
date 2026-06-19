const router = require('express').Router();
const fetch = require('node-fetch');
const { v4: uuid } = require('uuid');
const { driver } = require('../lib/neo4j');
const { glpiGet } = require('../lib/glpi');
const { httpsAgent } = require('../lib/https-agent');
const { auditLog } = require('../lib/audit');

// ── GLPI SYNC ────────────────────────────────────────────

router.post('/glpi', async (req, res) => {
  const { glpiUrl, userToken, appToken, types, pageSize, filters } = req.body;
  if (!glpiUrl || !userToken || !appToken) return res.status(400).json({ error: 'Missing GLPI credentials' });

  const url = glpiUrl.replace(/\/$/, '');
  const s = driver.session();
  const results = { synced: {}, errors: [], total: 0 };

  try {
    const sessRes = await fetch(`${url}/apirest.php/initSession`, {
      headers: { 'Authorization': `user_token ${userToken}`, 'App-Token': appToken },
      agent: url.startsWith('https') ? httpsAgent : undefined
    });
    const sessData = await sessRes.json();
    if (!sessData.session_token) return res.status(401).json({ error: 'GLPI auth failed' });
    const token = sessData.session_token;

    const syncTypes = types || ['dataflows', 'appstructs', 'changes', 'tickets', 'projects', 'users', 'groups'];
    const limit = pageSize || 500;

    const ENDPOINTS = {
      dataflows:  `PluginDataflowsDataflow?range=0-${limit}&expand_dropdowns=true&is_deleted=0`,
      appstructs: `PluginArchiswSwcomponent?range=0-${limit}&expand_dropdowns=true&is_deleted=0`,
      changes:    `Change?range=0-${limit}&expand_dropdowns=true&is_deleted=0`,
      tickets:    `Ticket?range=0-${limit}&expand_dropdowns=true&is_deleted=0`,
      projects:   `Project?range=0-${limit}&expand_dropdowns=true&is_deleted=0`,
      users:      `User?range=0-${limit}&expand_dropdowns=true&is_deleted=0`,
      groups:     `Group?range=0-${limit}&expand_dropdowns=true&is_deleted=0`,
    };

    // Paginated fetch for ITIL types with a date range filter.
    // Sorts DESC by date so newest items come first, then paginates in batches of 500
    // until all items within the date range have been collected (stops as soon as an
    // item older than dateFrom is encountered — everything after is guaranteed older).
    // Confirmed: sort=date&order=DESC works; searchText[date]=YEAR is silently ignored by GLPI.
    const DATE_SORT_TYPES = new Set(['tickets', 'changes', 'projects']);
    const fetchAllInRange = async (type, baseEndpoint, tf) => {
      if (!DATE_SORT_TYPES.has(type) || (!tf.dateFrom && !tf.dateTo)) {
        return glpiGet(url, baseEndpoint, token, appToken);
      }
      const batchSize = 500;
      const allItems = [];
      // Strip existing range from base, re-add sort
      const base = baseEndpoint.replace(/&?range=\d+-\d+/, '');
      const sep  = base.includes('?') ? '&' : '?';
      let offset = 0;
      while (true) {
        const ep = `${base}${sep}range=${offset}-${offset + batchSize - 1}&sort=date&order=DESC`;
        const batch = await glpiGet(url, ep, token, appToken);
        if (!Array.isArray(batch) || batch.length === 0) break;
        let done = false;
        for (const item of batch) {
          const d = (item.date || item.date_creation || '').slice(0, 10);
          if (tf.dateTo   && d > tf.dateTo)   continue; // newer than range, skip
          if (tf.dateFrom && d < tf.dateFrom) { done = true; break; } // older than range, stop
          allItems.push(item);
        }
        if (done || batch.length < batchSize) break;
        offset += batchSize;
      }
      return allItems;
    };

    const INACTIVE_DATAFLOW_STATUSES = ['removed', 'stopped', 'inactive', 'deleted'];
    const INACTIVE_APP_STATUSES = ['removed', 'deleted', 'inactive'];

    // ── Pre-build app ID→name map for resolving dataflow src/dst ──
    // GLPI's expand_dropdowns doesn't always expand cross-plugin FK references.
    // Fetching App Structures separately gives us a reliable id→name lookup.
    const appIdMap = new Map(); // glpiId (string) → app name
    try {
      const appItems = await glpiGet(url, `PluginArchiswSwcomponent?range=0-1000&expand_dropdowns=true&is_deleted=0`, token, appToken);
      if (Array.isArray(appItems)) {
        for (const a of appItems) {
          if (a.id && a.name) appIdMap.set(String(a.id), a.name);
        }
      }
    } catch (e) { console.log('App ID map fetch error:', e.message); }

    // Helper: resolve a src/dst value — if numeric, look up in appIdMap
    const resolveApp = (val) => {
      if (!val || val === '0') return '';
      const s = String(val);
      if (/^\d+$/.test(s)) return appIdMap.get(s) || s; // numeric → lookup, fallback to ID string
      return s; // already a name
    };

    for (const type of syncTypes) {
      if (!ENDPOINTS[type]) continue;
      results.synced[type] = 0;
      const tf = (filters && filters[type]) || {};
      try {
        const items = await fetchAllInRange(type, ENDPOINTS[type], tf);
        if (!Array.isArray(items)) { results.errors.push(`${type}: no data`); continue; }

        for (const item of items) {
          try {
            // ── Status filters ──────────────────────────────────
            if (type === 'dataflows') {
              const dfStatus = String(item.plugin_dataflows_states_id || '').toLowerCase();
              // activeOnly defaults to true; pass false to include inactive
              if (tf.activeOnly !== false && INACTIVE_DATAFLOW_STATUSES.some(s => dfStatus.includes(s))) continue;
            }
            if (type === 'appstructs') {
              const appStatus = String(item.plugin_archisw_swcomponentstates_id || '').toLowerCase();
              if (tf.activeOnly !== false && INACTIVE_APP_STATUSES.some(s => appStatus.includes(s))) continue;
            }
            // Status filter for tickets/changes (numeric status values)
            if ((type === 'tickets' || type === 'changes') && tf.statuses && tf.statuses.length > 0) {
              if (!tf.statuses.includes(Number(item.status))) continue;
            }
            // ── Date range filter ───────────────────────────────
            if (tf.dateFrom || tf.dateTo) {
              const itemDate = (item.date || item.date_creation || '').slice(0, 10);
              if (tf.dateFrom && itemDate < tf.dateFrom) continue;
              if (tf.dateTo   && itemDate > tf.dateTo)   continue;
            }

            if (type === 'dataflows') {
              const src = resolveApp(item.plugin_dataflows_fromswcomponents_id);
              const dst = resolveApp(item.plugin_dataflows_toswcomponents_id);
              const dfId   = String(item.id);
              const dfName = item.name || dfId;
              const dfStatus     = String(item.plugin_dataflows_states_id || '');
              const dfComplexity = String(item.plugin_dataflows_types_id || '');
              const dfProtocol   = String(item.plugin_dataflows_transferprotocols_id || '');
              const dfFlowGroup  = String(item.plugin_dataflows_flowgroups_id || '');
              const dfDesc       = item.shortdescription || '';
              await s.run(`
                MERGE (d:Dataflow { glpiId: $id })
                SET d.name = $name, d.status = $status, d.complexity = $complexity,
                    d.protocol = $protocol, d.flowGroup = $flowGroup,
                    d.trigger = $trigger, d.frequency = $frequency,
                    d.sourceApp = $src, d.destApp = $dst,
                    d.owner = $owner, d.group = $grp,
                    d.indicator = $indicator, d.mappingDoc = $mDoc,
                    d.technicalDoc = $tDoc, d.description = $desc,
                    d.updatedAt = $now
              `, {
                id: dfId, name: dfName,
                status: dfStatus, complexity: dfComplexity, protocol: dfProtocol,
                flowGroup: dfFlowGroup,
                trigger: String(item.plugin_dataflows_triggertypes_id || ''),
                frequency: String(item.plugin_dataflows_transferfreqs_id || ''),
                src: String(src || ''), dst: String(dst || ''),
                owner: String(item.users_id || ''), grp: String(item.groups_id || ''),
                indicator: String(item.plugin_dataflows_indicators_id || ''),
                mDoc: item.mappingdocurl || '', tDoc: item.technicaldocurl || '',
                desc: dfDesc, now: new Date().toISOString()
              });

              // Upsert Knowledge entry for this dataflow
              try {
                const dfTopic = `Dataflow #${dfId} — ${dfName}`;
                const dfContent = [
                  dfDesc || dfName, '',
                  `GLPI LIVE DATA (auto-updated by sync):`,
                  `GLPI ID: ${dfId}`,
                  `From: ${src || 'unknown'} -> To: ${dst || 'unknown'}`,
                  dfStatus     ? `Status: ${dfStatus}`         : '',
                  dfComplexity ? `Complexity: ${dfComplexity}` : '',
                  dfProtocol   ? `Protocol: ${dfProtocol}`     : '',
                  dfFlowGroup  ? `Flow Group: ${dfFlowGroup}`  : '',
                  `Last synced: ${new Date().toISOString().split('T')[0]}`,
                ].filter(Boolean).join('\n');
                const dfKRes = await s.run(
                  `MATCH (k:Knowledge) WHERE k.category = 'dataflow' AND k.glpiId = $glpiId RETURN k.id AS id`,
                  { glpiId: dfId }
                );
                if (dfKRes.records.length === 0) {
                  await s.run(
                    `CREATE (k:Knowledge {
                       id: $id, topic: $topic, content: $content,
                       category: 'dataflow', source: 'glpi-sync',
                       glpiId: $glpiId, reviewStatus: 'to_be_reviewed',
                       tags: ['dataflow','glpi'], createdAt: $now
                     })`,
                    { id: uuid(), topic: dfTopic, content: dfContent, glpiId: dfId, now: new Date().toISOString() }
                  );
                } else {
                  for (const rec of dfKRes.records) {
                    await s.run(
                      `MATCH (k:Knowledge) WHERE k.id = $id
                       SET k.topic = $topic, k.content = $content, k.glpiSyncedAt = $now`,
                      { id: rec.get('id'), topic: dfTopic, content: dfContent, now: new Date().toISOString() }
                    );
                  }
                }
              } catch (ke) { console.log(`Knowledge upsert for dataflow ${dfId}: ${ke.message}`); }
              if (src) {
                await s.run(`
                  MERGE (a:Application { name: $name }) SET a.updatedAt = $now
                  WITH a MATCH (d:Dataflow { glpiId: $dfId })
                  MERGE (a)-[:FEEDS_INTO]->(d)
                `, { name: src, dfId: dfId, now: new Date().toISOString() });
              }
              if (dst) {
                await s.run(`
                  MERGE (a:Application { name: $name }) SET a.updatedAt = $now
                  WITH a MATCH (d:Dataflow { glpiId: $dfId })
                  MERGE (d)-[:FEEDS_INTO]->(a)
                `, { name: dst, dfId: dfId, now: new Date().toISOString() });
              }
              if (src && dst) {
                await s.run(`
                  MERGE (s:Application { name: $src })
                  MERGE (t:Application { name: $dst })
                  MERGE (s)-[r:CONNECTS_TO]->(t)
                  SET r.via = coalesce(r.via, $via), r.updatedAt = $now
                `, { src: String(src), dst: String(dst), via: item.name || '', now: new Date().toISOString() });
              }
            } else if (type === 'appstructs') {
              const appId   = String(item.id);
              const appName = item.name || appId;
              const appType = String(item.plugin_archisw_swcomponenttypes_id || item.swcomponenttypes_id || '');
              const appEntity = String(item.entities_id || '');
              const appDesc = item.shortdescription || item.description || '';
              const appComment = item.comment || '';
              const appStatus   = String(item.plugin_archisw_swcomponentstates_id || '');
              const appSupplier = String(item.suppliers_id || '');
              const appUrlProd  = item.url_prod || '';
              const appUrlQA    = item.url_qa || '';
              const appOwner    = String(item.groups_id || '');
              const appSla      = String(item.plugin_archisw_swcomponentslas_id || '');
              const appInstances= String(item.plugin_archisw_swcomponentinstances_id || '');
              const appDatabase = String(item.plugin_archisw_swcomponentdbs_id || '');
              const appLocation = String(item.locations_id || '');
              const appTargets  = String(item.plugin_archisw_swcomponenttargets_id || '');
              const appDevLang  = String(item.plugin_archisw_swcomponenttechnics_id || '');
              const appInUseSince = String(item.plugin_archisw_inusesinceyear || '');

              await s.run(`
                MERGE (a:Application { name: $name })
                SET a.glpiId = $id, a.type = $type, a.entity = $entity,
                    a.description = $desc, a.comment = $comment,
                    a.supplier = $supplier, a.urlProd = $urlProd, a.urlQA = $urlQA,
                    a.owner = $owner, a.sla = $sla, a.instances = $instances,
                    a.database = $database, a.location = $location, a.targets = $targets,
                    a.status = $status, a.devLanguage = $devLang, a.inUseSince = $inUseSince,
                    a.updatedAt = $now
              `, {
                name: appName, id: appId, type: appType, entity: appEntity,
                desc: appDesc, comment: appComment, status: appStatus,
                supplier: appSupplier, urlProd: appUrlProd, urlQA: appUrlQA,
                owner: appOwner, sla: appSla, instances: appInstances,
                database: appDatabase, location: appLocation, targets: appTargets,
                devLang: appDevLang, inUseSince: appInUseSince,
                now: new Date().toISOString()
              });

              // Build topic with ID prefix and live data block
              const appTopic = `Application #${appId} — ${appName}`;
              const liveLines = ['GLPI LIVE DATA (auto-updated by sync):'];
              liveLines.push(`GLPI ID: ${appId}`);
              if (appStatus)    liveLines.push(`Status: ${appStatus}`);
              if (appType)      liveLines.push(`Type: ${appType}`);
              if (appOwner)     liveLines.push(`Owner: ${appOwner}`);
              if (appSupplier)  liveLines.push(`Supplier: ${appSupplier}`);
              if (appSla)       liveLines.push(`Service Level: ${appSla}`);
              if (appInstances) liveLines.push(`Instances: ${appInstances}`);
              if (appDatabase)  liveLines.push(`Database: ${appDatabase}`);
              if (appDevLang)   liveLines.push(`Dev Language: ${appDevLang}`);
              if (appLocation)  liveLines.push(`Location: ${appLocation}`);
              if (appTargets)   liveLines.push(`Targets: ${appTargets}`);
              if (appInUseSince)liveLines.push(`In Use Since: ${appInUseSince}`);
              if (appUrlProd)   liveLines.push(`URL Production: ${appUrlProd}`);
              if (appUrlQA)     liveLines.push(`URL QA: ${appUrlQA}`);
              liveLines.push(`Last synced: ${new Date().toISOString().split('T')[0]}`);
              const glpiLiveBlock = liveLines.join('\n');

              // Upsert Knowledge entry — always update topic to include ID
              try {
                const kRes = await s.run(
                  `MATCH (k:Knowledge) WHERE k.category = 'application' AND k.glpiId = $glpiId RETURN k.id AS id, k.content AS content`,
                  { glpiId: appId }
                );
                if (kRes.records.length > 0) {
                  for (const rec of kRes.records) {
                    const kId = rec.get('id');
                    const existing = rec.get('content') || '';
                    const stripped = existing.replace(/\n*GLPI LIVE DATA \(auto-updated by sync\):[\s\S]*$/, '').trim();
                    const newContent = stripped ? stripped + '\n\n' + glpiLiveBlock : glpiLiveBlock;
                    await s.run(
                      `MATCH (k:Knowledge) WHERE k.id = $id
                       SET k.topic = $topic, k.content = $content,
                           k.supplier = $supplier, k.urlProd = $urlProd,
                           k.urlQA = $urlQA, k.owner = $owner, k.sla = $sla,
                           k.glpiSyncedAt = $now`,
                      { id: kId, topic: appTopic, content: newContent,
                        supplier: appSupplier, urlProd: appUrlProd,
                        urlQA: appUrlQA, owner: appOwner, sla: appSla,
                        now: new Date().toISOString() }
                    );
                  }
                } else {
                  const baseContent = (appDesc || appComment ? (appDesc || appComment) + '\n\n' : '') + glpiLiveBlock;
                  await s.run(
                    `CREATE (k:Knowledge {
                       id: $id, topic: $topic, content: $content,
                       category: 'application', source: 'glpi-sync',
                       glpiId: $glpiId, reviewStatus: 'to_be_reviewed',
                       supplier: $supplier, urlProd: $urlProd, urlQA: $urlQA,
                       owner: $owner, sla: $sla, glpiSyncedAt: $now,
                       tags: ['application','glpi'], createdAt: $now
                     })`,
                    { id: uuid(), topic: appTopic, content: baseContent, glpiId: appId,
                      supplier: appSupplier, urlProd: appUrlProd, urlQA: appUrlQA,
                      owner: appOwner, sla: appSla, now: new Date().toISOString() }
                  );
                }
              } catch (ke) { console.log(`Knowledge upsert for app ${appId}: ${ke.message}`); }
            } else if (type === 'changes') {
              await s.run(`
                MERGE (c:Change { glpiId: $id })
                SET c.name = $name, c.status = $status, c.date = $date,
                    c.impact = $impact, c.urgency = $urgency, c.category = $cat,
                    c.entity = $entity, c.updatedAt = $now
              `, { id: String(item.id), name: item.name || '', status: String(item.status || ''), date: item.date || '', impact: String(item.impact || ''), urgency: String(item.urgency || ''), cat: String(item.itilcategories_id || ''), entity: String(item.entities_id || ''), now: new Date().toISOString() });
            } else if (type === 'tickets') {
              await s.run(`
                MERGE (t:Ticket { glpiId: $id })
                SET t.name = $name, t.status = $status, t.date = $date,
                    t.priority = $priority, t.category = $cat, t.entity = $entity, t.updatedAt = $now
              `, { id: String(item.id), name: item.name || '', status: String(item.status || ''), date: item.date || '', priority: String(item.priority || ''), cat: String(item.itilcategories_id || ''), entity: String(item.entities_id || ''), now: new Date().toISOString() });
            } else if (type === 'projects') {
              await s.run(`
                MERGE (p:Project { glpiId: $id })
                SET p.name = $name, p.status = $status, p.date = $date, p.updatedAt = $now
              `, { id: String(item.id), name: item.name || '', status: String(item.global_state || item.status || ''), date: item.date || '', now: new Date().toISOString() });
            } else if (type === 'users') {
              await s.run(`
                MERGE (u:User { glpiId: $id })
                SET u.name = $name, u.email = $email, u.updatedAt = $now
              `, { id: String(item.id), name: (item.firstname || '') + ' ' + (item.realname || ''), email: item.email || '', now: new Date().toISOString() });
            } else if (type === 'groups') {
              await s.run(`
                MERGE (g:Group { glpiId: $id })
                SET g.name = $name, g.comment = $comment, g.entity = $entity, g.updatedAt = $now
              `, { id: String(item.id), name: item.name || '', comment: item.comment || '', entity: String(item.entities_id || ''), now: new Date().toISOString() });
            }

            results.synced[type]++;
            results.total++;
          } catch (e) { results.errors.push(`${type}[${item.id}]: ${e.message}`); }
        }
      } catch (e) { results.errors.push(`${type}: ${e.message}`); }
    }

    // Kill the GLPI session to free server-side resources
    try {
      await fetch(`${url}/apirest.php/killSession`, {
        method: 'GET',
        headers: { 'Session-Token': token, 'App-Token': appToken },
        agent: url.startsWith('https') ? httpsAgent : undefined
      });
    } catch {}

    res.json({ success: true, ...results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await s.close();
  }
});

// ── GITHUB SYNC ──────────────────────────────────────────

const GITHUB_API = 'https://api.github.com';
const GITHUB_REPO = 'OMDS-BIDevOps/OMDG_BIBU';
const GITHUB_PROCESS_PATH = 'OMDG_BIBU/process';

// GitHub uses public TLS — no httpsAgent needed (agent only for GLPI/Zscaler)
const githubFetch = async (url, token) => {
  const r = await fetch(url, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ARIA-Sync/1.0' },
  });
  if (!r.ok) { const err = await r.text(); throw new Error(`GitHub ${r.status}: ${err}`); }
  return r.json();
};

const extractDataflowId = (name) => {
  const m = name.match(/_(\d{2,6})(?:[_.]|$)/);
  return m ? m[1] : null;
};

const getRepoTree = async (token, repo) => {
  const repoMeta = await githubFetch(`${GITHUB_API}/repos/${repo}`, token);
  const branch = repoMeta.default_branch || 'main';
  const branchData = await githubFetch(`${GITHUB_API}/repos/${repo}/branches/${branch}`, token);
  const sha = branchData.commit.commit.tree.sha;
  const tree = await githubFetch(`${GITHUB_API}/repos/${repo}/git/trees/${sha}?recursive=1`, token);
  return { items: tree.tree || [], branch, truncated: tree.truncated };
};

const parseTalendItem = (xml) => {
  const components = [];
  const connections = [];
  const compRe = /componentName="([^"]+)"/g;
  let m;
  while ((m = compRe.exec(xml)) !== null) { if (!components.includes(m[1])) components.push(m[1]); }
  const connRe = /source="([^"]*)"[^>]*target="([^"]*)"[^>]*label="([^"]*)"/g;
  while ((m = connRe.exec(xml)) !== null) { connections.push({ from: m[1], to: m[2], label: m[3] }); }
  const ctxRe = /name="([^"]+)"[^>]*type="([^"]+)"[^>]*comment="([^"]*)"/g;
  const contextParams = [];
  while ((m = ctxRe.exec(xml)) !== null) { contextParams.push(`${m[1]} (${m[2]})${m[3] ? ': ' + m[3] : ''}`); }
  return { components, connections, contextParams };
};

router.post('/github/test', async (req, res) => {
  const { githubToken, githubRepo } = req.body;
  if (!githubToken) return res.status(400).json({ error: 'githubToken required' });
  try {
    const me = await githubFetch(`${GITHUB_API}/user`, githubToken).catch(() => ({ login: '?' }));
    const repo = githubRepo || GITHUB_REPO;
    const repoMeta = await githubFetch(`${GITHUB_API}/repos/${repo}`, githubToken).catch(async () => {
      const list = await githubFetch(`${GITHUB_API}/user/repos?per_page=50&sort=updated`, githubToken).catch(() => []);
      const names = Array.isArray(list) ? list.map(r => r.full_name) : [];
      throw new Error(`Repo "${repo}" not found. Accessible repos: ${names.join(', ') || 'none'}`);
    });
    const rootContents = await githubFetch(`${GITHUB_API}/repos/${repo}/contents`, githubToken);
    const root = Array.isArray(rootContents) ? rootContents.map(i => ({ name: i.name, type: i.type })) : [];
    res.json({ success: true, login: me.login || '?', repo, defaultBranch: repoMeta.default_branch, root });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/github', async (req, res) => {
  const { githubToken, githubRepo } = req.body;
  if (!githubToken) return res.status(400).json({ error: 'githubToken required' });

  const s = driver.session();
  const results = { synced: 0, skipped: 0, errors: [], dataflowIds: [], jobsFound: [] };

  try {
    const repo = githubRepo || GITHUB_REPO;

    await s.run(`
      MATCH (k:Knowledge)
      WHERE k.topic STARTS WITH '[Talend Job]' AND k.category <> 'talend-job'
      DELETE k
    `);

    const { items: treeItems, branch, truncated } = await getRepoTree(githubToken, repo);
    if (truncated) console.log('[GitHub Sync] Warning: tree truncated');

    const VERSION_SUFFIX = /^(.+)_(\d+\.\d+)\.item$/;
    const jobEntries = {};

    for (const item of treeItems) {
      if (item.type !== 'blob') continue;
      if (!item.path.startsWith(GITHUB_PROCESS_PATH + '/')) continue;
      const fileName = item.path.split('/').pop();
      const match = fileName.match(VERSION_SUFFIX);
      if (!match) continue;

      const jobName = match[1];
      const version = match[2];
      if (!jobName.includes('_')) continue;

      const pathParts = item.path.split('/');
      const groupFolder = pathParts.slice(0, -1).join('/');
      const processIdx = pathParts.indexOf('process');
      const pipelineCategory = processIdx >= 0 && pathParts[processIdx + 1] ? pathParts[processIdx + 1] : 'unknown';
      const subGroup = pathParts.length > processIdx + 3 ? pathParts.slice(processIdx + 2, -1).join('/') : '';
      const dataflowId = extractDataflowId(jobName);

      if (!jobEntries[jobName]) {
        jobEntries[jobName] = {
          jobName, groupFolder, pipelineCategory, subGroup, dataflowId, versions: [],
          githubUrl: `https://github.com/${repo}/tree/${branch}/${groupFolder}`
        };
      }
      if (!jobEntries[jobName].versions.includes(version)) jobEntries[jobName].versions.push(version);
    }

    for (const job of Object.values(jobEntries)) {
      let jobDetails = '';
      try {
        const latestVersion = job.versions.sort().pop();
        const itemFile = treeItems.find(i => i.type === 'blob' && i.path.endsWith(`${job.jobName}_${latestVersion}.item`));
        if (itemFile) {
          const raw = await githubFetch(`${GITHUB_API}/repos/${repo}/git/blobs/${itemFile.sha}`, githubToken);
          if (raw.content) {
            const xml = Buffer.from(raw.content, 'base64').toString('utf8');
            const parsed = parseTalendItem(xml);
            if (parsed.components.length) jobDetails += `\nCOMPONENTS USED:\n${parsed.components.map(c => `  - ${c}`).join('\n')}`;
            if (parsed.connections.length) jobDetails += `\n\nDATA FLOW STEPS:\n${parsed.connections.map(c => `  ${c.from} → ${c.to}${c.label ? ' [' + c.label + ']' : ''}`).join('\n')}`;
            if (parsed.contextParams.length) jobDetails += `\n\nCONTEXT PARAMETERS:\n${parsed.contextParams.map(p => `  - ${p}`).join('\n')}`;
          }
        }
      } catch (e) { jobDetails = `\n(Job detail extraction failed: ${e.message})`; }

      const dfLabel = job.dataflowId ? job.dataflowId : 'unknown';
      const topic = `[Talend Job] ${job.jobName} (Dataflow ID: ${dfLabel})`;
      const content = [
        `Source: GitHub ${repo} (auto-sync). Fetched: ${new Date().toISOString().split('T')[0]}.`,
        ``, `JOB NAME: ${job.jobName}`, `GLPI DATAFLOW ID: ${dfLabel}`,
        `PIPELINE CATEGORY: ${job.pipelineCategory}`,
        job.subGroup ? `GROUP: ${job.subGroup}` : '',
        `VERSIONS: ${job.versions.sort().join(', ')}`,
        `GITHUB URL: ${job.githubUrl}`,
        jobDetails, ``, `JOB NAMING CONVENTION: [JOBNAME]_[DATAFLOW_ID]_[VERSION].item`,
      ].filter(Boolean).join('\n');

      const tags = ['talend', 'talend-job', job.pipelineCategory.toLowerCase().replace(/_/g, '-'), ...(job.dataflowId ? [`dataflow-${job.dataflowId}`] : [])];

      try {
        await s.run(`
          MERGE (k:Knowledge { topic: $topic, category: 'talend-job' })
          SET k.id = coalesce(k.id, $id), k.content = $content, k.source = 'github',
              k.tags = $tags, k.reviewStatus = coalesce(k.reviewStatus, 'pending'),
              k.updatedAt = $now, k.createdAt = coalesce(k.createdAt, $now)
        `, { id: uuid(), topic, content, tags, now: new Date().toISOString() });

        await s.run(`
          MATCH (k:Knowledge)
          WHERE k.category = 'dataflow' AND k.topic CONTAINS $dfId
            AND NOT 'talend' IN coalesce(k.tags, [])
          SET k.tags = coalesce(k.tags, []) + ['talend']
        `, { dfId: job.dataflowId });

        results.synced++;
        if (!results.dataflowIds.includes(job.dataflowId)) results.dataflowIds.push(job.dataflowId);
      } catch (e) { results.errors.push(`${job.jobName}: ${e.message}`); }
    }

    auditLog('GITHUB_SYNC', 'System', 'github', { synced: results.synced, repo }, 'system');
    res.json({ success: true, repo, branch, truncated, ...results });
  } catch (e) {
    res.status(500).json({ error: e.message, results });
  } finally {
    await s.close();
  }
});

// ── DIAGNOSTIC: raw GLPI fetch ─────────────────────────────────────────────
router.post('/glpi-raw', async (req, res) => {
  const { glpiUrl, userToken, appToken, endpoint } = req.body;
  if (!glpiUrl || !userToken || !appToken) return res.status(400).json({ error: 'Missing creds' });
  const url = glpiUrl.replace(/\/$/, '');
  try {
    const sessRes = await fetch(`${url}/apirest.php/initSession`, {
      headers: { 'Authorization': `user_token ${userToken}`, 'App-Token': appToken },
      agent: url.startsWith('https') ? httpsAgent : undefined
    });
    const sessData = await sessRes.json();
    if (!sessData.session_token) return res.status(401).json({ error: 'GLPI auth failed', sessData });
    const token = sessData.session_token;
    const ep = endpoint || 'Ticket?range=0-3&expand_dropdowns=true&is_deleted=0';
    const r = await fetch(`${url}/apirest.php/${ep}`, {
      method: 'GET',
      headers: { 'Session-Token': token, 'App-Token': appToken },
      agent: url.startsWith('https') ? httpsAgent : undefined
    });
    const raw = await r.text();
    try { await fetch(`${url}/apirest.php/killSession`, { headers: { 'Session-Token': token, 'App-Token': appToken }, agent: url.startsWith('https') ? httpsAgent : undefined }); } catch {}
    let body; try { body = JSON.parse(raw); } catch { body = raw; }
    res.json({ status: r.status, body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
