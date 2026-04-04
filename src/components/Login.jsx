import React, { useState } from 'react';
import { LogIn, User, Lock, AlertCircle } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔐 Attempting login for:', username);

      // Get users from localStorage
      const usersData = localStorage.getItem('system_users');
      let users = [];
      
      if (usersData) {
        users = JSON.parse(usersData);
      } else {
        // Initialize with default users if not exists
        users = [
          {
            id: '1',
            username: 'admin',
            password: 'admin123',
            name: 'System Administrator',
            role: 'Admin',
            email: 'admin@tatvaayurved.com',
            phone: '9876543210',
            permissions: ['all'],
            is_active: true
          },
          {
            id: '2',
            username: 'doctor',
            password: 'doctor123',
            name: 'Dr. Ramesh Kumar',
            role: 'Doctor',
            email: 'doctor@tatvaayurved.com',
            phone: '9876543211',
            permissions: ['patients', 'prescriptions', 'appointments', 'invoices'],
            is_active: true
          },
          {
            id: '3',
            username: 'staff',
            password: 'staff123',
            name: 'Priya Sharma',
            role: 'Staff',
            email: 'staff@tatvaayurved.com',
            phone: '9876543212',
            permissions: ['patients', 'appointments', 'invoices'],
            is_active: true
          }
        ];
        localStorage.setItem('system_users', JSON.stringify(users));
      }

      // Find user (case-insensitive)
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

      if (!user) {
        setError('User not found');
        setLoading(false);
        return;
      }

      // Check if user is active
      if (user.is_active === false) {
        setError('Your account has been deactivated. Please contact administrator.');
        setLoading(false);
        return;
      }

      // Check password
      if (user.password !== password) {
        setError('Invalid password');
        setLoading(false);
        return;
      }

      // Login successful
      console.log('✅ Login successful:', user.name);

      // Create session object
      const sessionUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: user.permissions || [],
        email: user.email,
        phone: user.phone
      };

      // Save to localStorage for session persistence
      localStorage.setItem('currentUser', JSON.stringify(sessionUser));

      // Call parent onLogin
      onLogin(sessionUser);

    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-8 py-6 text-white">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="Hospital Logo" 
              className="w-16 h-16 rounded-lg object-contain bg-white p-2"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            <div 
              className="w-16 h-16 bg-white bg-opacity-20 rounded-lg items-center justify-center"
              style={{ display: 'none' }}
            >
              <span className="text-white font-bold text-2xl">HMS</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center">Tatva Ayurved HMS</h1>
          <p className="text-teal-100 text-center text-sm mt-1">Hospital Management System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Welcome Back</h2>
          
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Username Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                placeholder="Enter your username"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center space-x-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Login</span>
              </>
            )}
          </button>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3">Demo Credentials:</p>
            <div className="space-y-2 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <strong>Admin:</strong> admin / admin123
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>Doctor:</strong> doctor / doctor123
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <strong>Staff:</strong> staff / staff123
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 text-center">
          <p className="text-xs text-gray-500">
            © 2026 Tatva Ayurved Hospital. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
