import { db } from './firebase';
import { collection, getDocs, getDoc, setDoc, doc, query, where } from 'firebase/firestore';

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

// The room (and A/C vs Non-A/C type) this patient's most recent IP
// appointment was booked into, if that room is still actually free — the
// appointment's own availability check only looks at admitted patients, so a
// different pending admission could have claimed it since. Returns
// { number: '', type: '' } when there's no booked room or it was taken in
// the meantime.
export const getReservedRoomForPatient = async (patientId) => {
  const apptSnap = await getDocs(query(collection(db, 'appointments'), where('patient_id', '==', patientId), where('type', '==', 'IP')));
  const withRoom = apptSnap.docs.map(d => d.data()).filter(a => a.room_number);
  withRoom.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const booked = withRoom[0];
  if (!booked?.room_number) return { number: '', type: '' };
  const occupied = await getOccupiedRooms(patientId);
  return occupied.has(booked.room_number) ? { number: '', type: '' } : { number: booked.room_number, type: booked.room_type || '' };
};

// Called the moment a pending IP patient is actually admitted (Patient
// Portal's Admit button), so the room they were booked into shows up on
// Room Management right away — without this, occupancy only ever comes
// from the IP Case Sheet, which stays blank until staff separately open and
// save it, so a patient could be marked "admitted" with nowhere shown as
// occupied. Never overwrites a room already recorded on an existing case
// sheet (e.g. staff picked a different one there before admitting).
export const applyReservedRoomOnAdmission = async (patientId, patient) => {
  const { number: roomNumber, type: roomType } = await getReservedRoomForPatient(patientId);
  if (!roomNumber) return;
  const existing = await getDoc(doc(db, 'ip_case_sheets', patientId));
  if (existing.exists() && existing.data().room_number) return;
  await setDoc(doc(db, 'ip_case_sheets', patientId), {
    room_number: roomNumber,
    room_type: roomType,
    ...(existing.exists() ? {} : {
      admission_date: patient?.admission_date || '',
      physician_name: patient?.assigned_doctor || '',
    }),
  }, { merge: true });
};
