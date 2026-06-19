import { jsPDF } from 'jspdf';
import LOGO_B64 from './omds_logo_b64';

const PW = 210, PH = 297;
const ML = 19, MR = 16, MT = 20, MB = 14;
const CW = PW - ML - MR;
// OMDS brand palette
const NAVY      = [10,  14,  26];   // #0A0E1A  - main dark bg
const NAVY_CARD = [17,  29,  53];   // #111D35  - card / table header bg
const ACCENT    = [59,  130, 246];  // #3B82F6  - primary blue accent
const BORDER    = [28,  43,  74];   // #1C2B4A  - border / rule lines
const TEXT_LIGHT= [226, 232, 244];  // #E2E8F4  - light text on dark bg
const ROW_ALT   = [240, 245, 255];  // light blue tint for alternating rows
const GRAY      = [148, 163, 184];  // blue-gray for subtle lines / footer text
const FOOT_H    = MB + 10;

// HEADER / FOOTER -----------------------------------------------

function drawFirstPageHeader(doc, title, updatedAt, glpiId) {
  const hY = 7;
  try { doc.addImage('data:image/jpeg;base64,' + LOGO_B64, 'JPEG', ML, hY, 31, 8.4); } catch (e) {}

  const tx = ML + 42, tw = PW - MR - tx, rh = 6.2;
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);

  doc.setFillColor(...NAVY_CARD);
  doc.rect(tx, hY, tw, rh, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...TEXT_LIGHT);
  doc.text('SCOPE: OM Digital Solutions GmbH', tx + tw - 2, hY + 4.2, { align: 'right' });

  const leftW = tw * 0.48, labelW = tw * 0.32, valW = tw - leftW - labelW;
  const rows = [
    { label: 'Reference:', value: glpiId ? '#' + glpiId : '-' },
    { label: 'Effective Date:', value: updatedAt || '' },
    { label: 'Page:', value: '1 / 1' },
  ];
  rows.forEach((row, i) => {
    const ry = hY + rh + i * rh;
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.25);
    doc.setFillColor(...NAVY); doc.rect(tx, ry, leftW, rh, 'FD');
    doc.setFillColor(...NAVY); doc.rect(tx + leftW, ry, labelW, rh, 'FD');
    doc.setFillColor(...NAVY); doc.rect(tx + leftW + labelW, ry, valW, rh, 'FD');
    if (i === 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...ACCENT);
      doc.text(doc.splitTextToSize(title, leftW - 3)[0], tx + 2, ry + 4.2);
    }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(row.label, tx + leftW + 2, ry + 4.2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...TEXT_LIGHT);
    doc.text(row.value, tx + leftW + labelW + valW - 2, ry + 4.2, { align: 'right' });
  });

  return hY + rh * 4 + 5;
}

function drawRunningHeader(doc, title) {
  const hY = MT - 12, hH = 9.8;
  const c1 = 27, c2 = 34, c3 = CW - c1 - c2;
  doc.setFillColor(...NAVY); doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.rect(ML, hY, CW, hH, 'FD');
  doc.setDrawColor(...BORDER);
  doc.line(ML + c1, hY, ML + c1, hY + hH);
  doc.line(ML + c1 + c2, hY, ML + c1 + c2, hY + hH);
  try { doc.addImage('data:image/jpeg;base64,' + LOGO_B64, 'JPEG', ML + 2, hY + 1.5, 22, 6); } catch (e) {}
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...ACCENT);
  doc.text('IT', ML + c1 + c2 / 2, hY + hH / 2 + 1.5, { align: 'center' });
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8); doc.setTextColor(...TEXT_LIGHT);
  doc.text(doc.splitTextToSize(title, c3 - 4)[0], ML + c1 + c2 + c3 / 2, hY + hH / 2 + 1.5, { align: 'center' });
  return MT;
}

function drawFooter(doc, pageNum, totalPages) {
  const fy = PH - MB + 2;
  const label = 'Restricted use: IT department only. External disclosure prohibited.';
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text(label, PW / 2, fy, { align: 'center' });
  const startX = PW / 2 - doc.getTextWidth(label) / 2;
  const ruEnd = doc.getTextWidth('Restricted use');
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.2);
  doc.line(startX, fy + 0.6, startX + ruEnd, fy + 0.6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...ACCENT);
  doc.text(pageNum + ' / ' + totalPages, PW - MR, fy + 5, { align: 'right' });
}

// INLINE MARKDOWN CLEANER (does NOT collapse newlines) ----------

// Keep only Basic Latin through Latin Extended-B (U+0000-U+024F)
// — jsPDF Helvetica is Latin-only; strip emojis/icons/CJK/etc.
var NON_LATIN_RE = /[^\u0000-\u024F]/g;

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
    .replace(NON_LATIN_RE, '')
    .replace(/ +/g, ' ')
    .trim();
}

