import React, { useState, useEffect, useRef } from 'react';
import {
  Home, Users, Package, FileText, Receipt, TrendingUp,
  Calendar, IndianRupee, UserCog, Database, LogOut,
  ShoppingCart, Utensils, BarChart3, Wallet, History, FileBarChart,
  Menu, X, BedDouble
} from 'lucide-react';
import { db, auth } from './lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

// Session dates are bucketed by IST calendar day (not UTC), so a login just after
// midnight IST doesn't get mis-filed under the previous day in the User Activity report.
const toISTDateStr = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);

// Import components
import Login from './components/Login';
import AdminUserPortal from './components/AdminUserPortal';
import PatientPortal from './components/PatientPortal';
import PatientRegistrationNew from './components/PatientRegistrationNew';
import InventoryManagement from './components/InventoryManagement';
import MessExpenseTracker from './components/MessExpenseTracker';
import MessManagement from './components/MessManagement';
import DietModule from './components/DietModule';
import InventoryAnalytics from './components/InventoryAnalytics';
import MedicineOrderingTable from './components/MedicineOrderingTable';
import InvoicesManagement from './components/InvoicesManagement';
import DischargeManagement from './components/DischargeManagement';
import LeadManagement from './components/LeadManagement';
import PackageManagement from './components/PackageManagement';
import TreatmentCharges from './components/TreatmentCharges';
import Dashboard from './components/Dashboard';
import ProfitLoss from './components/ProfitLoss';
import Financials from './components/Financials';
import AIAssist from './components/AIAssist';
import PurchaseManagement from './components/PurchaseManagement';
import AppointmentScheduling from './components/AppointmentScheduling';
import RoomManagement from './components/RoomManagement';
import UserManagement, { getUserPermissions, hasModuleAccess } from './components/UserManagement';
import HRPayrollModule from './components/HRPayrollModule';
import UserActivityReport from './components/UserActivityReport';
import Reports from './components/Reports';
import DatabaseBackupRestore from './components/DatabaseBackupRestore';
import { subscribeAdminSectionHidden, setAdminSectionHidden } from './lib/appSettings';

// Gates only *showing* the Administration menu again — hiding it needs no
// gate, since that only narrows what a shared login can reach. This is a
// speed bump against casual staff un-hiding it themselves while everyone
// shares one admin login, not a real access control (anyone with that
// login already has full data access regardless of this menu).
const ADMIN_SECTION_UNLOCK_CODE = '2304';

