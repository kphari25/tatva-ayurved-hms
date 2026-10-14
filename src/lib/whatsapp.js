// WhatsApp sending via /api/send-whatsapp (Meta WhatsApp Business Cloud API).
// Template names and parameter order must match the templates approved in
// WhatsApp Manager — see the README / setup notes.

const post = async (body) => {
  try {
    const token = localStorage.getItem('sessionToken') || '';
    const response = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (response.status === 403) throw new Error('Your sign-in has expired. Please log out and log back in, then try again.');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || `Request failed (${response.status})`);
    return { success: true, id: result.id };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error.message };
  }
};

export const sendWhatsAppText = (phone, text) => post({ phone, text });

export const sendWhatsAppTemplate = (phone, name, params = []) =>
  post({ phone, template: { name, params } });

// A bare YYYY-MM-DD string parses as UTC midnight, which shows as the previous
// day anywhere west of UTC — read it as a local date instead.
const toLocalDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
};

const dateStr = (d) => toLocalDate(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Template: welcome_patient — "Dear {{1}}, welcome to Tatva Ayurved! Your Patient ID is {{2}}."
export const sendWelcomeWhatsApp = (phone, patientName, patientNumber) =>
  sendWhatsAppTemplate(phone, 'welcome_patient', [patientName, patientNumber]);

// Template: invoice_generated — "Dear {{1}}, your invoice dated {{2}} ({{3}}) is generated. Total: Rs.{{4}}. Payment mode: {{5}}. Patient ID: {{6}}."
export const sendInvoiceWhatsApp = (phone, patientName, d) =>
  sendWhatsAppTemplate(phone, 'invoice_generated', [
    patientName,
    toLocalDate(d.invoice_date).toLocaleDateString('en-IN'),
    d.invoice_type,
    Number(d.total_amount).toFixed(2),
    d.payment_mode,
    d.patient_number,
  ]);

// Template: appointment_confirmation — "Dear {{1}}, your {{2}} at Tatva Ayurved is on {{3}} at {{4}} with {{5}}. Please arrive 10 mins early."
export const sendAppointmentWhatsApp = (phone, patientName, d) =>
  sendWhatsAppTemplate(phone, 'appointment_confirmation', [
    patientName,
    d.appointmentType,
    dateStr(d.date),
    d.time,
    d.doctorName,
  ]);

// ---- wa.me click-to-chat (no API needed) ----------------------------------
// Opens WhatsApp with the message pre-filled; staff press Send. Must be called
// directly from a click handler (no await before it) or browsers block the tab.
export const openWhatsAppChat = (phone, message) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) {
    alert('No valid phone number on file.');
    return false;
  }
  window.open(`https://wa.me/91${digits.slice(-10)}?text=${encodeURIComponent(message)}`, '_blank');
  return true;
};

export const welcomeMessage = (patientName, patientNumber) =>
  `Dear ${patientName}, Welcome to Tatva Ayurved! Your Patient ID is ${patientNumber}. We look forward to serving you. For appointments call us. - Tatva Ayurved`;

export const invoiceMessage = (patientName, d) =>
  `Dear ${patientName}, Your invoice at Tatva Ayurved dated ${toLocalDate(d.invoice_date).toLocaleDateString('en-IN')} (${d.invoice_type}) is generated. Total Amount: Rs.${Number(d.total_amount).toFixed(2)}. Payment Mode: ${d.payment_mode}. Patient ID: ${d.patient_number}. Thank you! - Tatva Ayurved`;

export const appointmentMessage = (patientName, d) =>
  `Dear ${patientName}, Your ${d.appointmentType || 'appointment'} at Tatva Ayurved is scheduled on ${dateStr(d.date)} at ${d.time}${d.doctorName ? ` with ${d.doctorName}` : ''}. Please arrive 10 mins early. - Tatva Ayurved`;

export const doctorAppointmentMessage = (doctorName, d) =>
  `${doctorName}, Appointment scheduled: Patient ${d.patientName}${d.mrdNumber ? ` (${d.mrdNumber})` : ''} for ${d.appointmentType} on ${dateStr(d.date)} at ${d.time}.${d.notes ? ` Notes: ${d.notes}` : ''} - Tatva Ayurved`;

// Template: doctor_appointment_notice — "{{1}}, appointment scheduled: patient {{2}} ({{3}}) for {{4}} on {{5}} at {{6}}. Notes: {{7}}"
export const sendDoctorAppointmentWhatsApp = (phone, doctorName, d) =>
  sendWhatsAppTemplate(phone, 'doctor_appointment_notice', [
    doctorName,
    d.patientName,
    d.mrdNumber || '-',
    d.appointmentType,
    dateStr(d.date),
    d.time,
    d.notes || '-',
  ]);
