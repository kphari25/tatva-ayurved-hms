import React, { useState, useEffect } from 'react';
import { X, Printer, Save, Plus, Trash2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, deleteDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import TreatmentPickerButton from './TreatmentPickerButton';

const appendTreatment = (currentText, treatment) => {
  const entry = `${treatment.name} (₹${Number(treatment.price || 0).toLocaleString('en-IN')})`;
  return currentText ? `${currentText}, ${entry}` : entry;
};

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
  case_date: new Date().toISOString().split('T')[0],

  s_d_w_o: '',
  informant: '',
  religion: '',
  marital_status: '',
  socio_economic_status: '',
  occupation: '',
  physician: '',
  initial_diagnosis: '',

  temperature: '', pulse: '', pulse_regularity: '', bp: '', rr: '',

  height: '', weight: '', bmi: '', nourishment_status: '',
  weight_change_3mo: '', food_intake_declined: '', neuro_physio_problems: '',
  mobility_issues: '', acute_disease_3mo: '', detailed_nutritional_assessment_required: '',
  nutritional_others: '',

  known_allergies: '', presenting_complaints: '', pain_assessment: '',

  history_present_illness: '', history_previous_illness: '', treatment_medication_details: '',

  dm: '', htn: '', hyperlipidemia: '', ihd: '', thyroid_dysfunction: '',
  comorbidity_other_label: '', comorbidity_other_value: '',

  family_history: '',

  bowel_habits: '', appetite: '', micturition: '', sleep: '', diet: '',
  psycho_social_assessment: '', personal_history_others: '',

  immunization_history: '',

  cycle: '', flow: '', duration: '', interval: '', amount: '', clots: '', pain: '', menstrual_others: '',

  duration_of_marriage: '', g: '', a: '', p: '', l: '', delivery_mode: '',

  known_addictions: '',

  consciousness: '', orientation: '', mobility: '', general_exam_others: '',

  systemic_examination: '',

  prakrithi: '', vikrithi: '', sara: '', samhanana: '', pramana: '', satvam: '', satmyam: '',
  aharasakthi: '', vyayamasakthi: '', vayah: '',
  dosham: '', dushyam: '', agni: '', kalam: '', srotas: '', dasavidha_other: '',

  investigations: '', provisional_diagnosis: '', diagnosis: '',
});

