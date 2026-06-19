const cron = require('node-cron');
const { driver } = require('./neo4j');
const fetch = require('node-fetch');

let liveJob    = null;
let nightlyJob = null;

const getConfig = async () => {
  const s = driver.session();
  try {
    const r = await s.run(`MATCH (c:PipelineConfig { id: 'default' }) RETURN c`);
    return r.records[0]?.get('c').properties || null;
  } finally {
    await s.close();
  }
};

const triggerTier = async (tier) => {
  const config = await getConfig();
  if (!config || config.enabled === false || config.enabled === 'false') return;
  const apiKey = process.env.ARIA_API_KEY || 'aria-dev';
  try {
    console.log(`[scheduler] triggering ${tier} pipeline`);
    const r = await fetch('http://localhost:4001/api/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-aria-key': apiKey },
      body: JSON.stringify({
        glpiUrl:   config.glpiUrl,
        userToken: config.glpiUserToken,
        appToken:  config.glpiAppToken,
        tier,
      }),
    });
    if (!r.ok) console.error(`[scheduler] ${tier} HTTP ${r.status}`);
    else console.log(`[scheduler] ${tier} completed`);
  } catch (e) {
    console.error(`[scheduler] ${tier} failed:`, e.message);
  }
};

const stopAll = () => {
  if (liveJob)    { liveJob.stop();    liveJob    = null; }
  if (nightlyJob) { nightlyJob.stop(); nightlyJob = null; }
};

const startScheduler = async () => {
  stopAll();
  const config = await getConfig();
  if (!config) { console.log('[scheduler] no config — inactive'); return; }
  if (config.enabled === false || config.enabled === 'false') { console.log('[scheduler] disabled'); return; }

  const liveMin = parseInt(config.liveIntervalMin, 10) || 5;
  liveJob = cron.schedule(`*/${liveMin} * * * *`, () => triggerTier('live'), { timezone: 'UTC' });
  console.log(`[scheduler] live every ${liveMin} min`);

  const [hh, mm] = (config.nightlyTime || '02:00').split(':').map(Number);
  nightlyJob = cron.schedule(`${mm} ${hh} * * *`, () => triggerTier('nightly'), { timezone: 'UTC' });
  console.log(`[scheduler] nightly at ${config.nightlyTime || '02:00'} UTC`);
};

module.exports = { startScheduler, stopAll, getConfig };
