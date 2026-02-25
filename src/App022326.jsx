import { useState } from 'react';
import { 
  Home, Users, Calendar, FileText, Package, 
  DollarSign, Settings, Menu, X, UserPlus,
  ClipboardList, Activity, Pill
} from 'lucide-react';
import PatientRegistrationNew from './components/PatientRegistrationNew';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showPatientRegistration, setShowPatientRegistration] = useState(false);

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'patients', name: 'Patients', icon: Users },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'consultations', name: 'Consultations', icon: ClipboardList },
    { id: 'inventory', name: 'Inventory', icon: Package },
    { id: 'invoices', name: 'OP Invoices', icon: FileText },
    { id: 'billing', name: 'Billing', icon: DollarSign },
    { id: 'reports', name: 'Reports', icon: Activity },
  ];

  const handlePatientRegistrationClose = (patient) => {
    if (patient) {
      console.log('New patient registered:', patient);
      alert(`✅ Patient Registered Successfully!\n\nPatient Number: ${patient.patient_number}\nName: ${patient.first_name} ${patient.last_name}`);
      // Here you can:
      // - Refresh patient list
      // - Navigate to patient profile
      // - Update dashboard stats
      // etc.
    }
    setShowPatientRegistration(false);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-emerald-800 to-emerald-900 text-white transition-all duration-300 flex flex-col`}>
        {/* Logo & Toggle */}
        <div className="p-4 border-b border-emerald-700">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                  <Pill className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Tatva Ayurved</h1>
                  <p className="text-xs text-emerald-200">HMS</p>
                </div>
              </div>
            ) : (
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mx-auto">
                <Pill className="w-6 h-6 text-emerald-700" />
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* New Patient Button */}
        <div className="p-4 border-b border-emerald-700">
          <button
            onClick={() => setShowPatientRegistration(true)}
            className={`w-full flex items-center ${sidebarOpen ? 'space-x-3 justify-start' : 'justify-center'} px-4 py-3 bg-white text-emerald-800 rounded-lg hover:bg-emerald-50 transition-all shadow-lg font-semibold`}
          >
            <UserPlus className="w-5 h-5" />
            {sidebarOpen && <span>New Patient</span>}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center ${sidebarOpen ? 'space-x-3 justify-start' : 'justify-center'} px-4 py-3 rounded-lg transition-all ${
                currentView === item.id
                  ? 'bg-white text-emerald-800 shadow-lg'
                  : 'text-emerald-100 hover:bg-emerald-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">{item.name}</span>}
            </button>
          ))}
        </nav>

        {/* Settings */}
        <div className="p-4 border-t border-emerald-700">
          <button
            onClick={() => setCurrentView('settings')}
            className={`w-full flex items-center ${sidebarOpen ? 'space-x-3 justify-start' : 'justify-center'} px-4 py-3 rounded-lg transition-all ${
              currentView === 'settings'
                ? 'bg-white text-emerald-800'
                : 'text-emerald-100 hover:bg-emerald-700'
            }`}
          >
            <Settings className="w-5 h-5" />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 capitalize">
                {currentView === 'dashboard' ? 'Dashboard' : 
                 currentView === 'patients' ? 'Patient Management' :
                 currentView === 'appointments' ? 'Appointments' :
                 currentView === 'consultations' ? 'Consultations' :
                 currentView === 'inventory' ? 'Inventory Management' :
                 currentView === 'invoices' ? 'OP Invoices' :
                 currentView === 'billing' ? 'Billing & Payments' :
                 currentView === 'reports' ? 'Reports & Analytics' :
                 currentView === 'settings' ? 'Settings' : currentView}
              </h2>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-800">Dr. Admin</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                DA
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-8">
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <div>
              <div className="grid grid-cols-4 gap-6 mb-8">
                {/* Stats Cards */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Patients</p>
                      <p className="text-3xl font-bold text-gray-800">1,234</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Today's Appointments</p>
                      <p className="text-3xl font-bold text-gray-800">18</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Pending Invoices</p>
                      <p className="text-3xl font-bold text-gray-800">7</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Revenue (Month)</p>
                      <p className="text-3xl font-bold text-gray-800">₹45.2k</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Welcome Message */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg p-8 text-white mb-8">
                <h3 className="text-2xl font-bold mb-2">Welcome to Tatva Ayurved HMS! 🌿</h3>
                <p className="text-emerald-100 mb-4">
                  Your complete hospital management solution. Click "New Patient" button to register a patient with comprehensive medical history.
                </p>
                <button
                  onClick={() => setShowPatientRegistration(true)}
                  className="px-6 py-3 bg-white text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors font-semibold shadow-lg"
                >
                  Register New Patient
                </button>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-4 gap-4">
                  <button
                    onClick={() => setShowPatientRegistration(true)}
                    className="p-4 border-2 border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    <UserPlus className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">New Patient</p>
                  </button>
                  <button
                    onClick={() => setCurrentView('appointments')}
                    className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Schedule Appointment</p>
                  </button>
                  <button
                    onClick={() => setCurrentView('invoices')}
                    className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Create Invoice</p>
                  </button>
                  <button
                    onClick={() => setCurrentView('inventory')}
                    className="p-4 border-2 border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <Package className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Manage Inventory</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Other Views - Placeholder */}
          {currentView === 'patients' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Patient Management</h3>
              <p className="text-gray-600 mb-6">View and manage all registered patients</p>
              <button
                onClick={() => setShowPatientRegistration(true)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Register New Patient
              </button>
            </div>
          )}

          {currentView === 'appointments' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Appointments</h3>
              <p className="text-gray-600">Schedule and manage patient appointments</p>
            </div>
          )}

          {currentView === 'consultations' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Consultations</h3>
              <p className="text-gray-600">Patient consultation records and history</p>
            </div>
          )}

          {currentView === 'inventory' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Inventory Management</h3>
              <p className="text-gray-600">Manage medicines and supplies</p>
            </div>
          )}

          {currentView === 'invoices' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">OP Invoices</h3>
              <p className="text-gray-600">Outpatient billing and invoices</p>
            </div>
          )}

          {currentView === 'billing' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Billing & Payments</h3>
              <p className="text-gray-600">Manage payments and financial records</p>
            </div>
          )}

          {currentView === 'reports' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Reports & Analytics</h3>
              <p className="text-gray-600">View reports and business analytics</p>
            </div>
          )}

          {currentView === 'settings' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Settings</h3>
              <p className="text-gray-600">Application settings and configuration</p>
            </div>
          )}
        </main>
      </div>

      {/* Patient Registration Modal - Full Screen Overlay */}
      {showPatientRegistration && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50">
          <PatientRegistrationNew onClose={handlePatientRegistrationClose} />
        </div>
      )}
    </div>
  );
}

export default App;
