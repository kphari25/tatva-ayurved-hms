export const HOSPITAL = {
  name: 'Tatva Ayurved',
  tagline: 'Ayurveda for Health & Happiness',
  address: 'Thekkuveedu Lane, Kannur Road, Kozhikode',
  phone: '9895112264, 0495 2766717',
  website: 'www.tatvaayurved.com',
  regNo: 'BFHP03-C110100-00061-2025',
};

// The item's own GST rate (set directly, or via its GST Category in Add/Edit
// Medicine) — falls back to 5% for older items saved before GST categories
// existed, matching this app's previous flat-5% assumption.
export const gstPercentForItem = (item) => {
  const v = parseFloat(item?.gst_percentage);
  return Number.isFinite(v) ? v : 5;
};

// Sale price is the item's MRP (not purchase price) — MRP is tax-inclusive,
// so the price shown/billed per unit is MRP backed out to its GST-exclusive
// base: GST Amount = (MRP × GST Rate) ÷ (100 + GST Rate), Base Price = MRP −
// GST Amount. GST is added back on top per line when totals are calculated.
export const basePriceFromMRP = (item) => {
  const mrp = parseFloat(item?.MRP ?? item?.mrp) || 0;
  const gstPct = gstPercentForItem(item);
  const gstAmount = (mrp * gstPct) / (100 + gstPct);
  return Math.round((mrp - gstAmount) * 100) / 100;
};

