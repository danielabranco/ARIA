// NOTE: TLS verification is disabled per-request via this agent for GLPI/Zscaler.
// Do NOT set NODE_TLS_REJECT_UNAUTHORIZED globally — it disables verification for ALL outbound calls including Anthropic.
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

module.exports = { httpsAgent };
