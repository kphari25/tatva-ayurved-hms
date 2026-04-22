import React, { useState, useEffect } from 'react';
import { 
  Home, Users, Package, FileText, Receipt, TrendingUp, 
  Calendar, DollarSign, UserCog, Database, LogOut,
  ShoppingCart, Utensils, BarChart3
} from 'lucide-react';

// Import components
import Login from './components/Login';
import AdminUserPortal from './components/AdminUserPortal';
import PatientPortal from './components/PatientPortal';
import PatientRegistrationNew from './components/PatientRegistrationNew';
import InventoryManagement from './components/InventoryManagement';
import MessExpenseTracker from './components/MessExpenseTracker';
import DietModule from './components/DietModule';
import InventoryAnalytics from './components/InventoryAnalytics';
import MedicineOrderingTable from './components/MedicineOrderingTable';
import InvoicesManagement from './components/InvoicesManagement';
import DischargeManagement from './components/DischargeManagement';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('currentUser');
      setCurrentUser(null);
      setCurrentView('dashboard');
    }
  };

  const hasPermission = (permission) => {
    if (!currentUser) return false;
    if (currentUser.permissions?.includes('all')) return true;
    return currentUser.permissions?.includes(permission);
  };

  // If not logged in, show login
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, permission: null },
    { id: 'patients', label: 'Patient Portal', icon: Users, permission: 'patients' },
    { id: 'inventory', label: 'Inventory', icon: Package, permission: 'inventory' },
    { id: 'prescriptions', label: 'Prescriptions', icon: FileText, permission: 'prescriptions' },
    { id: 'invoices', label: 'Invoices', icon: Receipt, permission: 'invoices' },
    { id: 'discharge', label: 'Discharge', icon: FileText, permission: 'invoices' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, permission: 'analytics' },
    { id: 'scheduling', label: 'Scheduling', icon: Calendar, permission: 'appointments' },
    
    // Kitchen Module Section
    { id: 'kitchen-section', label: 'Kitchen', icon: null, isSectionHeader: true },
    { id: 'mess-expense', label: 'Mess Expense', icon: ShoppingCart, permission: null },
    { id: 'diet-module', label: 'Diet Plans', icon: Utensils, permission: null },
    
    // Admin Only Section
    { id: 'admin-section', label: 'Administration', icon: null, isSectionHeader: true, adminOnly: true },
    { id: 'financial-reports', label: 'Financial Reports', icon: DollarSign, permission: 'all', badge: 'Admin' },
    { id: 'hr-payroll', label: 'HR & Payroll', icon: UserCog, permission: 'all', badge: 'Admin' },
    { id: 'user-management', label: 'User Management', icon: UserCog, permission: 'all', badge: 'Admin' },
    { id: 'database-backup', label: 'Database Backup', icon: Database, permission: 'all', badge: 'Admin' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gradient-to-b from-teal-700 to-teal-800 text-white flex flex-col">
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
            <div>
              <h1 className="text-xl font-bold">Tatva Ayurved</h1>
              <p className="text-xs text-teal-200">Hospital Management</p>
            </div>
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
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => {
            // Section headers
            if (item.isSectionHeader) {
              if (item.adminOnly && !hasPermission('all')) return null;
              return (
                <div key={item.id} className="px-4 py-2 mt-4">
                  <p className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
                    {item.label}
                  </p>
                </div>
              );
            }

            // Check permissions
            if (item.permission && !hasPermission(item.permission)) return null;

            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
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
      <div className="flex-1 overflow-auto">
        {currentView === 'dashboard' && <AdminUserPortal />}
        {currentView === 'patients' && <PatientPortal />}
        {currentView === 'inventory' && <InventoryManagement />}
        {currentView === 'mess-expense' && <MessExpenseTracker />}
        {currentView === 'diet-module' && <DietModule />}
        {currentView === 'analytics' && <InventoryAnalytics />}
        {currentView === 'invoices' && <InvoicesManagement />}
        {currentView === 'discharge' && <DischargeManagement />}
        
        {currentView === 'prescriptions' && (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Scheduling</h1>
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Scheduling - Coming soon!</p>
            </div>
          </div>
        )}
        
        {currentView === 'financial-reports' && (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Financial Reports</h1>
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Admin Only</p>
            </div>
          </div>
        )}
        
        {currentView === 'hr-payroll' && (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">HR & Payroll</h1>
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <UserCog className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Admin Only</p>
            </div>
          </div>
        )}
        
        {currentView === 'user-management' && (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">User Management</h1>
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <UserCog className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Admin Only</p>
            </div>
          </div>
        )}
        
        {currentView === 'database-backup' && (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Database Backup</h1>
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
              <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Admin Only</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
