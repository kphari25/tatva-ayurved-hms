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
