import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Rooms held by every currently-admitted IP patient (optionally excluding one
// patient, e.g. the patient whose own case sheet is being edited) — so room
// pickers only ever offer rooms that are actually free right now.
export const getOccupiedRooms = async (excludePatientId) => {
  const patientsSnap = await getDocs(query(collection(db, 'patients'), where('patient_type', '==', 'IP')));
  const activeIds = patientsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.id !== excludePatientId && p.admission_status !== 'pending_admission' && p.admission_status !== 'discharged')
    .map(p => p.id);
  if (activeIds.length === 0) return new Set();

  const caseSheetsSnap = await getDocs(collection(db, 'ip_case_sheets'));
  const occupied = new Set();
  caseSheetsSnap.docs.forEach(d => {
    if (activeIds.includes(d.id) && d.data().room_number) occupied.add(d.data().room_number);
  });
  return occupied;
};
