import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Plus, X, Users, Search, ChevronLeft, ChevronRight,
  Edit, Trash2, AlertCircle, CheckCircle, UserCheck, Filter,
  Phone, Mail, MapPin, Stethoscope, ClipboardList, Eye
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';

const AppointmentScheduling = () => {
  // State
  const [activeTab, setActiveTab] = useState('calendar'); // calendar, therapists, manage
  const [appointments, setAppointments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTherapistModal, setShowTherapistModal] = useState(false);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(null);
  const [viewMode, setViewMode] = useState('day'); // day, week
  const [filterTherapist, setFilterTherapist] = useState('all');

  // Time slots from 8 AM to 8 PM
  const timeSlots = [];
  for (let h = 8; h <= 20; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  // Treatment types for Ayurvedic hospital
  const treatmentTypes = [
    'Consultation', 'Follow-up', 'Panchakarma', 'Abhyanga (Oil Massage)',
    'Shirodhara', 'Basti (Enema Therapy)', 'Nasya (Nasal Therapy)',
    'Vamana (Emesis Therapy)', 'Virechana (Purgation)', 'Raktamokshana',
    'Pizhichil', 'Njavarakizhi', 'Elakizhi', 'Podikizhi',
    'Udwarthana', 'Swedana (Steam)', 'Netra Tarpana', 'Karna Poorana',
    'Yoga Therapy', 'Diet Consultation', 'Lab Work', 'Other'
  ];

  // Duration options in minutes
  const durationOptions = [15, 30, 45, 60, 90, 120, 150, 180];

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load appointments
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsSnap = await getDocs(appointmentsRef);
      const appointmentsData = appointmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppointments(appointmentsData);

      // Load therapists
      const therapistsRef = collection(db, 'therapists');
      const therapistsSnap = await getDocs(therapistsRef);
      const therapistsData = therapistsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTherapists(therapistsData);

      // Load patients
      const patientsRef = collection(db, 'patients');
      const patientsSnap = await getDocs(patientsRef);
      const patientsData = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPatients(patientsData);

      console.log('✅ Loaded:', appointmentsData.length, 'appointments,', therapistsData.length, 'therapists,', patientsData.length, 'patients');
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get appointments for a specific date
  const getAppointmentsForDate = (date) => {
    return appointments.filter(apt => apt.date === date);
  };

  // Get appointments for a specific therapist on a date
  const getTherapistAppointments = (therapistId, date) => {
    return appointments.filter(apt => apt.therapist_id === therapistId && apt.date === date);
  };

  // Check if time slot is available
  const isSlotAvailable = (therapistId, date, startTime, duration) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + duration;

    const therapistApts = getTherapistAppointments(therapistId, date);
    return !therapistApts.some(apt => {
      const aptStart = timeToMinutes(apt.start_time);
      const aptEnd = aptStart + (apt.duration || 30);
      return (startMinutes < aptEnd && endMinutes > aptStart);
    });
  };

  const timeToMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Calendar navigation
  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({
        day: d,
        date: dateStr,
        appointments: getAppointmentsForDate(dateStr),
        isToday: dateStr === new Date().toISOString().split('T')[0],
        isSelected: dateStr === selectedDate
      });
    }
    return days;
  };

  // Stats
  const todayAppointments = getAppointmentsForDate(new Date().toISOString().split('T')[0]);
  const selectedDateAppointments = getAppointmentsForDate(selectedDate);
  const upcomingAppointments = appointments.filter(apt => apt.date >= new Date().toISOString().split('T')[0] && apt.status !== 'cancelled');

  // ==========================================
  // BOOKING MODAL
  // ==========================================
  const BookingModal = () => {
    const [bookingData, setBookingData] = useState({
      patient_id: '',
      patient_name: '',
      patient_phone: '',
      therapist_id: '',
      date: selectedDate,
      start_time: '09:00',
      duration: 30,
      treatment_type: 'Consultation',
      notes: '',
      status: 'scheduled'
    });
    const [patientSearch, setPatientSearch] = useState('');
    const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
    const [savingBooking, setSavingBooking] = useState(false);

    const filteredPatients = patientSearch.length >= 2
      ? patients.filter(p =>
          (p.name && p.name.toLowerCase().includes(patientSearch.toLowerCase())) ||
          (p.patient_number && p.patient_number.toLowerCase().includes(patientSearch.toLowerCase())) ||
          (p.phone && p.phone.includes(patientSearch))
        ).slice(0, 8)
      : [];

    const selectPatient = (patient) => {
      setBookingData(prev => ({
        ...prev,
        patient_id: patient.id,
        patient_name: patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        patient_phone: patient.phone || patient.mobile || ''
      }));
      setPatientSearch(patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim());
      setShowPatientSuggestions(false);
    };

    const handleSaveBooking = async () => {
      if (!bookingData.patient_name) {
        alert('Please select or enter a patient name');
        return;
      }
      if (!bookingData.therapist_id) {
        alert('Please select a therapist');
        return;
      }

      // Check availability
      if (!isSlotAvailable(bookingData.therapist_id, bookingData.date, bookingData.start_time, bookingData.duration)) {
        alert('⚠️ This time slot is not available! The therapist already has an appointment during this time.');
        return;
      }

      setSavingBooking(true);
      try {
        const therapist = therapists.find(t => t.id === bookingData.therapist_id);
        const endTime = minutesToTime(timeToMinutes(bookingData.start_time) + bookingData.duration);

        const appointmentData = {
          ...bookingData,
          therapist_name: therapist?.name || '',
          end_time: endTime,
          created_at: new Date().toISOString(),
          created_by: JSON.parse(localStorage.getItem('currentUser') || '{}').email || 'admin'
        };

        await addDoc(collection(db, 'appointments'), appointmentData);

        alert(`✅ Appointment Booked Successfully!

Patient: ${bookingData.patient_name}
Therapist: ${therapist?.name}
Date: ${new Date(bookingData.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: ${bookingData.start_time} - ${endTime}
Treatment: ${bookingData.treatment_type}
Duration: ${bookingData.duration} minutes`);

        setShowBookingModal(false);
        loadData();
      } catch (error) {
        console.error('Error booking appointment:', error);
        alert('Failed to book appointment: ' + error.message);
      } finally {
        setSavingBooking(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="p-6 border-b bg-gradient-to-r from-teal-600 to-emerald-600 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">📅 Book Appointment</h2>
                <p className="text-teal-100 text-sm mt-1">Schedule a new patient appointment</p>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="text-white hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Patient Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">👤 Patient *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientSuggestions(true);
                    if (!e.target.value) {
                      setBookingData(prev => ({ ...prev, patient_id: '', patient_name: '', patient_phone: '' }));
                    }
                  }}
                  onFocus={() => patientSearch.length >= 2 && setShowPatientSuggestions(true)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Search patient by name, number, or phone..."
                  autoComplete="off"
                />
                {showPatientSuggestions && filteredPatients.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredPatients.map((p, idx) => (
                      <div key={p.id || idx} className="px-4 py-3 hover:bg-teal-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => selectPatient(p)}>
                        <p className="font-semibold text-gray-900">{p.name || `${p.first_name || ''} ${p.last_name || ''}`}</p>
                        <p className="text-xs text-gray-500">{p.patient_number} • {p.phone || p.mobile || 'No phone'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {bookingData.patient_name && (
                <p className="text-xs text-green-600 mt-1">✅ Selected: {bookingData.patient_name} {bookingData.patient_phone && `(${bookingData.patient_phone})`}</p>
              )}
            </div>

            {/* Walk-in Patient Name */}
            {!bookingData.patient_id && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Or enter walk-in patient name:</label>
                <input
                  type="text"
                  value={bookingData.patient_name}
                  onChange={(e) => setBookingData(prev => ({ ...prev, patient_name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Walk-in patient name"
                />
              </div>
            )}

            {/* Therapist Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">🧑‍⚕️ Therapist *</label>
              <select
                value={bookingData.therapist_id}
                onChange={(e) => setBookingData(prev => ({ ...prev, therapist_id: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Therapist</option>
                {therapists.filter(t => t.is_active !== false).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} - {t.specialization || 'General'}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Date *</label>
                <input
                  type="date"
                  value={bookingData.date}
                  onChange={(e) => setBookingData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">🕐 Start Time *</label>
                <select
                  value={bookingData.start_time}
                  onChange={(e) => setBookingData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>
                      {slot} ({parseInt(slot) >= 12 ? (parseInt(slot) === 12 ? '12' : parseInt(slot) - 12) + ':' + slot.split(':')[1] + ' PM' : slot + ' AM'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">⏱️ Duration</label>
                <select
                  value={bookingData.duration}
                  onChange={(e) => setBookingData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  {durationOptions.map(d => (
                    <option key={d} value={d}>{d} min ({d >= 60 ? `${Math.floor(d/60)}h ${d % 60 ? d%60 + 'm' : ''}` : `${d}m`})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Availability Check */}
            {bookingData.therapist_id && bookingData.date && bookingData.start_time && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                isSlotAvailable(bookingData.therapist_id, bookingData.date, bookingData.start_time, bookingData.duration)
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {isSlotAvailable(bookingData.therapist_id, bookingData.date, bookingData.start_time, bookingData.duration)
                  ? `✅ Time slot available! (${bookingData.start_time} - ${minutesToTime(timeToMinutes(bookingData.start_time) + bookingData.duration)})`
                  : '❌ Time slot NOT available! Please choose a different time.'}
              </div>
            )}

            {/* Treatment Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">🏥 Treatment Type</label>
              <select
                value={bookingData.treatment_type}
                onChange={(e) => setBookingData(prev => ({ ...prev, treatment_type: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                {treatmentTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">📝 Notes</label>
              <textarea
                value={bookingData.notes}
                onChange={(e) => setBookingData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                rows="2"
                placeholder="Additional notes or instructions..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
            <button onClick={() => setShowBookingModal(false)}
              className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">
              Cancel
            </button>
            <button onClick={handleSaveBooking} disabled={savingBooking}
              className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 flex items-center gap-2">
              {savingBooking ? 'Booking...' : '✅ Book Appointment'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // THERAPIST MODAL
  // ==========================================
  const TherapistModal = () => {
    const [therapistData, setTherapistData] = useState({
      name: '',
      specialization: '',
      phone: '',
      email: '',
      qualification: '',
      experience_years: '',
      is_active: true,
      working_hours: {
        monday: { start: '09:00', end: '17:00', off: false },
        tuesday: { start: '09:00', end: '17:00', off: false },
        wednesday: { start: '09:00', end: '17:00', off: false },
        thursday: { start: '09:00', end: '17:00', off: false },
        friday: { start: '09:00', end: '17:00', off: false },
        saturday: { start: '09:00', end: '14:00', off: false },
        sunday: { start: '09:00', end: '14:00', off: true }
      },
      treatments: []
    });
    const [savingTherapist, setSavingTherapist] = useState(false);

    const specializations = [
      'Panchakarma Specialist', 'Ayurvedic Physician', 'Yoga Therapist',
      'Massage Therapist', 'Naturopath', 'Diet & Nutrition',
      'Shirodhara Specialist', 'Physiotherapist', 'General Practitioner'
    ];

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const handleSaveTherapist = async () => {
      if (!therapistData.name.trim()) {
        alert('Therapist name is required');
        return;
      }
      if (!therapistData.specialization) {
        alert('Specialization is required');
        return;
      }

      setSavingTherapist(true);
      try {
        await addDoc(collection(db, 'therapists'), {
          ...therapistData,
          created_at: new Date().toISOString()
        });

        alert(`✅ Therapist Added Successfully!

Name: ${therapistData.name}
Specialization: ${therapistData.specialization}
Phone: ${therapistData.phone || '-'}`);

        setShowTherapistModal(false);
        loadData();
      } catch (error) {
        console.error('Error adding therapist:', error);
        alert('Failed to add therapist: ' + error.message);
      } finally {
        setSavingTherapist(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">🧑‍⚕️ Add Therapist</h2>
                <p className="text-purple-100 text-sm mt-1">Add a new therapist with their schedule</p>
              </div>
              <button onClick={() => setShowTherapistModal(false)} className="text-white hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                <input type="text" value={therapistData.name}
                  onChange={(e) => setTherapistData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Dr. Rajesh Kumar" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Specialization *</label>
                <select value={therapistData.specialization}
                  onChange={(e) => setTherapistData(prev => ({ ...prev, specialization: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                  <option value="">Select Specialization</option>
                  {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                <input type="tel" value={therapistData.phone}
                  onChange={(e) => setTherapistData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" value={therapistData.email}
                  onChange={(e) => setTherapistData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="therapist@tatvaayurved.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Qualification</label>
                <input type="text" value={therapistData.qualification}
                  onChange={(e) => setTherapistData(prev => ({ ...prev, qualification: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="BAMS, MD (Ayurveda)" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Experience (Years)</label>
                <input type="number" value={therapistData.experience_years}
                  onChange={(e) => setTherapistData(prev => ({ ...prev, experience_years: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="5" />
              </div>
            </div>

            {/* Weekly Schedule */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3">📅 Weekly Working Hours</h3>
              <div className="space-y-2">
                {days.map(day => (
                  <div key={day} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-24">
                      <span className="text-sm font-semibold capitalize text-gray-700">{day}</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!therapistData.working_hours[day].off}
                        onChange={(e) => setTherapistData(prev => ({
                          ...prev,
                          working_hours: {
                            ...prev.working_hours,
                            [day]: { ...prev.working_hours[day], off: !e.target.checked }
                          }
                        }))}
                        className="w-4 h-4 text-purple-600 rounded" />
                      <span className="text-xs text-gray-600">Working</span>
                    </label>
                    {!therapistData.working_hours[day].off && (
                      <>
                        <input type="time" value={therapistData.working_hours[day].start}
                          onChange={(e) => setTherapistData(prev => ({
                            ...prev,
                            working_hours: {
                              ...prev.working_hours,
                              [day]: { ...prev.working_hours[day], start: e.target.value }
                            }
                          }))}
                          className="px-2 py-1 border rounded text-sm" />
                        <span className="text-gray-500 text-sm">to</span>
                        <input type="time" value={therapistData.working_hours[day].end}
                          onChange={(e) => setTherapistData(prev => ({
                            ...prev,
                            working_hours: {
                              ...prev.working_hours,
                              [day]: { ...prev.working_hours[day], end: e.target.value }
                            }
                          }))}
                          className="px-2 py-1 border rounded text-sm" />
                      </>
                    )}
                    {therapistData.working_hours[day].off && (
                      <span className="text-red-500 text-sm font-medium">Day Off</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Treatments */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">🏥 Treatments Offered</label>
              <div className="flex flex-wrap gap-2">
                {treatmentTypes.map(t => (
                  <button key={t}
                    onClick={() => {
                      setTherapistData(prev => ({
                        ...prev,
                        treatments: prev.treatments.includes(t)
                          ? prev.treatments.filter(x => x !== t)
                          : [...prev.treatments, t]
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      therapistData.treatments.includes(t)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
            <button onClick={() => setShowTherapistModal(false)}
              className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">Cancel</button>
            <button onClick={handleSaveTherapist} disabled={savingTherapist}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">
              {savingTherapist ? 'Saving...' : '✅ Add Therapist'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // UPDATE APPOINTMENT STATUS
  // ==========================================
  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), {
        status,
        updated_at: new Date().toISOString()
      });
      loadData();
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Failed to update: ' + error.message);
    }
  };

  const deleteAppointment = async (appointmentId) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', appointmentId));
      loadData();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Failed to delete: ' + error.message);
    }
  };

  // ==========================================
  // STATUS COLORS
  // ==========================================
  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTherapistColor = (index) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500',
      'bg-pink-500', 'bg-cyan-500', 'bg-amber-500', 'bg-indigo-500'
    ];
    return colors[index % colors.length];
  };

  const getTherapistBgColor = (index) => {
    const colors = [
      'bg-blue-50 border-blue-200 text-blue-900',
      'bg-emerald-50 border-emerald-200 text-emerald-900',
      'bg-purple-50 border-purple-200 text-purple-900',
      'bg-orange-50 border-orange-200 text-orange-900',
      'bg-pink-50 border-pink-200 text-pink-900',
      'bg-cyan-50 border-cyan-200 text-cyan-900',
      'bg-amber-50 border-amber-200 text-amber-900',
      'bg-indigo-50 border-indigo-200 text-indigo-900'
    ];
    return colors[index % colors.length];
  };

  // ==========================================
  // RENDER
  // ==========================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading scheduling data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Appointment Scheduling</h1>
            <p className="text-gray-500 text-sm">Manage appointments and therapist schedules</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowTherapistModal(true)}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium">
            <UserCheck className="w-4 h-4" />
            Add Therapist
          </button>
          <button onClick={() => setShowBookingModal(true)}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 font-medium">
            <Plus className="w-4 h-4" />
            Book Appointment
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{todayAppointments.length}</p>
              <p className="text-xs text-gray-500">Today's Appts</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {todayAppointments.filter(a => a.status === 'completed').length}
              </p>
              <p className="text-xs text-gray-500">Completed Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg"><Clock className="w-5 h-5 text-orange-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{upcomingAppointments.length}</p>
              <p className="text-xs text-gray-500">Upcoming</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Users className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{therapists.length}</p>
              <p className="text-xs text-gray-500">Therapists</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg"><Stethoscope className="w-5 h-5 text-teal-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{selectedDateAppointments.length}</p>
              <p className="text-xs text-gray-500">{selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : new Date(selectedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'calendar', label: '📅 Calendar View', icon: Calendar },
          { key: 'therapists', label: '🧑‍⚕️ Therapist Schedule', icon: Users },
          { key: 'manage', label: '📋 All Appointments', icon: ClipboardList }
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================== */}
      {/* TAB 1: CALENDAR VIEW */}
      {/* ============================== */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Mini Calendar */}
          <div className="col-span-1">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-5 h-5" /></button>
                <h3 className="font-bold text-gray-800">
                  {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} className="text-xs font-semibold text-gray-500 py-2">{d}</div>
                ))}
                {getDaysInMonth().map((day, idx) => (
                  <div key={idx}>
                    {day ? (
                      <button
                        onClick={() => setSelectedDate(day.date)}
                        className={`w-full aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative transition-all ${
                          day.isSelected ? 'bg-teal-600 text-white' :
                          day.isToday ? 'bg-teal-100 text-teal-800 font-bold' :
                          'hover:bg-gray-100 text-gray-700'
                        }`}>
                        {day.day}
                        {day.appointments.length > 0 && (
                          <div className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${day.isSelected ? 'bg-white' : 'bg-teal-500'}`}></div>
                        )}
                      </button>
                    ) : <div></div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Therapist Legend */}
            <div className="bg-white border rounded-xl p-4 shadow-sm mt-4">
              <h3 className="font-bold text-gray-800 mb-3">Therapists</h3>
              <div className="space-y-2">
                {therapists.map((t, idx) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <div className={`w-3 h-3 rounded-full ${getTherapistColor(idx)}`}></div>
                    <span className="font-medium text-gray-700">{t.name}</span>
                    <span className="text-xs text-gray-500">({t.specialization || 'General'})</span>
                  </div>
                ))}
                {therapists.length === 0 && (
                  <p className="text-sm text-gray-500">No therapists added yet. Click "Add Therapist" to get started.</p>
                )}
              </div>
            </div>
          </div>

          {/* Day Schedule */}
          <div className="col-span-2">
            <div className="bg-white border rounded-xl shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-gray-800">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
                <span className="text-sm text-gray-500">{selectedDateAppointments.length} appointment(s)</span>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {selectedDateAppointments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No appointments on this day</p>
                    <button onClick={() => setShowBookingModal(true)} className="mt-3 text-teal-600 hover:text-teal-700 font-medium text-sm">
                      + Book an appointment
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDateAppointments
                      .sort((a, b) => a.start_time.localeCompare(b.start_time))
                      .map((apt) => {
                        const therapistIdx = therapists.findIndex(t => t.id === apt.therapist_id);
                        return (
                          <div key={apt.id} className={`p-4 rounded-xl border ${getTherapistBgColor(therapistIdx)}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-lg">{apt.start_time} - {apt.end_time || minutesToTime(timeToMinutes(apt.start_time) + (apt.duration || 30))}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(apt.status)}`}>
                                    {(apt.status || 'scheduled').replace('_', ' ').toUpperCase()}
                                  </span>
                                </div>
                                <p className="font-semibold text-base">{apt.patient_name}</p>
                                <p className="text-sm opacity-75">
                                  🧑‍⚕️ {apt.therapist_name || 'Unassigned'} • {apt.treatment_type} • {apt.duration || 30} min
                                </p>
                                {apt.notes && <p className="text-xs opacity-60 mt-1">📝 {apt.notes}</p>}
                              </div>
                              <div className="flex gap-1">
                                {apt.status === 'scheduled' && (
                                  <>
                                    <button onClick={() => updateAppointmentStatus(apt.id, 'confirmed')}
                                      className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Confirm</button>
                                    <button onClick={() => updateAppointmentStatus(apt.id, 'cancelled')}
                                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Cancel</button>
                                  </>
                                )}
                                {apt.status === 'confirmed' && (
                                  <button onClick={() => updateAppointmentStatus(apt.id, 'in_progress')}
                                    className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700">Start</button>
                                )}
                                {apt.status === 'in_progress' && (
                                  <button onClick={() => updateAppointmentStatus(apt.id, 'completed')}
                                    className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">Complete</button>
                                )}
                                <button onClick={() => deleteAppointment(apt.id)}
                                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB 2: THERAPIST SCHEDULE */}
      {/* ============================== */}
      {activeTab === 'therapists' && (
        <div className="bg-white border rounded-xl shadow-sm">
          {/* Date Selector */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-5 h-5" /></button>
              <h3 className="font-bold text-gray-800">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
              <button onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-200">Today</button>
          </div>

          {therapists.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No therapists added yet</p>
              <button onClick={() => setShowTherapistModal(true)} className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm">
                + Add your first therapist
              </button>
            </div>
          ) : (
            /* Time Grid */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-r border-b px-3 py-3 text-left text-xs font-semibold text-gray-600 w-20 sticky left-0 bg-gray-50 z-10">Time</th>
                    {therapists.filter(t => t.is_active !== false).map((therapist, idx) => (
                      <th key={therapist.id} className="border-r border-b px-3 py-3 text-center min-w-[180px]">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full ${getTherapistColor(idx)} text-white flex items-center justify-center text-xs font-bold mb-1`}>
                            {therapist.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-gray-800">{therapist.name}</span>
                          <span className="text-xs text-gray-500">{therapist.specialization || 'General'}</span>
                          {therapist.working_hours && (() => {
                            const dayName = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                            const schedule = therapist.working_hours[dayName];
                            if (schedule?.off) return <span className="text-xs text-red-500 font-medium mt-0.5">Day Off</span>;
                            if (schedule) return <span className="text-xs text-green-600 mt-0.5">{schedule.start} - {schedule.end}</span>;
                            return null;
                          })()}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.filter((_, i) => i % 2 === 0).map((slot) => (
                    <tr key={slot} className="hover:bg-gray-50">
                      <td className="border-r border-b px-3 py-4 text-xs font-medium text-gray-500 sticky left-0 bg-white z-10">
                        {slot}
                      </td>
                      {therapists.filter(t => t.is_active !== false).map((therapist, idx) => {
                        const slotAppointments = getTherapistAppointments(therapist.id, selectedDate)
                          .filter(apt => {
                            const aptStart = timeToMinutes(apt.start_time);
                            const slotStart = timeToMinutes(slot);
                            return aptStart >= slotStart && aptStart < slotStart + 60;
                          });

                        // Check if therapist is off
                        const dayName = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                        const schedule = therapist.working_hours?.[dayName];
                        const isOff = schedule?.off;

                        // Check if outside working hours
                        const slotMinutes = timeToMinutes(slot);
                        const workStart = schedule ? timeToMinutes(schedule.start) : 0;
                        const workEnd = schedule ? timeToMinutes(schedule.end) : 1440;
                        const outsideHours = !isOff && (slotMinutes < workStart || slotMinutes >= workEnd);

                        return (
                          <td key={therapist.id} className={`border-r border-b px-2 py-1 align-top ${
                            isOff ? 'bg-red-50' : outsideHours ? 'bg-gray-100' : ''
                          }`}>
                            {isOff ? (
                              <div className="text-xs text-red-400 text-center py-2">Off</div>
                            ) : outsideHours ? (
                              <div className="text-xs text-gray-400 text-center py-2">-</div>
                            ) : slotAppointments.length > 0 ? (
                              slotAppointments.map(apt => (
                                <div key={apt.id}
                                  className={`p-2 rounded-lg border text-xs mb-1 cursor-pointer hover:shadow-md transition-shadow ${getTherapistBgColor(idx)}`}
                                  onClick={() => setShowAppointmentDetail(apt)}>
                                  <p className="font-bold">{apt.patient_name}</p>
                                  <p className="opacity-75">{apt.start_time}-{apt.end_time || minutesToTime(timeToMinutes(apt.start_time) + (apt.duration || 30))}</p>
                                  <p className="opacity-60">{apt.treatment_type}</p>
                                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${getStatusColor(apt.status)}`}>
                                    {(apt.status || 'scheduled').toUpperCase()}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <button
                                onClick={() => {
                                  setShowBookingModal(true);
                                }}
                                className="w-full h-full min-h-[40px] rounded hover:bg-teal-50 transition-colors text-teal-400 hover:text-teal-600 text-xs">
                                +
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================== */}
      {/* TAB 3: ALL APPOINTMENTS */}
      {/* ============================== */}
      {activeTab === 'manage' && (
        <div className="bg-white border rounded-xl shadow-sm">
          {/* Filters */}
          <div className="p-4 border-b flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select value={filterTherapist} onChange={(e) => setFilterTherapist(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm">
                <option value="all">All Therapists</option>
                {therapists.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm" />
            <span className="text-sm text-gray-500">
              {appointments.filter(a => {
                const dateMatch = a.date === selectedDate;
                const therapistMatch = filterTherapist === 'all' || a.therapist_id === filterTherapist;
                return dateMatch && therapistMatch;
              }).length} appointments
            </span>
          </div>

          {/* Appointments Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Therapist</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Treatment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {appointments
                  .filter(a => {
                    const dateMatch = a.date === selectedDate;
                    const therapistMatch = filterTherapist === 'all' || a.therapist_id === filterTherapist;
                    return dateMatch && therapistMatch;
                  })
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map(apt => (
                    <tr key={apt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {apt.start_time} - {apt.end_time || minutesToTime(timeToMinutes(apt.start_time) + (apt.duration || 30))}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium text-gray-900">{apt.patient_name}</p>
                        {apt.patient_phone && <p className="text-xs text-gray-500">{apt.patient_phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{apt.therapist_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{apt.treatment_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{apt.duration || 30} min</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(apt.status)}`}>
                          {(apt.status || 'scheduled').replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {apt.status === 'scheduled' && (
                            <>
                              <button onClick={() => updateAppointmentStatus(apt.id, 'confirmed')}
                                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 font-medium">Confirm</button>
                              <button onClick={() => updateAppointmentStatus(apt.id, 'cancelled')}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 font-medium">Cancel</button>
                            </>
                          )}
                          {apt.status === 'confirmed' && (
                            <button onClick={() => updateAppointmentStatus(apt.id, 'in_progress')}
                              className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200 font-medium">Start</button>
                          )}
                          {apt.status === 'in_progress' && (
                            <button onClick={() => updateAppointmentStatus(apt.id, 'completed')}
                              className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs hover:bg-emerald-200 font-medium">Complete</button>
                          )}
                          <button onClick={() => deleteAppointment(apt.id)}
                            className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {appointments.filter(a => a.date === selectedDate && (filterTherapist === 'all' || a.therapist_id === filterTherapist)).length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                      No appointments for this date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {showAppointmentDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b bg-gradient-to-r from-teal-600 to-emerald-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Appointment Details</h3>
                <button onClick={() => setShowAppointmentDetail(null)} className="text-white hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Patient:</span>
                  <p className="font-semibold">{showAppointmentDetail.patient_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <p className="font-semibold">{showAppointmentDetail.patient_phone || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Therapist:</span>
                  <p className="font-semibold">{showAppointmentDetail.therapist_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Treatment:</span>
                  <p className="font-semibold">{showAppointmentDetail.treatment_type}</p>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <p className="font-semibold">{new Date(showAppointmentDetail.date + 'T00:00:00').toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <span className="text-gray-500">Time:</span>
                  <p className="font-semibold">{showAppointmentDetail.start_time} - {showAppointmentDetail.end_time}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <p className="font-semibold">{showAppointmentDetail.duration || 30} minutes</p>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(showAppointmentDetail.status)}`}>
                    {(showAppointmentDetail.status || 'scheduled').replace('_', ' ').toUpperCase()}
                  </span></p>
                </div>
              </div>
              {showAppointmentDetail.notes && (
                <div className="pt-3 border-t">
                  <span className="text-gray-500 text-sm">Notes:</span>
                  <p className="text-sm mt-1">{showAppointmentDetail.notes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end">
              <button onClick={() => setShowAppointmentDetail(null)}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showBookingModal && <BookingModal />}
      {showTherapistModal && <TherapistModal />}
    </div>
  );
};

export default AppointmentScheduling;
