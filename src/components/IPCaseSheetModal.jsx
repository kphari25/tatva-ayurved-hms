import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, Plus, Pencil, Trash2, ClipboardList, FileInput } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import InvestigationAttachments from './InvestigationAttachments';
import TreatmentPickerButton from './TreatmentPickerButton';
import PackagePickerButton, { packageTreatmentDetails } from './PackagePickerButton';
import TreatmentItemsList from './TreatmentItemsList';
import MedicineTable from './MedicineTable';
import { useWritingCheck } from './useWritingCheck';
import { useAutosave } from './useAutosave';
import { syncEntryUsage, removeEntryUsage } from '../lib/liquidUsage';
import PrintSectionModal from './PrintSectionModal';
import { summarizeMedicineItems, buildMedicineItemsTableHTML } from '../lib/medicineSummary';
import { escapeFields, escapeHtmlMultiline } from '../lib/escapeHtml';
import { loadDoctors } from '../lib/staff';
import { handleContainerEnter, focusFirstField } from '../lib/formKeyNav';
import { formatDateOnly, addDaysToDateString } from '../lib/formatDate';
import { ROOMS, ROOM_BOOKING_OPTIONS, parseRoomBookingKey } from '../lib/rooms';
import { getOccupiedRooms, getReservedRoomForPatient } from '../lib/roomAvailability';
import { calculateBMI } from '../lib/bmi';
import OPImportModal from './OPImportModal';
import { loadOPCaseSheet, buildOPImportItems, applyOPImport, compareWithForm } from '../lib/opToIpCaseSheet';

const TAB_SEQUENCE = ['sheet', 'history', 'investigations'];

const PRINT_SECTIONS = [
  { id: 'sheet', label: 'Case Sheet' },
  { id: 'history', label: 'History & Examination' },
  { id: 'investigations', label: 'Investigations & Procedure' },
  { id: 'vitals', label: 'Vitals & Daily Log' },
  { id: 'followup', label: 'Follow up' },
];

const TREATMENT_DAYS_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 1);

const appendTreatment = (currentText, treatment) => {
  const entry = `${treatment.name} (₹${Number(treatment.price || 0).toLocaleString('en-IN')})${treatment.details ? ` — ${treatment.details}` : ''}`;
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
  informant: '',
  socio_economic_status: '',
  marital_status: '',
  caste: '',

  room_number: '',
  room_type: '',
  admission_date: '',
  admission_time: '',
  discharge_date: '',
  discharge_time: '',
  admin_diagnosis: '',
  result: '',
  roopam: '',
  pain_assessment: '',

  history_presenting_complaints: '',
  history_past_illness: '',
  family_history: '',
  current_medicines: '',
  medication_details: '',
  treatment_details: '',

  diet: '', appetite: '', bowel: '', micturition: '', sleep: '',
  habits_addiction: '', hypersensitivity: '', hereditary: '', menstrual_history: '', immunization_history: '',

  pulse: '', bp: '', heart_rate: '', temperature: '', height: '', weight: '', bmi: '',
  consciousness: '', orientation: '', mobility: '',

  cvs_cns_rs_ls: '', dm: '', htn: '', ihd: '', hyperlipidemia: '',
  thyroid_dysfunction: '', comorbidity_other_label: '', comorbidity_other_value: '',

  nadi: '', mutra: '', malam: '', jihwa: '', sabda: '', sparsa: '', drik: '', akriti: '',

  dooshya: '', desha: '', bala: '', kala: '', anala: '', prakruti: '', vayah: '', satwa: '', satmya: '', ahara: '',
  vikrithi: '', sara: '', samhanana: '', pramana: '', aharasakthi: '', vyayamasakthi: '', dosham: '', agni: '',

  srotas_involved: '',
  ayurvedic_diagnosis: '',
  investigations: '',
  procedure: '',
  investigation_attachments: [],
  // Post-discharge follow-up visits: [{ id, date, notes, created_at, created_by, updated_at?, updated_by? }]
  follow_ups: [],
});

// A follow-up visit records the same things as a Vitals & Daily Log entry.
const emptyFollowUp = () => {
  const { treatment_days: _omit, ...fields } = emptyDailyEntry();
  return fields;
};
// The first version of follow-ups stored a single "notes" field; show it as
// the Doctor's Notes so those entries carry over.
const normFollowUp = ({ notes, ...f }) => ({ ...emptyFollowUp(), ...f, doctors_notes: f.doctors_notes ?? notes ?? '' });
// Whether a Daily Log / Follow up entry form has anything typed in it (the
// date and Treatment Days alone don't count) — a blank form isn't kept as a draft.
const entryHasContent = (f) => {
  if (!f) return false;
  const text = ['bp_morning', 'bp_evening', 'temperature', 'pulse', 'spo2', 'weight', 'diet', 'treatment_performed', 'doctors_notes'];
  return text.some(k => String(f[k] || '').trim() !== '')
    || (f.treatment_items || []).length > 0
    || (f.medicine_items || []).some(m => m && (m.item_name || m.dose || m.frequency || m.instructions || m.days || m.ml_used));
};
const sortFollowUps = (list) => (list || []).map(normFollowUp).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

const FROM_OP_INPUT = 'bg-amber-50 border-amber-300';
const FromOPTag = () => <span className="ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">from OP</span>;

