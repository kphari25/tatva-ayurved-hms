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
export const buildMedicineSalePrintHTML = (saleData, doctorInfo = {}) => {
  const rowsHTML = saleData.items.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.item_code ? `<strong>${r.item_code}</strong><br><small>${r.name}</small>` : r.name}</td>
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
    @page { size: A4; margin: 15mm 12mm; }
    .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 14px; margin-bottom: 18px; }
    .header h1 { color: #0d9488; font-size: 26px; margin: 8px 0 4px; }
    .header .tagline { color: #666; font-size: 12px; }
    .badge { display: inline-block; background: #0d9488; color: #fff; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 14px; }
    .info { display: flex; justify-content: space-between; margin-bottom: 18px; }
    .info-block { font-size: 13px; line-height: 1.8; }
    .info-block b { color: #0d9488; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th { background: #0d9488; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    td { border: 1px solid #ddd; padding: 7px 10px; font-size: 12px; }
    tr:nth-child(even) td { background: #f0fdfa; }
    .totals { float: right; width: 280px; page-break-inside: avoid; }
    .totals table { margin: 0; }
    .totals td { border: none; border-bottom: 1px solid #eee; padding: 5px 8px; }
    .totals .grand { background: #0d9488; color: #fff; font-size: 15px; font-weight: bold; }
    /* Signature/thank-you/address block. This used to be position: fixed
       in print so it pinned to the bottom of the page — but a fixed element
       is positioned against the page box on every page it's printed on, and
       on a bill long enough to spill onto a second page that can push the
       block (and everything printed after it, however little) onto a blank-
       looking trailing page, or overlap the last row of the items table.
       Keeping it in normal flow avoids both failure modes at the cost of it
       no longer being pinned to the very bottom of the last page. */
    .print-footer { margin-top: 50px; page-break-inside: avoid; }
    .sig-block { text-align: right; margin-bottom: 18px; }
    .sig-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; margin-left: auto; margin-bottom: 4px; }
    .sig-block .doctor-name { font-weight: bold; font-size: 12px; }
    .sig-block .reg { font-size: 10px; color: #555; }
    .thank-you { text-align: center; font-size: 11px; color: #888; margin-bottom: 10px; }
    .page-footer { text-align: center; font-size: 10px; color: #555; border-top: 1px solid #ddd; padding-top: 8px; }
    .footer-bar { height: 6px; background: #0d9488; margin-top: 10px; }
    @media print { button { display: none; } }
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
      <div><b>Customer:</b> ${saleData.customer_name || 'Walk-in Customer'}</div>
      ${saleData.mrd_number ? `<div><b>MRD No:</b> ${saleData.mrd_number}</div>` : ''}
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
      ${saleData.discount > 0 ? `<tr><td style="color:red">Discount</td><td style="text-align:right;color:red">-₹${saleData.discount.toFixed(2)}</td></tr>` : ''}
      <tr class="grand"><td>TOTAL</td><td style="text-align:right">₹${saleData.total_amount.toFixed(2)}</td></tr>
    </table>
  </div>

  <div style="clear:both"></div>
  ${saleData.notes ? `<div style="margin-top:16px"><b>Notes:</b> ${saleData.notes}</div>` : ''}

  <div style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="padding:10px 30px;background:#0d9488;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer">🖨️ Print Bill</button>
  </div>

  <div class="print-footer">
    <div class="sig-block">
      <div class="sig-line"></div>
      ${doctorInfo.name ? `<p class="doctor-name">Dr. ${doctorInfo.name}</p>` : ''}
      ${doctorInfo.qualification ? `<p class="reg">${doctorInfo.qualification}</p>` : ''}
      ${doctorInfo.registrationNumber ? `<p class="reg">Reg No: ${doctorInfo.registrationNumber}</p>` : ''}
      <p class="reg">Signature</p>
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
