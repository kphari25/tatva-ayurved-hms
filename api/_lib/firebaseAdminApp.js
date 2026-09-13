// Shared Firebase Admin SDK app instance for serverless functions that need
// privileged, rules-bypassing access to Firebase (Auth custom tokens,
// Firestore reads/writes done on the server's own authority — e.g. checking
// a login's password hash, or an already-verified admin setting another
// user's password). Firestore Security Rules only ever see `request.auth`
// from a real client session; a server-side operation that has already done
// its own authorization check (like these) has no such session and would be
// rejected by the same rules real users are subject to, so it must go
// through the Admin SDK instead of the plain client SDK — the Admin SDK
// authenticates via this service account and bypasses Security Rules
// entirely, by design.
//
// Requires a Firebase service account, set as the FIREBASE_SERVICE_ACCOUNT
// env var in Vercel project settings (raw JSON or base64-encoded JSON — never
// committed to the repo). Returns null if it isn't configured — callers must
// handle that (e.g. by falling back or failing clearly), since there's no
// safe unprivileged fallback for operations that need this.

import { cert, getApps, getApp, initializeApp } from 'firebase-admin/app';

export const getAdminApp = () => {
  if (getApps().length) return getApp();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  // Pasting the downloaded key's JSON through some editors / env-var UIs
  // "pretty-prints" it, which is harmless everywhere except inside the
  // private_key field: its PEM text needs literal "\n" *escape sequences*
  // (two characters) to stay valid JSON, and pretty-printing sometimes turns
  // those into real newline bytes instead — which JSON.parse then rejects.
  // Re-escaping just that field's real newlines back to "\n" repairs it
  // without needing the value to be re-pasted correctly at the source.
  const repairPrivateKeyNewlines = (text) =>
    text.replace(/("private_key"\s*:\s*")([\s\S]*?)("\s*,\s*"client_email")/,
      (_, pre, key, post) => pre + key.replace(/\r\n|\n|\r/g, '\\n') + post);

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (jsonErr) {
    try {
      serviceAccount = JSON.parse(repairPrivateKeyNewlines(raw));
    } catch {
      try {
        serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      } catch (b64Err) {
        console.error('FIREBASE_SERVICE_ACCOUNT: raw JSON.parse failed:', jsonErr.message);
        console.error('FIREBASE_SERVICE_ACCOUNT: repaired-newline and base64 fallbacks also failed:', b64Err.message);
        return null;
      }
    }
  }

  return initializeApp({ credential: cert(serviceAccount) });
};
