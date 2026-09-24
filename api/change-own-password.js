// Self-service password change — anyone with a valid session can change
// their OWN password (userId always comes from the session token, never
// the request body, so nobody can use this to touch another account).
// Used for both the forced "set a new password" screen after an admin
// creates/resets an account, and any future voluntary change.

import { getAdminDb } from './_lib/firebaseAdminDb.js';
import { verifySessionToken } from './_lib/session.js';
import { verifyPassword, hashPassword } from './_lib/password.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = verifySessionToken(bearer);
  if (!session || !session.id) {
    res.status(403).json({ success: false, error: 'Not authorized. Please log in again and retry.' });
    return;
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'Current and new password are required' });
    return;
  }
  if (String(newPassword).length < 4) {
    res.status(400).json({ success: false, error: 'New password must be at least 4 characters' });
    return;
  }

  try {
    const ref = getAdminDb().collection('users').doc(session.id);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    if (!(await verifyPassword(currentPassword, snap.data().password))) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }
    await ref.update({ password: await hashPassword(newPassword), must_change_password: false });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
