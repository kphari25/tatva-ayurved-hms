// Signed session tokens — HMAC-SHA256 over a base64url JSON payload, hand-rolled
// with Node's built-in crypto instead of pulling in a JWT library, since this
// app only ever needs one fixed algorithm and one verifier (no external
// parties, no key rotation, no algorithm negotiation to support).
//
// Format: "<base64url(payload json)>.<base64url(hmac signature)>"
//
// SESSION_SECRET must be set in Vercel project settings — never VITE_-prefixed,
// this must never reach the browser. Anyone holding it could forge a valid
// session for any user, so treat it exactly like the Anthropic key.

import crypto from 'node:crypto';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h — long enough to cover a shift

const sign = (payloadB64, secret) =>
  crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

export const createSessionToken = (payload) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured on the server');
  const body = { ...payload, exp: Date.now() + SESSION_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${payloadB64}.${sign(payloadB64, secret)}`;
};

// Returns the verified payload, or null if the token is missing, malformed,
// tampered with, or expired.
export const verifySessionToken = (token) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;

  const [payloadB64, sig] = String(token).split('.');
  if (!payloadB64 || !sig) return null;

  const expectedSig = sign(payloadB64, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const body = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!body.exp || body.exp < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
};
