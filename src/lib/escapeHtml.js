// Escapes a value for safe interpolation into HTML text or a quoted
// attribute. Every print template builds its markup with template strings,
// so any user-entered text (patient names, complaints, notes, item names…)
// must pass through this — otherwise "Pain <L4/L5>" loses its text in the
// printout and a crafted value could run script inside the print preview.
// null/undefined print as an empty string rather than "null"/"undefined".
export const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Escapes and keeps line breaks, for multi-line free text (notes, history).
export const escapeHtmlMultiline = (value) => escapeHtml(value).replace(/\r?\n/g, '<br>');

// Returns a shallow copy of a record with every top-level string escaped and
// null turned into '' — for print builders that interpolate dozens of form
// fields, so they can escape their inputs once at the top instead of at each
// ${...}. Nested arrays/objects (e.g. medicine_items) are left as-is: the
// helpers that render them escape their own fields.
export const escapeFields = (obj) => {
  if (!obj || typeof obj !== 'object') return obj || {};
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  Object.keys(out).forEach(k => {
    const v = out[k];
    if (typeof v === 'string') out[k] = escapeHtml(v);
    else if (v === null) out[k] = '';
  });
  return out;
};

// Like escapeFields, but walks into plain nested objects and arrays too (for
// records such as the discharge summary form, whose lists and sub-sections
// are interpolated directly). Non-plain objects (Dates, Firestore Timestamps)
// are passed through untouched. Don't hand its output to a helper that
// escapes again (e.g. buildMedicineItemsTableHTML) — pass that the raw data.
export const escapeDeep = (value) => {
  if (typeof value === 'string') return escapeHtml(value);
  if (value === null) return '';
  if (Array.isArray(value)) return value.map(escapeDeep);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    Object.keys(value).forEach(k => { out[k] = escapeDeep(value[k]); });
    return out;
  }
  return value;
};

export default escapeHtml;
