// Shared logic for the Patient Reports and Patients-by-Doctor reports.
//
// A patient is "seen" in a date range when they are either
//   New    — first registered inside the range, or
//   Return — registered before the range but visited inside it
//            (a returning check-in / last visit, an admission, or a
//            checked-in appointment).
// Each patient counts once, whatever the number of visits.
// The system only keeps a patient's LATEST visit date (last_visit_date), so
// Return counts for older periods can under-count patients who have visited
// again since — checked-in appointments are the only per-visit history.

export const PATIENT_CATEGORIES = ['General', 'PNC'];

// PNC patients are found two ways: an explicit Patient Category of "PNC", or
// a diagnosis (case sheet / discharge summary) mentioning PNC or post natal.
const PNC_TEXT = /\bpnc\b|post[\s-]?natal/i;

// "YYYY-MM-DD" strings must be parsed as local dates (new Date(str) is UTC).
export const parseDate = (v) => {
  if (!v) return null;
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return isNaN(d) ? null : d;
};

const inRange = (v, start, end) => {
  const d = parseDate(v);
  return !!d && d >= start && d <= end;
};

const norm = (s) => String(s || '').replace(/^dr\.?\s*/i, '').trim();
export const UNASSIGNED = 'Unassigned';

// Name parts for matching: lowercase, no title/punctuation, no initials.
const nameTokens = (s) => norm(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);

const editDistance = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};

const sameToken = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && editDistance(a, b) <= 1);

// Same person if every name part of the shorter name appears (allowing a
// one-letter typo) in the longer one — "Dr. Satheesh" / "Dr. C . Satheesh
// Kumar" / "Dr. Satheesh Kumar", or "Dr. shruthi" / "Dr. Sruthi Muralidharan".
const sameDoctor = (a, b) => {
  const ta = nameTokens(a), tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.every(t => long.some(u => sameToken(t, u)));
};

const tidy = (name) => norm(name).replace(/\s+\./g, '.').replace(/\.(?=\S)/g, '. ').replace(/\s+/g, ' ');

// Canonical doctor label — a stored name is matched against the HR/user
// doctor list by name parts, so one doctor isn't split across spellings.
// If a short name fits more than one doctor it is left as typed.
export const doctorLabel = (assigned, doctors = []) => {
  const raw = norm(assigned);
  if (!raw) return UNASSIGNED;
  const matches = doctors.filter(d => sameDoctor(assigned, d.name));
  if (matches.length === 1) return `Dr. ${tidy(matches[0].name)}`;
  return `Dr. ${tidy(raw)}`;
};

const diagnosisTexts = (p, ctx) => {
  const op = ctx.opSheets[p.id] || {};
  const ip = ctx.ipSheets[p.id] || {};
  const summaries = ctx.summariesByPatient[p.id] || [];
  return [
    p.diagnosis, p.provisional_diagnosis,
    op.provisional_diagnosis, op.diagnosis,
    ip.admin_diagnosis, ip.ayurvedic_diagnosis,
    ...summaries.flatMap(s => [s.provisional_diagnosis, s.diagnosis]),
  ].filter(Boolean);
};

export const isPNC = (p, ctx) => {
  if (p.patient_category === 'PNC') return 'category';
  if (diagnosisTexts(p, ctx).some(t => PNC_TEXT.test(String(t)))) return 'diagnosis';
  return '';
};

export const buildContext = ({ appointments = [], opSheets = [], ipSheets = [], summaries = [], doctors = [] }) => {
  const byId = (list) => Object.fromEntries(list.map(d => [d.id, d]));
  const summariesByPatient = {};
  summaries.forEach(s => { if (s.patient_id) (summariesByPatient[s.patient_id] = summariesByPatient[s.patient_id] || []).push(s); });
  return { appointments, opSheets: byId(opSheets), ipSheets: byId(ipSheets), summariesByPatient, doctors };
};

// One row per patient seen in [start, end].
export const classifyPatients = (patients, ctx, start, end) => {
  const checkedIn = new Set();
  ctx.appointments.forEach(a => {
    if (a.patient_id && a.status === 'checked_in' && inRange(a.checked_in_at, start, end)) checkedIn.add(a.patient_id);
  });

  const rows = [];
  patients.forEach(p => {
    const created = parseDate(p.created_at);
    const isNew = !!created && created >= start && created <= end;
    const visited = inRange(p.last_visit_date, start, end) || inRange(p.admission_date, start, end) || checkedIn.has(p.id);
    if (!isNew && !visited) return;
    // A patient registered after the range can't have been seen in it.
    if (!isNew && created && created > end) return;

    const pncSource = isPNC(p, ctx);
    rows.push({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed',
      mrd: p.mrd_number || p.patient_number || '',
      ip: p.ip_number || '',
      phone: p.phone || '',
      type: (p.patient_type || 'OP') === 'IP' ? 'IP' : 'OP',
      kind: isNew ? 'New' : 'Return',
      category: p.patient_category || 'General',
      pnc: !!pncSource,
      pncSource,
      doctor: doctorLabel(p.assigned_doctor, ctx.doctors),
      registered: created,
      lastVisit: p.last_visit_date || '',
    });
  });
  return rows.sort((a, b) => a.name.localeCompare(b.name));
};

export const summarize = (rows) => ({
  total: rows.length,
  op: rows.filter(r => r.type === 'OP').length,
  ip: rows.filter(r => r.type === 'IP').length,
  new: rows.filter(r => r.kind === 'New').length,
  returning: rows.filter(r => r.kind === 'Return').length,
  pnc: rows.filter(r => r.pnc).length,
});

// Row filters used by the clickable counts.
export const ROW_FILTERS = {
  total: () => true,
  op: r => r.type === 'OP',
  ip: r => r.type === 'IP',
  new: r => r.kind === 'New',
  returning: r => r.kind === 'Return',
  pnc: r => r.pnc,
};

export const byDoctor = (rows) => {
  const map = {};
  rows.forEach(r => {
    const d = (map[r.doctor] = map[r.doctor] || { doctor: r.doctor, rows: [] });
    d.rows.push(r);
  });
  return Object.values(map)
    .map(d => ({ doctor: d.doctor, rows: d.rows, ...summarize(d.rows) }))
    .sort((a, b) => (a.doctor === UNASSIGNED) - (b.doctor === UNASSIGNED) || b.total - a.total || a.doctor.localeCompare(b.doctor));
};