const Field = ({ label, value, onChange, placeholder, type = 'text', readOnly = false, fromOP = false }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}{fromOP && <FromOPTag />}</label>
    <input
      type={type}
      readOnly={readOnly}
      spellCheck
      lang="en"
      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none ${fromOP ? FROM_OP_INPUT : 'border-gray-300'} ${readOnly ? 'bg-gray-100 text-gray-500' : ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const TextArea = ({ label, value, onChange, rows = 3, placeholder, actions, fromOP = false }) => {
  const wc = useWritingCheck(value, onChange);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-semibold text-gray-700">{label}{fromOP && <FromOPTag />}</label>
        <div className="flex items-center gap-1">{actions}{wc.button}</div>
      </div>
      <textarea
        rows={rows}
        spellCheck
        lang="en"
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none ${fromOP ? FROM_OP_INPUT : 'border-gray-300'}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {wc.panel}
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide pt-3 border-t border-gray-100 first:pt-0 first:border-0">{children}</h3>
);

const fmtDate = (d) => formatDateOnly(d);

// Vitals, medicines, treatment, diet and notes of one log entry — shared by
// the Vitals & Daily Log tab and the Follow up tab so both record the same.
// `setValue` is a state setter (it's called with an updater function).
const LogEntryFields = ({ value, setValue }) => {
  const upd = (key) => (v) => setValue(p => ({ ...p, [key]: v }));
  return (
    <>
      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Vitals</p>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Field label="BP Morning" value={value.bp_morning} onChange={upd('bp_morning')} placeholder="e.g. 120/80" />
        <Field label="BP Evening" value={value.bp_evening} onChange={upd('bp_evening')} placeholder="e.g. 118/76" />
        <Field label="Temperature" value={value.temperature} onChange={upd('temperature')} placeholder="e.g. 98.6°F" />
        <Field label="Pulse" value={value.pulse} onChange={upd('pulse')} placeholder="e.g. 72/min" />
        <Field label="SPO2" value={value.spo2} onChange={upd('spo2')} placeholder="e.g. 98%" />
        <Field label="Weight" value={value.weight} onChange={upd('weight')} placeholder="e.g. 65 kg" />
      </div>

      <div className="space-y-3 mb-3">
        <MedicineTable
          trackUsage
          items={value.medicine_items}
          onChange={(items) => setValue(p => ({ ...p, medicine_items: items, medicines_given: summarizeMedicineItems(items) }))}
          label="Medicines Given"
        />
        <TextArea
          label="Treatment Performed"
          rows={2}
          value={value.treatment_performed}
          onChange={upd('treatment_performed')}
          placeholder="e.g. Abhyanga, Shirodhara, Panchakarma…"
          actions={
            <div className="flex items-center gap-1">
              <TreatmentPickerButton
                onSelect={(t) => setValue(p => ({
                  ...p,
                  treatment_performed: appendTreatment(p.treatment_performed, t),
                  treatment_items: [...(p.treatment_items || []), { name: t.name, price: Number(t.price) || 0 }],
                }))}
              />
              <PackagePickerButton
                onSelect={(pkg) => setValue(p => ({
                  ...p,
                  treatment_performed: appendTreatment(p.treatment_performed, { name: pkg.name, price: pkg.cost, details: packageTreatmentDetails(pkg) }),
                  treatment_items: [...(p.treatment_items || []), { name: pkg.name, price: Number(pkg.cost) || 0 }],
                }))}
              />
            </div>
          }
        />
        <TreatmentItemsList
          items={value.treatment_items}
          onRemove={(idx) => setValue(p => ({ ...p, treatment_items: p.treatment_items.filter((_, i) => i !== idx) }))}
        />
        <TextArea label="Diet / Food" rows={2} value={value.diet} onChange={upd('diet')} placeholder="e.g. Light Ayurvedic diet — khichdi, warm water…" />
        <TextArea label="Doctor's Notes / Observations" rows={2} value={value.doctors_notes} onChange={upd('doctors_notes')} placeholder="Patient response, observations, plan changes…" />
      </div>
    </>
  );
};

// Title row of the Daily Log / Follow up entry form, with its autosave status.
// A new entry is only a draft until Add; an edited entry is saved as you type.
const EntryFormHeader = ({ title, editing, autosave, hasContent, restored, addLabel, onDiscard }) => (
  <div className="mb-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{title}</h3>
      {(editing || hasContent) && autosave.indicator}
    </div>
    {!editing && hasContent && (
      <p className="text-xs text-gray-500 mt-1">
        Draft — kept safe if the sheet closes, but not in the log until you click <strong>{addLabel}</strong>.
      </p>
    )}
    {editing && <p className="text-xs text-gray-500 mt-1">Changes to this entry save automatically.</p>}
    {restored && (
      <div className="flex items-center justify-between gap-3 mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
        <span>
          Unfinished entry restored
          {restored.saved_at ? ` (last saved ${new Date(restored.saved_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${restored.saved_by ? ` by ${restored.saved_by}` : ''})` : ''}.
          Review it and click <strong>{addLabel}</strong>.
        </span>
        <button onClick={onDiscard} className="text-amber-800 underline flex-shrink-0">Discard draft</button>
      </div>
    )}
  </div>
);

// Read-only body of a saved log entry (daily log or follow-up).
const LogEntryDetails = ({ e }) => (
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
    {[
      ['Medicines Given', e.medicines_given], ['Treatment Performed', e.treatment_performed],
      ['Diet', e.diet], ["Doctor's Notes", e.doctors_notes],
    ].map(([label, val]) => val ? (
      <div key={label} className="col-span-3">
        <p className="text-xs font-semibold text-gray-500 mb-0.5">{label}</p>
        <p className="text-gray-800 whitespace-pre-line">{val}</p>
      </div>
    ) : null)}
  </div>
);

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
const buildCaseSheetPrintHTML = (rawPatient, rawForm, rawDailyProgress, sectionId = 'all', rawDoctorInfo = {}) => {
  // Every user-entered field is escaped once here, so text like "<L4/L5>"
  // prints as typed and can't inject markup or script into the print window.
  const patient = escapeFields(rawPatient);
  const form = escapeFields(rawForm);
  const dailyProgress = (rawDailyProgress || []).map(escapeFields);
  const doctorInfo = escapeFields(rawDoctorInfo);
  const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim().toUpperCase();
  const age = patient?.age || '';
  const gender = patient?.gender?.[0]?.toUpperCase() || '';
  const address = [patient?.address, patient?.city, patient?.state, patient?.pincode].filter(Boolean).join(', ');

  const row2 = (l1, v1, l2, v2) => `<tr><td><strong>${l1}</strong></td><td>${v1 || ''}</td><td><strong>${l2}</strong></td><td>${v2 || ''}</td></tr>`;

  // Row builders shared by the daily log and the follow-up visits (same fields).
  const buildVitalsRows = (entries) => entries.filter(e => e.bp_morning || e.bp_evening || e.temperature || e.pulse || e.spo2 || e.weight)
    .map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.bp_morning || ''}</td><td>${e.bp_evening || ''}</td><td>${e.temperature || ''}</td><td>${e.pulse || ''}</td><td>${e.spo2 || ''}</td><td>${e.weight || ''}</td></tr>`).join('');
  const buildTreatmentRows = (entries) => entries.filter(e => e.treatment_performed || e.medicines_given)
    .map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.treatment_performed || ''}</td><td>${buildMedicineItemsTableHTML(e.medicine_items) || e.medicines_given || ''}</td></tr>`).join('');
  const buildReportRows = (entries) => entries.filter(e => e.doctors_notes || e.diet)
    .map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.doctors_notes || ''}${e.diet ? `${e.doctors_notes ? '<br>' : ''}<strong>Diet:</strong> ${e.diet}` : ''}</td><td>${e.created_by || ''}</td></tr>`).join('');

  const vitalsRows = buildVitalsRows(dailyProgress);
  const treatmentRows = buildTreatmentRows(dailyProgress);
  const dailyReportRows = dailyProgress.filter(e => e.doctors_notes)
    .map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.doctors_notes || ''}</td><td>${e.created_by || ''}</td></tr>`).join('');

  // Follow-ups: notes keep their line breaks; nested medicine_items stay raw
  // for buildMedicineItemsTableHTML, which escapes them itself.
  const followUps = sortFollowUps(rawForm.follow_ups).map(f => ({
    ...escapeFields(f),
    doctors_notes: escapeHtmlMultiline(f.doctors_notes),
    diet: escapeHtmlMultiline(f.diet),
  }));

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
  ${row2('Sleep', form.sleep, 'Immunization History', form.immunization_history)}
