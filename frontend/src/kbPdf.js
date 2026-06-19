import { jsPDF } from 'jspdf';
import LOGO_B64 from './omds_logo_b64';

const PW = 210, PH = 297;
const ML = 19, MR = 16, MT = 20, MB = 14;
const CW = PW - ML - MR;
const GRAY = [166, 166, 166];
const FOOT_H = MB + 10;

// ── HEADER / FOOTER ──────────────────────────────────────────────────────────

function drawFirstPageHeader(doc, title, updatedAt, glpiId) {
  const hY = 7;
  try { doc.addImage('data:image/jpeg;base64,' + LOGO_B64, 'JPEG', ML, hY, 31, 8.4); } catch (e) {}

  const tx = ML + 42, tw = PW - MR - tx, rh = 6.2;
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);

  doc.rect(tx, hY, tw, rh);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
  doc.text('SCOPE: OM Digital Solutions GmbH', tx + tw - 2, hY + 4.2, { align: 'right' });

  const leftW = tw * 0.48, labelW = tw * 0.32, valW = tw - leftW - labelW;
  const rows = [
    { label: 'Reference:', value: glpiId ? `#${glpiId}` : '—' },
    { label: 'Effective Date:', value: updatedAt || '' },
    { label: 'Page:', value: '1 / 1' },
  ];
  rows.forEach((row, i) => {
    const ry = hY + rh + i * rh;
    doc.rect(tx, ry, leftW, rh);
    doc.rect(tx + leftW, ry, labelW, rh);
    doc.rect(tx + leftW + labelW, ry, valW, rh);
    if (i === 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text(doc.splitTextToSize(title, leftW - 3)[0], tx + 2, ry + 4.2);
    }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
    doc.text(row.label, tx + leftW + 2, ry + 4.2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text(row.value, tx + leftW + labelW + valW - 2, ry + 4.2, { align: 'right' });
  });

  return hY + rh * 4 + 5;
}

function drawRunningHeader(doc, title) {
  const hY = MT - 12, hH = 9.8;
  const c1 = 27, c2 = 34, c3 = CW - c1 - c2;
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);
  doc.rect(ML, hY, CW, hH);
  doc.line(ML + c1, hY, ML + c1, hY + hH);
  doc.line(ML + c1 + c2, hY, ML + c1 + c2, hY + hH);
  try { doc.addImage('data:image/jpeg;base64,' + LOGO_B64, 'JPEG', ML + 2, hY + 1.5, 22, 6); } catch (e) {}
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  doc.text('IT', ML + c1 + c2 / 2, hY + hH / 2 + 1.5, { align: 'center' });
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8);
  doc.text(doc.splitTextToSize(title, c3 - 4)[0], ML + c1 + c2 + c3 / 2, hY + hH / 2 + 1.5, { align: 'center' });
  return MT;
}

function drawFooter(doc, pageNum, totalPages) {
  const fy = PH - MB + 2;
  const label = 'Restricted use: IT department only. External disclosure prohibited.';
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
  doc.text(label, PW / 2, fy, { align: 'center' });
  const startX = PW / 2 - doc.getTextWidth(label) / 2;
  const ruEnd = doc.getTextWidth('Restricted use');
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
  doc.line(startX, fy + 0.6, startX + ruEnd, fy + 0.6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(`${pageNum} / ${totalPages}`, PW - MR, fy + 5, { align: 'right' });
}

// ── INLINE MARKDOWN CLEANER (does NOT collapse newlines) ─────────────────────

function stripInline(text) {
  return (text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/ +/g, ' ')
    .trim();
}

function parseTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => stripInline(c.trim()));
}

function isSepRow(line) {
  return /^\|[\s\-:|]+\|/.test(line);
}

// ── CONTENT RENDERER ─────────────────────────────────────────────────────────

