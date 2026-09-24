import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

// Full-screen gate shown instead of the app whenever currentUser.must_change_password
// is true — set whenever an admin creates an account or resets someone's password
// (see api/set-user-password.js), so an admin-chosen password is never the one
// someone keeps using indefinitely.
const ForceChangePassword = ({ currentUser, onChanged, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('sessionToken') || '';
      const response = await fetch('/api/change-own-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || 'Could not change password');
        setLoading(false);
        return;
      }

      const updatedUser = { ...currentUser, must_change_password: false };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      if (onChanged) onChanged(updatedUser);
    } catch (err) {
      console.error('Password change failed:', err);
      setError('Could not reach the server. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-teal-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Set a New Password</h1>
            <p className="text-xs text-gray-600">{currentUser?.name || 'Welcome'}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Your password was set by an administrator. For security, please choose your own password before continuing.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="The password you just logged in with"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 4 characters"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Updating...
              </span>
            ) : (
              'Set New Password & Continue'
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Log out instead
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForceChangePassword;
