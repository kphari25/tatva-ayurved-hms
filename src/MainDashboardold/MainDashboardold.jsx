import AdminUserPortal from './components/AdminUserPortal';
import PatientPortal from './components/PatientPortal';
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, TrendingUp, Calendar, DollarSign,
  Users, Database, Menu, X, LogOut, Settings, User,
  Activity, FileText, Shield, ChevronRight, Briefcase,
  UserPlus, Stethoscope
} from 'lucide-react';

// Import all modules
import InventoryManagement from './components/InventoryManagement';
import PrescriptionWithInventory from './components/PrescriptionWithInventory';
import InventoryAnalytics from './components/InventoryAnalytics';
import AdvancedScheduling from './components/AdvancedScheduling';
import FinancialReports from './components/FinancialReports';
// import NotificationSystem from './components/NotificationSystem';
import HRPayrollModule from './components/HRPayrollModule';
import DatabaseBackupRestore from './components/DatabaseBackupRestore';

const MainDashboard = ({ supabase, session }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setCurrentUser(null);
          setUserRole(null);
        }
      }
    );
    return () => { authListener?.subscription?.unsubscribe(); };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setCurrentUser(data);
      setUserRole(data.role);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadInventory();
      loadAppointments();
      if (['admin', 'doctor', 'front_desk', 'therapist'].includes(userRole)) {
        loadPatients();
      }
    }
  }, [currentUser, userRole]);

  const loadInventory = async () => {
    try {
      const { data, error } = await supabase.from('inventory').select('*').order('name');
      if (error) throw error;
      setInventory(data || []);
    } catch (error) { console.error('Error loading inventory:', error); }
  };

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(*), staff(*)')
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      setAppointments(data || []);
    } catch (error) { console.error('Error loading appointments:', error); }
  };

  const loadPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPatients(data || []);
    } catch (error) { console.error('Error loading patients:', error); }
  };

  const updateInventory = async (medicineId, quantityChange, transaction) => {
    try {
      const { data: medicine, error: fetchError } = await supabase
        .from('inventory').select('*').eq('id', medicineId).single();
      if (fetchError) throw fetchError;

      const newQuantity = Math.max(0, medicine.quantity + quantityChange);

      const { error: updateError } = await supabase
        .from('inventory').update({ quantity: newQuantity }).eq('id', medicineId);
      if (updateError) throw updateError;

      const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert({
          medicine_id: medicineId,
          transaction_type: transaction.type,
          quantity_change: quantityChange,
          quantity_before: medicine.quantity,
          quantity_after: newQuantity,
          unit_price: medicine.sale_price,
          total_amount: Math.abs(quantityChange) * medicine.sale_price,
          reference_id: transaction.reference_id,
          reference_type: transaction.reference_type,
          performed_by: currentUser.id,
          notes: transaction.notes
        });
      if (txError) throw txError;

      if (quantityChange < 0) {
        setSalesHistory(prev => [...prev, {
          medicine_id: medicineId,
          medicine_name: medicine.name,
          quantity: Math.abs(quantityChange),
          sale_price: medicine.sale_price,
          purchase_price: medicine.purchase_price,
          total_amount: Math.abs(quantityChange) * medicine.sale_price,
          profit: Math.abs(quantityChange) * (medicine.sale_price - medicine.purchase_price),
          date: new Date().toISOString(),
          ...transaction
        }]);
      }
      await loadInventory();
    } catch (error) {
      console.error('Error updating inventory:', error);
      alert('Failed to update inventory: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setUserRole(null);
      setCurrentView('dashboard');
    } catch (error) { console.error('Error logging out:', error); }
  };

  // ================================================================
  // NAVIGATION ITEMS WITH ROLE-BASED ACCESS
  // ================================================================
  const getNavigationItems = () => {
    const allItems = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: ['admin', 'doctor', 'front_desk', 'pharmacy', 'therapist']
      },
      {
        id: 'patients',
        label: 'Patient Portal',
        icon: Stethoscope,
        roles: ['admin', 'doctor', 'front_desk', 'therapist']
      },
      {
        id: 'inventory',
        label: 'Inventory',
        icon: Package,
        roles: ['admin', 'pharmacy', 'doctor']
      },
      {
        id: 'prescriptions',
        label: 'Prescriptions',
        icon: FileText,
        roles: ['admin', 'doctor', 'pharmacy']
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: TrendingUp,
        roles: ['admin', 'pharmacy']
      },
      {
        id: 'scheduling',
        label: 'Scheduling',
        icon: Calendar,
        roles: ['admin', 'doctor', 'front_desk', 'therapist']
      },
      {
        id: 'financial',
        label: 'Financial Reports',
        icon: DollarSign,
        roles: ['admin']
      },
      {
        id: 'hr-payroll',
        label: 'HR & Payroll',
        icon: Briefcase,
        roles: ['admin']
      },
      {
        id: 'user-management',
        label: 'User Management',
        icon: Shield,
        roles: ['admin']
      },
      {
        id: 'backup',
        label: 'Database Backup',
        icon: Database,
        roles: ['admin']
      }
    ];

    return allItems.filter(item => item.roles.includes(userRole));
  };

  const dashboardStats = {
    totalPatients: patients.length,
    todayAppointments: appointments.filter(a =>
      new Date(a.appointment_date).toDateString() === new Date().toDateString()
    ).length,
    lowStock: inventory.filter(m => m.status === 'low-stock' || m.status === 'out-of-stock').length,
    totalRevenue: salesHistory.reduce((sum, s) => sum + s.total_amount, 0)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-slate-700">Loading Tatva Ayurved HMS...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Tatva Ayurved HMS</h1>
          <p className="text-slate-600 mb-8">Please sign in to continue</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold shadow-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Admin-only section IDs
  const adminOnlySections = ['financial', 'hr-payroll', 'user-management', 'backup'];

  return (
    <div className="min-h-screen bg-slate-100 flex">

      {/* Notification System */}
      </* NotificationSystem
        inventory={inventory}
        onReorder={() => setCurrentView('inventory')}
      /> */}

      {/* ============ SIDEBAR ============ */}
      <div className={`bg-gradient-to-b from-emerald-800 to-teal-900 text-white transition-all duration-300 ${
        sidebarOpen ? 'w-72' : 'w-20'
      } flex flex-col flex-shrink-0`}>

        {/* Logo */}
        <div className="p-6 flex items-center justify-between border-b border-emerald-700">
          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-bold">Tatva Ayurved</h1>
              <p className="text-emerald-200 text-xs">Hospital Management</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-emerald-700 rounded-lg transition-colors flex-shrink-0"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-emerald-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">
                {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-sm">
                  {currentUser.first_name} {currentUser.last_name}
                </p>
                <p className="text-emerald-200 text-xs capitalize">
                  {userRole?.replace('_', ' ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="space-y-1">
            {getNavigationItems().map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const isAdminOnly = adminOnlySections.includes(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-emerald-600 shadow-lg'
                      : 'hover:bg-emerald-700/50'
                  }`}
                  title={!sidebarOpen ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                      {isAdminOnly && (
                        <span className="text-xs bg-red-500/30 text-red-200 px-1.5 py-0.5 rounded-full">
                          Admin
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-emerald-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-700/40 rounded-xl transition-colors text-red-300 hover:text-white"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 overflow-auto">

        {/* DASHBOARD */}
        {currentView === 'dashboard' && (
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-800 mb-2">
                Welcome back, {currentUser.first_name}! 👋
              </h1>
              <p className="text-slate-600">Here's what's happening at Tatva Ayurved today</p>
            </div>
            <div className="grid grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Total Patients', value: dashboardStats.totalPatients, icon: Users, color: 'blue' },
                { label: "Today's Appointments", value: dashboardStats.todayAppointments, icon: Calendar, color: 'purple' },
                { label: 'Low Stock Items', value: dashboardStats.lowStock, icon: Package, color: 'amber' },
                { label: 'Total Revenue', value: `₹${dashboardStats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'emerald' }
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                  <div className={`w-12 h-12 bg-${stat.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                  </div>
                  <p className="text-slate-600 text-sm mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-3 gap-4">
                {getNavigationItems().filter(i => i.id !== 'dashboard').map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
                    >
                      <Icon className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      <span className="font-semibold text-slate-700 text-sm">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PATIENT PORTAL */}
        {currentView === 'patients' && (
          <PatientPortal
            supabase={supabase}
            currentUser={currentUser}
            userRole={userRole}
          />
        )}

        {/* INVENTORY */}
        {currentView === 'inventory' && (
          <InventoryManagement
            inventory={inventory}
            setInventory={setInventory}
            userRole={userRole}
          />
        )}

        {/* PRESCRIPTIONS */}
        {currentView === 'prescriptions' && (
          <PrescriptionWithInventory
            inventory={inventory}
            updateInventory={updateInventory}
            userRole={userRole}
            currentUser={currentUser}
            supabase={supabase}
          />
        )}

        {/* ANALYTICS */}
        {currentView === 'analytics' && (
          <InventoryAnalytics
            inventory={inventory}
            salesHistory={salesHistory}
          />
        )}

        {/* SCHEDULING */}
        {currentView === 'scheduling' && (
          <AdvancedScheduling
            appointments={appointments}
            setAppointments={setAppointments}
            userRole={userRole}
          />
        )}

        {/* FINANCIAL - Admin only */}
        {currentView === 'financial' && userRole === 'admin' && (
          <FinancialReports
            inventory={inventory}
            salesHistory={salesHistory}
            userRole={userRole}
          />
        )}

        {/* HR & PAYROLL - Admin only */}
        {currentView === 'hr-payroll' && userRole === 'admin' && (
          <HRPayrollModule
            userRole={userRole}
            currentUser={currentUser}
          />
        )}

        {/* USER MANAGEMENT - Admin only */}
        {currentView === 'user-management' && userRole === 'admin' && (
          <AdminUserPortal
            supabase={supabase}
            currentUser={currentUser}
          />
        )}

        {/* DATABASE BACKUP - Admin only */}
        {currentView === 'backup' && userRole === 'admin' && (
          <DatabaseBackupRestore
            supabase={supabase}
            userRole={userRole}
          />
        )}

        {/* ACCESS DENIED */}
        {adminOnlySections.includes(currentView) && userRole !== 'admin' && (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center bg-white rounded-3xl shadow-xl p-12 max-w-md">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
              <p className="text-slate-600 mb-6">This section is restricted to Administrators only.</p>
              <button
                onClick={() => setCurrentView('dashboard')}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MainDashboard;
