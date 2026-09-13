// Mints Firebase Auth custom tokens so the client can establish a real
// Firebase Auth session on login — needed because Firestore security rules
// can only see `request.auth`, and this app's client otherwise never signs
// into Firebase Auth at all (see api/login.js's own comment header).

import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdminApp.js';

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
