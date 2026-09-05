import { loadDoctorsList } from './doctors';

// Doctors for dropdowns (Case Sheets, etc). This used to read only the HR
// staff directory (hr_employees) — but a doctor added via User Management
// (a users login, role 'doctor') never gets an hr_employees record too, so
// they'd silently never show up here. loadDoctorsList merges both sources.
export const loadDoctors = async () => {
  try {
    return await loadDoctorsList();
  } catch (e) {
    console.error('Error loading doctors:', e);
    return [];
  }
};