function App() {
  // DEBUG VERSION - Updated 2026-05-22 - New Patient Button Fix
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showRegistration, setShowRegistration] = useState(false);
  const [initialPatientId, setInitialPatientId] = useState(null);
  const [initialInvoicePatientId, setInitialInvoicePatientId] = useState(null);
  const [registrationPrefillData, setRegistrationPrefillData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Defaults to hidden (not false) so there's no flash of the Administration
  // menu before the Firestore listener resolves — see appSettings.js for why
  // hidden is the fallback everywhere else too.
  const [hideAdminSection, setHideAdminSection] = useState(true);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [unlockCodeInput, setUnlockCodeInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const sessionIdRef = useRef(localStorage.getItem('currentSessionId') || null);

  useEffect(() => {
    const unsubscribe = subscribeAdminSectionHidden(setHideAdminSection);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        // Resume tracking the existing login session rather than starting a new one on refresh
        if (!sessionIdRef.current) {
          startSession(user);
        }
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionToken');
      }
    }

    // Listen for navigation events from Dashboard
    const handleNavigate = (event) => {
      setCurrentView(event.detail);
      setShowRegistration(false); // Reset registration when changing views
    };
    
    // Listen for new patient registration trigger
    const handleOpenNewPatient = () => {
      setRegistrationPrefillData(null);
      setShowRegistration(true);
    };

    // Listen for "open this patient's details" trigger (e.g. clicking an
    // appointment on the Dashboard that's linked to a patient record)
    const handleViewPatient = (event) => {
      setCurrentView('patients');
      setShowRegistration(false);
      setInitialPatientId(event.detail);
    };

    // Listen for "start a discharge for this patient" trigger (Patient
    // Portal's Discharge button, Dashboard's Discharges Today card) —
    // jumps straight to a pre-filled invoice for that patient rather than
    // the Discharge Management wizard.
    const handleStartDischarge = (event) => {
      setCurrentView('invoices');
      setShowRegistration(false);
      setInitialInvoicePatientId(event.detail);
    };

    // Listen for "convert this lead to a patient" trigger (Lead Management's
    // status dropdown) — opens the real registration form pre-filled with
    // the lead's details, instead of silently writing a bare patient record.
    const handleConvertLead = (event) => {
      setCurrentView('patients');
      setRegistrationPrefillData(event.detail);
      setShowRegistration(true);
    };

    // Listen for "register this walk-in" trigger (Dashboard's Called In /
    // In the Office status on a phone-booked appointment) — opens the real
    // registration form pre-filled with the caller's name/phone; the
    // appointment itself is removed once that registration is saved.
    const handleConvertAppointment = (event) => {
      setCurrentView('patients');
      setRegistrationPrefillData(event.detail);
      setShowRegistration(true);
    };

    window.addEventListener('navigate', handleNavigate);
    window.addEventListener('openNewPatient', handleOpenNewPatient);
    window.addEventListener('viewPatient', handleViewPatient);
    window.addEventListener('startDischarge', handleStartDischarge);
    window.addEventListener('convertLeadToPatient', handleConvertLead);
    window.addEventListener('convertAppointmentToPatient', handleConvertAppointment);

    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('openNewPatient', handleOpenNewPatient);
      window.removeEventListener('viewPatient', handleViewPatient);
      window.removeEventListener('startDischarge', handleStartDischarge);
      window.removeEventListener('convertLeadToPatient', handleConvertLead);
      window.removeEventListener('convertAppointmentToPatient', handleConvertAppointment);
    };
  }, []);

  // Heartbeat: keep the current login session's last_seen fresh while the app is open,
  // so "time in system" can be approximated even if the user closes the tab without logging out.
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      if (sessionIdRef.current) {
        updateDoc(doc(db, 'user_sessions', sessionIdRef.current), {
          last_seen: new Date().toISOString(),
        }).catch(() => {});
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const startSession = async (user) => {
    try {
      const nowDate = new Date();
      const now = nowDate.toISOString();
      const docRef = await addDoc(collection(db, 'user_sessions'), {
        user_email: user.email || '',
        user_name: user.name || '',
        role: user.role || '',
        date: toISTDateStr(nowDate),
        login_at: now,
        last_seen: now,
        logged_out_at: null,
      });
      sessionIdRef.current = docRef.id;
      localStorage.setItem('currentSessionId', docRef.id);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const endSession = async () => {
    if (!sessionIdRef.current) return;
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'user_sessions', sessionIdRef.current), {
        logged_out_at: now,
        last_seen: now,
      });
    } catch (error) {
      console.error('Error ending session:', error);
    } finally {
      sessionIdRef.current = null;
      localStorage.removeItem('currentSessionId');
    }
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
    startSession(user);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      endSession();
      localStorage.removeItem('currentUser');
      localStorage.removeItem('sessionToken');
      // Best-effort — ends the app's Firebase Auth session too, if one was
      // ever established (see Login.jsx); harmless no-op otherwise.
      signOut(auth).catch(err => console.error('Firebase sign-out failed:', err));
      setCurrentUser(null);
      setCurrentView('dashboard');
    }
  };

  // Hiding needs no gate — it only narrows access. Showing the section
  // again is what needs the passcode, so a passcode prompt opens instead
  // of toggling immediately whenever the section is currently hidden.
  const handleAdminSectionToggleClick = () => {
    if (hideAdminSection) {
      setUnlockCodeInput('');
      setUnlockError('');
      setShowUnlockPrompt(true);
    } else {
      setAdminSectionHidden(true);
    }
  };

  const handleUnlockSubmit = (e) => {
    e.preventDefault();
    if (unlockCodeInput === ADMIN_SECTION_UNLOCK_CODE) {
      setAdminSectionHidden(false);
      setShowUnlockPrompt(false);
      setUnlockCodeInput('');
      setUnlockError('');
    } else {
      setUnlockError('Incorrect passcode.');
      setUnlockCodeInput('');
    }
  };

  const hasPermission = (permission) => {
    if (!currentUser) return false;
    // System admin / admin role has full access
    if (currentUser.role === 'system_admin' || currentUser.role === 'admin' || currentUser.role === 'Admin') return true;
    if (currentUser.permissions?.includes('all')) return true;
    // Check role-based module access
    if (permission && permission !== 'all') {
      return hasModuleAccess(currentUser, permission);
    }
    return currentUser.permissions?.includes(permission);
  };

  // Check if user can see a specific module
  const canAccess = (moduleId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'system_admin' || currentUser.role === 'admin' || currentUser.role === 'Admin') return true;
    if (currentUser.permissions?.includes('all')) return true;
    const userPerms = getUserPermissions(currentUser);
    return userPerms.includes(moduleId);
  };

  // If not logged in, show login
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const isAdminRole = currentUser.role === 'system_admin' || currentUser.role === 'admin' || currentUser.role === 'Admin';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, moduleId: 'dashboard' },
    { id: 'patients', label: 'Patient Portal', icon: Users, moduleId: 'patients' },
    { id: 'leads', label: 'Lead Management', icon: TrendingUp, moduleId: 'leads' },
    { id: 'inventory', label: 'Inventory', icon: Package, moduleId: 'inventory' },
    { id: 'packages', label: 'Treatment Packages', icon: Package, moduleId: 'packages' },
    { id: 'treatment-charges', label: 'Treatment Charges', icon: IndianRupee, moduleId: 'treatment-charges' },
    { id: 'purchase', label: 'Purchase Management', icon: ShoppingCart, moduleId: 'purchase' },
    { id: 'ai-assist', label: 'AI Assist', icon: TrendingUp, moduleId: 'ai-assist' },
    { id: 'prescriptions', label: 'Prescriptions', icon: FileText, moduleId: 'prescriptions' },
    { id: 'invoices', label: 'Invoices', icon: Receipt, moduleId: 'invoices' },
    { id: 'discharge', label: 'Discharge', icon: FileText, moduleId: 'discharge' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, moduleId: 'analytics' },
    { id: 'reports', label: 'Reports', icon: FileBarChart, moduleId: 'reports' },
    { id: 'scheduling', label: 'Scheduling', icon: Calendar, moduleId: 'scheduling' },
    { id: 'room-management', label: 'Room Management', icon: BedDouble, moduleId: 'room-management' },
    
    // Kitchen Module Section
    { id: 'kitchen-section', label: 'Kitchen', icon: null, isSectionHeader: true },
    { id: 'mess-management', label: 'Mess Management', icon: Utensils, moduleId: 'mess-management' },
    { id: 'mess-expense', label: 'Mess Expense', icon: ShoppingCart, moduleId: 'mess-expense' },
    { id: 'diet-module', label: 'Diet Plans', icon: Utensils, moduleId: 'diet-module' },
    
    // Admin Only Section — every item here also carries section:
    // 'administration' so the whole group can be hidden at once via the
    // shared hide_admin_section toggle (see the User Info block below),
    // independent of the per-item canAccess() permission check.
    { id: 'admin-section', label: 'Administration', icon: null, isSectionHeader: true, adminOnly: true, section: 'administration' },
    { id: 'profit-loss', label: 'P&L Statement', icon: IndianRupee, moduleId: 'profit-loss', section: 'administration' },
    { id: 'financials', label: 'Financials', icon: Wallet, moduleId: 'financials', section: 'administration' },
    { id: 'hr-payroll', label: 'HR & Payroll', icon: UserCog, moduleId: 'hr-payroll', badge: 'Admin', section: 'administration' },
    { id: 'user-activity', label: 'User Activity', icon: History, moduleId: 'user-activity', badge: 'Admin', section: 'administration' },
    { id: 'user-management', label: 'User Management', icon: UserCog, moduleId: 'user-management', badge: 'Admin', section: 'administration' },
    { id: 'database-backup', label: 'Database Backup', icon: Database, moduleId: 'user-management', badge: 'Admin', section: 'administration' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-teal-700 to-teal-800 text-white flex flex-col transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:static md:translate-x-0`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-teal-600">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="Tatva Ayurved"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<div class="text-2xl font-bold text-teal-600">TA</div>';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">Tatva Ayurved</h1>
              <p className="text-xs text-teal-200">Hospital Management</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 text-teal-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-teal-600">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-lg font-bold">
              {currentUser.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name || 'User'}</p>
              <p className="text-xs text-teal-200 truncate">{currentUser.role || 'Staff'}</p>
            </div>
          </div>
          {/* Lives outside the Administration section on purpose — it has to
              stay reachable even while that section is hidden, since this is
              the only way to bring it back. */}
          {isAdminRole && (
            <button
              onClick={handleAdminSectionToggleClick}
              className="mt-3 w-full text-left text-[11px] text-teal-200 hover:text-white underline decoration-dotted underline-offset-2"
              title={hideAdminSection
                ? 'Administration menu is hidden while staff share this login — click to show it again (passcode required)'
                : 'Hide the Administration menu (P&L, Financials, HR & Payroll, User Activity, User Management, Database Backup) while staff share this login'}
            >
              {hideAdminSection ? '👁 Show Administration menu' : '🙈 Hide Administration menu'}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => {
            // Section headers
            if (item.isSectionHeader) {
              if (item.adminOnly && !canAccess('user-management')) return null;
              if (item.section === 'administration' && hideAdminSection && isAdminRole) return null;
              return (
                <div key={item.id} className="px-4 py-2 mt-4">
                  <p className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
                    {item.label}
                  </p>
                </div>
              );
            }

            // Check permissions - use role-based access
            if (item.moduleId && !canAccess(item.moduleId)) return null;
            if (item.section === 'administration' && hideAdminSection && isAdminRole) return null;

            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => { setCurrentView(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-teal-600 border-l-4 border-white'
                    : 'hover:bg-teal-600/50 border-l-4 border-transparent'
                }`}
              >
                {Icon && <Icon className="w-5 h-5" />}
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-teal-600">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-teal-600 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-teal-600 text-center">
          <p className="text-xs text-teal-300">Tatva Ayurved HMS v2.0</p>
          <p className="text-xs text-teal-400 mt-1">Powered by Firebase</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-600 hover:text-teal-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-semibold text-gray-800">Tatva Ayurved</span>
        </div>

        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'patients' && !showRegistration && (
          <PatientPortal
            onAddPatient={() => setShowRegistration(true)}
            initialPatientId={initialPatientId}
            onInitialPatientHandled={() => setInitialPatientId(null)}
          />
        )}
        
        {currentView === 'patients' && showRegistration && (
          <PatientRegistrationNew
            prefillData={registrationPrefillData}
            onClose={() => { setShowRegistration(false); setRegistrationPrefillData(null); }}
            onSuccess={() => setRegistrationPrefillData(null)}
          />
        )}
        {currentView === 'leads' && <LeadManagement />}
        {currentView === 'inventory' && <InventoryManagement />}
        {currentView === 'packages' && <PackageManagement />}
        {currentView === 'treatment-charges' && <TreatmentCharges />}
        {currentView === 'purchase' && <PurchaseManagement />}
        {currentView === 'ai-assist' && <AIAssist />}
        {currentView === 'mess-management' && <MessManagement />}
        {currentView === 'mess-expense' && <MessExpenseTracker />}
        {currentView === 'diet-module' && <DietModule />}
        {currentView === 'analytics' && <InventoryAnalytics />}
        {currentView === 'reports' && <Reports />}
        {currentView === 'invoices' && (
          <InvoicesManagement
            initialPatientId={initialInvoicePatientId}
            onInitialPatientHandled={() => setInitialInvoicePatientId(null)}
          />
        )}
        {currentView === 'discharge' && <DischargeManagement />}
        
        {currentView === 'prescriptions' && (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Prescriptions</h1>
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Use Patient Portal to manage prescriptions</p>
              <button
                onClick={() => setCurrentView('patients')}
                className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Go to Patient Portal
              </button>
            </div>
          </div>
        )}

        {currentView === 'scheduling' && <AppointmentScheduling />}

        {currentView === 'room-management' && <RoomManagement />}

        {currentView === 'profit-loss' && <ProfitLoss />}

        {currentView === 'financials' && <Financials />}

        {currentView === 'hr-payroll' && <HRPayrollModule userRole={currentUser?.role} currentUser={currentUser} />}

        {currentView === 'user-activity' && <UserActivityReport />}

        {currentView === 'user-management' && <UserManagement />}
        
        {currentView === 'database-backup' && <DatabaseBackupRestore />}
      </div>

      {showUnlockPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Show Administration menu</h3>
            <p className="text-sm text-gray-500 mb-4">Enter the passcode to bring it back.</p>
            <form onSubmit={handleUnlockSubmit}>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={unlockCodeInput}
                onChange={(e) => { setUnlockCodeInput(e.target.value); setUnlockError(''); }}
                className={`w-full px-4 py-2 border rounded-lg mb-1 focus:outline-none focus:ring-2 ${
                  unlockError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-teal-500'
                }`}
                placeholder="Passcode"
              />
              {unlockError && <p className="text-xs text-red-600 mb-3">{unlockError}</p>}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => { setShowUnlockPrompt(false); setUnlockCodeInput(''); setUnlockError(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
