import React, { useState, useEffect } from 'react';
import { Calendar, Users, Bed, LogOut, DollarSign, Clock, Phone, AlertCircle, TrendingUp, Activity, CheckCircle, XCircle } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
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
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Load all necessary data
      const [patients, discharges, invoices, leads] = await Promise.all([
        getDocs(collection(db, 'patients')),
        getDocs(collection(db, 'discharges')),
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'leads'))
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

      // Simulate appointments (In production, you'd have an appointments collection)
      const todayAppointments = [
        { id: 1, time: '09:00 AM', patient: 'Mrs. Sharma', type: 'Consultation', status: 'scheduled' },
        { id: 2, time: '10:30 AM', patient: 'Mr. Kumar', type: 'Follow-up', status: 'scheduled' },
        { id: 3, time: '11:00 AM', patient: 'Ms. Patel', type: 'Therapy', status: 'in-progress' },
        { id: 4, time: '02:00 PM', patient: 'Mr. Singh', type: 'Consultation', status: 'scheduled' },
        { id: 5, time: '03:30 PM', patient: 'Mrs. Reddy', type: 'Follow-up', status: 'scheduled' }
      ];

      // Simulate IP patients
      const ipPatients = [
        { id: 1, name: 'Mr. Verma', room: 'Private-101', admission: '2026-04-05', condition: 'Arthritis', status: 'stable' },
        { id: 2, name: 'Mrs. Gupta', room: 'Semi-Private-203', admission: '2026-04-07', condition: 'PCOS', status: 'recovering' },
        { id: 3, name: 'Mr. Joshi', room: 'Deluxe-301', admission: '2026-04-06', condition: 'Detox', status: 'stable' }
      ];

      // Simulate pending admissions
      const pendingAdmissions = [
        { id: 1, patient: 'Mrs. Iyer', scheduledFor: today, package: 'Weight Loss Program', status: 'pending' },
        { id: 2, patient: 'Mr. Desai', scheduledFor: today, package: 'Arthritis Relief', status: 'pending' }
      ];

      // Simulate therapist schedule
      const therapistSchedule = [
        { id: 1, therapist: 'Dr. Ramesh', sessions: '5/8', availability: 'available', nextSlot: '11:30 AM' },
        { id: 2, therapist: 'Dr. Priya', sessions: '7/8', availability: 'busy', nextSlot: '02:30 PM' },
        { id: 3, therapist: 'Dr. Anil', sessions: '4/8', availability: 'available', nextSlot: '10:00 AM' }
      ];

      setDashboardData({
        todayAppointments,
        ipPatients,
        pendingAdmissions,
        todayDischarges,
        outstandingPayments: invoicesData.filter(inv => inv.status !== 'paid'),
        leads: pendingFollowups,
        therapistSchedule,
        stats: {
          totalAppointments: todayAppointments.length,
          ipPatientsCount: ipPatients.length,
          pendingAdmissionsCount: pendingAdmissions.length,
          todayDischargesCount: todayDischarges.length,
          outstandingAmount: outstanding,
          hotLeads: hotLeads.length,
          pendingFollowups: pendingFollowups.length
        }
      });

      console.log('✅ Dashboard data loaded');

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
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
          icon={DollarSign}
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
                <span className="bg-white text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                  {dashboardData.stats.totalAppointments} Total
                </span>
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
                          <p className="text-2xl font-bold text-blue-600">{apt.time.split(':')[0]}</p>
                          <p className="text-xs text-gray-500">{apt.time.split(' ')[1]}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{apt.patient}</p>
                          <p className="text-sm text-gray-600">{apt.type}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        apt.status === 'in-progress' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {apt.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                      </span>
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
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" />
                New Lead
              </button>
              <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Register Patient
              </button>
              <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center justify-center gap-2">
                <DollarSign className="w-4 h-4" />
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
    </div>
  );
};

export default Dashboard;
