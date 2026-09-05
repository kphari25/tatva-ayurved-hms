import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

const DOCTOR_KEYWORDS = ['doctor', 'physician', 'consultant', 'vaidya', 'surgeon', 'rmo', 'medical'];

const normalizeDocName = (s) => (s || '').replace(/^dr\.?\s*/i, '').trim().toLowerCase();

// A doctor can be added two ways that don't otherwise sync: an HR employee
// record (hr_employees — payroll, has designation/registration number) or a
// login account created in User Management (users, role 'doctor' — for
// permissions, no registration number). Every doctor dropdown/lookup in the
// app needs to see both, or a doctor added only via User Management — the
// more obvious place to add a new doctor — silently never appears anywhere
// a patient, appointment, prescription or discharge summary needs to
// reference them.
export const loadDoctorsList = async () => {
  const [hrSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, 'hr_employees')),
    getDocs(query(collection(db, 'users'), where('role', '==', 'doctor'))),
  ]);

  const hrDoctors = hrSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(e => {
      const haystack = `${e.department || ''} ${e.designation || ''} ${e.role || ''}`.toLowerCase();
      return DOCTOR_KEYWORDS.some(k => haystack.includes(k));
    })
    .map(e => ({
      id: e.id,
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.name || '',
      designation: e.designation || e.department || '',
      qualification: e.qualification || '',
      registrationNumber: e.registrationNumber || '',
      phone: e.phone || e.mobile || '',
      source: 'hr_employees',
    }));

  const userDoctors = usersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .map(u => ({
      id: u.id,
      name: u.name || '',
      designation: u.designation || u.department || '',
      qualification: u.qualification || '',
      registrationNumber: u.registrationNumber || '',
      phone: u.phone || '',
      source: 'users',
    }))
    .filter(u => u.name);

  // De-dupe by normalized name — prefer the hr_employees entry (richer
  // data: designation, registration number) when the same doctor exists in
  // both places.
  const byName = new Map();
  [...hrDoctors, ...userDoctors].forEach(entry => {
    const key = normalizeDocName(entry.name);
    if (!key) return;
    const existing = byName.get(key);
    if (!existing || (existing.source !== 'hr_employees' && entry.source === 'hr_employees')) {
      byName.set(key, entry);
    }
  });

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
};

// Finds one doctor's info (for a print signature block) by name, tolerant
// of the stored field carrying a shorter form than the doctor's own full
// name (e.g. a patient's assigned_doctor "Dr. Satheesh" vs the record's
// full "Dr. Satheesh Kumar") — exact matching silently drops
// designation/registration number whenever the two don't match verbatim.
export const findDoctorInfo = (doctorsList, targetName) => {
  const target = normalizeDocName(targetName);
  if (!target) return null;
  return doctorsList.find(d => {
    const n = normalizeDocName(d.name);
    return n && (n === target || n.startsWith(target) || target.startsWith(n));
  }) || null;
};
