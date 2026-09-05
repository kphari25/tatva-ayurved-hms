export const HOSPITAL = {
  name: 'Tatva Ayurved',
  tagline: 'Ayurveda for Health & Happiness',
  address: 'Thekkuveedu Lane, Kannur Road, Kozhikode',
  phone: '9895112264, 0495 2766717',
  website: 'www.tatvaayurved.com',
  regNo: 'BFHP03-C110100-00061-2025',
};

// Module-level (not a component closure) so the printed markup is reusable
// wherever an invoice needs reprinting, same reasoning as
// buildMedicineSalePrintHTML in medicineSalePrint.js — and rendered the same
// way, via an in-page iframe printed through its own contentWindow.print(),
// instead of window.open()+document.write() (unreliable across Chrome/Safari;
// see medicineSalePrint.js's print-footer comment for the history).
// A5 is roughly half of A4 (148 x 210mm vs 210 x 297mm) — a short invoice
// (registration/consultation fee only, a couple of line items) fits on it,
// so margins shrink to match rather than eating into the smaller page. A
// long IP invoice with room rent/mess/many line items may still spill onto
// a second page on A5 — that's expected, same tradeoff as any short-vs-long
// document choosing a smaller page.
const pageMarginFor = (pageSize) => (pageSize === 'A5' ? { v: '10mm', h: '8mm' } : { v: '15mm', h: '12mm' });

