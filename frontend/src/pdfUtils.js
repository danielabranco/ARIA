import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

let fontInjected = false;

async function ensureIbmFont() {
  if (fontInjected) return;
  fontInjected = true;
  if (!document.getElementById('aria-pdf-ibm-font')) {
    const link = document.createElement('link');
    link.id = 'aria-pdf-ibm-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }
  try { await document.fonts.ready; } catch (_) {}
  // Give fonts 600ms to apply to newly-added DOM nodes
  await new Promise(r => setTimeout(r, 600));
}

// Renders a div HTML string to a multi-page A4 PDF and triggers browser download.
export async function renderDivToPdf(divHtml, filename) {
  await ensureIbmFont();

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;overflow:visible;pointer-events:none;';
  wrap.innerHTML = divHtml;
  document.body.appendChild(wrap);

  const el = wrap.firstElementChild;
  if (!el) { document.body.removeChild(wrap); return; }

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      windowWidth: 794,
    });

    const A4_W = 210; // mm
    const A4_H = 297; // mm
    // How many canvas pixels fit in one A4 page height at this width scale
    const pageHeightPx = Math.floor(canvas.width * (A4_H / A4_W));

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    let srcY = 0;
    let page = 0;
    while (srcY < canvas.height) {
      if (page > 0) pdf.addPage();
      page++;

      const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
      const sc = document.createElement('canvas');
      sc.width = canvas.width;
      sc.height = sliceH;
      sc.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const sliceMmH = sliceH * (A4_W / canvas.width);
      pdf.addImage(sc.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4_W, sliceMmH);
      srcY += sliceH;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(wrap);
  }
}
