// Admin-SDK Firestore access for serverless functions that need to read or
// write on the server's own authority rather than a real user's — see
// firebaseAdminApp.js for why this has to be the Admin SDK (bypasses
// Security Rules) rather than the plain client SDK used everywhere else in
// this app. Throws if FIREBASE_SERVICE_ACCOUNT isn't configured; callers are
// operations that have no safe unprivileged fallback, so failing loudly here
// is more useful than a silent null.

import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './firebaseAdminApp.js';

export const getAdminDb = () => {
  const app = getAdminApp();
  if (!app) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured on the server.');
  return getFirestore(app);
};
