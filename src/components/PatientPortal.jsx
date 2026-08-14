import React, { useState, useEffect } from 'react';
import {
  Users, Search, Plus, Edit, Eye, Trash2,
  Phone, Mail, Calendar, MapPin, Activity,
  X, FileText, Download, Filter, CalendarPlus,
  Stethoscope, Clock, MessageSquare, CheckCircle, AlertCircle, Send,
  ClipboardList, UserRound, BookOpen, Pill, BedDouble, LogOut
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, deleteDoc, query, orderBy, addDoc, updateDoc } from 'firebase/firestore';
import { sendAppointmentSMSToPatient, sendAppointmentSMSToDoctor } from '../lib/sms';
import { fetchLatestDischargeSummary } from '../lib/dischargeSummary';
import { addDaysToDateString, formatDateOnly } from '../lib/formatDate';
import DischargeSummaryModal from './DischargeSummaryModal';
import IPDailyProgressModal from './IPDailyProgressModal';
import IPCaseSheetModal from './IPCaseSheetModal';
import OPCaseSheetModal from './OPCaseSheetModal';
import PrescriptionModal from './PrescriptionModal';
import PatientRegistrationNew from './PatientRegistrationNew';

const PatientPortal = ({ onAddPatient, initialPatientId, onInitialPatientHandled }) => {
  console.log('🔵 PatientPortal rendered, onAddPatient prop:', typeof onAddPatient);
  
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [filterPatientType, setFilterPatientType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Discharge summary & daily progress state
  const [showDischargeSummary, setShowDischargeSummary] = useState(false);
  const [dischargeSummaryPatient, setDischargeSummaryPatient] = useState(null);
  const [dischargeSummaryExisting, setDischargeSummaryExisting] = useState(null);
  const [showDailyProgress, setShowDailyProgress] = useState(false);
  const [dailyProgressPatient, setDailyProgressPatient] = useState(null);
  const [showCaseSheet, setShowCaseSheet] = useState(false);
  const [caseSheetPatient, setCaseSheetPatient] = useState(null);
  const [showOPCaseSheet, setShowOPCaseSheet] = useState(false);
  const [opCaseSheetPatient, setOpCaseSheetPatient] = useState(null);
  const [showPrescription, setShowPrescription] = useState(false);
  const [prescriptionPatient, setPrescriptionPatient] = useState(null);
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [showAssignDoctor, setShowAssignDoctor] = useState(false);
  const [assignDoctorPatient, setAssignDoctorPatient] = useState(null);
  const [assignDoctorName, setAssignDoctorName] = useState('');
  const [assignDoctorSaving, setAssignDoctorSaving] = useState(false);

  // Admit / expected-stay state — captures admission date + expected length
  // of stay so Dashboard can compute a live checkout date.
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [admitPatientTarget, setAdmitPatientTarget] = useState(null);
  const [admitForm, setAdmitForm] = useState({ admission_date: '', expected_stay_days: '' });
  const [admitSaving, setAdmitSaving] = useState(false);

  // Appointment scheduling state
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentPatient, setAppointmentPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [apptSaving, setApptSaving] = useState(false);
  const [apptSMSStatus, setApptSMSStatus] = useState({ patient: null, doctor: null });
  const [apptForm, setApptForm] = useState({
    appointment_type: 'Consultation',
    doctor_id: '',
    doctor_name: '',
    doctor_phone: '',
    date: '',
    time: '',
    duration_minutes: 30,
    notes: '',
    send_sms_patient: true,
    send_sms_doctor: true,
  });
  const [savedAppt, setSavedAppt] = useState(null);

  // Load patients on component mount
  useEffect(() => {
    loadPatients();
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const snap = await getDocs(collection(db, 'hr_employees'));
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => ['doctor', 'physician', 'therapist', 'consultant'].some(r =>
          (e.department || e.designation || '').toLowerCase().includes(r) ||
          (e.role || '').toLowerCase().includes(r)
        ));
      setDoctors(docs);
    } catch (e) {
      // silently ignore — doctor list is optional
    }
  };

  const openAppointmentModal = (patient) => {
    setAppointmentPatient(patient);
    setApptForm({
      appointment_type: 'Consultation',
      doctor_id: '',
      doctor_name: '',
      doctor_phone: '',
      date: '',
      time: '',
      duration_minutes: 30,
      notes: '',
      send_sms_patient: true,
      send_sms_doctor: true,
    });
    setApptSMSStatus({ patient: null, doctor: null });
    setSavedAppt(null);
    setShowAppointmentModal(true);
  };

  const handleDoctorChange = (doctorId) => {
    if (!doctorId) {
      setApptForm(f => ({ ...f, doctor_id: '', doctor_name: '', doctor_phone: '' }));
      return;
    }
    if (doctorId === '__manual__') {
      setApptForm(f => ({ ...f, doctor_id: '__manual__', doctor_name: '', doctor_phone: '' }));
      return;
    }
    const doc = doctors.find(d => d.id === doctorId);
    if (doc) {
      setApptForm(f => ({
        ...f,
        doctor_id: doctorId,
        doctor_name: `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || doc.name || '',
        doctor_phone: doc.phone || doc.mobile || '',
      }));
    }
  };

  const handleSaveAppointment = async () => {
    if (!apptForm.date || !apptForm.time || !apptForm.doctor_name) {
      alert('Please fill in Date, Time, and Doctor Name.');
      return;
    }
    setApptSaving(true);
    try {
      const patientDisplayName = `${appointmentPatient.first_name} ${appointmentPatient.last_name}`;
      const apptData = {
        // Same `appointments` collection/schema the Dashboard and Scheduling
        // module read from — this used to write to a separate
        // `patient_appointments` collection that nothing else ever queried,
        // so appointments booked here never showed up on the Dashboard.
        patient: patientDisplayName,
        patient_id: appointmentPatient.id,
        patient_name: patientDisplayName,
        patient_phone: appointmentPatient.phone || '',
        mrd_number: appointmentPatient.mrd_number || appointmentPatient.patient_number || '',
        ip_number: appointmentPatient.ip_number || '',
        type: apptForm.appointment_type,
        appointment_type: apptForm.appointment_type,
        doctorId: apptForm.doctor_id,
        doctor_id: apptForm.doctor_id,
        doctorName: apptForm.doctor_name,
        doctor_name: apptForm.doctor_name,
        doctor_phone: apptForm.doctor_phone,
        date: apptForm.date,
        time: apptForm.time,
        duration_minutes: apptForm.duration_minutes,
        notes: apptForm.notes,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, 'appointments'), apptData);
      setSavedAppt({ id: ref.id, ...apptData });

      // Send SMS
      const smsDetails = {
        appointmentType: apptForm.appointment_type,
        doctorName: apptForm.doctor_name,
        date: apptForm.date,
        time: apptForm.time,
        notes: apptForm.notes,
        patientName: apptData.patient_name,
        mrdNumber: apptData.mrd_number,
      };

      const newSMSStatus = { patient: null, doctor: null };

      if (apptForm.send_sms_patient && appointmentPatient.phone) {
        const res = await sendAppointmentSMSToPatient(appointmentPatient.phone, appointmentPatient.first_name, smsDetails);
        newSMSStatus.patient = res.success ? 'sent' : 'failed';
      }
      if (apptForm.send_sms_doctor && apptForm.doctor_phone) {
        const res = await sendAppointmentSMSToDoctor(apptForm.doctor_phone, apptForm.doctor_name, smsDetails);
        newSMSStatus.doctor = res.success ? 'sent' : 'failed';
      }
      setApptSMSStatus(newSMSStatus);
    } catch (err) {
      alert('Error saving appointment: ' + err.message);
    } finally {
      setApptSaving(false);
    }
  };

  const loadPatients = async () => {
    setLoading(true);
    try {
      // Load from Firebase
      const patientsRef = collection(db, 'patients');
      const q = query(patientsRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      
      const patientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('✅ Loaded patients from Firebase:', patientsData.length);
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading patients:', error);
      alert('Error loading patients: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openAssignDoctorModal = (patient) => {
    setAssignDoctorPatient(patient);
    setAssignDoctorName(patient.assigned_doctor || '');
    setShowAssignDoctor(true);
  };

  const handleSaveAssignDoctor = async () => {
    const patient = assignDoctorPatient;
    setAssignDoctorSaving(true);
    try {
      await updateDoc(doc(db, 'patients', patient.id || patient.firebaseId), { assigned_doctor: assignDoctorName });
      setPatients(prev => prev.map(p =>
        (p.id || p.firebaseId) === (patient.id || patient.firebaseId)
          ? { ...p, assigned_doctor: assignDoctorName }
          : p
      ));
      setShowAssignDoctor(false);
      setAssignDoctorPatient(null);
    } catch (e) {
      alert('Failed to assign doctor: ' + e.message);
    } finally {
      setAssignDoctorSaving(false);
    }
  };

  // Opens the Admit / Edit Stay modal — same modal for first-time admission
  // (sets admission_status too) and for adjusting an already-admitted
  // patient's dates later (e.g. an extended stay), so there's one place
  // that keeps admission_date + expected_stay_days consistent.
  const openAdmitModal = (patient) => {
    setAdmitPatientTarget(patient);
    setAdmitForm({
      admission_date: patient.admission_date || new Date().toISOString().split('T')[0],
      expected_stay_days: patient.expected_stay_days != null ? String(patient.expected_stay_days) : '',
    });
    setShowAdmitModal(true);
  };

  const handleSaveAdmit = async () => {
    if (!admitPatientTarget) return;
    if (!admitForm.admission_date) { alert('Please select an admission date.'); return; }
    setAdmitSaving(true);
    try {
      const patientId = admitPatientTarget.id || admitPatientTarget.firebaseId;
      const days = admitForm.expected_stay_days === '' ? null : Number(admitForm.expected_stay_days);
      const update = {
        admission_date: admitForm.admission_date,
        ...(admitPatientTarget.admission_status === 'pending_admission' ? { admission_status: 'admitted' } : {}),
        ...(days != null ? { expected_stay_days: days } : {}),
      };
      await updateDoc(doc(db, 'patients', patientId), update);
      setPatients(prev => prev.map(p => (p.id || p.firebaseId) === patientId ? { ...p, ...update } : p));
      setShowAdmitModal(false);
      setAdmitPatientTarget(null);
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setAdmitSaving(false);
    }
  };

  const handleDelete = async (patientId) => {
    if (!confirm('Are you sure you want to delete this patient?')) return;

    try {
      // Delete from Firebase
      await deleteDoc(doc(db, 'patients', patientId));
      
      console.log('✅ Patient deleted from Firebase');
      // Reload patients
      loadPatients();
      alert('✅ Patient deleted successfully!');
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Error deleting patient: ' + error.message);
    }
  };

  const viewPatientDetails = (patient) => {
    setSelectedPatient(patient);
    setShowDetails(true);
  };

  // Resumes an already-started Discharge Summary instead of always opening a
  // blank form (which used to create a brand-new duplicate doc on every save).
  const openDischargeSummary = async (patient) => {
    setDischargeSummaryPatient(patient);
    setDischargeSummaryExisting(await fetchLatestDischargeSummary(patient.id));
    setShowDischargeSummary(true);
  };

  // Opens a specific patient's details when navigated here from elsewhere
  // (e.g. clicking an appointment on the Dashboard) — mirrors the App-level
  // 'navigate' custom-event pattern already used for cross-view jumps.
  useEffect(() => {
    if (!initialPatientId || patients.length === 0) return;
    const patient = patients.find(p => p.id === initialPatientId);
    if (patient) viewPatientDetails(patient);
    onInitialPatientHandled && onInitialPatientHandled();
  }, [initialPatientId, patients]);

  // Filter patients based on search and gender
  const filteredPatients = patients.filter(patient => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      (patient.first_name?.toLowerCase() || '').includes(s) ||
      (patient.last_name?.toLowerCase() || '').includes(s) ||
      (`${patient.first_name || ''} ${patient.last_name || ''}`.toLowerCase()).includes(s) ||
      (patient.patient_number?.toLowerCase() || '').includes(s) ||
      (patient.mrd_number?.toLowerCase() || '').includes(s) ||
      (patient.ip_number?.toLowerCase() || '').includes(s) ||
      (patient.phone?.toLowerCase() || '').includes(s) ||
      (patient.email?.toLowerCase() || '').includes(s);

    const matchesGender =
      filterGender === 'all' ||
      patient.gender?.toLowerCase() === filterGender.toLowerCase();

    const matchesType =
      filterPatientType === 'all' ||
      (patient.patient_type || 'OP') === filterPatientType;

    // Discharged patients are hidden by default (same rule Dashboard's IP
    // list already uses) so they don't linger in the active roster forever —
    // but a name/MRD/phone search should still be able to recall them, so the
    // status filter only applies when the search box is empty.
    const matchesStatus =
      !!s ||
      filterStatus === 'all' ||
      (filterStatus === 'discharged' ? patient.admission_status === 'discharged' : patient.admission_status !== 'discharged');

    return matchesSearch && matchesGender && matchesType && matchesStatus;
  });

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <Users className="w-8 h-8 text-teal-600 mr-3" />
              Patient Portal
            </h1>
            <p className="text-gray-600 mt-1">View and manage all registered patients</p>
          </div>
          <button
            onClick={() => {
              console.log('🟢 New Patient button clicked!');
              console.log('🟢 onAddPatient type:', typeof onAddPatient);
              console.log('🟢 onAddPatient value:', onAddPatient);
              if (onAddPatient) {
                console.log('🟢 Calling onAddPatient...');
                onAddPatient();
                console.log('🟢 onAddPatient called!');
              } else {
                console.error('❌ onAddPatient is undefined!');
              }
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Register New Patient</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Patients</p>
                <p className="text-2xl font-bold text-gray-800">{patients.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Male</p>
                <p className="text-2xl font-bold text-gray-800">
                  {patients.filter(p => p.gender?.toLowerCase() === 'male').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Female</p>
                <p className="text-2xl font-bold text-gray-800">
                  {patients.filter(p => p.gender?.toLowerCase() === 'female').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-pink-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-800">
                  {patients.filter(p => p.admission_status !== 'discharged').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <Activity className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, MRD number, IP number, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <select
              value={filterPatientType}
              onChange={(e) => setFilterPatientType(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            >
              <option value="all">All Types</option>
              <option value="IP">IP (In-Patient)</option>
              <option value="OP">OP (Out-Patient)</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            >
              <option value="active">Active Patients</option>
              <option value="discharged">Discharged</option>
              <option value="all">All Patients</option>
            </select>
          </div>

          <button
            onClick={loadPatients}
            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <p className="mt-4 text-gray-600">Loading patients...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Patients Found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || filterGender !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Start by registering your first patient'}
            </p>
            {!searchTerm && filterGender === 'all' && (
              <button
                onClick={() => {
                  console.log('🟢 Register First Patient clicked!');
                  if (onAddPatient) {
                    onAddPatient();
                  } else {
                    console.error('❌ onAddPatient is undefined!');
                  }
                }}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Register First Patient
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">MRD / IP No.</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Age/Gender</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Registration Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {patient.mrd_number ? (
                          <span className="block font-mono text-sm font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                            {patient.mrd_number}
                          </span>
                        ) : (
                          <span className="block font-mono text-xs text-gray-400">{patient.patient_number || 'N/A'}</span>
                        )}
                        {patient.ip_number && (
                          <span className="block font-mono text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                            {patient.ip_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-teal-700 font-semibold text-sm">
                            {patient.first_name?.[0]}{patient.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          {(patient.patient_type === 'IP' || patient.ip_number) ? (
                            <button
                              onClick={() => { setCaseSheetPatient(patient); setShowCaseSheet(true); }}
                              className="font-semibold text-teal-700 hover:text-teal-900 hover:underline text-left"
                              title="Open IP Case Sheet"
                            >
                              {patient.first_name} {patient.middle_name} {patient.last_name}
                            </button>
                          ) : (
                            <button
                              onClick={() => { setOpCaseSheetPatient(patient); setShowOPCaseSheet(true); }}
                              className="font-semibold text-teal-700 hover:text-teal-900 hover:underline text-left"
                              title="Open OP Case Sheet"
                            >
                              {patient.first_name} {patient.middle_name} {patient.last_name}
                            </button>
                          )}
                          {patient.assigned_doctor && (
                            <p className="text-xs text-teal-600 flex items-center gap-1 mt-0.5">
                              <Stethoscope className="w-3 h-3" /> {patient.assigned_doctor}
                            </p>
                          )}
                          {patient.email && (
                            <p className="text-xs text-gray-500">{patient.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-gray-900">{patient.age ? `${patient.age} yrs` : calculateAge(patient.date_of_birth) !== 'N/A' ? `${calculateAge(patient.date_of_birth)} yrs` : 'N/A'}</p>
                        <p className="text-gray-500">{patient.gender || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs rounded-full font-semibold ${(patient.patient_type || 'OP') === 'IP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {patient.patient_type || 'OP'}
                      </span>
                      {patient.admission_status === 'pending_admission' && (
                        <span className="block mt-1 px-2 py-0.5 text-xs rounded-full font-semibold bg-orange-100 text-orange-700 text-center">
                          Pending Admission
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {patient.phone && (
                          <p className="text-gray-900 flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {patient.phone}
                          </p>
                        )}
                        {patient.alternate_phone && (
                          <p className="text-gray-500 text-xs">{patient.alternate_phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {patient.created_at 
                        ? new Date(patient.created_at).toLocaleDateString('en-IN')
                        : patient.registration_date
                        ? new Date(patient.registration_date).toLocaleDateString('en-IN')
                        : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4">
                      {patient.admission_status !== 'discharged' ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center flex-wrap gap-1">
                        {/* View */}
                        <button
                          onClick={() => viewPatientDetails(patient)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => { setEditingPatient(patient); setShowEditPatient(true); }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit Patient"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {/* Schedule Appointment */}
                        <button
                          onClick={() => openAppointmentModal(patient)}
                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Schedule Appointment"
                        >
                          <CalendarPlus className="w-4 h-4" />
                        </button>
                        {/* Assign Doctor */}
                        <button
                          onClick={() => openAssignDoctorModal(patient)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title={patient.assigned_doctor ? `Doctor: ${patient.assigned_doctor}` : 'Assign Doctor'}
                        >
                          <UserRound className="w-4 h-4" />
                        </button>
                        {/* Admit Patient — pending IP admissions only */}
                        {patient.admission_status === 'pending_admission' && (
                          <button
                            onClick={() => openAdmitModal(patient)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Admit Patient"
                          >
                            <BedDouble className="w-4 h-4" />
                          </button>
                        )}
                        {/* Edit Expected Stay — already-admitted IP patients only */}
                        {(patient.patient_type === 'IP' || patient.ip_number) && patient.admission_status === 'admitted' && (
                          <button
                            onClick={() => openAdmitModal(patient)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title={patient.expected_stay_days != null ? `Expected stay: ${patient.expected_stay_days} day(s) — edit` : 'Set expected stay / edit admission date'}
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        {/* IP Case Sheet — IP patients only */}
                        {(patient.patient_type === 'IP' || patient.ip_number) && (
                          <button
                            onClick={() => { setCaseSheetPatient(patient); setShowCaseSheet(true); }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="IP Case Sheet"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        {/* Daily Progress — IP patients only */}
                        {(patient.patient_type === 'IP' || patient.ip_number) && (
                          <button
                            onClick={() => { setDailyProgressPatient(patient); setShowDailyProgress(true); }}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="IP Daily Progress"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                        )}
                        {/* OP Case Sheet — OP patients only */}
                        {!(patient.patient_type === 'IP' || patient.ip_number) && (
                          <button
                            onClick={() => { setOpCaseSheetPatient(patient); setShowOPCaseSheet(true); }}
                            className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                            title="OP Case Sheet"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                        )}
                        {/* Discharge Summary */}
                        <button
                          onClick={() => openDischargeSummary(patient)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Discharge Summary"
                        >
                          <ClipboardList className="w-4 h-4" />
                        </button>
                        {/* Discharge — IP patients only, jumps to Discharge Management */}
                        {(patient.patient_type === 'IP' || patient.ip_number) && patient.admission_status !== 'discharged' && (
                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent('startDischarge', { detail: patient.id }))}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Discharge"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        )}
                        {/* Prescription */}
                        <button
                          onClick={() => { setPrescriptionPatient(patient); setShowPrescription(true); }}
                          className="p-2 text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                          title="Prescription"
                        >
                          <Pill className="w-4 h-4" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(patient.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Patient"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Appointment Scheduling Modal ─────────────────────────── */}
      {showAppointmentModal && appointmentPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <CalendarPlus className="w-6 h-6 text-teal-600" />
                  Schedule Appointment
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {appointmentPatient.first_name} {appointmentPatient.last_name}
                  {appointmentPatient.mrd_number && <span className="ml-2 text-teal-600 font-mono">{appointmentPatient.mrd_number}</span>}
                </p>
              </div>
              <button onClick={() => setShowAppointmentModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Success state after saving */}
              {savedAppt ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">Appointment saved successfully!</p>
                      <p className="text-sm text-green-700 mt-1">
                        {savedAppt.appointment_type} with {savedAppt.doctor_name} on{' '}
                        {new Date(savedAppt.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at {savedAppt.time}
                      </p>
                    </div>
                  </div>

                  {/* SMS Status */}
                  <div className="space-y-2">
                    {apptForm.send_sms_patient && (
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${apptSMSStatus.patient === 'sent' ? 'bg-green-50 text-green-700' : apptSMSStatus.patient === 'failed' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
                        {apptSMSStatus.patient === 'sent' ? <CheckCircle className="w-4 h-4" /> : apptSMSStatus.patient === 'failed' ? <AlertCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                        SMS to patient ({appointmentPatient.phone}): {apptSMSStatus.patient === 'sent' ? 'Sent' : apptSMSStatus.patient === 'failed' ? 'Failed (check MSG91 config)' : 'Not requested'}
                      </div>
                    )}
                    {apptForm.send_sms_doctor && (
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${apptSMSStatus.doctor === 'sent' ? 'bg-green-50 text-green-700' : apptSMSStatus.doctor === 'failed' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
                        {apptSMSStatus.doctor === 'sent' ? <CheckCircle className="w-4 h-4" /> : apptSMSStatus.doctor === 'failed' ? <AlertCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                        SMS to Dr. {savedAppt.doctor_name} ({savedAppt.doctor_phone || 'no phone'}): {apptSMSStatus.doctor === 'sent' ? 'Sent' : apptSMSStatus.doctor === 'failed' ? 'Failed (check MSG91 config)' : 'No phone number'}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => { setSavedAppt(null); setApptSMSStatus({ patient: null, doctor: null }); }}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      Schedule Another
                    </button>
                    <button
                      onClick={() => setShowAppointmentModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Appointment Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Appointment Type</label>
                    <select
                      value={apptForm.appointment_type}
                      onChange={e => setApptForm(f => ({ ...f, appointment_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option>Consultation</option>
                      <option>Ayurvedic Therapy</option>
                      <option>Panchakarma Session</option>
                    </select>
                  </div>

                  {/* Doctor Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Stethoscope className="w-4 h-4 inline mr-1" />
                      Attending Doctor / Therapist
                    </label>
                    <select
                      value={apptForm.doctor_id}
                      onChange={e => handleDoctorChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none mb-2"
                    >
                      <option value="">-- Select from staff --</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>
                          {`${d.first_name || ''} ${d.last_name || ''}`.trim() || d.name} — {d.designation || d.department || d.role || ''}
                        </option>
                      ))}
                      <option value="__manual__">+ Enter manually</option>
                    </select>

                    {/* Manual name + phone entry */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Doctor / Therapist name"
                          value={apptForm.doctor_name}
                          onChange={e => setApptForm(f => ({ ...f, doctor_name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="tel"
                          placeholder="Doctor mobile (for SMS)"
                          value={apptForm.doctor_phone}
                          onChange={e => setApptForm(f => ({ ...f, doctor_phone: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />Date
                      </label>
                      <input
                        type="date"
                        value={apptForm.date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setApptForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />Time
                      </label>
                      <input
                        type="time"
                        value={apptForm.time}
                        onChange={e => setApptForm(f => ({ ...f, time: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Duration (min)</label>
                      <select
                        value={apptForm.duration_minutes}
                        onChange={e => setApptForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes / Instructions</label>
                    <textarea
                      rows={3}
                      value={apptForm.notes}
                      onChange={e => setApptForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. Bring previous reports, fasting required, specific treatment details..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm resize-none"
                    />
                  </div>

                  {/* SMS Options */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      SMS Notifications
                    </p>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={apptForm.send_sms_patient}
                        onChange={e => setApptForm(f => ({ ...f, send_sms_patient: e.target.checked }))}
                        className="w-4 h-4 accent-teal-600"
                      />
                      <span className="text-sm text-gray-700">
                        Send SMS to patient
                        <span className="text-gray-400 ml-1">({appointmentPatient.phone || 'no phone on file'})</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={apptForm.send_sms_doctor}
                        onChange={e => setApptForm(f => ({ ...f, send_sms_doctor: e.target.checked }))}
                        className="w-4 h-4 accent-teal-600"
                      />
                      <span className="text-sm text-gray-700">
                        Send SMS to doctor
                        <span className="text-gray-400 ml-1">{apptForm.doctor_phone ? `(${apptForm.doctor_phone})` : '(enter doctor phone above)'}</span>
                      </span>
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      onClick={() => setShowAppointmentModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAppointment}
                      disabled={apptSaving}
                      className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 flex items-center gap-2"
                    >
                      {apptSaving ? (
                        <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                      ) : (
                        <><Send className="w-4 h-4" />Save &amp; Send SMS</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Doctor Modal */}
      {showAssignDoctor && assignDoctorPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Assign Doctor</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {assignDoctorPatient.first_name} {assignDoctorPatient.last_name}
                  {assignDoctorPatient.mrd_number && <span className="ml-2 text-teal-600 font-mono">{assignDoctorPatient.mrd_number}</span>}
                </p>
              </div>
              <button onClick={() => setShowAssignDoctor(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Stethoscope className="w-4 h-4 inline mr-1" />
                  Doctor / Therapist
                </label>
                <select
                  value={doctors.some(d => (`${d.first_name || ''} ${d.last_name || ''}`.trim() || d.name) === assignDoctorName) ? assignDoctorName : ''}
                  onChange={e => setAssignDoctorName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none mb-2"
                >
                  <option value="">-- Select from staff --</option>
                  {doctors.map(d => {
                    const name = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.name;
                    return (
                      <option key={d.id} value={name}>
                        {name} — {d.designation || d.department || d.role || ''}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="text"
                  placeholder="Or type a doctor name manually"
                  value={assignDoctorName}
                  onChange={e => setAssignDoctorName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setShowAssignDoctor(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignDoctor}
                  disabled={assignDoctorSaving}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60"
                >
                  {assignDoctorSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Admit / Edit Expected Stay Modal ── */}
      {showAdmitModal && admitPatientTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {admitPatientTarget.admission_status === 'pending_admission' ? 'Admit Patient' : 'Edit Admission / Expected Stay'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {admitPatientTarget.first_name} {admitPatientTarget.last_name}
                  {admitPatientTarget.mrd_number && <span className="ml-2 text-teal-600 font-mono">{admitPatientTarget.mrd_number}</span>}
                </p>
              </div>
              <button onClick={() => setShowAdmitModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admission Date</label>
                <input
                  type="date"
                  value={admitForm.admission_date}
                  onChange={e => setAdmitForm(f => ({ ...f, admission_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Stay (Days)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Optional — e.g. 5"
                  value={admitForm.expected_stay_days}
                  onChange={e => setAdmitForm(f => ({ ...f, expected_stay_days: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Drives the live Checkout Date shown on the Dashboard. Leave blank if not yet known — you can set or adjust it any time.
                </p>
              </div>
              {admitForm.admission_date && admitForm.expected_stay_days !== '' && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
                  Expected checkout: <span className="font-semibold">{formatDateOnly(addDaysToDateString(admitForm.admission_date, Number(admitForm.expected_stay_days)))}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setShowAdmitModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAdmit}
                  disabled={admitSaving}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60"
                >
                  {admitSaving ? 'Saving...' : admitPatientTarget.admission_status === 'pending_admission' ? 'Admit' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Details Modal */}
      {showDetails && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Patient Details</h2>
                <p className="text-sm text-gray-600 mt-1">MRD: {selectedPatient.mrd_number || selectedPatient.patient_number}</p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Personal Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-teal-600" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Full Name</p>
                    <p className="font-semibold text-gray-900">
                      {selectedPatient.first_name} {selectedPatient.middle_name} {selectedPatient.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Gender</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Date of Birth</p>
                    <p className="font-semibold text-gray-900">
                      {selectedPatient.date_of_birth 
                        ? new Date(selectedPatient.date_of_birth).toLocaleDateString('en-IN')
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Age</p>
                    <p className="font-semibold text-gray-900">{calculateAge(selectedPatient.date_of_birth)} years</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Blood Group</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.blood_group || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Marital Status</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.marital_status || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                  <Phone className="w-5 h-5 mr-2 text-teal-600" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Primary Phone</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Alternate Phone</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.alternate_phone || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">Email</p>
                    <p className="font-semibold text-gray-900">{selectedPatient.email || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">Address</p>
                    <p className="font-semibold text-gray-900">
                      {selectedPatient.address || 'N/A'}
                      {selectedPatient.city && `, ${selectedPatient.city}`}
                      {selectedPatient.state && `, ${selectedPatient.state}`}
                      {selectedPatient.pincode && ` - ${selectedPatient.pincode}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              {(selectedPatient.allergies || selectedPatient.chronic_conditions || selectedPatient.current_medications) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-teal-600" />
                    Medical Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    {selectedPatient.allergies && (
                      <div>
                        <p className="text-gray-600">Allergies</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.allergies}</p>
                      </div>
                    )}
                    {selectedPatient.chronic_conditions && (
                      <div>
                        <p className="text-gray-600">Chronic Conditions</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.chronic_conditions}</p>
                      </div>
                    )}
                    {selectedPatient.current_medications && (
                      <div>
                        <p className="text-gray-600">Current Medications</p>
                        <p className="font-semibold text-gray-900">{selectedPatient.current_medications}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              {selectedPatient.emergency_contact_name && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                    <Phone className="w-5 h-5 mr-2 text-red-600" />
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Name</p>
                      <p className="font-semibold text-gray-900">{selectedPatient.emergency_contact_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Relation</p>
                      <p className="font-semibold text-gray-900">{selectedPatient.emergency_contact_relation || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600">Phone</p>
                      <p className="font-semibold text-gray-900">{selectedPatient.emergency_contact_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedPatient.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-teal-600" />
                    Notes
                  </h3>
                  <p className="text-sm text-gray-900">{selectedPatient.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => alert('Print functionality coming soon!')}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Discharge Summary Modal ── */}
      {showDischargeSummary && dischargeSummaryPatient && (
        <DischargeSummaryModal
          patient={dischargeSummaryPatient}
          existingSummary={dischargeSummaryExisting}
          onClose={() => { setShowDischargeSummary(false); setDischargeSummaryPatient(null); setDischargeSummaryExisting(null); }}
          onSave={() => { setShowDischargeSummary(false); setDischargeSummaryPatient(null); setDischargeSummaryExisting(null); }}
          onViewCaseSheet={() => {
            const p = dischargeSummaryPatient;
            setShowDischargeSummary(false); setDischargeSummaryPatient(null); setDischargeSummaryExisting(null);
            setCaseSheetPatient(p); setShowCaseSheet(true);
          }}
        />
      )}

      {/* ── IP Daily Progress Modal ── */}
      {showDailyProgress && dailyProgressPatient && (
        <IPDailyProgressModal
          patient={dailyProgressPatient}
          onClose={() => { setShowDailyProgress(false); setDailyProgressPatient(null); }}
        />
      )}

      {/* ── IP Case Sheet Modal ── */}
      {showCaseSheet && caseSheetPatient && (
        <IPCaseSheetModal
          patient={caseSheetPatient}
          onClose={() => { setShowCaseSheet(false); setCaseSheetPatient(null); }}
          onViewDischargeSummary={async () => {
            const p = caseSheetPatient;
            setShowCaseSheet(false); setCaseSheetPatient(null);
            await openDischargeSummary(p);
          }}
        />
      )}

      {/* ── OP Case Sheet Modal ── */}
      {showOPCaseSheet && opCaseSheetPatient && (
        <OPCaseSheetModal
          patient={opCaseSheetPatient}
          onClose={() => { setShowOPCaseSheet(false); setOpCaseSheetPatient(null); }}
        />
      )}

      {/* ── Prescription Modal ── */}
      {showPrescription && prescriptionPatient && (
        <PrescriptionModal
          patient={prescriptionPatient}
          onClose={() => { setShowPrescription(false); setPrescriptionPatient(null); }}
        />
      )}

      {/* ── Edit Patient Modal ── */}
      {showEditPatient && editingPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <PatientRegistrationNew
            patient={editingPatient}
            onClose={() => { setShowEditPatient(false); setEditingPatient(null); }}
            onSuccess={() => { setShowEditPatient(false); setEditingPatient(null); loadPatients(); }}
          />
        </div>
      )}
    </div>
  );
};

export default PatientPortal;
