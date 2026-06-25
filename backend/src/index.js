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
    // ── per-field compliance (single-row aggregate queries) ───────────────
    const fieldBreakdown = async (cypher, fieldDefs) => {
      const s = driver.session();
      try {
        const r = await s.run(cypher);
        if (!r.records.length) return [];
        const row   = r.records[0];
        const total = row.get('total').toNumber();
        return fieldDefs
          .map(([label, key]) => ({ field: label, total, compliant: row.get(key).toNumber() }))
          .sort((a, b) => a.compliant - b.compliant); // worst first
      } finally { await s.close(); }
    };

    const [dfByStatus, dfByGroup, dfByProtocol, dfByComplexity,
           appByType, appByEntity, appByStatus,
           dfByField, appByField] = await Promise.all([
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

      // Dataflow: per-criterion compliance across all dataflows
      fieldBreakdown(`
        MATCH (d:Dataflow) WHERE d.compliant IS NOT NULL
        RETURN count(d) AS total,
          sum(CASE WHEN d.name =~ '.*\\\\[.+\\\\].*\\\\[.+\\\\].*' THEN 1 ELSE 0 END) AS nameOk,
          sum(CASE WHEN d.dataClassification IS NOT NULL AND d.dataClassification <> '' THEN 1 ELSE 0 END) AS gdprOk,
          sum(CASE WHEN d.sourceApp IS NOT NULL AND d.sourceApp <> '' AND d.destApp IS NOT NULL AND d.destApp <> '' THEN 1 ELSE 0 END) AS appsOk,
          sum(CASE WHEN d.protocol IS NOT NULL AND d.protocol <> '' THEN 1 ELSE 0 END) AS protOk`,
        [['Name format [SOURCE]-[DEST]', 'nameOk'], ['GDPR Label', 'gdprOk'],
         ['From/To Application', 'appsOk'], ['Protocol', 'protOk']]),

      // Application: per-criterion compliance across all apps
      fieldBreakdown(`
        MATCH (a:Application) WHERE a.glpiId IS NOT NULL AND a.compliant IS NOT NULL
        RETURN count(a) AS total,
          sum(CASE WHEN a.status IS NOT NULL AND a.status <> '' THEN 1 ELSE 0 END) AS statusOk,
          sum(CASE WHEN a.type IS NOT NULL AND a.type <> '' THEN 1 ELSE 0 END) AS typeOk,
          sum(CASE WHEN a.targets IS NOT NULL AND a.targets <> '' THEN 1 ELSE 0 END) AS targetsOk,
          sum(CASE WHEN a.dataClassification IS NOT NULL AND a.dataClassification <> '' THEN 1 ELSE 0 END) AS dataClOk,
          sum(CASE WHEN a.supplier IS NOT NULL AND a.supplier <> '' THEN 1 ELSE 0 END) AS supplOk,
          sum(CASE WHEN a.sla IS NOT NULL AND a.sla <> '' THEN 1 ELSE 0 END) AS slaOk,
          sum(CASE WHEN a.owner IS NOT NULL AND a.owner <> '' THEN 1 ELSE 0 END) AS ownerOk`,
        [['Status', 'statusOk'], ['Type', 'typeOk'], ['McFarlan Matrix', 'targetsOk'],
         ['Security Classification', 'dataClOk'], ['Supplier', 'supplOk'],
         ['Service Level (SLA)', 'slaOk'], ['Component Owner', 'ownerOk']]),
    ]);
    res.json({
      dataflows:    { byField: dfByField, byStatus: dfByStatus, byFlowGroup: dfByGroup, byProtocol: dfByProtocol, byComplexity: dfByComplexity },
      applications: { byField: appByField, byType: appByType, byEntity: appByEntity, byStatus: appByStatus },
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
