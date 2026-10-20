import { buildInvoicePrintHTML } from './invoicePrint';

// Renders an invoice, laid out exactly as it prints (A4 portrait), into a PDF in
// the browser and returns it as base64 (no data: prefix). html2canvas and jsPDF
// are loaded on demand so they don't weigh down the rest of the app. Pages are
// sliced from one tall image, so a long invoice becomes a multi-page PDF.
const PAGE_W_PX = 794; // A4 at 96 dpi, the width the print layout is designed for

const waitForImages = (doc) => Promise.all(
  [...doc.images].map(img => (img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })))
);

export const buildInvoicePdfBase64 = async (invoiceData) => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W_PX}px;height:1123px;border:0;visibility:hidden;`;
  document.body.appendChild(iframe);
  try {
    await new Promise((resolve) => {
      iframe.onload = resolve;
      iframe.srcdoc = buildInvoicePrintHTML(invoiceData, 'A4', 'portrait');
    });
    const doc = iframe.contentDocument;
    await waitForImages(doc);
    if (doc.fonts?.ready) await doc.fonts.ready;
    const target = doc.body;
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      width: PAGE_W_PX,
      windowWidth: PAGE_W_PX,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width; // full image height in mm at page width
    const sliceCanvasH = Math.floor((canvas.width * pageH) / pageW); // canvas pixels per PDF page

    if (imgH <= pageH + 0.5) {
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, Math.min(imgH, pageH));
    } else {
      for (let y = 0, page = 0; y < canvas.height; y += sliceCanvasH, page++) {
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = Math.min(sliceCanvasH, canvas.height - y);
        slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (slice.height * pageW) / slice.width);
      }
    }
    return pdf.output('datauristring').split(',')[1];
  } finally {
    iframe.remove();
  }
};

export const invoicePdfFilename = (invoice) =>
  `Invoice-${String(invoice?.invoice_number || invoice?.patient_name || 'copy').replace(/[^A-Za-z0-9-]+/g, '_')}.pdf`;
