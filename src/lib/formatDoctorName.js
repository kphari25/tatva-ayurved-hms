// Doctor records in hr_employees store their name with the title already
// included (e.g. "Dr. Satheesh"), since first_name/last_name are usually
// blank for these entries and the display falls back to the bare `name`
// field. Anywhere that also hardcodes a "Dr. " prefix must guard against
// doubling it up into "Dr. Dr. Satheesh" — use this instead of literal
// `Dr. ${name}` interpolation.
export const withDrPrefix = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
};
