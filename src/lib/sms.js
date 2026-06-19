// MSG91 SMS Integration for India
// Set your credentials in .env:
//   VITE_MSG91_AUTH_KEY=your_auth_key
//   VITE_MSG91_SENDER_ID=TATVAY   (6-char sender ID approved by MSG91)
//   VITE_MSG91_TEMPLATE_ID_WELCOME=your_template_id   (DLT registered template)
//   VITE_MSG91_TEMPLATE_ID_INVOICE=your_template_id

const AUTH_KEY = import.meta.env.VITE_MSG91_AUTH_KEY || '';
const SENDER_ID = import.meta.env.VITE_MSG91_SENDER_ID || 'TATVAY';

// Send a plain transactional SMS via MSG91 Send API
// phone: 10-digit Indian mobile number (no country code)
// message: text (must match a DLT-registered template for transactional route)
export const sendSMS = async (phone, message) => {
  if (!AUTH_KEY) {
    console.warn('MSG91 auth key not configured. Set VITE_MSG91_AUTH_KEY in .env');
    return { success: false, error: 'SMS not configured' };
  }

  // Normalize phone — strip leading 0/+91 and take last 10 digits
  const normalized = phone.replace(/\D/g, '').slice(-10);
  if (normalized.length !== 10) {
    return { success: false, error: 'Invalid phone number' };
  }

  const mobileWithCode = `91${normalized}`;

  try {
    const response = await fetch(
      `https://api.msg91.com/api/sendhttp.php?authkey=${AUTH_KEY}&mobiles=${mobileWithCode}&message=${encodeURIComponent(message)}&sender=${SENDER_ID}&route=4&country=91`,
      { method: 'GET' }
    );
    const text = await response.text();
    const success = text.startsWith('1') || text.toLowerCase().includes('success');
    console.log('MSG91 response:', text);
    return { success, response: text };
  } catch (error) {
    console.error('MSG91 send error:', error);
    return { success: false, error: error.message };
  }
};

// Welcome SMS for new patient registration
export const sendWelcomeSMS = async (phone, patientName, patientNumber) => {
  const message = `Dear ${patientName}, Welcome to Tatva Ayurved! Your Patient ID is ${patientNumber}. We look forward to serving you. For appointments call us. - Tatva Ayurved`;
  return sendSMS(phone, message);
};

// Invoice SMS — sends a summary (no breakdown of meals etc.)
export const sendInvoiceSMS = async (phone, patientName, invoiceDetails) => {
  const { invoice_type, invoice_date, total_amount, payment_mode, patient_number } = invoiceDetails;
  const date = new Date(invoice_date).toLocaleDateString('en-IN');
  const message = `Dear ${patientName}, Your invoice at Tatva Ayurved dated ${date} (${invoice_type}) is generated. Total Amount: Rs.${Number(total_amount).toFixed(2)}. Payment Mode: ${payment_mode}. Patient ID: ${patient_number}. Thank you! - Tatva Ayurved`;
  return sendSMS(phone, message);
};
