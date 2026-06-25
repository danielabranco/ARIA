require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { driver, waitForNeo4j, initSchema } = require('./lib/neo4j');
const { auth } = require('./lib/auth');
const { startScheduler } = require('./lib/scheduler');

const app = express();
const PORT = 4001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// ── HEALTH ───────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const s = driver.session();
    await s.run('RETURN 1');
    await s.close();
    res.json({ status: 'ok', neo4j: 'connected', version: '2.0' });
  } catch (e) {
    res.json({ status: 'degraded', neo4j: 'disconnected', error: e.message });
  }
});

// ── STATS (knowledge/memory/session counts) ──────────────
app.get('/api/stats', auth, async (req, res) => {
  const s = driver.session();
  try {
    const k    = await s.run('MATCH (k:Knowledge) RETURN count(k) as c');
    const m    = await s.run('MATCH (m:Memory) RETURN count(m) as c');
    const sess = await s.run('MATCH (s:Session) RETURN count(s) as c');
    const dComp = await s.run('MATCH (d:Dataflow) RETURN count(d) AS total, sum(CASE WHEN d.compliant = true THEN 1 ELSE 0 END) AS compliant');
    const aComp = await s.run('MATCH (a:Application) WHERE a.glpiId IS NOT NULL RETURN count(a) AS total, sum(CASE WHEN a.compliant = true THEN 1 ELSE 0 END) AS compliant');
    const dTotal = dComp.records[0]?.get('total').toNumber()    || 0;
    const dCompl = dComp.records[0]?.get('compliant').toNumber() || 0;
    const aTotal = aComp.records[0]?.get('total').toNumber()    || 0;
    const aCompl = aComp.records[0]?.get('compliant').toNumber() || 0;
    res.json({
      knowledge: k.records[0]?.get('c').toNumber() || 0,
      memory:    m.records[0]?.get('c').toNumber() || 0,
      sessions:  sess.records[0]?.get('c').toNumber() || 0,
      compliance: {
        dataflows:    { total: dTotal, compliant: dCompl, percent: dTotal > 0 ? Math.round((dCompl / dTotal) * 100) : 0 },
        applications: { total: aTotal, compliant: aCompl, percent: aTotal > 0 ? Math.round((aCompl / aTotal) * 100) : 0 },
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
});

// ── COMPLIANCE BREAKDOWN ─────────────────────────────────
app.get('/api/stats/compliance', auth, async (req, res) => {
  try {
    const breakdown = async (cypher) => {
      const s = driver.session();
      try {
        const r = await s.run(cypher);
        return r.records.map(rec => ({
          field:     rec.get('field'),
          total:     rec.get('total').toNumber(),
          compliant: rec.get('compliant').toNumber(),
        }));
      } finally { await s.close(); }
    };
    const [dfByStatus, dfByGroup, dfByProtocol, dfByComplexity,
           appByType, appByEntity, appByStatus] = await Promise.all([
      breakdown(`MATCH (d:Dataflow) WHERE d.status IS NOT NULL AND d.status <> ''
        RETURN d.status AS field, count(d) AS total, sum(CASE WHEN d.compliant = true THEN 1 ELSE 0 END) AS compliant ORDER BY total DESC LIMIT 20`),
      breakdown(`MATCH (d:Dataflow) WHERE d.flowGroup IS NOT NULL AND d.flowGroup <> ''
        RETURN d.flowGroup AS field, count(d) AS total, sum(CASE WHEN d.compliant = true THEN 1 ELSE 0 END) AS compliant ORDER BY total DESC LIMIT 20`),
      breakdown(`MATCH (d:Dataflow) WHERE d.protocol IS NOT NULL AND d.protocol <> ''
        RETURN d.protocol AS field, count(d) AS total, sum(CASE WHEN d.compliant = true THEN 1 ELSE 0 END) AS compliant ORDER BY total DESC LIMIT 20`),
      breakdown(`MATCH (d:Dataflow) WHERE d.complexity IS NOT NULL AND d.complexity <> ''
        RETURN d.complexity AS field, count(d) AS total, sum(CASE WHEN d.compliant = true THEN 1 ELSE 0 END) AS compliant ORDER BY total DESC LIMIT 20`),
      breakdown(`MATCH (a:Application) WHERE a.glpiId IS NOT NULL AND a.type IS NOT NULL AND a.type <> ''
        RETURN a.type AS field, count(a) AS total, sum(CASE WHEN a.compliant = true THEN 1 ELSE 0 END) AS compliant ORDER BY total DESC LIMIT 20`),
      breakdown(`MATCH (a:Application) WHERE a.glpiId IS NOT NULL AND a.entity IS NOT NULL AND a.entity <> ''
        RETURN a.entity AS field, count(a) AS total, sum(CASE WHEN a.compliant = true THEN 1 ELSE 0 END) AS compliant ORDER BY total DESC LIMIT 20`),
      breakdown(`MATCH (a:Application) WHERE a.glpiId IS NOT NULL AND a.status IS NOT NULL AND a.status <> ''
        RETURN a.status AS field, count(a) AS total, sum(CASE WHEN a.compliant = true THEN 1 ELSE 0 END) AS compliant ORDER BY total DESC LIMIT 20`),
    ]);
    res.json({
      dataflows:    { byStatus: dfByStatus, byFlowGroup: dfByGroup, byProtocol: dfByProtocol, byComplexity: dfByComplexity },
      applications: { byType: appByType, byEntity: appByEntity, byStatus: appByStatus },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ROUTES ───────────────────────────────────────────────
app.use('/api/audit',     auth, require('./routes/audit'));
app.use('/api/knowledge', auth, require('./routes/knowledge'));
app.use('/api/memory',    auth, require('./routes/memory'));
app.use('/api/graph',     auth, require('./routes/graph'));
app.use('/api/query',     auth, require('./routes/query'));
app.use('/api/train',     auth, require('./routes/train'));
app.use('/api/sync',      auth, require('./routes/sync'));
app.use('/api/pipeline',  auth, require('./routes/pipeline'));
app.use('/api/useraccess', auth, require('./routes/useraccess'));

// ── START ────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n◈ ARIA Backend v2.0 running on port ${PORT}`);
  const connected = await waitForNeo4j();
  if (connected) {
    await initSchema();
    await startScheduler();
  }
});

const shutdown = () => { driver.close(); process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
