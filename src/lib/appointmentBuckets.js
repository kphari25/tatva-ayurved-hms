import { Stethoscope, Leaf, CalendarClock } from 'lucide-react';

// Appointment views across the app (Dashboard, Scheduling) are organized into
// three fixed buckets. Real appointment "type" text is free-form (booked via
// Patient Portal's dropdown, typed in on a phone call-in, or logged from
// Scheduling) — e.g. "PANCHAKARMA SESSION", "PODIKIZHI", "REVIEW CONSULTA",
// "FOLLOW UP" — so every appointment is sorted into a bucket by keyword
// rather than exact match, with Ayurvedic Therapy as the catch-all so
// nothing is ever hidden.
export const APPOINTMENT_BUCKETS = ['Consultation', 'Ayurvedic Therapy', 'Follow Up'];

// Fixed options for the Dashboard's "Add Appointment" Type dropdown. Kept
// separate from APPOINTMENT_BUCKETS above (the display grouping) since
// "Therapy"/"OP"/"IP" all still fall into the Ayurvedic Therapy bucket via
// the keyword matching below — this list is only about what front desk is
// allowed to pick when booking, not how it's later displayed.
export const APPOINTMENT_TYPE_OPTIONS = ['Consultation', 'Therapy', 'Follow up', 'OP', 'IP'];

export const bucketForAppointment = (apt) => {
  const t = (apt.type || '').toLowerCase();
  if (t.includes('consult')) return 'Consultation';
  if (t.includes('follow')) return 'Follow Up';
  return 'Ayurvedic Therapy';
};

export const APPOINTMENT_TYPE_COLORS = {
  'Consultation': {
    icon: Stethoscope, gradient: 'from-blue-400 to-blue-500',
    border: 'border-blue-400', bg: 'bg-blue-50', time: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-400',
  },
  'Ayurvedic Therapy': {
    icon: Leaf, gradient: 'from-emerald-400 to-emerald-500',
    border: 'border-emerald-400', bg: 'bg-emerald-50', time: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-400',
  },
  'Follow Up': {
    icon: CalendarClock, gradient: 'from-amber-400 to-amber-500',
    border: 'border-amber-400', bg: 'bg-amber-50', time: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-400',
  },
};

export const DEFAULT_APPOINTMENT_COLOR = { border: 'border-gray-300', bg: 'bg-gray-50', time: 'text-gray-700', badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' };

export const colorForAppointment = (apt) => APPOINTMENT_TYPE_COLORS[bucketForAppointment(apt)] || DEFAULT_APPOINTMENT_COLOR;
