import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

// A single shared toggle so the Administration section (P&L, Financials, HR
// & Payroll, User Activity, User Management, Database Backup) can be hidden
// from the sidebar for everyone currently using the one shared admin login —
// without touching anyone's actual permissions — until individual staff
// logins are in place. Firestore-backed (not localStorage) so flipping it
// applies everywhere at once, on every device already logged in as admin.
//
// Hidden is the default: the field only ever reads as "shown" when it's been
// explicitly set to false (via the passcode-gated toggle). No document yet,
// a missing field, or any load error all fall back to hidden — so a brand
// new admin login, or one on a device that's never touched this setting,
// starts locked down rather than briefly (or permanently) exposed.
export const subscribeAdminSectionHidden = (callback) => {
  return onSnapshot(
    doc(db, 'settings', 'app_config'),
    (snap) => callback(snap.data()?.hide_admin_section !== false),
    (error) => {
      console.error('Error loading admin-section visibility setting:', error);
      callback(true);
    }
  );
};

export const setAdminSectionHidden = (hidden) =>
  setDoc(doc(db, 'settings', 'app_config'), { hide_admin_section: hidden }, { merge: true });

// "Books start" dates for Profit & Loss and Financials. Entries (invoices, medicine
// sales, expenses, mess expenses, payroll) dated before a start date are left out of
// that report only — nothing is deleted, everything stays on its own page. An empty
// string means "no cut-off". Stored in settings/books_config, which Firestore rules
// let only admin roles write (see firestore.rules); everyone signed in can read it.
export const DEFAULT_PL_START_DATE = '2026-10-16';
export const DEFAULT_FINANCIALS_START_DATE = '2026-11-01';

const BOOKS_REF = () => doc(db, 'settings', 'books_config');

const readBooksConfig = async () => {
  const [books, legacy] = await Promise.all([
    getDoc(BOOKS_REF()),
    getDoc(doc(db, 'settings', 'app_config')), // older location of the P&L date
  ]);
  return { books: books.data() || {}, legacy: legacy.data() || {} };
};

export const getPLStartDate = async () => {
  try {
    const { books, legacy } = await readBooksConfig();
    if (typeof books.pl_start_date === 'string') return books.pl_start_date;
    if (typeof legacy.pl_start_date === 'string') return legacy.pl_start_date;
    return DEFAULT_PL_START_DATE;
  } catch (error) {
    console.error('Error loading P&L start date:', error);
    return DEFAULT_PL_START_DATE;
  }
};

export const setPLStartDate = (dateStr) =>
  setDoc(BOOKS_REF(), { pl_start_date: dateStr || '' }, { merge: true });

export const getFinancialsStartDate = async () => {
  try {
    const { books } = await readBooksConfig();
    return typeof books.financials_start_date === 'string' ? books.financials_start_date : DEFAULT_FINANCIALS_START_DATE;
  } catch (error) {
    console.error('Error loading Financials start date:', error);
    return DEFAULT_FINANCIALS_START_DATE;
  }
};

export const setFinancialsStartDate = (dateStr) =>
  setDoc(BOOKS_REF(), { financials_start_date: dateStr || '' }, { merge: true });
