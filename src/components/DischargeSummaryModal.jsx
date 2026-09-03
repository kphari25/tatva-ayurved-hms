import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, Plus, Trash2, FileText, Receipt } from 'lucide-react';
import { db } from '../lib/firebase';
import { addDoc, updateDoc, deleteDoc, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import MedicineSaleModal from './MedicineSaleModal';
import { withDrPrefix } from '../lib/formatDoctorName';
import { todayLocalDateStr, addDaysToDateString } from '../lib/formatDate';
import MedicineTable from './MedicineTable';
import { buildMedicineItemsTableHTML } from '../lib/medicineSummary';

const HOSPITAL = {
  name: 'Tatva Ayurved',
  tagline: 'Ayurveda for Health & Happiness',
  address: 'Thekkuveedu Lane, Kannur Road, Kozhikode',
  phone: '9895112264, 0495 2766717',
  email: 'info@tatvaayurved.com',
  website: 'www.tatvaayurved.com',
  regNo: 'BFHP03-C110100-00061-2025',
  preparedBy: 'Dr. Satheesh Kumar – Chief Physician\nDr. Abirami PB – RMO\nTatva Ayurved Hospital, Calicut',
};

// Formats the IP Case Sheet's native <input type="time"> value ("HH:MM",
// 24-hour) into this form's own "hh:mmAM/PM" convention, so a synced value
// reads the same way a manually-typed one would.
const formatTime12h = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}${period}`;
};

// Same calculation InvoiceModal's IP "Days" field uses, so this and the
// invoice never disagree about how many days a stay covers.
const calcDurationDays = (admissionDate, dischargeDate) => {
  if (!admissionDate || !dischargeDate) return null;
  const admission = new Date(admissionDate);
  const discharge = new Date(dischargeDate);
  if (isNaN(admission) || isNaN(discharge) || discharge < admission) return null;
  return Math.max(1, Math.round((discharge - admission) / (1000 * 60 * 60 * 24)));
};

const emptyForm = () => ({
  // Patient identifiers (pre-filled from patient record)
  ward_no: '',
  ip_no: '',
  mrd_no: '',
  admission_date: '',
  admission_time: '03:00PM',
  discharge_date: todayLocalDateStr(),
  discharge_time: '12:00PM',
  duration_days: '',
  doctor_in_charge: '',

  // Chief Complaints — array of strings
  chief_complaints: [''],

  // Provisional Diagnosis
  provisional_diagnosis: '',

  // Relevant Medical History — array of strings
  medical_history: [''],

  // Vital Parameters on Admission
  vitals: { bp: '', pulse: '', weight: '', spo2: '', temperature: '' },

  // Clinical Examination Findings
  clinical_findings: {
    tremor: '',
    rigidity: '',
    slowness: '',
    postural_instability: '',
    other: '',
  },

  // Ashtasthana Pareeksha
  ashtasthana: {
    nadi: '', mutra: '', malam: '', jihva: '',
    sabda: '', sparsha: '', drik: '', akrithi: '',
  },

  // Diagnosis
  diagnosis: '',

  // Ayurvedic Samprapthi
  samprapthi: { dosha: '', dushya: '', srothas: '', srotho_dushti: '' },

  // Treatment Given
  internal_medicines: [''],
  external_treatments: [{ treatment: '', days: '' }],

  // Diet and Lifestyle
  diet_lifestyle: '',

  // Response to Treatment — array of { parameter, before, after }
  response_to_treatment: [
    { parameter: 'Weight', before: '', after: '' },
    { parameter: 'Sleep', before: '', after: '' },
    { parameter: 'Wellbeing', before: '', after: '' },
  ],

  // Summary at Discharge
  summary_at_discharge: [''],

  // Advise on Discharge — structured rows (item_name/dose/frequency/
  // instructions/days), same shape MedicineTable uses for Daily Progress's
  // "Medicines Given" so the discharge advice prints in the same format.
  discharge_internal_medicines: [],
  discharge_external_treatments: [''],

  // Pathya-Apathya
  pathya_dos: [''],
  apathya_donts: [''],

  // Lifestyle Modification
  lifestyle_modification: '',

  // Follow-Up Plan
  next_review: '',
  next_review_date: '',
  // Day offset behind next_review_date when it was set via a quick-select
  // button or the custom-days input — lets next_review_date be recomputed
  // if discharge_date changes afterward. Null when next_review_date was
  // set by picking a specific calendar date directly, which has no
  // relationship to discharge_date and shouldn't be recalculated.
  next_review_days: null,
  review_procedure: 'Tele-consultation / In-person review',

  // Daily treatment log: [{ date, treatment, medicines, notes }]
  daily_treatments: [],

  // Prognosis & Remarks
  prognosis: '',
  remarks: '',
});

// Older discharge summaries stored discharge_internal_medicines as a plain
// string[] (free-text medicine names, no dose/frequency/days). Loading one
// of those into the new MedicineTable rows keeps the name and leaves the
// structured fields blank rather than trying to guess them out of the text.
const normalizeMedicineRows = (arr) =>
  (arr || []).filter(Boolean).map(item =>
    typeof item === 'string'
      ? { id: Date.now() + Math.random(), item_name: item, item_code: '', mrp: 0, dose: '', frequency: '', instructions: '', days: '' }
      : { id: item.id || Date.now() + Math.random(), ...item }
  );

// ── List editor helper ──────────────────────────────────────────────────
const ListEditor = ({ label, items, onChange, placeholder = 'Add item...' }) => {
  const update = (i, val) => { const n = [...items]; n[i] = val; onChange(n); };
  const add = () => onChange([...items, '']);
  const remove = (i) => { if (items.length === 1) return; const n = [...items]; n.splice(i, 1); onChange(n); };
  return (
    <div>
      {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              value={item}
              onChange={e => update(i, e.target.value)}
              placeholder={placeholder}
            />
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 px-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 text-teal-600 text-sm flex items-center gap-1 hover:text-teal-800">
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
};

// ── Medicine autocomplete row ───────────────────────────────────────────
const MedicineRow = ({ value, onChange, onRemove, inventory }) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const suggestions = query.length >= 2
    ? inventory.filter(m =>
        (m.item_name || '').toLowerCase().includes(query.toLowerCase()) ||
        String(m.item_code || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (med) => {
    const label = med.item_name || med.item_code;
    setQuery(label);
    onChange(label);
    setOpen(false);
  };

  return (
    <div className="flex gap-2 relative" ref={ref}>
      <div className="flex-1 relative">
        <input
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Type medicine name from inventory..."
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm">
            {suggestions.map(med => {
              const stock = parseFloat(med.stock_quantity) || 0;
              return (
                <li
                  key={med.id}
                  onMouseDown={() => select(med)}
                  className="px-3 py-2 hover:bg-teal-50 cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-gray-800">{med.item_name}</span>
                    {med.item_code && <span className="text-xs text-gray-400 ml-2">{med.item_code}</span>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    stock === 0 ? 'bg-red-100 text-red-700' :
                    stock <= 10 ? 'bg-orange-100 text-orange-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {stock === 0 ? 'Out of stock' : `Stock: ${stock}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <button onClick={onRemove} className="text-red-400 hover:text-red-600 px-1 shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

const MedicineListEditor = ({ label, items, onChange, inventory }) => {
  const update = (i, val) => { const n = [...items]; n[i] = val; onChange(n); };
  const add = () => onChange([...items, '']);
  const remove = (i) => { if (items.length === 1) return; const n = [...items]; n.splice(i, 1); onChange(n); };
  return (
    <div>
      {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <MedicineRow
            key={i}
            value={item}
            inventory={inventory}
            onChange={val => update(i, val)}
            onRemove={() => remove(i)}
          />
        ))}
      </div>
      <button onClick={add} className="mt-2 text-teal-600 text-sm flex items-center gap-1 hover:text-teal-800">
        <Plus className="w-3 h-3" /> Add Medicine
      </button>
    </div>
  );
};

