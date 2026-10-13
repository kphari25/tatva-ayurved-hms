// Appointments store a start `time` ("HH:MM") and, when entered, a
// `duration_minutes`. Older ones have no duration, so fall back by type:
// therapy sessions run longer than consultations / follow-ups.
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

export const defaultDurationFor = (type) => {
  const t = (type || '').toLowerCase();
  if (t.includes('consult') || t.includes('follow')) return 30;
  return 60;
};

export const durationOf = (apt) => {
  const d = Number(apt?.duration_minutes);
  return d > 0 ? d : defaultDurationFor(apt?.type);
};

// "HH:MM" -> minutes since midnight, or null if missing/invalid
export const toMinutes = (time) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export const fmtClock = (mins) => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const fmtSpan = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
};