function renderContent(doc, content, startY, title) {
  let y = startY;

  function newPage() {
    doc.addPage();
    y = drawRunningHeader(doc, title);
  }

  function checkPage(needed) {
    if (y + needed > PH - FOOT_H) newPage();
  }

  function renderTable(tableLines) {
    const headerCells = parseTableRow(tableLines[0]);
    const dataRows = tableLines
      .slice(1)
      .filter(l => !isSepRow(l) && l.trim() !== '')
      .map(parseTableRow);

    const cols = headerCells.length;
    if (cols === 0) return;

    const colW = cols === 2
      ? [CW * 0.38, CW * 0.62]
      : Array(cols).fill(CW / cols);

    const PAD = 2.5;
    const HDR_H = 7;

    checkPage(HDR_H + 8);
    doc.setFillColor(20, 30, 55);
    doc.setTextColor(220, 228, 244);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.25);
    let x = ML;
    headerCells.forEach((cell, ci) => {
      if (ci < colW.length) {
        doc.rect(x, y, colW[ci], HDR_H, 'FD');
        doc.text(doc.splitTextToSize(cell, colW[ci] - PAD * 2)[0] || '', x + PAD, y + 4.8);
        x += colW[ci];
      }
    });
    y += HDR_H;

    dataRows.forEach((row, ri) => {
      doc.setFontSize(8.5);
      let maxLines = 1;
      row.forEach((cell, ci) => {
        if (ci < colW.length) {
          maxLines = Math.max(maxLines, doc.splitTextToSize(cell, colW[ci] - PAD * 2).length);
        }
      });
      const rowH = Math.max(6, maxLines * 4.5 + PAD * 2);

      checkPage(rowH + 2);
      doc.setDrawColor(...GRAY); doc.setLineWidth(0.25);
      x = ML;
      row.forEach((cell, ci) => {
        if (ci >= colW.length) return;
        if (ri % 2 === 0) doc.setFillColor(247, 249, 252);
        else doc.setFillColor(255, 255, 255);
        doc.rect(x, y, colW[ci], rowH, 'FD');
        if (cols === 2 && ci === 0) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        } else {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        }
        doc.setTextColor(20, 20, 20);
        doc.splitTextToSize(cell, colW[ci] - PAD * 2).forEach((wl, li) => {
          doc.text(wl, x + PAD, y + PAD + 3.5 + li * 4.5);
        });
        x += colW[ci];
      });
      y += rowH;
    });
    y += 5;
  }

  // Walk lines one by one — never collapse across newlines
  const lines = content.split('\n');
  let i = 0;
  const LH = 5;

  while (i < lines.length) {
    const line = lines[i];

    // H2
    if (/^## /.test(line)) {
      checkPage(16);
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0, 0, 0);
      doc.text(stripInline(line.slice(3)), ML, y);
      y += 2;
      doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.7);
      doc.line(ML, y, ML + CW, y);
      doc.setDrawColor(...GRAY); doc.setLineWidth(0.25);
      y += 5;
      i++; continue;
    }

    // H3
    if (/^### /.test(line)) {
      checkPage(12);
      y += 4;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 90, 190);
      doc.text(stripInline(line.slice(4)), ML, y);
      y += 5; doc.setTextColor(0, 0, 0);
      i++; continue;
    }

    // H1
    if (/^# /.test(line)) {
      checkPage(16);
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
      doc.text(stripInline(line.slice(2)), ML, y);
      y += 8; i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      checkPage(8);
      doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);
      doc.line(ML, y, ML + CW, y);
      y += 5; i++; continue;
    }

    // Table block — collect all consecutive table lines
    if (/^\|/.test(line)) {
      const tableLines = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) renderTable(tableLines);
      continue;
    }

    // Code block
    if (/^```/.test(line)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      if (codeLines.length) {
        const bH = codeLines.length * 4.5 + 6;
        checkPage(bH + 4);
        doc.setFillColor(240, 242, 246); doc.setDrawColor(...GRAY); doc.setLineWidth(0.2);
        doc.rect(ML, y - 1, CW, bH, 'FD');
        doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
        codeLines.forEach(cl => { doc.text(cl.substring(0, 100), ML + 2, y + 3); y += 4.5; });
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
        y += 4;
      }
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      y += 2.5; i++; continue;
    }

    // List item
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.) (.+)/);
    if (listMatch) {
      const text = '• ' + stripInline(listMatch[3]);
      const indX = ML + Math.min(listMatch[1].length, 4) * 2;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.splitTextToSize(text, CW - (indX - ML)).forEach(wl => {
        checkPage(LH); doc.text(wl, indX, y); y += LH;
      });
      i++; continue;
    }

    // Normal paragraph line
    const text = stripInline(line);
    if (text) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.splitTextToSize(text, CW).forEach(wl => { checkPage(LH); doc.text(wl, ML, y); y += LH; });
    }
    i++;
  }

  return y;
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────

export function generateKnowledgePDF(entry) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const title     = entry.topic    || 'Knowledge Entry';
  const category  = (entry.category || '').toUpperCase();
  const source    = entry.source   || '';
  const tags      = (entry.tags    || []).join(' · ');
  const updatedAt = (entry.updatedAt || entry.glpiSyncedAt || '').substring(0, 10);
  const glpiId    = entry.glpiId   || entry.dataflowId || '';
  const content   = entry.content  || '';

  let y = drawFirstPageHeader(doc, title, updatedAt, glpiId);

  const meta = [category, source, glpiId ? `GLPI #${glpiId}` : '', tags].filter(Boolean).join('  ·  ');
  if (meta) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
    doc.text(meta, ML, y);
    y += 6;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
  const titleLines = doc.splitTextToSize(title, CW);
  doc.text(titleLines, ML, y);
  y += titleLines.length * 7 + 2;

  if (updatedAt) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text(`Last updated: ${updatedAt}`, ML, y);
    y += 5;
  }

  doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);
  doc.line(ML, y, ML + CW, y);
  y += 6;

  renderContent(doc, content, y, title);

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const filename = `ARIA_KB_${title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.pdf`;
  doc.save(filename);
}