// ── Print HTML generator ────────────────────────────────────────────────
// letterhead=true skips the logo/contact header (already pre-printed on the
// hospital's letterhead stock) and pushes page-1 content down to clear that
// artwork — only page 1 gets the extra top margin; page 2+ print normally.
const buildPrintHTML = (patient, form, letterhead = false, doctorInfo = {}, pageSize = 'A4') => {
  // A5 is roughly half of A4 — a short OP-style discharge summary can fit,
  // though a full clinical discharge summary with treatments/medicines is
  // long enough that it will likely still span multiple A5 pages; that's an
  // accepted tradeoff, same as the other print options in this app.
  const pageMargin = pageSize === 'A5' ? { v: '10mm', h: '8mm' } : { v: '15mm', h: '12mm' };
  const patientName = `${patient?.title || ''} ${patient?.first_name || ''} ${patient?.last_name || ''}`.trim().toUpperCase();
  const address = [patient?.address, patient?.city, patient?.state, patient?.pincode].filter(Boolean).join(', ').toUpperCase();
  const age = patient?.age || '';
  const gender = patient?.gender?.[0]?.toUpperCase() || '';

  const admDate = form.admission_date ? new Date(form.admission_date).toLocaleDateString('en-IN') : '';
  const disDate = form.discharge_date ? new Date(form.discharge_date).toLocaleDateString('en-IN') : '';

  const bullet = (arr) => arr.filter(Boolean).map(i => `<li>${i}</li>`).join('');
  const tableRow = (label, val) => `<tr><td style="padding:4px 8px;font-weight:bold;">${label}</td><td style="padding:4px 8px;">${val}</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Discharge Summary – ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding-bottom: 140px; }
    @page { size: ${pageSize}; margin: ${pageMargin.v} ${pageMargin.h}; }
    ${letterhead ? '@page :first { margin-top: 45mm; }' : ''}
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
    .info-label { font-weight: bold; min-width: 120px; }

    .section-title { font-size: 12px; font-weight: bold; margin: 10px 0 5px; text-transform: uppercase; }
    ul { margin-left: 18px; }
    ul li { margin-bottom: 2px; }

    table.grid { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
    table.grid th, table.grid td { border: 1px solid #aaa; padding: 4px 8px; }
    table.grid th { background: #f0f0f0; font-weight: bold; }

    table.med-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
    table.med-table th, table.med-table td { border: 1px solid #ccc; padding: 2px 4px; text-align: left; }
    table.med-table th { background: #f5f5f5; font-weight: 600; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    /* Signature block stays pinned to the bottom of the printed page, same
       treatment as the prescription and invoice printouts, instead of
       trailing wherever the content happens to end. */
    .footer { margin-top: 50px; border-top: 2px solid #1a5f4e; padding-top: 10px; display: flex; justify-content: space-between; }
    @media print {
      .footer { position: fixed; left: ${pageMargin.h}; right: ${pageMargin.h}; bottom: ${pageMargin.v}; margin-top: 0; background: #fff; }
    }
    .sig-block { text-align: right; }
    .sig-line { border-top: 1px solid #000; width: 180px; margin-top: 40px; margin-left: auto; margin-bottom: 4px; }
    .sig-block .doctor-name { font-weight: bold; font-size: 11px; }
    .sig-block .reg { font-size: 9px; color: #555; }
    .prepared-by { font-size: 10px; line-height: 1.6; }
  </style>
</head>
<body>

<!-- HEADER (omitted on letterhead — already pre-printed on the paper) -->
${letterhead ? '' : `
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
`}

<div class="title">DISCHARGE SUMMARY</div>

<!-- PATIENT INFO -->
<div class="info-grid">
  <div class="info-left">
    <div class="info-row"><span class="info-label">Name of Patient:</span> ${patientName}</div>
    <div class="info-row"><span class="info-label">Address:</span> ${address}</div>
    <div class="info-row"><span class="info-label">Tel no:</span> ${patient?.phone || ''}</div>
    <div class="info-row"><span class="info-label">Age / sex:</span> ${age}/${gender}</div>
    <div class="info-row"><span class="info-label">Date of Admission:</span> ${admDate} (${form.admission_time || ''})</div>
    <div class="info-row"><span class="info-label">Duration of stay:</span> ${form.duration_days ? form.duration_days + ' DAYS' : ''}</div>
    <div class="info-row"><span class="info-label">Doctor in Charge:</span> ${form.doctor_in_charge?.toUpperCase() || ''}</div>
  </div>
  <div class="info-right">
    <div class="info-row"><span class="info-label">Ward no:</span> ${form.ward_no}</div>
    <div class="info-row"><span class="info-label">IP No:</span> ${form.ip_no || patient?.ip_number || ''}</div>
    <div class="info-row"><span class="info-label">MRD No:</span> ${form.mrd_no || patient?.mrd_number || ''}</div>
    <div class="info-row"><span class="info-label">Date of Discharge:</span> ${disDate} (${form.discharge_time || ''})</div>
  </div>
</div>

<!-- CHIEF COMPLAINTS -->
<div class="section-title">Chief Complaints</div>
<ul>${bullet(form.chief_complaints)}</ul>

<!-- PROVISIONAL DIAGNOSIS -->
<div class="section-title">Provisional Diagnosis: <span style="font-weight:normal;">${form.provisional_diagnosis}</span></div>

<!-- MEDICAL HISTORY -->
${form.medical_history.filter(Boolean).length ? `
<div class="section-title">Relevant Medical History:</div>
<ul>${bullet(form.medical_history)}</ul>
` : ''}

<!-- VITAL PARAMETERS -->
<div class="section-title">Vital Parameters on Admission</div>
<table class="grid">
  <thead><tr><th>PARAMETERS</th><th>READING</th></tr></thead>
  <tbody>
    ${form.vitals.bp ? `<tr><td>BP</td><td>${form.vitals.bp}</td></tr>` : ''}
    ${form.vitals.pulse ? `<tr><td>PULSE</td><td>${form.vitals.pulse}</td></tr>` : ''}
    ${form.vitals.weight ? `<tr><td>WEIGHT</td><td>${form.vitals.weight}</td></tr>` : ''}
    ${form.vitals.spo2 ? `<tr><td>SPO2</td><td>${form.vitals.spo2}</td></tr>` : ''}
    ${form.vitals.temperature ? `<tr><td>TEMPERATURE</td><td>${form.vitals.temperature}</td></tr>` : ''}
  </tbody>
</table>

<!-- CLINICAL FINDINGS -->
<div class="section-title">Clinical Examination Finding:</div>
${form.clinical_findings.tremor ? `<p>Tremor – ${form.clinical_findings.tremor}</p>` : ''}
${form.clinical_findings.rigidity ? `<p>Rigidity – ${form.clinical_findings.rigidity}</p>` : ''}
${form.clinical_findings.slowness ? `<p>Slowness – ${form.clinical_findings.slowness}</p>` : ''}
${form.clinical_findings.postural_instability ? `<p>Postural instability – ${form.clinical_findings.postural_instability}</p>` : ''}
${form.clinical_findings.other ? `<p>${form.clinical_findings.other}</p>` : ''}

<!-- ASHTASTHANA PAREEKSHA -->
${Object.values(form.ashtasthana).some(Boolean) ? `
<div class="section-title">Ashtasthana Pareeksha:</div>
<table class="grid">
  <tbody>
    <tr>
      <td><strong>NADI</strong></td><td>${form.ashtasthana.nadi}</td>
      <td><strong>SABDA</strong></td><td>${form.ashtasthana.sabda}</td>
    </tr>
    <tr>
      <td><strong>MUTRA</strong></td><td>${form.ashtasthana.mutra}</td>
      <td><strong>SPARSHA</strong></td><td>${form.ashtasthana.sparsha}</td>
    </tr>
    <tr>
      <td><strong>MALAM</strong></td><td>${form.ashtasthana.malam}</td>
      <td><strong>DRIK</strong></td><td>${form.ashtasthana.drik}</td>
    </tr>
    <tr>
      <td><strong>JIHVA</strong></td><td>${form.ashtasthana.jihva}</td>
      <td><strong>AKRITHI</strong></td><td>${form.ashtasthana.akrithi}</td>
    </tr>
  </tbody>
</table>
` : ''}

<!-- DIAGNOSIS -->
<div class="section-title">Diagnosis: <span style="font-weight:normal;">${form.diagnosis}</span></div>

<!-- SAMPRAPTHI -->
${Object.values(form.samprapthi).some(Boolean) ? `
<div class="section-title">Ayurvedic Samprapthi</div>
<ul>
  ${form.samprapthi.dosha ? `<li>DOSHA: ${form.samprapthi.dosha}</li>` : ''}
  ${form.samprapthi.dushya ? `<li>DUSHYA: ${form.samprapthi.dushya}</li>` : ''}
  ${form.samprapthi.srothas ? `<li>SROTHAS: ${form.samprapthi.srothas}</li>` : ''}
  ${form.samprapthi.srotho_dushti ? `<li>SROTHO DUSHTI: ${form.samprapthi.srotho_dushti}</li>` : ''}
</ul>
` : ''}

<!-- TREATMENT GIVEN -->
<div class="section-title">Treatment Given</div>
${form.internal_medicines.filter(Boolean).length ? `
<p style="font-style:italic;font-weight:bold;margin-bottom:4px;">Internal Medicines:</p>
<ul>${bullet(form.internal_medicines)}</ul>
` : ''}

${(form.daily_treatments || []).filter(t => t.treatment || t.medicines).length ? `
<p style="font-style:italic;font-weight:bold;margin:8px 0 4px;">Daily Treatment Log:</p>
<table class="grid" style="font-size:11px;">
  <thead>
    <tr>
      <th style="width:90px;">Date</th>
      <th>Treatment / Procedure</th>
      <th>Medicines Given</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    ${(form.daily_treatments || []).filter(t => t.treatment || t.medicines).map(t => `
      <tr>
        <td>${t.date ? new Date(t.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : ''}</td>
        <td>${t.treatment || ''}</td>
        <td>${t.medicines || ''}</td>
        <td>${t.notes || ''}</td>
      </tr>`).join('')}
  </tbody>
</table>
` : ''}

<!-- DIET AND LIFESTYLE -->
${form.diet_lifestyle ? `
<div class="section-title">Diet and Lifestyle During Treatment</div>
<p style="white-space:pre-line;">${form.diet_lifestyle}</p>
` : ''}

<!-- RESPONSE TO TREATMENT -->
${form.response_to_treatment.filter(r => r.parameter && (r.before || r.after)).length ? `
<div class="section-title">Response to Treatment</div>
<table class="grid">
  <thead><tr><th>PARAMETERS</th><th>BEFORE</th><th>AFTER</th></tr></thead>
  <tbody>
    ${form.response_to_treatment.filter(r => r.parameter).map(r => `<tr><td>${r.parameter}</td><td>${r.before}</td><td>${r.after}</td></tr>`).join('')}
  </tbody>
</table>
` : ''}

<!-- SUMMARY AT DISCHARGE -->
${form.summary_at_discharge.filter(Boolean).length ? `
<div class="section-title">Summary at Discharge</div>
<ul>${bullet(form.summary_at_discharge)}</ul>
` : ''}

<!-- ADVISE ON DISCHARGE -->
${(form.discharge_internal_medicines.filter(r => r.item_name).length || form.discharge_external_treatments.filter(Boolean).length) ? `
<div class="section-title">Advise on Discharge:</div>
${form.discharge_internal_medicines.filter(r => r.item_name).length ? `
<p style="font-weight:bold;margin:4px 0 2px;">INTERNAL MEDICINE</p>
${buildMedicineItemsTableHTML(form.discharge_internal_medicines)}` : ''}
${form.discharge_external_treatments.filter(Boolean).length ? `
<p style="font-weight:bold;margin:6px 0 2px;">EXTERNAL TREATMENT</p>
<ul>${bullet(form.discharge_external_treatments)}</ul>` : ''}
` : ''}

<!-- PATHYA-APATHYA -->
${(form.pathya_dos.filter(Boolean).length || form.apathya_donts.filter(Boolean).length) ? `
<div class="section-title">Pathya-Apathya (Do's and Don'ts)</div>
${form.pathya_dos.filter(Boolean).length ? `<p style="font-weight:bold;">Do's:</p><ul>${bullet(form.pathya_dos)}</ul>` : ''}
${form.apathya_donts.filter(Boolean).length ? `<p style="font-weight:bold;margin-top:6px;">Don'ts:</p><ul>${bullet(form.apathya_donts)}</ul>` : ''}
` : ''}

<!-- LIFESTYLE -->
${form.lifestyle_modification ? `
<div class="section-title">Life Style Modification</div>
<p style="white-space:pre-line;">${form.lifestyle_modification}</p>
` : ''}

<!-- FOLLOW-UP -->
<div class="section-title">Follow-Up Plan</div>
<p>Next Review: ${form.next_review ? `After ${form.next_review}` : '—'}${form.next_review_date ? ` &nbsp;|&nbsp; <strong>Date: ${new Date(form.next_review_date).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</strong>` : ''}</p>
${form.doctor_in_charge ? `<p>Doctor: ${form.doctor_in_charge}</p>` : ''}
<p>Review Procedure: ${form.review_procedure}</p>

<!-- PROGNOSIS -->
${form.prognosis ? `<div class="section-title">Prognosis</div><p>${form.prognosis}</p>` : ''}

<!-- REMARKS -->
${form.remarks ? `<div class="section-title">Remarks</div><p>${form.remarks}</p>` : ''}

<!-- FOOTER -->
<div class="footer">
  <div class="prepared-by">
    <strong>Prepared &amp; Verified by:</strong><br>
    ${HOSPITAL.preparedBy.replace(/\n/g, '<br>')}
    <br>📞 ${HOSPITAL.phone} | 🌐 ${HOSPITAL.website}
  </div>
  <div class="sig-block">
    <div class="sig-line"></div>
    ${doctorInfo.name ? `<p class="doctor-name">Dr. ${doctorInfo.name}</p>` : ''}
    ${doctorInfo.designation ? `<p class="reg">${doctorInfo.designation}</p>` : ''}
    ${doctorInfo.registrationNumber ? `<p class="reg">Reg No: ${doctorInfo.registrationNumber}</p>` : ''}
    <p style="font-size:10px;margin-top:2px;">Signature of Medical Superintendent</p>
  </div>
</div>

</body>
</html>`;
};

// ── Main Modal ──────────────────────────────────────────────────────────
const DischargeSummaryModal = ({ patient, existingSummary, onClose, onSave, onViewCaseSheet }) => {
  const [form, setForm] = useState(() => {
    if (existingSummary) return {
      ...emptyForm(),
      ...existingSummary,
      // A summary saved before the case-sheet sync effect below finished
      // its fetch (e.g. Save clicked right after opening) can have these
      // persisted blank even though the case sheet has a real value —
      // fall back to the patient record's own admission/discharge date the
      // same way a brand-new draft does below, rather than showing blank
      // until the sync effect re-fetches and corrects it a moment later.
      admission_date: existingSummary.admission_date || patient?.admission_date || '',
      discharge_date: existingSummary.discharge_date || patient?.discharge_date || emptyForm().discharge_date,
      discharge_internal_medicines: normalizeMedicineRows(existingSummary.discharge_internal_medicines),
    };
    const f = emptyForm();
    f.patient_name = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();
    f.ip_no = patient?.ip_number || '';
    f.mrd_no = patient?.mrd_number || patient?.patient_number || '';
    f.admission_date = patient?.admission_date || '';
    f.doctor_in_charge = patient?.assigned_doctor || '';
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [useLetterhead, setUseLetterhead] = useState(false);
  const [printPageSize, setPrintPageSize] = useState('A4');
  // Print preview — in-page iframe printed via its own contentWindow,
  // same pattern as MedicineSaleModal/InvoiceModal (see medicineSalePrint.js
  // for why: window.open()+document.write() silently crashes whenever the
  // popup is blocked, since it calls .document on the null it returns).
  const [printPreviewHtml, setPrintPreviewHtml] = useState(null);
  const printIframeRef = useRef(null);
  // Blocks Save until the case-sheet fetch below has resolved at least
  // once — Save used to be able to fire while admission_time/discharge_time
  // still held their generic placeholder defaults ("03:00PM"/"12:00PM"),
  // permanently persisting those instead of the real case-sheet times (this
  // happened for real: a saved summary was found with the placeholder times
  // even though its case sheet had different real ones). Date fields have a
  // synchronous patient-record fallback so they can't go truly blank, but
  // times have no equivalent source to fall back to — so this is the fix
  // for them.
  const [caseSheetSynced, setCaseSheetSynced] = useState(false);
  const [activeSection, setActiveSection] = useState('patient');
  const [inventory, setInventory] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [dailyProgress, setDailyProgress] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  // Per-medicine autocomplete in daily treatments
  const [medSuggestions, setMedSuggestions] = useState({});
  const [openMedDrop, setOpenMedDrop] = useState(null);
  const [showMedicineInvoice, setShowMedicineInvoice] = useState(false);

  const loadInventory = () => {
    getDocs(collection(db, 'inventory')).then(snap => {
      // Spread first, id last: some inventory docs carry their own legacy
      // numeric `id` field, which would otherwise clobber the real doc id.
      setInventory(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    }).catch(() => {});
  };

  // Re-check live stock right when the user actually starts picking medicines,
  // rather than only once when the whole modal first opened — this form can
  // stay open a while, and stock/new items can change under it in the meantime.
  useEffect(() => {
    if (activeSection === 'discharge' || activeSection === 'treatment') loadInventory();
  }, [activeSection]);

  useEffect(() => {
    loadInventory();

    // Load doctors from HR employees
    const DOCTOR_KW = ['doctor', 'physician', 'consultant', 'vaidya', 'surgeon', 'rmo', 'medical'];
    getDocs(collection(db, 'hr_employees')).then(snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => {
          const h = `${e.department || ''} ${e.designation || ''} ${e.role || ''}`.toLowerCase();
          return DOCTOR_KW.some(k => h.includes(k));
        });
      setDoctors(docs);
    }).catch(() => {});

    // Load daily progress for IP patients to auto-populate summary
    const patientId = patient?.id || patient?.firebaseId;
    const isIP = patient?.patient_type === 'IP' || !!patient?.ip_number;

    // Date/Time of Admission and Date/Time of Discharge are kept in sync
    // with the patient's case sheet (IP or OP, whichever applies) every time
    // this opens — new draft or resuming an already-saved summary — since
    // those are the values staff shouldn't have to re-type or manually
    // reconcile between the two documents.
    const syncAdmissionDischarge = (cs) => {
      setForm(prev => ({
        ...prev,
        admission_date: cs.admission_date || prev.admission_date,
        admission_time: cs.admission_time ? formatTime12h(cs.admission_time) : prev.admission_time,
        discharge_date: cs.discharge_date || prev.discharge_date,
        discharge_time: cs.discharge_time ? formatTime12h(cs.discharge_time) : prev.discharge_time,
      }));
    };

    if (patientId && isIP) {
      setLoadingProgress(true);
      // Sorted client-side rather than via orderBy() — combining it with the
      // where() above needs a Firestore composite index that isn't set up,
      // which made this query fail silently.
      const q = query(collection(db, 'daily_progress'), where('patient_id', '==', patientId));
      getDocs(q).then(snap => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        records.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        setDailyProgress(records);
        // Runs for a resumed summary too, not just a brand-new draft — a
        // Daily Progress entry added after the summary was first saved
        // (a real, common case: more days pass before discharge is
        // actually finalized) otherwise never showed up here. Safe either
        // way: see autoPopulateFromProgress, which only fills gaps rather
        // than overwriting anything already recorded.
        if (records.length > 0) {
          autoPopulateFromProgress(records);
        }
      }).catch(() => {}).finally(() => setLoadingProgress(false));

      // Load IP Case Sheet (admission-time Ayurvedic assessment & history) to
      // prefill a blank draft, and to keep admission/discharge date+time synced.
      // autoPopulateFromCaseSheet also runs for a resumed summary, not just a
      // new draft — e.g. Ashtasthana Pareeksha entered on the case sheet
      // after the summary was first saved otherwise never showed up here.
      // Safe either way: every field it sets only fills a gap, never
      // overwrites something already recorded.
      getDoc(doc(db, 'ip_case_sheets', patientId)).then(snap => {
        if (!snap.exists()) return;
        const cs = snap.data();
        syncAdmissionDischarge(cs);
        autoPopulateFromCaseSheet(cs);
      }).catch(() => {}).finally(() => setCaseSheetSynced(true));

      // Load OP Case Sheet vitals — preferred over daily-progress vitals for
      // "on admission" since it's recorded at the actual admitting visit.
      // Runs for a resumed summary too — safe, see autoPopulateVitalsFromOpCaseSheet.
      getDoc(doc(db, 'op_case_sheets', patientId)).then(snap => {
        if (snap.exists()) autoPopulateVitalsFromOpCaseSheet(snap.data());
      }).catch(() => {});
    } else if (patientId) {
      // OP-only patient — no IP Case Sheet exists, so admission/discharge
      // date+time, and the clinical history prefill, come from their OP
      // Case Sheet instead.
      getDoc(doc(db, 'op_case_sheets', patientId)).then(snap => {
        if (!snap.exists()) return;
        const cs = snap.data();
        syncAdmissionDischarge(cs);
        // Same reasoning as the IP branch above — safe to re-run for a
        // resumed summary since every field here only fills a gap. Vitals
        // weren't synced for an OP-only patient at all before — the IP
        // branch's admission vitals come from autoPopulateFromCaseSheet's
        // IP Case Sheet fields, which don't exist for this patient, so
        // autoPopulateVitalsFromOpCaseSheet is the only source here.
        autoPopulateFromOpCaseSheet(cs);
        autoPopulateVitalsFromOpCaseSheet(cs);
      }).catch(() => {}).finally(() => setCaseSheetSynced(true));
    } else {
      // No patient id to sync from at all — shouldn't normally happen, but
      // don't leave Save permanently blocked if it does.
      setCaseSheetSynced(true);
    }
  }, []);

  // Keeps Duration of Stay in lockstep with whatever the two dates above
  // currently are — a manual edit, the case-sheet sync effect updating
  // them, or the initial load — rather than a separately-typed number that
  // can silently drift out of sync with the actual date range.
  useEffect(() => {
    const days = calcDurationDays(form.admission_date, form.discharge_date);
    if (days !== null) setForm(prev => (prev.duration_days === days ? prev : { ...prev, duration_days: days }));
  }, [form.admission_date, form.discharge_date]);

  // A quick-select / custom-days follow-up pick (next_review_days set) is
  // meant to track "N days after discharge" rather than a fixed calendar
  // date — recompute it whenever discharge_date changes afterward (e.g.
  // the case-sheet sync effect updates it, or it's corrected manually), so
  // it doesn't silently stay anchored to whatever discharge_date was at
  // the moment it was picked. A directly-picked calendar date
  // (next_review_days null) is left alone — it has no such relationship.
  useEffect(() => {
    if (form.next_review_days == null || !form.discharge_date) return;
    const iso = addDaysToDateString(form.discharge_date, form.next_review_days);
    setForm(prev => (prev.next_review_date === iso ? prev : { ...prev, next_review_date: iso }));
  }, [form.discharge_date, form.next_review_days]);

  const autoPopulateFromCaseSheet = (cs) => {
    setForm(prev => ({
      ...prev,
      // "Vital Parameters on Admission" — the IP Case Sheet's own General
      // Examination fields, recorded at admission. Only fills a gap; never
      // overwrites a value already here (from daily-progress vitals, the OP
      // case sheet, or a manual correction), so this is safe to run on
      // every open, not just a brand-new draft.
      vitals: {
        ...prev.vitals,
        bp: prev.vitals.bp || cs.bp || '',
        temperature: prev.vitals.temperature || cs.temperature || '',
        pulse: prev.vitals.pulse || cs.pulse || '',
        weight: prev.vitals.weight || cs.weight || '',
      },
      ashtasthana: {
        nadi: prev.ashtasthana.nadi || cs.nadi || '',
        mutra: prev.ashtasthana.mutra || cs.mutra || '',
        malam: prev.ashtasthana.malam || cs.malam || '',
        jihva: prev.ashtasthana.jihva || cs.jihwa || '',
        sabda: prev.ashtasthana.sabda || cs.sabda || '',
        sparsha: prev.ashtasthana.sparsha || cs.sparsa || '',
        drik: prev.ashtasthana.drik || cs.drik || '',
        akrithi: prev.ashtasthana.akrithi || cs.akriti || '',
      },
      samprapthi: {
        ...prev.samprapthi,
        dushya: prev.samprapthi.dushya || cs.dooshya || '',
        srothas: prev.samprapthi.srothas || cs.srotas_involved || '',
      },
      provisional_diagnosis: prev.provisional_diagnosis || cs.admin_diagnosis || '',
      chief_complaints: prev.chief_complaints.filter(Boolean).length > 0
        ? prev.chief_complaints
        : cs.roopam ? [cs.roopam] : prev.chief_complaints,
      medical_history: prev.medical_history.filter(Boolean).length > 0
        ? prev.medical_history
        : cs.history_past_illness ? [cs.history_past_illness] : prev.medical_history,
    }));
  };

  const autoPopulateFromOpCaseSheet = (cs) => {
    const historyLines = [
      cs.history_present_illness ? `Present Illness: ${cs.history_present_illness}` : '',
      cs.history_previous_illness ? `Previous Illness: ${cs.history_previous_illness}` : '',
      cs.family_history ? `Family History: ${cs.family_history}` : '',
    ].filter(Boolean);

    setForm(prev => ({
      ...prev,
      samprapthi: {
        ...prev.samprapthi,
        dushya: prev.samprapthi.dushya || cs.dushyam || '',
        srothas: prev.samprapthi.srothas || cs.srotas || '',
      },
      provisional_diagnosis: prev.provisional_diagnosis || cs.provisional_diagnosis || cs.diagnosis || '',
      chief_complaints: prev.chief_complaints.filter(Boolean).length > 0
        ? prev.chief_complaints
        : cs.presenting_complaints ? [cs.presenting_complaints] : prev.chief_complaints,
      medical_history: prev.medical_history.filter(Boolean).length > 0
        ? prev.medical_history
        : historyLines.length > 0 ? historyLines : prev.medical_history,
    }));
  };

  // OP Case Sheet vitals — recorded at the actual admitting visit, so
  // preferred for "on admission" over daily-progress vitals when both are
  // available. Was cs.X || prev.Y (case sheet always wins), which reliably
  // gave it priority over autoPopulateFromProgress's fill-only-if-blank
  // regardless of which of their two independent fetches resolved first —
  // but also meant re-running it on an existing summary would silently
  // overwrite a vital staff had since corrected by hand. Switched to
  // fill-only-if-blank like every other autoPopulate* function; the two
  // fetches racing is no longer a concern since IP case sheet vitals
  // (autoPopulateFromCaseSheet, above) use the same safe pattern, so
  // whichever resolves first no longer "loses" to a stale overwrite.
  const autoPopulateVitalsFromOpCaseSheet = (cs) => {
    setForm(prev => ({
      ...prev,
      vitals: {
        ...prev.vitals,
        bp: prev.vitals.bp || cs.bp || '',
        temperature: prev.vitals.temperature || cs.temperature || '',
        pulse: prev.vitals.pulse || cs.pulse || '',
        weight: prev.vitals.weight || cs.weight || '',
      },
    }));
  };

  const autoPopulateFromProgress = (records) => {
    // Daily Treatment Log entries, one per recorded IP daily-progress day —
    // this is the field the "Daily Treatment Log" section/print actually reads.
    const dailyEntries = records
      .filter(r => r.treatment_performed || r.medicines_given || r.doctors_notes)
      .map(r => ({
        date: r.date || '',
        treatment: r.treatment_performed || '',
        medicines: r.medicines_given || '',
        notes: r.doctors_notes || '',
      }));

    const medicineLines = records
      .filter(r => r.medicines_given)
      .map(r => `${new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${r.medicines_given}`);

    // "Diet and Lifestyle During Treatment" — compiled from each day's
    // Diet / Food notes, the same way Internal Medicines compiles from
    // medicines_given. Only used as a fallback (fill-only-if-blank, below)
    // since this field is really discharge advice text a doctor writes,
    // not a verbatim log — but a doctor starting from what was actually
    // recorded is better than a blank field.
    const dietLines = records
      .filter(r => r.diet)
      .map(r => `${new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${r.diet}`);

    // Use last known vitals as a fallback — OP Case Sheet vitals (loaded separately)
    // take priority for "on admission", so only fill fields still blank here.
    const lastWithVitals = [...records].reverse().find(r => r.bp_morning || r.temperature);

    setForm(prev => {
      // Merge in only the dates not already logged, rather than an
      // all-or-nothing fill — this is what lets a Daily Progress entry
      // added after the summary's first save still show up here on a
      // later open, without disturbing any row already recorded
      // (including one a user has since hand-edited).
      const existingDates = new Set((prev.daily_treatments || []).map(e => e.date));
      const newDailyEntries = dailyEntries.filter(e => !existingDates.has(e.date));
      return {
        ...prev,
        vitals: {
          ...prev.vitals,
          bp: prev.vitals.bp || lastWithVitals?.bp_morning || '',
          temperature: prev.vitals.temperature || lastWithVitals?.temperature || '',
          pulse: prev.vitals.pulse || lastWithVitals?.pulse || '',
          spo2: prev.vitals.spo2 || lastWithVitals?.spo2 || '',
          weight: prev.vitals.weight || lastWithVitals?.weight || '',
        },
        daily_treatments: newDailyEntries.length > 0
          ? [...(prev.daily_treatments || []), ...newDailyEntries]
          : (prev.daily_treatments || []),
        internal_medicines: prev.internal_medicines.filter(Boolean).length > 0
          ? prev.internal_medicines
          : medicineLines.length > 0 ? medicineLines : prev.internal_medicines,
        diet_lifestyle: prev.diet_lifestyle || dietLines.join('\n'),
      };
    });
  };

  const set = (path, val) => {
    setForm(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = val;
      return next;
    });
  };

  // Daily treatment helpers
  const addDailyTreatment = () => {
    set('daily_treatments', [...(form.daily_treatments || []), { date: todayLocalDateStr(), treatment: '', medicines: '', notes: '' }]);
  };
  const updateDailyTreatment = (idx, field, val) => {
    const arr = [...(form.daily_treatments || [])];
    arr[idx] = { ...arr[idx], [field]: val };
    set('daily_treatments', arr);
  };
  const removeDailyTreatment = (idx) => {
    const arr = [...(form.daily_treatments || [])];
    arr.splice(idx, 1);
    set('daily_treatments', arr);
  };
  const getMedSug = (q) =>
    q.length < 2 ? [] :
    inventory.filter(m =>
      (m.item_name || '').toLowerCase().includes(q.toLowerCase()) ||
      String(m.item_code || '').toLowerCase().includes(q.toLowerCase())
    ).slice(0, 6);

  const handlePrint = () => {
    // Exact-match against the dropdown's own derived name misses whenever
    // doctor_in_charge came from elsewhere with a shorter name (e.g.
    // auto-populated from the patient's assigned_doctor, "Dr. Satheesh",
    // vs the HR record's full "Dr. Satheesh Kumar") — normalize and accept
    // a prefix match either direction, same fix as the prescription print.
    const normalizeDocName = (s) => (s || '').replace(/^dr\.?\s*/i, '').trim().toLowerCase();
    const target = normalizeDocName(form.doctor_in_charge);
    const selectedDoctor = doctors.find(d => {
      const n = normalizeDocName(`${d.first_name || ''} ${d.last_name || ''}`.trim() || d.name);
      return n && target && (n === target || n.startsWith(target) || target.startsWith(n));
    });
    const doctorInfo = selectedDoctor ? {
      name: form.doctor_in_charge.replace(/^Dr\.?\s*/i, ''),
      designation: selectedDoctor.designation || '',
      registrationNumber: selectedDoctor.isDoctor ? (selectedDoctor.registrationNumber || '') : '',
    } : {};
    setPrintPreviewHtml(buildPrintHTML(patient, form, useLetterhead, doctorInfo, printPageSize));
  };

  const handlePrintFromPreview = () => {
    const win = printIframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();
      const data = {
        patient_id: patient?.id || patient?.firebaseId,
        patient_name: patientName,
        patient_number: patient?.patient_number || '',
        mrd_number: form.mrd_no,
        ip_number: form.ip_no,
        ...form,
        saved_at: new Date().toISOString(),
      };
      let dischargeSummaryId = existingSummary?.id;
      if (dischargeSummaryId) {
        await updateDoc(doc(db, 'discharge_summaries', dischargeSummaryId), data);
      } else {
        const newDoc = await addDoc(collection(db, 'discharge_summaries'), data);
        dischargeSummaryId = newDoc.id;
      }

      // Saving this summary is drafting/documenting the clinical record —
      // it does NOT discharge the patient. admission_status only changes
      // when front desk actually performs the discharge from the Discharge
      // Management portal (billing/checkout), so a summary can be saved and
      // re-saved while the patient is still physically admitted.

      // Keep the Scheduling follow-up appointment in sync with this summary's
      // next_review_date across repeated saves, rather than creating a fresh
      // duplicate every single time this form is saved (which is what used
      // to happen — a patient resaved 3 times ended up with 3 appointments).
      // follow_up_appointment_id (persisted on the summary itself) is how a
      // later save finds the one it already created, to update in place.
      let followUpAppointmentId = existingSummary?.follow_up_appointment_id || null;
      let appointmentAction = null; // 'created' | 'updated' | 'removed'
      if (form.next_review_date) {
        const apptPayload = {
          patient: `${patientName}${form.mrd_no ? ` (${form.mrd_no})` : ''}`,
          patient_id: patient?.id || patient?.firebaseId,
          date: form.next_review_date,
          time: '10:00',
          type: 'Follow up',
          doctorId: '',
          doctorName: form.doctor_in_charge || '',
          therapistIds: [],
          therapistNames: [],
          notes: `Follow-up after discharge. ${form.review_procedure || ''}`.trim(),
          source: 'discharge_summary',
        };
        if (followUpAppointmentId) {
          try {
            // Deliberately omits `status` — if staff already marked this
            // appointment completed/cancelled directly in Scheduling, a
            // routine resave of the summary shouldn't silently revert that.
            await updateDoc(doc(db, 'appointments', followUpAppointmentId), apptPayload);
            appointmentAction = 'updated';
          } catch (apptErr) {
            // The appointment doc this summary remembers may have been
            // deleted independently (e.g. removed in Scheduling) — fall
            // back to creating a fresh one rather than losing the follow-up.
            console.error('Error updating existing follow-up appointment, creating a new one:', apptErr);
            followUpAppointmentId = null;
          }
        }
        if (!followUpAppointmentId) {
          const newAppt = await addDoc(collection(db, 'appointments'), {
            ...apptPayload,
            status: 'scheduled',
            createdAt: new Date().toISOString(),
          });
          followUpAppointmentId = newAppt.id;
          appointmentAction = 'created';
        }
      } else if (followUpAppointmentId) {
        // Follow-up was cleared on this save — remove the now-stale
        // appointment instead of leaving an orphan sitting in Scheduling.
        try {
          await deleteDoc(doc(db, 'appointments', followUpAppointmentId));
          appointmentAction = 'removed';
        } catch (apptErr) {
          console.error('Error removing stale follow-up appointment:', apptErr);
        }
        followUpAppointmentId = null;
      }
      if (followUpAppointmentId !== (existingSummary?.follow_up_appointment_id || null)) {
        await updateDoc(doc(db, 'discharge_summaries', dischargeSummaryId), { follow_up_appointment_id: followUpAppointmentId });
      }

      alert(
        '✅ Discharge summary saved!' +
        (appointmentAction === 'created' ? '\n📅 Follow-up appointment created in Scheduling.' : '') +
        (appointmentAction === 'updated' ? '\n📅 Follow-up appointment updated in Scheduling.' : '') +
        (appointmentAction === 'removed' ? '\n📅 Follow-up date cleared — the appointment in Scheduling was removed.' : '')
      );
      if (onSave) onSave();
    } catch (e) {
      alert('Error saving: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const isIPPatient = patient?.patient_type === 'IP' || !!patient?.ip_number;

  const sections = [
    { id: 'patient', label: 'Patient Info' },
    { id: 'clinical', label: 'Clinical' },
    { id: 'treatment', label: 'Treatment' },
    { id: 'discharge', label: 'Discharge Advice' },
    { id: 'followup', label: 'Follow-Up' },
    ...(isIPPatient ? [{ id: 'progress', label: `Daily Progress ${dailyProgress.length > 0 ? `(${dailyProgress.length})` : ''}` }] : []),
  ];

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-teal-700 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-white">Discharge Summary</h2>
            <p className="text-teal-200 text-sm mt-0.5">
              {patient?.first_name} {patient?.last_name}
              {(form.mrd_no || patient?.mrd_number) && <span className="ml-2 font-mono">MRD: {form.mrd_no || patient?.mrd_number}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {isIPPatient && onViewCaseSheet && (
              <button
                onClick={onViewCaseSheet}
                className="flex items-center gap-2 px-4 py-2 bg-teal-800 text-white rounded-lg hover:bg-teal-900 font-medium text-sm"
                title="Open this patient's IP Case Sheet"
              >
                <FileText className="w-4 h-4" /> IP Case Sheet
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white text-teal-700 rounded-lg hover:bg-teal-50 font-medium text-sm"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !caseSheetSynced}
              title={!caseSheetSynced ? 'Syncing admission/discharge time from the case sheet…' : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-400 font-medium text-sm disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : !caseSheetSynced ? 'Syncing...' : 'Save'}
            </button>
            <button onClick={onClose} className="p-2 text-white hover:bg-teal-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex-shrink-0 flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeSection === s.id ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">

          {/* ── PATIENT INFO ── */}
          {activeSection === 'patient' && (
            <div className="space-y-5">
              {/* Auto-filled patient banner */}
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-teal-600 font-semibold uppercase mb-0.5">Patient Name</p>
                  <p className="font-bold text-gray-900">{form.patient_name || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-teal-600 font-semibold uppercase mb-0.5">MRD Number</p>
                  <p className="font-bold text-gray-900 font-mono">{form.mrd_no || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-teal-600 font-semibold uppercase mb-0.5">{patient?.ip_number ? 'IP Number' : 'Patient Type'}</p>
                  <p className="font-bold text-gray-900 font-mono">{form.ip_no || patient?.patient_type || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ward No</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.ward_no} onChange={e => set('ward_no', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP No <span className="text-teal-600 text-xs">(auto-filled)</span></label>
                  <input className="w-full px-3 py-2 border border-teal-300 bg-teal-50 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.ip_no} onChange={e => set('ip_no', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MRD No <span className="text-teal-600 text-xs">(auto-filled)</span></label>
                  <input className="w-full px-3 py-2 border border-teal-300 bg-teal-50 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.mrd_no} onChange={e => set('mrd_no', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Admission <span className="text-teal-600 text-xs">(synced from {isIPPatient ? 'IP' : 'OP'} Case Sheet)</span></label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.admission_date} onChange={e => set('admission_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission Time <span className="text-teal-600 text-xs">(synced from {isIPPatient ? 'IP' : 'OP'} Case Sheet)</span></label>
                  <input type="text" placeholder="e.g. 03:00PM" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.admission_time} onChange={e => set('admission_time', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Discharge <span className="text-teal-600 text-xs">(synced from {isIPPatient ? 'IP' : 'OP'} Case Sheet)</span></label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.discharge_date} onChange={e => set('discharge_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Time <span className="text-teal-600 text-xs">(synced from {isIPPatient ? 'IP' : 'OP'} Case Sheet)</span></label>
                  <input type="text" placeholder="e.g. 04:00PM" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.discharge_time} onChange={e => set('discharge_time', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration of Stay (days) {calcDurationDays(form.admission_date, form.discharge_date) !== null && (
                      <span className="text-teal-600 text-xs">(auto)</span>
                    )}
                  </label>
                  <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.duration_days} onChange={e => set('duration_days', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Doctor in Charge <span className="text-teal-600 text-xs">(auto-filled if assigned)</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.doctor_in_charge}
                    onChange={e => set('doctor_in_charge', e.target.value)}
                  >
                    <option value="">— Select Doctor —</option>
                    {doctors.map(d => {
                      const name = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.name || '';
                      return <option key={d.id} value={name}>{name}{d.designation ? ` (${d.designation})` : ''}</option>;
                    })}
                    <option value="__manual__">Other / Type manually…</option>
                  </select>
                  {form.doctor_in_charge === '__manual__' && (
                    <input className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      placeholder="Type doctor name…"
                      onChange={e => set('doctor_in_charge', e.target.value)} />
                  )}
                </div>
              </div>

              <ListEditor label="Chief Complaints" items={form.chief_complaints}
                onChange={v => set('chief_complaints', v)}
                placeholder="e.g. C/O weakness of both legs while walking since 2 years" />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Provisional Diagnosis</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  value={form.provisional_diagnosis} onChange={e => set('provisional_diagnosis', e.target.value)} placeholder="e.g. KAMPAVATA" />
              </div>

              <ListEditor label="Relevant Medical History" items={form.medical_history}
                onChange={v => set('medical_history', v)} placeholder="e.g. H/O DIABETES MELLITUS since 2 months" />
            </div>
          )}

          {/* ── CLINICAL ── */}
          {activeSection === 'clinical' && (
            <div className="space-y-5">
              {/* Vitals */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">Vital Parameters on Admission</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[['BP', 'bp', 'e.g. 150/100'], ['Pulse', 'pulse', 'e.g. 70/MIN'], ['Weight', 'weight', 'e.g. 63KG'], ['SPO2', 'spo2', 'e.g. 98%'], ['Temperature', 'temperature', 'e.g. 98.6°F']].map(([lbl, key, ph]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        value={form.vitals[key]} onChange={e => set(`vitals.${key}`, e.target.value)} placeholder={ph} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical Findings */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">Clinical Examination Findings</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[['Tremor', 'tremor'], ['Rigidity', 'rigidity'], ['Slowness', 'slowness'], ['Postural Instability', 'postural_instability']].map(([lbl, key]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        value={form.clinical_findings[key]} onChange={e => set(`clinical_findings.${key}`, e.target.value)}
                        placeholder="present / absent / present occasionally" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Other Findings</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                      value={form.clinical_findings.other} onChange={e => set('clinical_findings.other', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Ashtasthana Pareeksha */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">Ashtasthana Pareeksha</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[['Nadi', 'nadi'], ['Mutra', 'mutra'], ['Malam', 'malam'], ['Jihva', 'jihva'],
                    ['Sabda', 'sabda'], ['Sparsha', 'sparsha'], ['Drik', 'drik'], ['Akrithi', 'akrithi']].map(([lbl, key]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        value={form.ashtasthana[key]} onChange={e => set(`ashtasthana.${key}`, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Diagnosis</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} placeholder="e.g. KAMPA VATA" />
              </div>

              {/* Samprapthi */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">Ayurvedic Samprapthi</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[['Dosha', 'dosha'], ['Dushya', 'dushya'], ['Srothas', 'srothas'], ['Srotho Dushti', 'srotho_dushti']].map(([lbl, key]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        value={form.samprapthi[key]} onChange={e => set(`samprapthi.${key}`, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TREATMENT ── */}
          {activeSection === 'treatment' && (
            <div className="space-y-6">
              <MedicineListEditor
                label="Internal Medicines"
                items={form.internal_medicines}
                onChange={v => set('internal_medicines', v)}
                inventory={inventory}
              />

              {/* Daily Treatment Log */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">Daily Treatment Log</label>
                  <button onClick={addDailyTreatment}
                    className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 font-medium">
                    <Plus className="w-4 h-4" /> Add Day
                  </button>
                </div>
                {(!form.daily_treatments || form.daily_treatments.length === 0) ? (
                  <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
                    No daily treatment entries yet. Click "Add Day" to log treatment for each day.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {form.daily_treatments.map((entry, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Day header */}
                        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 border-b border-gray-200">
                          <span className="text-xs font-semibold text-gray-500 uppercase">Day {idx + 1}</span>
                          <input
                            type="date"
                            value={entry.date}
                            onChange={e => updateDailyTreatment(idx, 'date', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                          />
                          <button onClick={() => removeDailyTreatment(idx)} className="ml-auto text-red-400 hover:text-red-600 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-4 space-y-3">
                          {/* Treatment */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Treatment / Procedure</label>
                            <input
                              value={entry.treatment}
                              onChange={e => updateDailyTreatment(idx, 'treatment', e.target.value)}
                              placeholder="e.g. Abhyanga, Shirodhara, Kadi Kizhi…"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                          </div>
                          {/* Medicines with inventory autocomplete */}
                          <div className="relative">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Medicines Given</label>
                            <input
                              value={entry.medicines}
                              onChange={e => {
                                updateDailyTreatment(idx, 'medicines', e.target.value);
                                const q = e.target.value.split(',').pop().trim();
                                setMedSuggestions(p => ({ ...p, [idx]: getMedSug(q) }));
                                setOpenMedDrop(idx);
                              }}
                              onFocus={() => {
                                const q = (entry.medicines || '').split(',').pop().trim();
                                if (q.length >= 2) { setMedSuggestions(p => ({ ...p, [idx]: getMedSug(q) })); setOpenMedDrop(idx); }
                              }}
                              onBlur={() => setTimeout(() => setOpenMedDrop(null), 200)}
                              placeholder="Type medicine name to search inventory, separate with commas…"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                            {openMedDrop === idx && medSuggestions[idx]?.length > 0 && (
                              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                                {medSuggestions[idx].map(med => (
                                  <div
                                    key={med.id}
                                    onMouseDown={() => {
                                      const parts = entry.medicines.split(',');
                                      parts[parts.length - 1] = ` ${med.item_name || med.item_code}`;
                                      updateDailyTreatment(idx, 'medicines', parts.join(',').trimStart() + ', ');
                                      setOpenMedDrop(null);
                                    }}
                                    className="px-3 py-2 hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0"
                                  >
                                    <span className="font-medium text-sm text-gray-900">{med.item_code}</span>
                                    <span className="text-xs text-gray-500 ml-2">{med.item_name}</span>
                                    <span className={`float-right text-xs px-1.5 py-0.5 rounded-full ${parseFloat(med.stock_quantity) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      Stock: {med.stock_quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Notes */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Doctor's Notes / Observations</label>
                            <textarea
                              value={entry.notes}
                              onChange={e => updateDailyTreatment(idx, 'notes', e.target.value)}
                              placeholder="Patient response, observations, plan changes…"
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Diet & Lifestyle */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Diet and Lifestyle During Treatment</label>
                <textarea rows={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                  value={form.diet_lifestyle} onChange={e => set('diet_lifestyle', e.target.value)}
                  placeholder="• Advised warm, light, non-oily, non-spicy diet&#10;• Avoid curd, cold water, refrigerated food..." />
              </div>

              {/* Response to Treatment */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Response to Treatment</label>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-3 py-2 text-left">Parameter</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Before</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">After</th>
                      <th className="w-8 border border-gray-300"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.response_to_treatment.map((r, i) => (
                      <tr key={i}>
                        <td className="border border-gray-200 p-1">
                          <input className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-teal-400 outline-none"
                            value={r.parameter} onChange={e => {
                              const n = [...form.response_to_treatment]; n[i] = { ...n[i], parameter: e.target.value }; set('response_to_treatment', n);
                            }} />
                        </td>
                        <td className="border border-gray-200 p-1">
                          <input className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-teal-400 outline-none"
                            value={r.before} onChange={e => {
                              const n = [...form.response_to_treatment]; n[i] = { ...n[i], before: e.target.value }; set('response_to_treatment', n);
                            }} />
                        </td>
                        <td className="border border-gray-200 p-1">
                          <input className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-teal-400 outline-none"
                            value={r.after} onChange={e => {
                              const n = [...form.response_to_treatment]; n[i] = { ...n[i], after: e.target.value }; set('response_to_treatment', n);
                            }} />
                        </td>
                        <td className="border border-gray-200 p-1 text-center">
                          <button onClick={() => {
                            if (form.response_to_treatment.length === 1) return;
                            const n = [...form.response_to_treatment]; n.splice(i, 1); set('response_to_treatment', n);
                          }} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => set('response_to_treatment', [...form.response_to_treatment, { parameter: '', before: '', after: '' }])}
                  className="mt-2 text-teal-600 text-sm flex items-center gap-1 hover:text-teal-800">
                  <Plus className="w-3 h-3" /> Add Row
                </button>
              </div>

              <ListEditor label="Summary at Discharge" items={form.summary_at_discharge}
                onChange={v => set('summary_at_discharge', v)}
                placeholder="e.g. The patient demonstrated significant improvement in overall energy" />
            </div>
          )}

          {/* ── DISCHARGE ADVICE ── */}
          {activeSection === 'discharge' && (
            <div className="space-y-6">
              <MedicineTable
                label="Advise on Discharge — Internal Medicines"
                items={form.discharge_internal_medicines}
                onChange={v => set('discharge_internal_medicines', v)}
              />

              {form.discharge_internal_medicines.filter(r => r.item_name).length > 0 && (
                <button
                  onClick={() => setShowMedicineInvoice(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-sm font-medium hover:bg-teal-100"
                >
                  <Receipt className="w-4 h-4" /> Generate Medicine Invoice from Discharge Advice
                </button>
              )}

              <ListEditor label="Advise on Discharge — External Treatments" items={form.discharge_external_treatments}
                onChange={v => set('discharge_external_treatments', v)}
                placeholder="e.g. Continue Abhyangam at home with sesame oil" />

              <div className="grid grid-cols-2 gap-6">
                <ListEditor label="Pathya — Do's" items={form.pathya_dos}
                  onChange={v => set('pathya_dos', v)} placeholder="e.g. Drink lukewarm water" />
                <ListEditor label="Apathya — Don'ts" items={form.apathya_donts}
                  onChange={v => set('apathya_donts', v)} placeholder="e.g. Avoid fried, oily, cold, salty food" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Life Style Modification</label>
                <textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                  value={form.lifestyle_modification} onChange={e => set('lifestyle_modification', e.target.value)}
                  placeholder="• Continue morning oil massage (Abhyanga) with warm oil followed by a warm-water bath.&#10;• Regular walking 20–30 minutes daily." />
              </div>
            </div>
          )}

          {/* ── FOLLOW-UP ── */}
          {activeSection === 'followup' && (
            <div className="space-y-5">

              {/* Next Review smart selector */}
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-4">
                <h3 className="font-bold text-teal-800 text-sm">📅 Next Review / Follow-Up</h3>

                {/* Quick-select buttons */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Quick select days after discharge</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '1 Week', days: 7 },
                      { label: '2 Weeks', days: 14 },
                      { label: '1 Month', days: 30 },
                      { label: '6 Weeks', days: 42 },
                      { label: '2 Months', days: 60 },
                      { label: '3 Months', days: 90 },
                    ].map(({ label, days }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => { set('next_review', label); set('next_review_days', days); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.next_review === label ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom days input */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Custom (type number of days)</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 21"
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                        onChange={e => {
                          const days = parseInt(e.target.value);
                          if (!days) return;
                          set('next_review', `${days} days`);
                          set('next_review_days', days);
                        }}
                      />
                      <span className="text-sm text-gray-500">days after discharge</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Or pick a specific date</label>
                    <input
                      type="date"
                      value={form.next_review_date}
                      onChange={e => setForm(prev => ({ ...prev, next_review_date: e.target.value, next_review_days: null }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                </div>

                {/* Resolved date display */}
                {form.next_review_date && (
                  <div className="bg-white border border-teal-300 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Follow-up appointment will be scheduled for</p>
                      <p className="font-bold text-teal-700 text-base">
                        {new Date(form.next_review_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      {form.doctor_in_charge && form.doctor_in_charge !== '__manual__' && (
                        <p className="text-xs text-gray-500 mt-0.5">with {withDrPrefix(form.doctor_in_charge)}</p>
                      )}
                    </div>
                    <div className="text-3xl">📅</div>
                  </div>
                )}
                {form.next_review_date && (
                  <p className="text-xs text-teal-700 bg-teal-100 rounded-lg px-3 py-2">
                    ✅ When you save this discharge summary, a follow-up appointment will automatically appear in the <strong>Scheduling</strong> section.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Review Procedure</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    value={form.review_procedure} onChange={e => set('review_procedure', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Prognosis</label>
                <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                  value={form.prognosis} onChange={e => set('prognosis', e.target.value)}
                  placeholder="e.g. Improved and stable. Continue medicines and follow lifestyle advice." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Remarks</label>
                <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                  value={form.remarks} onChange={e => set('remarks', e.target.value)}
                  placeholder="e.g. The integrated Ayurvedic management — KASHAYAVASTHI demonstrated excellent results in controlling pain." />
              </div>
            </div>
          )}

          {/* ── Daily Progress Tab (IP only) ── */}
          {activeSection === 'progress' && (
            <div className="space-y-4">
              {loadingProgress ? (
                <div className="text-center py-8 text-gray-400">Loading daily records…</div>
              ) : dailyProgress.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="font-medium">No daily progress records found.</p>
                  <p className="text-sm mt-1">Add them from Patient Portal → Daily Progress button.</p>
                </div>
              ) : (
                <>
                  <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-800">
                    ✅ {dailyProgress.length} daily records found. Treatment and medicines have been auto-populated into the Summary tabs.
                  </div>
                  <div className="space-y-3">
                    {dailyProgress.map((entry, i) => (
                      <div key={entry.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                          <span className="font-semibold text-gray-800 text-sm">
                            Day {i + 1} — {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <div className="flex gap-2 text-xs">
                            {entry.bp_morning && <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full">BP: {entry.bp_morning}</span>}
                            {entry.temperature && <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">🌡 {entry.temperature}</span>}
                            {entry.pulse && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Pulse: {entry.pulse}</span>}
                          </div>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
                          {entry.treatment_performed && (
                            <div className="col-span-2">
                              <p className="text-xs font-semibold text-gray-500 mb-0.5">Treatment</p>
                              <p className="text-gray-800">{entry.treatment_performed}</p>
                            </div>
                          )}
                          {entry.medicines_given && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-0.5">Medicines</p>
                              <p className="text-gray-800">{entry.medicines_given}</p>
                            </div>
                          )}
                          {entry.diet && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-0.5">Diet</p>
                              <p className="text-gray-800">{entry.diet}</p>
                            </div>
                          )}
                          {entry.doctors_notes && (
                            <div className="col-span-2">
                              <p className="text-xs font-semibold text-gray-500 mb-0.5">Doctor's Notes</p>
                              <p className="text-gray-800">{entry.doctors_notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex-shrink-0 border-t border-gray-200 px-6 py-3 bg-gray-50 rounded-b-xl flex justify-between items-center text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useLetterhead}
                onChange={e => setUseLetterhead(e.target.checked)}
                className="w-4 h-4 accent-teal-600"
              />
              Print on letterhead <span className="text-gray-400">(skips logo/contact header, page 1 only — pages 2+ print normally)</span>
            </label>
            <div className="flex items-center bg-gray-200 rounded-lg p-0.5 text-xs font-medium" title="Paper size for printing">
              {['A4', 'A5'].map(size => (
                <button
                  key={size}
                  onClick={() => setPrintPageSize(size)}
                  className={`px-2.5 py-1.5 rounded-md transition-colors ${printPageSize === size ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
              <Printer className="w-4 h-4" /> Print Discharge Summary
            </button>
          </div>
        </div>
      </div>

      {showMedicineInvoice && (
        <MedicineSaleModal
          // MedicineSaleModal shows its own print preview after saving and
          // calls onClose only once that's dismissed — closing here too
          // would unmount it (and the still-unprinted preview) immediately.
          onClose={() => setShowMedicineInvoice(false)}
          initialCustomer={{
            customer_name: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
            mrd_number: form.mrd_no || patient?.mrd_number || patient?.patient_number || '',
            phone: patient?.phone || '',
            patientId: patient?.firebaseId || patient?.id || null,
            assignedDoctor: form.doctor_in_charge && form.doctor_in_charge !== '__manual__' ? form.doctor_in_charge : '',
          }}
          initialMedicineNames={form.discharge_internal_medicines.filter(r => r.item_name).map(r => r.item_name)}
        />
      )}
    </div>

    {/* Print Preview — in-page iframe, printed via its own contentWindow,
        rather than a popup window (see printPreviewHtml state above). */}
    {printPreviewHtml && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col">
          <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
            <div>
              <h2 className="text-xl font-bold">Print Preview</h2>
              <p className="text-teal-100 text-sm">{patient?.first_name} {patient?.last_name} · {printPageSize} paper</p>
            </div>
            <button onClick={() => setPrintPreviewHtml(null)} className="hover:bg-teal-700 p-2 rounded">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-end bg-gray-50">
            <button
              onClick={handlePrintFromPreview}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-gray-200 p-6 flex justify-center">
            <iframe
              ref={printIframeRef}
              title="Discharge summary print preview"
              srcDoc={printPreviewHtml}
              // Matches the old popup's auto-print-on-open behavior.
              onLoad={handlePrintFromPreview}
              className="bg-white shadow-lg"
              style={printPageSize === 'A5'
                ? { width: '559px', minHeight: '794px', border: 'none' }
                : { width: '794px', minHeight: '1123px', border: 'none' }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default DischargeSummaryModal;
