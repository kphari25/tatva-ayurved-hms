// Shared Firestore client for serverless functions. This is the same public
// web config already shipped in src/lib/firebase.js — it isn't a secret;
// Firebase web config is meant to be public, access control is enforced by
// Firestore security rules (and, here, the request-level checks in each
// function), not by hiding this object.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAbzT44jVXP4VtKer3HQSSLF4bRsCEyAG8',
  authDomain: 'tatva-ayurved-hms.firebaseapp.com',
  projectId: 'tatva-ayurved-hms',
  storageBucket: 'tatva-ayurved-hms.firebasestorage.app',
  messagingSenderId: '1098950929087',
  appId: '1:1098950929087:web:0daa1ad68dae607011340a',
};

export const getDb = () =>
  getFirestore(getApps().length ? getApp() : initializeApp(firebaseConfig));
