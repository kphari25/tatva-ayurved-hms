// TEMPORARY one-off function — registers the WhatsApp number for the Cloud API
// (POST /{phone-number-id}/register) and reads its status back. Login-protected.
// The PIN is supplied in the request body at call time and is never stored.
// Delete this file once the number is registered.

import { verifySessionToken } from './_lib/session.js';

const STATUS_FIELDS = 'verified_name,display_phone_number,quality_rating,name_status,status,code_verification_status,platform_type';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token || !phoneNumberId) {
    res.status(500).json({ success: false, error: 'WhatsApp not configured on the server.' });
    return;
  }
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!verifySessionToken(bearer)) {
    res.status(403).json({ success: false, error: 'Not authorized. Please log in again and retry.' });
    return;
  }

  const { action, pin } = req.body || {};
  const base = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  try {
    let registerResult = null;
    if (action === 'register') {
      if (!/^\d{6}$/.test(String(pin || ''))) {
        res.status(400).json({ success: false, error: 'pin must be 6 digits' });
        return;
      }
      const r = await fetch(`${base}/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messaging_product: 'whatsapp', pin: String(pin) }),
      });
      const data = await r.json().catch(() => ({}));
      registerResult = { ok: r.ok, status: r.status, body: r.ok ? data : { error: data?.error?.message, code: data?.error?.code, subcode: data?.error?.error_subcode } };
    }
    const s = await fetch(`${base}?fields=${STATUS_FIELDS}`, { headers });
    const sdata = await s.json().catch(() => ({}));
    res.status(200).json({
      success: true,
      register: registerResult,
      phone: s.ok ? sdata : { error: sdata?.error?.message, code: sdata?.error?.code },
    });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
}
