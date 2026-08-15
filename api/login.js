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

import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getDb } from './_lib/firebaseAdmin.js';
import { createSessionToken } from './_lib/session.js';
import { verifyPassword, hashPassword, isLegacyPlaintext } from './_lib/password.js';

// Matches Login.jsx's BUILT_IN_USERS — kept in sync manually since this
// endpoint now owns the actual check (Login.jsx just calls this).
const BUILT_IN_USERS = {
  'admin@tatvaayurved.com': {
    password: 'admin123',
    name: 'System Administrator',
    role: 'system_admin',
    permissions: ['all'],
  },
  'admin123': {
    password: 'admin123',
    name: 'System Administrator',
    role: 'system_admin',
    permissions: ['all'],
  },
};

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
    const builtIn = BUILT_IN_USERS[normalized];
    if (builtIn && builtIn.password === password) {
      const user = { email: normalized, name: builtIn.name, role: builtIn.role, permissions: builtIn.permissions };
      res.status(200).json({ success: true, token: createSessionToken(user), user });
      return;
    }

    const snap = await getDocs(collection(getDb(), 'users'));
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
        await updateDoc(doc(getDb(), 'users', match.id), { password: await hashPassword(password) });
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
    };
    res.status(200).json({ success: true, token: createSessionToken(user), user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed: ' + error.message });
  }
}
