import React, { useState, useEffect } from 'react';
import { Calendar, Users, Bed, LogOut, IndianRupee, Clock, Phone, AlertCircle, TrendingUp, Activity, CheckCircle, XCircle, Trash2, Plus, X } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const AddAppointmentModal = ({ onClose, onSave, saving }) => {
  const [formData, setFormData] = useState({ patient: '', time: '', type: '' });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.patient.trim() || !formData.time) {
      setError('Patient name and time are required.');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Add Appointment</h3>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    todayAppointments: [],
    ipPatients: [],
    pendingAdmissions: [],
    todayDischarges: [],
    outstandingPayments: [],
    leads: [],
    stats: {
      totalAppointments: 0,
      ipPatientsCount: 0,
      pendingAdmissionsCount: 0,
      todayDischargesCount: 0,
      outstandingAmount: 0,
      hotLeads: 0
    }
  });

  useEffect(() => {
    loadDashboardData();

    // Real-time listener for today's appointments
    const today = new Date().toISOString().split('T')[0];
    const unsubscribe = onSnapshot(
      query(collection(db, 'appointments'), where('date', '==', today)),
      (snap) => {
        const todayAppointments = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        // Build therapist schedule from assigned appointments
        const therapistMap = {};
        todayAppointments.forEach(a => {
          if (a.therapistId && a.therapistName) {
            if (!therapistMap[a.therapistId]) {
              therapistMap[a.therapistId] = { id: a.therapistId, therapist: a.therapistName, sessions: 0, nextSlot: null, availability: 'busy' };
            }
            therapistMap[a.therapistId].sessions += 1;
            if (!therapistMap[a.therapistId].nextSlot) {
              therapistMap[a.therapistId].nextSlot = a.time;
            }
          }
        });
        const therapistSchedule = Object.values(therapistMap);

        setDashboardData(prev => ({
          ...prev,
          todayAppointments,
          therapistSchedule,
          stats: { ...prev.stats, totalAppointments: todayAppointments.length },
        }));
      }
    );

    return () => unsubscribe();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Load all necessary data (appointments handled by real-time listener)
      const [patients, discharges, invoices, leads] = await Promise.all([
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'discharges')),
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'leads')),
      ]);

      const patientsData = patients.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const dischargesData = discharges.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const invoicesData = invoices.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const leadsData = leads.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter today's discharges
      const todayDischarges = dischargesData.filter(d => 
        d.discharge_date && d.discharge_date.startsWith(today) && d.status !== 'completed'
      );

      // Calculate outstanding payments
      const outstanding = invoicesData
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);

      // Get hot leads
      const hotLeads = leadsData.filter(l => l.priority === 'hot' && l.status !== 'converted');

      // Get pending follow-ups
      const pendingFollowups = leadsData.filter(l => 
        l.next_followup && 
        new Date(l.next_followup) <= new Date() && 
        l.status !== 'converted'
      );

      // IP patients loaded from Firebase discharges/patients data
      const ipPatients = patientsData.filter(p => p.admission_type === 'ip' && p.status === 'admitted');

      // Pending admissions from patients collection
      const pendingAdmissions = patientsData.filter(p => p.admission_type === 'ip' && p.status === 'pending_admission');

      // Therapist schedule - empty until connected to scheduling module
      const therapistSchedule = [];

      setDashboardData(prev => ({
        ...prev,
        ipPatients,
        pendingAdmissions,
        todayDischarges,
        outstandingPayments: invoicesData.filter(inv => inv.status !== 'paid'),
        leads: pendingFollowups,
        therapistSchedule,
        stats: {
          ...prev.stats,
          ipPatientsCount: ipPatients.length,
          pendingAdmissionsCount: pendingAdmissions.length,
          todayDischargesCount: todayDischarges.length,
          outstandingAmount: outstanding,
          hotLeads: hotLeads.length,
          pendingFollowups: pendingFollowups.length
        }
      }));

      console.log('✅ Dashboard data loaded');

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAppointment = async (aptId) => {
    if (!window.confirm('Remove this appointment?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', aptId));
      // onSnapshot listener will update todayAppointments automatically
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Failed to delete appointment. Please try again.');
    }
  };

  const saveAppointment = async (formData) => {
    try {
      setSavingAppointment(true);
      const today = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, 'appointments'), {
        patient: formData.patient,
        time: formData.time,
        type: formData.type,
        status: 'scheduled',
        date: today,
        createdAt: new Date().toISOString()
      });
      setShowAddAppointment(false);
      await loadDashboardData();
    } catch (error) {
      console.error('Error adding appointment:', error);
      alert('Failed to add appointment. Please try again.');
    } finally {
      setSavingAppointment(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-l-4 hover:shadow-lg transition-shadow" style={{ borderColor: color }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
          <TrendingUp className="w-3 h-3" />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Good Morning, {currentUser.name || 'User'}!</h1>
            <p className="text-gray-600">Here's what's happening at Tatva Ayurved today</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Today's Date</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center text-white font-bold text-lg">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Today's Appointments"
          value={dashboardData.stats.totalAppointments}
          icon={Calendar}
          color="#3b82f6"
          subtitle="Scheduled patients"
        />
        <StatCard
          title="In-Patients"
          value={dashboardData.stats.ipPatientsCount}
          icon={Bed}
          color="#8b5cf6"
          subtitle="Currently admitted"
        />
        <StatCard
          title="Pending Admissions"
          value={dashboardData.stats.pendingAdmissionsCount}
          icon={Users}
          color="#f59e0b"
          subtitle="Awaiting admission"
        />
        <StatCard
          title="Outstanding Payments"
          value={`₹${dashboardData.stats.outstandingAmount.toLocaleString()}`}
          icon={IndianRupee}
          color="#ef4444"
          subtitle="To be collected"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Appointments */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">Today's Appointments</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddAppointment(true)}
                    className="flex items-center gap-1 bg-white text-blue-700 px-3 py-1 rounded-full text-sm font-semibold hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                  <span className="bg-blue-800 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    {dashboardData.stats.totalAppointments} Total
                  </span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {dashboardData.todayAppointments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No appointments scheduled for today</p>
                </div>
              ) : (
                dashboardData.todayAppointments.map(apt => (
                  <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-600">{apt.time}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{apt.patient}</p>
                          <p className="text-sm text-gray-600">{apt.type}</p>
                          {apt.therapistName && (
                            <p className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                              👤 {apt.therapistName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          apt.status === 'in-progress' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {apt.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                        </span>
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

          {/* Current IP Patients */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bed className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">In-Patient Status</h2>
                </div>
                <span className="bg-white text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
                  {dashboardData.stats.ipPatientsCount} Active
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashboardData.ipPatients.map(patient => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{patient.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{patient.room}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {new Date(patient.admission).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{patient.condition}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          patient.status === 'stable' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Pending Admissions */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Pending Admissions</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {dashboardData.pendingAdmissions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No pending admissions</p>
              ) : (
                dashboardData.pendingAdmissions.map(admission => (
                  <div key={admission.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="font-semibold text-gray-900 text-sm">{admission.patient}</p>
                    <p className="text-xs text-gray-600 mt-1">{admission.package}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-orange-700 font-medium">Today</span>
                      <button className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700">
                        Admit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Discharges Today */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Discharges Today</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {dashboardData.todayDischarges.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No discharges scheduled</p>
              ) : (
                dashboardData.todayDischarges.map(discharge => (
                  <div key={discharge.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="font-semibold text-gray-900 text-sm">{discharge.patient_name}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Pending: ₹{discharge.pending_amount?.toLocaleString() || 0}
                    </p>
                    <button className="mt-2 text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 w-full">
                      Complete Discharge
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Therapist Schedule */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Therapist Schedule</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {(!dashboardData.therapistSchedule || dashboardData.therapistSchedule.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-2">No therapist assignments today</p>
              )}
              {dashboardData.therapistSchedule?.map(therapist => (
                <div key={therapist.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900 text-sm">{therapist.therapist}</p>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      therapist.availability === 'available' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {therapist.availability}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Sessions: {therapist.sessions}</span>
                    <span>Next: {therapist.nextSlot}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">Quick Actions</h3>
            <div className="space-y-2">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'leads' }))}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                New Lead
              </button>
              <button 
                onClick={() => {
                  // Navigate to patients view
                  window.dispatchEvent(new CustomEvent('navigate', { detail: 'patients' }));
                  // Trigger new patient registration after a short delay
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openNewPatient'));
                  }, 100);
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                New Patient Registration
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'invoices' }))}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center justify-center gap-2"
              >
                <IndianRupee className="w-4 h-4" />
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {dashboardData.stats.hotLeads > 0 && (
        <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-800">Action Required!</p>
              <p className="text-sm text-yellow-700">
                You have {dashboardData.stats.hotLeads} hot leads and {dashboardData.stats.pendingFollowups} pending follow-ups waiting for your attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {showAddAppointment && (
        <AddAppointmentModal
          onClose={() => setShowAddAppointment(false)}
          onSave={saveAppointment}
          saving={savingAppointment}
        />
      )}
    </div>
  );
};

export default Dashboard;
