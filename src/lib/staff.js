import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

// Doctors for dropdowns (Case Sheets, etc). Sourced from the HR staff
// directory rather than login accounts, since it's the authoritative list
// of clinical staff and their designation/department.
export const loadDoctors = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'hr_employees'), where('role', '==', 'Doctor')));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.isActive !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (e) {
    console.error('Error loading doctors:', e);
    return [];
  }
};
