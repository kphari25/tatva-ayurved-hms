// Read-only WhatsApp diagnostics — asks Meta for the sending number's health
// (can it send, and if not, why) and the WhatsApp Business Account's review
// state. Login-protected; changes nothing on the number. Uses the same token
// and phone number ID as send-whatsapp.js (WHATSAPP_ACCESS_TOKEN,
// WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_VERSION). The WhatsApp Business
// Account ID is optional (body.wabaId or WHATSAPP_BUSINESS_ACCOUNT_ID).

import { verifySessionToken } from './_lib/session.js';

const PHONE_FIELD_SETS = [
  'health_status',
  'verified_name,display_phone_number,name_status,status,code_verification_status,quality_rating,platform_type,account_mode',
  'messaging_limit_tier,throughput,is_official_business_account,last_onboarded_time',
];
const WABA_FIELD_SETS = [
  'health_status',
  'name,currency,timezone_id,account_review_status,business_verification_status',
];

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

  const wabaId = String((req.body || {}).wabaId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').replace(/\D/g, '');
  const headers = { Authorization: `Bearer ${token}` };

  // One request per field set so a field this account can't read doesn't hide the rest.
  const query = async (id, fields) => {
    try {
      const r = await fetch(`https://graph.facebook.com/${apiVersion}/${id}?fields=${fields}`, { headers });
      const data = await r.json().catch(() => ({}));
      return r.ok ? data : { error: data?.error?.message, code: data?.error?.code };
    } catch (error) {
      return { error: error.message };
    }
  };

  const phone = await Promise.all(PHONE_FIELD_SETS.map(f => query(phoneNumberId, f)));
  const waba = wabaId ? await Promise.all(WABA_FIELD_SETS.map(f => query(wabaId, f))) : null;
  res.status(200).json({ success: true, phone, waba });
}
