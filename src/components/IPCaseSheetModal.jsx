import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, Plus, Pencil, Trash2, ClipboardList } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import InvestigationAttachments from './InvestigationAttachments';
import TreatmentPickerButton from './TreatmentPickerButton';
import PackagePickerButton from './PackagePickerButton';
import TreatmentItemsList from './TreatmentItemsList';
import MedicineTable from './MedicineTable';
import PrintSectionModal from './PrintSectionModal';
import { summarizeMedicineItems, buildMedicineItemsTableHTML } from '../lib/medicineSummary';
import { loadDoctors } from '../lib/staff';
import { handleContainerEnter, focusFirstField } from '../lib/formKeyNav';
import { formatDateOnly, addDaysToDateString } from '../lib/formatDate';
import { ROOMS } from '../lib/rooms';

const TAB_SEQUENCE = ['sheet', 'history', 'investigations'];

const PRINT_SECTIONS = [
  { id: 'sheet', label: 'Case Sheet' },
  { id: 'history', label: 'History & Examination' },
  { id: 'investigations', label: 'Investigations & Procedure' },
  { id: 'vitals', label: 'Vitals & Daily Log' },
];

const TREATMENT_DAYS_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 1);

const appendTreatment = (currentText, treatment) => {
  const entry = `${treatment.name} (₹${Number(treatment.price || 0).toLocaleString('en-IN')})`;
  return currentText ? `${currentText}, ${entry}` : entry;
};

const today = () => new Date().toISOString().split('T')[0];

const emptyDailyEntry = () => ({
  date: today(),
  bp_morning: '',
  bp_evening: '',
  temperature: '',
  pulse: '',
  spo2: '',
  weight: '',
  diet: '',
  treatment_performed: '',
  treatment_items: [],
  medicines_given: '',
  medicine_items: [],
  doctors_notes: '',
  treatment_days: 1,
});

const HOSPITAL = {
  name: 'Tatva Ayurved',
  tagline: 'Ayurveda for Health & Happiness',
  address: 'Thekkuveedu Lane, Kannur Road, Kozhikode',
  phone: '9895112264, 0495 2766717',
  email: 'info@tatvaayurved.com',
  website: 'www.tatvaayurved.com',
  regNo: 'BFHP03-C110100-00061-2025',
};

const emptyForm = () => ({
  department: '',
  physician_name: '',
  case_sheet_date: new Date().toISOString().split('T')[0],

  father_husband_name: '',
  religion: '',
  occupation: '',
  nationality: '',
  monthly_income: '',
  nearest_relative: '',
  marital_status: '',
  caste: '',

  room_number: '',
  admission_date: '',
  admission_time: '',
  discharge_date: '',
  discharge_time: '',
  admin_diagnosis: '',
  result: '',
  roopam: '',

  history_presenting_complaints: '',
  history_past_illness: '',
  family_history: '',
  current_medicines: '',
  medication_details: '',
  treatment_details: '',

  diet: '', appetite: '', bowel: '', micturition: '', sleep: '',
  habits_addiction: '', hypersensitivity: '', hereditary: '', menstrual_history: '',

  pulse: '', bp: '', heart_rate: '', temperature: '', height: '', weight: '',

  cvs_cns_rs_ls: '', dm: '', htn: '', ihd: '', hyperlipidemia: '',

  nadi: '', mutra: '', malam: '', jihwa: '', sabda: '', sparsa: '', drik: '', akriti: '',

  dooshya: '', desha: '', bala: '', kala: '', anala: '', prakruti: '', vayah: '', satwa: '', satmya: '', ahara: '',

  srotas_involved: '',
  ayurvedic_diagnosis: '',
  investigations: '',
  procedure: '',
  investigation_attachments: [],
});

const Field = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type={type}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const TextArea = ({ label, value, onChange, rows = 3, placeholder, actions }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      {actions}
    </div>
    <textarea
      rows={rows}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide pt-3 border-t border-gray-100 first:pt-0 first:border-0">{children}</h3>
);

const fmtDate = (d) => formatDateOnly(d);

