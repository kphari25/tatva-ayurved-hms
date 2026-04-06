// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAbzT44jVXP4VtKer3HQSSLF4bRsCEyAG8",
  authDomain: "tatva-ayurved-hms.firebaseapp.com",
  projectId: "tatva-ayurved-hms",
  storageBucket: "tatva-ayurved-hms.firebasestorage.app",
  messagingSenderId: "1098950929087",
  appId: "1:1098950929087:web:0daa1ad68dae607011340a",
  measurementId: "G-M47PFP5TT5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
