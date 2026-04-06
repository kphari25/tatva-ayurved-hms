import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Edit, Trash2, Shield, Eye, EyeOff,
  Search, CheckCircle, XCircle, Lock, UserCheck,
  Stethoscope, Heart, Monitor, X, Save,
  AlertCircle, RefreshCw, Crown, Activity, Copy,
  Info, Key
} from 'lucide-react';

const AdminUserPortal = ({ supabase, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [createdUserInfo, setCreatedUserInfo] = useState(null);
 
  const roles = [
    {
      id: 'admin',
      label: 'Administrator',
      icon: Crown,
      color: 'red',
      description: 'Full access - Users, HR, Sales, all modules',
      permissions: ['User Management', 'HR Portal', 'Sales Portal', 'Financial Reports', 'All Modules']
    },
    {
      id: 'doctor',
      label: 'Doctor',
      icon: Stethoscope,
      color: 'blue',
      description: 'Patient care, prescriptions, scheduling',
      permissions: ['Patient Portal', 'Prescriptions', 'Scheduling', 'Inventory View']
    },
    {
      id: 'therapist',
      label: 'Therapist',
      icon: Heart,
      color: 'purple',
      description: 'Therapy sessions, patient scheduling',
      permissions: ['Patient View', 'Therapy Scheduling', 'Session Notes']
    },
    {
      id: 'front_desk',
      label: 'Front Desk Operator',
      icon: Monitor,
      color: 'emerald',
      description: 'Patient registration, appointments, billing',
      permissions: ['Patient Registration', 'Appointments', 'Basic Billing']
    },
    {
      id: 'pharmacy',
      label: 'Pharmacy Staff',
      icon: Activity,
      color: 'amber',
      description: 'Inventory management, medicine dispensing',
      permissions: ['Inventory Management', 'Medicine Dispensing', 'Stock Reports']
    }
  ];

  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'front_desk',
    phone: '',
    isActive: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      showMessage('error', 'Failed to load users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    if (type !== 'info') {
      setTimeout(() => setMessage({ type: '', text: '' }), 6000);
    }
  };

  // ================================================================
  // FIXED: Create user using signUp (works without service role key)
  // ================================================================
  const handleAddUser = async () => {
    // Validate fields
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
      showMessage('error', 'Please fill in all required fields (Name, Email, Password)');
      return;
    }
    if (newUser.password !== newUser.confirmPassword) {
      showMessage('error', 'Passwords do not match!');
      return;
    }
    if (newUser.password.length < 8) {
      showMessage('error', 'Password must be at least 8 characters long');
      return;
    }

    setSaving(true);
    try {
      // Step 1: Create auth account using signUp
      // This creates the user in Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            first_name: newUser.firstName,
            last_name: newUser.lastName,
            role: newUser.role
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!signUpData?.user?.id) {
        throw new Error('User creation failed - no user ID returned');
      }

      const userId = signUpData.user.id;

      // Step 2: Create profile in users table
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: newUser.email,
          role: newUser.role,
          first_name: newUser.firstName,
          last_name: newUser.lastName,
          phone: newUser.phone || null,
          is_active: newUser.isActive
        }, { onConflict: 'id' });

      if (profileError) {
        // If profile creation fails, show manual SQL instructions
        console.error('Profile error:', profileError);
        showMessage('error', `Auth user created (ID: ${userId}) but profile failed. Run fix SQL below.`);
      }

      // Step 3: Show success with user details
      setCreatedUserInfo({
        id: userId,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        phone: newUser.phone,
        password: newUser.password
      });

      setShowAddUser(false);
      showMessage('success', `✅ User ${newUser.firstName} ${newUser.lastName} created successfully!`);

      // Reset form
      setNewUser({
        firstName: '', lastName: '', email: '', password: '',
        confirmPassword: '', role: 'front_desk', phone: '', isActive: true
      });

      // Reload users list after short delay
      setTimeout(() => loadUsers(), 1500);

    } catch (error) {
      console.error('Error creating user:', error);

      // Handle specific errors with helpful messages
      if (error.message?.includes('already registered') ||
          error.message?.includes('already been registered') ||
          error.message?.includes('User already registered')) {
        showMessage('error', '❌ This email is already registered! Use a different email.');
      } else if (error.message?.includes('Invalid email')) {
        showMessage('error', '❌ Please enter a valid email address');
      } else if (error.message?.includes('Password')) {
        showMessage('error', '❌ Password issue: ' + error.message);
      } else {
        showMessage('error', '❌ Error: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: selectedUser.role,
          first_name: selectedUser.first_name,
          last_name: selectedUser.last_name,
          phone: selectedUser.phone,
          is_active: selectedUser.is_active
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      showMessage('success', '✅ User updated successfully!');
      setShowEditUser(false);
      loadUsers();
    } catch (error) {
      showMessage('error', '❌ Failed to update: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (user.id === currentUser?.id) {
      showMessage('error', 'You cannot deactivate your own account!');
      return;
    }
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;
      showMessage('success', `User ${user.is_active ? 'deactivated' : 'activated'} successfully!`);
      loadUsers();
    } catch (error) {
      showMessage('error', 'Failed to update user: ' + error.message);
    }
  };

  const getRoleInfo = (roleId) => roles.find(r => r.id === roleId) || {
    label: roleId, icon: Users, color: 'slate', permissions: []
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeClass = (role) => {
    const classes = {
      admin: 'bg-red-100 text-red-700 border border-red-200',
      doctor: 'bg-blue-100 text-blue-700 border border-blue-200',
      therapist: 'bg-purple-100 text-purple-700 border border-purple-200',
      front_desk: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      pharmacy: 'bg-amber-100 text-amber-700 border border-amber-200'
    };
    return classes[role] || 'bg-slate-100 text-slate-700 border border-slate-200';
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-slate-400 text-sm">Administrator Portal</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={loadUsers}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold shadow-lg transition-all text-sm">
            <Plus className="w-4 h-4" />
            Add New User
          </button>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-4 p-4 rounded-xl flex items-start gap-3 ${
          message.type === 'success' ? 'bg-emerald-900/50 border border-emerald-500 text-emerald-300' :
          message.type === 'info' ? 'bg-blue-900/50 border border-blue-500 text-blue-300' :
          'bg-red-900/50 border border-red-500 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> :
           message.type === 'info' ? <Info className="w-5 h-5 flex-shrink-0 mt-0.5" /> :
           <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <p className="text-sm font-semibold">{message.text}</p>
        </div>
      )}

      {/* Created User Info Card */}
      {createdUserInfo && (
        <div className="mb-6 bg-emerald-900/30 border-2 border-emerald-500 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-emerald-300 font-bold flex items-center gap-2">
              <Key className="w-5 h-5" />
              New User Created - Share These Credentials
            </h3>
            <button onClick={() => setCreatedUserInfo(null)}
              className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-slate-400 mb-1">Name</p>
              <p className="text-white font-bold">{createdUserInfo.firstName} {createdUserInfo.lastName}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-slate-400 mb-1">Role</p>
              <p className="text-white font-bold capitalize">{createdUserInfo.role.replace('_', ' ')}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-slate-400 mb-1">Email (Login ID)</p>
              <div className="flex items-center justify-between">
                <p className="text-emerald-300 font-bold">{createdUserInfo.email}</p>
                <button onClick={() => navigator.clipboard.writeText(createdUserInfo.email)}
                  className="text-slate-400 hover:text-white ml-2">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-slate-400 mb-1">Password</p>
              <div className="flex items-center justify-between">
                <p className="text-emerald-300 font-bold">{createdUserInfo.password}</p>
                <button onClick={() => navigator.clipboard.writeText(createdUserInfo.password)}
                  className="text-slate-400 hover:text-white ml-2">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <p className="text-amber-300 text-xs mt-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Save these credentials! Share with the staff member. They can change their password after first login.
          </p>
          {createdUserInfo.id && (
            <div className="mt-4 bg-slate-800 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-2">
                If user doesn't appear in the list, run this in Supabase SQL Editor:
              </p>
              <code className="text-xs text-green-300 break-all">
                {`INSERT INTO public.users (id, email, role, first_name, last_name, phone, is_active) VALUES ('${createdUserInfo.id}', '${createdUserInfo.email}', '${createdUserInfo.role}', '${createdUserInfo.firstName}', '${createdUserInfo.lastName}', ${createdUserInfo.phone ? `'${createdUserInfo.phone}'` : 'NULL'}, true) ON CONFLICT (id) DO UPDATE SET role='${createdUserInfo.role}';`}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(`INSERT INTO public.users (id, email, role, first_name, last_name, phone, is_active) VALUES ('${createdUserInfo.id}', '${createdUserInfo.email}', '${createdUserInfo.role}', '${createdUserInfo.firstName}', '${createdUserInfo.lastName}', ${createdUserInfo.phone ? `'${createdUserInfo.phone}'` : 'NULL'}, true) ON CONFLICT (id) DO UPDATE SET role='${createdUserInfo.role}';`)}
                className="mt-2 text-xs bg-slate-700 text-slate-300 px-3 py-1 rounded-lg hover:bg-slate-600 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy SQL
              </button>
            </div>
          )}
        </div>
      )}

      {/* Role Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {roles.map((role) => {
          const Icon = role.icon;
          const count = users.filter(u => u.role === role.id && u.is_active).length;
          return (
            <div key={role.id}
              onClick={() => setFilterRole(filterRole === role.id ? 'all' : role.id)}
              className={`bg-slate-800 border rounded-xl p-4 cursor-pointer transition-all hover:scale-105 ${
                filterRole === role.id ? 'border-white' : 'border-slate-700'
              }`}>
              <Icon className="w-5 h-5 text-slate-400 mb-2" />
              <p className="text-white font-bold text-xl">{count}</p>
              <p className="text-slate-400 text-xs mt-1 leading-tight">{role.label}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search by name or email..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl focus:border-red-500 focus:outline-none text-sm placeholder-slate-500"
          />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-xl focus:outline-none text-sm">
          <option value="all">All Roles</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-700 flex items-center justify-between">
          <p className="text-slate-300 font-semibold text-sm">{filteredUsers.length} Users</p>
          <p className="text-slate-500 text-xs">Click refresh if new users don't appear</p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No users found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                {['User', 'Role', 'Phone', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredUsers.map((user) => {
                const roleInfo = getRoleInfo(user.role);
                const Icon = roleInfo.icon;
                return (
                  <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-xs">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">
                            {user.first_name} {user.last_name}
                            {user.id === currentUser?.id && (
                              <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">You</span>
                            )}
                          </p>
                          <p className="text-slate-400 text-xs">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRoleBadgeClass(user.role)}`}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-300 text-sm">{user.phone || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-xs font-bold ${
                        user.is_active
                          ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
                          : 'bg-red-900/50 text-red-400 border border-red-700'
                      }`}>
                        {user.is_active
                          ? <><CheckCircle className="w-3 h-3" /> Active</>
                          : <><XCircle className="w-3 h-3" /> Inactive</>}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelectedUser({...user}); setShowEditUser(true); }}
                          className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`p-2 rounded-lg transition-all ${
                              user.is_active
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            }`}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {user.is_active ? <Lock className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD USER MODAL */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <h2 className="text-xl font-bold text-white">Add New Staff User</h2>
              <button onClick={() => setShowAddUser(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3">Select Role *</label>
                <div className="grid grid-cols-1 gap-2">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <div key={role.id}
                        onClick={() => setNewUser({...newUser, role: role.id})}
                        className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          newUser.role === role.id
                            ? 'border-white bg-slate-700'
                            : 'border-slate-600 hover:border-slate-500'
                        }`}>
                        <Icon className="w-5 h-5 text-slate-300 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-white font-semibold text-sm">{role.label}</p>
                          <p className="text-slate-400 text-xs">{role.description}</p>
                        </div>
                        {newUser.role === role.id && (
                          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">First Name *</label>
                  <input type="text" value={newUser.firstName}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                    placeholder="First name"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Last Name *</label>
                  <input type="text" value={newUser.lastName}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                    placeholder="Last name"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email Address *</label>
                  <input type="email" value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="staff@tatvaayurved.com"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Phone Number</label>
                  <input type="tel" value={newUser.phone}
                    onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                    placeholder="+91 XXXXXXXXXX"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Password * (min 8 chars)</label>
                  <input type="password" value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Create password"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Confirm Password *</label>
                  <input type="password" value={newUser.confirmPassword}
                    onChange={(e) => setNewUser({...newUser, confirmPassword: e.target.value})}
                    placeholder="Repeat password"
                    className={`w-full px-3 py-2.5 bg-slate-700 border text-white rounded-xl focus:outline-none text-sm placeholder-slate-500 ${
                      newUser.confirmPassword && newUser.password !== newUser.confirmPassword
                        ? 'border-red-500' : 'border-slate-600 focus:border-white'
                    }`}
                  />
                  {newUser.confirmPassword && newUser.password !== newUser.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">Passwords don't match!</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button onClick={() => setShowAddUser(false)}
                className="flex-1 px-4 py-3 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-700 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={handleAddUser} disabled={saving}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {saving
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</>
                  : <><Save className="w-4 h-4" /> Create User</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditUser && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Edit User</h2>
              <button onClick={() => setShowEditUser(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">First Name</label>
                  <input type="text" value={selectedUser.first_name || ''}
                    onChange={(e) => setSelectedUser({...selectedUser, first_name: e.target.value})}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Last Name</label>
                  <input type="text" value={selectedUser.last_name || ''}
                    onChange={(e) => setSelectedUser({...selectedUser, last_name: e.target.value})}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Phone</label>
                <input type="tel" value={selectedUser.phone || ''}
                  onChange={(e) => setSelectedUser({...selectedUser, phone: e.target.value})}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Role</label>
                <select value={selectedUser.role}
                  onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-xl focus:border-white focus:outline-none text-sm"
                >
                  {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div>
                  <p className="text-white font-semibold text-sm">Account Active</p>
                  <p className="text-slate-400 text-xs">User can login</p>
                </div>
                <button
                  onClick={() => setSelectedUser({...selectedUser, is_active: !selectedUser.is_active})}
                  className={`w-12 h-6 rounded-full transition-all relative ${selectedUser.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${selectedUser.is_active ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button onClick={() => setShowEditUser(false)}
                className="flex-1 px-4 py-3 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-700 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={handleUpdateUser} disabled={saving}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserPortal;