</table>

<div class="section-title">General Examination</div>
<table class="grid">
  ${row2('Pulse', form.pulse, 'Heart Rate', form.heart_rate)}
  ${row2('BP', form.bp, 'Temperature', form.temperature)}
  ${row2('Height', form.height, 'Weight', form.weight)}
  ${row2('BMI', form.bmi, '', '')}
  ${row2('Consciousness', form.consciousness, 'Orientation', form.orientation)}
  ${row2('Mobility', form.mobility, '', '')}
</table>

<div class="section-title">Systemic Examination</div>
<p><strong>CVS / CNS / RS / LS:</strong> ${form.cvs_cns_rs_ls}</p>
<table class="grid">
  ${row2('DM', form.dm, 'HTN', form.htn)}
  ${row2('IHD', form.ihd, 'Hyperlipidemia', form.hyperlipidemia)}
  ${row2('Thyroid Dysfunction', form.thyroid_dysfunction, form.comorbidity_other_label || 'Other Condition', form.comorbidity_other_value)}
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
  ${row2('Vikrithi', form.vikrithi, 'Sara', form.sara)}
  ${row2('Samhanana', form.samhanana, 'Pramana', form.pramana)}
  ${row2('Aharasakthi', form.aharasakthi, 'Vyayamasakthi', form.vyayamasakthi)}
  ${row2('Dosham', form.dosham, 'Agni', form.agni)}
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

  const noRows = (cols) => `<tr><td colspan="${cols}" style="text-align:center;color:#888;">No records</td></tr>`;
  const followupHTML = `
<div class="section-title">Follow up — Blood Pressure &amp; Temperature</div>
<table class="grid">
  <thead><tr><th>Date</th><th>BP (Morning)</th><th>BP (Evening)</th><th>Temperature</th><th>Pulse</th><th>SpO2</th><th>Weight</th></tr></thead>
  <tbody>${buildVitalsRows(followUps) || noRows(7)}</tbody>
</table>

<div class="section-title">Follow up — Treatment &amp; Medicine Given</div>
<table class="grid">
  <thead><tr><th style="width:90px;">Date</th><th>Treatment / Procedure</th><th>Medicines</th></tr></thead>
  <tbody>${buildTreatmentRows(followUps) || noRows(3)}</tbody>
</table>

<div class="section-title">Follow up — Doctor's Notes</div>
<table class="grid">
  <thead><tr><th style="width:90px;">Date</th><th>Notes / Diet</th><th>Recorded By</th></tr></thead>
  <tbody>${buildReportRows(followUps) || noRows(3)}</tbody>
</table>`;

  const availableSections = { sheet: sheetHTML, history: historyHTML, vitals: vitalsHTML, investigations: investigationsHTML, followup: followupHTML };
  const orderedKeys = ['sheet', 'history', 'investigations', 'vitals', 'followup'];
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
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
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

    /* Signature block follows the content and is kept whole on one page.
       It used to be position:fixed in print, which repeats it on every page
       of a multi-page case sheet and paints it (white background) over the
       clinical rows underneath. */
    .footer { margin-top: 50px; border-top: 2px solid #1a5f4e; padding-top: 10px; display: flex; justify-content: space-between; break-inside: avoid; page-break-inside: avoid; }
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
    <div class="info-row"><span class="info-label">Physician:</span> ${form.physician_name}${doctorInfo.designation ? ` (${doctorInfo.designation})` : ''}</div>
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
    ${doctorInfo.designation ? `<p class="reg">${doctorInfo.designation}</p>` : ''}
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
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUp());
  const [editingFollowUpId, setEditingFollowUpId] = useState(null);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  // Drafts found when the sheet opened: { daily?: {saved_at, saved_by}, followup?: {...} }
  const [restoredDrafts, setRestoredDrafts] = useState({});
  const tabContainerRef = useRef(null);
  // OP → IP carry-over: the patient's OP case sheet (if any), the review
  // dialog, and which IP fields were just filled from it and not yet
  // reviewed (key → IP tab). A field leaves importedKeys as soon as it's
  // edited or the sheet is saved.
  const [opSheet, setOpSheet] = useState(null);
  const [showOPImport, setShowOPImport] = useState(false);
  const [importedKeys, setImportedKeys] = useState({});

  useEffect(() => {
    loadCaseSheet();
    loadOPCaseSheet(patientId).then(setOpSheet).catch(e => console.error('Error loading OP case sheet:', e));
    loadDailyProgress();
    loadDoctors().then(setDoctors);
    loadOccupiedRooms();
  }, []);

  const loadOccupiedRooms = async () => {
    try {
      setOccupiedRooms(await getOccupiedRooms(patientId));
    } catch (e) {
      console.error('Error loading room occupancy:', e);
    }
  };

  useEffect(() => {
    if (!loading) focusFirstField(tabContainerRef.current);
  }, [activeTab, loading]);

  useEffect(() => {
    const bmi = calculateBMI(form.height, form.weight);
    if (bmi !== form.bmi) setForm(prev => ({ ...prev, bmi }));
  }, [form.height, form.weight]);

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
        // Unfinished new Daily Log / Follow up entries (autosaved drafts) live
        // on the sheet doc but not in `form`, so the sheet's own saves can't
        // overwrite a newer draft with the copy loaded here.
        const { daily_draft: dailyDraft, follow_up_draft: followUpDraft, ...sheet } = data;
        setForm(prev => ({ ...prev, ...sheet }));
        const restored = {};
        if (dailyDraft?.data) {
          setDailyForm({ ...emptyDailyEntry(), ...dailyDraft.data });
          restored.daily = dailyDraft;
        }
        if (followUpDraft?.data) {
          setFollowUpForm({ ...emptyFollowUp(), ...followUpDraft.data });
          restored.followup = followUpDraft;
        }
        setRestoredDrafts(restored);
      } else {
        // First time this patient's case sheet is opened — pre-fill the room
        // (and its A/C/Non-A/C type) from whichever IP appointment they were
        // booked under, so front desk isn't picking the same room twice
        // (once at booking, again here).
        let reservedRoom = { number: '', type: '' };
        try {
          reservedRoom = await getReservedRoomForPatient(patientId);
        } catch (e) {
          console.error('Error loading room from linked appointment:', e);
        }
        setForm(prev => ({
          ...prev,
          admission_date: patient?.admission_date || '',
          physician_name: patient?.assigned_doctor || '',
          room_number: reservedRoom.number,
          room_type: reservedRoom.type,
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

  const isFromOP = (key) => key in importedKeys;

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (key in importedKeys) setImportedKeys(prev => { const { [key]: _, ...rest } = prev; return rest; });
  };

  const opImport = React.useMemo(() => buildOPImportItems(opSheet), [opSheet]);
  // Only offer the import when there's still something on the OP sheet that
  // the IP sheet doesn't have — an already-imported sheet with nothing new
  // (or an OP sheet the front desk opened but never filled in) stays quiet.
  const hasNewFromOP = opImport.items.some(i => compareWithForm(i, form) !== 'same');
  const showOPBanner = !loading && hasNewFromOP && !form.op_import;

  const handleApplyOPImport = (chosen) => {
    setForm(prev => applyOPImport(prev, chosen));
    setImportedKeys(prev => ({ ...prev, ...Object.fromEntries(chosen.map(c => [c.item.key, c.item.tab])) }));
    setShowOPImport(false);
    // Land on the first tab that received something, so the doctor starts reviewing straight away.
    const firstTab = TAB_SEQUENCE.find(t => chosen.some(c => c.item.tab === t));
    if (firstTab) setActiveTab(firstTab);
  };

  const handleDismissOPBanner = async () => {
    const meta = { status: 'dismissed', at: new Date().toISOString(), by: JSON.parse(localStorage.getItem('currentUser') || '{}').email || '' };
    setForm(prev => ({ ...prev, op_import: meta }));
    try {
      await setDoc(doc(db, 'ip_case_sheets', patientId), { op_import: meta }, { merge: true });
    } catch (e) {
      console.error('Error saving OP import dismissal:', e);
    }
  };

  // created_at of a brand-new sheet, remembered across autosaves so each
  // save doesn't stamp a fresh creation time.
  const createdRef = useRef(null);
  // Last admission_date written to the patient doc (the `patient` prop isn't
  // refreshed while the sheet is open).
  const syncedAdmissionRef = useRef(patient?.admission_date || '');

  // Writes the sheet. Used by both the Save button and autosave. follow_ups is
  // left out: it's saved on its own (persistFollowUps), and writing a stale
  // copy here could undo a follow-up added while this save was in flight.
  const writeSheet = async (data, extra = {}) => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const now = new Date().toISOString();
    const { follow_ups: _omit, daily_draft: _dd, follow_up_draft: _fd, ...fields } = data;
    const createdAt = data.created_at || createdRef.current || now;
    await setDoc(doc(db, 'ip_case_sheets', patientId), {
      ...fields,
      patient_id: patientId,
      patient_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
      mrd_number: patient?.mrd_number || '',
      ip_number: patient?.ip_number || '',
      updated_at: now,
      updated_by: currentUser.email || '',
      created_at: createdAt,
      created_by: data.created_by || currentUser.email || '',
      ...extra,
    }, { merge: true });
    createdRef.current = createdAt;

    // Keep the patient's own admission_date in sync with this case
    // sheet's — Room Management, the Dashboard's In-Patient Status table,
    // and the "Patients Today" footfall count all read admission_date
    // directly off the patient doc, not the case sheet, so correcting a
    // wrong admission date only here (e.g. front desk admitted early by
    // mistake) would otherwise silently not show up anywhere else.
    if (data.admission_date && data.admission_date !== syncedAdmissionRef.current) {
      await updateDoc(doc(db, 'patients', patientId), { admission_date: data.admission_date });
      syncedAdmissionRef.current = data.admission_date;
    }
  };

  // Autosave while the sheet is open. Fields copied from the OP sheet keep
  // their highlight until the Save button is used (that's the "reviewed"
  // signal); autosave just makes sure nothing typed is lost.
  const autosave = useAutosave({
    value: form,
    enabled: !loading && !!patientId,
    save: (data) => writeSheet(data),
    ignoreKeys: ['bmi', 'follow_ups'],
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const now = new Date().toISOString();
      const importMeta = Object.keys(importedKeys).length > 0
        ? { status: 'imported', at: now, by: currentUser.email || '', op_case_date: opSheet?.case_date || '' }
        : null;
      await writeSheet(form, importMeta ? { op_import: importMeta } : {});
      if (importMeta) {
        setForm(prev => ({ ...prev, op_import: importMeta }));
        setImportedKeys({});
      }
      autosave.markSaved();
      alert('✅ Case sheet saved!');
    } catch (e) {
      alert('Error saving: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Save anything outstanding before the sheet closes.
  const closeAfterSaving = async (then) => {
    const results = await Promise.all([autosave.flush(), dailyAutosave.flush(), followUpAutosave.flush()]);
    const ok = results.every(Boolean);
    if (!ok && !window.confirm('Your latest changes could not be saved (check the connection).\n\nClose the case sheet anyway and lose them?')) return;
    then();
  };

  // Internal liquid-stock tracking (ml used) for a daily entry — a failure here
  // is reported but never blocks the entry itself from being saved.
  const syncUsageSafely = async ({ id, date, items, patientName, source = 'ip_daily_progress' }) => {
    try {
      await syncEntryUsage({
        id, source, date, patient_id: patientId,
        patient_name: patientName || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
        mrd_number: patient?.mrd_number || patient?.patient_number || '', ip_number: patient?.ip_number || '',
      }, items || []);
    } catch (e) {
      console.error('Stock usage update failed:', e);
      alert('Entry saved, but updating the medicine stock failed: ' + e.message);
    }
  };

  // ── Autosave for the Daily Log and Follow up entry forms ──
  // A NEW entry being typed is autosaved as a draft on the case sheet doc
  // (daily_draft / follow_up_draft) and restored when the sheet is reopened;
  // it only becomes a real entry — and only then touches stock — on "Add".
  // An EXISTING entry being edited is saved straight into that entry.
  const writeDraft = async (field, data) => {
    const email = JSON.parse(localStorage.getItem('currentUser') || '{}').email || '';
    await setDoc(doc(db, 'ip_case_sheets', patientId), {
      patient_id: patientId,
      [field]: entryHasContent(data) ? { data, saved_at: new Date().toISOString(), saved_by: email } : null,
    }, { merge: true });
  };

  const updateDailyEntry = async (id, data) => {
    const { treatment_days: _td, ...entryFields } = data;
    const email = JSON.parse(localStorage.getItem('currentUser') || '{}').email || '';
    await updateDoc(doc(db, 'daily_progress', id), { ...entryFields, updated_at: new Date().toISOString(), updated_by: email });
    await syncUsageSafely({ id, date: entryFields.date, items: entryFields.medicine_items });
    setDailyProgress(prev => prev.map(e => (e.id === id ? { ...e, ...entryFields } : e)));
  };

  const updateFollowUp = async (id, data) => {
    const email = JSON.parse(localStorage.getItem('currentUser') || '{}').email || '';
    const now = new Date().toISOString();
    await persistFollowUps(sortFollowUps(form.follow_ups).map(f => (f.id === id ? { ...f, ...data, updated_at: now, updated_by: email } : f)));
    await syncUsageSafely({ id, date: data.date, items: data.medicine_items, source: 'ip_follow_up' });
  };

  const dailyAutosave = useAutosave({
    value: dailyForm,
    enabled: !loading && !!patientId,
    resetKey: editingDailyId || 'new',
    tone: 'light',
    save: (data) => (editingDailyId ? updateDailyEntry(editingDailyId, data) : writeDraft('daily_draft', data)),
  });
  const followUpAutosave = useAutosave({
    value: followUpForm,
    enabled: !loading && !!patientId,
    resetKey: editingFollowUpId || 'new',
    tone: 'light',
    save: (data) => (editingFollowUpId ? updateFollowUp(editingFollowUpId, data) : writeDraft('follow_up_draft', data)),
  });

  // The new-entry draft is set aside while an existing entry is being edited,
  // and put back in the form afterwards.
  const dailyStashRef = useRef(null);
  const followUpStashRef = useRef(null);

  const handleSaveDailyEntry = async () => {
    if (!dailyForm.date) { alert('Please select a date.'); return; }
    // Let any pending autosave land first, so it can't race the save below.
    await dailyAutosave.flush();
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
        await syncUsageSafely({ id: editingDailyId, date: entryFields.date, items: entryFields.medicine_items, patientName });
      } else {
        // "Treatment Days" pre-schedules one entry per consecutive day, all
        // starting with the same vitals/treatment/medication — the doctor
        // then edits each day's entry individually as that day happens.
        const days = Math.max(1, Math.min(15, Number(treatment_days) || 1));
        const groupId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const batch = writeBatch(db);
        const created = [];
        for (let i = 0; i < days; i++) {
          const ref = doc(collection(db, 'daily_progress'));
          created.push({ id: ref.id, date: addDaysToDateString(dailyForm.date, i) });
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
        for (const c of created) await syncUsageSafely({ id: c.id, date: c.date, items: entryFields.medicine_items, patientName });
        // The draft is now a real entry.
        await writeDraft('daily_draft', emptyDailyEntry());
        setRestoredDrafts(prev => ({ ...prev, daily: undefined }));
      }

      setDailyForm(editingDailyId ? (dailyStashRef.current || emptyDailyEntry()) : emptyDailyEntry());
      dailyStashRef.current = null;
      setEditingDailyId(null);
      await loadDailyProgress();
    } catch (e) {
      alert('Error saving daily entry: ' + e.message);
    } finally {
      setSavingDaily(false);
    }
  };

  // The entry form sits above the (possibly long) list of entries, so jump to
  // it after loading the entry — otherwise clicking the pencil appears to do
  // nothing because the form being edited is off-screen.
  const scrollToForm = (formId) => setTimeout(() => {
    document.getElementById(formId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);

  const handleEditDailyEntry = async (entry) => {
    await dailyAutosave.flush(); // finish saving whatever was being typed
    if (!editingDailyId) dailyStashRef.current = dailyForm;
    scrollToForm('daily-entry-form');
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

  // "Done": edits are already autosaved into the entry; go back to the new-entry form.
  const handleCancelEditDaily = async () => {
    await dailyAutosave.flush();
    setEditingDailyId(null);
    setDailyForm(dailyStashRef.current || emptyDailyEntry());
    dailyStashRef.current = null;
  };

  const handleDeleteDailyEntry = async (id) => {
    if (!window.confirm('Delete this daily record?')) return;
    try {
      await dailyAutosave.flush(); // nothing may autosave into it once it's gone
      await removeEntryUsage(id);
      await deleteDoc(doc(db, 'daily_progress', id));
      setDailyProgress(prev => prev.filter(e => e.id !== id));
      if (editingDailyId === id) {
        setEditingDailyId(null);
        setDailyForm(dailyStashRef.current || emptyDailyEntry());
        dailyStashRef.current = null;
      }
    } catch (e) {
      alert('Error deleting entry: ' + e.message);
    }
  };

  // Follow-ups are saved straight to the case sheet on Add/Update/Delete (only
  // the follow_ups field is written), so a returning patient's visit can be
  // recorded without having to re-save the rest of the sheet.
  const persistFollowUps = async (list) => {
    const sorted = sortFollowUps(list);
    await setDoc(doc(db, 'ip_case_sheets', patientId), { follow_ups: sorted, patient_id: patientId }, { merge: true });
    setForm(prev => ({ ...prev, follow_ups: sorted }));
  };

  const handleSaveFollowUp = async () => {
    if (!followUpForm.date) { alert('Please select a date.'); return; }
    await followUpAutosave.flush();
    try {
      setSavingFollowUp(true);
      const email = JSON.parse(localStorage.getItem('currentUser') || '{}').email || '';
      const now = new Date().toISOString();
      const current = sortFollowUps(form.follow_ups);
      const id = editingFollowUpId || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const list = editingFollowUpId
        ? current.map(f => f.id === editingFollowUpId ? { ...f, ...followUpForm, updated_at: now, updated_by: email } : f)
        : [...current, { ...followUpForm, id, created_at: now, created_by: email }];
      await persistFollowUps(list);
      // Liquid medicines used at the follow-up come out of internal stock,
      // exactly as on the daily log (Usage History shows them as "IP Follow up").
      await syncUsageSafely({ id, date: followUpForm.date, items: followUpForm.medicine_items, source: 'ip_follow_up' });
      if (!editingFollowUpId) {
        await writeDraft('follow_up_draft', emptyFollowUp()); // the draft is now a real entry
        setRestoredDrafts(prev => ({ ...prev, followup: undefined }));
      }
      setFollowUpForm(editingFollowUpId ? (followUpStashRef.current || emptyFollowUp()) : emptyFollowUp());
      followUpStashRef.current = null;
      setEditingFollowUpId(null);
    } catch (e) {
      alert('Error saving follow-up: ' + e.message);
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleEditFollowUp = async (f) => {
    await followUpAutosave.flush();
    if (!editingFollowUpId) followUpStashRef.current = followUpForm;
    scrollToForm('followup-entry-form');
    setEditingFollowUpId(f.id);
    const { id: _id, created_at: _c, created_by: _cb, updated_at: _u, updated_by: _ub, ...fields } = normFollowUp(f);
    setFollowUpForm({ ...fields, date: f.date || today() });
  };

  const handleCancelEditFollowUp = async () => {
    await followUpAutosave.flush();
    setEditingFollowUpId(null);
    setFollowUpForm(followUpStashRef.current || emptyFollowUp());
    followUpStashRef.current = null;
  };

  const handleDeleteFollowUp = async (id) => {
    if (!window.confirm('Delete this follow-up record?')) return;
    try {
      await followUpAutosave.flush(); // nothing may autosave into it once it's gone
      await removeEntryUsage(id); // give back any stock it used
      await persistFollowUps((form.follow_ups || []).filter(f => f.id !== id));
      if (editingFollowUpId === id) {
        setEditingFollowUpId(null);
        setFollowUpForm(followUpStashRef.current || emptyFollowUp());
        followUpStashRef.current = null;
      }
    } catch (e) {
      alert('Error deleting follow-up: ' + e.message);
    }
  };

  const handlePrint = (sectionId = 'all') => {
    const matchedDoctor = doctors.find(d => d.name === form.physician_name);
    const doctorInfo = matchedDoctor ? {
      name: form.physician_name.replace(/^Dr\.?\s*/i, ''),
      qualification: matchedDoctor.qualification || '',
      designation: matchedDoctor.designation || '',
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
    { id: 'followup', label: `Follow up ${form.follow_ups?.length > 0 ? `(${form.follow_ups.length})` : ''}` },
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
              {(patient?.age || patient?.gender) && <span className="ml-2">{patient?.age || '—'} / {patient?.gender || '—'}</span>}
              {patient?.mrd_number && <span className="ml-2 font-mono">MRD: {patient.mrd_number}</span>}
              {patient?.ip_number && <span className="ml-2 font-mono">IP: {patient.ip_number}</span>}
            </p>
            {!loading && <div className="mt-1">{autosave.indicator}</div>}
          </div>
          <div className="flex gap-2">
            {onViewDischargeSummary && (
              <button
                onClick={() => closeAfterSaving(onViewDischargeSummary)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-800 text-white rounded-lg hover:bg-teal-900 font-medium text-sm"
                title="Open this patient's Discharge Summary"
              >
                <ClipboardList className="w-4 h-4" /> Discharge Summary
              </button>
            )}
            {opImport.items.length > 0 && (
              <button
                onClick={() => setShowOPImport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-800 text-white rounded-lg hover:bg-teal-900 font-medium text-sm"
                title="Copy details from this patient's OP Case Sheet"
              >
                <FileInput className="w-4 h-4" /> Import from OP
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
            <button onClick={() => closeAfterSaving(onClose)} className="p-2 text-white hover:bg-teal-600 rounded-lg" title="Close (unsaved changes are saved first)">
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
              {Object.values(importedKeys).filter(tab => tab === t.id).length > 0 && (
                <span className="ml-2 text-[10px] font-bold text-amber-800 bg-amber-200 rounded-full px-1.5 py-0.5" title="Fields from the OP case sheet awaiting your review">
                  {Object.values(importedKeys).filter(tab => tab === t.id).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading case sheet…</div>
          ) : (
            <>
              {showOPBanner && (
                <div className="flex items-center justify-between gap-4 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                  <div className="text-sm text-teal-900">
                    <p className="font-semibold">This patient has an OP case sheet{opSheet?.case_date ? ` from ${fmtDate(opSheet.case_date)}` : ''}.</p>
                    <p className="text-teal-700">Bring over the history, examination and investigations instead of re-entering them — you choose what to copy.</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={handleDismissOPBanner} className="px-3 py-2 text-sm text-teal-800 hover:bg-teal-100 rounded-lg">Start fresh</button>
                    <button onClick={() => setShowOPImport(true)} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg">Review &amp; import</button>
                  </div>
                </div>
              )}
              {Object.keys(importedKeys).length > 0 && (
                <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-900">
                  <span><strong>{Object.keys(importedKeys).length}</strong> field{Object.keys(importedKeys).length === 1 ? '' : 's'} copied from the OP case sheet (highlighted). Review or edit them, then Save.</span>
                  <button onClick={() => setImportedKeys({})} className="text-amber-800 underline flex-shrink-0">Clear highlights</button>
                </div>
              )}

              {/* ── CASE SHEET ── */}
              {activeTab === 'sheet' && (
                <div className="space-y-5" ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e, () => advanceTab('sheet'))}>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Department" value={form.department} onChange={v => set('department', v)} fromOP={isFromOP('department')} />
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
                    <Field label="Father / Husband Name" value={form.father_husband_name} onChange={v => set('father_husband_name', v)} fromOP={isFromOP('father_husband_name')} />
                    <Field label="Religion" value={form.religion} onChange={v => set('religion', v)} fromOP={isFromOP('religion')} />
                    <Field label="Caste" value={form.caste} onChange={v => set('caste', v)} />
                    <Field label="Occupation" value={form.occupation} onChange={v => set('occupation', v)} fromOP={isFromOP('occupation')} />
                    <Field label="Nationality" value={form.nationality} onChange={v => set('nationality', v)} />
                    <Field label="Monthly Income" value={form.monthly_income} onChange={v => set('monthly_income', v)} />
                    <Field label="Marital Status" value={form.marital_status} onChange={v => set('marital_status', v)} fromOP={isFromOP('marital_status')} />
                    <div className="col-span-2">
                      <Field label="Nearest Relative (Name & Address)" value={form.nearest_relative} onChange={v => set('nearest_relative', v)} />
                    </div>
                    <Field label="Informant (if applicable)" value={form.informant} onChange={v => set('informant', v)} fromOP={isFromOP('informant')} />
                    <Field label="Socio-Economic Status" value={form.socio_economic_status} onChange={v => set('socio_economic_status', v)} fromOP={isFromOP('socio_economic_status')} />
                  </div>

                  <SectionTitle>Admission Details</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Room Number</label>
                      <select
                        value={form.room_number && form.room_type ? `${form.room_number}|${form.room_type}` : ''}
                        onChange={e => {
                          const { number, type } = parseRoomBookingKey(e.target.value);
                          setForm(prev => ({ ...prev, room_number: number, room_type: type }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value="">Select Room</option>
                        {ROOM_BOOKING_OPTIONS.filter(o => !occupiedRooms.has(o.number) || o.number === form.room_number).map(o => (
                          <option key={o.key} value={o.key}>
                            Room {o.number} ({o.type} — ₹{o.rate}/day)
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
                    <Field label="Diagnosis" value={form.admin_diagnosis} onChange={v => set('admin_diagnosis', v)} fromOP={isFromOP('admin_diagnosis')} />
                    <Field label="Result" value={form.result} onChange={v => set('result', v)} />
                  </div>

                  <TextArea label="Roopam (Presenting complaints, signs & symptoms with duration)" rows={4}
                    value={form.roopam} onChange={v => set('roopam', v)} fromOP={isFromOP('roopam')} />
                  <Field label="Pain Assessment (Score)" value={form.pain_assessment} onChange={v => set('pain_assessment', v)} fromOP={isFromOP('pain_assessment')} />
                </div>
              )}

              {/* ── HISTORY & EXAMINATION ── */}
              {activeTab === 'history' && (
                <div className="space-y-5" ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e, () => advanceTab('history'))}>
                  <SectionTitle>History</SectionTitle>
                  <TextArea label="History of Presenting Complaints" rows={3} value={form.history_presenting_complaints} onChange={v => set('history_presenting_complaints', v)} fromOP={isFromOP('history_presenting_complaints')} />
                  <TextArea label="History of Past Illness" rows={3} value={form.history_past_illness} onChange={v => set('history_past_illness', v)} fromOP={isFromOP('history_past_illness')} />
                  <TextArea label="Family History" rows={2} value={form.family_history} onChange={v => set('family_history', v)} fromOP={isFromOP('family_history')} />
                  <TextArea label="Presently Taking the Following Medicines" rows={2} value={form.current_medicines} onChange={v => set('current_medicines', v)} />
                  <TextArea
                    label="Medication Details"
                    rows={3}
                    value={form.medication_details}
                    onChange={v => set('medication_details', v)} fromOP={isFromOP('medication_details')}
                    placeholder="Medications reported by the patient (as told to you) — the structured, per-day medication list is entered in the Vitals & Daily Log tab."
                  />
                  <TextArea
                    label="Treatment Details"
                    rows={3}
                    value={form.treatment_details}
                    onChange={v => set('treatment_details', v)} fromOP={isFromOP('treatment_details')}
                    placeholder="Treatment history reported by the patient — the structured, per-day treatment list is entered in the Vitals & Daily Log tab."
                  />

                  <SectionTitle>Personal History</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Diet" value={form.diet} onChange={v => set('diet', v)} fromOP={isFromOP('diet')} />
                    <Field label="Appetite" value={form.appetite} onChange={v => set('appetite', v)} fromOP={isFromOP('appetite')} />
                    <Field label="Bowel" value={form.bowel} onChange={v => set('bowel', v)} fromOP={isFromOP('bowel')} />
                    <Field label="Micturition" value={form.micturition} onChange={v => set('micturition', v)} fromOP={isFromOP('micturition')} />
                    <Field label="Sleep" value={form.sleep} onChange={v => set('sleep', v)} fromOP={isFromOP('sleep')} />
                    <Field label="Habits / Addiction" value={form.habits_addiction} onChange={v => set('habits_addiction', v)} fromOP={isFromOP('habits_addiction')} />
                    <Field label="Hypersensitivity" value={form.hypersensitivity} onChange={v => set('hypersensitivity', v)} fromOP={isFromOP('hypersensitivity')} />
                    <Field label="Hereditary" value={form.hereditary} onChange={v => set('hereditary', v)} />
                    <Field label="Menstrual History" value={form.menstrual_history} onChange={v => set('menstrual_history', v)} fromOP={isFromOP('menstrual_history')} />
                    <Field label="Immunization History" value={form.immunization_history} onChange={v => set('immunization_history', v)} fromOP={isFromOP('immunization_history')} />
                  </div>

                  <SectionTitle>General Examination</SectionTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Pulse" value={form.pulse} onChange={v => set('pulse', v)} fromOP={isFromOP('pulse')} />
                    <Field label="Heart Rate" value={form.heart_rate} onChange={v => set('heart_rate', v)} />
                    <Field label="Height (cm)" value={form.height} onChange={v => set('height', v)} fromOP={isFromOP('height')} />
                    <Field label="BP" value={form.bp} onChange={v => set('bp', v)} fromOP={isFromOP('bp')} />
                    <Field label="Temperature" value={form.temperature} onChange={v => set('temperature', v)} fromOP={isFromOP('temperature')} />
                    <Field label="Weight (kg)" value={form.weight} onChange={v => set('weight', v)} fromOP={isFromOP('weight')} />
                    <Field label="BMI" value={form.bmi} onChange={v => set('bmi', v)} readOnly placeholder="Auto-calculated" />
                    <Field label="Consciousness" value={form.consciousness} onChange={v => set('consciousness', v)} fromOP={isFromOP('consciousness')} />
                    <Field label="Orientation" value={form.orientation} onChange={v => set('orientation', v)} fromOP={isFromOP('orientation')} />
                    <Field label="Mobility" value={form.mobility} onChange={v => set('mobility', v)} fromOP={isFromOP('mobility')} />
                  </div>

                  <SectionTitle>Systemic Examination</SectionTitle>
                  <TextArea label="CVS / CNS / RS / LS" rows={2} value={form.cvs_cns_rs_ls} onChange={v => set('cvs_cns_rs_ls', v)} fromOP={isFromOP('cvs_cns_rs_ls')} />
                  <div className="grid grid-cols-4 gap-4">
                    <Field label="DM" value={form.dm} onChange={v => set('dm', v)} fromOP={isFromOP('dm')} />
                    <Field label="HTN" value={form.htn} onChange={v => set('htn', v)} fromOP={isFromOP('htn')} />
                    <Field label="IHD" value={form.ihd} onChange={v => set('ihd', v)} fromOP={isFromOP('ihd')} />
                    <Field label="Hyperlipidemia" value={form.hyperlipidemia} onChange={v => set('hyperlipidemia', v)} fromOP={isFromOP('hyperlipidemia')} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Thyroid Dysfunction" value={form.thyroid_dysfunction} onChange={v => set('thyroid_dysfunction', v)} fromOP={isFromOP('thyroid_dysfunction')} />
                    <Field label="Other Condition" value={form.comorbidity_other_label} onChange={v => set('comorbidity_other_label', v)} fromOP={isFromOP('comorbidity_other_label')} />
                    <Field label="Value" value={form.comorbidity_other_value} onChange={v => set('comorbidity_other_value', v)} fromOP={isFromOP('comorbidity_other_value')} />
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
                    <Field label="Dooshya" value={form.dooshya} onChange={v => set('dooshya', v)} fromOP={isFromOP('dooshya')} />
                    <Field label="Desha" value={form.desha} onChange={v => set('desha', v)} />
                    <Field label="Bala" value={form.bala} onChange={v => set('bala', v)} />
                    <Field label="Kala" value={form.kala} onChange={v => set('kala', v)} fromOP={isFromOP('kala')} />
                    <Field label="Anala" value={form.anala} onChange={v => set('anala', v)} />
                    <Field label="Prakruti" value={form.prakruti} onChange={v => set('prakruti', v)} fromOP={isFromOP('prakruti')} />
                    <Field label="Vayah" value={form.vayah} onChange={v => set('vayah', v)} fromOP={isFromOP('vayah')} />
                    <Field label="Satwa" value={form.satwa} onChange={v => set('satwa', v)} fromOP={isFromOP('satwa')} />
                    <Field label="Satmya" value={form.satmya} onChange={v => set('satmya', v)} fromOP={isFromOP('satmya')} />
                    <Field label="Ahara" value={form.ahara} onChange={v => set('ahara', v)} />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Field label="Vikrithi" value={form.vikrithi} onChange={v => set('vikrithi', v)} fromOP={isFromOP('vikrithi')} />
                    <Field label="Sara" value={form.sara} onChange={v => set('sara', v)} fromOP={isFromOP('sara')} />
                    <Field label="Samhanana" value={form.samhanana} onChange={v => set('samhanana', v)} fromOP={isFromOP('samhanana')} />
                    <Field label="Pramana" value={form.pramana} onChange={v => set('pramana', v)} fromOP={isFromOP('pramana')} />
                    <Field label="Aharasakthi" value={form.aharasakthi} onChange={v => set('aharasakthi', v)} fromOP={isFromOP('aharasakthi')} />
                    <Field label="Vyayamasakthi" value={form.vyayamasakthi} onChange={v => set('vyayamasakthi', v)} fromOP={isFromOP('vyayamasakthi')} />
                    <Field label="Dosham" value={form.dosham} onChange={v => set('dosham', v)} fromOP={isFromOP('dosham')} />
                    <Field label="Agni" value={form.agni} onChange={v => set('agni', v)} fromOP={isFromOP('agni')} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Srotas Involved" value={form.srotas_involved} onChange={v => set('srotas_involved', v)} fromOP={isFromOP('srotas_involved')} />
                    <Field label="Diagnosis (Ayurvedic)" value={form.ayurvedic_diagnosis} onChange={v => set('ayurvedic_diagnosis', v)} />
                  </div>
                </div>
              )}

              {/* ── VITALS & DAILY LOG ── */}
              {activeTab === 'vitals' && (
                <div className="space-y-5">
                  <div id="daily-entry-form" className={`border rounded-xl p-4 bg-gray-50 ${editingDailyId ? 'border-teal-400 ring-2 ring-teal-200' : 'border-gray-200'}`} ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e)}>
                    <EntryFormHeader
                      title={editingDailyId ? `Editing Entry — ${fmtDate(dailyForm.date)}` : 'Add Daily Record'}
                      editing={!!editingDailyId}
                      autosave={dailyAutosave}
                      hasContent={entryHasContent(dailyForm)}
                      restored={!editingDailyId && entryHasContent(dailyForm) ? restoredDrafts.daily : null}
                      addLabel="Add Entry"
                      onDiscard={() => { setDailyForm(emptyDailyEntry()); setRestoredDrafts(p => ({ ...p, daily: undefined })); }}
                    />

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

                    <LogEntryFields value={dailyForm} setValue={setDailyForm} />

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
                          title="Your edits are already saved automatically"
                        >
                          Done
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
                          <LogEntryDetails e={e} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── FOLLOW UP (after discharge) ── */}
              {activeTab === 'followup' && (
                <div className="space-y-5">
                  <div id="followup-entry-form" className={`border rounded-xl p-4 bg-gray-50 ${editingFollowUpId ? 'border-teal-400 ring-2 ring-teal-200' : 'border-gray-200'}`} ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e)}>
                    <EntryFormHeader
                      title={editingFollowUpId ? `Editing Follow up — ${fmtDate(followUpForm.date)}` : 'Add Follow up'}
                      editing={!!editingFollowUpId}
                      autosave={followUpAutosave}
                      hasContent={entryHasContent(followUpForm)}
                      restored={!editingFollowUpId && entryHasContent(followUpForm) ? restoredDrafts.followup : null}
                      addLabel="Add Follow up"
                      onDiscard={() => { setFollowUpForm(emptyFollowUp()); setRestoredDrafts(p => ({ ...p, followup: undefined })); }}
                    />
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <Field label="Follow-up Date" type="date" value={followUpForm.date} onChange={v => setFollowUpForm(p => ({ ...p, date: v }))} />
                    </div>
                    <LogEntryFields value={followUpForm} setValue={setFollowUpForm} />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveFollowUp}
                        disabled={savingFollowUp}
                        className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-60"
                      >
                        <Plus className="w-4 h-4" />
                        {savingFollowUp ? 'Saving...' : editingFollowUpId ? 'Update Follow up' : 'Add Follow up'}
                      </button>
                      {editingFollowUpId && (
                        <button onClick={handleCancelEditFollowUp} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50" title="Your edits are already saved automatically">
                          Done
                        </button>
                      )}
                    </div>
                  </div>

                  {(form.follow_ups || []).length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="font-medium">No follow-up records yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortFollowUps(form.follow_ups).map(f => (
                        <div key={f.id} className={`border rounded-xl overflow-hidden ${editingFollowUpId === f.id ? 'border-teal-400 ring-1 ring-teal-200' : 'border-gray-200'}`}>
                          <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800 text-sm">{fmtDate(f.date)}</span>
                              {f.created_by && <span className="text-xs text-gray-400">by {f.created_by}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEditFollowUp(f)} className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteFollowUp(f.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <LogEntryDetails e={f} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── INVESTIGATIONS & PROCEDURE ── */}
              {activeTab === 'investigations' && (
                <div className="space-y-5" ref={tabContainerRef} onKeyDown={e => handleContainerEnter(e, () => advanceTab('investigations'))}>
                  <TextArea label="Investigations" rows={8} value={form.investigations} onChange={v => set('investigations', v)} fromOP={isFromOP('investigations')}
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
          <span>Everything saves automatically as you type. A new Daily Log or Follow up entry stays a draft until you click Add.</span>
          <button onClick={() => setShowPrintOptions(true)} className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Printer className="w-4 h-4" /> Print Case Sheet
          </button>
        </div>
      </div>

      {showOPImport && (
        <OPImportModal
          op={opSheet}
          items={opImport.items}
          unmapped={opImport.unmapped}
          form={form}
          onApply={handleApplyOPImport}
          onClose={() => setShowOPImport(false)}
        />
      )}

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