// Split raw markdown line into plain/link segments (preserves urls)
function parseSegments(line) {
  var segments = [];
  var linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  var last = 0, m;
  var clean = function(s) {
    return s
      .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ').replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1').replace(/`([^`]+)`/g, '$1')
      .replace(NON_LATIN_RE, '').replace(/ +/g, ' ').trim();
  };
  while ((m = linkRe.exec(line)) !== null) {
    if (m.index > last) segments.push({ type: 'text', text: clean(line.slice(last, m.index)) });
    segments.push({ type: 'link', text: clean(m[1]), url: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < line.length) segments.push({ type: 'text', text: clean(line.slice(last)) });
  return segments.filter(function(s) { return s.text; });
}

function parseTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(function(c) { return stripInline(c.trim()); });
}

function isSepRow(line) {
  return /^\|[\s\-:|]+\|/.test(line);
}

// CONTENT RENDERER ----------------------------------------------

function renderContent(doc, content, startY, title) {
  var y = startY;

  function newPage() {
    doc.addPage();
    y = drawRunningHeader(doc, title);
  }

  function checkPage(needed) {
    if (y + needed > PH - FOOT_H) newPage();
  }

  function renderTable(tableLines) {
    var headerCells = parseTableRow(tableLines[0]);
    var dataRows = tableLines
      .slice(1)
      .filter(function(l) { return !isSepRow(l) && l.trim() !== ''; })
      .map(parseTableRow);

    var cols = headerCells.length;
    if (cols === 0) return;

    var colW = cols === 2
      ? [CW * 0.38, CW * 0.62]
      : Array(cols).fill(CW / cols);

    var PAD = 2.5;
    var HDR_H = 7;

    checkPage(HDR_H + 8);
    doc.setFillColor(...NAVY_CARD);
    doc.setTextColor(...TEXT_LIGHT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    var x = ML;
    headerCells.forEach(function(cell, ci) {
      if (ci < colW.length) {
        doc.rect(x, y, colW[ci], HDR_H, 'FD');
        var cellText = doc.splitTextToSize(cell, colW[ci] - PAD * 2)[0] || '';
        if (cellText) doc.text(cellText, x + PAD, y + 4.8);
        x += colW[ci];
      }
    });
    y += HDR_H;

    dataRows.forEach(function(row, ri) {
      doc.setFontSize(8.5);
      var maxLines = 1;
      row.forEach(function(cell, ci) {
        if (ci < colW.length) {
          maxLines = Math.max(maxLines, doc.splitTextToSize(cell, colW[ci] - PAD * 2).length);
        }
      });
      var rowH = Math.max(6, maxLines * 4.5 + PAD * 2);

      checkPage(rowH + 2);
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.25);
      x = ML;
      row.forEach(function(cell, ci) {
        if (ci >= colW.length) return;
        if (ri % 2 === 0) doc.setFillColor(...ROW_ALT);
        else doc.setFillColor(255, 255, 255);
        doc.rect(x, y, colW[ci], rowH, 'FD');
        if (cols === 2 && ci === 0) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        } else {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        }
        doc.setTextColor(...NAVY);
        doc.splitTextToSize(cell, colW[ci] - PAD * 2).forEach(function(wl, li) {
          if (wl) doc.text(wl, x + PAD, y + PAD + 3.5 + li * 4.5);
        });
        x += colW[ci];
      });
      y += rowH;
    });
    y += 5;
  }

  // Render a raw markdown line with clickable link support
  function renderLineWithLinks(rawLine, startX, fontSize, lineH, maxW) {
    var segments = parseSegments(rawLine);
    var hasLinks = segments.some(function(s) { return s.type === 'link'; });

    if (!hasLinks) {
      // Fast path - plain text with word wrap
      var plain = segments.map(function(s) { return s.text; }).join(' ').trim();
      if (!plain) { y += lineH; return; }
      doc.setFontSize(fontSize); doc.setTextColor(...NAVY);
      doc.splitTextToSize(plain, maxW).forEach(function(wl) {
        if (!wl) return;
        checkPage(lineH); doc.text(wl, startX, y); y += lineH;
      });
      return;
    }

    // Segment-by-segment rendering with link annotations
    doc.setFont('helvetica', 'normal'); doc.setFontSize(fontSize);
    var cx = startX;
    var LINK_H = fontSize * 0.3528 + 1.5; // approx glyph height in mm

    for (var si = 0; si < segments.length; si++) {
      var seg = segments[si];
      if (!seg.text) continue;
      var isLink = seg.type === 'link';
      doc.setTextColor(...(isLink ? ACCENT : NAVY));

      var words = seg.text.split(/\s+/).filter(Boolean);
      for (var wi = 0; wi < words.length; wi++) {
        var prefix = cx > startX ? ' ' : '';
        var piece  = prefix + words[wi];
        var pw = doc.getTextWidth(piece);

        if (cx > startX && cx + pw > startX + maxW) {
          y += lineH; checkPage(lineH); cx = startX;
        }

        var draw = cx === startX ? words[wi] : piece;
        if (draw) doc.text(draw, cx, y);

        if (isLink && seg.url && draw) {
          var tw = doc.getTextWidth(draw);
          doc.setDrawColor(...ACCENT); doc.setLineWidth(0.15);
          doc.line(cx, y + 0.8, cx + tw, y + 0.8);
          try { doc.link(cx, y - LINK_H + 1, tw, LINK_H, { url: seg.url }); } catch (e) {}
        }

        cx += doc.getTextWidth(draw);
      }
      if (cx > startX) cx += doc.getTextWidth(' '); // inter-segment space
    }
    y += lineH;
  }

  // Walk lines one by one - never collapse across newlines
  var lines = content.split('\n');
  var i = 0;
  var LH = 5;

  while (i < lines.length) {
    var line = lines[i];

    // H2
    if (/^## /.test(line)) {
      checkPage(16);
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...NAVY);
      doc.text(stripInline(line.slice(3)), ML, y);
      y += 2;
      doc.setDrawColor(...ACCENT); doc.setLineWidth(0.7);
      doc.line(ML, y, ML + CW, y);
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.25);
      y += 5;
      i++; continue;
    }

    // H3
    if (/^### /.test(line)) {
      checkPage(12);
      y += 4;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...ACCENT);
      doc.text(stripInline(line.slice(4)), ML, y);
      y += 5; doc.setTextColor(0, 0, 0);
      i++; continue;
    }

    // H1
    if (/^# /.test(line)) {
      checkPage(16);
      y += 5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...NAVY);
      doc.text(stripInline(line.slice(2)), ML, y);
      y += 8; i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      checkPage(8);
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
      doc.line(ML, y, ML + CW, y);
      y += 5; i++; continue;
    }

    // Table block - collect all consecutive table lines
    if (/^\|/.test(line)) {
      var tableLines = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) renderTable(tableLines);
      continue;
    }

    // Code block
    if (/^```/.test(line)) {
      var codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      if (codeLines.length) {
        var bH = codeLines.length * 4.5 + 6;
        checkPage(bH + 4);
        doc.setFillColor(...ROW_ALT); doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
        doc.rect(ML, y - 1, CW, bH, 'FD');
        doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
        codeLines.forEach(function(cl) { if (cl) doc.text(cl.substring(0, 100), ML + 2, y + 3); y += 4.5; });
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
    var listMatch = line.match(/^(\s*)([-*+]|\d+\.) (.+)/);
    if (listMatch) {
      var indX = ML + Math.min(listMatch[1].length, 4) * 2;
      doc.setFont('helvetica', 'normal');
      checkPage(LH);
      renderLineWithLinks('- ' + listMatch[3], indX, 10, LH, CW - (indX - ML));
      i++; continue;
    }

    // Normal paragraph line
    if (line.trim()) {
      doc.setFont('helvetica', 'normal');
      checkPage(LH);
      renderLineWithLinks(line, ML, 10, LH, CW);
    }
    i++;
  }

  return y;
}

