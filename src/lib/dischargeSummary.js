import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Sorted client-side rather than via orderBy() — combining it with the
// where() above needs a Firestore composite index that isn't set up.
export const fetchLatestDischargeSummary = async (patientId) => {
  if (!patientId) return null;
  const snap = await getDocs(query(collection(db, 'discharge_summaries'), where('patient_id', '==', patientId)));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => new Date(b.saved_at || 0) - new Date(a.saved_at || 0));
  return docs[0] || null;
};
