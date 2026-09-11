import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

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