// Formats a native <input type="time"> value ("HH:MM", 24-hour) into the
// "hh:mmAM/PM" style used on the printed case sheet and shared with the
// Discharge Summary's Admission Time field.
const fmtTime12h = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}${period}`;
};

// ── Print HTML generator ────────────────────────────────────────────────
const buildCaseSheetPrintHTML = (patient, form, dailyProgress, sectionId = 'all', doctorInfo = {}) => {
  const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim().toUpperCase();
  const age = patient?.age || '';
  const gender = patient?.gender?.[0]?.toUpperCase() || '';
  const address = [patient?.address, patient?.city, patient?.state, patient?.pincode].filter(Boolean).join(', ');

  const row2 = (l1, v1, l2, v2) => `<tr><td><strong>${l1}</strong></td><td>${v1 || ''}</td><td><strong>${l2}</strong></td><td>${v2 || ''}</td></tr>`;

  const vitalsRows = dailyProgress.filter(e => e.bp_morning || e.bp_evening || e.temperature || e.pulse || e.spo2 || e.weight)
    .map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.bp_morning || ''}</td><td>${e.bp_evening || ''}</td><td>${e.temperature || ''}</td><td>${e.pulse || ''}</td><td>${e.spo2 || ''}</td><td>${e.weight || ''}</td></tr>`).join('');

  const treatmentRows = dailyProgress.filter(e => e.treatment_performed || e.medicines_given)
    .map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.treatment_performed || ''}</td><td>${buildMedicineItemsTableHTML(e.medicine_items) || e.medicines_given || ''}</td></tr>`).join('');

  const dailyReportRows = dailyProgress.filter(e => e.doctors_notes)
    .map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.doctors_notes || ''}</td><td>${e.created_by || ''}</td></tr>`).join('');

  const sectionLabel = PRINT_SECTIONS.find(s => s.id === sectionId)?.label;
  const titleText = sectionLabel ? `IN PATIENT CASE FILE — ${sectionLabel.toUpperCase()}` : 'IN PATIENT CASE FILE';

  const sheetHTML = `
<div class="section-title">Roopam (Presenting complaints, signs &amp; symptoms with duration)</div>
<p style="white-space:pre-line;">${form.roopam}</p>`;

  const historyHTML = `
<div class="section-title">History of Presenting Complaints</div>
<p style="white-space:pre-line;">${form.history_presenting_complaints}</p>

<div class="section-title">History of Past Illness</div>
<p style="white-space:pre-line;">${form.history_past_illness}</p>

<div class="section-title">Family History</div>
<p style="white-space:pre-line;">${form.family_history}</p>

<div class="section-title">Presently Taking the Following Medicines</div>
<p style="white-space:pre-line;">${form.current_medicines}</p>

<div class="section-title">Medication Details</div>
<p style="white-space:pre-line;">${form.medication_details}</p>

<div class="section-title">Treatment Details</div>
<p style="white-space:pre-line;">${form.treatment_details}</p>

<div class="section-title">Personal History</div>
<table class="grid">
  ${row2('Diet', form.diet, 'Habits / Addiction', form.habits_addiction)}
  ${row2('Appetite', form.appetite, 'Hypersensitivity', form.hypersensitivity)}
  ${row2('Bowel', form.bowel, 'Hereditary', form.hereditary)}
  ${row2('Micturition', form.micturition, 'Menstrual History', form.menstrual_history)}
  ${row2('Sleep', form.sleep, '', '')}
</table>

<div class="section-title">General Examination</div>
<table class="grid">
  ${row2('Pulse', form.pulse, 'Heart Rate', form.heart_rate)}
  ${row2('BP', form.bp, 'Temperature', form.temperature)}
  ${row2('Height', form.height, 'Weight', form.weight)}
</table>

<div class="section-title">Systemic Examination</div>
<p><strong>CVS / CNS / RS / LS:</strong> ${form.cvs_cns_rs_ls}</p>
<table class="grid">
  ${row2('DM', form.dm, 'HTN', form.htn)}
  ${row2('IHD', form.ihd, 'Hyperlipidemia', form.hyperlipidemia)}
</table>

<div class="section-title">ASHTASTHANA PAREEKSHA</div>
<table class="grid">
  ${row2('Nadi', form.nadi, 'Sabda', form.sabda)}
  ${row2('Mutra', form.mutra, 'Sparsa', form.sparsa)}
  ${row2('Malam', form.malam, 'Drik', form.drik)}
  ${row2('Jihwa', form.jihwa, 'Akriti', form.akriti)}
</table>

<div class="section-title">Dasa Vidha Pareeksha</div>
<table class="grid">
  ${row2('Dooshya', form.dooshya, 'Desha', form.desha)}
  ${row2('Bala', form.bala, 'Kala', form.kala)}
  ${row2('Anala', form.anala, 'Prakruti', form.prakruti)}
  ${row2('Vayah', form.vayah, 'Satwa', form.satwa)}
  ${row2('Satmya', form.satmya, 'Ahara', form.ahara)}
</table>

<div class="section-title">Srotas Involved</div>
<p>${form.srotas_involved}</p>

<div class="section-title">Diagnosis</div>
<p>${form.ayurvedic_diagnosis}</p>`;

  const vitalsHTML = `
<div class="section-title">Blood Pressure &amp; Temperature</div>
<table class="grid">
  <thead><tr><th>Date</th><th>BP (Morning)</th><th>BP (Evening)</th><th>Temperature</th><th>Pulse</th><th>SpO2</th><th>Weight</th></tr></thead>
  <tbody>${vitalsRows || '<tr><td colspan="7" style="text-align:center;color:#888;">No records</td></tr>'}</tbody>
</table>

<div class="section-title">Treatment &amp; Medicine Given</div>
<table class="grid">
  <thead><tr><th style="width:90px;">Date</th><th>Treatment / Procedure</th><th>Medicines</th></tr></thead>
  <tbody>${treatmentRows || '<tr><td colspan="3" style="text-align:center;color:#888;">No records</td></tr>'}</tbody>
</table>

<div class="section-title">Daily Reports</div>
<table class="grid">
  <thead><tr><th style="width:90px;">Date</th><th>Daily Report</th><th>Sign. of Duty Doctor</th></tr></thead>
  <tbody>${dailyReportRows || '<tr><td colspan="3" style="text-align:center;color:#888;">No records</td></tr>'}</tbody>
</table>`;

  const investigationsHTML = `
<div class="section-title">Investigations</div>
<p style="white-space:pre-line;">${form.investigations}</p>

<div class="section-title">Procedure</div>
<p style="white-space:pre-line;">${form.procedure}</p>`;

  const availableSections = { sheet: sheetHTML, history: historyHTML, vitals: vitalsHTML, investigations: investigationsHTML };
  const orderedKeys = ['sheet', 'history', 'investigations', 'vitals'];
  const selectedKeys = sectionId === 'all' ? orderedKeys : orderedKeys.filter(k => k === sectionId);
  const bodyHTML = selectedKeys
    .map((k, i) => (i > 0 ? '<div class="page-break"></div>' : '') + availableSections[k])
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>IP Case Sheet – ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding-bottom: 140px; }
    @page { size: A4; margin: 15mm 12mm; }
    @media print { body { -webkit-print-color-adjust: exact; } }

    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a5f4e; padding-bottom: 10px; margin-bottom: 10px; }
    .logo-block { min-width: 160px; }
    .logo-block img { height: 48px; margin-bottom: 4px; }
    .logo-block .brand { font-size: 18px; font-weight: bold; letter-spacing: 1px; color: #1a5f4e; }
    .logo-block .tagline { font-size: 9px; color: #666; }
    .contact-block { text-align: right; font-size: 10px; line-height: 1.6; }
    .contact-block .reg { font-size: 9px; color: #555; }

    .title { text-align: center; font-size: 15px; font-weight: bold; text-decoration: underline; margin: 8px 0 12px; letter-spacing: 1px; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 10px; }
    .info-left, .info-right { padding: 0 6px; }
    .info-row { display: flex; gap: 4px; margin-bottom: 4px; font-size: 11px; }
    .info-label { font-weight: bold; min-width: 140px; }

    .section-title { font-size: 12px; font-weight: bold; margin: 10px 0 5px; text-transform: uppercase; }
    .page-break { page-break-before: always; }

    table.grid { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
    table.grid th, table.grid td { border: 1px solid #aaa; padding: 4px 8px; text-align: left; }
    table.grid th { background: #f0f0f0; font-weight: bold; }

    table.med-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    table.med-table th, table.med-table td { border: 1px solid #ccc; padding: 2px 4px; text-align: left; }
    table.med-table th { background: #f5f5f5; font-weight: 600; }

    /* Signature block stays pinned to the bottom of the printed page, same
       treatment as the prescription and invoice printouts, instead of
       trailing wherever the content happens to end. */
    .footer { margin-top: 50px; border-top: 2px solid #1a5f4e; padding-top: 10px; display: flex; justify-content: space-between; }
    @media print {
      .footer { position: fixed; left: 12mm; right: 12mm; bottom: 15mm; margin-top: 0; background: #fff; }
    }
    .sig-block { text-align: right; }
    .sig-line { border-top: 1px solid #000; width: 180px; margin-top: 40px; margin-left: auto; margin-bottom: 4px; }
    .sig-block .doctor-name { font-weight: bold; font-size: 11px; }
    .sig-block .reg { font-size: 9px; color: #555; }
  </style>
</head>
<body>

<div class="header">
  <div class="logo-block">
    <img src="/logo.png" alt="Tatva Ayurved" onerror="this.style.display='none'">
    <div class="brand">TATVA AYURVED</div>
    <div class="tagline">Ayurveda for Health &amp; Happiness</div>
  </div>
  <div class="contact-block">
    📍 ${HOSPITAL.address}<br>
    📞 ${HOSPITAL.phone}<br>
    ✉ ${HOSPITAL.email}<br>
    🌐 ${HOSPITAL.website}<br>
    <span class="reg">Reg No: ${HOSPITAL.regNo}</span>
  </div>
</div>

<div class="title">${titleText}</div>

<div class="info-grid">
  <div class="info-left">
    <div class="info-row"><span class="info-label">Name of Patient:</span> ${patientName}</div>
    <div class="info-row"><span class="info-label">Age / Sex:</span> ${age} / ${gender}</div>
    <div class="info-row"><span class="info-label">Address:</span> ${address}</div>
    <div class="info-row"><span class="info-label">Father / Husband Name:</span> ${form.father_husband_name}</div>
    <div class="info-row"><span class="info-label">Occupation:</span> ${form.occupation}</div>
    <div class="info-row"><span class="info-label">Religion / Caste:</span> ${form.religion} ${form.caste ? '/ ' + form.caste : ''}</div>
    <div class="info-row"><span class="info-label">Nationality:</span> ${form.nationality}</div>
    <div class="info-row"><span class="info-label">Marital Status:</span> ${form.marital_status}</div>
    <div class="info-row"><span class="info-label">Nearest Relative:</span> ${form.nearest_relative}</div>
  </div>
  <div class="info-right">
    <div class="info-row"><span class="info-label">MRD No:</span> ${patient?.mrd_number || ''}</div>
    <div class="info-row"><span class="info-label">IP No:</span> ${patient?.ip_number || ''}</div>
    <div class="info-row"><span class="info-label">Room No:</span> ${form.room_number}</div>
    <div class="info-row"><span class="info-label">Department:</span> ${form.department}</div>
    <div class="info-row"><span class="info-label">Physician:</span> ${form.physician_name}</div>
    <div class="info-row"><span class="info-label">Date of Admission:</span> ${fmtDate(form.admission_date)}${form.admission_time ? ` (${fmtTime12h(form.admission_time)})` : ''}</div>
    <div class="info-row"><span class="info-label">Date of Discharge:</span> ${fmtDate(form.discharge_date)}${form.discharge_time ? ` (${fmtTime12h(form.discharge_time)})` : ''}</div>
    <div class="info-row"><span class="info-label">Diagnosis:</span> ${form.admin_diagnosis}</div>
    <div class="info-row"><span class="info-label">Result:</span> ${form.result}</div>
  </div>
</div>

${bodyHTML}

<div class="footer">
  <div></div>
  <div class="sig-block">
    <div class="sig-line"></div>
    ${doctorInfo.name ? `<p class="doctor-name">Dr. ${doctorInfo.name}</p>` : ''}
    ${doctorInfo.qualification ? `<p class="reg">${doctorInfo.qualification}</p>` : ''}
    ${doctorInfo.registrationNumber ? `<p class="reg">Reg No: ${doctorInfo.registrationNumber}</p>` : ''}
    <p style="font-size:10px;margin-top:2px;">Signature of Physician</p>
  </div>
</div>

</body>
</html>`;
};

// ── Main Modal ──────────────────────────────────────────────────────────
const IPCaseSheetModal = ({ patient, onClose, onViewDischargeSummary }) => {
  const patientId = patient?.id || patient?.firebaseId;
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('sheet');
  const [dailyProgress, setDailyProgress] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [dailyForm, setDailyForm] = useState(emptyDailyEntry());
  const [savingDaily, setSavingDaily] = useState(false);
  const [editingDailyId, setEditingDailyId] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [occupiedRooms, setOccupiedRooms] = useState(new Set());
  const tabContainerRef = useRef(null);

  useEffect(() => {
    loadCaseSheet();
    loadDailyProgress();
    loadDoctors().then(setDoctors);
    loadOccupiedRooms();
  }, []);

  // Rooms held by every OTHER currently-admitted IP patient — so the
  // dropdown only ever offers rooms that are actually free right now.
  const loadOccupiedRooms = async () => {
    try {
      const patientsSnap = await getDocs(query(collection(db, 'patients'), where('patient_type', '==', 'IP')));
      const activeOtherIds = patientsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.id !== patientId && p.admission_status !== 'pending_admission' && p.admission_status !== 'discharged')
        .map(p => p.id);
      if (activeOtherIds.length === 0) { setOccupiedRooms(new Set()); return; }

      const caseSheetsSnap = await getDocs(collection(db, 'ip_case_sheets'));
      const occupied = new Set();
      caseSheetsSnap.docs.forEach(d => {
        if (activeOtherIds.includes(d.id) && d.data().room_number) occupied.add(d.data().room_number);
      });
      setOccupiedRooms(occupied);
    } catch (e) {
      console.error('Error loading room occupancy:', e);
    }
  };

  useEffect(() => {
    if (!loading) focusFirstField(tabContainerRef.current);
  }, [activeTab, loading]);

  const advanceTab = (currentId) => {
    const idx = TAB_SEQUENCE.indexOf(currentId);
    if (idx >= 0 && idx < TAB_SEQUENCE.length - 1) setActiveTab(TAB_SEQUENCE[idx + 1]);
  };

  const loadCaseSheet = async () => {
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, 'ip_case_sheets', patientId));
      if (snap.exists()) {
        const data = snap.data();
        // Older case sheets stored a single combined "treatment_medication_details" field.
        if (!data.treatment_details && data.treatment_medication_details) {
          data.treatment_details = data.treatment_medication_details;
        }
        setForm(prev => ({ ...prev, ...data }));
      } else {
        setForm(prev => ({
          ...prev,
          admission_date: patient?.admission_date || '',
          physician_name: patient?.assigned_doctor || '',
        }));
      }
    } catch (e) {
      console.error('Error loading case sheet:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyProgress = async () => {
    if (!patientId) return;
    try {
      setLoadingProgress(true);
      // Sorted client-side rather than via orderBy() — combining it with the
      // where() above needs a Firestore composite index that isn't set up,
      // which made this query fail silently and the tab always look empty.
      const q = query(collection(db, 'daily_progress'), where('patient_id', '==', patientId));
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      entries.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      setDailyProgress(entries);
    } catch (e) {
      console.error('Error loading daily progress:', e);
    } finally {
      setLoadingProgress(false);
    }
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    try {
      setSaving(true);
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const now = new Date().toISOString();
      await setDoc(doc(db, 'ip_case_sheets', patientId), {
        ...form,
        patient_id: patientId,
        patient_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
        mrd_number: patient?.mrd_number || '',
        ip_number: patient?.ip_number || '',
        updated_at: now,
        updated_by: currentUser.email || '',
        created_at: form.created_at || now,
        created_by: form.created_by || currentUser.email || '',
      }, { merge: true });

      alert('✅ Case sheet saved!');
    } catch (e) {
      alert('Error saving: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDailyEntry = async () => {
    if (!dailyForm.date) { alert('Please select a date.'); return; }
    try {
      setSavingDaily(true);
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const now = new Date().toISOString();
      const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();
      const { treatment_days, ...entryFields } = dailyForm;

      if (editingDailyId) {
        await updateDoc(doc(db, 'daily_progress', editingDailyId), {
          ...entryFields,
          updated_at: now,
          updated_by: currentUser.email || '',
        });
      } else {
        // "Treatment Days" pre-schedules one entry per consecutive day, all
        // starting with the same vitals/treatment/medication — the doctor
        // then edits each day's entry individually as that day happens.
        const days = Math.max(1, Math.min(15, Number(treatment_days) || 1));
        const groupId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const batch = writeBatch(db);
        for (let i = 0; i < days; i++) {
          const ref = doc(collection(db, 'daily_progress'));
          batch.set(ref, {
            ...entryFields,
            date: addDaysToDateString(dailyForm.date, i),
            patient_id: patientId,
            patient_name: patientName,
            mrd_number: patient?.mrd_number || patient?.patient_number || '',
            ip_number: patient?.ip_number || '',
            treatment_group_id: groupId,
            day_number: i + 1,
            total_days: days,
            created_at: now,
            created_by: currentUser.email || '',
          });
        }
        await batch.commit();
      }

      setDailyForm(emptyDailyEntry());
      setEditingDailyId(null);
      await loadDailyProgress();
    } catch (e) {
      alert('Error saving daily entry: ' + e.message);
    } finally {
      setSavingDaily(false);
    }
  };

  const handleEditDailyEntry = (entry) => {
    setEditingDailyId(entry.id);
    setDailyForm({
      date: entry.date || today(),
      bp_morning: entry.bp_morning || '',
      bp_evening: entry.bp_evening || '',
      temperature: entry.temperature || '',
      pulse: entry.pulse || '',
      spo2: entry.spo2 || '',
      weight: entry.weight || '',
      diet: entry.diet || '',
      treatment_performed: entry.treatment_performed || '',
      treatment_items: entry.treatment_items || [],
      medicines_given: entry.medicines_given || '',
      medicine_items: entry.medicine_items || [],
      doctors_notes: entry.doctors_notes || '',
      treatment_days: 1,
    });
  };

  const handleCancelEditDaily = () => {
    setEditingDailyId(null);
    setDailyForm(emptyDailyEntry());
  };

  const handleDeleteDailyEntry = async (id) => {
    if (!window.confirm('Delete this daily record?')) return;
    try {
      await deleteDoc(doc(db, 'daily_progress', id));
      setDailyProgress(prev => prev.filter(e => e.id !== id));
      if (editingDailyId === id) handleCancelEditDaily();
    } catch (e) {
      alert('Error deleting entry: ' + e.message);
    }
  };

  const handlePrint = (sectionId = 'all') => {
    const matchedDoctor = doctors.find(d => d.name === form.physician_name);
    const doctorInfo = matchedDoctor ? {
      name: form.physician_name.replace(/^Dr\.?\s*/i, ''),
      qualification: matchedDoctor.qualification || '',
      registrationNumber: matchedDoctor.isDoctor ? (matchedDoctor.registrationNumber || '') : '',
    } : {};
    const html = buildCaseSheetPrintHTML(patient, form, dailyProgress, sectionId, doctorInfo);
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups for this site to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const tabs = [
    { id: 'sheet', label: 'Case Sheet' },
    { id: 'history', label: 'History & Examination' },
    { id: 'investigations', label: 'Investigations & Procedure' },
    { id: 'vitals', label: `Vitals & Daily Log ${dailyProgress.length > 0 ? `(${dailyProgress.length})` : ''}` },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-teal-700 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white">IP Case Sheet</h2>
            <p className="text-teal-200 text-sm mt-0.5">
              {patient?.first_name} {patient?.last_name}
              {patient?.mrd_number && <span className="ml-2 font-mono">MRD: {patient.mrd_number}</span>}
              {patient?.ip_number && <span className="ml-2 font-mono">IP: {patient.ip_number}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {onViewDischargeSummary && (
              <button
                onClick={onViewDischargeSummary}
                className="flex items-center gap-2 px-4 py-2 bg-teal-800 text-white rounded-lg hover:bg-teal-900 font-medium text-sm"
                title="Open this patient's Discharge Summary"
              >
                <ClipboardList className="w-4 h-4" /> Discharge Summary
              </button>
            )}
            <button
              onClick={() => setShowPrintOptions(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-teal-700 rounded-lg hover:bg-teal-50 font-medium text-sm"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-400 font-medium text-sm disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} className="p-2 text-white hover:bg-teal-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === t.id ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading case sheet…</div>
          ) : (
            <>
              {/* ── CASE SHEET ── */}
              {activeTab === 'sheet' && (
                <div className="space-y-5" ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e, () => advanceTab('sheet'))}>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Department" value={form.department} onChange={v => set('department', v)} />
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Physician's Name</label>
                      <select
                        value={form.physician_name}
                        onChange={e => set('physician_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value="">Select Doctor</option>
                        {doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        {form.physician_name && !doctors.some(d => d.name === form.physician_name) && (
                          <option value={form.physician_name}>{form.physician_name}</option>
                        )}
                      </select>
                    </div>
                    <Field label="Date" type="date" value={form.case_sheet_date} onChange={v => set('case_sheet_date', v)} />
                  </div>

                  <SectionTitle>Demographics</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Father / Husband Name" value={form.father_husband_name} onChange={v => set('father_husband_name', v)} />
                    <Field label="Religion" value={form.religion} onChange={v => set('religion', v)} />
                    <Field label="Caste" value={form.caste} onChange={v => set('caste', v)} />
                    <Field label="Occupation" value={form.occupation} onChange={v => set('occupation', v)} />
                    <Field label="Nationality" value={form.nationality} onChange={v => set('nationality', v)} />
                    <Field label="Monthly Income" value={form.monthly_income} onChange={v => set('monthly_income', v)} />
                    <Field label="Marital Status" value={form.marital_status} onChange={v => set('marital_status', v)} />
                    <div className="col-span-2">
                      <Field label="Nearest Relative (Name & Address)" value={form.nearest_relative} onChange={v => set('nearest_relative', v)} />
                    </div>
                  </div>

                  <SectionTitle>Admission Details</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Room Number</label>
                      <select
                        value={form.room_number}
                        onChange={e => set('room_number', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value="">Select Room</option>
                        {ROOMS.filter(r => !occupiedRooms.has(r.number) || r.number === form.room_number).map(r => (
                          <option key={r.number} value={r.number}>
                            Room {r.number} ({r.type} — ₹{r.rate}/day)
                          </option>
                        ))}
                      </select>
                      {ROOMS.every(r => occupiedRooms.has(r.number) && r.number !== form.room_number) && (
                        <p className="text-xs text-red-600 mt-1">All rooms are currently occupied.</p>
                      )}
                    </div>
                    <Field label="Date of Admission" type="date" value={form.admission_date} onChange={v => set('admission_date', v)} />
                    <Field label="Time of Admission" type="time" value={form.admission_time} onChange={v => set('admission_time', v)} />
                    <Field label="Date of Discharge" type="date" value={form.discharge_date} onChange={v => set('discharge_date', v)} />
                    <Field label="Time of Discharge" type="time" value={form.discharge_time} onChange={v => set('discharge_time', v)} />
                    <Field label="Diagnosis" value={form.admin_diagnosis} onChange={v => set('admin_diagnosis', v)} />
                    <Field label="Result" value={form.result} onChange={v => set('result', v)} />
                  </div>

                  <TextArea label="Roopam (Presenting complaints, signs & symptoms with duration)" rows={4}
                    value={form.roopam} onChange={v => set('roopam', v)} />
                </div>
              )}

              {/* ── HISTORY & EXAMINATION ── */}
              {activeTab === 'history' && (
                <div className="space-y-5" ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e, () => advanceTab('history'))}>
                  <SectionTitle>History</SectionTitle>
                  <TextArea label="History of Presenting Complaints" rows={3} value={form.history_presenting_complaints} onChange={v => set('history_presenting_complaints', v)} />
                  <TextArea label="History of Past Illness" rows={3} value={form.history_past_illness} onChange={v => set('history_past_illness', v)} />
                  <TextArea label="Family History" rows={2} value={form.family_history} onChange={v => set('family_history', v)} />
                  <TextArea label="Presently Taking the Following Medicines" rows={2} value={form.current_medicines} onChange={v => set('current_medicines', v)} />
                  <TextArea
                    label="Medication Details"
                    rows={3}
                    value={form.medication_details}
                    onChange={v => set('medication_details', v)}
                    placeholder="Medications reported by the patient (as told to you) — the structured, per-day medication list is entered in the Vitals & Daily Log tab."
                  />
                  <TextArea
                    label="Treatment Details"
                    rows={3}
                    value={form.treatment_details}
                    onChange={v => set('treatment_details', v)}
                    placeholder="Treatment history reported by the patient — the structured, per-day treatment list is entered in the Vitals & Daily Log tab."
                  />

                  <SectionTitle>Personal History</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Diet" value={form.diet} onChange={v => set('diet', v)} />
                    <Field label="Appetite" value={form.appetite} onChange={v => set('appetite', v)} />
                    <Field label="Bowel" value={form.bowel} onChange={v => set('bowel', v)} />
                    <Field label="Micturition" value={form.micturition} onChange={v => set('micturition', v)} />
                    <Field label="Sleep" value={form.sleep} onChange={v => set('sleep', v)} />
                    <Field label="Habits / Addiction" value={form.habits_addiction} onChange={v => set('habits_addiction', v)} />
                    <Field label="Hypersensitivity" value={form.hypersensitivity} onChange={v => set('hypersensitivity', v)} />
                    <Field label="Hereditary" value={form.hereditary} onChange={v => set('hereditary', v)} />
                    <Field label="Menstrual History" value={form.menstrual_history} onChange={v => set('menstrual_history', v)} />
                  </div>

                  <SectionTitle>General Examination</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Pulse" value={form.pulse} onChange={v => set('pulse', v)} />
                    <Field label="Heart Rate" value={form.heart_rate} onChange={v => set('heart_rate', v)} />
                    <Field label="Height" value={form.height} onChange={v => set('height', v)} />
                    <Field label="BP" value={form.bp} onChange={v => set('bp', v)} />
                    <Field label="Temperature" value={form.temperature} onChange={v => set('temperature', v)} />
                    <Field label="Weight" value={form.weight} onChange={v => set('weight', v)} />
                  </div>

                  <SectionTitle>Systemic Examination</SectionTitle>
                  <TextArea label="CVS / CNS / RS / LS" rows={2} value={form.cvs_cns_rs_ls} onChange={v => set('cvs_cns_rs_ls', v)} />
                  <div className="grid grid-cols-4 gap-4">
                    <Field label="DM" value={form.dm} onChange={v => set('dm', v)} />
                    <Field label="HTN" value={form.htn} onChange={v => set('htn', v)} />
                    <Field label="IHD" value={form.ihd} onChange={v => set('ihd', v)} />
                    <Field label="Hyperlipidemia" value={form.hyperlipidemia} onChange={v => set('hyperlipidemia', v)} />
                  </div>

                  <SectionTitle>ASHTASTHANA PAREEKSHA</SectionTitle>
                  <div className="grid grid-cols-4 gap-3">
                    <Field label="Nadi" value={form.nadi} onChange={v => set('nadi', v)} />
                    <Field label="Mutra" value={form.mutra} onChange={v => set('mutra', v)} />
                    <Field label="Malam" value={form.malam} onChange={v => set('malam', v)} />
                    <Field label="Jihwa" value={form.jihwa} onChange={v => set('jihwa', v)} />
                    <Field label="Sabda" value={form.sabda} onChange={v => set('sabda', v)} />
                    <Field label="Sparsa" value={form.sparsa} onChange={v => set('sparsa', v)} />
                    <Field label="Drik" value={form.drik} onChange={v => set('drik', v)} />
                    <Field label="Akriti" value={form.akriti} onChange={v => set('akriti', v)} />
                  </div>

                  <SectionTitle>Dasa Vidha Pareeksha</SectionTitle>
                  <div className="grid grid-cols-5 gap-3">
                    <Field label="Dooshya" value={form.dooshya} onChange={v => set('dooshya', v)} />
                    <Field label="Desha" value={form.desha} onChange={v => set('desha', v)} />
                    <Field label="Bala" value={form.bala} onChange={v => set('bala', v)} />
                    <Field label="Kala" value={form.kala} onChange={v => set('kala', v)} />
                    <Field label="Anala" value={form.anala} onChange={v => set('anala', v)} />
                    <Field label="Prakruti" value={form.prakruti} onChange={v => set('prakruti', v)} />
                    <Field label="Vayah" value={form.vayah} onChange={v => set('vayah', v)} />
                    <Field label="Satwa" value={form.satwa} onChange={v => set('satwa', v)} />
                    <Field label="Satmya" value={form.satmya} onChange={v => set('satmya', v)} />
                    <Field label="Ahara" value={form.ahara} onChange={v => set('ahara', v)} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Srotas Involved" value={form.srotas_involved} onChange={v => set('srotas_involved', v)} />
                    <Field label="Diagnosis (Ayurvedic)" value={form.ayurvedic_diagnosis} onChange={v => set('ayurvedic_diagnosis', v)} />
                  </div>
                </div>
              )}

              {/* ── VITALS & DAILY LOG ── */}
              {activeTab === 'vitals' && (
                <div className="space-y-5">
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50" ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e)}>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
                      {editingDailyId ? `Editing Entry — ${fmtDate(dailyForm.date)}` : 'Add Daily Record'}
                    </h3>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <Field label="Date" type="date" value={dailyForm.date} onChange={v => setDailyForm(p => ({ ...p, date: v }))} />
                      {!editingDailyId && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Treatment Days</label>
                          <select
                            value={dailyForm.treatment_days}
                            onChange={e => setDailyForm(p => ({ ...p, treatment_days: Number(e.target.value) }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                          >
                            {TREATMENT_DAYS_OPTIONS.map(n => <option key={n} value={n}>{n} day{n > 1 ? 's' : ''}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    {!editingDailyId && dailyForm.treatment_days > 1 && (
                      <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 mb-3">
                        This will create {dailyForm.treatment_days} entries, one per day from {fmtDate(dailyForm.date)} to {fmtDate(addDaysToDateString(dailyForm.date, dailyForm.treatment_days - 1))}, so you can fill in each day's vitals and treatment as it happens.
                      </p>
                    )}

                    <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Vitals</p>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <Field label="BP Morning" value={dailyForm.bp_morning} onChange={v => setDailyForm(p => ({ ...p, bp_morning: v }))} placeholder="e.g. 120/80" />
                      <Field label="BP Evening" value={dailyForm.bp_evening} onChange={v => setDailyForm(p => ({ ...p, bp_evening: v }))} placeholder="e.g. 118/76" />
                      <Field label="Temperature" value={dailyForm.temperature} onChange={v => setDailyForm(p => ({ ...p, temperature: v }))} placeholder="e.g. 98.6°F" />
                      <Field label="Pulse" value={dailyForm.pulse} onChange={v => setDailyForm(p => ({ ...p, pulse: v }))} placeholder="e.g. 72/min" />
                      <Field label="SPO2" value={dailyForm.spo2} onChange={v => setDailyForm(p => ({ ...p, spo2: v }))} placeholder="e.g. 98%" />
                      <Field label="Weight" value={dailyForm.weight} onChange={v => setDailyForm(p => ({ ...p, weight: v }))} placeholder="e.g. 65 kg" />
                    </div>

                    <div className="space-y-3 mb-3">
                      <MedicineTable
                        items={dailyForm.medicine_items}
                        onChange={(items) => setDailyForm(p => ({ ...p, medicine_items: items, medicines_given: summarizeMedicineItems(items) }))}
                        label="Medicines Given"
                      />
                      <TextArea
                        label="Treatment Performed"
                        rows={2}
                        value={dailyForm.treatment_performed}
                        onChange={v => setDailyForm(p => ({ ...p, treatment_performed: v }))}
                        placeholder="e.g. Abhyanga, Shirodhara, Panchakarma…"
                        actions={
                          <div className="flex items-center gap-1">
                            <TreatmentPickerButton
                              onSelect={(t) => setDailyForm(p => ({
                                ...p,
                                treatment_performed: appendTreatment(p.treatment_performed, t),
                                treatment_items: [...(p.treatment_items || []), { name: t.name, price: Number(t.price) || 0 }],
                              }))}
                            />
                            <PackagePickerButton
                              onSelect={(pkg) => setDailyForm(p => ({
                                ...p,
                                treatment_performed: appendTreatment(p.treatment_performed, { name: pkg.name, price: pkg.cost }),
                                treatment_items: [...(p.treatment_items || []), { name: pkg.name, price: Number(pkg.cost) || 0 }],
                              }))}
                            />
                          </div>
                        }
                      />
                      <TreatmentItemsList
                        items={dailyForm.treatment_items}
                        onRemove={(idx) => setDailyForm(p => ({ ...p, treatment_items: p.treatment_items.filter((_, i) => i !== idx) }))}
                      />
                      <TextArea label="Diet / Food" rows={2} value={dailyForm.diet} onChange={v => setDailyForm(p => ({ ...p, diet: v }))} placeholder="e.g. Light Ayurvedic diet — khichdi, warm water…" />
                      <TextArea label="Doctor's Notes / Observations" rows={2} value={dailyForm.doctors_notes} onChange={v => setDailyForm(p => ({ ...p, doctors_notes: v }))} placeholder="Patient response, observations, plan changes…" />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveDailyEntry}
                        disabled={savingDaily}
                        className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-60"
                      >
                        <Plus className="w-4 h-4" />
                        {savingDaily
                          ? 'Saving...'
                          : editingDailyId
                            ? 'Update Entry'
                            : dailyForm.treatment_days > 1 ? `Add ${dailyForm.treatment_days} Entries` : 'Add Entry'}
                      </button>
                      {editingDailyId && (
                        <button
                          onClick={handleCancelEditDaily}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {loadingProgress ? (
                    <div className="text-center py-8 text-gray-400">Loading daily records…</div>
                  ) : dailyProgress.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="font-medium">No daily progress records yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dailyProgress.map(e => (
                        <div key={e.id} className={`border rounded-xl overflow-hidden ${editingDailyId === e.id ? 'border-teal-400 ring-1 ring-teal-200' : 'border-gray-200'}`}>
                          <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800 text-sm">{fmtDate(e.date)}</span>
                              {e.total_days > 1 && (
                                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">Day {e.day_number} of {e.total_days}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEditDailyEntry(e)} className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteDailyEntry(e.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="px-4 py-3 grid grid-cols-3 gap-3 text-sm">
                            {[
                              ['BP Morning', e.bp_morning], ['BP Evening', e.bp_evening], ['Temperature', e.temperature],
                              ['Pulse', e.pulse], ['SPO2', e.spo2], ['Weight', e.weight],
                            ].map(([label, val]) => val ? (
                              <div key={label}>
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">{label}</p>
                                <p className="text-gray-800">{val}</p>
                              </div>
                            ) : null)}
                            {e.medicines_given && (
                              <div className="col-span-3">
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Medicines Given</p>
                                <p className="text-gray-800">{e.medicines_given}</p>
                              </div>
                            )}
                            {e.treatment_performed && (
                              <div className="col-span-3">
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Treatment Performed</p>
                                <p className="text-gray-800">{e.treatment_performed}</p>
                              </div>
                            )}
                            {e.diet && (
                              <div className="col-span-3">
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Diet</p>
                                <p className="text-gray-800">{e.diet}</p>
                              </div>
                            )}
                            {e.doctors_notes && (
                              <div className="col-span-3">
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Doctor's Notes</p>
                                <p className="text-gray-800">{e.doctors_notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── INVESTIGATIONS & PROCEDURE ── */}
              {activeTab === 'investigations' && (
                <div className="space-y-5" ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e, () => advanceTab('investigations'))}>
                  <TextArea label="Investigations" rows={8} value={form.investigations} onChange={v => set('investigations', v)}
                    placeholder="Lab reports, imaging, and other investigation notes…" />
                  <InvestigationAttachments
                    patientId={patientId}
                    attachments={form.investigation_attachments}
                    onChange={(items) => set('investigation_attachments', items)}
                  />
                  <TextArea label="Procedure" rows={8} value={form.procedure} onChange={v => set('procedure', v)}
                    placeholder="Procedure notes…" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex-shrink-0 border-t border-gray-200 px-6 py-3 bg-gray-50 rounded-b-xl flex justify-between items-center text-sm text-gray-500">
          <span>Fill in the sections then Save or Print directly.</span>
          <button onClick={() => setShowPrintOptions(true)} className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Printer className="w-4 h-4" /> Print Case Sheet
          </button>
        </div>
      </div>

      {showPrintOptions && (
        <PrintSectionModal
          title="Print IP Case Sheet"
          sections={PRINT_SECTIONS}
          onPrint={handlePrint}
          onClose={() => setShowPrintOptions(false)}
        />
      )}
    </div>
  );
};

export default IPCaseSheetModal;
