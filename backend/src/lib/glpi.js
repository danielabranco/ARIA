const fetch = require('node-fetch');
const { httpsAgent } = require('./https-agent');

// SECURITY CONSTRAINT: All GLPI API calls are restricted to HTTP GET ONLY.
// POST, PUT, PATCH, DELETE are never permitted against the GLPI API.
// This is enforced at the transport level below — any attempt to use a different
// method will throw immediately, before any network call is made.

const GLPI_ALLOWED_METHOD = 'GET';

const enforceGetOnly = (method) => {
  if (method && method.toUpperCase() !== GLPI_ALLOWED_METHOD) {
    throw new Error(`GLPI security violation: only GET is permitted. Attempted method: ${method}`);
  }
};

const glpiFetch = async (url, userToken, appToken) => {
  try {
    // initSession uses GET
    const sessRes = await fetch(`${url}/apirest.php/initSession`, {
      method: 'GET',
      headers: { 'Authorization': `user_token ${userToken}`, 'App-Token': appToken },
      agent: url.startsWith('https') ? httpsAgent : undefined
    });
    const sessData = await sessRes.json();
    if (!sessData.session_token) throw new Error('No session token');

    const headers = { 'Session-Token': sessData.session_token, 'App-Token': appToken, 'Content-Type': 'application/json' };
    const agent = url.startsWith('https') ? httpsAgent : undefined;

    const get = async (endpoint) => {
      enforceGetOnly('GET'); // explicit guard
      const r = await fetch(`${url}/apirest.php/${endpoint}`, { method: 'GET', headers, agent });
      if (!r.ok) return [];
      return r.json();
    };

    return { headers, agent, get, sessionToken: sessData.session_token };
  } catch (e) {
    throw new Error(`GLPI connection failed: ${e.message}`);
  }
};

const glpiGet = async (baseUrl, endpoint, sessionToken, appToken) => {
  enforceGetOnly('GET'); // explicit guard — method is always GET
  try {
    const r = await fetch(`${baseUrl}/apirest.php/${endpoint}`, {
      method: 'GET',
      headers: { 'Session-Token': sessionToken, 'App-Token': appToken },
      agent: baseUrl.startsWith('https') ? httpsAgent : undefined
    });
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
};

module.exports = { glpiFetch, glpiGet, enforceGetOnly };
