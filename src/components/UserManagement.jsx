import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Edit, Trash2, Search, X, Save, 
  Lock, Shield, Eye, EyeOff, AlertCircle, CheckCircle
} from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role: 'Staff',
    department: '',
    employee_id: '',
    is_active: true
  });

  const [passwordData, setPasswordData] = useState({
    new_password: '',
    confirm_password: ''
  });

  // Predefined roles with permissions
  const roles = [
    {
      name: 'Admin',
      permissions: ['all'],
      description: 'Full system access - can manage everything'
    },
    {
      name: 'Doctor',
      permissions: ['patients', 'prescriptions', 'appointments', 'invoices'],
      description: 'Can manage patients, prescriptions, and appointments'
    },
    {
      name: 'Nurse',
      permissions: ['patients', 'appointments'],
      description: 'Can view and update patient records'
    },
    {
      name: 'Receptionist',
      permissions: ['patients', 'appointments'],
      description: 'Can register patients and manage appointments'
    },
    {
      name: 'Pharmacist',
      permissions: ['inventory', 'prescriptions'],
      description: 'Can manage inventory and view prescriptions'
    },
    {
      name: 'Staff',
      permissions: ['patients', 'appointments', 'invoices'],
      description: 'General staff access'
    },
    {
      name: 'Accountant',
      permissions: ['invoices', 'analytics'],
      description: 'Can manage invoices and view reports'
    }
  ];

  useEffect(() => {
    loadUsers();
    checkCurrentUser();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  const checkCurrentUser = () => {
    try {
      const user = localStorage.getItem('currentUser');
      if (user) {
        setCurrentUser(JSON.parse(user));
      }
    } catch (error) {
      console.error('Error checking current user:', error);
    }
  };

  const loadUsers = () => {
    try {
      const saved = localStorage.getItem('system_users');
      if (saved) {
        setUsers(JSON.parse(saved));
        setFilteredUsers(JSON.parse(saved));
      } else {
        // Initialize with default users
        const defaultUsers = [
          {
            id: 1,
            username: 'admin',
            password: 'admin123',
            name: 'System Administrator',
            email: 'admin@tatvaayurved.com',
            phone: '9876543210',
            role: 'Admin',
            permissions: ['all'],
            department: 'Administration',
            employee_id: 'EMP001',
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            username: 'doctor',
            password: 'doctor123',
            name: 'Dr. Ramesh Kumar',
            email: 'doctor@tatvaayurved.com',
            phone: '9876543211',
            role: 'Doctor',
            permissions: ['patients', 'prescriptions', 'appointments', 'invoices'],
            department: 'Medical',
            employee_id: 'DOC001',
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 3,
            username: 'staff',
            password: 'staff123',
            name: 'Priya Sharma',
            email: 'staff@tatvaayurved.com',
            phone: '9876543212',
            role: 'Staff',
            permissions: ['patients', 'appointments', 'invoices'],
            department: 'Front Desk',
            employee_id: 'EMP002',
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        localStorage.setItem('system_users', JSON.stringify(defaultUsers));
        setUsers(defaultUsers);
        setFilteredUsers(defaultUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    const roleData = roles.find(r => r.name === selectedRole);
    setFormData(prev => ({
      ...prev,
      role: selectedRole,
      permissions: roleData?.permissions || []
    }));
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      email: '',
      phone: '',
      role: 'Staff',
      department: '',
      employee_id: '',
      is_active: true
    });
    setShowAddModal(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: user.password,
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      department: user.department || '',
      employee_id: user.employee_id || '',
      is_active: user.is_active !== false
    });
    setShowEditModal(true);
  };

  const handleResetPassword = (user) => {
    setEditingUser(user);
    setPasswordData({
      new_password: '',
      confirm_password: ''
    });
    setShowPasswordModal(true);
  };

  const saveUser = () => {
    // Validation
    if (!formData.username || !formData.name || !formData.role) {
      alert('❌ Please fill in Username, Name, and Role');
      return;
    }

    if (!editingUser && !formData.password) {
      alert('❌ Please enter a password for new user');
      return;
    }

    // Check username uniqueness
    const existingUser = users.find(u => 
      u.username.toLowerCase() === formData.username.toLowerCase() && 
      (!editingUser || u.id !== editingUser.id)
    );

    if (existingUser) {
      alert('❌ Username already exists! Please choose a different username.');
      return;
    }

    const roleData = roles.find(r => r.name === formData.role);

    const userData = {
      id: editingUser ? editingUser.id : Date.now(),
      username: formData.username,
      password: editingUser ? editingUser.password : formData.password,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      permissions: roleData?.permissions || [],
      department: formData.department,
      employee_id: formData.employee_id,
      is_active: formData.is_active,
      created_at: editingUser ? editingUser.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let updatedUsers;
    if (editingUser) {
      updatedUsers = users.map(u => u.id === editingUser.id ? userData : u);
    } else {
      updatedUsers = [...users, userData];
    }

    localStorage.setItem('system_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    setShowAddModal(false);
    setShowEditModal(false);
    
    alert(editingUser ? '✅ User updated successfully!' : '✅ User created successfully!');
  };

  const handlePasswordReset = () => {
    if (!passwordData.new_password || !passwordData.confirm_password) {
      alert('❌ Please enter both password fields');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      alert('❌ Passwords do not match!');
      return;
    }

    if (passwordData.new_password.length < 6) {
      alert('❌ Password must be at least 6 characters long');
      return;
    }

    const updatedUsers = users.map(u => 
      u.id === editingUser.id 
        ? { ...u, password: passwordData.new_password, updated_at: new Date().toISOString() }
        : u
    );

    localStorage.setItem('system_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    setShowPasswordModal(false);
    alert('✅ Password reset successfully!');
  };

  const handleDeleteUser = (user) => {
    if (user.role === 'Admin' && users.filter(u => u.role === 'Admin').length === 1) {
      alert('❌ Cannot delete the last Admin user!');
      return;
    }

    if (currentUser?.username === user.username) {
      alert('❌ You cannot delete your own account!');
      return;
    }

    if (!confirm(`⚠️ Delete user "${user.name}"?\n\nThis action cannot be undone!`)) {
      return;
    }

    const updatedUsers = users.filter(u => u.id !== user.id);
    localStorage.setItem('system_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    alert('✅ User deleted successfully!');
  };

  const toggleUserStatus = (user) => {
    if (user.role === 'Admin' && user.is_active && users.filter(u => u.role === 'Admin' && u.is_active).length === 1) {
      alert('❌ Cannot deactivate the last active Admin user!');
      return;
    }

    if (currentUser?.username === user.username) {
      alert('❌ You cannot deactivate your own account!');
      return;
    }

    const updatedUsers = users.map(u => 
      u.id === user.id 
        ? { ...u, is_active: !u.is_active, updated_at: new Date().toISOString() }
        : u
    );

    localStorage.setItem('system_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
  };

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active !== false).length;
  const adminUsers = users.filter(u => u.role === 'Admin').length;
  const inactiveUsers = users.filter(u => u.is_active === false).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <Shield className="w-8 h-8 text-red-600 mr-3" />
              User Management
              <span className="ml-3 px-3 py-1 bg-red-100 text-red-700 text-sm rounded-lg font-semibold">
                Admin Only
              </span>
            </h1>
            <p className="text-gray-600 mt-1">Manage system users, roles, and permissions</p>
          </div>
          <button
            onClick={handleAddUser}
            className="flex items-center space-x-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Add New User</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-gray-800">{totalUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <p className="text-sm text-gray-600">Active Users</p>
            <p className="text-2xl font-bold text-green-600">{activeUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <p className="text-sm text-gray-600">Administrators</p>
            <p className="text-2xl font-bold text-red-600">{adminUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <p className="text-sm text-gray-600">Inactive</p>
            <p className="text-2xl font-bold text-gray-400">{inactiveUsers}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, username, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Department</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No users found</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-teal-700 font-semibold text-sm">
                          {user.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                        {user.employee_id && (
                          <p className="text-xs text-gray-400">ID: {user.employee_id}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {user.email && <p className="text-gray-900">{user.email}</p>}
                    {user.phone && <p className="text-gray-500">{user.phone}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'Admin' ? 'bg-red-100 text-red-700' :
                      user.role === 'Doctor' ? 'bg-blue-100 text-blue-700' :
                      user.role === 'Pharmacist' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {user.department || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleUserStatus(user)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.is_active !== false
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {user.is_active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(user)}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                        title="Reset Password"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Add New User</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="john.doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="9876543210"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleRoleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    {roles.map(role => (
                      <option key={role.name} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {roles.find(r => r.name === formData.role)?.description}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="Medical, Front Desk, etc."
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="EMP001, DOC001, etc."
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Active (User can login)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveUser}
                className="flex items-center space-x-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <Save className="w-4 h-4" />
                <span>Create User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Edit User</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value="••••••••"
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use Reset Password button</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleRoleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    {roles.map(role => (
                      <option key={role.name} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm text-gray-700">Active (User can login)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveUser}
                className="flex items-center space-x-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <Save className="w-4 h-4" />
                <span>Update User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Reset Password</h2>
              <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">Resetting password for: {editingUser?.name}</p>
                  <p className="mt-1">Username: @{editingUser?.username}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Confirm new password"
                />
              </div>

              {passwordData.new_password && passwordData.confirm_password && (
                <div className={`flex items-center space-x-2 text-sm ${
                  passwordData.new_password === passwordData.confirm_password
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {passwordData.new_password === passwordData.confirm_password ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span>
                    {passwordData.new_password === passwordData.confirm_password
                      ? 'Passwords match'
                      : 'Passwords do not match'}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                className="flex items-center space-x-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <Lock className="w-4 h-4" />
                <span>Reset Password</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
