import { renderDivToPdf } from './pdfUtils';
import logoB64 from './omds_logo_b64';

// ─── helpers ────────────────────────────────────────────────────────────────

function parseSection(content, heading) {
  const lines = content.split('\n');
  const out = {};
  let inside = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === `### ${heading}`) { inside = true; continue; }
    if (inside && /^### /.test(t)) break;
    if (inside && t.startsWith('| ') && !t.startsWith('|---')) {
      const parts = t.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2 && parts[0] !== 'Field' && parts[0] !== 'Status') {
        out[parts[0]] = parts.slice(1).join('|').trim();
      }
    }
  }
  return out;
}

function blockquote(content) {
  const m = content.match(/^> (.+)/m);
  return m ? m[1].trim() : '';
}

function stripMdLink(s) {
  return (s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

// Component layer grouping
const LAYER_MAP = {
  PluginArchiswSwcomponent:               { label: 'APPLICATIONS',    color: '#0084B2', bg: '#F2F6F8', dashed: false },
  Computer:                                { label: 'INFRASTRUCTURE',  color: '#3E7C5A', bg: '#F0F7F3', dashed: false },
  NetworkEquipment:                        { label: 'INFRASTRUCTURE',  color: '#3E7C5A', bg: '#F0F7F3', dashed: false },
  Appliance:                               { label: 'INFRASTRUCTURE',  color: '#3E7C5A', bg: '#F0F7F3', dashed: false },
  Monitor:                                 { label: 'INFRASTRUCTURE',  color: '#3E7C5A', bg: '#F0F7F3', dashed: false },
  Software:                                { label: 'SOFTWARE / DATA', color: '#C28A1E', bg: '#FBF5EA', dashed: false },
  SoftwareVersion:                         { label: 'SOFTWARE / DATA', color: '#C28A1E', bg: '#FBF5EA', dashed: false },
  SoftwareLicense:                         { label: 'SOFTWARE / DATA', color: '#C28A1E', bg: '#FBF5EA', dashed: false },
  Database:                                { label: 'SOFTWARE / DATA', color: '#C28A1E', bg: '#FBF5EA', dashed: false },
  Certificate:                             { label: 'SECURITY',        color: '#B23A2E', bg: '#FBEEEC', dashed: false },
  Contract:                                { label: 'EXTERNAL',        color: '#B23A2E', bg: '#FBEEEC', dashed: true  },
  Project:                                 { label: 'EXTERNAL',        color: '#B23A2E', bg: '#FBEEEC', dashed: true  },
  PluginArchibpTask:                       { label: 'EXTERNAL',        color: '#B23A2E', bg: '#FBEEEC', dashed: true  },
  PluginArchiDataDataelement:              { label: 'EXTERNAL',        color: '#B23A2E', bg: '#FBEEEC', dashed: true  },
  PluginGenericobjectApplicationdependency:{ label: 'EXTERNAL',        color: '#B23A2E', bg: '#FBEEEC', dashed: true  },
};

const CLASS_COLORS = {
  'Internal':              '#0084B2',
  'Public':                '#3E7C5A',
  'Customer Confidential': '#C28A1E',
  'Restricted':            '#B23A2E',
  'Confidential':          '#C28A1E',
};

// ─── HTML builders ──────────────────────────────────────────────────────────

function metaRow(label, value) {
  if (!value) return '';
  return `
    <div style="flex:1;min-width:90px;padding:10px 0;">
      <div style="font-size:9px;letter-spacing:.1em;color:#777;">${label}</div>
      <div style="font-size:12px;margin-top:2px;">${esc(value)}</div>
    </div>`;
}

function sectionHeader(num, note) {
  return `
    <div style="width:120px;flex:none;">
      <div style="font-size:32px;font-weight:200;color:#0084B2;line-height:1;">${num}</div>
      <div style="font-size:10px;letter-spacing:.06em;color:#777;margin-top:8px;line-height:1.5;">${note}</div>
    </div>`;
}

function h2(title) {
  return `<h2 style="margin:0 0 12px;font-size:19px;font-weight:400;display:flex;align-items:center;gap:9px;">
    <span style="width:7px;height:7px;background:#0084B2;flex:none;display:inline-block;"></span>${title}</h2>`;
}

function kv(label, value, colorVal) {
  if (!value) return '';
  return `
    <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #EDF0F2;font-size:12.5px;">
      <span style="color:#777;font-weight:300;flex:none;">${esc(label)}</span>
      <span style="font-weight:500;text-align:right;${colorVal ? 'color:' + colorVal + ';' : ''}">${esc(value)}</span>
    </div>`;
}

function classDot(cls) {
  const c = CLASS_COLORS[cls] || '#0084B2';
  return `<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;"></span>${esc(cls)}</span>`;
}

// Section 02 — Architecture Diagram
function buildArchDiagram(associatedItems, glpiId) {
  if (!associatedItems || associatedItems.length === 0) {
    return `<div style="padding:20px 0;font-size:12.5px;color:#777;font-weight:300;font-style:italic;">
      No components registered in GLPI for this application. Run the Associated Items pipeline stage to populate.
    </div>`;
  }

  const layers = {};
  for (const item of associatedItems) {
    const layerDef = LAYER_MAP[item.itemtype];
    if (!layerDef) continue;
    if (!layers[layerDef.label]) layers[layerDef.label] = { ...layerDef, items: [] };
    layers[layerDef.label].items.push(item);
  }

  const layerOrder = ['APPLICATIONS', 'INFRASTRUCTURE', 'SOFTWARE / DATA', 'SECURITY', 'EXTERNAL'];
  let refCounter = 0;
  let html = '';

  for (const lbl of layerOrder) {
    const layer = layers[lbl];
    if (!layer || !layer.items.length) continue;
    const border = layer.dashed ? `border:1px dashed #99a2a8` : `border:1px solid #E2E7EA`;
    const sideBorder = layer.dashed ? `border-right:1px dashed #99a2a8` : `border-right:1px solid #E2E7EA`;
    const cards = layer.items.map(item => {
      refCounter++;
      const ref = `C${refCounter}`;
      const cardBorder = layer.dashed
        ? `border:1px dashed #99a2a8;border-top:3px solid ${layer.color};`
        : `border:1px solid #E2E7EA;border-top:3px solid ${layer.color};`;
      const roleText = item.role ? esc(item.role) : esc(item.itemtype.replace(/Plugin\w+/, '').replace(/([A-Z])/g, ' $1').trim());
      return `<div style="flex:1 1 120px;${cardBorder}border-radius:2px;padding:6px 9px;background:#fff;">
        <div style="font-size:8.5px;letter-spacing:.05em;color:${layer.color};font-weight:600;"><span style="font-family:'IBM Plex Mono',monospace;">${ref}</span> · ${esc(item.itemtype.replace('Plugin', '').replace(/([A-Z])/g, ' $1').trim().toUpperCase())}</div>
        <div style="font-weight:500;font-size:11.5px;margin-top:1px;">${esc(item.name)}</div>
        <div style="font-size:9.5px;color:#5A6066;font-weight:300;">${roleText}</div>
      </div>`;
    }).join('');

    html += `
    <div style="display:flex;${border};border-radius:2px;overflow:hidden;background:#fff;margin-bottom:4px;">
      <div style="width:30px;flex:none;background:${layer.bg};${sideBorder};display:flex;align-items:center;justify-content:center;">
        <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:8.5px;letter-spacing:.14em;color:${layer.color};font-weight:600;">${lbl}</span>
      </div>
      <div style="flex:1;padding:9px;display:flex;gap:8px;flex-wrap:wrap;">${cards}</div>
    </div>`;
  }

  if (!html) {
    return `<div style="padding:20px 0;font-size:12.5px;color:#777;font-weight:300;font-style:italic;">
      Associated items found but none map to a known architecture layer.
    </div>`;
  }

  return html + `
  <div style="margin-top:16px;padding-top:13px;border-top:1px solid #E2E7EA;">
    <div style="font-size:9px;letter-spacing:.1em;color:#777;font-weight:600;margin-bottom:9px;">COLOUR-CODING KEY — COMPONENT CLASS</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px 22px;font-size:11px;font-weight:300;">
      <span style="display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;background:#0084B2;border-radius:50%;flex:none;display:inline-block;"></span><strong style="font-weight:500;">Application</strong></span>
      <span style="display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;background:#3E7C5A;border-radius:50%;flex:none;display:inline-block;"></span><strong style="font-weight:500;">Infrastructure</strong></span>
      <span style="display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;background:#C28A1E;border-radius:50%;flex:none;display:inline-block;"></span><strong style="font-weight:500;">Software / Data</strong></span>
      <span style="display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;background:#B23A2E;border-radius:50%;flex:none;display:inline-block;"></span><strong style="font-weight:500;">Security / External</strong></span>
      <span style="display:flex;align-items:center;gap:7px;"><span style="width:16px;height:10px;border:1px dashed #99a2a8;flex:none;display:inline-block;"></span>Outside trust boundary</span>
    </div>
  </div>`;
}

// Section 03 — Component inventory table
function buildInventoryTable(associatedItems) {
  if (!associatedItems || associatedItems.length === 0) {
    return `<div style="font-size:12.5px;color:#777;font-weight:300;font-style:italic;">No components registered.</div>`;
  }

  let refCounter = 0;
  const rows = associatedItems
    .filter(item => LAYER_MAP[item.itemtype])
    .map(item => {
      refCounter++;
      const ref = `C${refCounter}`;
      const layerDef = LAYER_MAP[item.itemtype];
      const layer = layerDef ? layerDef.label : item.itemtype;
      const role = item.role || item.itemtype.replace('Plugin', '').replace(/([A-Z])/g, ' $1').trim();
      const cls = layerDef ? (layerDef.dashed ? 'External' : layerDef.label === 'APPLICATIONS' ? 'Internal' : layerDef.label === 'SECURITY' ? 'Restricted' : 'Internal') : 'Internal';
      const dotColor = CLASS_COLORS[cls] || '#0084B2';
      return `<tr>
        <td style="padding:7px 8px 7px 0;border-bottom:1px solid #EDF0F2;font-family:'IBM Plex Mono',monospace;color:#0084B2;">${ref}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #EDF0F2;font-weight:500;">${esc(item.name)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #EDF0F2;color:#5A6066;">${esc(layer.charAt(0) + layer.slice(1).toLowerCase().replace('software / data', 'Software/Data'))}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #EDF0F2;color:#5A6066;">${esc(role)}</td>
        <td style="padding:7px 0 7px 8px;border-bottom:1px solid #EDF0F2;"><span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;"></span>${esc(cls)}</span></td>
      </tr>`;
    }).join('');

  if (!rows) return `<div style="font-size:12.5px;color:#777;font-weight:300;font-style:italic;">No mapped components.</div>`;

  return `<table style="width:100%;border-collapse:collapse;font-size:11.5px;">
    <thead><tr>
      <th style="text-align:left;padding:6px 8px 6px 0;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">REF</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">COMPONENT / MODULE</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">LAYER</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">ROLE</th>
      <th style="text-align:left;padding:6px 0 6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">CLASS.</th>
    </tr></thead>
    <tbody style="font-weight:300;">${rows}</tbody>
  </table>`;
}

// Section 05 — Dependencies (linked dataflows)
function buildDepsTable(dataflows) {
  if (!dataflows || dataflows.length === 0) {
    return `<div style="font-size:12.5px;color:#777;font-weight:300;font-style:italic;">No dataflows linked in ARIA.</div>`;
  }
  const rows = dataflows.map(df => {
    const sLow = (df.status || '').toLowerCase();
    const active = sLow.includes('activ') || sLow.includes('use');
    const statusColor = active ? '#3E7C5A' : '#777';
    return `<tr>
      <td style="padding:7px 8px 7px 0;border-bottom:1px solid #EDF0F2;">${esc(df.name || `Dataflow #${df.id}`)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #EDF0F2;color:#5A6066;">Dataflow</td>
      <td style="padding:7px 8px;border-bottom:1px solid #EDF0F2;font-family:'IBM Plex Mono',monospace;color:#0084B2;">#${esc(df.id)}</td>
      <td style="padding:7px 0 7px 8px;border-bottom:1px solid #EDF0F2;color:${statusColor};font-weight:500;">${esc(df.status || '—')}</td>
    </tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr>
      <th style="text-align:left;padding:6px 8px 6px 0;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">DATAFLOW</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">TYPE</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">GLPI&nbsp;ID</th>
      <th style="text-align:left;padding:6px 0 6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">STATUS</th>
    </tr></thead>
    <tbody style="font-weight:300;">${rows}</tbody>
  </table>`;
}

// ─── main export ────────────────────────────────────────────────────────────

export async function generateApplicationPDF(entry, glpiData) {
  const content = entry.content || '';

  const general      = parseSection(content, 'General');
  const classif      = parseSection(content, 'Classification');
  const ownership    = parseSection(content, 'Ownership');
  const access       = parseSection(content, 'Access');

  const glpiId    = entry.glpiId || stripMdLink(general['GLPI ID']) || '';
  const name      = entry.topic || `Application #${glpiId}`;
  const desc      = blockquote(content);
  const status    = entry.dfStatus || general['Status'] || '';
  const gdpr      = entry.dfGdpr  || classif['Data Classification'] || 'Internal';
  const entity    = general['Entity'] || 'OM Digital Solutions';
  const dateMod   = general['Last Modified'] || '';
  const lastSync  = general['Last Synced'] || '';
  const appType   = classif['Type'] || '';
  const targets   = classif['Targets'] || '';
  const version   = classif['Version'] || 'v1.0';
  const sla       = classif['SLA'] || '';
  const devLang   = classif['Dev Language'] || '';
  const database  = classif['Database'] || '';
  const inUseSince = classif['In Use Since'] || '';
  const owner     = ownership['Owner Group'] || '';
  const supplier  = ownership['Supplier'] || '';
  const prodUrl   = stripMdLink(access['Production URL'] || '');
  const qaUrl     = stripMdLink(access['QA URL'] || '');
  const healthUrl = stripMdLink(access['Health Check'] || '');
  const repoUrl   = stripMdLink(access['Repository'] || '');

  const classColor = CLASS_COLORS[gdpr] || '#0084B2';
  const statusColor = (status.toLowerCase().includes('use') || status.toLowerCase().includes('activ')) ? '#3E7C5A' : '#777';

  const assocItems = (glpiData && glpiData.associatedItems) || [];
  const users      = (glpiData && glpiData.users)           || [];
  const dataflows  = (glpiData && glpiData.dataflows)       || [];

  const criticality = appType && appType.toLowerCase().includes('critical') ? 'Tier 1' : '';

  const docGenDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const divHtml = `<div style="width:794px;background:#fff;font-family:'IBM Plex Sans',sans-serif;color:#1A1A1A;font-size:13px;line-height:1.6;padding:52px 56px 28px;">

  <!-- Masthead -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:1px solid #1A1A1A;">
    <img src="data:image/jpeg;base64,${logoB64}" alt="OM Digital Solutions" style="height:22px;">
    <div style="text-align:right;font-size:10px;color:#777;letter-spacing:.04em;line-height:1.5;">
      <div>APPLICATION STRUCTURE RECORD</div>
      <div style="font-family:'IBM Plex Mono',monospace;color:#1A1A1A;">ARIA&nbsp;#${esc(glpiId)} · ${esc(version)} · ${esc(status.toUpperCase() || 'ACTIVE')}</div>
    </div>
  </div>

  <!-- Classification line -->
  <div style="display:flex;align-items:center;gap:16px;margin-top:14px;font-size:10px;letter-spacing:.1em;font-weight:600;">
    <span style="display:flex;align-items:center;gap:8px;color:${classColor};">
      <span style="width:8px;height:8px;background:${classColor};border-radius:50%;flex:none;display:inline-block;"></span>
      ${esc(gdpr.toUpperCase())} — ARCHITECTURE REFERENCE
    </span>
    ${criticality ? `<span style="display:flex;align-items:center;gap:8px;color:#B23A2E;"><span style="width:8px;height:8px;background:#B23A2E;border-radius:50%;flex:none;display:inline-block;"></span>${esc(criticality.toUpperCase())} — BUSINESS CRITICAL</span>` : ''}
  </div>

  <!-- Title -->
  <h1 style="margin:18px 0 8px;font-size:29px;font-weight:300;line-height:1.15;letter-spacing:-.015em;">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:23px;color:#0084B2;font-weight:400;">[${esc(name.replace(/^Application #\d+\s*—?\s*/i, ''))}]</span>
    &nbsp;<span style="color:#777;">/</span> Application Structure
  </h1>
  ${desc ? `<p style="margin:0 0 4px;color:#5A6066;font-size:13.5px;max-width:600px;font-weight:300;">${esc(desc)}</p>` : ''}

  <!-- Metadata strip -->
  <div style="display:flex;flex-wrap:wrap;gap:0;margin-top:22px;border-top:1px solid #E2E7EA;border-bottom:1px solid #E2E7EA;">
    ${metaRow('VERSION',     version)}
    ${metaRow('OWNER',       owner)}
    ${metaRow('GROUP',       owner)}
    ${metaRow('TYPE',        appType)}
    ${metaRow('ENTITY',      entity)}
    <div style="flex:1;min-width:80px;padding:10px 0;">
      <div style="font-size:9px;letter-spacing:.1em;color:#777;">STATUS</div>
      <div style="font-size:12px;margin-top:2px;color:${statusColor};font-weight:500;">${esc(status || 'Unknown')}</div>
    </div>
  </div>

  <!-- 01 Overview & Scope -->
  <div style="display:flex;gap:28px;margin-top:32px;">
    ${sectionHeader('01', `ARIA&nbsp;ID <span style="font-family:'IBM Plex Mono',monospace;color:#0084B2;">${esc(glpiId)}</span>${appType ? ` · <strong style="color:#1A1A1A;">${esc(appType)}</strong>` : ''}`)}
    <div style="flex:1;">
      ${h2('Overview &amp; Scope')}
      <p style="margin:0 0 12px;font-weight:300;">${desc ? esc(desc) : `Application <strong style="font-weight:500;">${esc(name)}</strong> registered in ARIA / GLPI.`}</p>
      <div style="display:flex;gap:28px;">
        <div style="flex:1;">
          <div style="font-size:10px;letter-spacing:.08em;color:#0084B2;font-weight:600;margin-bottom:5px;">IN SCOPE</div>
          <div style="font-weight:300;font-size:12.5px;line-height:1.7;">${esc(targets || appType || 'Application functionality as documented in GLPI.')}</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:10px;letter-spacing:.08em;color:#777;font-weight:600;margin-bottom:5px;">CLASSIFICATION</div>
          <div style="font-weight:300;font-size:12.5px;line-height:1.7;"><span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${classColor};display:inline-block;"></span>${esc(gdpr)}</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 02 Architecture Diagram -->
  <div style="display:flex;gap:28px;margin-top:30px;">
    ${sectionHeader('02', 'Top border = component class. Dashed = outside OMDS trust boundary.')}
    <div style="flex:1;">
      ${h2('Architecture Diagram')}
      ${buildArchDiagram(assocItems, glpiId)}
    </div>
  </div>

  <!-- 03 Component & Module Inventory -->
  <div style="display:flex;gap:28px;margin-top:30px;">
    ${sectionHeader('03', 'Stable refs <span style="font-family:\'IBM Plex Mono\',monospace;color:#0084B2;">C1–Cn</span> reused in the diagram &amp; dependency table.')}
    <div style="flex:1;">
      ${h2('Component &amp; Module Inventory')}
      ${buildInventoryTable(assocItems)}
    </div>
  </div>

  <!-- 04 Tech Stack & Runtime -->
  <div style="display:flex;gap:28px;margin-top:30px;">
    ${sectionHeader('04', 'As recorded in ARIA / GLPI.')}
    <div style="flex:1;">
      ${h2('Tech Stack &amp; Runtime')}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 28px;">
        ${kv('Version',       version)}
        ${kv('Dev language',  devLang)}
        ${kv('Database',      database)}
        ${kv('Type',          appType)}
        ${kv('SLA',           sla)}
        ${kv('In use since',  inUseSince)}
        ${kv('Supplier',      supplier)}
        ${kv('Status',        status, statusColor)}
        ${prodUrl ? kv('Production URL', prodUrl) : ''}
        ${repoUrl ? kv('Repository',     repoUrl) : ''}
        ${healthUrl ? kv('Health check', healthUrl) : ''}
        ${qaUrl ? kv('QA URL',          qaUrl) : ''}
      </div>
      ${!devLang && !database && !sla && !version ? '<div style="font-size:12.5px;color:#777;font-weight:300;font-style:italic;padding:4px 0;">Populate Type, Dev Language and SLA fields in GLPI to enrich this section.</div>' : ''}
    </div>
  </div>

  <!-- 05 Dependencies & Integrations -->
  <div style="display:flex;gap:28px;margin-top:30px;">
    ${sectionHeader('05', 'Dataflows where this application is source or destination.')}
    <div style="flex:1;">
      ${h2('Dependencies &amp; Integrations')}
      ${buildDepsTable(dataflows)}
    </div>
  </div>

  <!-- 06 Deployment & Hosting -->
  <div style="display:flex;gap:28px;margin-top:30px;">
    ${sectionHeader('06', 'As recorded in ARIA access fields.')}
    <div style="flex:1;">
      ${h2('Deployment &amp; Hosting')}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 28px;">
        ${kv('Entity',          entity)}
        ${kv('SLA',             sla)}
        ${kv('Production URL',  prodUrl)}
        ${kv('QA / staging URL',qaUrl)}
        ${kv('Health check',    healthUrl)}
        ${kv('Repository',      repoUrl)}
      </div>
      ${!prodUrl && !qaUrl && !healthUrl && !repoUrl ? `<div style="display:flex;gap:9px;margin-top:14px;padding:10px 13px;background:#E6F2F7;border-radius:2px;font-size:11px;color:#33474f;font-weight:300;"><span style="color:#0084B2;font-weight:600;flex:none;">&#8594; Note</span><span>Populate Production URL, Repository and Health Check fields in GLPI to enrich this section.</span></div>` : ''}
    </div>
  </div>

  <!-- 07 Ownership & Compliance -->
  <div style="display:flex;gap:28px;margin-top:30px;">
    ${sectionHeader('07', '<strong style="color:#B23A2E;">Restricted ·</strong> Architecture detail for IT &amp; Security only.')}
    <div style="flex:1;">
      ${h2('Ownership')}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 28px;">
        ${kv('Owner group',       owner)}
        ${kv('Supplier',          supplier)}
        ${kv('GDPR / Data class', gdpr, classColor)}
        ${kv('Type',              appType)}
        ${kv('SLA',               sla)}
      </div>
      ${users.length ? `
      <div style="margin-top:14px;">
        <div style="font-size:10px;letter-spacing:.08em;color:#777;font-weight:600;margin-bottom:8px;">ASSIGNED USERS</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${users.map(u => `<span style="font-size:11px;padding:3px 10px;border-radius:10px;background:#F2F6F8;border:1px solid #E2E7EA;font-weight:300;">${esc(u.name)}${u.role ? ` <span style="color:#777;">· ${esc(u.role)}</span>` : ''}</span>`).join('')}
        </div>
      </div>` : ''}
      <div style="display:flex;gap:9px;margin-top:14px;padding:10px 13px;background:#fbeeec;border-radius:2px;font-size:11px;color:#5a322c;font-weight:300;">
        <span style="color:#B23A2E;font-weight:600;flex:none;">&#8594; Restricted use</span>
        <span>Architecture detail is restricted to IT &amp; Security. External disclosure prohibited.</span>
      </div>
    </div>
  </div>

  <!-- 08 Versioning & History -->
  <div style="display:flex;gap:28px;margin-top:30px;">
    ${sectionHeader('08', `Synced from ARIA / GLPI #${esc(glpiId)}.`)}
    <div style="flex:1;">
      ${h2('Versioning &amp; History')}

      <div style="font-size:10px;letter-spacing:.08em;color:#777;font-weight:600;margin-bottom:8px;">VERSION RECORD</div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:22px;">
        <thead><tr>
          <th style="text-align:left;padding:6px 8px 6px 0;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;width:30%;">FIELD</th>
          <th style="text-align:left;padding:6px 0 6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">VALUE</th>
        </tr></thead>
        <tbody style="font-weight:300;">
          <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">ARIA ID</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;font-family:'IBM Plex Mono',monospace;color:#0084B2;">#${esc(glpiId)}</td></tr>
          <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">Current version</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;font-weight:500;">${esc(version)}</td></tr>
          <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">In use since</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;">${esc(inUseSince || '—')}</td></tr>
          <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">Status</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;font-weight:500;color:${statusColor};">${esc(status || '—')}</td></tr>
          <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">Status since</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;">${esc(general['Status Since'] || '—')}</td></tr>
          <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">Last modified</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;">${esc(dateMod || '—')}</td></tr>
          <tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #EDF0F2;color:#777;">Last synced</td><td style="padding:8px 0 8px 8px;border-bottom:1px solid #EDF0F2;">${esc(lastSync || '—')}</td></tr>
          <tr><td style="padding:8px 8px 8px 0;color:#777;">Document generated</td><td style="padding:8px 0 8px 8px;">${docGenDate}</td></tr>
        </tbody>
      </table>

      ${(() => {
        const tickets = (glpiData && glpiData.tickets) || [];
        const changes  = (glpiData && glpiData.changes)  || [];
        const rows = [
          ...changes.map(c => ({ type: 'Change',  id: c.id, name: c.name, status: c.status })),
          ...tickets.map(t => ({ type: 'Ticket',  id: t.id, name: t.name, status: t.status })),
        ];
        if (!rows.length) return `<div style="font-size:12.5px;color:#777;font-weight:300;font-style:italic;">No tickets or changes linked in ARIA.</div>`;
        const typeColor = t => t === 'Change' ? '#C28A1E' : '#0084B2';
        const rHtml = rows.map(r => `<tr>
          <td style="padding:7px 8px 7px 0;border-bottom:1px solid #EDF0F2;"><span style="font-size:9.5px;font-weight:600;padding:2px 7px;border-radius:9px;background:${typeColor(r.type)}20;color:${typeColor(r.type)};">${r.type}</span></td>
          <td style="padding:7px 8px;border-bottom:1px solid #EDF0F2;font-family:'IBM Plex Mono',monospace;color:#0084B2;font-size:11px;">#${esc(r.id)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #EDF0F2;font-weight:300;">${esc(r.name || '—')}</td>
          <td style="padding:7px 0 7px 8px;border-bottom:1px solid #EDF0F2;color:#5A6066;font-size:11.5px;">${esc(r.status || '—')}</td>
        </tr>`).join('');
        return `
        <div style="font-size:10px;letter-spacing:.08em;color:#777;font-weight:600;margin-bottom:8px;">CHANGE HISTORY</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>
            <th style="text-align:left;padding:6px 8px 6px 0;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">TYPE</th>
            <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">ID</th>
            <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">TITLE</th>
            <th style="text-align:left;padding:6px 0 6px 8px;border-bottom:2px solid #1A1A1A;font-size:9.5px;letter-spacing:.06em;color:#777;font-weight:600;">STATUS</th>
          </tr></thead>
          <tbody style="font-weight:300;">${rHtml}</tbody>
        </table>`;
      })()}
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:38px;border-top:1px solid #1A1A1A;padding:12px 0 28px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#777;letter-spacing:.03em;">
    <span>&#169; OM Digital Solutions GmbH — Restricted use: IT &amp; Architecture review only. External disclosure prohibited.</span>
    <span style="font-family:'IBM Plex Mono',monospace;">ARIA&nbsp;#${esc(glpiId)} · ${esc(version)} · ${esc(name.replace(/^Application #\d+\s*—?\s*/i, '').substring(0, 30))}</span>
  </div>

</div>`;

  await renderDivToPdf(divHtml, `ARIA_App_${glpiId || name.replace(/[^a-z0-9]/gi, '_').substring(0, 30) || 'document'}.pdf`);
}
