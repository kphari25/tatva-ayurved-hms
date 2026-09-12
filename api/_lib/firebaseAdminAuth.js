// Mints Firebase Auth custom tokens so the client can establish a real
// Firebase Auth session on login — needed because Firestore security rules
// can only see `request.auth`, and this app's client otherwise never signs
// into Firebase Auth at all (see api/login.js's own comment header).
//
// Requires a Firebase service account, set as the FIREBASE_SERVICE_ACCOUNT
// env var in Vercel project settings (raw JSON or base64-encoded JSON — never
// committed to the repo). Until that's configured, mintFirebaseToken simply
// returns null so login keeps working exactly as it does today.

import { cert, getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const getAdminApp = () => {
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

export const mintFirebaseToken = async (uid, claims = {}) => {
  const app = getAdminApp();
  if (!app) return null;
  try {
    return await getAuth(app).createCustomToken(uid, claims);
  } catch (e) {
    console.error('Error minting Firebase custom token:', e);
    return null;
  }
};
