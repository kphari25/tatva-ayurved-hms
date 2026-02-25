import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

const TatvaAyurvedLogin = ({ supabase, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      // Login successful
      if (onLogin) {
        onLogin(data.session);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <img 
              src="/tatva.jpg" 
              alt="Tatva Ayurved" 
              className="w-16 h-16 object-contain rounded-full"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="text-4xl">🏥</div>';
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-emerald-800 mb-2">
            Tatva Ayurved HMS
          </h1>
          <p className="text-slate-600">Hospital Management System</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Login Failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all outline-none"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full pl-12 pr-12 py-3 border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-bold text-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Signing in...
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>Thekkuveedu Lane, Kannur Rd.</p>
          <p>Near Christian College</p>
          <p>Kozhikode, Kerala - 673001</p>
          <p className="mt-2 font-semibold text-emerald-600">+91 9895112264</p>
        </div>

        {/* Version */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <p>Tatva Ayurved HMS v1.0</p>
          <p>Powered by Supabase</p>
        </div>
      </div>
    </div>
  );
};

export default TatvaAyurvedLogin;
