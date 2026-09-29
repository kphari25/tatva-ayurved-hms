// Carrying a patient's OP Case Sheet into their IP Case Sheet when they convert
// from out-patient to in-patient. Both sheets are keyed by the patient's doc id
// (op_case_sheets/{id} and ip_case_sheets/{id}), but their fields differ — so
// this maps each OP field to the closest IP field, and IPCaseSheetModal lets
// the doctor review the result before anything is applied.
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const has = (v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '');

// Personal-history "menstrual" fields are spread over 8 OP fields but a single
// free-text IP field.
const menstrualSummary = (op) => {
  const parts = [
    ['Cycle', op.cycle], ['Flow', op.flow], ['Duration', op.duration], ['Interval', op.interval],
    ['Amount', op.amount], ['Clots', op.clots], ['Pain', op.pain], ['Others', op.menstrual_others],
  ].filter(([, v]) => has(v)).map(([l, v]) => `${l}: ${v}`);
  return parts.join('; ');
};

// tab = the IP Case Sheet tab the field lives on. defaultOn = ticked by default
// in the review dialog. Vitals are off by default: they were measured at the
// OP visit, so they're usually stale by the time the patient is admitted.
// { from: OP field name, to: IP field name, label, tab, section, defaultOn?, value? }
const MAPPINGS = [
  { section: 'Demographics', tab: 'sheet', from: 's_d_w_o', to: 'father_husband_name', label: 'Father / Husband Name' },
  { section: 'Demographics', tab: 'sheet', from: 'religion', to: 'religion', label: 'Religion' },
  { section: 'Demographics', tab: 'sheet', from: 'occupation', to: 'occupation', label: 'Occupation' },
  { section: 'Demographics', tab: 'sheet', from: 'marital_status', to: 'marital_status', label: 'Marital Status' },
  { section: 'Demographics', tab: 'sheet', from: 'department', to: 'department', label: 'Department' },
  { section: 'Presenting complaints', tab: 'sheet', from: 'presenting_complaints', to: 'roopam', label: 'Roopam (Presenting Complaints)' },
  { section: 'Presenting complaints', tab: 'sheet', value: (op) => op.diagnosis || op.provisional_diagnosis, to: 'admin_diagnosis', label: 'Diagnosis' },

  { section: 'History', tab: 'history', from: 'history_present_illness', to: 'history_presenting_complaints', label: 'History of Presenting Complaints' },
  { section: 'History', tab: 'history', from: 'history_previous_illness', to: 'history_past_illness', label: 'History of Past Illness' },
  { section: 'History', tab: 'history', from: 'family_history', to: 'family_history', label: 'Family History' },
  { section: 'History', tab: 'history', from: 'medication_details', to: 'medication_details', label: 'Medication Details' },
  { section: 'History', tab: 'history', from: 'treatment_details', to: 'treatment_details', label: 'Treatment Details' },

  { section: 'Personal history', tab: 'history', from: 'diet', to: 'diet', label: 'Diet' },
  { section: 'Personal history', tab: 'history', from: 'appetite', to: 'appetite', label: 'Appetite' },
  { section: 'Personal history', tab: 'history', from: 'bowel_habits', to: 'bowel', label: 'Bowel' },
  { section: 'Personal history', tab: 'history', from: 'micturition', to: 'micturition', label: 'Micturition' },
  { section: 'Personal history', tab: 'history', from: 'sleep', to: 'sleep', label: 'Sleep' },
  { section: 'Personal history', tab: 'history', from: 'known_addictions', to: 'habits_addiction', label: 'Habits / Addiction' },
  { section: 'Personal history', tab: 'history', from: 'known_allergies', to: 'hypersensitivity', label: 'Hypersensitivity (Allergies)' },
  { section: 'Personal history', tab: 'history', value: menstrualSummary, to: 'menstrual_history', label: 'Menstrual History' },

  { section: 'Examination', tab: 'history', from: 'systemic_examination', to: 'cvs_cns_rs_ls', label: 'CVS / CNS / RS / LS' },
  { section: 'Examination', tab: 'history', from: 'dm', to: 'dm', label: 'DM' },
  { section: 'Examination', tab: 'history', from: 'htn', to: 'htn', label: 'HTN' },
  { section: 'Examination', tab: 'history', from: 'ihd', to: 'ihd', label: 'IHD' },
  { section: 'Examination', tab: 'history', from: 'hyperlipidemia', to: 'hyperlipidemia', label: 'Hyperlipidemia' },

  { section: 'Dasa Vidha Pareeksha', tab: 'history', from: 'prakrithi', to: 'prakruti', label: 'Prakruti' },
  { section: 'Dasa Vidha Pareeksha', tab: 'history', from: 'vayah', to: 'vayah', label: 'Vayah' },
  { section: 'Dasa Vidha Pareeksha', tab: 'history', from: 'satvam', to: 'satwa', label: 'Satwa' },
  { section: 'Dasa Vidha Pareeksha', tab: 'history', from: 'satmyam', to: 'satmya', label: 'Satmya' },
  { section: 'Dasa Vidha Pareeksha', tab: 'history', from: 'dushyam', to: 'dooshya', label: 'Dooshya' },
  { section: 'Dasa Vidha Pareeksha', tab: 'history', from: 'kalam', to: 'kala', label: 'Kala' },
  { section: 'Dasa Vidha Pareeksha', tab: 'history', from: 'srotas', to: 'srotas_involved', label: 'Srotas Involved' },

  { section: 'Investigations', tab: 'investigations', from: 'investigations', to: 'investigations', label: 'Investigations' },
  { section: 'Investigations', tab: 'investigations', from: 'investigation_attachments', to: 'investigation_attachments', label: 'Investigation Attachments', kind: 'attachments' },

  { section: 'Vitals (measured at the OP visit)', tab: 'history', from: 'pulse', to: 'pulse', label: 'Pulse', defaultOn: false },
  { section: 'Vitals (measured at the OP visit)', tab: 'history', from: 'bp', to: 'bp', label: 'BP', defaultOn: false },
  { section: 'Vitals (measured at the OP visit)', tab: 'history', from: 'temperature', to: 'temperature', label: 'Temperature', defaultOn: false },
  { section: 'Vitals (measured at the OP visit)', tab: 'history', from: 'height', to: 'height', label: 'Height (cm)', defaultOn: false },
  { section: 'Vitals (measured at the OP visit)', tab: 'history', from: 'weight', to: 'weight', label: 'Weight (kg)', defaultOn: false },
];

