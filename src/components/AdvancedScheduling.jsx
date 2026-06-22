import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, Plus, User, Users, Activity,
  MapPin, Phone, Mail, Edit, Trash2, CheckCircle, X, Filter,
  ChevronLeft, ChevronRight, Search, Bed, Stethoscope, Heart, FileText, LayoutGrid
} from 'lucide-react';

const THERAPISTS = [
  { id: 't1', name: 'Therapist Maya', color: 'bg-pink-500' },
  { id: 't2', name: 'Therapist Ravi', color: 'bg-purple-500' },
  { id: 't3', name: 'Therapist Anjali', color: 'bg-blue-500' },
  { id: 't4', name: 'Therapist Deepak', color: 'bg-emerald-500' },
  { id: 't5', name: 'Therapist Kavya', color: 'bg-orange-500' },
];

const THERAPY_TYPES = [
  'Abhyanga Massage', 'Shirodhara', 'Kati Basti', 'Nasyam',
  'Pizhichil', 'Njavarakizhi', 'Udwarthanam', 'Panchakarma'
];

// Time slots from 7am to 8pm, every 30 min
const TIME_SLOTS = Array.from({ length: 26 }, (_, i) => {
  const totalMin = 7 * 60 + i * 30;
  const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
  const m = (totalMin % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
});

function getWeekDates(baseDate) {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function fmt(date) {
  return date.toISOString().split('T')[0];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Weekly Therapist Grid ────────────────────────────────────────────────────
const WeeklyTherapistGrid = ({ appointments, onCellClick, weekDates }) => {
  const today = fmt(new Date());

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 shadow-lg bg-white">
      <table className="min-w-max w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <th className="sticky left-0 z-20 bg-indigo-700 px-4 py-3 text-left font-semibold w-24 min-w-[5rem]">
              Time
            </th>
            {weekDates.map((date, di) => {
              const isToday = fmt(date) === today;
              return (
                <th
                  key={di}
                  colSpan={THERAPISTS.length}
                  className={`px-2 py-3 text-center font-semibold border-l border-indigo-500 ${isToday ? 'bg-yellow-500 text-slate-900' : ''}`}
                >
                  <div className="text-xs opacity-80">{DAY_LABELS[di]}</div>
                  <div className="text-base">
                    {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </th>
              );
            })}
          </tr>
          {/* Therapist sub-header */}
          <tr className="bg-indigo-50 border-b-2 border-indigo-200">
            <th className="sticky left-0 z-20 bg-indigo-50 px-4 py-2 text-left text-xs font-bold text-indigo-700 w-24"></th>
            {weekDates.map((date, di) =>
              THERAPISTS.map((th, ti) => (
                <th
                  key={`${di}-${ti}`}
                  className={`px-1 py-2 text-center text-xs font-semibold ${ti === 0 ? 'border-l border-indigo-200' : ''}`}
                  style={{ minWidth: '90px' }}
                >
                  <span className={`inline-block px-2 py-0.5 rounded-full text-white text-xs ${th.color}`}>
                    {th.name.replace('Therapist ', '')}
                  </span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((slot, si) => {
            const isHour = slot.endsWith(':00');
            return (
              <tr key={slot} className={`${isHour ? 'border-t-2 border-slate-300' : 'border-t border-slate-100'} hover:bg-slate-50 transition-colors`}>
                {/* Time label */}
                <td className={`sticky left-0 z-10 bg-white px-3 py-1 font-mono text-xs font-semibold ${isHour ? 'text-indigo-700' : 'text-slate-400'} border-r border-slate-200`}>
                  {isHour ? slot : <span className="opacity-50">{slot}</span>}
                </td>

                {weekDates.map((date, di) =>
                  THERAPISTS.map((therapist, ti) => {
                    const dateStr = fmt(date);
                    // Find appointment for this therapist, date, time slot
                    const apt = appointments.find(
                      a => a.type === 'therapist'
                        && a.therapistName === therapist.name
                        && a.date === dateStr
                        && a.time === slot
                    );

                    return (
                      <td
                        key={`${di}-${ti}`}
                        onClick={() => onCellClick({ date: dateStr, time: slot, therapist })}
                        className={`px-1 py-0.5 text-center align-top cursor-pointer transition-colors ${ti === 0 ? 'border-l border-slate-200' : ''} ${
                          apt ? '' : 'hover:bg-indigo-50'
                        }`}
                        style={{ minWidth: '90px', height: '36px' }}
                      >
                        {apt ? (
                          <div className={`rounded px-1 py-0.5 text-left text-white text-xs font-medium truncate ${therapist.color}`}
                            title={`${apt.patientName} — ${apt.therapyType}`}
                          >
                            <div className="font-semibold truncate">{apt.patientName}</div>
                            <div className="opacity-80 truncate text-[10px]">{apt.therapyType}</div>
                          </div>
                        ) : (
                          <span className="text-slate-200 text-xs opacity-0 group-hover:opacity-100">+</span>
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
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdvancedScheduling = ({ onClose, appointments: externalAppointments, setAppointments: setExternalAppointments, supabase }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('weekly'); // daily, weekly
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefillCell, setPrefillCell] = useState(null);

  const [appointments, setAppointmentsLocal] = useState(
    externalAppointments || [
      {
        id: '1',
        type: 'doctor',
        patientName: 'Rajesh Kumar',
        patientPhone: '9876543210',
        doctorName: 'Dr. Arjun Vaidya',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        duration: 30,
        status: 'confirmed',
        complaint: 'Joint pain follow-up',
        appointmentType: 'op'
      },
      {
        id: '2',
        type: 'therapist',
        patientName: 'Priya Sharma',
        patientPhone: '9876543211',
        therapistName: 'Therapist Maya',
        therapyType: 'Abhyanga Massage',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        duration: 60,
        status: 'confirmed',
        appointmentType: 'op'
      },
      {
        id: '3',
        type: 'therapist',
        patientName: 'Anand Patel',
        patientPhone: '9876543212',
        therapistName: 'Therapist Ravi',
        therapyType: 'Shirodhara',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        duration: 60,
        status: 'confirmed',
        appointmentType: 'ip',
        roomNumber: '101'
      },
      {
        id: '4',
        type: 'therapist',
        patientName: 'Sunita Nair',
        patientPhone: '9876543213',
        therapistName: 'Therapist Anjali',
        therapyType: 'Kati Basti',
        date: new Date().toISOString().split('T')[0],
        time: '11:30',
        duration: 45,
        status: 'confirmed',
        appointmentType: 'op'
      }
    ]
  );

  const setAppointments = (updated) => {
    setAppointmentsLocal(updated);
    if (setExternalAppointments) setExternalAppointments(updated);
  };

  const weekDates = getWeekDates(currentDate);

  const [newAppointment, setNewAppointment] = useState({
    type: 'therapist',
    patientName: '',
    patientPhone: '',
    doctorName: '',
    therapistName: '',
    therapyType: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: 60,
    complaint: '',
    appointmentType: 'op',
    roomNumber: ''
  });

  const openAddModal = (prefill = null) => {
    if (prefill) {
      setNewAppointment(prev => ({
        ...prev,
        type: 'therapist',
        therapistName: prefill.therapist.name,
        date: prefill.date,
        time: prefill.time,
      }));
      setPrefillCell(prefill);
    } else {
      setPrefillCell(null);
    }
    setShowAddModal(true);
  };

  const addAppointment = () => {
    const appointment = {
      ...newAppointment,
      id: Date.now().toString(),
      status: 'confirmed'
    };
    setAppointments([...appointments, appointment]);
    setShowAddModal(false);
    setPrefillCell(null);
    setNewAppointment({
      type: 'therapist',
      patientName: '',
      patientPhone: '',
      doctorName: '',
      therapistName: '',
      therapyType: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      duration: 60,
      complaint: '',
      appointmentType: 'op',
      roomNumber: ''
    });
  };

  const deleteAppointment = (id) => {
    setAppointments(appointments.filter(a => a.id !== id));
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === todayStr);
  const stats = {
    total: todayAppointments.length,
    doctors: todayAppointments.filter(a => a.type === 'doctor').length,
    therapists: todayAppointments.filter(a => a.type === 'therapist').length,
    ip: todayAppointments.filter(a => a.appointmentType === 'ip').length,
    op: todayAppointments.filter(a => a.appointmentType === 'op').length,
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const shiftWeek = (dir) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const shiftDay = (dir) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  // Day view appointments
  const dayStr = fmt(currentDate);
  const dayAppointments = appointments
    .filter(a => {
      if (a.date !== dayStr) return false;
      if (filterType === 'all') return true;
      if (filterType === 'doctor' || filterType === 'therapist') return a.type === filterType;
      return a.appointmentType === filterType;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
              Appointment Scheduling
            </h1>
            <p className="text-slate-500 text-sm">Manage therapist & doctor appointments</p>
          </div>
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-semibold shadow-lg"
          >
            <Plus className="w-5 h-5" />
            New Appointment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "Today's Total", value: stats.total, icon: CalendarIcon, color: 'indigo' },
          { label: 'Doctor Visits', value: stats.doctors, icon: Stethoscope, color: 'blue' },
          { label: 'Therapy Sessions', value: stats.therapists, icon: Heart, color: 'pink' },
          { label: 'Inpatient (IP)', value: stats.ip, icon: Bed, color: 'purple' },
          { label: 'Outpatient (OP)', value: stats.op, icon: Activity, color: 'emerald' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              <span className="text-2xl font-bold text-slate-800">{stat.value}</span>
            </div>
            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* View Toggle + Navigation */}
      <div className="bg-white rounded-2xl shadow border border-slate-200 p-4 mb-4 flex items-center justify-between gap-4">
        {/* View mode */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${viewMode === 'weekly' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <LayoutGrid className="w-4 h-4" />
            Weekly Grid
          </button>
          <button
            onClick={() => setViewMode('daily')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${viewMode === 'daily' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <CalendarIcon className="w-4 h-4" />
            Day List
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => viewMode === 'weekly' ? shiftWeek(-1) : shiftDay(-1)}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-bold text-slate-800 min-w-[220px] text-center">
            {viewMode === 'weekly'
              ? weekLabel
              : currentDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            }
          </span>
          <button
            onClick={() => viewMode === 'weekly' ? shiftWeek(1) : shiftDay(1)}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-semibold text-sm"
          >
            Today
          </button>
        </div>

        {/* Day-view filters */}
        {viewMode === 'daily' && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            {[
              { value: 'all', label: 'All' },
              { value: 'doctor', label: 'Doctors' },
              { value: 'therapist', label: 'Therapists' },
              { value: 'ip', label: 'IP' },
              { value: 'op', label: 'OP' }
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilterType(f.value)}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${filterType === f.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Weekly Grid View ── */}
      {viewMode === 'weekly' && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
            <Heart className="w-4 h-4 text-pink-500" />
            <span>Click any empty cell to quickly book a therapist slot. Therapist columns repeat for each day.</span>
          </div>
          <WeeklyTherapistGrid
            appointments={appointments}
            onCellClick={openAddModal}
            weekDates={weekDates}
          />
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {THERAPISTS.map(t => (
              <span key={t.id} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-semibold ${t.color}`}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Day List View ── */}
      {viewMode === 'daily' && (
        <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
          {dayAppointments.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-slate-200" />
              <p className="text-lg font-semibold">No appointments</p>
              <p className="text-sm mt-1">Click "New Appointment" to schedule one</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dayAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className={`p-5 hover:bg-slate-50 transition-all ${apt.status === 'in-progress' ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-5">
                      <div className="flex flex-col items-center min-w-[48px]">
                        <Clock className="w-4 h-4 text-indigo-500 mb-1" />
                        <span className="text-base font-bold text-slate-800">{apt.time}</span>
                        <span className="text-xs text-slate-400">{apt.duration}m</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-slate-800">{apt.patientName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${apt.type === 'doctor' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                            {apt.type === 'doctor' ? 'Doctor' : 'Therapy'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${apt.appointmentType === 'ip' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {apt.appointmentType === 'ip' ? 'IP' : 'OP'}
                          </span>
                          {apt.status === 'in-progress' && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-xs font-bold animate-pulse">● IN PROGRESS</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                          {apt.type === 'doctor' ? (
                            <>
                              <span className="flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" />{apt.doctorName}</span>
                              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{apt.complaint}</span>
                            </>
                          ) : (
                            <>
                              <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{apt.therapistName}</span>
                              <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" />{apt.therapyType}</span>
                            </>
                          )}
                          <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{apt.patientPhone}</span>
                          {apt.appointmentType === 'ip' && apt.roomNumber && (
                            <span className="flex items-center gap-1 text-purple-600 font-semibold"><Bed className="w-3.5 h-3.5" />Room {apt.roomNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => deleteAppointment(apt.id)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Appointment Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-3xl flex items-center justify-between">
              <h2 className="text-xl font-bold">Schedule New Appointment</h2>
              <button onClick={() => { setShowAddModal(false); setPrefillCell(null); }} className="p-2 hover:bg-white/20 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Appointment Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'therapist', label: 'Therapy Session', icon: Heart },
                    { value: 'doctor', label: 'Doctor Consultation', icon: Stethoscope }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setNewAppointment({ ...newAppointment, type: opt.value })}
                      className={`p-3 border-2 rounded-xl font-semibold text-sm flex items-center gap-3 transition-all ${newAppointment.type === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <opt.icon className="w-5 h-5" /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Type */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Patient Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'op', label: 'Outpatient (OP)', icon: Activity },
                    { value: 'ip', label: 'Inpatient (IP)', icon: Bed }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setNewAppointment({ ...newAppointment, appointmentType: opt.value })}
                      className={`p-3 border-2 rounded-xl font-semibold text-sm flex items-center gap-3 transition-all ${newAppointment.appointmentType === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <opt.icon className="w-5 h-5" /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Name & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Patient Name *</label>
                  <input
                    type="text"
                    value={newAppointment.patientName}
                    onChange={e => setNewAppointment({ ...newAppointment, patientName: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newAppointment.patientPhone}
                    onChange={e => setNewAppointment({ ...newAppointment, patientPhone: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                    placeholder="10-digit number"
                  />
                </div>
              </div>

              {/* Provider */}
              {newAppointment.type === 'therapist' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Therapist *</label>
                    <select
                      value={newAppointment.therapistName}
                      onChange={e => setNewAppointment({ ...newAppointment, therapistName: e.target.value })}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                    >
                      <option value="">Select therapist…</option>
                      {THERAPISTS.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Therapy Type</label>
                    <select
                      value={newAppointment.therapyType}
                      onChange={e => setNewAppointment({ ...newAppointment, therapyType: e.target.value })}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                    >
                      <option value="">Select therapy…</option>
                      {THERAPY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Doctor *</label>
                    <select
                      value={newAppointment.doctorName}
                      onChange={e => setNewAppointment({ ...newAppointment, doctorName: e.target.value })}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                    >
                      <option value="">Select doctor…</option>
                      <option value="Dr. Arjun Vaidya">Dr. Arjun Vaidya</option>
                      <option value="Dr. Priya Sharma">Dr. Priya Sharma</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Complaint</label>
                    <input
                      type="text"
                      value={newAppointment.complaint}
                      onChange={e => setNewAppointment({ ...newAppointment, complaint: e.target.value })}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Date / Time / Duration */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={newAppointment.date}
                    onChange={e => setNewAppointment({ ...newAppointment, date: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Time *</label>
                  <select
                    value={newAppointment.time}
                    onChange={e => setNewAppointment({ ...newAppointment, time: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                  >
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Duration (min)</label>
                  <select
                    value={newAppointment.duration}
                    onChange={e => setNewAppointment({ ...newAppointment, duration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                  >
                    {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>

              {newAppointment.appointmentType === 'ip' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    value={newAppointment.roomNumber}
                    onChange={e => setNewAppointment({ ...newAppointment, roomNumber: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-sm"
                    placeholder="e.g. 101"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => { setShowAddModal(false); setPrefillCell(null); }}
                className="px-5 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={addAppointment}
                disabled={!newAppointment.patientName}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-semibold shadow text-sm disabled:opacity-50"
              >
                Schedule Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedScheduling;
