import React, { useState } from 'react';
import {
  Calendar as CalendarIcon, Clock, Plus, User, Users, Activity,
  MapPin, Phone, Mail, Edit, Trash2, CheckCircle, X, Filter,
  ChevronLeft, ChevronRight, Search, Bed, Stethoscope, Heart, FileText
} from 'lucide-react';

const AdvancedScheduling = ({ onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // day, week, month
  const [filterType, setFilterType] = useState('all'); // all, doctor, therapist, ip, op
  const [showAddModal, setShowAddModal] = useState(false);

  // Sample appointments
  const [appointments, setAppointments] = useState([
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
      appointmentType: 'op' // op or ip
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
      type: 'doctor',
      patientName: 'Anand Patel',
      patientPhone: '9876543212',
      doctorName: 'Dr. Arjun Vaidya',
      date: new Date().toISOString().split('T')[0],
      time: '11:00',
      duration: 45,
      status: 'in-progress',
      complaint: 'Panchakarma consultation',
      appointmentType: 'ip', // Inpatient
      roomNumber: '101',
      admissionDate: new Date().toISOString().split('T')[0]
    }
  ]);

  const [newAppointment, setNewAppointment] = useState({
    type: 'doctor',
    patientName: '',
    patientPhone: '',
    doctorName: '',
    therapistName: '',
    therapyType: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: 30,
    complaint: '',
    appointmentType: 'op',
    roomNumber: ''
  });

  // Filter appointments
  const filteredAppointments = appointments.filter(apt => {
    if (filterType === 'all') return true;
    if (filterType === 'doctor' || filterType === 'therapist') {
      return apt.type === filterType;
    }
    return apt.appointmentType === filterType;
  });

  // Get appointments for current date
  const todayAppointments = filteredAppointments.filter(
    apt => apt.date === currentDate.toISOString().split('T')[0]
  ).sort((a, b) => a.time.localeCompare(b.time));

  // Time slots for the day
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  const addAppointment = () => {
    const appointment = {
      ...newAppointment,
      id: Date.now().toString(),
      status: 'confirmed'
    };
    setAppointments([...appointments, appointment]);
    setShowAddModal(false);
    setNewAppointment({
      type: 'doctor',
      patientName: '',
      patientPhone: '',
      doctorName: '',
      therapistName: '',
      therapyType: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      duration: 30,
      complaint: '',
      appointmentType: 'op',
      roomNumber: ''
    });
  };

  const stats = {
    total: todayAppointments.length,
    doctors: todayAppointments.filter(a => a.type === 'doctor').length,
    therapists: todayAppointments.filter(a => a.type === 'therapist').length,
    ip: todayAppointments.filter(a => a.appointmentType === 'ip').length,
    op: todayAppointments.filter(a => a.appointmentType === 'op').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Appointment Scheduling
            </h1>
            <p className="text-slate-600">Manage doctor, therapist, IP & OP appointments</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-semibold shadow-lg"
          >
            <Plus className="w-5 h-5" />
            New Appointment
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Today', value: stats.total, icon: CalendarIcon, color: 'indigo' },
          { label: 'Doctor Visits', value: stats.doctors, icon: Stethoscope, color: 'blue' },
          { label: 'Therapy Sessions', value: stats.therapists, icon: Heart, color: 'pink' },
          { label: 'Inpatient (IP)', value: stats.ip, icon: Bed, color: 'purple' },
          { label: 'Outpatient (OP)', value: stats.op, icon: Activity, color: 'emerald' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-lg border-2 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              <span className="text-2xl font-bold text-slate-800">{stat.value}</span>
            </div>
            <p className="text-sm font-medium text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar Navigation & Filters */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-slate-800">
              {currentDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h2>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-semibold"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-slate-600" />
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'All', icon: CalendarIcon },
                { value: 'doctor', label: 'Doctors', icon: Stethoscope },
                { value: 'therapist', label: 'Therapists', icon: Heart },
                { value: 'ip', label: 'IP', icon: Bed },
                { value: 'op', label: 'OP', icon: Activity }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setFilterType(filter.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    filterType === filter.value
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <filter.icon className="w-4 h-4" />
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {todayAppointments.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <CalendarIcon className="w-20 h-20 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-semibold">No appointments scheduled</p>
            <p className="text-sm mt-2">Click "New Appointment" to schedule one</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {todayAppointments.map((apt) => (
              <div
                key={apt.id}
                className={`p-6 hover:bg-slate-50 transition-all ${
                  apt.status === 'in-progress' ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-6">
                    {/* Time */}
                    <div className="flex flex-col items-center">
                      <Clock className="w-5 h-5 text-indigo-600 mb-1" />
                      <span className="text-lg font-bold text-slate-800">{apt.time}</span>
                      <span className="text-xs text-slate-500">{apt.duration} min</span>
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-slate-800">{apt.patientName}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          apt.type === 'doctor' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                        }`}>
                          {apt.type === 'doctor' ? '🩺 Doctor' : '💆 Therapy'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          apt.appointmentType === 'ip' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {apt.appointmentType === 'ip' ? '🏥 IP' : '🚶 OP'}
                        </span>
                        {apt.status === 'in-progress' && (
                          <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold animate-pulse">
                            ● IN PROGRESS
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        {apt.type === 'doctor' ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Stethoscope className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-600">Doctor:</span>
                              <span className="font-semibold text-slate-800">{apt.doctorName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-600">Complaint:</span>
                              <span className="text-slate-800">{apt.complaint}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Heart className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-600">Therapist:</span>
                              <span className="font-semibold text-slate-800">{apt.therapistName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-600">Therapy:</span>
                              <span className="text-slate-800">{apt.therapyType}</span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">Phone:</span>
                          <span className="text-slate-800">{apt.patientPhone}</span>
                        </div>
                        {apt.appointmentType === 'ip' && (
                          <div className="flex items-center gap-2">
                            <Bed className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">Room:</span>
                            <span className="font-semibold text-purple-600">{apt.roomNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Appointment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Schedule New Appointment</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                {/* Appointment Type */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Appointment Type *</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setNewAppointment({...newAppointment, type: 'doctor'})}
                      className={`p-4 border-2 rounded-xl font-semibold transition-all ${
                        newAppointment.type === 'doctor'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Stethoscope className="w-6 h-6 mx-auto mb-2" />
                      Doctor Consultation
                    </button>
                    <button
                      onClick={() => setNewAppointment({...newAppointment, type: 'therapist'})}
                      className={`p-4 border-2 rounded-xl font-semibold transition-all ${
                        newAppointment.type === 'therapist'
                          ? 'border-pink-500 bg-pink-50 text-pink-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Heart className="w-6 h-6 mx-auto mb-2" />
                      Therapy Session
                    </button>
                  </div>
                </div>

                {/* IP/OP */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Patient Type *</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setNewAppointment({...newAppointment, appointmentType: 'op'})}
                      className={`p-4 border-2 rounded-xl font-semibold transition-all ${
                        newAppointment.appointmentType === 'op'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Activity className="w-6 h-6 mx-auto mb-2" />
                      Outpatient (OP)
                    </button>
                    <button
                      onClick={() => setNewAppointment({...newAppointment, appointmentType: 'ip'})}
                      className={`p-4 border-2 rounded-xl font-semibold transition-all ${
                        newAppointment.appointmentType === 'ip'
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Bed className="w-6 h-6 mx-auto mb-2" />
                      Inpatient (IP)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Patient Name *</label>
                    <input
                      type="text"
                      value={newAppointment.patientName}
                      onChange={(e) => setNewAppointment({...newAppointment, patientName: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Phone *</label>
                    <input
                      type="tel"
                      value={newAppointment.patientPhone}
                      onChange={(e) => setNewAppointment({...newAppointment, patientPhone: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                    />
                  </div>
                </div>

                {newAppointment.type === 'doctor' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Doctor *</label>
                      <select
                        value={newAppointment.doctorName}
                        onChange={(e) => setNewAppointment({...newAppointment, doctorName: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                      >
                        <option value="">Select doctor...</option>
                        <option value="Dr. Arjun Vaidya">Dr. Arjun Vaidya</option>
                        <option value="Dr. Priya Sharma">Dr. Priya Sharma</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Complaint</label>
                      <input
                        type="text"
                        value={newAppointment.complaint}
                        onChange={(e) => setNewAppointment({...newAppointment, complaint: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Therapist *</label>
                      <select
                        value={newAppointment.therapistName}
                        onChange={(e) => setNewAppointment({...newAppointment, therapistName: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                      >
                        <option value="">Select therapist...</option>
                        <option value="Therapist Maya">Therapist Maya</option>
                        <option value="Therapist Ravi">Therapist Ravi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Therapy Type</label>
                      <select
                        value={newAppointment.therapyType}
                        onChange={(e) => setNewAppointment({...newAppointment, therapyType: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                      >
                        <option value="">Select therapy...</option>
                        <option value="Abhyanga Massage">Abhyanga Massage</option>
                        <option value="Shirodhara">Shirodhara</option>
                        <option value="Kati Basti">Kati Basti</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Date *</label>
                    <input
                      type="date"
                      value={newAppointment.date}
                      onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Time *</label>
                    <input
                      type="time"
                      value={newAppointment.time}
                      onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Duration (min)</label>
                    <input
                      type="number"
                      value={newAppointment.duration}
                      onChange={(e) => setNewAppointment({...newAppointment, duration: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                    />
                  </div>
                </div>

                {newAppointment.appointmentType === 'ip' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Room Number</label>
                    <input
                      type="text"
                      value={newAppointment.roomNumber}
                      onChange={(e) => setNewAppointment({...newAppointment, roomNumber: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500"
                      placeholder="e.g., 101"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={addAppointment}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-semibold shadow-lg"
                >
                  Schedule Appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedScheduling;
