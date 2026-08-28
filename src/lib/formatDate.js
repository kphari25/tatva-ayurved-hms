// Formats a plain YYYY-MM-DD date string (as produced by <input type="date">)
// without shifting across a day boundary. `new Date('YYYY-MM-DD')` parses the
// string as UTC midnight, which can display as the previous day in any
// timezone behind UTC — this constructs the Date from local components instead.
export const formatDateOnly = (dateStr, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!dateStr) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return new Date(dateStr).toLocaleDateString('en-IN', options);
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-IN', options);
};

// Adds `days` to a plain YYYY-MM-DD date string and returns another
// YYYY-MM-DD string, via local Date components (see note above) rather than
// parsing the string as UTC.
export const addDaysToDateString = (dateStr, days) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return dateStr;
  const [, y, m, d] = match;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Whole days between a plain YYYY-MM-DD (or full ISO timestamp — only the
// leading date is used) and today, via local Date components (see note
// above). Returns null when dateStr is missing/unparseable, so callers can
// distinguish "0 days ago" from "unknown".
export const daysSince = (dateStr) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!match) return null;
  const [, y, m, d] = match;
  const then = new Date(Number(y), Number(m) - 1, Number(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - then) / 86400000);
};