// Filled-in OP fields with no equivalent on the IP sheet — surfaced in the
// review dialog so the doctor knows to re-enter them by hand if they matter,
// instead of them silently vanishing.
const UNMAPPED = [
  ['informant', 'Informant'], ['socio_economic_status', 'Socio-Economic Status'],
  ['thyroid_dysfunction', 'Thyroid Dysfunction'], ['comorbidity_other_value', 'Other Comorbidity'],
  ['pain_assessment', 'Pain Assessment'], ['immunization_history', 'Immunization History'],
  ['consciousness', 'Consciousness'], ['orientation', 'Orientation'], ['mobility', 'Mobility'],
  ['vikrithi', 'Vikrithi'], ['sara', 'Sara'], ['samhanana', 'Samhanana'], ['pramana', 'Pramana'],
  ['aharasakthi', 'Aharasakthi'], ['vyayamasakthi', 'Vyayamasakthi'], ['dosham', 'Dosham'], ['agni', 'Agni'],
];

export const IP_KEYS_FROM_OP = new Set(MAPPINGS.map(m => m.to));

export const loadOPCaseSheet = async (patientId) => {
  if (!patientId) return null;
  const snap = await getDoc(doc(db, 'op_case_sheets', patientId));
  return snap.exists() ? snap.data() : null;
};

// Returns { items, unmapped } for an OP sheet. Each item is one candidate
// IP field: { key (IP field), label, section, tab, kind, value, defaultOn }.
export const buildOPImportItems = (op) => {
  if (!op) return { items: [], unmapped: [] };
  const items = MAPPINGS.map(m => {
    const raw = m.value ? m.value(op) : op[m.from];
    return { ...m, key: m.to, kind: m.kind || 'text', value: raw, defaultOn: m.defaultOn !== false };
  }).filter(m => has(m.value));
  const unmapped = UNMAPPED.filter(([k]) => has(op[k])).map(([k, label]) => ({ label, value: op[k] }));
  return { items, unmapped };
};

// Where an item would land relative to what's already on the IP sheet.
// 'empty' → safe to fill; 'same' → nothing to do; 'conflict' → IP already has
// something different (never overwritten unless the user ticks it).
export const compareWithForm = (item, form) => {
  const current = form[item.key];
  if (item.kind === 'attachments') {
    const known = new Set((current || []).map(a => a.url));
    return (item.value || []).every(a => known.has(a.url)) ? 'same' : ((current || []).length ? 'conflict' : 'empty');
  }
  if (!has(current)) return 'empty';
  return String(current).trim() === String(item.value).trim() ? 'same' : 'conflict';
};

// Applies the chosen items to a form. How a 'conflict' resolves is decided by
// the caller's per-item mode: 'replace' overwrites; 'append' keeps what's
// already there and adds the OP text beneath it (attachments always merge).
export const applyOPImport = (form, chosen) => {
  const next = { ...form };
  chosen.forEach(({ item, mode }) => {
    if (item.kind === 'attachments') {
      const known = new Set((form[item.key] || []).map(a => a.url));
      next[item.key] = [...(form[item.key] || []), ...item.value.filter(a => !known.has(a.url))];
    } else if (mode === 'append' && has(form[item.key])) {
      next[item.key] = `${String(form[item.key]).trim()}\n${item.value}`;
    } else {
      next[item.key] = item.value;
    }
  });
  return next;
};
