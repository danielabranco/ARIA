const router = require('express').Router();
const neo4j = require('neo4j-driver');
const { driver } = require('../lib/neo4j');


// GET /api/graph — full node+edge graph (optionally filtered by appId)
router.get('/', async (req, res) => {
  const { appId } = req.query;
  const s = driver.session();
  try {
    let result;
    if (appId) {
      result = await s.run(`
        MATCH (center:Application { glpiId: $id }) WHERE center.glpiId IS NOT NULL AND center.glpiId <> ''
        OPTIONAL MATCH (center)-[r1:FEEDS_INTO]->(d:Dataflow) WHERE d.glpiId IS NOT NULL AND d.glpiId <> ''
        OPTIONAL MATCH (d)-[r2:FEEDS_INTO]->(dest:Application) WHERE dest.glpiId IS NOT NULL AND dest.glpiId <> ''
        OPTIONAL MATCH (src:Application)-[r3:FEEDS_INTO]->(center) WHERE src.glpiId IS NOT NULL AND src.glpiId <> ''
        OPTIONAL MATCH (src2:Application)-[r4:FEEDS_INTO]->(d2:Dataflow)-[r5:FEEDS_INTO]->(center)
          WHERE src2.glpiId IS NOT NULL AND src2.glpiId <> ''
            AND d2.glpiId IS NOT NULL AND d2.glpiId <> ''
        WITH center,
          collect(distinct d) + collect(distinct d2) as dataflows,
          collect(distinct dest) + collect(distinct src) + collect(distinct src2) as apps
        UNWIND [center] + dataflows + apps as n
        WITH collect(distinct n) as nodes
        UNWIND nodes as n
        OPTIONAL MATCH (n)-[r:FEEDS_INTO]->(m) WHERE m IN nodes
        RETURN n, r, m
      `, { id: String(appId) });
    } else {
      result = await s.run(`
        MATCH (n) WHERE n:Application OR (n:Dataflow AND n.glpiId IS NOT NULL AND n.glpiId <> '')
        OPTIONAL MATCH (n)-[r]->(m)
          WHERE (m:Application OR (m:Dataflow AND m.glpiId IS NOT NULL AND m.glpiId <> ''))
            AND type(r) IN ['FEEDS_INTO','CONNECTS_TO']
        RETURN n, r, m LIMIT 600
      `);
    }

    const nodes = new Map();
    const edges = [];
    result.records.forEach(rec => {
      const n = rec.get('n'), m = rec.get('m'), r = rec.get('r');
      if (n) {
        const id = n.identity.toString();
        if (!nodes.has(id)) nodes.set(id, { id, label: n.labels[0], properties: n.properties, name: n.properties.name || n.properties.glpiId || id });
      }
      if (m) {
        const id = m.identity.toString();
        if (!nodes.has(id)) nodes.set(id, { id, label: m.labels[0], properties: m.properties, name: m.properties.name || m.properties.glpiId || id });
      }
      if (r) edges.push({ id: r.identity.toString(), source: r.start.toString(), target: r.end.toString(), type: r.type, properties: r.properties });
    });
    res.json({ nodes: Array.from(nodes.values()), edges });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// GET /api/graph/stats — node counts by label
router.get('/stats', async (req, res) => {
  const s = driver.session();
  try {
    const result = await s.run('MATCH (n) RETURN labels(n)[0] as label, count(n) as count');
    const stats = {};
    result.records.forEach(r => { stats[r.get('label')] = r.get('count').toNumber(); });
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// GET /api/graph/search?q=&type= — search nodes by name/description
router.get('/search', async (req, res) => {
  const { q, type } = req.query;
  if (!q) return res.json([]);
  const s = driver.session();
  const VALID_LABELS = new Set(['Application', 'Dataflow', 'Change', 'Ticket', 'Project', 'User', 'Group']);
  try {
    const labelFilter = (type && type !== 'all' && VALID_LABELS.has(type)) ? `:${type}` : '';
    const result = await s.run(`
      MATCH (n${labelFilter})
      WHERE toLower(n.name) CONTAINS toLower($q)
         OR toLower(coalesce(n.glpiId,'')) CONTAINS toLower($q)
         OR toLower(coalesce(n.description,'')) CONTAINS toLower($q)
         OR toLower(coalesce(n.sourceApp,'')) CONTAINS toLower($q)
         OR toLower(coalesce(n.destApp,'')) CONTAINS toLower($q)
      RETURN n, labels(n)[0] as type LIMIT 50
    `, { q });
    res.json(result.records.map(r => ({
      ...r.get('n').properties,
      type: r.get('type'),
      neo4jId: r.get('n').identity.toString()
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// GET /api/graph/node/:id — single node with its connections
router.get('/node/:id', async (req, res) => {
  const s = driver.session();
  try {
    const result = await s.run(`
      MATCH (n) WHERE id(n) = $id
      OPTIONAL MATCH (n)-[r1]->(m1)
      OPTIONAL MATCH (m2)-[r2]->(n)
      RETURN n,
        collect(distinct { rel: type(r1), node: m1 }) as outgoing,
        collect(distinct { rel: type(r2), node: m2 }) as incoming
    `, { id: neo4j.int(parseInt(req.params.id)) });
    if (!result.records.length) return res.status(404).json({ error: 'Not found' });
    const rec = result.records[0];
    const n = rec.get('n');
    res.json({
      node: { id: n.identity.toString(), label: n.labels[0], properties: n.properties },
      outgoing: rec.get('outgoing').filter(o => o.node).map(o => ({ rel: o.rel, node: { id: o.node.identity.toString(), label: o.node.labels[0], name: o.node.properties.name || o.node.properties.glpiId } })),
      incoming: rec.get('incoming').filter(i => i.node).map(i => ({ rel: i.rel, node: { id: i.node.identity.toString(), label: i.node.labels[0], name: i.node.properties.name || i.node.properties.glpiId } })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// PATCH /api/graph/node — update properties on a node by name
// Body: { name, label, props } where label is 'Application' or 'Dataflow', props is key/value map
router.patch('/node', async (req, res) => {
  const { name, label = 'Application', props = {} } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const VALID = new Set(['Application', 'Dataflow']);
  if (!VALID.has(label)) return res.status(400).json({ error: 'invalid label' });
  const s = driver.session();
  try {
    const setParts = Object.keys(props).map((k, i) => `n.${k} = $p${i}`).join(', ');
    if (!setParts) return res.status(400).json({ error: 'no props to set' });
    const params = { name };
    Object.values(props).forEach((v, i) => { params[`p${i}`] = String(v); });
    const result = await s.run(
      `MATCH (n:${label} { name: $name }) SET ${setParts} RETURN n`,
      params
    );
    if (!result.records.length) return res.status(404).json({ error: 'Node not found' });
    res.json({ ok: true, properties: result.records[0].get('n').properties });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

module.exports = router;