// MAIN EXPORT ---------------------------------------------------

export function generateKnowledgePDF(entry) {
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  var title     = entry.topic    || 'Knowledge Entry';
  var category  = (entry.category || '').toUpperCase();
  var source    = entry.source   || '';
  var tags      = (entry.tags    || []).join(' - ');
  var updatedAt = (entry.updatedAt || entry.glpiSyncedAt || '').substring(0, 10);
  var glpiId    = entry.glpiId   || entry.dataflowId || '';
  var content   = entry.content  || '';

  var y = drawFirstPageHeader(doc, title, updatedAt, glpiId);

  var meta = [category, source, glpiId ? 'GLPI #' + glpiId : '', tags].filter(Boolean).join('  -  ');
  if (meta) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(meta, ML, y);
    y += 6;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...NAVY);
  var titleLines = doc.splitTextToSize(title, CW);
  doc.text(titleLines, ML, y);
  y += titleLines.length * 7 + 2;

  if (updatedAt) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text('Last updated: ' + updatedAt, ML, y);
    y += 5;
  }

  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.5);
  doc.line(ML, y, ML + CW, y);
  y += 6;

  try {
    renderContent(doc, content, y, title);
  } catch (e) {
    console.error('PDF render error:', e);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(180, 0, 0);
    doc.text('Error rendering content. Please check the browser console.', ML, y + 10);
  }

  var total = doc.getNumberOfPages();
  for (var p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  var filename = 'ARIA_KB_' + title.replace(/[^a-z0-9]/gi, '_').substring(0, 50) + '.pdf';
  doc.save(filename);
}