// Module-level (not a component closure) so a saved bill can be reprinted
// from anywhere — e.g. clicking a bill number in Inventory's Sales History —
// without reopening the full Medicine Sale form.
export const buildMedicineSalePrintHTML = (saleData, pageSize = 'A4', orientation = 'portrait') => {
  // A5 is roughly half of A4 (148 x 210mm vs 210 x 297mm) — short bills
  // (a handful of items) fit comfortably on it, so margins shrink to match
  // rather than eating into the smaller page. .print-footer's fixed
  // left/right/bottom must track the same numbers so it still lines up
  // with the page's own margins once pinned to the bottom for print.
  const pageMargin = pageSize === 'A5' ? { v: '10mm', h: '8mm' } : { v: '15mm', h: '12mm' };
  const pageSizeRule = orientation === 'landscape' ? `${pageSize} landscape` : pageSize;
  const rowsHTML = saleData.items.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.name}</td>
        <td style="text-align:center">${r.quantity}</td>
        <td style="text-align:right">₹${parseFloat(r.rate).toFixed(2)}</td>
        <td style="text-align:center">${r.gst_percentage != null ? `${r.gst_percentage}%` : '—'}</td>
        <td style="text-align:right">₹${(r.quantity * r.rate).toFixed(2)}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Medicine Sale - ${saleData.bill_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; padding: 24px; color: #1a1a1a; }
    @page { size: ${pageSizeRule}; margin: ${pageMargin.v} ${pageMargin.h}; }
    /* Reserves room at the bottom of the printed page so normal-flow
       content (the items table, totals) doesn't run under the now-fixed
       print-footer below. */
    @media print { body { padding-bottom: 160px; } }
    .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 14px; margin-bottom: 18px; }
    .header h1 { color: #0d9488; font-size: 26px; margin: 8px 0 4px; }
    .header .tagline { color: #666; font-size: 12px; }
    .badge { display: inline-block; background: #0d9488; color: #fff; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 14px; }
    .info { display: flex; justify-content: space-between; margin-bottom: 18px; }
    .info-block { font-size: 13px; line-height: 1.8; }
    .info-block b { color: #0d9488; }
    .customer-line { font-size: 16px; font-weight: bold; }
    .customer-line b { font-size: 13px; }
    .mrd-line { font-size: 10px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th { background: #0d9488; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    td { border: 1px solid #ddd; padding: 7px 10px; font-size: 12px; }
    tr:nth-child(even) td { background: #f0fdfa; }
    .totals { float: right; width: 280px; page-break-inside: avoid; }
    .totals table { margin: 0; }
    .totals td { border: none; border-bottom: 1px solid #eee; padding: 5px 8px; }
    .totals .grand { background: #0d9488; color: #fff; font-size: 15px; font-weight: bold; }
    /* Signature/thank-you/address block, pinned to the bottom of the page
       when printed. Earlier this was suspected of causing blank printed
       pages and was switched to normal flow — the actual cause turned out
       to be the old window.open()+document.write() print path (now
       replaced with an iframe printed via its own contentWindow.print()),
       so it's safe to pin this again now that that's fixed. */
    .print-footer { margin-top: 50px; }
    @media print {
      .print-footer { position: fixed; left: ${pageMargin.h}; right: ${pageMargin.h}; bottom: ${pageMargin.v}; margin-top: 0; }
    }
    .sig-block { text-align: right; margin-bottom: 18px; }
    .sig-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; margin-left: auto; margin-bottom: 4px; }
    .sig-block .doctor-name { font-weight: bold; font-size: 12px; }
    .sig-block .reg { font-size: 10px; color: #555; }
    .thank-you { text-align: center; font-size: 11px; color: #888; margin-bottom: 10px; }
    .page-footer { text-align: center; font-size: 10px; color: #555; border-top: 1px solid #ddd; padding-top: 8px; }
    .footer-bar { height: 6px; background: #0d9488; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="/logo.png" alt="Tatva Ayurved" onerror="this.style.display='none'" style="height:70px;margin-bottom:6px">
    <h1>${HOSPITAL.name}</h1>
    <div class="tagline">${HOSPITAL.tagline}</div>
  </div>

  <div style="text-align:center;margin-bottom:14px">
    <span class="badge">MEDICINE SALE BILL</span>
  </div>

  <div class="info">
    <div class="info-block">
      <div class="customer-line"><b>Customer:</b> ${saleData.customer_name || 'Walk-in Customer'}</div>
      ${saleData.mrd_number ? `<div class="mrd-line"><b>MRD No:</b> ${saleData.mrd_number}</div>` : ''}
      ${saleData.phone ? `<div><b>Phone:</b> ${saleData.phone}</div>` : ''}
    </div>
    <div class="info-block" style="text-align:right">
      <div><b>Bill No:</b> ${saleData.bill_number}</div>
      <div><b>Date:</b> ${new Date(saleData.sale_date).toLocaleDateString('en-IN')}</div>
      <div><b>Payment:</b> ${saleData.payment_mode}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Medicine</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Price (₹)</th>
        <th style="text-align:center">GST</th>
        <th style="text-align:right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>

  <div class="totals">
    <table>
      ${saleData.cgst_amount != null ? `
      <tr><td>Taxable Amount</td><td style="text-align:right">₹${(saleData.taxable_amount ?? saleData.subtotal).toFixed(2)}</td></tr>
      <tr><td>CGST</td><td style="text-align:right">₹${saleData.cgst_amount.toFixed(2)}</td></tr>
      <tr><td>SGST</td><td style="text-align:right">₹${saleData.sgst_amount.toFixed(2)}</td></tr>
      ` : `
      <tr><td>Subtotal</td><td style="text-align:right">₹${saleData.subtotal.toFixed(2)}</td></tr>
      ${saleData.gst_percentage > 0 ? `<tr><td>GST (${saleData.gst_percentage}%)</td><td style="text-align:right">₹${saleData.gst_amount.toFixed(2)}</td></tr>` : ''}
      `}
      ${saleData.discount > 0 ? `<tr><td style="color:red">Discount${saleData.discount_percentage ? ` (${saleData.discount_percentage}%)` : ''}</td><td style="text-align:right;color:red">-₹${saleData.discount.toFixed(2)}</td></tr>` : ''}
      ${saleData.round_off ? `<tr><td>Round Off</td><td style="text-align:right">${saleData.round_off > 0 ? '+' : '-'}₹${Math.abs(saleData.round_off).toFixed(2)}</td></tr>` : ''}
      <tr class="grand"><td>TOTAL</td><td style="text-align:right">₹${saleData.total_amount.toFixed(2)}</td></tr>
    </table>
  </div>

  <div style="clear:both"></div>
  ${saleData.notes ? `<div style="margin-top:16px"><b>Notes:</b> ${saleData.notes}</div>` : ''}

  <div class="print-footer">
    <div class="sig-block">
      <div class="sig-line"></div>
      <p class="reg">Cashier</p>
    </div>
    <div class="thank-you">
      <p>Thank you for choosing ${HOSPITAL.name}!</p>
    </div>
    <div class="page-footer">
      ${HOSPITAL.address} &nbsp;|&nbsp; ${HOSPITAL.phone} &nbsp;|&nbsp; ${HOSPITAL.website}<br>
      Reg No: ${HOSPITAL.regNo}
    </div>
    <div class="footer-bar"></div>
  </div>
</body>
</html>`;
};
