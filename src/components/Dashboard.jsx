import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Users, Bed, LogOut, IndianRupee, Clock, Phone, AlertCircle, TrendingUp, Activity, CheckCircle, XCircle, Trash2, Plus, X, Pencil, Search } from 'lucide-react';
import { collection, getDocs, getDoc, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDateOnly, addDaysToDateString } from '../lib/formatDate';
import { sendAppointmentSMSToPatient } from '../lib/sms';
import { APPOINTMENT_BUCKETS, bucketForAppointment, APPOINTMENT_TYPE_COLORS, colorForAppointment, APPOINTMENT_TYPE_OPTIONS } from '../lib/appointmentBuckets';
import { createPendingIPPatient } from '../lib/pendingIPPatient';
import { withDrPrefix } from '../lib/formatDoctorName';
import PatientRegistrationNew from './PatientRegistrationNew';
import TherapistMultiSelect, { toggleTherapistInFields } from './TherapistMultiSelect';

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getIndiaHour = () =>
  parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()), 10);

const getGreeting = () => {
  const hour = getIndiaHour();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const getWeekRange = (d) => {
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [monday, sunday];
};

const getMonthRange = (d) => [
  new Date(d.getFullYear(), d.getMonth(), 1),
  new Date(d.getFullYear(), d.getMonth() + 1, 0)
];

const formatGroupDate = (dateStr) => {
  const today = toDateStr(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === today) return 'Today';
  if (dateStr === toDateStr(tomorrow)) return 'Tomorrow';
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const AddAppointmentModal = ({ appointment, onClose, onSave, saving, doctors = [], therapists = [], patients = [], onPickExistingPatient }) => {
  const isEditMode = !!appointment;
  const [formData, setFormData] = useState({
    patient: appointment?.patient || '',
    phone: appointment?.phone || '',
    date: appointment?.date || toDateStr(new Date()),
    time: appointment?.time || '',
    type: appointment?.type || '',
    doctorId: appointment?.doctorId || '',
    doctorName: appointment?.doctorName || '',
    therapistIds: appointment?.therapistIds || (appointment?.therapistId ? [appointment.therapistId] : []),
    therapistNames: appointment?.therapistNames || (appointment?.therapistName ? [appointment.therapistName] : []),
    sendSms: false,
  });
  const [error, setError] = useState('');

  // Existing-patient search on the Patient Name field — new appointments
  // only; editing an already-booked appointment keeps the plain text field,
  // since it's not tied to a real patient record either way.
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const patientFieldRef = useRef(null);

  useEffect(() => {
    if (isEditMode) return;
    const handler = (e) => {
      if (patientFieldRef.current && !patientFieldRef.current.contains(e.target)) setShowPatientDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEditMode]);

  const handlePatientNameChange = (value) => {
    setFormData(f => ({ ...f, patient: value }));
    if (isEditMode || value.trim().length < 2) { setPatientSuggestions([]); setShowPatientDrop(false); return; }
    const q = value.trim().toLowerCase();
    const matches = patients.filter(p => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      return fullName.includes(q) || (p.mrd_number || '').toLowerCase().includes(q) || (p.phone || '').includes(q);
    }).slice(0, 8);
    setPatientSuggestions(matches);
    setShowPatientDrop(true);
  };

  // Picking an existing match hands off to the full patient edit dialog
  // (same fields as New Patient Registration, pre-filled) instead of just
  // filling in this form — the appointment itself gets booked once that's
  // saved, using whatever name/phone the patient record ends up with.
  const handleSelectExistingPatient = (p) => {
    setShowPatientDrop(false);
    setPatientSuggestions([]);
    if (onPickExistingPatient) {
      onPickExistingPatient(p, {
        date: formData.date,
        time: formData.time,
        type: formData.type,
        doctorId: formData.doctorId,
        doctorName: formData.doctorName,
        therapistIds: formData.therapistIds,
        therapistNames: formData.therapistNames,
        sendSms: formData.sendSms,
      });
    }
  };

  const handleDoctorChange = (e) => {
    const selected = doctors.find(d => d.id === e.target.value);
    setFormData({
      ...formData,
      doctorId: selected ? selected.id : '',
      doctorName: selected ? selected.name : '',
    });
  };

  const handleToggleTherapist = (t) => setFormData(f => toggleTherapistInFields(f, t));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.patient.trim() || !formData.date || !formData.time) {
      setError('Patient name, date and time are required.');
      return;
    }
    if (formData.sendSms && !formData.phone.trim()) {
      setError('Phone number is required to send an SMS confirmation.');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">{isEditMode ? 'Edit Appointment' : 'Add Appointment'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="relative" ref={patientFieldRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
            <div className="relative">
              {!isEditMode && <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
              <input
                type="text"
                value={formData.patient}
                onChange={(e) => handlePatientNameChange(e.target.value)}
                onFocus={() => !isEditMode && patientSuggestions.length > 0 && setShowPatientDrop(true)}
                className={`w-full border border-gray-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isEditMode ? 'pl-9 pr-3' : 'px-3'}`}
                placeholder={isEditMode ? 'e.g. Anjali Menon' : 'Search existing patients or type a new name…'}
              />
            </div>
            {!isEditMode && showPatientDrop && patientSuggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                {patientSuggestions.map(p => (
                  <div
                    key={p.firebaseId || p.id}
                    onMouseDown={() => handleSelectExistingPatient(p)}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                  >
                    <div className="font-medium text-sm text-gray-900">{p.first_name} {p.last_name}</div>
                    <div className="text-xs text-gray-500 flex gap-3">
                      {p.mrd_number && <span>{p.mrd_number}</span>}
                      {p.phone && <span>📞 {p.phone}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 9876543210"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select Type —</option>
              {APPOINTMENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🩺 Doctor</label>
            <select
              value={formData.doctorId}
              onChange={handleDoctorChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— No Doctor Assigned —</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.designation ? ` (${d.designation})` : ''}</option>
              ))}
            </select>
          </div>
          <TherapistMultiSelect therapists={therapists} selectedIds={formData.therapistIds} onToggle={handleToggleTherapist} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.sendSms}
              onChange={(e) => setFormData({ ...formData, sendSms: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {isEditMode ? 'Send updated SMS to patient' : 'Send SMS confirmation to patient'}
          </label>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Doctors only see patients/appointments assigned to them; every other role
// (front desk, admin, etc.) keeps the full clinic-wide view. Assignment is
// name-string based (appointments.doctorName, patients.assigned_doctor) since
// neither field carries a doctorId — matched case/whitespace-insensitively so
// a logged-in doctor's account name doesn't have to be byte-for-byte identical
// to how they were typed in when assigned. If a doctor's login name doesn't
// match the spelling used when assigning them, their lists will show empty.
const normName = (s) => (s || '').trim().toLowerCase();

// Second step of the "existing patient" appointment flow — collects Time /
// Type / Doctor / SMS for the visit once the patient's own info has been
// confirmed. Kept separate from AddAppointmentModal because those fields
// live below the Patient Name search field there, so a front-desk user who
// picks a match before touching them would otherwise book a blank-time
// appointment with no chance to fill them in.
const ScheduleExistingPatientModal = ({ patient, initialFields, doctors = [], therapists = [], onCancel, onConfirm, saving }) => {
  const [fields, setFields] = useState({
    date: initialFields?.date || toDateStr(new Date()),
    time: initialFields?.time || '',
    type: initialFields?.type || '',
    doctorId: initialFields?.doctorId || '',
    doctorName: initialFields?.doctorName || '',
    therapistIds: initialFields?.therapistIds || [],
    therapistNames: initialFields?.therapistNames || [],
    sendSms: initialFields?.sendSms || false,
  });
  const [error, setError] = useState('');

  const handleDoctorChange = (e) => {
    const selected = doctors.find(d => d.id === e.target.value);
    setFields(f => ({ ...f, doctorId: selected ? selected.id : '', doctorName: selected ? selected.name : '' }));
  };

  const handleToggleTherapist = (t) => setFields(f => toggleTherapistInFields(f, t));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fields.date || !fields.time) {
      setError('Date and time are required.');
      return;
    }
    onConfirm(fields);
  };

  const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Schedule Visit</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Booking for <span className="font-medium text-gray-700">{patientName}</span>
            {patient?.mrd_number && <span className="text-gray-400"> · {patient.mrd_number}</span>}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={fields.date}
                onChange={(e) => setFields({ ...fields, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={fields.time}
                onChange={(e) => setFields({ ...fields, time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
            <select
              value={fields.type}
              onChange={(e) => setFields({ ...fields, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select Type —</option>
              {APPOINTMENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🩺 Doctor</label>
            <select
              value={fields.doctorId}
              onChange={handleDoctorChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— No Doctor Assigned —</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.designation ? ` (${d.designation})` : ''}</option>
              ))}
            </select>
          </div>
          <TherapistMultiSelect therapists={therapists} selectedIds={fields.therapistIds} onToggle={handleToggleTherapist} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={fields.sendSms}
              onChange={(e) => setFields({ ...fields, sendSms: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Send SMS confirmation to patient
          </label>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [showPendingAdmissions, setShowPendingAdmissions] = useState(false);
  // Picking an existing patient while adding an appointment hands off to
  // their full edit dialog (see AddAppointmentModal's onPickExistingPatient),
  // then to a dedicated ScheduleExistingPatientModal step once that's saved
  // — see handlePatientConfirmedForAppt for why Time/Type/Doctor are
  // collected separately rather than trusted from the initial small form.
  const [existingPatientForAppt, setExistingPatientForAppt] = useState(null);
  const [pendingApptFields, setPendingApptFields] = useState(null);
  const [scheduleForPatient, setScheduleForPatient] = useState(null);
  const [bookingForExistingPatient, setBookingForExistingPatient] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [greeting, setGreeting] = useState(getGreeting());
  const [appointmentView, setAppointmentView] = useState('daily'); // daily | weekly | monthly
  const [panelAppointments, setPanelAppointments] = useState([]);
  // Checked-in and cancelled appointments drop off the board entirely (see
  // handleCheckInAppointment / handleCancelAppointment) rather than just
  // changing badge color — front desk wants the board to reflect who's
  // still waiting, not everyone booked or a no-show that's been dealt with.
  const visibleAppointments = useMemo(
    () => panelAppointments.filter(apt => apt.status !== 'checked_in' && apt.status !== 'cancelled'),
    [panelAppointments]
  );
  // Live patients snapshot (admission_date / expected_stay_days come from
  // Patient Portal) — In-Patient Status and Discharges Today are derived
  // from this in real time instead of a one-time fetch.
  const [allPatients, setAllPatients] = useState([]);
  const [ipCaseSheetsById, setIpCaseSheetsById] = useState({});
  const [allDischarges, setAllDischarges] = useState([]);
  const [ipAppointments, setIpAppointments] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    todayAppointments: [],
    ipPatients: [],
    pendingAdmissions: [],
    todayDischarges: [],
    outstandingPayments: [],
    leads: [],
    stats: {
      totalAppointments: 0,
      ipPatientsCount: 0,
      pendingAdmissionsCount: 0,
      todayDischargesCount: 0,
      outstandingAmount: 0,
      hotLeads: 0
    }
  });

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch { return {}; }
  }, []);
  const isDoctorView = currentUser.role === 'doctor';
  const myName = normName(currentUser.name);
  const isMine = (doctorField) => !isDoctorView || normName(doctorField) === myName;

  useEffect(() => {
    loadDashboardData();
    // Load doctors from HR employees
    const DOCTOR_KEYWORDS = ['doctor', 'physician', 'consultant', 'vaidya', 'surgeon', 'rmo', 'medical'];
    getDocs(collection(db, 'hr_employees')).then(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(e => {
          const h = `${e.department || ''} ${e.designation || ''} ${e.role || ''}`.toLowerCase();
          return DOCTOR_KEYWORDS.some(k => h.includes(k));
        })
        .map(e => ({
          id: e.id,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.name || '',
          designation: e.designation || e.department || '',
        }));
      setDoctors(docs);
    }).catch(() => {});

    // Load the full therapist roster (so idle therapists show up as
    // "available" too, not just ones with an appointment today).
    getDocs(query(collection(db, 'users'), where('role', '==', 'therapist'))).then(snap => {
      setTherapists(snap.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email || 'Therapist' })));
    }).catch(() => {});

    // Real-time listener for today's appointments — use the local calendar
    // date (toDateStr), not toISOString's UTC date, which rolls over to
    // tomorrow hours before local midnight in negative-UTC-offset zones and
    // silently undercounts appointments booked for "today".
    const today = toDateStr(new Date());
    const unsubscribe = onSnapshot(
      query(collection(db, 'appointments'), where('date', '==', today)),
      (snap) => {
        const appts = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        setTodayAppointments(appts);
        setDashboardData(prev => ({
          ...prev,
          // Excludes checked-in/cancelled, same as visibleAppointments below
          // — this stat is captioned "Scheduled patients", and someone
          // who's already arrived (or didn't show) isn't still "scheduled".
          stats: { ...prev.stats, totalAppointments: appts.filter(a => a.status !== 'checked_in' && a.status !== 'cancelled').length },
        }));
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time listener for patients — In-Patient Status / Pending Admissions
  // stay in sync the moment admission_date, expected_stay_days or
  // admission_status changes in Patient Portal, without needing a manual
  // Dashboard refresh.
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'patients'), (snap) => {
      setAllPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    getDocs(collection(db, 'ip_case_sheets')).then(snap => {
      const byId = {};
      snap.docs.forEach(d => { byId[d.id] = d.data(); });
      setIpCaseSheetsById(byId);
    }).catch(() => {});
    return () => unsubscribe();
  }, []);

  // Real-time listener for discharge records — Discharges Today reflects
  // patients actually discharged today (Discharge Management's own
  // discharges collection), not just an admission-time estimate of when
  // they'd likely check out, so it updates the moment front desk saves or
  // completes a discharge.
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'discharges'), (snap) => {
      setAllDischarges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for IP-type appointments — Pending Admissions shows
  // the date each patient is actually due to be admitted (the appointment
  // they were booked in for), not just when the pending record was created.
  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'appointments'), where('type', '==', 'IP')), (snap) => {
      setIpAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Recomputes In-Patient Status / Pending Admissions / Discharges Today
  // whenever the live patients snapshot (or the once-loaded case sheet
  // lookup) changes.
  useEffect(() => {
    if (allPatients.length === 0) return;
    const today = toDateStr(new Date());

    // Currently-admitted IP patients: real patient_type field, excluding
    // ones still awaiting admission approval or already discharged.
    // Patients registered before admission_status existed have neither
    // value set — treat them as already-admitted rather than dropping
    // them from the list.
    const ipPatients = allPatients
      .filter(p => p.patient_type === 'IP' && p.admission_status !== 'pending_admission' && p.admission_status !== 'discharged')
      .filter(p => isMine(p.assigned_doctor))
      .map(p => {
        const cs = ipCaseSheetsById[p.id] || {};
        const admissionDate = p.admission_date || p.created_at;
        const expectedStayDays = p.expected_stay_days != null ? Number(p.expected_stay_days) : null;
        const checkoutDate = admissionDate && expectedStayDays != null
          ? addDaysToDateString(admissionDate, expectedStayDays)
          : null;
        return {
          id: p.id,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          room: cs.room_number ? `Room ${cs.room_number}` : [cs.ward, cs.bed_no ? `Bed ${cs.bed_no}` : null].filter(Boolean).join(' · ') || '—',
          admission: admissionDate,
          diagnosis: cs.admin_diagnosis || '—',
          daysAdmitted: admissionDate ? Math.max(0, Math.floor((Date.now() - new Date(admissionDate)) / (1000 * 60 * 60 * 24))) : null,
          expectedStayDays,
          checkoutDate,
        };
      });

    // Pending admission requests — new IP registrations awaiting approval.
    // admissionDate comes from whichever IP appointment this patient is
    // linked to (patient_id) — the date they actually said they'd come in —
    // falling back to when the pending record itself was created for the
    // rare case of a patient registered directly with no booked appointment.
    const pendingAdmissions = allPatients
      .filter(p => p.patient_type === 'IP' && p.admission_status === 'pending_admission')
      .filter(p => isMine(p.assigned_doctor))
      .map(p => {
        const linkedAppt = ipAppointments.find(a => a.patient_id === p.id);
        return {
          id: p.id,
          patient: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          mrd_number: p.mrd_number || p.patient_number || '',
          admissionDate: linkedAppt?.date || null,
          requested_at: p.created_at,
        };
      })
      .sort((a, b) => (a.admissionDate || '9999-99-99').localeCompare(b.admissionDate || '9999-99-99'));

    // Discharges Today — patients actually discharged today, from Discharge
    // Management's own discharges collection (real-time via the listener
    // above), not the admission-time estimate (admission_date +
    // expected_stay_days) used to still drive this — that's a forward
    // planning guess that's rarely revised, and could silently drift from
    // what actually happened.
    const patientsById = {};
    allPatients.forEach(p => { patientsById[p.id] = p; });
    const todayDischarges = allDischarges
      .filter(d => d.discharge_date === today)
      .filter(d => isMine(patientsById[d.patient_id]?.assigned_doctor))
      .map(d => ({
        id: d.id,
        patientId: d.patient_id,
        name: d.patient_name || `${patientsById[d.patient_id]?.first_name || ''} ${patientsById[d.patient_id]?.last_name || ''}`.trim() || 'Unknown',
        status: d.status || 'pending',
        pendingAmount: d.pending_amount || 0,
      }));

    setDashboardData(prev => ({
      ...prev,
      ipPatients,
      pendingAdmissions,
      todayDischarges,
      stats: {
        ...prev.stats,
        ipPatientsCount: ipPatients.length,
        pendingAdmissionsCount: pendingAdmissions.length,
        todayDischargesCount: todayDischarges.length,
      }
    }));
  }, [allPatients, ipCaseSheetsById, allDischarges, ipAppointments]);

  // Therapist schedule — derived from the full roster + today's appointments,
  // so it stays correct regardless of which of those two loads/updates first
  // (previously this was clobbered by a separate effect that reset it to []).
  useEffect(() => {
    const sessionsByTherapist = {};
    todayAppointments.forEach(a => {
      const ids = (a.therapistIds && a.therapistIds.length) ? a.therapistIds : (a.therapistId ? [a.therapistId] : []);
      ids.forEach(id => {
        if (!sessionsByTherapist[id]) sessionsByTherapist[id] = { sessions: 0, nextSlot: null };
        sessionsByTherapist[id].sessions += 1;
        if (!sessionsByTherapist[id].nextSlot) sessionsByTherapist[id].nextSlot = a.time;
      });
    });
    const therapistSchedule = therapists.map(t => {
      const s = sessionsByTherapist[t.id];
      return {
        id: t.id,
        therapist: t.name,
        sessions: s ? s.sessions : 0,
        nextSlot: s ? s.nextSlot : null,
        availability: s && s.sessions > 0 ? 'busy' : 'available',
      };
    });
    setDashboardData(prev => ({ ...prev, therapistSchedule }));
  }, [todayAppointments, therapists]);

  // Keep the greeting in sync with the current time in India
  useEffect(() => {
    const interval = setInterval(() => setGreeting(getGreeting()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Appointments panel: refetch whenever the daily/weekly/monthly tab changes
  useEffect(() => {
    const now = new Date();
    let start = now, end = now;
    if (appointmentView === 'weekly') {
      [start, end] = getWeekRange(now);
    } else if (appointmentView === 'monthly') {
      [start, end] = getMonthRange(now);
    }
    const startStr = toDateStr(start);
    const endStr = toDateStr(end);

    const unsubscribe = onSnapshot(
      query(collection(db, 'appointments'), where('date', '>=', startStr), where('date', '<=', endStr)),
      (snap) => {
        const appts = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => isMine(a.doctorName))
          .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
        setPanelAppointments(appts);
      }
    );

    return () => unsubscribe();
  }, [appointmentView]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Patients / IP case sheets are handled by the real-time listeners
      // above; appointments by their own listener too.
      const [invoices, leads] = await Promise.all([
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'leads')),
      ]);

      const invoicesData = invoices.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const leadsData = leads.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate outstanding payments
      const outstanding = invoicesData
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);

      // Get hot leads
      const hotLeads = leadsData.filter(l => l.priority === 'hot' && l.status !== 'converted');

      // Get pending follow-ups
      const pendingFollowups = leadsData.filter(l =>
        l.next_followup &&
        new Date(l.next_followup) <= new Date() &&
        l.status !== 'converted'
      );

      // Lead → patient conversion snapshot (same formula LeadManagement.jsx
      // already uses for its own stat card).
      const convertedLeads = leadsData.filter(l => l.status === 'converted');
      const conversionRate = leadsData.length > 0
        ? ((convertedLeads.length / leadsData.length) * 100).toFixed(1)
        : 0;

      setDashboardData(prev => ({
        ...prev,
        outstandingPayments: invoicesData.filter(inv => inv.status !== 'paid'),
        leads: pendingFollowups,
        stats: {
          ...prev.stats,
          outstandingAmount: outstanding,
          hotLeads: hotLeads.length,
          pendingFollowups: pendingFollowups.length,
          totalLeads: leadsData.length,
          convertedLeads: convertedLeads.length,
          conversionRate,
        }
      }));

      console.log('✅ Dashboard data loaded');

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAppointment = async (aptId) => {
    if (!window.confirm('Remove this appointment?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', aptId));
      // onSnapshot listener will update todayAppointments automatically
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Failed to delete appointment. Please try again.');
    }
  };

  // Mirrors a phone call-in appointment into Lead Management, linked via
  // lead_id/appointment_id on each doc, so front desk call volume and
  // conversion rate show up there too instead of living only on the
  // Dashboard. Also used to lazily backfill a lead for an appointment that
  // was created before this link existed.
  const createLinkedLead = async (appointmentId, { patient, phone, type }, status) => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const leadRef = await addDoc(collection(db, 'leads'), {
      name: patient,
      phone: phone || '',
      email: '',
      source: 'phone',
      interest: type || '',
      priority: 'warm',
      status,
      notes: 'Auto-created from Dashboard appointment',
      appointment_id: appointmentId,
      created_at: new Date().toISOString(),
      created_by: currentUser.email || '',
      ...(status === 'converted' ? { converted_at: new Date().toISOString() } : {}),
    });
    await updateDoc(doc(db, 'appointments', appointmentId), { lead_id: leadRef.id });
    return leadRef.id;
  };

  const saveAppointment = async (formData) => {
    const isEditMode = !!editingAppointment;
    try {
      setSavingAppointment(true);

      if (isEditMode) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), {
          patient: formData.patient,
          phone: formData.phone || '',
          date: formData.date,
          time: formData.time,
          type: formData.type,
          doctorId: formData.doctorId || '',
          doctorName: formData.doctorName || '',
          therapistIds: formData.therapistIds || [],
          therapistNames: formData.therapistNames || [],
        });

        if (editingAppointment.lead_id) {
          try {
            await updateDoc(doc(db, 'leads', editingAppointment.lead_id), {
              name: formData.patient,
              phone: formData.phone || '',
              interest: formData.type || '',
            });
          } catch (leadError) {
            console.error('⚠️ Failed to sync linked lead:', leadError);
          }
        }
      } else {
        const apptRef = await addDoc(collection(db, 'appointments'), {
          patient: formData.patient,
          phone: formData.phone || '',
          time: formData.time,
          type: formData.type,
          status: 'scheduled',
          contact_status: 'called_in',
          date: formData.date,
          doctorId: formData.doctorId || '',
          doctorName: formData.doctorName || '',
          therapistIds: formData.therapistIds || [],
          therapistNames: formData.therapistNames || [],
          createdAt: new Date().toISOString()
        });

        try {
          await createLinkedLead(apptRef.id, { patient: formData.patient, phone: formData.phone, type: formData.type }, 'new');
        } catch (leadError) {
          console.error('⚠️ Failed to create linked lead:', leadError);
        }

        if (formData.type === 'IP') {
          try {
            const newPatientId = await createPendingIPPatient(formData.patient, formData.phone);
            await updateDoc(doc(db, 'appointments', apptRef.id), { patient_id: newPatientId });
          } catch (patientError) {
            console.error('⚠️ Failed to create pending-admission patient record:', patientError);
          }
        }
      }

      if (formData.sendSms && formData.phone) {
        try {
          const result = await sendAppointmentSMSToPatient(formData.phone, formData.patient, {
            appointmentType: formData.type || 'appointment',
            doctorName: formData.doctorName || 'our team',
            date: formData.date,
            time: formData.time,
          });
          if (!result.success) console.warn('Appointment SMS not sent:', result.error);
        } catch (smsError) {
          console.error('⚠️ Failed to send appointment SMS:', smsError);
        }
      }

      setShowAddAppointment(false);
      setEditingAppointment(null);
      await loadDashboardData();
    } catch (error) {
      console.error('Error saving appointment:', error);
      alert('Failed to save appointment. Please try again.');
    } finally {
      setSavingAppointment(false);
    }
  };

  // AddAppointmentModal's search matched an existing patient — swap it for
  // the full edit dialog (pre-filled), holding onto the appointment fields
  // already typed in (time/type/doctor/SMS) until that dialog reports back.
  const handlePickExistingPatientForAppt = (patient, apptFields) => {
    setShowAddAppointment(false);
    setExistingPatientForAppt(patient);
    setPendingApptFields(apptFields);
  };

  const cancelExistingPatientAppt = () => {
    setExistingPatientForAppt(null);
    setPendingApptFields(null);
  };

  // Fires once the patient edit dialog saves successfully — re-reads the
  // patient doc (name/phone may have just been updated in that dialog) and
  // moves to the Schedule Visit step, rather than booking immediately: the
  // Time/Type/Doctor fields the user may have typed into the small form
  // before searching for this patient are easy to have skipped entirely
  // (Patient Name is the first field), so they're confirmed explicitly here
  // instead of silently booking a blank-time appointment.
  const handlePatientConfirmedForAppt = async () => {
    const patient = existingPatientForAppt;
    setExistingPatientForAppt(null);
    if (!patient) return;
    const patientId = patient.firebaseId || patient.id;
    try {
      const snap = await getDoc(doc(db, 'patients', patientId));
      const p = snap.exists() ? { id: patientId, firebaseId: patientId, ...snap.data() } : patient;
      setScheduleForPatient(p);
    } catch (error) {
      console.error('Error reloading patient before scheduling:', error);
      setScheduleForPatient(patient);
    }
  };

  const cancelScheduleForExistingPatient = () => {
    setScheduleForPatient(null);
    setPendingApptFields(null);
  };

  // No linked lead here: unlike a brand-new name typed into the quick form,
  // this is already a registered patient.
  const bookAppointmentForExistingPatient = async (fields) => {
    const p = scheduleForPatient;
    cancelScheduleForExistingPatient();
    if (!p || !fields?.date || !fields?.time) return;
    const patientId = p.firebaseId || p.id;
    try {
      setBookingForExistingPatient(true);
      const patientName = `${p.first_name || ''} ${p.last_name || ''}`.trim();

      await addDoc(collection(db, 'appointments'), {
        patient: patientName,
        patient_id: patientId,
        phone: p.phone || '',
        time: fields.time,
        type: fields.type || '',
        status: 'scheduled',
        contact_status: 'called_in',
        date: fields.date,
        doctorId: fields.doctorId || '',
        doctorName: fields.doctorName || '',
        therapistIds: fields.therapistIds || [],
        therapistNames: fields.therapistNames || [],
        createdAt: new Date().toISOString(),
      });

      if (fields.type === 'IP' && p.admission_status !== 'admitted' && p.admission_status !== 'pending_admission') {
        try {
          await updateDoc(doc(db, 'patients', patientId), {
            patient_type: 'IP',
            admission_status: 'pending_admission',
          });
        } catch (statusError) {
          console.error('⚠️ Failed to flag patient as pending admission:', statusError);
        }
      }

      if (fields.sendSms && p.phone) {
        try {
          const result = await sendAppointmentSMSToPatient(p.phone, patientName, {
            appointmentType: fields.type || 'appointment',
            doctorName: fields.doctorName || 'our team',
            date: fields.date,
            time: fields.time,
          });
          if (!result.success) console.warn('Appointment SMS not sent:', result.error);
        } catch (smsError) {
          console.error('⚠️ Failed to send appointment SMS:', smsError);
        }
      }

      await loadDashboardData();
    } catch (error) {
      console.error('Error booking appointment for existing patient:', error);
      alert('Patient details were saved, but booking the appointment failed. Please add it manually from the Appointments panel.');
    } finally {
      setBookingForExistingPatient(false);
    }
  };

  // Front desk marks a phone-booked (not-yet-registered) appointment as
  // "In the Office" once the caller physically arrives — persists the status,
  // flips the linked lead to "Converted" (matching Lead Management's own
  // Converted transition), and jumps straight into Patient Portal's
  // registration form, prefilled, so the front desk isn't re-typing
  // name/phone. The appointment itself is deleted once that registration is
  // actually saved (see PatientRegistrationNew's appointmentId handling),
  // not here, since the front desk may cancel out without finishing.
  const handleContactStatusChange = async (apt, newStatus) => {
    try {
      await updateDoc(doc(db, 'appointments', apt.id), { contact_status: newStatus });
    } catch (error) {
      console.error('Error updating appointment status:', error);
    }

    let leadId = apt.lead_id || null;

    if (newStatus === 'in_office') {
      try {
        if (leadId) {
          await updateDoc(doc(db, 'leads', leadId), { status: 'converted', converted_at: new Date().toISOString() });
        } else {
          // Backfill: this appointment predates the Lead Management link.
          leadId = await createLinkedLead(apt.id, { patient: apt.patient, phone: apt.phone, type: apt.type }, 'converted');
        }
      } catch (leadError) {
        console.error('⚠️ Failed to update linked lead status:', leadError);
      }

      window.dispatchEvent(new CustomEvent('convertAppointmentToPatient', {
        detail: {
          name: apt.patient,
          phone: apt.phone || '',
          appointmentId: apt.id,
          leadId: leadId || undefined,
          notes: apt.type ? `Walk-in from appointment: ${apt.type}` : '',
        }
      }));
    }
  };

  // For an already-registered patient's appointment (apt.patient_id set) —
  // the "Called In / In the Office" dropdown above is for not-yet-registered
  // leads and would wrongly spawn a duplicate lead here. Checking in just
  // marks arrival and drops the card off the board (see visibleAppointments)
  // so front desk can see who's still waiting versus already with the doctor.
  const handleCheckInAppointment = async (apt) => {
    try {
      await updateDoc(doc(db, 'appointments', apt.id), {
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error checking in appointment:', error);
      alert('Failed to check in. Please try again.');
    }
  };

  // Marks a no-show as cancelled rather than deleting it outright (unlike
  // the trash-icon delete above it) — it stays in Visit History as a
  // cancelled visit instead of vanishing without a trace, but still drops
  // off the board like a check-in does (see visibleAppointments).
  const handleCancelAppointment = async (apt) => {
    if (!window.confirm(`Mark ${apt.patient}'s appointment as cancelled (no-show)?`)) return;
    try {
      await updateDoc(doc(db, 'appointments', apt.id), {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel. Please try again.');
    }
  };

  const admitPatient = async (patient) => {
    if (!window.confirm(`Admit ${patient.patient}?`)) return;
    try {
      // The patients onSnapshot listener picks this up automatically —
      // no manual reload needed.
      await updateDoc(doc(db, 'patients', patient.id), {
        admission_status: 'admitted',
        admission_date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('Error admitting patient:', error);
      alert('Failed to admit patient. Please try again.');
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, onClick }) => (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 border-l-4 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
          <TrendingUp className="w-3 h-3" />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{greeting}, {currentUser.name || 'User'}!</h1>
            <p className="text-gray-600">Here's what's happening at Tatva Ayurved today</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Today's Date</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center text-white font-bold text-lg">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Today's Appointments"
          value={isDoctorView ? todayAppointments.filter(a => isMine(a.doctorName) && a.status !== 'checked_in' && a.status !== 'cancelled').length : dashboardData.stats.totalAppointments}
          icon={Calendar}
          color="#3b82f6"
          subtitle="Scheduled patients"
        />
        <StatCard
          title="In-Patients"
          value={dashboardData.stats.ipPatientsCount}
          icon={Bed}
          color="#8b5cf6"
          subtitle="Currently admitted"
        />
        <StatCard
          title="Pending Admissions"
          value={dashboardData.stats.pendingAdmissionsCount}
          icon={Users}
          color="#f59e0b"
          subtitle="Awaiting admission"
          onClick={dashboardData.stats.pendingAdmissionsCount > 0 ? () => setShowPendingAdmissions(true) : undefined}
        />
        <StatCard
          title="Outstanding Payments"
          value={`₹${dashboardData.stats.outstandingAmount.toLocaleString()}`}
          icon={IndianRupee}
          color="#ef4444"
          subtitle="To be collected"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointments */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-400 to-blue-500 px-6 py-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">Appointments</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddAppointment(true)}
                    className="flex items-center gap-1 bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-semibold hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                  <span className="bg-white/25 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    {visibleAppointments.length} Total
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setAppointmentView(tab.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                      appointmentView === tab.id
                        ? 'bg-white text-blue-600'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {appointmentView !== 'daily' && (
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-white/90">
                  {APPOINTMENT_BUCKETS.map(name => (
                    <span key={name} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${APPOINTMENT_TYPE_COLORS[name].dot}`}></span>
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {visibleAppointments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No appointments scheduled for this {appointmentView === 'daily' ? 'day' : appointmentView === 'weekly' ? 'week' : 'month'}</p>
              </div>
            ) : appointmentView === 'daily' ? (
              <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {APPOINTMENT_BUCKETS.map(bucketName => {
                  const color = APPOINTMENT_TYPE_COLORS[bucketName];
                  const Icon = color.icon;
                  const appts = visibleAppointments.filter(apt => bucketForAppointment(apt) === bucketName);
                  return (
                    <div key={bucketName} className="rounded-xl border border-gray-200 bg-gray-50/60 flex flex-col overflow-hidden">
                      <div className={`flex items-center gap-2 px-4 py-3 bg-gradient-to-r ${color.gradient}`}>
                        <Icon className="w-4 h-4 text-white shrink-0" />
                        <h3 className="font-bold text-white text-sm flex-1 leading-tight">{bucketName}</h3>
                        <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">{appts.length}</span>
                      </div>
                      <div className="p-3 space-y-2.5 max-h-[30rem] overflow-y-auto flex-1">
                        {appts.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-8">No {bucketName.toLowerCase()} today</p>
                        ) : (
                          appts.map(apt => (
                            <div
                              key={apt.id}
                              onClick={apt.patient_id ? () => window.dispatchEvent(new CustomEvent('viewPatient', { detail: apt.patient_id })) : undefined}
                              title={apt.patient_id ? 'View patient details' : undefined}
                              className={`rounded-lg border-l-4 ${color.border} bg-white p-3 shadow-sm hover:shadow-md transition-shadow ${apt.patient_id ? 'cursor-pointer' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-bold ${color.time}`}>{apt.time}</p>
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingAppointment(apt); }}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit appointment"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteAppointment(apt.id); }}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove appointment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="font-semibold text-gray-900 text-sm mt-0.5">{apt.patient}</p>
                              {apt.type && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate" title={apt.type}>{apt.type}</p>
                              )}
                              {apt.doctorName && (
                                <p className="text-xs text-teal-700 flex items-center gap-1 mt-1.5">
                                  🩺 {withDrPrefix(apt.doctorName)}
                                </p>
                              )}
                              {(apt.therapistNames?.length > 0 || apt.therapistName) && (
                                <p className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                                  👤 {apt.therapistNames?.length > 0 ? apt.therapistNames.join(', ') : apt.therapistName}
                                </p>
                              )}
                              {apt.patient_id ? (
                                apt.status === 'in-progress' ? (
                                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                    In Progress
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCheckInAppointment(apt); }}
                                      title="Mark arrived — removes this card from the board"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                                    >
                                      ✓ Check In
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCancelAppointment(apt); }}
                                      title="Mark as a no-show / cancelled — removes this card from the board"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                    >
                                      ✕ Cancel
                                    </button>
                                  </div>
                                )
                              ) : (
                                <select
                                  value={apt.contact_status || 'called_in'}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleContactStatusChange(apt, e.target.value)}
                                  title="Front desk contact status"
                                  className={`mt-2 text-xs font-semibold rounded-full border-0 pl-2 pr-6 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                    apt.contact_status === 'in_office'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  <option value="called_in">📞 Called In</option>
                                  <option value="in_office">🏥 In the Office</option>
                                </select>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 space-y-5 max-h-[32rem] overflow-y-auto">
                {Object.entries(
                  visibleAppointments.reduce((groups, apt) => {
                    const key = apt.date || 'unknown';
                    (groups[key] = groups[key] || []).push(apt);
                    return groups;
                  }, {})
                ).map(([dateKey, appts]) => (
                  <div key={dateKey}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      {formatGroupDate(dateKey)}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {appts.map(apt => {
                        const color = colorForAppointment(apt);
                        return (
                          <div
                            key={apt.id}
                            onClick={apt.patient_id ? () => window.dispatchEvent(new CustomEvent('viewPatient', { detail: apt.patient_id })) : undefined}
                            title={apt.patient_id ? 'View patient details' : undefined}
                            className={`rounded-xl border-l-4 ${color.border} ${color.bg} p-3 shadow-sm hover:shadow-md transition-shadow ${apt.patient_id ? 'cursor-pointer' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-base font-bold ${color.time}`}>{apt.time}</p>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingAppointment(apt); }}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit appointment"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteAppointment(apt.id); }}
                                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove appointment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="font-semibold text-gray-900 mt-1">{apt.patient}</p>
                            {apt.type && (
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color.badge}`}>
                                {apt.type}
                              </span>
                            )}
                            {apt.doctorName && (
                              <p className="text-xs text-teal-700 flex items-center gap-1 mt-1.5">
                                🩺 {withDrPrefix(apt.doctorName)}
                              </p>
                            )}
                            {(apt.therapistNames?.length > 0 || apt.therapistName) && (
                              <p className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                                👤 {apt.therapistNames?.length > 0 ? apt.therapistNames.join(', ') : apt.therapistName}
                              </p>
                            )}
                            {apt.patient_id ? (
                              apt.status === 'in-progress' ? (
                                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                  In Progress
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCheckInAppointment(apt); }}
                                    title="Mark arrived — removes this card from the board"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                                  >
                                    ✓ Check In
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCancelAppointment(apt); }}
                                    title="Mark as a no-show / cancelled — removes this card from the board"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                  >
                                    ✕ Cancel
                                  </button>
                                </div>
                              )
                            ) : (
                              <select
                                value={apt.contact_status || 'called_in'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleContactStatusChange(apt, e.target.value)}
                                title="Front desk contact status"
                                className={`mt-2 text-xs font-semibold rounded-full border-0 pl-2 pr-6 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                  apt.contact_status === 'in_office'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                <option value="called_in">📞 Called In</option>
                                <option value="in_office">🏥 In the Office</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current IP Patients */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-purple-400 to-purple-500 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bed className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">In-Patient Status</h2>
                </div>
                <span className="bg-white text-purple-600 px-3 py-1 rounded-full text-sm font-semibold">
                  {dashboardData.stats.ipPatientsCount} Active
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Checkout Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diagnosis</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashboardData.ipPatients.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-400">No patients currently admitted</td></tr>
                  ) : dashboardData.ipPatients.map(patient => {
                    const checkoutIsToday = patient.checkoutDate === toDateStr(new Date());
                    return (
                      <tr key={patient.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{patient.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{patient.room}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {patient.admission ? formatDateOnly(patient.admission) : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {patient.checkoutDate ? (
                            <span className={checkoutIsToday ? 'font-semibold text-green-700' : 'text-gray-700'}>
                              {formatDateOnly(patient.checkoutDate)}{checkoutIsToday ? ' · Today' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{patient.diagnosis}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {patient.daysAdmitted !== null ? `Day ${patient.daysAdmitted + 1}` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Lead Conversion Snapshot */}
          <div
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'leads' }))}
            className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            title="Open Lead Management"
          >
            <div className="bg-gradient-to-r from-indigo-400 to-indigo-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Lead Conversion</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{dashboardData.stats.totalLeads || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Called In</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-700">{dashboardData.stats.convertedLeads || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Became Patients</p>
                </div>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-3xl font-bold text-indigo-700">{dashboardData.stats.conversionRate || 0}%</p>
                <p className="text-xs text-indigo-600 mt-0.5">Conversion Rate</p>
              </div>
            </div>
          </div>

          {/* Discharges Today */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-green-400 to-green-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Discharges Today</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {dashboardData.todayDischarges.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No discharges yet today</p>
              ) : (
                dashboardData.todayDischarges.map(discharge => (
                  <div key={discharge.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{discharge.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${discharge.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        {discharge.status === 'completed' ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                    {discharge.pendingAmount > 0 && (
                      <p className="text-xs text-red-600 mt-1">₹{discharge.pendingAmount.toLocaleString()} pending</p>
                    )}
                    {discharge.status !== 'completed' && (
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('startDischarge', { detail: discharge.patientId }))}
                        className="mt-2 text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 w-full"
                      >
                        Complete Discharge
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Therapist Schedule */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-teal-400 to-teal-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Therapist Schedule</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {(!dashboardData.therapistSchedule || dashboardData.therapistSchedule.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-2">No therapist assignments today</p>
              )}
              {dashboardData.therapistSchedule?.map(therapist => (
                <div key={therapist.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900 text-sm">{therapist.therapist}</p>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      therapist.availability === 'available' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {therapist.availability}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Sessions: {therapist.sessions}</span>
                    <span>Next: {therapist.nextSlot}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Alert Banner */}
      {dashboardData.stats.hotLeads > 0 && (
        <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-800">Action Required!</p>
              <p className="text-sm text-yellow-700">
                You have {dashboardData.stats.hotLeads} hot leads and {dashboardData.stats.pendingFollowups} pending follow-ups waiting for your attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {(showAddAppointment || editingAppointment) && (
        <AddAppointmentModal
          appointment={editingAppointment}
          onClose={() => { setShowAddAppointment(false); setEditingAppointment(null); }}
          onSave={saveAppointment}
          saving={savingAppointment}
          doctors={doctors}
          therapists={therapists}
          patients={allPatients}
          onPickExistingPatient={handlePickExistingPatientForAppt}
        />
      )}

      {/* Existing patient picked while adding an appointment — full edit
          dialog, same fields as New Patient Registration, pre-filled. */}
      {existingPatientForAppt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <PatientRegistrationNew
            patient={existingPatientForAppt}
            onClose={cancelExistingPatientAppt}
            onSuccess={handlePatientConfirmedForAppt}
          />
        </div>
      )}

      {/* Patient info confirmed — now collect Time/Type/Doctor for the visit. */}
      {scheduleForPatient && (
        <ScheduleExistingPatientModal
          patient={scheduleForPatient}
          initialFields={pendingApptFields}
          doctors={doctors}
          therapists={therapists}
          onCancel={cancelScheduleForExistingPatient}
          onConfirm={bookAppointmentForExistingPatient}
          saving={bookingForExistingPatient}
        />
      )}
      {bookingForExistingPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-700">Booking appointment…</span>
          </div>
        </div>
      )}

      {showPendingAdmissions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Pending Admissions</h3>
              <button onClick={() => setShowPendingAdmissions(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {dashboardData.pendingAdmissions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No pending admissions.</p>
              ) : (
                dashboardData.pendingAdmissions.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setShowPendingAdmissions(false);
                      window.dispatchEvent(new CustomEvent('viewPatient', { detail: p.id }));
                    }}
                    className="w-full text-left px-6 py-3 hover:bg-gray-50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{p.patient || 'Unnamed patient'}</p>
                      <p className="text-xs text-gray-500 flex gap-2">
                        {p.mrd_number && <span>{p.mrd_number}</span>}
                        {p.admissionDate ? (
                          <span className="text-amber-700 font-medium">Admission: {formatGroupDate(p.admissionDate)}</span>
                        ) : (
                          p.requested_at && <span>Requested {formatDateOnly(p.requested_at)}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold shrink-0">View</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
