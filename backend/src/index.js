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
    const comp = await s.run('MATCH (d:Dataflow) RETURN count(d) AS total, sum(CASE WHEN d.compliant = true THEN 1 ELSE 0 END) AS compliant');
    const total    = comp.records[0]?.get('total').toNumber()    || 0;
    const compliant = comp.records[0]?.get('compliant').toNumber() || 0;
    res.json({
      knowledge: k.records[0]?.get('c').toNumber() || 0,
      memory:    m.records[0]?.get('c').toNumber() || 0,
      sessions:  sess.records[0]?.get('c').toNumber() || 0,
      compliance: { total, compliant, percent: total > 0 ? Math.round((compliant / total) * 100) : 0 },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
  finally { await s.close(); }
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
