import { useState } from 'react';
import { 
  Home, Users, Calendar, FileText, Package, 
  DollarSign, Settings, X, UserPlus,
  ClipboardList, Activity, TrendingUp, 
  Database, LogOut, ChevronRight, Receipt
} from 'lucide-react';
import PatientRegistrationNew from './components/PatientRegistrationNew';
import AyurvedicInvoice from './components/AyurvedicInvoice';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [showPatientRegistration, setShowPatientRegistration] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceType, setInvoiceType] = useState('OP');

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'patients', name: 'Patient Portal', icon: Users },
    { id: 'inventory', name: 'Inventory', icon: Package },
    { id: 'prescriptions', name: 'Prescriptions', icon: FileText },
    { id: 'invoices', name: 'Invoices', icon: Receipt },
    { id: 'analytics', name: 'Analytics', icon: TrendingUp },
    { id: 'scheduling', name: 'Scheduling', icon: Calendar },
    { id: 'financial', name: 'Financial Reports', icon: DollarSign, admin: true },
    { id: 'hr', name: 'HR & Payroll', icon: Users, admin: true },
    { id: 'user', name: 'User Management', icon: ClipboardList, admin: true },
    { id: 'database', name: 'Database Backup', icon: Database, admin: true },
  ];

  const quickActions = [
    { name: 'Patient Portal', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => setCurrentView('patients') },
    { name: 'Inventory', icon: Package, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => setCurrentView('inventory') },
    { name: 'OP Invoice', icon: Receipt, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => { setInvoiceType('OP'); setShowInvoice(true); } },
    { name: 'IP Invoice', icon: Receipt, color: 'text-purple-600', bg: 'bg-purple-50', onClick: () => { setInvoiceType('IP'); setShowInvoice(true); } },
    { name: 'Prescriptions', icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => setCurrentView('prescriptions') },
    { name: 'Analytics', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => setCurrentView('analytics') },
    { name: 'Scheduling', icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => setCurrentView('scheduling') },
    { name: 'User Management', icon: ClipboardList, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => setCurrentView('user') },
    { name: 'Financial Reports', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50', onClick: () => setCurrentView('financial') },
  ];

  const handlePatientRegistrationClose = (patient) => {
    if (patient) {
      alert(`✅ Patient Registered Successfully!\n\nPatient Number: ${patient.patient_number}\nName: ${patient.first_name} ${patient.last_name}`);
    }
    setShowPatientRegistration(false);
  };

  const handleInvoiceClose = () => {
    setShowInvoice(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar - Exact Teal Color */}
      <div className="w-64 bg-[#0A5F55] text-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-teal-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Tatva Ayurved</h1>
              <p className="text-xs text-teal-300">Hospital Management System</p>
            </div>
            <button className="p-1 hover:bg-teal-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Admin User */}
        <div className="px-4 py-4 border-b border-teal-700">
          <div className="flex items-center space-x-3 bg-teal-700 bg-opacity-40 rounded-lg p-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-teal-700 font-bold text-sm">AA</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Admin Administrator</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all text-sm ${
                currentView === item.id
                  ? 'bg-teal-500 text-white'
                  : 'bg-teal-600 bg-opacity-50 text-white hover:bg-teal-500'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                {item.admin && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded">
                    Admin
                  </span>
                )}
                {currentView === item.id && <ChevronRight className="w-4 h-4" />}
              </div>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-teal-700">
          <button className="w-full flex items-center space-x-3 px-4 py-2.5 bg-teal-600 bg-opacity-50 text-white hover:bg-teal-500 rounded-lg transition-all text-sm">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              Welcome back, Admin! 👋
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Here's what is happening in Tatva Ayurved today
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-8">
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Patients</p>
                      <p className="text-3xl font-bold text-gray-800">1</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Today's Appointments</p>
                      <p className="text-3xl font-bold text-gray-800">0</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Low Stock Items</p>
                    <p className="text-3xl font-bold text-gray-800">1</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center mt-2">
                    <Package className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold text-gray-800">₹0</p>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mt-2">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-3 gap-4">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.onClick}
                      className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 ${action.bg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <action.icon className={`w-6 h-6 ${action.color}`} />
                        </div>
                        <span className="font-medium text-gray-800">{action.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Register New Patient CTA */}
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl shadow-lg p-8 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Register New Patient</h3>
                    <p className="text-teal-100">
                      Click below to register a new patient with complete medical history
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPatientRegistration(true)}
                    className="flex items-center space-x-2 px-8 py-4 bg-white text-teal-700 rounded-lg hover:bg-teal-50 transition-colors font-semibold shadow-lg"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>New Patient</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Patient Portal */}
          {currentView === 'patients' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <div className="text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">Patient Portal</h3>
                <p className="text-gray-600 mb-6">View and manage all registered patients</p>
                <button
                  onClick={() => setShowPatientRegistration(true)}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Register New Patient
                </button>
              </div>
            </div>
          )}

          {/* Inventory */}
          {currentView === 'inventory' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center">
                    <Package className="w-6 h-6 text-teal-600 mr-3" />
                    Inventory Management
                  </h3>
                  <p className="text-gray-600 mt-1">Manage medicines and medical supplies</p>
                </div>
                
                {/* Import/Export Buttons */}
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer transition-colors">
                    <UserPlus className="w-5 h-5" />
                    <span>Import Excel</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          alert(`📊 Excel file "${file.name}" selected!\n\nThis would import your inventory data.`);
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={() => {
                      const data = "Month,Item Code,Item Name,Stock Quantity,Purchase Rate,Sale Rate,MRP\nFebruary,MED001,Ashwagandha Churna,500,400,480,500\nFebruary,MED002,Triphala Powder,50,200,240,250\nFebruary,MED003,Brahmi Oil,200,350,420,450";
                      const blob = new Blob([data], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'inventory_template.csv';
                      a.click();
                      alert('📥 Template downloaded!');
                    }}
                    className="flex items-center space-x-2 px-4 py-2 border-2 border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                    <span>Download Template</span>
                  </button>
                </div>
              </div>

              {/* Excel Template Info */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">📋 Excel Template Format</h4>
                <p className="text-sm text-blue-800 mb-3">
                  Use the following columns in your Excel file:
                </p>
                <div className="grid grid-cols-7 gap-2 text-xs">
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <span className="font-semibold text-blue-900">Month</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <span className="font-semibold text-blue-900">Item Code</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <span className="font-semibold text-blue-900">Item Name</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <span className="font-semibold text-blue-900">Stock Qty</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <span className="font-semibold text-blue-900">P Rate</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <span className="font-semibold text-blue-900">S Rate</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <span className="font-semibold text-blue-900">MRP</span>
                  </div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="border-2 border-teal-200 rounded-lg p-6 text-center hover:bg-teal-50 cursor-pointer transition-colors">
                  <Package className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                  <p className="font-semibold text-gray-800">View Inventory</p>
                </div>
                <div className="border-2 border-teal-200 rounded-lg p-6 text-center hover:bg-teal-50 cursor-pointer transition-colors">
                  <UserPlus className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                  <p className="font-semibold text-gray-800">Add New Item</p>
                </div>
                <div className="border-2 border-teal-200 rounded-lg p-6 text-center hover:bg-teal-50 cursor-pointer transition-colors">
                  <TrendingUp className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                  <p className="font-semibold text-gray-800">Low Stock Alert</p>
                </div>
              </div>
              
              {/* Sample Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Month</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Item Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">P Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">S Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">MRP</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">February</td>
                      <td className="px-4 py-3 font-mono">MED001</td>
                      <td className="px-4 py-3 font-medium">Ashwagandha Churna</td>
                      <td className="px-4 py-3">500g</td>
                      <td className="px-4 py-3">₹400</td>
                      <td className="px-4 py-3">₹480</td>
                      <td className="px-4 py-3 font-semibold">₹500</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">In Stock</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invoices Page */}
          {currentView === 'invoices' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <div className="text-center mb-8">
                <Receipt className="w-16 h-16 text-teal-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">Invoice Management</h3>
                <p className="text-gray-600">Create and manage patient invoices</p>
              </div>

              {/* Invoice Type Cards */}
              <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* OP Invoice Card */}
                <div className="border-2 border-blue-200 rounded-xl p-8 text-center hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group"
                     onClick={() => { setInvoiceType('OP'); setShowInvoice(true); }}>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Receipt className="w-10 h-10 text-blue-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">Out-Patient Invoice</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    For consultations, treatments, and medicines
                  </p>
                  <ul className="text-xs text-left text-gray-600 space-y-1 mb-6">
                    <li>✓ Consultation Fees</li>
                    <li>✓ Treatment Charges</li>
                    <li>✓ Medicine Billing</li>
                    <li>✓ GST Calculation</li>
                  </ul>
                  <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                    Create OP Invoice
                  </button>
                </div>

                {/* IP Invoice Card */}
                <div className="border-2 border-purple-200 rounded-xl p-8 text-center hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer group"
                     onClick={() => { setInvoiceType('IP'); setShowInvoice(true); }}>
                  <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Receipt className="w-10 h-10 text-purple-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">In-Patient Invoice</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    For admitted patients with room charges
                  </p>
                  <ul className="text-xs text-left text-gray-600 space-y-1 mb-6">
                    <li>✓ Room Rent (Daily)</li>
                    <li>✓ Treatment & Therapy</li>
                    <li>✓ Diet/Mess Charges</li>
                    <li>✓ Medicine & Supplies</li>
                  </ul>
                  <button className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold">
                    Create IP Invoice
                  </button>
                </div>
              </div>

              {/* Recent Invoices Section */}
              <div className="mt-12">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Recent Invoices</h4>
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p>No invoices created yet</p>
                  <p className="text-sm mt-1">Click above to create your first invoice</p>
                </div>
              </div>
            </div>
          )}

          {/* Other Views - Placeholders */}
          {currentView === 'prescriptions' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Prescriptions</h3>
              <p className="text-gray-600">Create and manage patient prescriptions</p>
            </div>
          )}

          {currentView === 'analytics' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Analytics</h3>
              <p className="text-gray-600">View hospital analytics and insights</p>
            </div>
          )}

          {currentView === 'scheduling' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Scheduling</h3>
              <p className="text-gray-600">Manage appointments and schedules</p>
            </div>
          )}

          {currentView === 'financial' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Financial Reports</h3>
              <p className="text-gray-600">View financial reports and analytics</p>
              <div className="mt-4 inline-block px-3 py-1 bg-red-100 text-red-700 text-sm rounded">
                Admin Access Required
              </div>
            </div>
          )}

          {currentView === 'hr' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">HR & Payroll</h3>
              <p className="text-gray-600">Manage staff and payroll</p>
              <div className="mt-4 inline-block px-3 py-1 bg-red-100 text-red-700 text-sm rounded">
                Admin Access Required
              </div>
            </div>
          )}

          {currentView === 'user' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">User Management</h3>
              <p className="text-gray-600">Manage system users and permissions</p>
              <div className="mt-4 inline-block px-3 py-1 bg-red-100 text-red-700 text-sm rounded">
                Admin Access Required
              </div>
            </div>
          )}

          {currentView === 'database' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Database Backup</h3>
              <p className="text-gray-600">Backup and restore database</p>
              <div className="mt-4 inline-block px-3 py-1 bg-red-100 text-red-700 text-sm rounded">
                Admin Access Required
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Patient Registration Modal */}
      {showPatientRegistration && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50">
          <PatientRegistrationNew onClose={handlePatientRegistrationClose} />
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoice && (
        <div className="fixed inset-0 z-50">
          <AyurvedicInvoice 
            invoiceType={invoiceType}
            onClose={handleInvoiceClose}
          />
        </div>
      )}
    </div>
  );
}

export default App;
