import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simulate authentication
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock users for demo
      const users = {
        'admin@tatvaayurved.com': {
          password: 'admin123',
          name: 'System Administrator',
          role: 'Admin',
          permissions: ['all']
        },
        'doctor@tatvaayurved.com': {
          password: 'doctor123',
          name: 'Dr. Sharma',
          role: 'Doctor',
          permissions: ['patients', 'prescriptions', 'appointments']
        },
        'staff@tatvaayurved.com': {
          password: 'staff123',
          name: 'Front Desk',
          role: 'Staff',
          permissions: ['patients', 'appointments', 'inventory']
        }
      };

      const user = users[email.toLowerCase()];

      if (!user || user.password !== password) {
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      // Store user info
      const userInfo = {
        email: email.toLowerCase(),
        name: user.name,
        role: user.role,
        permissions: user.permissions
      };

      localStorage.setItem('currentUser', JSON.stringify(userInfo));

      // Call parent login handler
      if (onLogin) {
        onLogin(userInfo);
      }

    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo and Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-teal-700 rounded-lg flex items-center justify-center overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="Tatva Ayurved" 
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div class="text-2xl font-bold text-white">TA</div>';
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Tatva Ayurved</h1>
                <p className="text-xs text-gray-600">Ayurveda for Health & Happiness</p>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome</h2>
            <p className="text-gray-600">Sign in to manage your Ayurvedic hospital efficiently</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-colors"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-teal-700 hover:text-teal-800 font-medium"
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Side - Hero Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-teal-700 to-teal-900">
        {/* Background Image */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        ></div>

        {/* Overlay Pattern */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>

        {/* Content */}
        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <div className="max-w-lg">
            <h2 className="text-4xl font-bold mb-4">
              Ayurveda for Health & Happiness
            </h2>
            <p className="text-lg text-teal-100 leading-relaxed">
              Streamline your Ayurvedic hospital operations with our comprehensive management system. From patient care to inventory, we've got you covered.
            </p>
          </div>

          {/* Decorative Element */}
          <div className="absolute top-1/2 right-12 transform -translate-y-1/2 opacity-10">
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 20C100 20 120 40 120 60C120 71.0457 111.046 80 100 80C88.9543 80 80 71.0457 80 60C80 40 100 20 100 20Z" fill="white"/>
              <path d="M100 180C100 180 120 160 120 140C120 128.954 111.046 120 100 120C88.9543 120 80 128.954 80 140C80 160 100 180 100 180Z" fill="white"/>
              <path d="M20 100C20 100 40 80 60 80C71.0457 80 80 88.9543 80 100C80 111.046 71.0457 120 60 120C40 120 20 100 20 100Z" fill="white"/>
              <path d="M180 100C180 100 160 80 140 80C128.954 80 120 88.9543 120 100C120 111.046 128.954 120 140 120C160 120 180 100 180 100Z" fill="white"/>
              <circle cx="100" cy="100" r="25" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16 opacity-20">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="white"></path>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Login;
