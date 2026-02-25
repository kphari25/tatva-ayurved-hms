import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, FileText, Package, Activity,
  TrendingUp, Calendar, DollarSign, Database, Menu, X,
  LogOut, User, Shield, Briefcase, Stethoscope, Lock
} from 'lucide-react';

// Import components
import ChangePassword from './components/ChangePassword';
import InvoiceModule from './components/InvoiceModule';
import PatientPortal from './components/PatientPortal';
import InventoryManagement from './components/InventoryManagement';
import PrescriptionWithInventory from './components/PrescriptionWithInventory';
import InventoryAnalytics from './components/InventoryAnalytics';
import AdvancedScheduling from './components/AdvancedScheduling';
import FinancialReports from './components/FinancialReports';
import HRPayrollModule from './components/HRPayrollModule';
import AdminUserPortal from './components/AdminUserPortal';
import DatabaseBackupRestore from './components/DatabaseBackupRestore';

const MainDashboard = ({ supabase }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setCurrentUser(profile);
          setUserRole(profile.role);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const updateInventory = (medicineName, quantityUsed) => {
    setInventory(prev => prev.map(item =>
      item.name === medicineName
        ? { ...item, quantity: item.quantity - quantityUsed }
        : item
    ));
  };

  // Navigation items with colors
  const navItems = [
    {
       id: 'change-password',
       label: 'Change Password',
      icon: Lock,  // Add Lock to your imports from lucide-react
      roles: ['admin', 'doctor', 'front_desk', 'pharmacist']
    },
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      hoverColor: 'hover:bg-blue-50',
      roles: ['admin', 'doctor', 'therapist', 'front_desk', 'pharmacy'] 
    },
    { 
      id: 'patients', 
      label: 'Patient Portal', 
      icon: Users, 
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
      hoverColor: 'hover:bg-purple-50',
      roles: ['admin', 'doctor', 'therapist', 'front_desk'] 
    },
    {
      id: 'invoices',
      label: 'OP Invoices',
      icon: FileText,
      roles: ['admin', 'doctor', 'front_desk']
    },
    { 
      id: 'inventory', 
      label: 'Inventory', 
      icon: Package, 
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600',
      hoverColor: 'hover:bg-orange-50',
      roles: ['admin', 'doctor', 'pharmacy'] 
    },
    { 
      id: 'prescriptions', 
      label: 'Prescriptions', 
      icon: Stethoscope, 
      color: 'pink',
      bgColor: 'bg-pink-100',
      textColor: 'text-pink-600',
      hoverColor: 'hover:bg-pink-50',
      roles: ['admin', 'doctor'] 
    },
    { 
      id: 'analytics', 
      label: 'Analytics', 
      icon: TrendingUp, 
      color: 'indigo',
      bgColor: 'bg-indigo-100',
      textColor: 'text-indigo-600',
      hoverColor: 'hover:bg-indigo-50',
      roles: ['admin', 'pharmacy'] 
    },
    { 
      id: 'scheduling', 
      label: 'Scheduling', 
      icon: Calendar, 
      color: 'cyan',
      bgColor: 'bg-cyan-100',
      textColor: 'text-cyan-600',
      hoverColor: 'hover:bg-cyan-50',
      roles: ['admin', 'doctor', 'front_desk'] 
    },
    { 
      id: 'financial', 
      label: 'Financial Reports', 
      icon: DollarSign, 
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600',
      hoverColor: 'hover:bg-green-50',
      roles: ['admin'] 
    },
    { 
      id: 'hr-payroll', 
      label: 'HR & Payroll', 
      icon: Briefcase, 
      color: 'teal',
      bgColor: 'bg-teal-100',
      textColor: 'text-teal-600',
      hoverColor: 'hover:bg-teal-50',
      roles: ['admin'] 
    },
    { 
      id: 'user-management', 
      label: 'User Management', 
      icon: Shield, 
      color: 'red',
      bgColor: 'bg-red-100',
      textColor: 'text-red-600',
      hoverColor: 'hover:bg-red-50',
      roles: ['admin'] 
    },
    { 
      id: 'backup', 
      label: 'Database Backup', 
      icon: Database, 
      color: 'slate',
      bgColor: 'bg-slate-100',
      textColor: 'text-slate-600',
      hoverColor: 'hover:bg-slate-50',
      roles: ['admin'] 
    }
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(userRole));

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 text-slate-700 transition-all duration-300 flex flex-col shadow-lg`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="flex items-center justify-between">
            <div className={`${sidebarOpen ? 'block' : 'hidden'}`}>
              <h1 className="text-xl font-bold text-white">Tatva Ayurved</h1>
              <p className="text-xs text-emerald-100">Hospital Management</p>
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-emerald-700 rounded-lg text-white">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-lg">
              {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
            </div>
            {sidebarOpen && (
              <div>
                <p className="font-semibold text-sm text-slate-800">{currentUser.first_name} {currentUser.last_name}</p>
                <p className="text-xs text-emerald-600 capitalize font-medium">{userRole}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-xl transition-all ${
                currentView === item.id
                  ? `${item.bgColor} ${item.textColor} shadow-md font-semibold`
                  : `text-slate-600 ${item.hoverColor} hover:shadow-sm`
              }`}
            >
              <div className={`${currentView === item.id ? item.textColor : 'text-slate-400'}`}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
              </div>
              {sidebarOpen && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Dashboard */}
        {currentView === 'dashboard' && (
          <div className="p-8">
            <h1 className="text-4xl font-bold mb-2">Welcome back, {currentUser.first_name}! 👋</h1>
            <p className="text-slate-600 mb-8">Here's what's happening at Tatva Ayurved today</p>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-slate-600 text-sm mb-1">Total Patients</p>
                <p className="text-3xl font-bold text-slate-800">1</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-slate-600 text-sm mb-1">Today's Appointments</p>
                <p className="text-3xl font-bold text-slate-800">0</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                  <Package className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-slate-600 text-sm mb-1">Low Stock Items</p>
                <p className="text-3xl font-bold text-slate-800">1</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-slate-600 text-sm mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-slate-800">₹0</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
              <h3 className="text-xl font-bold mb-6 text-slate-800">Quick Actions</h3>
              <div className="grid grid-cols-3 gap-4">
                {visibleNavItems.slice(1).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`p-6 border-2 border-slate-200 rounded-xl ${item.hoverColor} hover:border-${item.color}-300 hover:shadow-md transition-all text-left group`}
                  >
                    <div className={`w-10 h-10 ${item.bgColor} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <item.icon className={`w-6 h-6 ${item.textColor}`} />
                    </div>
                    <p className="font-semibold text-slate-700">{item.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Other Views */}
        {currentView === 'patients' && (
          <PatientPortal supabase={supabase} currentUser={currentUser} userRole={userRole} />
        )}

        {currentView === 'invoices' && (
          <InvoiceModule  supabase={supabase} currentUser={currentUser} userRole={userRole} />
        )}

        {currentView === 'inventory' && (
          <InventoryManagement inventory={inventory} setInventory={setInventory} userRole={userRole} supabase={supabase} />
        )}

        {currentView === 'prescriptions' && (
          <PrescriptionWithInventory
            inventory={inventory}
            updateInventory={updateInventory}
            userRole={userRole}
            currentUser={currentUser}
            supabase={supabase}
          />
        )}

        {currentView === 'change-password' && (
          <ChangePassword supabase={supabase} currentUser={currentUser} />
        )}
        {currentView === 'analytics' && (
          <InventoryAnalytics inventory={inventory} salesHistory={salesHistory} />
        )}

        {currentView === 'scheduling' && (
          <AdvancedScheduling appointments={appointments} setAppointments={setAppointments} userRole={userRole} />
        )}

        {currentView === 'financial' && userRole === 'admin' && (
          <FinancialReports inventory={inventory} salesHistory={salesHistory} userRole={userRole} />
        )}

        {currentView === 'hr-payroll' && userRole === 'admin' && (
          <HRPayrollModule userRole={userRole} currentUser={currentUser} />
        )}

        {currentView === 'user-management' && userRole === 'admin' && (
          <AdminUserPortal supabase={supabase} currentUser={currentUser} />
        )}

        {currentView === 'backup' && userRole === 'admin' && (
          <DatabaseBackupRestore supabase={supabase} userRole={userRole} />
        )}
      </div>
    </div>
  );
};

export default MainDashboard;
