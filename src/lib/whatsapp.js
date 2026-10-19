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

// ---- Approved templates ----------------------------------------------------
// Each builder returns { name, params } in the exact variable order of the
// template approved in WhatsApp Manager; TEMPLATE_BODIES holds the approved
// wording so the confirmation dialog can show precisely what will be sent.
const TEMPLATE_BODIES = {
  registration_confirmation: 'Hello {{1}}, your registration at Tatva Ayurved has been recorded under patient record number {{2}}. Our front desk team will assist you with your visit.',
  invoice_generated: 'Dear {{1}}, your invoice dated {{2}} ({{3}}) has been generated. Total amount: Rs.{{4}}. Payment mode: {{5}}. Patient ID: {{6}}. For any queries, please contact Tatva Ayurved.',
  appointment_confirmation: 'Dear {{1}}, your {{2}} at Tatva Ayurved is scheduled on {{3}} at {{4}} with {{5}}. Please arrive 10 minutes early.',
  doctor_appointment_notice: 'Hello {{1}}, an appointment is scheduled. Patient: {{2}} ({{3}}). Type: {{4}}. Date: {{5}} at {{6}}. Notes: {{7}}. Please check the schedule for details.',
};

export const previewTemplate = ({ name, params }) =>
  (TEMPLATE_BODIES[name] || '').replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? '');

export const registrationTemplate = (patientName, patientNumber) => ({
  name: 'registration_confirmation',
  params: [patientName, patientNumber],
});

export const invoiceTemplate = (patientName, d) => ({
  name: 'invoice_generated',
  params: [
    patientName,
    toLocalDate(d.invoice_date).toLocaleDateString('en-IN'),
    d.invoice_type,
    Number(d.total_amount).toFixed(2),
    d.payment_mode,
    d.patient_number,
  ],
});

export const appointmentTemplate = (patientName, d) => ({
  name: 'appointment_confirmation',
  params: [patientName, d.appointmentType, dateStr(d.date), d.time, d.doctorName],
});

export const doctorAppointmentTemplate = (doctorName, d) => ({
  name: 'doctor_appointment_notice',
  params: [doctorName, d.patientName, d.mrdNumber || '-', d.appointmentType, dateStr(d.date), d.time, d.notes || '-'],
});

export const sendTemplate = (phone, tpl) => sendWhatsAppTemplate(phone, tpl.name, tpl.params);

export const sendWelcomeWhatsApp = (phone, patientName, patientNumber) => sendTemplate(phone, registrationTemplate(patientName, patientNumber));
export const sendInvoiceWhatsApp = (phone, patientName, d) => sendTemplate(phone, invoiceTemplate(patientName, d));
export const sendAppointmentWhatsApp = (phone, patientName, d) => sendTemplate(phone, appointmentTemplate(patientName, d));

// Automatic (API) sending is on only once VITE_WHATSAPP_API_ENABLED=true; until
// then every WhatsApp action stays the one-click wa.me chat.
export const whatsappApiEnabled = import.meta.env.VITE_WHATSAPP_API_ENABLED === 'true';

// ---- wa.me click-to-chat (no API needed) ----------------------------------
// Opens WhatsApp with the message pre-filled; staff press Send. Must be called
// directly from a click handler (no await before it) or browsers block the tab.
// Same rule as api/send-whatsapp.js: a number written with a country code is
// used as given; a plain 10-digit number (or one with a leading 0) is Indian.
export const toWhatsAppNumber = (raw) => {
  const str = String(raw || '').trim();
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  let out = '';
  if (str.startsWith('+')) out = digits;
  else if (digits.startsWith('00')) out = digits.slice(2);
  else if (digits.length === 10) out = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) out = `91${digits.slice(1)}`;
  else if (digits.length >= 11) out = digits;
  return out.length >= 8 && out.length <= 15 ? out : '';
};

export const openWhatsAppChat = (phone, message) => {
  const number = toWhatsAppNumber(phone);
  if (!number) {
    alert('No valid phone number on file.');
    return false;
  }
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
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

export const sendDoctorAppointmentWhatsApp = (phone, doctorName, d) => sendTemplate(phone, doctorAppointmentTemplate(doctorName, d));

