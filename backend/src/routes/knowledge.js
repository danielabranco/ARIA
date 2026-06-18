const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { driver } = require('../lib/neo4j');
const { auditLog } = require('../lib/audit');
const { glpiFetch } = require('../lib/glpi');

// GET /api/knowledge — list (filterable by category + search)
router.get('/', async (req, res) => {
  const { category, search } = req.query;
  const s = driver.session();
  try {
    let query = 'MATCH (k:Knowledge)';
    const params = {};
    const conditions = [];
    if (category && category !== 'all') { conditions.push('k.category = $category'); params.category = category; }
    if (search) { conditions.push('(toLower(k.topic) CONTAINS toLower($search) OR toLower(k.content) CONTAINS toLower($search))'); params.search = search; }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' RETURN k ORDER BY k.createdAt DESC LIMIT 100';
    const result = await s.run(query, params);
    res.json(result.records.map(r => r.get('k').properties));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// GET /api/knowledge/:id/glpi-links — live GLPI detail + linked Changes, Tickets, Problems
router.get('/:id/glpi-links', async (req, res) => {
  const { glpiUrl, userToken, appToken } = req.query;
  if (!glpiUrl || !userToken || !appToken) {
    return res.status(400).json({ error: 'Missing GLPI credentials' });
  }

  const s = driver.session();
  try {
    const result = await s.run('MATCH (k:Knowledge { id: $id }) RETURN k', { id: req.params.id });
    if (!result.records.length) return res.status(404).json({ error: 'Not found' });
    const entry = result.records[0].get('k').properties;

    // Resolve GLPI ID — same logic as frontend link resolution
    const glpiId =
      entry.dataflowId ||
      (entry.tags || []).find(t => t.startsWith('dataflow-'))?.replace('dataflow-', '') ||
      (entry.category === 'dataflow' ? entry.glpiId : null) ||
      entry.glpiId;

    if (!glpiId) {
      return res.json({ detail: null, changes: [], tickets: [], problems: [], glpiId: null, category: entry.category });
    }

    const glpi = await glpiFetch(glpiUrl, userToken, appToken);
    const { httpsAgent } = require('../lib/https-agent');

    const killSession = async () => {
      try {
        await require('node-fetch')(`${glpiUrl.replace(/\/$/, '')}/apirest.php/killSession`, {
          method: 'GET',
          headers: { 'Session-Token': glpi.sessionToken, 'App-Token': appToken },
          agent: glpiUrl.startsWith('https') ? httpsAgent : undefined,
        });
      } catch {}
    };

    // ── Helpers ─────────────────────────────────────────────

    // How GLPI links items to tickets/changes/problems:
    //   Junction table: Item_Ticket (also Item_Problem; Change uses Change_Item)
    //   Each row: { id (junction PK), itemtype, items_id (GLPI item PK), tickets_id }
    //
    // field 131 in the search API stores the junction record PK — NOT the item PK.
    // So matching against glpiId via field 131 always returns 0. Confirmed 2026-06-18.
    //
    // Correct approach: query the junction table directly with searchText filtering,
    // then fetch each ITIL item by its ID.

    // Junction table config per ITIL type
    const JUNCTION = {
      Ticket:  { table: 'Item_Ticket',  idField: 'tickets_id'  },
      Change:  { table: 'Change_Item',  idField: 'changes_id'  },
      Problem: { table: 'Item_Problem', idField: 'problems_id' },
    };

    const fetchLinked = async (itilType) => {
      try {
        const { table, idField } = JUNCTION[itilType];
        // Query junction table — searchText works on exact field names here
        const links = await glpi.get(
          `${table}?searchText[itemtype]=${itemType}&searchText[items_id]=${glpiId}&range=0-500`
        );
        if (!Array.isArray(links) || !links.length || links[0]?.ERROR) return [];

        const ids = links.map(l => l[idField]).filter(Boolean);
        if (!ids.length) return [];

        const items = await Promise.all(
          ids.map(id => glpi.get(`${itilType}/${id}?expand_dropdowns=true`).catch(() => null))
        );
        return items.filter(i => i && !i.ERROR).map(item => ({
          id:       item.id,
          name:     item.name,
          date_mod: item.date_mod,
          priority: item.priority,
          status:   item.status,
          date:     item.date,
          content:  item.content,
        }));
      } catch { return []; }
    };

    const itemType =
      entry.category === 'dataflow'    ? 'PluginDataflowsDataflow' :
      entry.category === 'application' ? 'PluginArchiswSwcomponent' : null;

    let detail = null, changes = [], tickets = [], problems = [], associatedItems = [];

    if (itemType) {
      // Fetch detail with AND without expand_dropdowns in parallel:
      // - with expand_dropdowns=true  → human-readable labels for display
      // - without expand_dropdowns    → raw numeric IDs needed for from/to app lookups
      const [detailRaw, detailRawIds, ticketsRaw, changesRaw, problemsRaw] = await Promise.all([
        glpi.get(`${itemType}/${glpiId}?expand_dropdowns=true`),
        glpi.get(`${itemType}/${glpiId}`),
        fetchLinked('Ticket'),
        fetchLinked('Change'),
        fetchLinked('Problem'),
      ]);
      detail = Array.isArray(detailRaw) ? (detailRaw[0] || null) : (detailRaw?.ERROR ? null : detailRaw);
      const detailIds = Array.isArray(detailRawIds) ? (detailRawIds[0] || null) : (detailRawIds?.ERROR ? null : detailRawIds);
      tickets  = ticketsRaw;
      changes  = changesRaw;
      problems = problemsRaw;

      // Associated items: use raw (non-expanded) detail to get numeric from/to app IDs
      if (detailIds && entry.category === 'dataflow') {
        const fromId = detailIds.plugin_dataflows_fromswcomponents_id;
        const toId   = detailIds.plugin_dataflows_toswcomponents_id;
        // Only use numeric IDs — skip if GLPI returned text (shouldn't happen without expand_dropdowns)
        const appIds = [...new Set([fromId, toId]
          .filter(id => id && /^\d+$/.test(String(id)) && String(id) !== '0'))];
        const appResults = await Promise.all(
          appIds.map(id => glpi.get(`PluginArchiswSwcomponent/${id}?expand_dropdowns=true`).catch(() => null))
        );
        associatedItems = appResults
          .map(r => Array.isArray(r) ? r[0] : (r?.ERROR ? null : r))
          .filter(Boolean);
      }
    } else if (entry.category === 'change') {
      const r = await glpi.get(`Change/${glpiId}?expand_dropdowns=true`);
      detail = Array.isArray(r) ? (r[0] || null) : (r?.ERROR ? null : r);
    } else if (entry.category === 'ticket') {
      const r = await glpi.get(`Ticket/${glpiId}?expand_dropdowns=true`);
      detail = Array.isArray(r) ? (r[0] || null) : (r?.ERROR ? null : r);
    } else if (entry.category === 'project') {
      const r = await glpi.get(`Project/${glpiId}?expand_dropdowns=true`);
      detail = Array.isArray(r) ? (r[0] || null) : (r?.ERROR ? null : r);
    }

    await killSession();
    res.json({ detail, changes, tickets, problems, associatedItems, glpiId, category: entry.category });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await s.close();
  }
});

// GET /api/knowledge/:id — single knowledge entry
router.get('/:id', async (req, res) => {
  const s = driver.session();
  try {
    const result = await s.run('MATCH (k:Knowledge { id: $id }) RETURN k', { id: req.params.id });
    if (!result.records.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.records[0].get('k').properties);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// POST /api/knowledge — create
router.post('/', async (req, res) => {
  const { topic, content, category, source, tags, reviewStatus } = req.body;
  if (!topic || !content) return res.status(400).json({ error: 'topic and content required' });
  const s = driver.session();
  try {
    const id = uuid();
    await s.run(`
      CREATE (k:Knowledge {
        id: $id, topic: $topic, content: $content,
        category: $category, source: $source,
        tags: $tags, reviewStatus: $reviewStatus, createdAt: $createdAt
      })
    `, { id, topic, content, category: category || 'manual', source: source || 'manual', tags: tags || [], reviewStatus: reviewStatus || 'pending', createdAt: new Date().toISOString() });
    auditLog('CREATE', 'Knowledge', id, { topic, category: category || 'manual', source: source || 'manual' }, req.headers['x-user'] || 'user');
    res.json({ id, success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// PUT /api/knowledge/:id — update
router.put('/:id', async (req, res) => {
  const { topic, content, tags, reviewStatus, category, dataflowId } = req.body;
  const s = driver.session();
  try {
    const result = await s.run(`
      MATCH (k:Knowledge { id: $id })
      SET k.topic = coalesce($topic, k.topic),
          k.content = coalesce($content, k.content),
          k.tags = coalesce($tags, k.tags),
          k.reviewStatus = coalesce($reviewStatus, k.reviewStatus),
          k.category = coalesce($category, k.category),
          k.dataflowId = coalesce($dataflowId, k.dataflowId),
          k.updatedAt = $now
      RETURN k
    `, { id: req.params.id, topic: topic || null, content: content || null, tags: tags || null, reviewStatus: reviewStatus || null, category: category || null, dataflowId: dataflowId || null, now: new Date().toISOString() });
    if (!result.records.length) return res.status(404).json({ error: 'Not found' });
    const changes = {};
    if (topic) changes.topic = topic;
    if (content) changes.content = '(updated)';
    if (tags) changes.tags = tags;
    if (reviewStatus) changes.reviewStatus = reviewStatus;
    auditLog('UPDATE', 'Knowledge', req.params.id, changes, req.headers['x-user'] || 'user');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// DELETE /api/knowledge/:id — returns 404 if not found
router.delete('/:id', async (req, res) => {
  const s = driver.session();
  try {
    const result = await s.run(
      'MATCH (k:Knowledge { id: $id }) WITH k, count(k) as found DELETE k RETURN found',
      { id: req.params.id }
    );
    const found = result.records[0]?.get('found').toNumber() || 0;
    if (!found) return res.status(404).json({ error: 'Not found' });
    auditLog('DELETE', 'Knowledge', req.params.id, {}, req.headers['x-user'] || 'user');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// POST /api/knowledge/import-glpi — manual Knowledge import (separate from full graph sync)
router.post('/import-glpi', async (req, res) => {
  const { type, glpiUrl, userToken, appToken } = req.body;
  if (!glpiUrl || !userToken || !appToken) return res.status(400).json({ error: 'Missing GLPI credentials' });

  const s = driver.session();
  let imported = 0;

  try {
    const glpi = await glpiFetch(glpiUrl, userToken, appToken);
    const { httpsAgent } = require('../lib/https-agent');

    const killSession = async () => {
      try {
        await require('node-fetch')(`${glpiUrl.replace(/\/$/, '')}/apirest.php/killSession`, {
          method: 'GET',
          headers: { 'Session-Token': glpi.sessionToken, 'App-Token': appToken },
          agent: glpiUrl.startsWith('https') ? httpsAgent : undefined
        });
      } catch {}
    };

    const endpoints = {
      dataflows:  'PluginDataflowsDataflow?range=0-500&expand_dropdowns=true',
      appstructs: 'PluginArchiswSwcomponent?range=0-500&expand_dropdowns=true',
      changes:    'Change?range=0-200&expand_dropdowns=true',
      tickets:    'Ticket?range=0-200&expand_dropdowns=true',
      projects:   'Project?range=0-100&expand_dropdowns=true',
    };
    const endpoint = endpoints[type];
    if (!endpoint) return res.status(400).json({ error: 'Unknown type. Valid: ' + Object.keys(endpoints).join(', ') });

    const items = await glpi.get(endpoint);
    if (!Array.isArray(items)) return res.json({ imported: 0, error: 'No data returned' });

    for (const item of items) {
      const id = uuid();
      let topic = '', content = '', category = type, tags = [];

      if (type === 'dataflows') {
        topic = item.name || `Dataflow ${item.id}`;
        content = `Dataflow: ${item.name}\nFrom: ${item.plugin_dataflows_fromswcomponents_id} → To: ${item.plugin_dataflows_toswcomponents_id}\nStatus: ${item.plugin_dataflows_states_id}\nProtocol: ${item.plugin_dataflows_transferprotocols_id}\nComplexity: ${item.plugin_dataflows_types_id}\nFrequency: ${item.plugin_dataflows_transferfreqs_id}\nGroup: ${item.plugin_dataflows_flowgroups_id}\nOwner: ${item.users_id}\nDescription: ${item.shortdescription || ''}\n${item.longdescription || ''}`;
        tags = [item.plugin_dataflows_fromswcomponents_id, item.plugin_dataflows_toswcomponents_id, item.plugin_dataflows_states_id].filter(Boolean);
        category = 'dataflow';
      } else if (type === 'appstructs') {
        topic = item.name || `App ${item.id}`;
        content = `Application: ${item.name}\nType: ${item.plugin_archisw_swcomponenttypes_id || item.swcomponenttypes_id || ''}\nEntity: ${item.entities_id || ''}\nDescription: ${item.shortdescription || item.description || ''}\nComment: ${item.comment || ''}`;
        category = 'application';
        tags = [item.name];
      } else if (type === 'changes') {
        topic = item.name || `Change ${item.id}`;
        content = `Change #${item.id}: ${item.name}\nStatus: ${item.status}\nDate: ${item.date}\nCategory: ${item.itilcategories_id || ''}\nEntity: ${item.entities_id || ''}`;
        category = 'change';
        tags = [`change-${item.id}`];
      } else if (type === 'tickets') {
        topic = item.name || `Ticket ${item.id}`;
        content = `Ticket #${item.id}: ${item.name}\nStatus: ${item.status}\nPriority: ${item.priority}\nDate: ${item.date}\nCategory: ${item.itilcategories_id || ''}\nEntity: ${item.entities_id || ''}`;
        category = 'ticket';
        tags = [`ticket-${item.id}`];
      } else if (type === 'projects') {
        topic = item.name || `Project ${item.id}`;
        content = `Project #${item.id}: ${item.name}\nStatus: ${item.global_state || ''}\nDate: ${item.date || ''}`;
        category = 'project';
        tags = [`project-${item.id}`];
      }

      await s.run(`
        MERGE (k:Knowledge { topic: $topic, category: $category })
        SET k.id = coalesce(k.id, $id),
            k.content = $content,
            k.source = 'glpi',
            k.tags = $tags,
            k.glpiId = $glpiId,
            k.createdAt = coalesce(k.createdAt, $createdAt),
            k.updatedAt = $createdAt
      `, { id, topic, content, category, tags, glpiId: String(item.id), createdAt: new Date().toISOString() });
      imported++;
    }

    await killSession();
    res.json({ imported, type });
  } catch (e) {
    res.status(500).json({ error: e.message, imported });
  } finally {
    await s.close();
  }
});

module.exports = router;
