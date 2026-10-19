// Vercel serverless function — sends a WhatsApp message through Meta's
// WhatsApp Business Cloud API. The access token lives only here
// (WHATSAPP_ACCESS_TOKEN, no VITE_ prefix, set in Vercel project settings).
//
// Body: { phone, template?: { name, params: string[], language? }, text? }
//  - template: approved template message (works any time; required to message a
//    patient first).
//  - text: free-form message (Meta only delivers it inside the 24-hour window
//    after the patient last messaged the clinic).

import { verifySessionToken } from './_lib/session.js';

// Digits for the WhatsApp API: numbers written with a country code are used as
// given (+1 732 207 9036, 001…, 966506163596); a plain 10-digit number — or one
// with a leading 0 — is treated as Indian (+91), as staff have always entered them.
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

  const { phone, template, text } = req.body || {};
  const to = normalizePhone(phone);
  if (!to) {
    res.status(400).json({ success: false, error: 'Invalid phone number' });
    return;
  }

  let message;
  if (template && template.name) {
    const params = Array.isArray(template.params) ? template.params : [];
    message = {
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language || 'en' },
        ...(params.length
          ? { components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: String(p) })) }] }
          : {}),
      },
    };
  } else if (text && String(text).trim()) {
    message = { type: 'text', text: { body: String(text).slice(0, 4096) } };
  } else {
    res.status(400).json({ success: false, error: 'Provide a template or text' });
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(502).json({ success: false, error: data?.error?.message || `WhatsApp API error (${response.status})`, code: data?.error?.code });
      return;
    }
    res.status(200).json({ success: true, id: data?.messages?.[0]?.id });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
}
