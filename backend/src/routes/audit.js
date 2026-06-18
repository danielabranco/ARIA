const router = require('express').Router();
const { driver } = require('../lib/neo4j');

// GET /api/audit — query audit log (capped at 500 per request)
router.get('/', async (req, res) => {
  const { entity, entityId, limit } = req.query;
  const cap = Math.min(parseInt(limit) || 50, 500);
  const s = driver.session();
  try {
    let query = 'MATCH (l:AuditLog)';
    const params = { limit: cap };
    const conditions = [];
    if (entity)   { conditions.push('l.entity = $entity');     params.entity = entity; }
    if (entityId) { conditions.push('l.entityId = $entityId'); params.entityId = entityId; }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' RETURN l ORDER BY l.createdAt DESC LIMIT $limit';
    const result = await s.run(query, params);
    res.json(result.records.map(r => r.get('l').properties));
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

module.exports = router;