const emptyVisitEntry = () => ({
  date: new Date().toISOString().split('T')[0],
  clinical_findings: '',
  medicines_procedures: '',
  pain_intensity_score: '',
  next_followup_date: '',
  signed_by: '',
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

const SelectField = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <select
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">—</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
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

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// ── Print HTML generator ────────────────────────────────────────────────
const buildOPCaseSheetPrintHTML = (patient, form, visitNotes) => {
  const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim().toUpperCase();
  const age = patient?.age || '';
  const gender = patient?.gender?.[0]?.toUpperCase() || '';
  const address = [patient?.address, patient?.city, patient?.state, patient?.pincode].filter(Boolean).join(', ');

  const row2 = (l1, v1, l2, v2) => `<tr><td><strong>${l1}</strong></td><td>${v1 || ''}</td><td><strong>${l2}</strong></td><td>${v2 || ''}</td></tr>`;

  const visitRows = visitNotes.map(v => `<tr>
      <td>${fmtDate(v.date)}</td>
      <td>${v.clinical_findings || ''}</td>
      <td>${v.medicines_procedures || ''}</td>
      <td>${v.pain_intensity_score || ''}</td>
      <td>${fmtDate(v.next_followup_date)}</td>
      <td>${v.signed_by || ''}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OP Case Sheet – ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
    @page { size: A4; margin: 15mm 12mm; }
    @media print { body { -webkit-print-color-adjust: exact; } }

    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a5f4e; padding-bottom: 10px; margin-bottom: 10px; }
    .logo-block { background: #1a5f4e; color: #fff; padding: 10px 16px; border-radius: 4px; min-width: 160px; }
    .logo-block .brand { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
    .logo-block .tagline { font-size: 9px; color: #a8d8c8; }
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

    .footer { margin-top: 20px; border-top: 2px solid #1a5f4e; padding-top: 10px; display: flex; justify-content: space-between; }
    .sig-block { text-align: right; }
    .sig-line { border-top: 1px solid #000; width: 180px; margin-top: 40px; margin-left: auto; }
  </style>
</head>
<body>

<div class="header">
  <div class="logo-block">
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

<div class="title">OP INITIAL ASSESSMENT</div>

<div class="info-grid">
  <div class="info-left">
    <div class="info-row"><span class="info-label">Name of Patient:</span> ${patientName}</div>
    <div class="info-row"><span class="info-label">Age / Sex:</span> ${age} / ${gender}</div>
    <div class="info-row"><span class="info-label">Address:</span> ${address}</div>
    <div class="info-row"><span class="info-label">S/D/W/o:</span> ${form.s_d_w_o}</div>
    <div class="info-row"><span class="info-label">Informant:</span> ${form.informant}</div>
    <div class="info-row"><span class="info-label">Occupation:</span> ${form.occupation}</div>
    <div class="info-row"><span class="info-label">Religion:</span> ${form.religion}</div>
    <div class="info-row"><span class="info-label">Marital Status:</span> ${form.marital_status}</div>
    <div class="info-row"><span class="info-label">Socio-Economic Status:</span> ${form.socio_economic_status}</div>
  </div>
  <div class="info-right">
    <div class="info-row"><span class="info-label">MRD No:</span> ${patient?.mrd_number || ''}</div>
    <div class="info-row"><span class="info-label">Phone:</span> ${patient?.phone || ''}</div>
    <div class="info-row"><span class="info-label">Department:</span> ${form.department}</div>
    <div class="info-row"><span class="info-label">Physician:</span> ${form.physician}</div>
    <div class="info-row"><span class="info-label">Date:</span> ${fmtDate(form.case_date)}</div>
    <div class="info-row"><span class="info-label">Diagnosis:</span> ${form.initial_diagnosis}</div>
  </div>
</div>

<div class="section-title">Vital Signs</div>
<table class="grid">
  ${row2('Temperature', form.temperature, 'Pulse', `${form.pulse} ${form.pulse_regularity}`)}
  ${row2('BP', form.bp, 'RR', form.rr)}
</table>

<div class="section-title">Nutritional Screening</div>
<table class="grid">
  ${row2('Height', form.height, 'Weight', form.weight)}
  ${row2('BMI', form.bmi, 'Nourishment Status', form.nourishment_status)}
  ${row2('Weight Gain/Loss in 3 Months', form.weight_change_3mo, 'Food Intake Declined', form.food_intake_declined)}
  ${row2('Neuro Physiological Problems', form.neuro_physio_problems, 'Mobility Issues', form.mobility_issues)}
  ${row2('Acute Disease in Past 3 Months', form.acute_disease_3mo, 'Detailed Assessment Required', form.detailed_nutritional_assessment_required)}
  ${row2('Others', form.nutritional_others, '', '')}
</table>

<div class="section-title">Known Allergies</div>
<p style="white-space:pre-line;">${form.known_allergies}</p>

<div class="section-title">Presenting Complaints with Duration</div>
<p style="white-space:pre-line;">${form.presenting_complaints}</p>

<p><strong>Pain Assessment:</strong> ${form.pain_assessment}</p>

<div class="page-break"></div>

<div class="section-title">History of Present Illness</div>
<p style="white-space:pre-line;">${form.history_present_illness}</p>

<div class="section-title">History of Previous Illness</div>
<p style="white-space:pre-line;">${form.history_previous_illness}</p>

<div class="section-title">Treatment / Medication Details</div>
<p style="white-space:pre-line;">${form.treatment_medication_details}</p>

<div class="section-title">Comorbidities</div>
<table class="grid">
  ${row2('DM', form.dm, 'HTN', form.htn)}
  ${row2('Hyperlipidemia', form.hyperlipidemia, 'IHD', form.ihd)}
  ${row2('Thyroid Dysfunction', form.thyroid_dysfunction, form.comorbidity_other_label || 'Other', form.comorbidity_other_value)}
</table>

<div class="section-title">Family History</div>
<p style="white-space:pre-line;">${form.family_history}</p>

<div class="section-title">Personal History</div>
<table class="grid">
  ${row2('Bowel Habits', form.bowel_habits, 'Appetite', form.appetite)}
  ${row2('Micturition', form.micturition, 'Sleep', form.sleep)}
  ${row2('Diet', form.diet, 'Psycho Social Assessment', form.psycho_social_assessment)}
  ${row2('Others', form.personal_history_others, '', '')}
</table>

<div class="section-title">Immunization History</div>
<p style="white-space:pre-line;">${form.immunization_history}</p>

<div class="section-title">Menstrual History</div>
<table class="grid">
  ${row2('Cycle', form.cycle, 'Flow', form.flow)}
  ${row2('Duration', form.duration, 'Interval', form.interval)}
  ${row2('Amount', form.amount, 'Clots', form.clots)}
  ${row2('Pain', form.pain, 'Others', form.menstrual_others)}
</table>

<div class="section-title">Obstetric History</div>
<table class="grid">
  ${row2('Duration of Marriage', form.duration_of_marriage, 'Delivery Mode', form.delivery_mode)}
  ${row2('G', form.g, 'A', form.a)}
  ${row2('P', form.p, 'L', form.l)}
</table>

<div class="section-title">Known Addictions</div>
<p>${form.known_addictions}</p>

<div class="section-title">General Examination</div>
<table class="grid">
  ${row2('Consciousness', form.consciousness, 'Orientation', form.orientation)}
  ${row2('Mobility', form.mobility, 'Others', form.general_exam_others)}
</table>

<div class="section-title">Systemic Examination</div>
<p style="white-space:pre-line;">${form.systemic_examination}</p>

<div class="section-title">Dasavidha Pareeksha</div>
<table class="grid">
  ${row2('Prakrithi', form.prakrithi, 'Dosham', form.dosham)}
  ${row2('Vikrithi', form.vikrithi, 'Dushyam', form.dushyam)}
  ${row2('Sara', form.sara, 'Agni', form.agni)}
  ${row2('Samhanana', form.samhanana, 'Kalam', form.kalam)}
  ${row2('Pramana', form.pramana, 'Srotas', form.srotas)}
  ${row2('Satvam', form.satvam, 'Any Other', form.dasavidha_other)}
  ${row2('Satmyam', form.satmyam, '', '')}
  ${row2('Aharasakthi', form.aharasakthi, '', '')}
  ${row2('Vyayamasakthi', form.vyayamasakthi, '', '')}
  ${row2('Vayah', form.vayah, '', '')}
</table>

<div class="section-title">Investigations</div>
<p style="white-space:pre-line;">${form.investigations}</p>

<div class="section-title">Provisional Diagnosis</div>
<p>${form.provisional_diagnosis}</p>

<div class="section-title">Diagnosis</div>
<p>${form.diagnosis}</p>

<div class="page-break"></div>

<div class="section-title">Medicines, Procedures &amp; Re-Assessment Log</div>
<table class="grid">
  <thead><tr><th style="width:80px;">Date</th><th>Clinical Findings</th><th>Medicines / Procedures / Interventions</th><th style="width:60px;">Pain Score</th><th style="width:90px;">Next Follow-up</th><th>Signed By</th></tr></thead>
  <tbody>${visitRows || '<tr><td colspan="6" style="text-align:center;color:#888;">No records</td></tr>'}</tbody>
</table>

<div class="footer">
  <div></div>
  <div class="sig-block">
    <div class="sig-line"></div>
    <p style="font-size:10px;margin-top:4px;">Signature of Physician</p>
  </div>
</div>

</body>
</html>`;
};

// ── Main Modal ──────────────────────────────────────────────────────────
const OPCaseSheetModal = ({ patient, onClose }) => {
  const patientId = patient?.id || patient?.firebaseId;
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('assessment');

  const [visitNotes, setVisitNotes] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitForm, setVisitForm] = useState(emptyVisitEntry());
  const [savingVisit, setSavingVisit] = useState(false);

  useEffect(() => {
    loadCaseSheet();
    loadVisitNotes();
  }, []);

  const loadCaseSheet = async () => {
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, 'op_case_sheets', patientId));
      if (snap.exists()) {
        setForm(prev => ({ ...prev, ...snap.data() }));
      } else {
        setForm(prev => ({ ...prev, physician: patient?.assigned_doctor || '' }));
      }
    } catch (e) {
      console.error('Error loading OP case sheet:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadVisitNotes = async () => {
    if (!patientId) return;
    try {
      setLoadingVisits(true);
      const q = query(
        collection(db, 'op_visit_notes'),
        where('patient_id', '==', patientId),
        orderBy('date', 'asc')
      );
      const snap = await getDocs(q);
      setVisitNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error loading visit notes:', e);
    } finally {
      setLoadingVisits(false);
    }
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    try {
      setSaving(true);
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const now = new Date().toISOString();
      await setDoc(doc(db, 'op_case_sheets', patientId), {
        ...form,
        patient_id: patientId,
        patient_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
        mrd_number: patient?.mrd_number || '',
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

  const handleAddVisitNote = async () => {
    if (!visitForm.date) { alert('Please select a date.'); return; }
    try {
      setSavingVisit(true);
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      await addDoc(collection(db, 'op_visit_notes'), {
        ...visitForm,
        patient_id: patientId,
        patient_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
        created_at: new Date().toISOString(),
        created_by: currentUser.email || '',
      });
      setVisitForm(emptyVisitEntry());
      await loadVisitNotes();
    } catch (e) {
      alert('Error saving visit entry: ' + e.message);
    } finally {
      setSavingVisit(false);
    }
  };

  const handleDeleteVisitNote = async (id) => {
    if (!window.confirm('Remove this visit entry?')) return;
    try {
      await deleteDoc(doc(db, 'op_visit_notes', id));
      setVisitNotes(prev => prev.filter(v => v.id !== id));
    } catch (e) {
      alert('Error deleting entry: ' + e.message);
    }
  };

  const handlePrint = () => {
    const html = buildOPCaseSheetPrintHTML(patient, form, visitNotes);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const tabs = [
    { id: 'assessment', label: 'Initial Assessment' },
    { id: 'history', label: 'History & Examination' },
    { id: 'visits', label: `Visit Log ${visitNotes.length > 0 ? `(${visitNotes.length})` : ''}` },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-teal-700 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white">OP Case Sheet</h2>
            <p className="text-teal-200 text-sm mt-0.5">
              {patient?.first_name} {patient?.last_name}
              {patient?.mrd_number && <span className="ml-2 font-mono">MRD: {patient.mrd_number}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
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
              {/* ── INITIAL ASSESSMENT ── */}
              {activeTab === 'assessment' && (
                <div className="space-y-5">
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-teal-600 font-semibold uppercase mb-0.5">Patient Name</p>
                      <p className="font-bold text-gray-900">{patient?.first_name} {patient?.last_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-teal-600 font-semibold uppercase mb-0.5">MRD Number</p>
                      <p className="font-bold text-gray-900 font-mono">{patient?.mrd_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-teal-600 font-semibold uppercase mb-0.5">Age / Sex</p>
                      <p className="font-bold text-gray-900">{patient?.age || '—'} / {patient?.gender || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-teal-600 font-semibold uppercase mb-0.5">Phone</p>
                      <p className="font-bold text-gray-900">{patient?.phone || '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Department" value={form.department} onChange={v => set('department', v)} />
                    <Field label="Date" type="date" value={form.case_date} onChange={v => set('case_date', v)} />
                    <Field label="Physician" value={form.physician} onChange={v => set('physician', v)} />
                  </div>

                  <SectionTitle>Demographics</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="S/D/W/o" value={form.s_d_w_o} onChange={v => set('s_d_w_o', v)} placeholder="Son/Daughter/Wife of" />
                    <Field label="Informant (if applicable)" value={form.informant} onChange={v => set('informant', v)} />
                    <Field label="Religion" value={form.religion} onChange={v => set('religion', v)} />
                    <SelectField label="Marital Status" value={form.marital_status} onChange={v => set('marital_status', v)} options={['Married', 'Single']} />
                    <SelectField label="Socio-Economic Status" value={form.socio_economic_status} onChange={v => set('socio_economic_status', v)} options={['L', 'M', 'H']} />
                    <Field label="Occupation" value={form.occupation} onChange={v => set('occupation', v)} />
                    <Field label="Diagnosis" value={form.initial_diagnosis} onChange={v => set('initial_diagnosis', v)} />
                  </div>

                  <SectionTitle>Vital Signs</SectionTitle>
                  <div className="grid grid-cols-4 gap-4">
                    <Field label="Temperature (°F)" value={form.temperature} onChange={v => set('temperature', v)} />
                    <Field label="Pulse (/min)" value={form.pulse} onChange={v => set('pulse', v)} />
                    <SelectField label="Pulse Regularity" value={form.pulse_regularity} onChange={v => set('pulse_regularity', v)} options={['Regular', 'Irregular']} />
                    <Field label="BP (mmHg)" value={form.bp} onChange={v => set('bp', v)} />
                    <Field label="RR (/min)" value={form.rr} onChange={v => set('rr', v)} />
                  </div>

                  <SectionTitle>Nutritional Screening</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Height" value={form.height} onChange={v => set('height', v)} />
                    <Field label="Weight" value={form.weight} onChange={v => set('weight', v)} />
                    <Field label="BMI" value={form.bmi} onChange={v => set('bmi', v)} />
                    <SelectField label="Nourishment Status" value={form.nourishment_status} onChange={v => set('nourishment_status', v)} options={['Malnourished', 'Moderately Nourished', 'Well Nourished']} />
                    <SelectField label="Weight Gain/Loss in Last 3 Months" value={form.weight_change_3mo} onChange={v => set('weight_change_3mo', v)} options={['Yes', 'No']} />
                    <SelectField label="Food Intake Declined (3 Months)" value={form.food_intake_declined} onChange={v => set('food_intake_declined', v)} options={['Yes', 'No']} />
                    <SelectField label="Neuro Physiological Problems" value={form.neuro_physio_problems} onChange={v => set('neuro_physio_problems', v)} options={['Yes', 'No']} />
                    <SelectField label="Mobility Issues" value={form.mobility_issues} onChange={v => set('mobility_issues', v)} options={['Yes', 'No']} />
                    <SelectField label="Acute Disease in Past 3 Months" value={form.acute_disease_3mo} onChange={v => set('acute_disease_3mo', v)} options={['Yes', 'No']} />
                    <SelectField label="Detailed Nutritional Assessment Required" value={form.detailed_nutritional_assessment_required} onChange={v => set('detailed_nutritional_assessment_required', v)} options={['Yes', 'No']} />
                    <Field label="Others" value={form.nutritional_others} onChange={v => set('nutritional_others', v)} />
                  </div>

                  <TextArea label="Known Allergies (including medication)" rows={2} value={form.known_allergies} onChange={v => set('known_allergies', v)} />
                  <TextArea label="Presenting Complaints with Duration" rows={3} value={form.presenting_complaints} onChange={v => set('presenting_complaints', v)} />
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Pain Assessment (Score)" value={form.pain_assessment} onChange={v => set('pain_assessment', v)} />
                  </div>
                </div>
              )}

              {/* ── HISTORY & EXAMINATION ── */}
              {activeTab === 'history' && (
                <div className="space-y-5">
                  <TextArea label="History of Present Illness" rows={3} value={form.history_present_illness} onChange={v => set('history_present_illness', v)} />
                  <TextArea label="History of Previous Illness" rows={3} value={form.history_previous_illness} onChange={v => set('history_previous_illness', v)} />
                  <TextArea
                    label="Treatment / Medication Details"
                    rows={2}
                    value={form.treatment_medication_details}
                    onChange={v => set('treatment_medication_details', v)}
                    actions={
                      <TreatmentPickerButton
                        onSelect={(t) => set('treatment_medication_details', appendTreatment(form.treatment_medication_details, t))}
                      />
                    }
                  />

                  <SectionTitle>Comorbidities</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="DM" value={form.dm} onChange={v => set('dm', v)} placeholder="✓ / ✗" />
                    <Field label="HTN" value={form.htn} onChange={v => set('htn', v)} placeholder="✓ / ✗" />
                    <Field label="Hyperlipidemia" value={form.hyperlipidemia} onChange={v => set('hyperlipidemia', v)} placeholder="✓ / ✗" />
                    <Field label="IHD" value={form.ihd} onChange={v => set('ihd', v)} placeholder="✓ / ✗" />
                    <Field label="Thyroid Dysfunction" value={form.thyroid_dysfunction} onChange={v => set('thyroid_dysfunction', v)} placeholder="✓ / ✗" />
                    <div className="flex gap-2">
                      <Field label="Other Condition" value={form.comorbidity_other_label} onChange={v => set('comorbidity_other_label', v)} />
                      <Field label="Value" value={form.comorbidity_other_value} onChange={v => set('comorbidity_other_value', v)} placeholder="✓ / ✗" />
                    </div>
                  </div>

                  <TextArea label="Family History" rows={2} value={form.family_history} onChange={v => set('family_history', v)} />

                  <SectionTitle>Personal History</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Bowel Habits" value={form.bowel_habits} onChange={v => set('bowel_habits', v)} />
                    <Field label="Appetite" value={form.appetite} onChange={v => set('appetite', v)} />
                    <Field label="Micturition" value={form.micturition} onChange={v => set('micturition', v)} />
                    <Field label="Sleep" value={form.sleep} onChange={v => set('sleep', v)} />
                    <SelectField label="Diet" value={form.diet} onChange={v => set('diet', v)} options={['Veg', 'Non Veg', 'Mixed']} />
                    <Field label="Psycho Social Assessment" value={form.psycho_social_assessment} onChange={v => set('psycho_social_assessment', v)} />
                    <Field label="Others" value={form.personal_history_others} onChange={v => set('personal_history_others', v)} />
                  </div>

                  <TextArea label="Immunization History" rows={2} value={form.immunization_history} onChange={v => set('immunization_history', v)} />

                  <SectionTitle>Menstrual History</SectionTitle>
                  <div className="grid grid-cols-4 gap-4">
                    <SelectField label="Cycle" value={form.cycle} onChange={v => set('cycle', v)} options={['Regular', 'Irregular']} />
                    <SelectField label="Flow" value={form.flow} onChange={v => set('flow', v)} options={['Normal', 'Less', 'More', 'Irregular']} />
                    <Field label="Duration" value={form.duration} onChange={v => set('duration', v)} />
                    <Field label="Interval" value={form.interval} onChange={v => set('interval', v)} />
                    <Field label="Amount" value={form.amount} onChange={v => set('amount', v)} />
                    <Field label="Clots" value={form.clots} onChange={v => set('clots', v)} />
                    <Field label="Pain" value={form.pain} onChange={v => set('pain', v)} />
                    <Field label="Others" value={form.menstrual_others} onChange={v => set('menstrual_others', v)} />
                  </div>

                  <SectionTitle>Obstetric History</SectionTitle>
                  <div className="grid grid-cols-4 gap-4">
                    <Field label="Duration of Marriage" value={form.duration_of_marriage} onChange={v => set('duration_of_marriage', v)} />
                    <Field label="G" value={form.g} onChange={v => set('g', v)} />
                    <Field label="A" value={form.a} onChange={v => set('a', v)} />
                    <Field label="P" value={form.p} onChange={v => set('p', v)} />
                    <Field label="L" value={form.l} onChange={v => set('l', v)} />
                    <SelectField label="Delivery Mode" value={form.delivery_mode} onChange={v => set('delivery_mode', v)} options={['NVD', 'CS']} />
                  </div>

                  <TextArea label="Known Addictions" rows={2} value={form.known_addictions} onChange={v => set('known_addictions', v)} />

                  <SectionTitle>General Examination</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <SelectField label="Consciousness" value={form.consciousness} onChange={v => set('consciousness', v)} options={['Conscious', 'Unconsciousness']} />
                    <SelectField label="Orientation" value={form.orientation} onChange={v => set('orientation', v)} options={['Oriented', 'Disoriented']} />
                    <SelectField label="Mobility" value={form.mobility} onChange={v => set('mobility', v)} options={['Normal', 'Restricted', 'Wheel Chair', 'Bedridden']} />
                    <Field label="Others" value={form.general_exam_others} onChange={v => set('general_exam_others', v)} />
                  </div>

                  <TextArea label="Systemic Examination" rows={3} value={form.systemic_examination} onChange={v => set('systemic_examination', v)} />

                  <SectionTitle>Dasavidha Pareeksha</SectionTitle>
                  <div className="grid grid-cols-5 gap-3">
                    <Field label="Prakrithi" value={form.prakrithi} onChange={v => set('prakrithi', v)} />
                    <Field label="Vikrithi" value={form.vikrithi} onChange={v => set('vikrithi', v)} />
                    <Field label="Sara" value={form.sara} onChange={v => set('sara', v)} />
                    <Field label="Samhanana" value={form.samhanana} onChange={v => set('samhanana', v)} />
                    <Field label="Pramana" value={form.pramana} onChange={v => set('pramana', v)} />
                    <Field label="Satvam" value={form.satvam} onChange={v => set('satvam', v)} />
                    <Field label="Satmyam" value={form.satmyam} onChange={v => set('satmyam', v)} />
                    <Field label="Aharasakthi" value={form.aharasakthi} onChange={v => set('aharasakthi', v)} />
                    <Field label="Vyayamasakthi" value={form.vyayamasakthi} onChange={v => set('vyayamasakthi', v)} />
                    <Field label="Vayah" value={form.vayah} onChange={v => set('vayah', v)} />
                    <Field label="Dosham" value={form.dosham} onChange={v => set('dosham', v)} />
                    <Field label="Dushyam" value={form.dushyam} onChange={v => set('dushyam', v)} />
                    <Field label="Agni" value={form.agni} onChange={v => set('agni', v)} />
                    <Field label="Kalam" value={form.kalam} onChange={v => set('kalam', v)} />
                    <Field label="Srotas" value={form.srotas} onChange={v => set('srotas', v)} />
                    <Field label="Any Other" value={form.dasavidha_other} onChange={v => set('dasavidha_other', v)} />
                  </div>

                  <TextArea label="Investigations (Done / Suggested)" rows={3} value={form.investigations} onChange={v => set('investigations', v)} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Provisional Diagnosis" value={form.provisional_diagnosis} onChange={v => set('provisional_diagnosis', v)} />
                    <Field label="Diagnosis" value={form.diagnosis} onChange={v => set('diagnosis', v)} />
                  </div>
                </div>
              )}

              {/* ── VISIT LOG ── */}
              {activeTab === 'visits' && (
                <div className="space-y-5">
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Add Visit Entry</h3>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <Field label="Date" type="date" value={visitForm.date} onChange={v => setVisitForm(p => ({ ...p, date: v }))} />
                      <Field label="Pain Intensity Score" value={visitForm.pain_intensity_score} onChange={v => setVisitForm(p => ({ ...p, pain_intensity_score: v }))} />
                      <Field label="Next Follow-up Date" type="date" value={visitForm.next_followup_date} onChange={v => setVisitForm(p => ({ ...p, next_followup_date: v }))} />
                    </div>
                    <div className="space-y-3 mb-3">
                      <TextArea label="Clinical Findings" rows={2} value={visitForm.clinical_findings} onChange={v => setVisitForm(p => ({ ...p, clinical_findings: v }))} />
                      <TextArea
                        label="Medicines, Procedures & Other Interventions"
                        rows={2}
                        value={visitForm.medicines_procedures}
                        onChange={v => setVisitForm(p => ({ ...p, medicines_procedures: v }))}
                        actions={
                          <TreatmentPickerButton
                            onSelect={(t) => setVisitForm(p => ({ ...p, medicines_procedures: appendTreatment(p.medicines_procedures, t) }))}
                          />
                        }
                      />
                      <Field label="Signed By (Doctor)" value={visitForm.signed_by} onChange={v => setVisitForm(p => ({ ...p, signed_by: v }))} />
                    </div>
                    <button
                      onClick={handleAddVisitNote}
                      disabled={savingVisit}
                      className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-60"
                    >
                      <Plus className="w-4 h-4" /> {savingVisit ? 'Saving...' : 'Add Entry'}
                    </button>
                  </div>

                  {loadingVisits ? (
                    <div className="text-center py-8 text-gray-400">Loading visit log…</div>
                  ) : visitNotes.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="font-medium">No visit entries yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visitNotes.map(v => (
                        <div key={v.id} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                            <span className="font-semibold text-gray-800 text-sm">{fmtDate(v.date)}</span>
                            <div className="flex items-center gap-2">
                              {v.next_followup_date && (
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Next: {fmtDate(v.next_followup_date)}</span>
                              )}
                              <button onClick={() => handleDeleteVisitNote(v.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
                            {v.clinical_findings && (
                              <div className="col-span-2">
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Clinical Findings</p>
                                <p className="text-gray-800">{v.clinical_findings}</p>
                              </div>
                            )}
                            {v.medicines_procedures && (
                              <div className="col-span-2">
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Medicines / Procedures / Interventions</p>
                                <p className="text-gray-800">{v.medicines_procedures}</p>
                              </div>
                            )}
                            {v.pain_intensity_score && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Pain Score</p>
                                <p className="text-gray-800">{v.pain_intensity_score}</p>
                              </div>
                            )}
                            {v.signed_by && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Signed By</p>
                                <p className="text-gray-800">{v.signed_by}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex-shrink-0 border-t border-gray-200 px-6 py-3 bg-gray-50 rounded-b-xl flex justify-between items-center text-sm text-gray-500">
          <span>Fill in the sections then Save or Print directly.</span>
          <button onClick={handlePrint} className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Printer className="w-4 h-4" /> Print Case Sheet
          </button>
        </div>
      </div>
    </div>
  );
};

export default OPCaseSheetModal;
