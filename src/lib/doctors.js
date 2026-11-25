import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { withDrPrefix } from './formatDoctorName';

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
// The list is read from two whole collections, which made every caller (the
// Prescription window, Discharge Summary, Scheduling, Dashboard…) wait on the
// same slow lookup. It is cached for a few minutes and shared between callers;
// anywhere doctors are added/edited/deleted calls clearDoctorsCache() so a
// change shows up immediately.
const DOCTORS_CACHE_MS = 5 * 60 * 1000;
let doctorsCache = { at: 0, promise: null };

export const clearDoctorsCache = () => { doctorsCache = { at: 0, promise: null }; };

export const loadDoctorsList = () => {
  if (!doctorsCache.promise || Date.now() - doctorsCache.at > DOCTORS_CACHE_MS) {
    const promise = fetchDoctorsList().catch((e) => {
      if (doctorsCache.promise === promise) clearDoctorsCache(); // never cache a failure
      throw e;
    });
    doctorsCache = { at: Date.now(), promise };
  }
  return doctorsCache.promise.then(list => [...list]); // a copy, so callers can't alter the shared list
};

const fetchDoctorsList = async () => {
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
      // The designation typed in User Management for this doctor (no department fallback)
      explicitDesignation: (u.designation || '').trim(),
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
  // A designation set in User Management is the one the clinic chose on purpose, so
  // it wins over the HR record's (or the department fallback) for the same doctor.
  userDoctors.forEach(u => {
    if (!u.explicitDesignation) return;
    const kept = byName.get(normalizeDocName(u.name));
    if (kept) kept.designation = u.explicitDesignation;
  });

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
};

// "Dr. Name" plus the designation when the doctor has one ("Dr. Priya · Senior Consultant").
export const doctorWithDesignation = (doctorsList, name, sep = ' · ') => {
  const base = withDrPrefix(name);
  if (!base) return '';
  const info = findDoctorInfo(doctorsList || [], name);
  return info?.designation ? `${base}${sep}${info.designation}` : base;
};

// Finds one doctor's info (for a print signature block) by name, tolerant
// of the stored field carrying a shorter form than the doctor's own full
// name (e.g. a patient's assigned_doctor "Dr. Satheesh" vs the record's
// full "Dr. Satheesh Kumar") — exact matching silently drops
// designation/registration number whenever the two don't match verbatim.
// A shorter form only matches on whole words ("Satheesh" → "Satheesh Kumar",
// never "Anu" → "Anupama"), and only when exactly one doctor fits — a wrong
// match prints another doctor's registration number on a prescription or
// discharge summary, so no match (blank designation/registration) is safer.
const matchKey = (s) => normalizeDocName(s).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
const isWordPrefix = (longer, shorter) => longer.startsWith(shorter) && longer.charAt(shorter.length) === ' ';

export const findDoctorInfo = (doctorsList, targetName) => {
  const target = matchKey(targetName);
  if (!target) return null;
  const list = (doctorsList || []).filter(d => matchKey(d.name));
  const exact = list.find(d => matchKey(d.name) === target);
  if (exact) return exact;
  const partial = list.filter(d => {
    const n = matchKey(d.name);
    return isWordPrefix(n, target) || isWordPrefix(target, n);
  });
  return partial.length === 1 ? partial[0] : null;
};
