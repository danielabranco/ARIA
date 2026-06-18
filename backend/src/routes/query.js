const router = require('express').Router();
const { driver } = require('../lib/neo4j');
const { callClaude } = require('../lib/bedrock');

router.post('/', async (req, res) => {
  const { message, context } = req.body;
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return res.status(503).json({ error: 'AWS credentials not configured on server' });
  }

  const s = driver.session();
  let knowledgeContext = '';
  const sources = [];

  try {
    const keywords = message.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 2).slice(0, 8);
    if (keywords.length > 0) {
      const kwParams = {};
      keywords.forEach((kw, i) => { kwParams[`kw${i}`] = kw; });

      // Search manual/training Knowledge nodes
      const kConditions = keywords.map((_, i) => `(toLower(k.content) CONTAINS toLower($kw${i}) OR toLower(k.topic) CONTAINS toLower($kw${i}))`).join(' OR ');
      const kResult = await s.run(`MATCH (k:Knowledge) WHERE (${kConditions}) AND coalesce(k.reviewStatus, 'pending') <> 'ignore' RETURN k ORDER BY k.createdAt DESC LIMIT 8`, kwParams);

      // Search graph nodes — source of truth for synced GLPI data
      const gConditions = keywords.map((_, i) => `(toLower(n.name) CONTAINS toLower($kw${i}) OR toLower(coalesce(n.description,'')) CONTAINS toLower($kw${i}) OR toLower(coalesce(n.sourceApp,'')) CONTAINS toLower($kw${i}) OR toLower(coalesce(n.destApp,'')) CONTAINS toLower($kw${i}))`).join(' OR ');
      const gResult = await s.run(`MATCH (n) WHERE (n:Application OR n:Dataflow) AND (${gConditions}) RETURN n LIMIT 8`, kwParams);

      const parts = [];
      kResult.records.forEach(r => {
        const k = r.get('k').properties;
        parts.push(`[${k.category}] ${k.topic}:\n${(k.content || '').substring(0, 800)}`);
        sources.push(`${k.category}: ${k.topic}`);
      });
      gResult.records.forEach(r => {
        const n = r.get('n').properties;
        const label = r.get('n').labels?.[0] || 'Node';
        if (label === 'Application') {
          parts.push(`[application] ${n.name}:\nType: ${n.type || ''}\nDescription: ${n.description || ''}`);
        } else {
          parts.push(`[dataflow] ${n.name}:\nFrom: ${n.sourceApp} -> To: ${n.destApp}\nStatus: ${n.status}\nProtocol: ${n.protocol}\nDescription: ${n.description || ''}`);
        }
        sources.push(`${label}: ${n.name}`);
      });

      if (parts.length > 0) knowledgeContext = '\n\nRELEVANT CONTEXT:\n\n' + parts.join('\n\n');
    }
  } catch (e) { console.log('Knowledge search error:', e.message); }

  try {
    const text = await callClaude({
      system: `You are ARIA, an AI architecture assistant for OM Digital Solutions (OMDS).
You have been trained on OMDS's IT ecosystem data from GLPI and training sessions.
Answer questions about OMDS systems, dataflows, architecture and IT processes.
Be specific, reference actual system names and data when available.
If you don't have specific information, say so clearly.
${knowledgeContext}
${context ? '\nAdditional context: ' + context : ''}`,
      messages: [{ role: 'user', content: message }],
      maxTokens: 1500
    });
    res.json({ response: text || 'No response', sources });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await s.close();
  }
});

module.exports = router;
