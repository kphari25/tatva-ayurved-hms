// Invoice numbers (invoices) and medicine sale bill numbers (medicine_sales)
// both print as "A" + a zero-padded number. They used to be worked out as
// "A" + (number of documents in that collection + 1), which hands out the
// same number twice whenever two saves overlap or a document is deleted, and
// since both series counted separately, an invoice and a pharmacy bill could
// carry the very same "A0123".
//
// Both now draw from ONE shared counter document, reserved atomically in a
// Firestore transaction (same pattern as employeeId.js), so every "A" number
// is issued exactly once across invoices and bills. The first time it runs
// the counter is seeded from the highest "A" number already used in either
// collection, so new numbers always continue after existing ones.
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, runTransaction } from 'firebase/firestore';

const COUNTER_DOC = doc(db, 'settings', 'document_number_counters');
const FIELD = 'a_series_next';

const format = (n) => `A${String(n).padStart(4, '0')}`;

const highestUsed = async () => {
  const [invSnap, saleSnap] = await Promise.all([
    getDocs(collection(db, 'invoices')),
    getDocs(collection(db, 'medicine_sales')),
  ]);
  let max = 0;
  const consider = (value) => {
    const m = /^A(\d+)$/.exec(String(value || '').trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  };
  invSnap.docs.forEach(d => consider(d.data().invoice_number));
  saleSnap.docs.forEach(d => consider(d.data().bill_number));
  // Also never go below either collection's size, matching the old scheme.
  return Math.max(max, invSnap.size, saleSnap.size);
};

// Read-only look at the number the next save would get — for "Preview &
// Print" before saving. Not reserved: the printout is marked DRAFT.
export const peekNextDocumentNumber = async () => {
  const snap = await getDoc(COUNTER_DOC);
  const next = snap.exists() ? snap.data()[FIELD] : undefined;
  return format(Number.isFinite(next) ? next : (await highestUsed()) + 1);
};

// Atomically reserves and returns the next "A" number. Call only when the
// invoice / bill is actually being saved.
export const reserveNextDocumentNumber = async () => {
  const pre = await getDoc(COUNTER_DOC);
  const seed = pre.exists() && Number.isFinite(pre.data()[FIELD]) ? null : (await highestUsed()) + 1;
  const value = await runTransaction(db, async (tx) => {
    const snap = await tx.get(COUNTER_DOC);
    const stored = snap.exists() ? snap.data()[FIELD] : undefined;
    const current = Number.isFinite(stored) ? stored : seed;
    tx.set(COUNTER_DOC, { [FIELD]: current + 1 }, { merge: true });
    return current;
  });
  return format(value);
};
