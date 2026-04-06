import React, { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔍 Attempting Firebase login with:', email);

      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      console.log('✅ Firebase auth successful:', firebaseUser.uid);

      // Get user profile from Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // User authenticated but no profile - create one
        console.warn('⚠️ User authenticated but no Firestore profile. Using email info.');
        
        const userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.email.split('@')[0],
          role: 'Staff', // Default role
          permissions: ['patients', 'appointments'],
        };

        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        if (onLogin) {
          onLogin(userData);
        }
      } else {
        // User has full profile
        const userData = {
          id: firebaseUser.uid,
          ...userDoc.data()
        };

        console.log('✅ User profile loaded:', userData);

        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        if (onLogin) {
          onLogin(userData);
        }
      }

    } catch (err) {
      console.error('❌ Login error:', err);
      
      // User-friendly error messages
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.code === 'auth/wrong-password') {
        errorMessage = 'Invalid password';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'User not found';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Try again later.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Check your connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-8 py-6 text-white text-center">
            <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
              <img 
                src="/logo.png" 
                alt="Tatva Ayurved" 
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<div class="text-4xl font-bold text-teal-600">TA</div>';
                }}
              />
            </div>
            <h1 className="text-2xl font-bold">Tatva Ayurved HMS</h1>
            <p className="text-teal-100 text-sm mt-1">Hospital Management System</p>
          </div>

          {/* Form */}
          <div className="px-8 py-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Welcome Back</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                  placeholder="admin@tatvaayurved.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 focus:ring-4 focus:ring-teal-200 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>


          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-600">
            <p className="mb-1">Thekkuveedu Lane, Kannur Rd.</p>
            <p className="mb-1">Near Christian College</p>
            <p className="mb-2">Kozhikode, Kerala - 673001</p>
            <p className="text-teal-600 font-medium">+91 9895112264</p>
            <p className="mt-3 text-xs text-gray-500">
              Tatva Ayurved HMS v1.0 • Powered by Firebase
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
