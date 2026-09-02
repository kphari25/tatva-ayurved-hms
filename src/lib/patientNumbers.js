// Shared patient-number generators — used by New Patient Registration and by
// the Dashboard's IP-appointment flow (which can create a minimal pending
// patient record directly), so both paths issue numbers from the same
// sequence instead of two independent copies that could drift apart.
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from './firebase';

export const generateMRDNumber = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'patients'), orderBy('mrd_number', 'desc'), limit(1)));
    if (snap.empty) return 'MRD-1001';
    const last = snap.docs[0].data().mrd_number || 'MRD-1000';
    const match = last.match(/MRD-(\d+)/);
    const next = match ? parseInt(match[1]) + 1 : 1001;
    return `MRD-${next}`;
  } catch {
    try {
      const snap = await getDocs(collection(db, 'patients'));
      return `MRD-${1001 + snap.size}`;
    } catch {
      return `MRD-${Date.now().toString().slice(-4)}`;
    }
  }
};

// Generate next IP number (IP-3000, IP-3001, …)
export const generateIPNumber = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'patients'), orderBy('ip_number', 'desc'), limit(1)));
    if (snap.empty) return 'IP-3000';
    const last = snap.docs[0].data().ip_number;
    if (!last) return 'IP-3000';
    const match = last.match(/IP-(\d+)/);
    const next = match ? parseInt(match[1]) + 1 : 3000;
    return `IP-${next}`;
  } catch {
    try {
      const snap = await getDocs(query(collection(db, 'patients'), where('patient_type', '==', 'IP')));
      return `IP-${3000 + snap.size}`;
    } catch {
      return `IP-${Date.now().toString().slice(-4)}`;
    }
  }
};

// Keep old PAT number for backward compat
export const generatePatientNumber = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'patients'), orderBy('created_at', 'desc'), limit(1)));
    if (snap.empty) return 'PAT-2026-0001';
    const last = snap.docs[0].data().patient_number || 'PAT-2026-0000';
    const match = last.match(/PAT-(\d{4})-(\d{4})/);
    if (match) {
      const year = new Date().getFullYear();
      return `PAT-${year}-${(parseInt(match[2]) + 1).toString().padStart(4, '0')}`;
    }
    return `PAT-2026-${Date.now().toString().slice(-4)}`;
  } catch {
    return `PAT-2026-${Date.now().toString().slice(-4)}`;
  }
};
