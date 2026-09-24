// Hashes and stores a user's password — called from User Management instead
// of writing the plaintext password field directly to Firestore. Requires a
// valid signed session belonging to a system_admin, since this can set any
// user's password.

import { getAdminDb } from './_lib/firebaseAdminDb.js';
import { verifySessionToken } from './_lib/session.js';
import { hashPassword } from './_lib/password.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(bearer);
  if (!session) {
    res.status(403).json({ success: false, error: 'Not authorized. Please log in again and retry.' });
    return;
  }
  if (session.role !== 'system_admin') {
    res.status(403).json({ success: false, error: 'Only administrators can set user passwords.' });
    return;
  }

  const { userId, password } = req.body || {};
  if (!userId || !password) {
    res.status(400).json({ success: false, error: 'userId and password are required' });
    return;
  }
  if (String(password).length < 4) {
    res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
    return;
  }

  try {
    // Flags the account so its next login is forced through the "set a new
    // password" screen before the app itself opens — an admin-chosen
    // password (new account or reset) is never the one someone keeps using.
    await getAdminDb().collection('users').doc(userId).update({
      password: await hashPassword(password),
      must_change_password: true,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error setting user password:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
