// Server-side login — replaces the client-side password check that used to
// live in Login.jsx. That old version fetched the ENTIRE users collection
// (every user's plaintext password included) into the browser just to find
// one match; this keeps that comparison server-side and returns only a
// signed session token plus the matched user's own profile.
//
// Passwords are hashed at rest (see _lib/password.js). Accounts created
// before this shipped still have a plaintext value; a successful login
// against one silently rewrites it as a hash, so each account upgrades
// itself the next time its owner signs in rather than needing a bulk
// migration or a forced reset.

import { getAdminDb } from './_lib/firebaseAdminDb.js';
import { createSessionToken } from './_lib/session.js';
import { verifyPassword, hashPassword, isLegacyPlaintext } from './_lib/password.js';
import { mintFirebaseToken } from './_lib/firebaseAdminAuth.js';

// Every account — including the System Administrator — is checked against its
// record in the users collection. There is deliberately no built-in account
// with a password written in this file: the repository is public, and a
// hard-coded password here kept working after the admin changed it in User
// Management, because it was checked before the database.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }
  const normalized = String(email).toLowerCase().trim();

  try {
    const snap = await getAdminDb().collection('users').get();
    const match = snap.docs.find(d => (d.data().email || '').toLowerCase() === normalized);

    if (!match) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const userData = match.data();
    if (userData.is_active === false) {
      res.status(403).json({ success: false, error: 'Your account has been deactivated. Please contact the administrator.' });
      return;
    }

    if (!(await verifyPassword(password, userData.password))) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    if (isLegacyPlaintext(userData.password)) {
      try {
        await getAdminDb().collection('users').doc(match.id).update({ password: await hashPassword(password) });
      } catch (upgradeErr) {
        // Non-fatal — login still succeeds even if the upgrade write fails;
        // it'll just try again on the next login.
        console.error('Could not upgrade legacy password hash:', upgradeErr);
      }
    }

    const user = {
      id: match.id,
      email: normalized,
      name: userData.name,
      role: userData.role || 'front_office',
      permissions: userData.permissions || [],
      department: userData.department || '',
      qualification: userData.qualification || '',
      employee_id: userData.employee_id || '',
      must_change_password: userData.must_change_password === true,
    };
    const firebaseToken = await mintFirebaseToken(match.id, { role: user.role });
    res.status(200).json({ success: true, token: createSessionToken(user), firebaseToken, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed: ' + error.message });
  }
}
