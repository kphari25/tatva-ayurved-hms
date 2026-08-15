import React, { useState, useEffect } from 'react';
import {
  Users, Plus, X, Edit, Trash2, Shield, Eye, EyeOff,
  UserCheck, UserCog, Search, Phone, Mail, Lock,
  CheckCircle, AlertCircle, Stethoscope, Calendar,
  Package, ShoppingCart, ClipboardList, BarChart3,
  Receipt, Utensils, FileText, Home, TrendingUp, Wallet, History
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// ==========================================
// ROLE DEFINITIONS & PERMISSIONS
// ==========================================
const ROLES = {
  system_admin: {
    label: 'System Administrator',
    description: 'Full access to all features and settings',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '🛡️',
    badgeColor: 'bg-red-600'
  },
  doctor: {
    label: 'Doctor',
    description: 'Access to patient records, prescriptions, scheduling, and analytics',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '🩺',
    badgeColor: 'bg-blue-600'
  },
  therapist: {
    label: 'Therapist',
    description: 'Access to scheduling, assigned patients, and treatment records',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: '💆',
    badgeColor: 'bg-purple-600'
  },
  front_office: {
    label: 'Front Office / Receptionist',
    description: 'Patient registration, scheduling, leads, and invoicing',
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: '🏥',
    badgeColor: 'bg-teal-600'
  },
  store_admin: {
    label: 'Store Administrator',
    description: 'Inventory management, purchase orders, and stock control',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '📦',
    badgeColor: 'bg-orange-600'
  },
  kitchen_staff: {
    label: 'Kitchen Staff',
    description: 'Mess expense tracking and diet plan management',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: '🍳',
    badgeColor: 'bg-amber-600'
  },
  accountant: {
    label: 'Accountant',
    description: 'Financial reports, P&L, invoices, and expense tracking',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: '💰',
    badgeColor: 'bg-green-600'
  }
};

// Module definitions with icons
const MODULES = {
  dashboard: { label: 'Dashboard', icon: Home, description: 'Main dashboard overview' },
  patients: { label: 'Patient Portal', icon: Users, description: 'Patient registration, records, view/edit' },
  scheduling: { label: 'Scheduling', icon: Calendar, description: 'Appointment booking and therapist schedules' },
  leads: { label: 'Lead Management', icon: ClipboardList, description: 'Track and manage patient leads' },
  inventory: { label: 'Inventory', icon: Package, description: 'Medicine inventory and stock management' },
  packages: { label: 'Treatment Packages', icon: FileText, description: 'Create and manage treatment packages' },
  'treatment-charges': { label: 'Treatment Charges', icon: Receipt, description: 'View and manage the standard treatment price list' },
  purchase: { label: 'Purchase Management', icon: ShoppingCart, description: 'Purchase requests, orders, and receipts' },
  prescriptions: { label: 'Prescriptions', icon: Stethoscope, description: 'Write and manage prescriptions' },
  invoices: { label: 'Invoices', icon: Receipt, description: 'Generate and manage invoices' },
  discharge: { label: 'Discharge', icon: UserCheck, description: 'Patient discharge management' },
  analytics: { label: 'Analytics', icon: TrendingUp, description: 'Reports and analytics dashboards' },
  reports: { label: 'Reports', icon: FileText, description: 'Monthly patient intake and inventory movement reports' },
  'ai-assist': { label: 'AI Assist', icon: BarChart3, description: 'AI-powered health assistance' },
  'mess-management': { label: 'Mess Management', icon: Utensils, description: 'Assign patient meals and set meal prices' },
  'mess-expense': { label: 'Mess Expense', icon: Utensils, description: 'Kitchen expense tracking' },
  'diet-module': { label: 'Diet Plans', icon: Utensils, description: 'Patient diet plan management' },
  'profit-loss': { label: 'P&L Statement', icon: Receipt, description: 'Profit and loss reporting' },
  financials: { label: 'Financials', icon: Wallet, description: 'Consolidated financial ledger: revenue, medicine sales, and expenses' },
  'user-management': { label: 'User Management', icon: UserCog, description: 'Manage users and roles' },
  'hr-payroll': { label: 'HR & Payroll', icon: UserCog, description: 'HR and payroll management' },
  'user-activity': { label: 'User Activity', icon: History, description: 'Login/logout history and time spent in the system' }
};

// Default permissions per role
const DEFAULT_PERMISSIONS = {
  system_admin: Object.keys(MODULES), // All modules
  doctor: ['dashboard', 'patients', 'scheduling', 'prescriptions', 'packages', 'treatment-charges', 'discharge', 'analytics', 'reports', 'ai-assist'],
  therapist: ['dashboard', 'patients', 'scheduling', 'treatment-charges'],
  front_office: ['dashboard', 'patients', 'scheduling', 'leads', 'invoices', 'packages', 'treatment-charges', 'discharge', 'mess-management', 'reports'],
  store_admin: ['dashboard', 'inventory', 'purchase', 'reports'],
  kitchen_staff: ['dashboard', 'mess-management', 'mess-expense', 'diet-module'],
  accountant: ['dashboard', 'invoices', 'profit-loss', 'financials', 'analytics', 'purchase', 'treatment-charges', 'reports']
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // users, roles, permissions
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersData);
      console.log('✅ Loaded', usersData.length, 'users');
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Error loading users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      alert('✅ User deleted successfully');
      loadUsers();
    } catch (error) {
      alert('Error deleting user: ' + error.message);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.phone && user.phone.includes(searchTerm));
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Stats
  const roleStats = Object.keys(ROLES).map(role => ({
    role,
    ...ROLES[role],
    count: users.filter(u => u.role === role).length
  }));

  // ==========================================
  // ADD/EDIT USER MODAL
  // ==========================================
  const UserModal = ({ editUser = null }) => {
    const initRoles = editUser
      ? (editUser.roles && editUser.roles.length > 0 ? editUser.roles : [editUser.role || 'front_office'])
      : ['front_office'];
    const initPerms = editUser
      ? (editUser.permissions || DEFAULT_PERMISSIONS[editUser.role || 'front_office'] || [])
      : DEFAULT_PERMISSIONS['front_office'];

    const [userData, setUserData] = useState(editUser ? {
      name: editUser.name || '',
      email: editUser.email || '',
      phone: editUser.phone || '',
      roles: initRoles,
      role: initRoles[0],
      qualification: editUser.qualification || '',
      department: editUser.department || '',
      employee_id: editUser.employee_id || '',
      password: '',
      is_active: editUser.is_active !== false,
      permissions: initPerms,
      notes: editUser.notes || ''
    } : {
      name: '',
      email: '',
      phone: '',
      roles: ['front_office'],
      role: 'front_office',
      qualification: '',
      department: '',
      employee_id: '',
      password: '',
      is_active: true,
      permissions: DEFAULT_PERMISSIONS['front_office'],
      notes: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showAdvancedPerms, setShowAdvancedPerms] = useState(false);

    const handleRoleChange = (roleKey) => {
      setUserData(prev => {
        const already = prev.roles.includes(roleKey);
        const newRoles = already
          ? prev.roles.filter(r => r !== roleKey)
          : [...prev.roles, roleKey];
        if (newRoles.length === 0) return prev; // must have at least one
        // Merge permissions from all selected roles (union)
        const merged = [...new Set(newRoles.flatMap(r => DEFAULT_PERMISSIONS[r] || []))];
        return { ...prev, roles: newRoles, role: newRoles[0], permissions: merged };
      });
    };

    const togglePermission = (moduleId) => {
      setUserData(prev => ({
        ...prev,
        permissions: prev.permissions.includes(moduleId)
          ? prev.permissions.filter(p => p !== moduleId)
          : [...prev.permissions, moduleId]
      }));
    };

    const handleSave = async () => {
      if (!userData.name.trim()) { alert('Name is required'); return; }
      if (!userData.email.trim()) { alert('Email is required'); return; }
      if (!editUser && !userData.password.trim()) { alert('Password is required for new users'); return; }

      // Check duplicate email
      const existingUser = users.find(u => u.email === userData.email && u.id !== editUser?.id);
      if (existingUser) { alert('A user with this email already exists'); return; }

      setSaving(true);
      try {
        const saveData = {
          name: userData.name.trim(),
          email: userData.email.trim().toLowerCase(),
          phone: userData.phone.trim(),
          role: userData.roles[0],
          roles: userData.roles,
          qualification: userData.qualification.trim(),
          department: userData.department.trim(),
          employee_id: userData.employee_id.trim(),
          is_active: userData.is_active,
          permissions: userData.permissions,
          notes: userData.notes.trim(),
          updated_at: new Date().toISOString()
        };

        // Password never gets written directly from the browser — it goes
        // through /api/set-user-password, which hashes it server-side.
        let userId = editUser?.id;
        if (editUser) {
          await updateDoc(doc(db, 'users', editUser.id), saveData);
        } else {
          saveData.created_at = new Date().toISOString();
          const ref = await addDoc(collection(db, 'users'), saveData);
          userId = ref.id;
        }

        if (userData.password) {
          const token = localStorage.getItem('sessionToken') || '';
          const pwRes = await fetch('/api/set-user-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ userId, password: userData.password }),
          });
          const pwResult = await pwRes.json();
          if (!pwRes.ok || !pwResult.success) {
            throw new Error(pwResult.error || 'Failed to set password');
          }
        }

        if (editUser) {
          alert(`✅ User Updated Successfully!\n\nName: ${saveData.name}\nGroups: ${saveData.roles.map(r => ROLES[r]?.label).join(', ')}\nModules: ${saveData.permissions.length} accessible`);
        } else {
          alert(`✅ User Created Successfully!\n\nName: ${saveData.name}\nEmail: ${saveData.email}\nGroups: ${saveData.roles.map(r => ROLES[r]?.label).join(', ')}\nModules: ${saveData.permissions.length} accessible\n\nThe user can now log in with their email and password.`);
        }

        setShowAddUser(false);
        setShowEditUser(null);
        loadUsers();
      } catch (error) {
        alert('Error saving user: ' + error.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b bg-gradient-to-r from-teal-600 to-emerald-600 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{editUser ? '✏️ Edit User' : '👤 Add New User'}</h2>
                <p className="text-teal-100 text-sm mt-1">{editUser ? 'Update user details and permissions' : 'Create a new user account with role-based access'}</p>
              </div>
              <button onClick={() => { setShowAddUser(false); setShowEditUser(null); }} className="text-white hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" value={userData.name}
                    onChange={(e) => setUserData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Dr. Rajesh Kumar" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={userData.email}
                    onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="rajesh@tatvaayurved.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={userData.phone}
                    onChange={(e) => setUserData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input type="text" value={userData.employee_id}
                    onChange={(e) => setUserData(prev => ({ ...prev, employee_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="EMP-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                  <input type="text" value={userData.qualification}
                    onChange={(e) => setUserData(prev => ({ ...prev, qualification: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="BAMS, MD (Ayurveda)" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select value={userData.department}
                    onChange={(e) => setUserData(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                    <option value="">Select Department</option>
                    <option value="Medical">Medical</option>
                    <option value="Therapy">Therapy / Panchakarma</option>
                    <option value="Front Office">Front Office</option>
                    <option value="Pharmacy">Pharmacy / Store</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Administration">Administration</option>
                    <option value="Housekeeping">Housekeeping</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-teal-600" />
                Login Credentials
              </h3>
              <div className="relative max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editUser ? '(leave blank to keep current)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={userData.password}
                    onChange={(e) => setUserData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder={editUser ? 'Leave blank to keep current' : 'Enter password'}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600" />
                User Groups
              </h3>
              <p className="text-xs text-gray-500 mb-3">Select one or more groups. Permissions from all selected groups will be merged.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(ROLES).map(([roleKey, roleData]) => {
                  const isSelected = userData.roles.includes(roleKey);
                  const isPrimary = userData.roles[0] === roleKey;
                  return (
                    <button key={roleKey}
                      onClick={() => handleRoleChange(roleKey)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{roleData.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{roleData.label}</p>
                            {isPrimary && isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-teal-600 text-white rounded-full font-semibold">Primary</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{roleData.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-teal-600 border-teal-600' : 'border-gray-300'}`}>
                          {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(DEFAULT_PERMISSIONS[roleKey] || []).slice(0, 5).map(perm => (
                          <span key={perm} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                            {MODULES[perm]?.label || perm}
                          </span>
                        ))}
                        {(DEFAULT_PERMISSIONS[roleKey] || []).length > 5 && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                            +{(DEFAULT_PERMISSIONS[roleKey] || []).length - 5} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {userData.roles.length > 1 && (
                <p className="text-xs text-teal-700 mt-2 font-medium">
                  ✓ {userData.roles.length} groups selected — permissions merged ({userData.permissions.length} modules)
                </p>
              )}
            </div>

            {/* Custom Permissions */}
            <div>
              <button
                onClick={() => setShowAdvancedPerms(!showAdvancedPerms)}
                className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 hover:text-teal-700">
                <Shield className="w-4 h-4 text-teal-600" />
                {showAdvancedPerms ? '▼' : '▶'} Custom Module Permissions
                <span className="text-xs font-normal text-gray-500 ml-2">
                  ({userData.permissions.length} modules enabled)
                </span>
              </button>
              
              {showAdvancedPerms && (
                <div className="p-4 bg-gray-50 rounded-xl border">
                  <p className="text-xs text-gray-500 mb-3">
                    Default permissions are set based on the role selected. You can customize below:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(MODULES).map(([moduleKey, moduleData]) => {
                      const Icon = moduleData.icon;
                      const isEnabled = userData.permissions.includes(moduleKey);
                      return (
                        <button key={moduleKey}
                          onClick={() => togglePermission(moduleKey)}
                          className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all text-sm ${
                            isEnabled
                              ? 'border-teal-300 bg-teal-50 text-teal-800'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                            isEnabled ? 'bg-teal-600 text-white' : 'bg-gray-200'
                          }`}>
                            {isEnabled && <CheckCircle className="w-3 h-3" />}
                          </div>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium truncate">{moduleData.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={userData.is_active}
                  onChange={(e) => setUserData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-5 h-5 text-teal-600 rounded" />
                <div>
                  <span className="font-semibold text-gray-800">Account Active</span>
                  <p className="text-xs text-gray-500">Inactive users cannot log into the system</p>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={userData.notes}
                onChange={(e) => setUserData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                rows="2" placeholder="Any additional notes about this user..." />
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
            <button onClick={() => { setShowAddUser(false); setShowEditUser(null); }}
              className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50">
              {saving ? 'Saving...' : editUser ? '✅ Update User' : '✅ Create User'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // RENDER
  // ==========================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500 text-sm">Manage users, roles, and access permissions</p>
          </div>
        </div>
        <button onClick={() => setShowAddUser(true)}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 font-medium shadow-md">
          <Plus className="w-5 h-5" />
          Add New User
        </button>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-7 gap-3 mb-6">
        {roleStats.map(stat => (
          <div key={stat.role} className={`p-3 rounded-xl border ${stat.color}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{stat.icon}</span>
              <div>
                <p className="text-xl font-bold">{stat.count}</p>
                <p className="text-xs font-medium truncate">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'users', label: '👤 Users' },
          { key: 'roles', label: '🛡️ Roles & Permissions' }
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================== */}
      {/* TAB 1: USERS LIST */}
      {/* ============================== */}
      {activeTab === 'users' && (
        <div className="bg-white border rounded-xl shadow-sm">
          {/* Filters */}
          <div className="p-4 border-b flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                placeholder="Search by name, email, or phone..." />
            </div>
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm">
              <option value="all">All Roles</option>
              {Object.entries(ROLES).map(([key, role]) => (
                <option key={key} value={key}>{role.icon} {role.label}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500">{filteredUsers.length} users</span>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Access</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map(user => {
                  const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role || 'front_office'];
                  const primaryRoleInfo = ROLES[userRoles[0]] || ROLES.front_office;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${primaryRoleInfo.badgeColor} text-white flex items-center justify-center font-bold text-sm`}>
                            {user.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.employee_id || user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.map(r => {
                            const info = ROLES[r] || ROLES.front_office;
                            return (
                              <span key={r} className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${info.color}`}>
                                {info.icon} {info.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{user.department || '-'}</td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          {user.email && <p className="text-gray-700 flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</p>}
                          {user.phone && <p className="text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {user.phone}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-600">{(user.permissions || []).length} modules</p>
                        <div className="flex flex-wrap gap-0.5 mt-1 max-w-[200px]">
                          {(user.permissions || []).slice(0, 4).map(p => (
                            <span key={p} className="px-1 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px]">
                              {MODULES[p]?.label || p}
                            </span>
                          ))}
                          {(user.permissions || []).length > 4 && (
                            <span className="px-1 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px]">
                              +{(user.permissions || []).length - 4}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          user.is_active !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active !== false ? '● Active' : '● Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => setShowEditUser(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteUser(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                      {users.length === 0
                        ? 'No users yet. Click "Add New User" to create the first user.'
                        : 'No users match your search criteria.'
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* TAB 2: ROLES & PERMISSIONS */}
      {/* ============================== */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* Permission Matrix */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-bold text-gray-800">Permission Matrix</h3>
              <p className="text-sm text-gray-500 mt-1">Default module access by role (can be customized per user)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 bg-gray-50 min-w-[180px]">Module</th>
                    {Object.entries(ROLES).map(([key, role]) => (
                      <th key={key} className="px-3 py-3 text-center text-xs font-semibold min-w-[100px]">
                        <span className="text-lg block">{role.icon}</span>
                        <span className="text-gray-600 text-[10px] leading-tight block mt-1">{role.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(MODULES).map(([moduleKey, moduleData]) => {
                    const Icon = moduleData.icon;
                    return (
                      <tr key={moduleKey} className="hover:bg-gray-50">
                        <td className="px-4 py-3 sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{moduleData.label}</p>
                              <p className="text-[10px] text-gray-500">{moduleData.description}</p>
                            </div>
                          </div>
                        </td>
                        {Object.keys(ROLES).map(roleKey => {
                          const hasAccess = (DEFAULT_PERMISSIONS[roleKey] || []).includes(moduleKey);
                          return (
                            <td key={roleKey} className="px-3 py-3 text-center">
                              {hasAccess ? (
                                <span className="text-green-600 text-lg">✅</span>
                              ) : (
                                <span className="text-gray-300 text-lg">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(ROLES).map(([roleKey, roleData]) => (
              <div key={roleKey} className={`p-5 rounded-xl border-2 ${roleData.color}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{roleData.icon}</span>
                  <div>
                    <h3 className="font-bold text-lg">{roleData.label}</h3>
                    <p className="text-sm opacity-75">{roleData.description}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <p className="text-xs font-semibold mb-2 opacity-75">ACCESSIBLE MODULES:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(DEFAULT_PERMISSIONS[roleKey] || []).map(perm => (
                      <span key={perm} className="px-2 py-1 bg-white bg-opacity-60 rounded-lg text-xs font-medium">
                        {MODULES[perm]?.label || perm}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-3 border-t border-current border-opacity-20">
                  <p className="text-sm font-semibold">
                    {users.filter(u => u.role === roleKey).length} user(s) assigned
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddUser && <UserModal />}
      {showEditUser && <UserModal editUser={showEditUser} />}
    </div>
  );
};

// ==========================================
// EXPORT PERMISSIONS HELPER
// ==========================================
export const getUserPermissions = (user) => {
  if (!user) return [];
  if (user.role === 'system_admin' || user.role === 'admin') return Object.keys(MODULES);
  return user.permissions || DEFAULT_PERMISSIONS[user.role] || [];
};

export const hasModuleAccess = (user, moduleId) => {
  const permissions = getUserPermissions(user);
  return permissions.includes(moduleId);
};

export { ROLES, MODULES, DEFAULT_PERMISSIONS };
export default UserManagement;
