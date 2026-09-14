// Auto-generated Employee IDs for User Management's "Add New User" flow.
// Two independent sequences, both starting at 100 — EMP-100, EMP-101, … for
// everyone else, EMPD-100, EMPD-101, … for doctors — tracked by a persistent
// counter document rather than derived from existing users' IDs, so deleting
// a user never frees up their number for reuse.
import { db } from './firebase';
import { doc, getDoc, runTransaction } from 'firebase/firestore';

const COUNTER_DOC = doc(db, 'settings', 'employee_id_counters');
const START = 100;

const format = (isDoctor, n) => (isDoctor ? `EMPD-${n}` : `EMP-${n}`);

// Read-only peek at what the next ID would currently be — for showing a live
// preview in the form without reserving/consuming a number. Two admins
// adding users at the same moment could both preview the same value; that's
// fine, since assignNextEmployeeId (called on actual save) is what really
// locks one in via a transaction.
export const peekNextEmployeeId = async (isDoctor) => {
  const snap = await getDoc(COUNTER_DOC);
  const data = snap.exists() ? snap.data() : {};
  const field = isDoctor ? 'empd' : 'emp';
  return format(isDoctor, data[field] ?? START);
};

// Atomically reserves and returns the next ID for the given sequence. Only
// ever increases — once issued (or even just reserved by a save that
// succeeds), a number is never handed out again, even if that user is later
// deleted.
export const assignNextEmployeeId = async (isDoctor) => {
  const field = isDoctor ? 'empd' : 'emp';
  const current = await runTransaction(db, async (tx) => {
    const snap = await tx.get(COUNTER_DOC);
    const value = snap.exists() ? (snap.data()[field] ?? START) : START;
    tx.set(COUNTER_DOC, { [field]: value + 1 }, { merge: true });
    return value;
  });
  return format(isDoctor, current);
};
