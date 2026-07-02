import React, { useState, useEffect } from 'react';
import { Calendar, Plus, X, Trash2, Pencil, ChevronLeft, ChevronRight, Clock, User, LayoutGrid, List } from 'lucide-react';
import { collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const STATUS_OPTIONS = ['scheduled', 'in-progress', 'completed', 'cancelled'];

const STATUS_STYLES = {
  scheduled: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

const todayISO = () => new Date().toISOString().split('T')[0];

// ─── Appointment Modal ────────────────────────────────────────────────────────
const AppointmentModal = ({ initialData, onClose, onSave, saving, therapists, doctors }) => {
  const [formData, setFormData] = useState(
    initialData || { patient: '', time: '', type: '', date: todayISO(), status: 'scheduled', therapistId: '', therapistName: '', doctorId: '', doctorName: '' }
  );
  const [error, setError] = useState('');

  const handleTherapistChange = (e) => {
    const selected = therapists.find(t => t.id === e.target.value);
    setFormData({
      ...formData,
      therapistId: selected ? selected.id : '',
      therapistName: selected ? selected.name : '',
    });
  };

  const handleDoctorChange = (e) => {
    const selected = doctors.find(d => d.id === e.target.value);
    setFormData({
      ...formData,
      doctorId: selected ? selected.id : '',
      doctorName: selected ? selected.name : '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.patient.trim() || !formData.time || !formData.date) {
      setError('Patient name, date, and time are required.');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">
            {initialData ? 'Edit Appointment' : 'Add Appointment'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
            <input
              type="text"
              value={formData.patient}
              onChange={(e) => setFormData({ ...formData, patient: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Anjali Menon"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
            <input
              type="text"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Consultation, Panchakarma Session"
            />
          </div>

          {/* Doctor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🩺 Doctor</label>
            <select
              value={formData.doctorId}
              onChange={handleDoctorChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— No Doctor Assigned —</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.designation ? ` (${d.designation})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Therapist */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">👤 Assign Therapist</label>
            <select
              value={formData.therapistId}
              onChange={handleTherapistChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Unassigned —</option>
              {therapists.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Day Detail Popup (from calendar cell click) ──────────────────────────────
const DayDetailPopup = ({ date, therapist, appointments, onClose }) => {
  const formatted = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b bg-purple-600 rounded-t-xl">
          <div>
            <p className="font-bold text-white">{therapist.name}</p>
            <p className="text-purple-200 text-sm">{formatted}</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-purple-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {appointments.length === 0 ? (
            <p className="text-center text-gray-500 py-6">No appointments — therapist is free</p>
          ) : (
            appointments.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                <span className="text-blue-600 font-bold text-sm w-14 shrink-0">{a.time}</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{a.patient}</p>
                  <p className="text-xs text-gray-500">{a.type}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[a.status] || STATUS_STYLES.scheduled}`}>
                    {a.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Weekly Therapist Grid ────────────────────────────────────────────────────
const TIME_SLOTS = Array.from({ length: 26 }, (_, i) => {
  const totalMin = 7 * 60 + i * 30;
  const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
  const m = (totalMin % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
});

const THERAPIST_COLORS = [
  'bg-purple-500', 'bg-blue-500', 'bg-pink-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500',
];

function getWeekDates(baseDate) {
  const d = new Date(baseDate + 'T00:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().split('T')[0];
  });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WeeklyGridView = ({ therapists, allAppointments, weekBase, setWeekBase, onAddAppointment }) => {
  const weekDates = getWeekDates(weekBase);
  const todayStr = todayISO();

  const shiftWeek = (dir) => {
    const d = new Date(weekBase + 'T00:00:00');
    d.setDate(d.getDate() + dir * 7);
    setWeekBase(d.toISOString().split('T')[0]);
  };

  const weekLabel = `${new Date(weekDates[0] + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(weekDates[6] + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // lookup: date → therapistId → time → appointment
  const lookup = {};
  allAppointments.forEach(a => {
    if (!lookup[a.date]) lookup[a.date] = {};
    if (!lookup[a.date][a.therapistId]) lookup[a.date][a.therapistId] = {};
    lookup[a.date][a.therapistId][a.time] = a;
  });

  const getApt = (date, therapistId, time) => lookup[date]?.[therapistId]?.[time];

  if (therapists.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">
        <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p>No therapists found. Add therapists via User Management.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => shiftWeek(-1)} className="p-1.5 rounded-lg hover:bg-indigo-500 text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-white">{weekLabel}</h2>
          <button onClick={() => shiftWeek(1)} className="p-1.5 rounded-lg hover:bg-indigo-500 text-white">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => setWeekBase(todayStr)} className="ml-2 text-xs bg-white text-indigo-700 px-3 py-1 rounded-full font-semibold hover:bg-indigo-50">
            This Week
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-white">
          {therapists.slice(0, 5).map((t, i) => (
            <span key={t.id} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded-full inline-block ${THERAPIST_COLORS[i % THERAPIST_COLORS.length]}`}></span>
              {t.name}
            </span>
          ))}
          {therapists.length > 5 && <span>+{therapists.length - 5} more</span>}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-auto max-h-[70vh]">
        <table className="border-collapse text-xs" style={{ minWidth: `${120 + weekDates.length * therapists.length * 100}px` }}>
          <thead className="sticky top-0 z-20">
            {/* Day row */}
            <tr>
              <th className="sticky left-0 z-30 bg-gray-50 border border-gray-200 px-3 py-2 text-left font-bold text-gray-700 w-20 min-w-[5rem]">
                Time
              </th>
              {weekDates.map((date, di) => {
                const isToday = date === todayStr;
                return (
                  <th
                    key={date}
                    colSpan={therapists.length}
                    className={`border border-gray-200 px-2 py-2 text-center font-bold ${isToday ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-700'}`}
                  >
                    <div className="text-xs font-normal text-gray-500">{DAY_LABELS[di]}</div>
                    <div>{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  </th>
                );
              })}
            </tr>
            {/* Therapist sub-row */}
            <tr>
              <th className="sticky left-0 z-30 bg-gray-50 border border-gray-200 px-3 py-1"></th>
              {weekDates.map((date) =>
                therapists.map((t, ti) => (
                  <th
                    key={`${date}-${t.id}`}
                    className="border border-gray-200 px-1 py-1 text-center bg-gray-50"
                    style={{ minWidth: '90px' }}
                  >
                    <span className={`inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-semibold ${THERAPIST_COLORS[ti % THERAPIST_COLORS.length]}`}>
                      {t.name.split(' ')[0]}
                    </span>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => {
              const isHour = slot.endsWith(':00');
              return (
                <tr key={slot} className={isHour ? 'border-t-2 border-gray-300' : ''}>
                  <td className={`sticky left-0 z-10 bg-white border border-gray-200 px-3 py-1 font-mono font-semibold ${isHour ? 'text-indigo-700' : 'text-gray-400'}`}>
                    {isHour ? slot : <span className="opacity-50 text-[10px]">{slot}</span>}
                  </td>
                  {weekDates.map((date) =>
                    therapists.map((t, ti) => {
                      const apt = getApt(date, t.id, slot);
                      return (
                        <td
                          key={`${date}-${t.id}-${slot}`}
                          className={`border border-gray-100 p-0.5 align-top cursor-pointer transition-colors hover:bg-indigo-50 ${apt ? '' : ''}`}
                          style={{ minWidth: '90px', height: '32px' }}
                          onClick={() => onAddAppointment()}
                          title={apt ? `${apt.patient} — ${apt.type}` : 'Click to add'}
                        >
                          {apt && (
                            <div className={`rounded px-1 py-0.5 text-white text-[10px] font-medium truncate ${THERAPIST_COLORS[ti % THERAPIST_COLORS.length]}`}>
                              <div className="font-semibold truncate">{apt.patient}</div>
                              {apt.type && <div className="opacity-80 truncate">{apt.type}</div>}
                            </div>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t flex items-center gap-6 text-sm text-gray-600">
        <span><strong>{therapists.length}</strong> therapists</span>
        <span><strong>{allAppointments.filter(a => weekDates.includes(a.date)).length}</strong> appointments this week</span>
        <button
          onClick={onAddAppointment}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" /> Add Appointment
        </button>
      </div>
    </div>
  );
};

// ─── Monthly Calendar View ────────────────────────────────────────────────────
const MonthlyCalendarView = ({ therapists, allAppointments, calendarMonth, setCalendarMonth, onAddAppointment }) => {
  const [popup, setPopup] = useState(null); // { date, therapist, appointments }

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return d.toISOString().split('T')[0];
  });

  const prevMonth = () => setCalendarMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(year, month + 1, 1));
  const goToday = () => setCalendarMonth(new Date());

  const monthLabel = calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Build lookup: date → therapistId → appointments[]
  const lookup = {};
  allAppointments.forEach(a => {
    if (!lookup[a.date]) lookup[a.date] = {};
    if (!lookup[a.date][a.therapistId]) lookup[a.date][a.therapistId] = [];
    lookup[a.date][a.therapistId].push(a);
  });

  const getCell = (date, therapistId) => lookup[date]?.[therapistId] || [];

  const todayStr = todayISO();

  // Color based on appointment count
  const cellColor = (count) => {
    if (count === 0) return 'bg-green-50 hover:bg-green-100 border-green-200';
    if (count === 1) return 'bg-yellow-50 hover:bg-yellow-100 border-yellow-300';
    if (count === 2) return 'bg-orange-50 hover:bg-orange-100 border-orange-300';
    return 'bg-red-50 hover:bg-red-100 border-red-300';
  };

  const dotColor = (count) => {
    if (count === 0) return '';
    if (count === 1) return 'bg-yellow-400';
    if (count === 2) return 'bg-orange-400';
    return 'bg-red-500';
  };

  if (therapists.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">
        <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p>No therapists found. Add therapists via User Management.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-purple-500 text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-white">{monthLabel}</h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-purple-500 text-white">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={goToday} className="ml-2 text-xs bg-white text-purple-700 px-3 py-1 rounded-full font-semibold hover:bg-purple-50">
            Today
          </button>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-white">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-300 inline-block"></span> Free</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-300 inline-block"></span> 1 session</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-300 inline-block"></span> 2 sessions</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block"></span> Busy (3+)</span>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50">
              {/* Therapist column header */}
              <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-3 py-3 text-left font-bold text-gray-700 min-w-36">
                Therapist
              </th>
              {days.map(date => {
                const d = new Date(date + 'T00:00:00');
                const isToday = date === todayStr;
                return (
                  <th
                    key={date}
                    className={`border border-gray-200 px-1 py-2 text-center font-medium min-w-10 ${isToday ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
                  >
                    <div className="font-bold">{d.getDate()}</div>
                    <div className="text-gray-400 font-normal">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {therapists.map((therapist, idx) => (
              <tr key={therapist.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                {/* Therapist name */}
                <td className="sticky left-0 z-10 border border-gray-200 px-3 py-2 font-semibold text-gray-800 bg-inherit">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs shrink-0">
                      {therapist.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="truncate max-w-24">{therapist.name}</span>
                  </div>
                </td>
                {/* Day cells */}
                {days.map(date => {
                  const apts = getCell(date, therapist.id);
                  const count = apts.length;
                  const isToday = date === todayStr;
                  return (
                    <td
                      key={date}
                      className={`border border-gray-200 p-1 text-center cursor-pointer transition-colors ${cellColor(count)} ${isToday ? 'ring-1 ring-inset ring-blue-400' : ''}`}
                      onClick={() => setPopup({ date, therapist, appointments: apts })}
                      title={count === 0 ? 'Available' : `${count} appointment${count > 1 ? 's' : ''}`}
                    >
                      {count > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`w-2 h-2 rounded-full ${dotColor(count)}`}></span>
                          <span className="font-bold text-gray-700">{count}</span>
                        </div>
                      ) : (
                        <span className="text-green-400 text-lg leading-none">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="px-6 py-3 bg-gray-50 border-t flex items-center gap-6 text-sm text-gray-600">
        <span><strong>{therapists.length}</strong> therapists</span>
        <span><strong>{daysInMonth}</strong> days in month</span>
        <span><strong>{allAppointments.filter(a => a.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).length}</strong> appointments this month</span>
        <button
          onClick={onAddAppointment}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" /> Add Appointment
        </button>
      </div>

      {/* Day detail popup */}
      {popup && (
        <DayDetailPopup
          date={popup.date}
          therapist={popup.therapist}
          appointments={popup.appointments}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AppointmentScheduling = () => {
  const [view, setView] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [weekBase, setWeekBase] = useState(todayISO());
  const [appointments, setAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);

  useEffect(() => { loadTherapists(); loadDoctors(); loadAllAppointments(); }, []);
  useEffect(() => { loadAppointments(); }, [selectedDate]);

  const loadTherapists = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'therapist')));
      setTherapists(snap.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email, ...d.data() })));
    } catch (error) {
      console.error('Error loading therapists:', error);
    }
  };

  const loadDoctors = async () => {
    try {
      const snap = await getDocs(collection(db, 'hr_employees'));
      const DOCTOR_KEYWORDS = ['doctor', 'physician', 'consultant', 'vaidya', 'surgeon', 'rmo', 'medical'];
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => {
        const haystack = `${e.department || ''} ${e.designation || ''} ${e.role || ''}`.toLowerCase();
        return DOCTOR_KEYWORDS.some(k => haystack.includes(k));
      }).map(e => ({
        id: e.id,
        name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.name || '',
        designation: e.designation || e.department || '',
      }));
      setDoctors(docs);
    } catch (error) {
      console.error('Error loading doctors:', error);
    }
  };

  const loadAllAppointments = async () => {
    try {
      const snap = await getDocs(collection(db, 'appointments'));
      setAllAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error loading all appointments:', error);
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'appointments'), where('date', '==', selectedDate)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const shiftDate = (days) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const openAddModal = () => { setEditingAppointment(null); setShowModal(true); };
  const openEditModal = (apt) => { setEditingAppointment(apt); setShowModal(true); };

  const saveAppointment = async (formData) => {
    try {
      setSaving(true);
      const payload = {
        patient: formData.patient,
        time: formData.time,
        type: formData.type,
        date: formData.date,
        status: formData.status,
        therapistId: formData.therapistId || '',
        therapistName: formData.therapistName || '',
        doctorId: formData.doctorId || '',
        doctorName: formData.doctorName || '',
      };
      if (editingAppointment) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), payload);
      } else {
        await addDoc(collection(db, 'appointments'), { ...payload, createdAt: new Date().toISOString() });
      }
      setShowModal(false);
      setEditingAppointment(null);
      await loadAllAppointments();
      if (formData.date === selectedDate) {
        await loadAppointments();
      } else {
        setSelectedDate(formData.date);
      }
    } catch (error) {
      console.error('Error saving appointment:', error);
      alert('Failed to save appointment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAppointment = async (aptId) => {
    if (!window.confirm('Remove this appointment?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', aptId));
      setAppointments(prev => prev.filter(a => a.id !== aptId));
      setAllAppointments(prev => prev.filter(a => a.id !== aptId));
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Failed to delete appointment. Please try again.');
    }
  };

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const therapistSchedule = therapists.map(t => ({
    ...t,
    appointments: appointments.filter(a => a.therapistId === t.id),
  })).filter(t => t.appointments.length > 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Scheduling</h1>
          <p className="text-gray-600">Manage patient appointments</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={() => setView('daily')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${view === 'daily' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" /> Daily
            </button>
            <button
              onClick={() => setView('weekly')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${view === 'weekly' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Calendar className="w-4 h-4" /> Weekly
            </button>
            <button
              onClick={() => setView('monthly')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${view === 'monthly' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Monthly
            </button>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Add Appointment
          </button>
        </div>
      </div>

      {/* ── Weekly Grid View ── */}
      {view === 'weekly' && (
        <WeeklyGridView
          therapists={therapists}
          allAppointments={allAppointments}
          weekBase={weekBase}
          setWeekBase={setWeekBase}
          onAddAppointment={openAddModal}
        />
      )}

      {/* ── Monthly Calendar View ── */}
      {view === 'monthly' && (
        <MonthlyCalendarView
          therapists={therapists}
          allAppointments={allAppointments}
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          onAddAppointment={openAddModal}
        />
      )}

      {/* ── Daily View ── */}
      {view === 'daily' && (
        <>
          {/* Date Navigator */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex items-center justify-between">
            <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">{formattedDate}</span>
              {selectedDate !== todayISO() && (
                <button onClick={() => setSelectedDate(todayISO())} className="text-xs text-blue-600 hover:underline ml-2">
                  Jump to today
                </button>
              )}
            </div>
            <button onClick={() => shiftDate(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Appointments List */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-white" />
                  <h2 className="text-lg font-bold text-white">Appointments</h2>
                </div>
                <span className="bg-white text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                  {appointments.length} Total
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : appointments.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No appointments scheduled for this day</p>
                  </div>
                ) : (
                  appointments.map((apt) => (
                    <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-bold text-blue-600 w-16">{apt.time}</p>
                          <div>
                            <p className="font-semibold text-gray-900">{apt.patient}</p>
                            <p className="text-sm text-gray-600">{apt.type}</p>
                            {apt.doctorName && (
                              <p className="text-xs text-teal-700 flex items-center gap-1 mt-0.5">
                                🩺 Dr. {apt.doctorName}
                              </p>
                            )}
                            {apt.therapistName && (
                              <p className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3" />
                                {apt.therapistName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[apt.status] || STATUS_STYLES.scheduled}`}>
                            {apt.status ? apt.status.charAt(0).toUpperCase() + apt.status.slice(1) : 'Scheduled'}
                          </span>
                          <button
                            onClick={() => openEditModal(apt)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit appointment"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteAppointment(apt.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove appointment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Therapist Schedule Panel */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center gap-3">
                <User className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Therapist Schedule</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {therapists.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No therapists found. Add therapists via User Management.
                  </div>
                ) : (
                  therapists.map(t => {
                    const apts = appointments.filter(a => a.therapistId === t.id);
                    const isBusy = apts.length > 0;
                    return (
                      <div key={t.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isBusy ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {isBusy ? `${apts.length} session${apts.length !== 1 ? 's' : ''}` : 'Available'}
                          </span>
                        </div>
                        {apts.length > 0 && (
                          <div className="space-y-1">
                            {apts.map(a => (
                              <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600">
                                <span className="font-medium text-blue-600 w-12">{a.time}</span>
                                <span className="truncate">{a.patient}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <AppointmentModal
          initialData={editingAppointment}
          onClose={() => { setShowModal(false); setEditingAppointment(null); }}
          onSave={saveAppointment}
          saving={saving}
          therapists={therapists}
          doctors={doctors}
        />
      )}
    </div>
  );
};

export default AppointmentScheduling;
