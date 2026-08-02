import React, { useState, useEffect } from 'react';
import { Calendar, Users, Bed, LogOut, IndianRupee, Clock, Phone, AlertCircle, TrendingUp, Activity, CheckCircle, XCircle, Trash2, Plus, X, Pencil } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDateOnly, addDaysToDateString } from '../lib/formatDate';
import { sendAppointmentSMSToPatient } from '../lib/sms';

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getIndiaHour = () =>
  parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()), 10);

const getGreeting = () => {
  const hour = getIndiaHour();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 22) return 'Good Evening';
  return 'Good Night';
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

// Colors are keyed to the exact three Appointment Type options in Patient
// Portal's "Schedule Appointment" form — one fixed color per type everywhere
// an appointment is shown, instead of an arbitrary per-string hash.
const APPOINTMENT_TYPE_COLORS = {
  'Follow-up Treatment': { border: 'border-blue-400', bg: 'bg-blue-50', time: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-400' },
  'Doctor Consultation': { border: 'border-purple-400', bg: 'bg-purple-50', time: 'text-purple-700', badge: 'bg-purple-100 text-purple-800', dot: 'bg-purple-400' },
  'Ayurvedic Therapy': { border: 'border-emerald-400', bg: 'bg-emerald-50', time: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-400' },
};
const DEFAULT_APPOINTMENT_COLOR = { border: 'border-gray-300', bg: 'bg-gray-50', time: 'text-gray-700', badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };

const colorForAppointment = (apt) => APPOINTMENT_TYPE_COLORS[apt.type] || DEFAULT_APPOINTMENT_COLOR;

const formatGroupDate = (dateStr) => {
  const today = toDateStr(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === today) return 'Today';
  if (dateStr === toDateStr(tomorrow)) return 'Tomorrow';
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const AddAppointmentModal = ({ appointment, onClose, onSave, saving, doctors = [] }) => {
  const isEditMode = !!appointment;
  const [formData, setFormData] = useState({
    patient: appointment?.patient || '',
    phone: appointment?.phone || '',
    time: appointment?.time || '',
    type: appointment?.type || '',
    doctorId: appointment?.doctorId || '',
    doctorName: appointment?.doctorName || '',
    sendSms: false,
  });
  const [error, setError] = useState('');

  const handleDoctorChange = (e) => {
    const selected = doctors.find(d => d.id === e.target.value);
    setFormData({
      ...formData,
      doctorId: selected ? selected.id : '',
      doctorName: selected ? selected.name : '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.patient.trim() || !formData.time) {
      setError('Patient name and time are required.');
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
          <h3 className="text-lg font-bold text-gray-900">{isEditMode ? 'Edit Appointment' : "Add Today's Appointment"}</h3>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
            <input
              type="text"
              value={formData.patient}
              onChange={(e) => setFormData({ ...formData, patient: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Anjali Menon"
            />
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
            <input
              type="text"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Consultation, Panchakarma Session"
            />
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

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [greeting, setGreeting] = useState(getGreeting());
  const [appointmentView, setAppointmentView] = useState('daily'); // daily | weekly | monthly
  const [panelAppointments, setPanelAppointments] = useState([]);
  // Live patients snapshot (admission_date / expected_stay_days come from
  // Patient Portal) — In-Patient Status and Discharges Today are derived
  // from this in real time instead of a one-time fetch.
  const [allPatients, setAllPatients] = useState([]);
  const [ipCaseSheetsById, setIpCaseSheetsById] = useState({});
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
          stats: { ...prev.stats, totalAppointments: appts.length },
        }));
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time listener for patients — In-Patient Status / Discharges Today
  // stay in sync the moment admission_date or expected_stay_days changes in
  // Patient Portal, without needing a manual Dashboard refresh.
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
    const pendingAdmissions = allPatients
      .filter(p => p.patient_type === 'IP' && p.admission_status === 'pending_admission')
      .map(p => ({
        id: p.id,
        patient: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        mrd_number: p.mrd_number || p.patient_number || '',
        requested_at: p.created_at,
      }));

    // Discharges Today — driven by each IP patient's own computed checkout
    // date (admission_date + expected_stay_days), not a separately-tracked
    // discharges collection that only reflects paperwork someone already
    // started.
    const todayDischarges = ipPatients.filter(p => p.checkoutDate === today);

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
  }, [allPatients, ipCaseSheetsById]);

  // Therapist schedule — derived from the full roster + today's appointments,
  // so it stays correct regardless of which of those two loads/updates first
  // (previously this was clobbered by a separate effect that reset it to []).
  useEffect(() => {
    const sessionsByTherapist = {};
    todayAppointments.forEach(a => {
      if (!a.therapistId) return;
      if (!sessionsByTherapist[a.therapistId]) sessionsByTherapist[a.therapistId] = { sessions: 0, nextSlot: null };
      sessionsByTherapist[a.therapistId].sessions += 1;
      if (!sessionsByTherapist[a.therapistId].nextSlot) sessionsByTherapist[a.therapistId].nextSlot = a.time;
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

  const saveAppointment = async (formData) => {
    const isEditMode = !!editingAppointment;
    try {
      setSavingAppointment(true);
      const today = toDateStr(new Date());

      if (isEditMode) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), {
          patient: formData.patient,
          phone: formData.phone || '',
          time: formData.time,
          type: formData.type,
          doctorId: formData.doctorId || '',
          doctorName: formData.doctorName || '',
        });
      } else {
        await addDoc(collection(db, 'appointments'), {
          patient: formData.patient,
          phone: formData.phone || '',
          time: formData.time,
          type: formData.type,
          status: 'scheduled',
          contact_status: 'called_in',
          date: today,
          doctorId: formData.doctorId || '',
          doctorName: formData.doctorName || '',
          createdAt: new Date().toISOString()
        });
      }

      if (formData.sendSms && formData.phone) {
        try {
          const result = await sendAppointmentSMSToPatient(formData.phone, formData.patient, {
            appointmentType: formData.type || 'appointment',
            doctorName: formData.doctorName || 'our team',
            date: today,
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

  // Front desk marks a phone-booked (not-yet-registered) appointment as
  // "In the Office" once the caller physically arrives — persists the status
  // and jumps straight into Patient Portal's registration form, prefilled,
  // so the front desk isn't re-typing name/phone. The appointment itself is
  // deleted once that registration is actually saved (see
  // PatientRegistrationNew's appointmentId handling), not here, since the
  // front desk may cancel out of the registration form without finishing.
  const handleContactStatusChange = async (apt, newStatus) => {
    try {
      await updateDoc(doc(db, 'appointments', apt.id), { contact_status: newStatus });
    } catch (error) {
      console.error('Error updating appointment status:', error);
    }
    if (newStatus === 'in_office') {
      window.dispatchEvent(new CustomEvent('convertAppointmentToPatient', {
        detail: {
          name: apt.patient,
          phone: apt.phone || '',
          appointmentId: apt.id,
          notes: apt.type ? `Walk-in from appointment: ${apt.type}` : '',
        }
      }));
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

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4 hover:shadow-lg transition-shadow" style={{ borderColor: color }}>
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

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

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
          value={dashboardData.stats.totalAppointments}
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
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">Appointments</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddAppointment(true)}
                    className="flex items-center gap-1 bg-white text-blue-700 px-3 py-1 rounded-full text-sm font-semibold hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                  <span className="bg-blue-800 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    {panelAppointments.length} Total
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
                        ? 'bg-white text-blue-700'
                        : 'bg-blue-800/40 text-blue-100 hover:bg-blue-800/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-blue-100">
                {Object.entries(APPOINTMENT_TYPE_COLORS).map(([type, color]) => (
                  <span key={type} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`}></span>
                    {type}
                  </span>
                ))}
              </div>
            </div>

            {panelAppointments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No appointments scheduled for this {appointmentView === 'daily' ? 'day' : appointmentView === 'weekly' ? 'week' : 'month'}</p>
              </div>
            ) : (
              <div className="p-4 space-y-5 max-h-[32rem] overflow-y-auto">
                {Object.entries(
                  panelAppointments.reduce((groups, apt) => {
                    const key = apt.date || 'unknown';
                    (groups[key] = groups[key] || []).push(apt);
                    return groups;
                  }, {})
                ).map(([dateKey, appts]) => (
                  <div key={dateKey}>
                    {appointmentView !== 'daily' && (
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        {formatGroupDate(dateKey)}
                      </p>
                    )}
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
                                🩺 Dr. {apt.doctorName}
                              </p>
                            )}
                            {apt.therapistName && (
                              <p className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                                👤 {apt.therapistName}
                              </p>
                            )}
                            {apt.patient_id ? (
                              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                apt.status === 'in-progress'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {apt.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                              </span>
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
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bed className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">In-Patient Status</h2>
                </div>
                <span className="bg-white text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
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
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
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

          {/* Pending Admissions */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Pending Admissions</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {dashboardData.pendingAdmissions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No pending admissions</p>
              ) : (
                dashboardData.pendingAdmissions.map(admission => (
                  <div key={admission.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="font-semibold text-gray-900 text-sm">{admission.patient}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {admission.mrd_number && <span className="font-mono">{admission.mrd_number}</span>}
                      {admission.requested_at && ` · Requested ${formatDateOnly(admission.requested_at)}`}
                    </p>
                    <div className="flex items-center justify-end mt-2">
                      <button
                        onClick={() => admitPatient(admission)}
                        className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
                      >
                        Admit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Discharges Today */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Discharges Today</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {dashboardData.todayDischarges.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No discharges scheduled</p>
              ) : (
                dashboardData.todayDischarges.map(patient => (
                  <div key={patient.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="font-semibold text-gray-900 text-sm">{patient.name}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {patient.expectedStayDays} day{patient.expectedStayDays === 1 ? '' : 's'} · Admitted {patient.admission ? formatDateOnly(patient.admission) : '—'}
                    </p>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('startDischarge', { detail: patient.id }))}
                      className="mt-2 text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 w-full"
                    >
                      Start Discharge
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Therapist Schedule */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
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

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">Quick Actions</h3>
            <div className="space-y-2">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'leads' }))}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                New Lead
              </button>
              <button 
                onClick={() => {
                  // Navigate to patients view
                  window.dispatchEvent(new CustomEvent('navigate', { detail: 'patients' }));
                  // Trigger new patient registration after a short delay
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openNewPatient'));
                  }, 100);
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                New Patient Registration
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'invoices' }))}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center justify-center gap-2"
              >
                <IndianRupee className="w-4 h-4" />
                Create Invoice
              </button>
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
        />
      )}
    </div>
  );
};

export default Dashboard;
