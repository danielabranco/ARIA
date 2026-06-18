const router = require('express').Router();
const neo4j = require('neo4j-driver');
const { driver } = require('../lib/neo4j');

// GET /api/memory — list memories (searchable, pageable)
router.get('/', async (req, res) => {
  const { search, limit } = req.query;
  const cap = neo4j.int(Math.min(parseInt(limit) || 50, 200));
  const s = driver.session();
  try {
    let query = "MATCH (m:Memory) WHERE m.category <> 'chat'";
    const params = { limit: cap };
    if (search) {
      query += ' AND (toLower(m.content) CONTAINS toLower($search) OR toLower(m.topic) CONTAINS toLower($search))';
      params.search = search;
    }
    query += ' RETURN m ORDER BY m.createdAt DESC LIMIT $limit';
    const result = await s.run(query, params);
    res.json(result.records.map(r => r.get('m').properties));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// GET /api/memory/:id — single memory
router.get('/:id', async (req, res) => {
  const s = driver.session();
  try {
    const result = await s.run('MATCH (m:Memory { id: $id }) RETURN m', { id: req.params.id });
    if (!result.records.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.records[0].get('m').properties);
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// PUT /api/memory/:id — update memory content
router.put('/:id', async (req, res) => {
  const s = driver.session();
  try {
    const result = await s.run(
      'MATCH (m:Memory { id: $id }) SET m.content = $content, m.updatedAt = $updatedAt RETURN m',
      { id: req.params.id, content: req.body.content, updatedAt: new Date().toISOString() }
    );
    if (!result.records.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// DELETE /api/memory/:id
router.delete('/:id', async (req, res) => {
  const s = driver.session();
  try {
    const result = await s.run('MATCH (m:Memory { id: $id }) WITH m, count(m) as found DELETE m RETURN found', { id: req.params.id });
    const found = result.records[0]?.get('found').toNumber() || 0;
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

module.exports = router;
