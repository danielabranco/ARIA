const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { driver } = require('../lib/neo4j');
const { callClaude } = require('../lib/bedrock');

router.post('/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!process.env.AWS_ACCESS_KEY_ID) {
    return res.status(503).json({ error: 'AWS credentials not configured on server' });
  }

  const s = driver.session();

  // Build full conversation text for keyword extraction (current message + recent history)
  const allText = [message, ...(history || []).slice(-4).map(m => m.text)].join(' ');
  const keywords = allText.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length >= 3).slice(0, 10);

  let knowledgeContext = '';
  const sources = [];
  try {
    const parts = [];

    if (keywords.length > 0) {
      const kwParams = {};
      keywords.forEach((kw, i) => { kwParams[`kw${i}`] = kw; });

      // Keyword-matched Knowledge entries
      const kConditions = keywords.map((_, i) => `(toLower(k.content) CONTAINS toLower($kw${i}) OR toLower(k.topic) CONTAINS toLower($kw${i}))`).join(' OR ');
      const kRes = await s.run(
        `MATCH (k:Knowledge) WHERE (${kConditions}) AND coalesce(k.reviewStatus,'pending') <> 'ignore' RETURN k.topic AS topic, k.category AS category, k.content AS content ORDER BY k.createdAt DESC LIMIT 10`,
        kwParams
      );
      kRes.records.forEach(r => {
        const topic = r.get('topic'); const cat = r.get('category');
        parts.push(`[${cat}] ${topic}:\n${(r.get('content') || '').substring(0, 800)}`);
        sources.push(`${cat}: ${topic}`);
      });

      // Also search graph nodes
      const gConditions = keywords.map((_, i) => `(toLower(n.name) CONTAINS toLower($kw${i}) OR toLower(coalesce(n.description,'')) CONTAINS toLower($kw${i}))`).join(' OR ');
      const gRes = await s.run(
        `MATCH (n) WHERE (n:Application OR n:Dataflow) AND (${gConditions}) RETURN n LIMIT 6`,
        kwParams
      );
      gRes.records.forEach(r => {
        const n = r.get('n').properties;
        const label = r.get('n').labels?.[0] || 'Node';
        if (label === 'Application') {
          parts.push(`[application] ${n.name}:\nType: ${n.type || ''}\nDescription: ${n.description || ''}\nURL Prod: ${n.urlProd || ''}\nSupplier: ${n.supplier || ''}`);
        } else {
          parts.push(`[dataflow] ${n.name}:\nFrom: ${n.sourceApp} -> To: ${n.destApp}\nStatus: ${n.status}\nProtocol: ${n.protocol}`);
        }
        sources.push(`${label}: ${n.name}`);
      });
    }

    // Fallback: load most recent entries so ARIA always has context
    if (parts.length === 0) {
      const fallback = await s.run(
        "MATCH (k:Knowledge) WHERE coalesce(k.reviewStatus,'pending') <> 'ignore' RETURN k.topic AS topic, k.category AS category, k.content AS content ORDER BY k.createdAt DESC LIMIT 20"
      );
      fallback.records.forEach(r => {
        parts.push(`[${r.get('category')}] ${r.get('topic')}:\n${(r.get('content') || '').substring(0, 600)}`);
        sources.push(`${r.get('category')}: ${r.get('topic')}`);
      });
    }

    // Always include a snapshot of existing graph connections so ARIA knows what's already mapped
    try {
      const connRes = await s.run(`
        MATCH (a:Application)-[r:FEEDS_INTO|CONNECTS_TO]->(b:Application)
        RETURN a.name AS src, b.name AS dst, type(r) AS rel, coalesce(r.via,'') AS via, coalesce(r.protocol,'') AS proto
        LIMIT 80
      `);
      if (connRes.records.length > 0) {
        const connLines = connRes.records.map(r =>
          `  ${r.get('src')} → ${r.get('dst')}${r.get('via') ? ' via ' + r.get('via') : ''}${r.get('proto') ? ' (' + r.get('proto') + ')' : ''}`
        );
        parts.push(`EXISTING ARCHITECTURE CONNECTIONS (${connLines.length} mapped so far):\n${connLines.join('\n')}`);
        sources.push('Architecture graph');
      }
    } catch (e) { console.log('Graph conn fetch error:', e.message); }

    if (parts.length > 0) {
      knowledgeContext = `KNOWLEDGE BASE (${parts.length} relevant entries):\n\n${parts.join('\n\n---\n\n')}`;
    }
  } catch (e) { console.log('Knowledge fetch error:', e.message); }

  try {
    const responseText = await callClaude({
      system: `You are ARIA, an AI assistant trained on OM Digital Solutions (OMDS) IT architecture.
You have direct access to the OMDS knowledge base and architecture graph. When you learn connections between systems, they are immediately pushed to FlowVault's live architecture map.

Your job:
1. Use the knowledge base to give specific, accurate answers about OMDS systems
2. When the user asks you to quiz them, pick an entry from the knowledge base and ask targeted questions about it
3. When the user teaches you something new and factual, save it using the LEARN block
4. When you identify applications or connections between systems, push them to the graph using the GRAPH block
5. Ask clarifying questions to deepen understanding

${knowledgeContext}

OUTPUT BLOCKS — emit these BEFORE your conversational reply, never at the end:

When you learn a new fact: [LEARN:{"topic":"...","content":"...","category":"...","glpiId":"...","tags":["..."]}]
Categories: dataflow, application, change, process, business-rule, architecture, integration
- Always include "glpiId" if you know the GLPI ID of the app or dataflow (visible in the knowledge base as "GLPI ID: ...")
- For applications: topic = "Application #<glpiId> — <Name>", include glpiId field
- For dataflows: topic = "Dataflow #<glpiId> — <Name>", include glpiId field
- content must include: GLPI ID, app/dataflow name, and all known attributes

When you identify applications or connections: [GRAPH:{"apps":["App Name 1","App Name 2"],"connections":[{"from":"App A","to":"App B","via":"dataflow name","protocol":"","status":"active","dataflowGlpiId":"","fromGlpiId":"","toGlpiId":""}]}]

Rules for GRAPH:
- Always emit GRAPH when the user describes how systems connect — put it at the START of your response
- Include every application and connection mentioned
- Use exact application names (e.g. "SAP CRM MKT", "Zendesk")
- Keep via names concise — no brackets or special chars inside the JSON string values
- Include fromGlpiId, toGlpiId, dataflowGlpiId whenever known from the knowledge base`,
      messages: [
        ...(history || []).slice(-8).map(m => ({ role: m.role === 'aria' ? 'assistant' : 'user', content: m.text })),
        { role: 'user', content: message }
      ],
      maxTokens: 2000
    });

    let finalText = responseText;
    let learned = null;

    const learnMatch = finalText.match(/\[LEARN:(.*?)\]/s);
    if (learnMatch) {
      try {
        const learnData = JSON.parse(learnMatch[1]);

        // Enrich with glpiId from existing nodes if ARIA didn't include it
        let glpiId = learnData.glpiId || null;
        if (!glpiId && learnData.topic) {
          const nameOnly = learnData.topic.replace(/^(Application|Dataflow)\s*#\d+\s*[—-]\s*/i, '').trim();
          const lookup = await s.run(
            `MATCH (n) WHERE (n:Application OR n:Knowledge) AND (toLower(n.name) = toLower($name) OR toLower(n.topic) CONTAINS toLower($name)) AND n.glpiId IS NOT NULL RETURN n.glpiId AS gid LIMIT 1`,
            { name: nameOnly }
          );
          if (lookup.records.length > 0) glpiId = lookup.records[0].get('gid');
        }

        // Enrich content with GLPI ID line if missing
        let enrichedContent = learnData.content || '';
        if (glpiId && !enrichedContent.includes('GLPI ID:')) {
          enrichedContent = `GLPI ID: ${glpiId}\n` + enrichedContent;
        }

        // Upsert Knowledge — merge by glpiId if available, else by topic
        const mergeKey = glpiId ? 'glpiId' : 'topic';
        const mergeVal = glpiId || learnData.topic;
        await s.run(`
          MERGE (k:Knowledge { ${mergeKey}: $mergeVal })
          SET k.id = coalesce(k.id, $id),
              k.topic = $topic, k.content = $content,
              k.category = $category, k.source = 'training',
              k.glpiId = coalesce($glpiId, k.glpiId),
              k.tags = $tags, k.updatedAt = $now,
              k.createdAt = coalesce(k.createdAt, $now)
        `, { id: uuid(), mergeVal, topic: learnData.topic, content: enrichedContent,
             category: learnData.category || 'general', glpiId: glpiId || null,
             tags: learnData.tags || [], now: new Date().toISOString() });

        // Upsert Memory by topic — include glpiId
        await s.run(`
          MERGE (m:Memory { topic: $topic })
          SET m.content = $content, m.category = $category,
              m.glpiId = coalesce($glpiId, m.glpiId),
              m.source = 'training', m.updatedAt = $now,
              m.id = coalesce(m.id, $id)
        `, { id: uuid(), topic: learnData.topic, content: enrichedContent,
             category: learnData.category || 'general', glpiId: glpiId || null,
             now: new Date().toISOString() });

        learned = learnData.topic;
        finalText = finalText.replace(/\[LEARN:.*?\]/s, '').trim();
      } catch (le) { console.error('LEARN block error:', le.message); }
    }

    // Strip [GRAPH:...] robustly — find opening brace, walk to matching closing }]
    const stripGraph = (text) => {
      const start = text.indexOf('[GRAPH:');
      if (start === -1) return { text, json: null };
      const jsonStart = start + 7; // after [GRAPH:
      let depth = 0, i = jsonStart, found = -1;
      while (i < text.length) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') { depth--; if (depth === 0) { found = i; break; } }
        i++;
      }
      if (found === -1) return { text, json: null };
      const jsonStr = text.slice(jsonStart, found + 1);
      const stripped = (text.slice(0, start) + text.slice(found + 2)).trim(); // +2 skips }]
      return { text: stripped, json: jsonStr };
    };

    // Parse GRAPH block — push apps and connections to Neo4j so FlowVault map updates live
    let graphPushed = 0;
    const { text: textAfterGraph, json: graphJson } = stripGraph(finalText);
    finalText = textAfterGraph;
    if (graphJson) {
      try {
        const graphData = JSON.parse(graphJson);
        const now = new Date().toISOString();

        // Upsert Application nodes
        for (const appName of (graphData.apps || [])) {
          if (!appName) continue;
          await s.run(
            `MERGE (a:Application { name: $name }) SET a.source = coalesce(a.source, 'training'), a.updatedAt = $now`,
            { name: String(appName), now }
          );
          graphPushed++;
        }

        // Upsert connections + Dataflow nodes
        for (const conn of (graphData.connections || [])) {
          if (!conn.from || !conn.to) continue;
          await s.run(
            `MERGE (s:Application { name: $src })
             MERGE (t:Application { name: $dst })
             MERGE (s)-[r:CONNECTS_TO]->(t)
             SET r.via = $via, r.protocol = $protocol, r.status = $status,
                 r.source = 'training', r.updatedAt = $now`,
            { src: String(conn.from), dst: String(conn.to),
              via: conn.via || '', protocol: conn.protocol || '',
              status: conn.status || 'active', now }
          );
          // Also create a Dataflow node wired between the two apps with FEEDS_INTO edges
          if (conn.via) {
            await s.run(
              `MERGE (s:Application { name: $src })
               MERGE (t:Application { name: $dst })
               MERGE (d:Dataflow { name: $name })
               SET d.sourceApp = $src, d.destApp = $dst,
                   d.protocol = $protocol, d.status = $status,
                   d.glpiId = coalesce($dfGlpiId, d.glpiId),
                   d.source = 'training', d.updatedAt = $now
               MERGE (s)-[:FEEDS_INTO]->(d)
               MERGE (d)-[:FEEDS_INTO]->(t)`,
              { name: conn.via, src: String(conn.from), dst: String(conn.to),
                protocol: conn.protocol || '', status: conn.status || 'active',
                dfGlpiId: conn.dataflowGlpiId || null, now }
            );
          }
          graphPushed++;
        }

        // Upsert a Memory entry per app involved — include GLPI IDs
        const connections = (graphData.connections || []).filter(c => c.from && c.to);
        const appsInvolved = [...new Set([
          ...(graphData.apps || []).filter(Boolean),
          ...connections.map(c => c.from),
          ...connections.map(c => c.to),
        ])];
        for (const appName of appsInvolved) {
          const appConns = connections.filter(c => c.from === appName || c.to === appName);
          if (appConns.length === 0) continue;

          // Look up GLPI ID for this app
          const appLookup = await s.run(
            `MATCH (a:Application { name: $name }) WHERE a.glpiId IS NOT NULL RETURN a.glpiId AS gid LIMIT 1`,
            { name: appName }
          );
          const appGlpiId = appLookup.records.length > 0 ? appLookup.records[0].get('gid') : null;

          const lines = [];
          if (appGlpiId) lines.push(`GLPI ID: ${appGlpiId}`);
          for (const c of appConns) {
            // Look up GLPI IDs for connected apps and dataflow
            const fromLookup = await s.run(`MATCH (a:Application { name: $n }) RETURN a.glpiId AS gid LIMIT 1`, { n: c.from });
            const toLookup   = await s.run(`MATCH (a:Application { name: $n }) RETURN a.glpiId AS gid LIMIT 1`, { n: c.to });
            const dfLookup   = c.via ? await s.run(`MATCH (d:Dataflow { name: $n }) RETURN d.glpiId AS gid LIMIT 1`, { n: c.via }) : null;
            const fromId = c.fromGlpiId || (fromLookup.records[0]?.get('gid')) || '';
            const toId   = c.toGlpiId   || (toLookup.records[0]?.get('gid'))   || '';
            const dfId   = c.dataflowGlpiId || (dfLookup?.records[0]?.get('gid')) || '';
            lines.push(
              `${c.from}${fromId ? ' (#' + fromId + ')' : ''} -> ${c.to}${toId ? ' (#' + toId + ')' : ''}` +
              (c.via ? ` via ${c.via}${dfId ? ' (#' + dfId + ')' : ''}` : '') +
              (c.protocol ? ` (${c.protocol})` : '') +
              (c.status && c.status !== 'active' ? ` [${c.status}]` : '')
            );
          }

          const topic = appGlpiId ? `Application #${appGlpiId} — ${appName} connections` : `${appName} connections`;
          await s.run(
            `MERGE (m:Memory { topic: $topic })
             SET m.content = $content, m.category = 'architecture',
                 m.glpiId = coalesce($glpiId, m.glpiId),
                 m.source = 'training', m.updatedAt = $now,
                 m.id = coalesce(m.id, $id)`,
            { id: uuid(), topic, content: lines.join('\n'), glpiId: appGlpiId || null, now }
          );
        }

      } catch (ge) { console.log('GRAPH parse error:', ge.message); }
    }

    res.json({ response: finalText, learned, sources, graphPushed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await s.close();
  }
});

module.exports = router;
