// Server-side login — replaces the client-side password check that used to
// live in Login.jsx. That old version fetched the ENTIRE users collection
// (every user's plaintext password included) into the browser just to find
// one match; this keeps that comparison server-side and returns only a
// signed session token plus the matched user's own profile.
//
// Password storage itself is still plaintext in Firestore (unchanged from
// the previous behavior) — this endpoint only stops passwords from being
// shipped to the browser during login. Hashing passwords at rest is a
// separate, still-open follow-up.

import { collection, getDocs } from 'firebase/firestore';
import { getDb } from './_lib/firebaseAdmin.js';
import { createSessionToken } from './_lib/session.js';

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

    if (userData.password !== password) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
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
