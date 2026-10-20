// Vercel serverless function — sends an approved WhatsApp template whose header
// is a PDF document (e.g. an invoice copy). The PDF is uploaded straight to
// Meta's media endpoint, so there is no public link to it anywhere; Meta keeps
// the file for 30 days. Login-protected, like send-whatsapp.js.
//
// Body: { phone, template: { name, params: string[], language? }, pdfBase64, filename }
//
// The WhatsApp access token stays in this server-side function
// (WHATSAPP_ACCESS_TOKEN, no VITE_ prefix, set in Vercel project settings).

import { verifySessionToken } from './_lib/session.js';

const MAX_PDF_BYTES = 2.5 * 1024 * 1024; // base64 adds ~33%, so this keeps the request under Vercel's 4.5 MB body limit

// Same rule as send-whatsapp.js / src/lib/whatsapp.js: numbers written with a
// country code are used as given; a plain 10-digit number is Indian (+91).
const normalizePhone = (raw) => {
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  let out = '';
  if (s.startsWith('+')) out = digits;
  else if (digits.startsWith('00')) out = digits.slice(2);
  else if (digits.length === 10) out = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) out = `91${digits.slice(1)}`;
  else if (digits.length >= 11) out = digits;
  return out.length >= 8 && out.length <= 15 ? out : '';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token || !phoneNumberId) {
    res.status(500).json({ success: false, error: 'WhatsApp not configured on the server. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Vercel project settings.' });
    return;
  }

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!verifySessionToken(bearer)) {
    res.status(403).json({ success: false, error: 'Not authorized. Please log in again and retry.' });
    return;
  }

  const { phone, template, pdfBase64, filename } = req.body || {};
  const to = normalizePhone(phone);
  if (!to) {
    res.status(400).json({ success: false, error: 'Invalid phone number' });
    return;
  }
  if (!template?.name) {
    res.status(400).json({ success: false, error: 'Missing template' });
    return;
  }
  const pdf = Buffer.from(String(pdfBase64 || ''), 'base64');
  if (pdf.length < 100 || pdf.subarray(0, 4).toString() !== '%PDF') {
    res.status(400).json({ success: false, error: 'The attachment is not a valid PDF.' });
    return;
  }
  if (pdf.length > MAX_PDF_BYTES) {
    res.status(413).json({ success: false, error: 'The PDF is too large to send.' });
    return;
  }
  const safeName = String(filename || 'invoice.pdf').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 80);
  const base = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;

  let mediaId = null;
  try {
    // 1. Upload the PDF to Meta (not stored anywhere else).
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), safeName);
    const up = await fetch(`${base}/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const upData = await up.json().catch(() => ({}));
    if (!up.ok || !upData.id) {
      res.status(502).json({ success: false, stage: 'upload', error: upData?.error?.message || `Media upload failed (${up.status})`, code: upData?.error?.code });
      return;
    }
    mediaId = upData.id;

    // 2. Send the template with the PDF as its header.
    const params = Array.isArray(template.params) ? template.params : [];
    const components = [
      { type: 'header', parameters: [{ type: 'document', document: { id: mediaId, filename: safeName } }] },
      ...(params.length ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p) })) }] : []),
    ];
    const r = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: template.name, language: { code: template.language || 'en' }, components },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      // mediaId is returned so a failed send still shows the upload itself worked.
      res.status(502).json({ success: false, stage: 'send', mediaId, error: data?.error?.message || `WhatsApp API error (${r.status})`, code: data?.error?.code });
      return;
    }
    res.status(200).json({ success: true, id: data?.messages?.[0]?.id, mediaId });
  } catch (error) {
    res.status(502).json({ success: false, mediaId, error: error.message });
  }
}
