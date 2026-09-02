// Booking an IP-type appointment for a caller who isn't a registered patient
// yet — create a bare-bones pending-admission record right away so Pending
// Admissions reflects the call immediately; front desk fills in the rest of
// the file once the patient actually arrives (same fields New Patient
// Registration would set for a fresh IP registration). Shared by Dashboard's
// and Scheduling's "Add Appointment" flows so both create records the same
// way from the same numbering sequence.
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generateMRDNumber, generateIPNumber, generatePatientNumber } from './patientNumbers';

// Returns the new patient doc's id — callers must link it back onto the
// appointment as patient_id, so the appointment is treated as "for a known
// patient" everywhere else in the app (most importantly, Dashboard's "Called
// In / In the Office" walk-in flow only fires for appointments with no
// patient_id; without the link it would register a second, disconnected
// patient the moment front desk processes the walk-in, leaving this
// placeholder orphaned at pending_admission forever).
export const createPendingIPPatient = async (name, phone) => {
  const trimmed = (name || '').trim();
  const [first_name, ...rest] = trimmed.split(/\s+/);
  const last_name = rest.join(' ');
  const [patientNumber, mrdNumber, ipNumber] = await Promise.all([
    generatePatientNumber(),
    generateMRDNumber(),
    generateIPNumber(),
  ]);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const docRef = await addDoc(collection(db, 'patients'), {
    first_name: first_name || trimmed,
    last_name,
    phone: phone || '',
    patient_type: 'IP',
    admission_status: 'pending_admission',
    patient_number: patientNumber,
    mrd_number: mrdNumber,
    ip_number: ipNumber,
    prescriptions: [],
    visits: [],
    last_visit_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    created_by: currentUser.email || 'admin',
  });
  return docRef.id;
};
