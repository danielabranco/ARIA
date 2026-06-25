// Dataflow technical-documentation PDF generator.
// Builds the IBM Plex Sans design and downloads a PDF directly via html2canvas + jsPDF.

import { renderDivToPdf } from './pdfUtils';
import logoB64 from './omds_logo_b64';

// ─── markdown helpers ────────────────────────────────────────────────────────

function parseSection(content, heading) {
  const result = {};
  const lines = content.split('\n');
  let active = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === `### ${heading}`) { active = true; continue; }
    if (active && /^#{1,3} /.test(line)) break;
    if (!active || !line.startsWith('|') || line.startsWith('|---')) continue;
    const parts = line.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2 && parts[0] !== 'Field' && parts[0] !== 'VER' && parts[0] !== 'DATE') {
      result[parts[0]] = parts.slice(1).join('|').trim();
    }
  }
  return result;
}

function stripLink(s) { return (s || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim(); }

function fmtDate(d) {
  if (!d || d === '—') return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function today() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── color map ───────────────────────────────────────────────────────────────

const CLASS_COLOR = {
  'Public': '#3E7C5A',
  'Internal': '#0084B2',
  'Customer Confidential': '#C28A1E',
  'Restricted': '#B23A2E',
};

// ─── step generator ──────────────────────────────────────────────────────────

function buildSteps(src, dst, trigger, frequency, protocol, pattern, fromAuth, errorHandling, group) {
  const p = (s) => `<strong style="font-weight:500;">${s}</strong>`;
  const freq = frequency ? ` (${frequency.toLowerCase()})` : '';
  const trig = trigger ? trigger.toLowerCase() : 'trigger';
  const prot = protocol || 'data';
  const pat  = pattern  ? pattern.toLowerCase()  : 'message';
  const auth = fromAuth || 'API key';
  const err  = errorHandling || 'logging &amp; monitoring';
  const grp  = group || '';
  const isSync = /request.reply|synchronous/i.test(pattern || '');

  return [
    `A ${trig} event is raised in ${p(src)}${freq}.`,
    `${p(src)} sends a ${prot} ${pat} to the ${p(dst)} API, authenticated with ${auth}.`,
    isSync
      ? `${p(dst)} creates or updates the record and returns a synchronous reply.`
      : `${p(dst)} processes and stores the received data.`,
    `The outcome is captured by ${err}${grp ? `; failures are surfaced to ${p(grp)}` : ''}.`,
  ];
}

// ─── HTML template helpers ───────────────────────────────────────────────────

function section(num, sidebar, body) {
  return `
  <div style="display:flex;gap:28px;margin-top:${num === '01' ? 32 : 30}px;">
    <div style="width:120px;flex:none;">
      <div style="font-size:32px;font-weight:200;color:#0084B2;line-height:1;">${num}</div>
      <div style="font-size:10px;letter-spacing:.06em;color:#777;margin-top:8px;line-height:1.5;">${sidebar}</div>
    </div>
    <div style="flex:1;">${body}</div>
  </div>`;
}

function h2(label) {
  return `<h2 style="margin:0 0 12px;font-size:19px;font-weight:400;display:flex;align-items:center;gap:9px;"><span style="width:7px;height:7px;background:#0084B2;flex:none;display:inline-block;"></span>${label}</h2>`;
}

function kv(label, value, colorVal) {
  if (!value) return '';
  const v = colorVal ? `<span style="font-weight:500;color:${colorVal};">${value}</span>` : `<span style="font-weight:500;">${value}</span>`;
  return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EDF0F2;font-size:12.5px;"><span style="color:#777;font-weight:300;">${label}</span>${v}</div>`;
}

// ─── revision history builder ────────────────────────────────────────────────

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortVal(s, max) {
  const str = String(s || '');
  return str.length > max ? str.substring(0, max) + '…' : str;
}

function describeChange(l) {
  const action = l.linked_action;
  const field  = l.field || '';
  const oldV   = l.old_value || '';
  const newV   = l.new_value || '';

  // Item creation: no field, action=0, value contains "Add the Item"
  if (!field && !action && (newV === 'Add the Item' || oldV === 'Add the Item')) return 'Created';

  // Linked / unlinked sub-item (action > 0)
  if (action > 0) {
    const typeLabel = (l.itemtype_link || '')
      .replace(/Plugin\w+/g, s => s.replace('Plugin', '').replace(/([A-Z])/g, ' $1').trim())
      .replace(/^Dataflows ?/, '').trim() || '';
    const name  = newV || oldV;
    const short = shortVal(name, 50);
    const isAdd = [1, 12, 21, 23].includes(action);
    return `${isAdd ? 'Linked' : 'Unlinked'} ${typeLabel}${short ? ': ' + short : ''}`;
  }

  // Field update
  if (!field) {
    const msg = newV || oldV;
    return msg ? shortVal(msg, 70) : 'Updated';
  }

  if (!oldV && newV) return `${field}: set to "${shortVal(newV, 30)}"`;
  if (oldV && !newV) return `${field}: cleared`;
  if (oldV && newV)  return `${field}: "${shortVal(oldV, 22)}" → "${shortVal(newV, 22)}"`;
  return `${field} updated`;
}

function buildRevisionHistory(history) {
  if (!history || !history.length) {
    return `
      <tr>
        <td style="padding:9px 8px 9px 0;border-bottom:1px solid #EDF0F2;color:#B0B8BD;">—</td>
        <td style="padding:9px 8px;border-bottom:1px solid #EDF0F2;color:#B0B8BD;">—</td>
        <td style="padding:9px 8px;border-bottom:1px solid #EDF0F2;color:#B0B8BD;">—</td>
        <td style="padding:9px 0 9px 8px;border-bottom:1px solid #EDF0F2;color:#B0B8BD;font-style:italic;">History not yet available — open the dataflow panel first to load GLPI log data.</td>
      </tr>`;
  }

  // Group by calendar day + user; sort ascending (oldest = v1.0)
  const groups = {};
  for (const l of history) {
    const day  = String(l.date || '').substring(0, 10);
    const user = l.user || '—';
    const key  = `${day}__${user}`;
    if (!groups[key]) groups[key] = { date: day, user, entries: [] };
    groups[key].entries.push(l);
  }
  const sorted = Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));

  const rows = sorted.map((g, i) => {
    const ver = `${i + 1}.0`;
    const seen = new Set();
    const changes = g.entries
      .map(l => describeChange(l))
      .filter(s => { if (!s || seen.has(s)) return false; seen.add(s); return true; });
    const changeHtml = changes.map(c => `<div style="margin-bottom:2px;">${esc(c)}</div>`).join('');
    return `<tr>
      <td style="padding:9px 8px 9px 0;border-bottom:1px solid #EDF0F2;"><span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#0084B2;">${ver}</span></td>
      <td style="padding:9px 8px;border-bottom:1px solid #EDF0F2;white-space:nowrap;">${esc(fmtDate(g.date))}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #EDF0F2;white-space:nowrap;">${esc(g.user)}</td>
      <td style="padding:9px 0 9px 8px;border-bottom:1px solid #EDF0F2;font-size:11.5px;font-weight:300;">${changeHtml}</td>
    </tr>`;
  });

  rows.push(`<tr>
    <td style="padding:9px 8px 9px 0;font-family:'IBM Plex Mono',monospace;color:#B0B8BD;">—</td>
    <td style="padding:9px 8px;color:#B0B8BD;">—</td>
    <td style="padding:9px 8px;color:#B0B8BD;">—</td>
    <td style="padding:9px 0 9px 8px;color:#B0B8BD;font-style:italic;">Next revision…</td>
  </tr>`);

  return rows.join('');
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function generateDataflowPDF(entry, history = []) {
  const content  = entry.content || '';
  const gen      = parseSection(content, 'General');
  const flow     = parseSection(content, 'Flow');
  const tech     = parseSection(content, 'Technical');
  const own      = parseSection(content, 'Ownership');

  const glpiId   = String(entry.glpiId || gen['GLPI ID'] || '');
  const rawName  = entry.topic || gen['Name'] || '';
  const nm       = rawName.match(/^\[(.+?)\]\s*[-–→]+\s*\[(.+?)\](.*)/);
  const srcTag   = nm ? nm[1] : stripLink(gen['From'] || '');
  const dstTag   = nm ? nm[2] : stripLink(gen['To']   || '');
  const subtitle = nm ? nm[3].trim() : '';

  const status    = entry.dfStatus || gen['Status'] || '';
  const gdpr      = entry.dfGdpr   || gen['GDPR Level'] || '';
  const clrClass  = CLASS_COLOR[gdpr] || '#C28A1E';
  const indicator = gen['Indicator'] || '';
  const docGood   = entry.compliant === true || /good/i.test(indicator);

  const protocol  = tech['Protocol']      || '';
  const pattern   = tech['Pattern']       || '';
  const mode      = tech['Mode']          || '';
  const trigger   = tech['Trigger']       || '';
  const frequency = tech['Frequency']     || '';
  const complex   = tech['Complexity']    || '';
  const errHdl    = tech['Error Handling']|| '';
  const priority  = tech['Priority']      || '';

  const fromSys   = stripLink(gen['From'] || flow['From'] || srcTag);
  const toSys     = stripLink(gen['To']   || flow['To']   || dstTag);
  const fromAuth  = flow['From Auth'] || 'API Key Authentication';
  const toAuth    = flow['To Auth']   || 'API Key Authentication';
  const toExtUrl  = flow['To External URL'] || '';
  const destSaaS  = !!(toExtUrl || /zendesk|salesforce|hubspot|servicenow|freshdesk/i.test(dstTag));

  const owner     = own['Owner']         || '';
  const group     = own['Group']         || '';
  const suppGroup = own['Support Group'] || '';

  const flowGroup = gen['Flow Group']  || '';
  const lastMod   = gen['Last Modified']|| '';
  const lastSync  = gen['Last Synced'] || '';
  const entity    = 'OM Digital Solutions GmbH';

  const descMatch = content.match(/^> (.+)/m);
  const desc = descMatch ? descMatch[1].trim() : '';

  const steps = buildSteps(srcTag || fromSys, dstTag || toSys, trigger, frequency, protocol, pattern, fromAuth, errHdl, group);

  // ── HTML body div (no <html>/<head>/<body> wrapper) ───────────────────────

  const divHtml = `<div style="width:794px;background:#fff;font-family:'IBM Plex Sans',sans-serif;color:#1A1A1A;font-size:13px;line-height:1.6;padding:52px 56px 28px;">

  <!-- Masthead -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:1px solid #1A1A1A;">
    <img src="data:image/jpeg;base64,${logoB64}" alt="OM Digital Solutions" style="height:22px;">
    <div style="text-align:right;font-size:10px;color:#777;letter-spacing:.04em;line-height:1.5;">
      <div>DATA FLOW DOCUMENTATION</div>
      <div style="font-family:'IBM Plex Mono',monospace;color:#1A1A1A;">GLPI&nbsp;#${glpiId} · v1.0 · ${status.toUpperCase() || 'ACTIVE'}</div>
    </div>
  </div>

  <!-- Classification badges -->
  <div style="display:flex;align-items:center;gap:16px;margin-top:14px;font-size:10px;letter-spacing:.1em;font-weight:600;">
    <span style="display:flex;align-items:center;gap:8px;color:${clrClass};">
      <span style="width:8px;height:8px;background:${clrClass};border-radius:50%;flex:none;display:inline-block;"></span>
      ${(gdpr || 'CUSTOMER CONFIDENTIAL DATA').toUpperCase()}
    </span>
    <span style="display:flex;align-items:center;gap:8px;color:#B23A2E;">
      <span style="width:8px;height:8px;background:#B23A2E;border-radius:50%;flex:none;display:inline-block;"></span>
      IT DEPARTMENT ONLY — EXTERNAL DISCLOSURE PROHIBITED
    </span>
  </div>

  <!-- Title -->
  <h1 style="margin:18px 0 8px;font-size:29px;font-weight:300;line-height:1.15;letter-spacing:-.015em;">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:23px;color:#0084B2;font-weight:400;">[${srcTag}]</span>
    &#8594;
    <span style="font-family:'IBM Plex Mono',monospace;font-size:23px;color:#0084B2;font-weight:400;">[${dstTag}]</span>
    ${subtitle ? `&nbsp;${subtitle}` : ''}
  </h1>
  ${desc ? `<p style="margin:0 0 4px;color:#5A6066;font-size:13.5px;max-width:580px;font-weight:300;">${desc}</p>` : ''}

  <!-- Metadata strip -->
  <div style="display:flex;flex-wrap:wrap;gap:0;margin-top:22px;border-top:1px solid #E2E7EA;border-bottom:1px solid #E2E7EA;">
    ${[
      ['SCOPE',     entity],
      ['VERSION',   'v1.0'],
      ['OWNER',     owner],
      ['GROUP',     group],
      ['EFFECTIVE', fmtDate(lastMod)],
      ['STATUS',    status],
    ].map(([lbl, val]) => `
    <div style="flex:1;min-width:80px;padding:10px 0;">
      <div style="font-size:9px;letter-spacing:.1em;color:#777;">${lbl}</div>
      <div style="font-size:12px;margin-top:2px;${lbl === 'STATUS' ? 'color:#3E7C5A;font-weight:500;' : lbl === 'VERSION' ? "font-family:'IBM Plex Mono',monospace;" : ''}">${val || '—'}</div>
    </div>`).join('')}
  </div>

  ${section('01',
    `GLPI&nbsp;ID <span style="font-family:'IBM Plex Mono',monospace;color:#0084B2;">${glpiId}</span>${flowGroup ? ` &middot; Flow group <strong style="color:#1A1A1A;">${flowGroup}</strong>` : ''}`,
    `${h2('Overview &amp; Scope')}
    <p style="margin:0 0 12px;font-weight:300;">${desc || `This dataflow propagates events from <strong style="font-weight:500;">${srcTag}</strong> to <strong style="font-weight:500;">${dstTag}</strong>, carrying ${gdpr || 'data'} and restricted to IT department use.`}</p>
    <div style="display:flex;gap:28px;">
      <div style="flex:1;">
        <div style="font-size:10px;letter-spacing:.08em;color:#0084B2;font-weight:600;margin-bottom:5px;">IN SCOPE</div>
        <div style="font-weight:300;font-size:12.5px;line-height:1.7;">${srcTag} &#8594; ${dstTag} direction${frequency ? ' &middot; ' + frequency.toLowerCase() + ' delta synchronisation' : ''}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:10px;letter-spacing:.08em;color:#777;font-weight:600;margin-bottom:5px;">DOCUMENTATION INDICATOR</div>
        <div style="font-weight:300;font-size:12.5px;line-height:1.7;"><span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${docGood ? '#3E7C5A' : '#C28A1E'};display:inline-block;"></span>${docGood ? 'Good documentation' : 'Needs review'}</span></div>
      </div>
    </div>`
  )}

  ${section('02',
    `Both endpoints authenticate with <strong style="color:#1A1A1A;">API keys</strong>.`,
    `${h2('System &amp; Actor Inventory')}
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px 6px 0;border-bottom:2px solid #1A1A1A;font-size:10px;letter-spacing:.06em;color:#777;font-weight:600;">SYSTEM</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:10px;letter-spacing:.06em;color:#777;font-weight:600;">ROLE</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:10px;letter-spacing:.06em;color:#777;font-weight:600;">AUTH</th>
        <th style="text-align:left;padding:6px 0 6px 8px;border-bottom:2px solid #1A1A1A;font-size:10px;letter-spacing:.06em;color:#777;font-weight:600;">CLASS.</th>
      </tr></thead>
      <tbody style="font-weight:300;">
        <tr>
          <td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;font-weight:500;">${srcTag}</td>
          <td style="padding:8px;border-bottom:1px solid #EDF0F2;color:#5A6066;">Source — system of record</td>
          <td style="padding:8px;border-bottom:1px solid #EDF0F2;">${fromAuth}</td>
          <td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;"><span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${clrClass};display:inline-block;"></span>${gdpr || 'Confidential'}</span></td>
        </tr>
        <tr>
          <td style="padding:8px 8px 8px 0;font-weight:500;">${dstTag}</td>
          <td style="padding:8px;color:#5A6066;">Destination${destSaaS ? ' — SaaS platform' : ''}</td>
          <td style="padding:8px;">${toAuth}</td>
          <td style="padding:8px 0 8px 8px;"><span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${clrClass};display:inline-block;"></span>${gdpr || 'Confidential'}</span></td>
        </tr>
      </tbody>
    </table>`
  )}

  ${section('03',
    `Left border = data classification. Dashed = third-party SaaS endpoint.`,
    `${h2('Data Flow Diagram')}
    <div style="display:flex;align-items:stretch;">
      <div style="flex:1;border:1px solid #E2E7EA;border-left:4px solid ${clrClass};border-radius:2px;padding:12px 14px;background:#fff;">
        <div style="font-size:9px;letter-spacing:.07em;color:#777;font-weight:600;">SOURCE · SYSTEM OF RECORD</div>
        <div style="font-weight:500;font-size:15px;margin-top:2px;">${srcTag}</div>
        <div style="font-size:10.5px;color:#5A6066;font-weight:300;margin-top:2px;">${fromAuth}</div>
      </div>
      <div style="width:150px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6px;">
        <div style="font-size:9px;color:#0084B2;font-family:'IBM Plex Mono',monospace;text-align:center;line-height:1.4;margin-bottom:3px;">${[protocol, pattern].filter(Boolean).join(' · ')}</div>
        <svg width="120" height="16" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="8" x2="110" y2="8" stroke="#0084B2" stroke-width="1.5"/><polygon points="120,8 110,3 110,13" fill="#0084B2"/></svg>
        <div style="font-size:9px;color:#777;font-family:'IBM Plex Mono',monospace;text-align:center;line-height:1.4;margin-top:3px;">${[frequency, mode, trigger].filter(Boolean).join(' · ')}</div>
      </div>
      <div style="flex:1;border:${destSaaS ? '1px dashed #99a2a8' : '1px solid #E2E7EA'};border-left:4px solid ${clrClass};border-radius:2px;padding:12px 14px;background:#fff;">
        <div style="font-size:9px;letter-spacing:.07em;color:#777;font-weight:600;">DESTINATION${destSaaS ? ' · SaaS PLATFORM' : ''}</div>
        <div style="font-weight:500;font-size:15px;margin-top:2px;">${dstTag}</div>
        <div style="font-size:10.5px;color:#5A6066;font-weight:300;margin-top:2px;">${toAuth}</div>
      </div>
    </div>
    <div style="margin-top:16px;padding-top:13px;border-top:1px solid #E2E7EA;">
      <div style="font-size:9px;letter-spacing:.1em;color:#777;font-weight:600;margin-bottom:9px;">COLOUR-CODING KEY — DATA CLASSIFICATION</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px 22px;font-size:11px;font-weight:300;">
        <span style="display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;background:#3E7C5A;border-radius:50%;flex:none;display:inline-block;"></span><strong style="font-weight:500;">Public</strong></span>
        <span style="display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;background:#0084B2;border-radius:50%;flex:none;display:inline-block;"></span><strong style="font-weight:500;">Internal</strong></span>
        <span style="display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;background:#C28A1E;border-radius:50%;flex:none;display:inline-block;"></span><strong style="font-weight:500;">Customer Confidential</strong></span>
        <span style="display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;background:#B23A2E;border-radius:50%;flex:none;display:inline-block;"></span><strong style="font-weight:500;">Restricted</strong></span>
        <span style="display:flex;align-items:center;gap:7px;"><span style="width:16px;height:10px;border:1px dashed #99a2a8;flex:none;display:inline-block;"></span>Third-party / SaaS endpoint</span>
      </div>
    </div>`
  )}

  ${section('04',
    `As recorded in ARIA / GLPI.`,
    `${h2('Technical Profile')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 28px;">
      ${kv('Protocol',       protocol)}
      ${kv('Pattern',        pattern)}
      ${kv('Mode',           mode)}
      ${kv('Trigger',        trigger)}
      ${kv('Frequency',      frequency)}
      ${kv('Complexity',     complex)}
      ${kv('Error handling', errHdl)}
      ${kv('Priority',       priority, priority === 'High' || priority === 'Critical' ? '#B23A2E' : '')}
    </div>`
  )}

  ${section('05',
    `Derived from the integration pattern.`,
    `${h2('Step-by-Step Flow')}
    <div style="display:flex;flex-direction:column;gap:0;font-size:12.5px;">
      ${steps.map((s, i) => `
      <div style="display:flex;gap:12px;padding:9px 0;${i < steps.length - 1 ? 'border-bottom:1px solid #EDF0F2;' : ''}">
        <span style="font-family:'IBM Plex Mono',monospace;color:#0084B2;flex:none;">${i + 1}</span>
        <span style="font-weight:300;">${s}</span>
      </div>`).join('')}
    </div>`
  )}

  ${section('06',
    `<strong style="color:#B23A2E;">Restricted &middot;</strong> IT department only.`,
    `${h2('Ownership &amp; Compliance')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 28px;">
      ${kv('Owner',         owner)}
      ${kv('Group',         group)}
      ${kv('Support group', suppGroup)}
      ${kv('GDPR level',    gdpr, clrClass)}
    </div>
    <div style="display:flex;gap:9px;margin-top:14px;padding:10px 13px;background:#fbeeec;border-radius:2px;font-size:11px;color:#5a322c;font-weight:300;">
      <span style="color:#B23A2E;font-weight:600;flex:none;">&#8594; Restricted use</span>
      <span>IT department only. External disclosure prohibited.${destSaaS ? ` ${dstTag} is a third-party SaaS endpoint receiving ${gdpr ? gdpr.toLowerCase() : 'confidential'} data.` : ''}</span>
    </div>`
  )}

  ${section('07',
    `Synced from ARIA / GLPI #${glpiId}.`,
    `${h2('Record &amp; Sync History')}
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <tbody style="font-weight:300;">
        <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;width:42%;">GLPI ID</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;font-family:'IBM Plex Mono',monospace;">${glpiId}</td></tr>
        <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">Last modified</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;">${fmtDate(lastMod)}</td></tr>
        <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">Last synced</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;">${fmtDate(lastSync)}</td></tr>
        <tr><td style="padding:8px 8px 8px 0;color:#777;">Document generated</td><td style="padding:8px 0 8px 8px;">${today()}</td></tr>
      </tbody>
    </table>`
  )}

  ${section('08',
    `Compiled from GLPI history log. One version per day &amp; editor — never overwrite prior entries.`,
    `${h2('Revision History')}
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px 6px 0;border-bottom:2px solid #1A1A1A;font-size:10px;letter-spacing:.06em;color:#777;font-weight:600;width:52px;">VER</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:10px;letter-spacing:.06em;color:#777;font-weight:600;width:100px;">DATE</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:10px;letter-spacing:.06em;color:#777;font-weight:600;width:130px;">BY</th>
        <th style="text-align:left;padding:6px 0 6px 8px;border-bottom:2px solid #1A1A1A;font-size:10px;letter-spacing:.06em;color:#777;font-weight:600;">CHANGE</th>
      </tr></thead>
      <tbody style="font-weight:300;">${buildRevisionHistory(history)}</tbody>
    </table>`
  )}

  <!-- Footer -->
  <div style="margin-top:38px;border-top:1px solid #1A1A1A;padding:12px 0 28px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#777;letter-spacing:.03em;">
    <span>&#169; OM Digital Solutions GmbH — Restricted use: IT department only. External disclosure prohibited.</span>
    <span style="font-family:'IBM Plex Mono',monospace;">GLPI&nbsp;#${glpiId} · ${srcTag}&#8594;${dstTag}</span>
  </div>

</div>`;

  await renderDivToPdf(divHtml, `ARIA_Dataflow_${glpiId || srcTag || 'document'}.pdf`);
}