export const buildInvoicePrintHTML = (data, doctorInfo = {}, pageSize = 'A4') => {
  const pageMargin = pageMarginFor(pageSize);
  return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${data.invoice_number || data.patient_name || data.mrd_number || data.patient_number}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 10px 20px; font-size: 12px; padding-bottom: 190px; }
    @page { size: ${pageSize}; margin: ${pageMargin.v} ${pageMargin.h}; }
    .header { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 12px; border-bottom: 2px solid #14b8a6; padding-bottom: 8px; }
    .header img { height: 42px; }
    .header-text { text-align: left; }
    .header h1 { color: #14b8a6; margin: 0; font-size: 18px; }
    .header .tagline { color: #666; font-size: 10px; margin: 1px 0; }
    .info { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .info-box { flex: 1; }
    .info-box h3 { margin: 0 0 6px 0; color: #14b8a6; font-size: 13px; }
    .info-box p { margin: 2px 0; }
    .badge { display: inline-block; padding: 4px 14px; background: #14b8a6; color: white; border-radius: 5px; font-weight: bold; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #14b8a6; color: white; }
    .totals { float: right; width: 280px; margin-top: 12px; }
    .totals table { margin: 0; }
    .totals .grand-total { background: #14b8a6; color: white; font-weight: bold; font-size: 15px; }
    /* Doctor signature + thank-you note + hospital address stay pinned to
       the bottom of the printed page, same treatment as the prescription
       and medicine-sale printouts. */
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
    .footer-bar { height: 6px; background: #14b8a6; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="/logo.png" alt="Tatva Ayurved" onerror="this.style.display='none'">
    <div class="header-text">
      <h1>${HOSPITAL.name}</h1>
      <p class="tagline">${HOSPITAL.tagline}</p>
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 20px;">
    <span class="badge">${data.invoice_type === 'OP' ? 'OUT PATIENT (O/P)' : 'IN PATIENT (I/P)'}</span>
  </div>

  <div class="info">
    <div class="info-box">
      <h3>Patient Details:</h3>
      <p><strong>Name:</strong> ${data.patient_name}</p>
      ${data.ip_number ? `<p><strong>IP No:</strong> ${data.ip_number}</p>` : ''}
      <p><strong>Phone:</strong> ${data.patient_phone || 'N/A'}</p>
      <p><strong>Address:</strong> ${data.patient_address || 'N/A'}</p>
    </div>
    <div class="info-box" style="text-align: right;">
      <h3>Invoice Details:</h3>
      ${data.invoice_number ? `<p><strong>Invoice No:</strong> ${data.invoice_number}</p>` : ''}
      <p><strong>Date:</strong> ${new Date(data.invoice_date).toLocaleDateString()}</p>
      <p><strong>Invoice Type:</strong> ${data.invoice_type}</p>
      ${data.invoice_type === 'IP' && data.admission_date ? `<p><strong>Admission Date:</strong> ${new Date(data.admission_date).toLocaleDateString()}</p>` : ''}
      ${data.invoice_type === 'IP' && data.discharge_date ? `<p><strong>Discharge Date:</strong> ${new Date(data.discharge_date).toLocaleDateString()}</p>` : ''}
      <p><strong>Payment Mode:</strong> ${data.payment_mode}</p>
    </div>
  </div>

  <h3>Charges Breakdown:</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantity/Days</th>
        <th>Rate (₹)</th>
        <th>Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${data.registration_fee > 0 ? `
        <tr style="background:#f0fdfa;">
          <td><strong>Registration Fee</strong>${data.reg_fee_already_paid ? ' <span style="font-size:10px;color:#0d9488;font-style:italic;">(already paid at registration)</span>' : ''}</td>
          <td>-</td>
          <td>-</td>
          <td>₹${data.registration_fee.toFixed(2)}</td>
        </tr>
      ` : ''}
      ${(data.consultation_fees || 0) > 0 ? `
        <tr style="background:#f0fdfa;">
          <td><strong>Consultation Fee</strong></td>
          <td>-</td>
          <td>-</td>
          <td>₹${data.consultation_fees.toFixed(2)}</td>
        </tr>
      ` : ''}
      ${(data.treatment_items && data.treatment_items.length > 0) ? `
        <tr>
          <td>Treatments</td>
          <td>-</td>
          <td>-</td>
          <td>₹${data.treatment_items.reduce((sum, item) => sum + (Number(item.price) || 0), 0).toFixed(2)}</td>
        </tr>
      ` : ''}
      ${(data.medicines_total || 0) > 0 ? `
        <tr>
          <td>Medicines Administered</td>
          <td>-</td>
          <td>-</td>
          <td>₹${data.medicines_total.toFixed(2)}</td>
        </tr>
      ` : ''}
      ${(data.additional_charges && data.additional_charges.length > 0) ? data.additional_charges.map(charge => `
        <tr>
          <td>${charge.label || 'Additional Charge'}</td>
          <td>-</td>
          <td>-</td>
          <td>₹${Number(charge.amount || 0).toFixed(2)}</td>
        </tr>
      `).join('') : ''}
      ${(!data.treatment_items?.length && !data.additional_charges?.length && !(data.medicines_total > 0) && data.treatment_charges > 0) ? `
        <tr>
          <td>Treatment Charges</td>
          <td>-</td>
          <td>-</td>
          <td>₹${data.treatment_charges.toFixed(2)}</td>
        </tr>
      ` : ''}
      ${(data.nursing_fees || 0) > 0 ? `
        <tr>
          <td>Nursing Fees</td>
          <td>-</td>
          <td>-</td>
          <td>₹${data.nursing_fees.toFixed(2)}</td>
        </tr>
      ` : ''}
      ${(data.doctor_fees || 0) > 0 ? `
        <tr>
          <td>Doctor's Fees</td>
          <td>-</td>
          <td>-</td>
          <td>₹${data.doctor_fees.toFixed(2)}</td>
        </tr>
      ` : ''}
      ${(data.lab_test_charges || 0) > 0 ? `
        <tr>
          <td>Lab Test Charges</td>
          <td>-</td>
          <td>-</td>
          <td>₹${data.lab_test_charges.toFixed(2)}</td>
        </tr>
      ` : ''}

      ${data.invoice_type === 'IP' && data.room_rent > 0 ? `
        <tr>
          <td>Room Rent (${data.room_type})</td>
          <td>${data.days} days</td>
          <td>₹${data.room_rent.toFixed(2)}</td>
          <td>₹${(data.room_rent * data.days).toFixed(2)}</td>
        </tr>
      ` : ''}

      ${data.invoice_type === 'IP' && data.patient_mess_per_day > 0 ? `
        <tr>
          <td>Mess Charges - Patient</td>
          <td>${data.mess_days} days</td>
          <td>₹${data.patient_mess_per_day.toFixed(2)}</td>
          <td>₹${(data.patient_mess_per_day * data.mess_days).toFixed(2)}</td>
        </tr>
      ` : ''}
      ${data.invoice_type === 'IP' && data.bystander_mess_per_day > 0 ? `
        <tr>
          <td>Mess Charges - Bystander</td>
          <td>${data.mess_days} days</td>
          <td>₹${data.bystander_mess_per_day.toFixed(2)}</td>
          <td>₹${(data.bystander_mess_per_day * data.mess_days).toFixed(2)}</td>
        </tr>
      ` : ''}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr>
        <td>Gross Total:</td>
        <td style="text-align: right;">₹${(data.gross_total || data.subtotal).toFixed(2)}</td>
      </tr>
      ${data.reg_fee_already_paid && data.registration_fee > 0 ? `
      <tr style="color:#0d9488;">
        <td>Less: Registration Fee (paid):</td>
        <td style="text-align: right;">-₹${data.registration_fee.toFixed(2)}</td>
      </tr>
      ` : ''}
      ${data.gst_percentage > 0 ? `
      <tr>
        <td>GST (${data.gst_percentage}%):</td>
        <td style="text-align: right;">₹${data.gst_amount.toFixed(2)}</td>
      </tr>
      ` : ''}
      ${data.discount > 0 ? `
        <tr>
          <td>Discount:</td>
          <td style="text-align: right; color: red;">-₹${data.discount.toFixed(2)}</td>
        </tr>
      ` : ''}
      <tr class="grand-total">
        <td>BALANCE DUE:</td>
        <td style="text-align: right;">₹${data.total_amount.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  <div style="clear: both;"></div>

  ${data.notes ? `
    <div style="margin-top: 30px;">
      <strong>Notes:</strong>
      <p>${data.notes}</p>
    </div>
  ` : ''}

  <div class="print-footer">
    <div class="sig-block">
      <div class="sig-line"></div>
      ${doctorInfo.name ? `<p class="doctor-name">Dr. ${doctorInfo.name}</p>` : ''}
      ${doctorInfo.designation ? `<p class="reg">${doctorInfo.designation}</p>` : ''}
      ${doctorInfo.registrationNumber ? `<p class="reg">Reg No: ${doctorInfo.registrationNumber}</p>` : ''}
      <p class="reg">Signature</p>
    </div>
    <div class="thank-you">
      <p>Thank you for choosing ${HOSPITAL.name} Hospital</p>
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
