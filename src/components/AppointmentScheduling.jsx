import React, { useState, useEffect } from 'react';
import { Calendar, Plus, X, Trash2, Pencil, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
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

const AppointmentModal = ({ initialData, onClose, onSave, saving, therapists }) => {
  const [formData, setFormData] = useState(
    initialData || { patient: '', time: '', type: '', date: todayISO(), status: 'scheduled', therapistId: '', therapistName: '' }
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Therapist</label>
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

const AppointmentScheduling = () => {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [appointments, setAppointments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);

  useEffect(() => {
    loadTherapists();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [selectedDate]);

  const loadTherapists = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'therapist'))
      );
      setTherapists(snap.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email, ...d.data() })));
    } catch (error) {
      console.error('Error loading therapists:', error);
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'appointments'), where('date', '==', selectedDate))
      );
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
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

  const openAddModal = () => {
    setEditingAppointment(null);
    setShowModal(true);
  };

  const openEditModal = (apt) => {
    setEditingAppointment(apt);
    setShowModal(true);
  };

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
      };
      if (editingAppointment) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), payload);
      } else {
        await addDoc(collection(db, 'appointments'), { ...payload, createdAt: new Date().toISOString() });
      }
      setShowModal(false);
      setEditingAppointment(null);
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
      setAppointments((prev) => prev.filter((a) => a.id !== aptId));
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Failed to delete appointment. Please try again.');
    }
  };

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Group appointments by therapist for the schedule view
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
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Appointment
        </button>
      </div>

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
            ) : therapistSchedule.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No therapist assignments for this day.
              </div>
            ) : (
              therapistSchedule.map(t => (
                <div key={t.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {t.appointments.length} session{t.appointments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {t.appointments.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="font-medium text-blue-600 w-12">{a.time}</span>
                        <span className="truncate">{a.patient}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <AppointmentModal
          initialData={editingAppointment}
          onClose={() => { setShowModal(false); setEditingAppointment(null); }}
          onSave={saveAppointment}
          saving={saving}
          therapists={therapists}
        />
      )}
    </div>
  );
};

export default AppointmentScheduling;
