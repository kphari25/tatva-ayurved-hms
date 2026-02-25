import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from 'lucide-react';

const ChangePassword = ({ supabase, currentUser }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showMessage('error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword === currentPassword) {
      showMessage('error', 'New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      // Supabase method to update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      showMessage('success', '✅ Password changed successfully! Please login again.');
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Optional: Auto logout after 3 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('Error changing password:', error);
      showMessage('error', 'Failed to change password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Change Password</h1>
              <p className="text-slate-600">Update your account password</p>
            </div>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="font-semibold">{message.text}</p>
          </div>
        )}

        {/* Password Change Form */}
        <div className="bg-white rounded-2xl shadow-lg border p-8">
          <form onSubmit={handleChangePassword} className="space-y-6">
            {/* Current User Info */}
            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="text-sm text-slate-600">Logged in as</p>
              <p className="font-bold text-slate-800">{currentUser?.email}</p>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Current Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="Enter new password (min 6 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {newPassword && (
                <p className={`text-xs mt-2 ${newPassword.length >= 6 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {newPassword.length >= 6 ? '✓ Strong password' : '✗ Password too short (min 6 characters)'}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none"
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && (
                <p className={`text-xs mt-2 ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-600'}`}>
                  {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            {/* Security Tips */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-bold text-amber-800 mb-2">Password Tips:</p>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Use at least 6 characters</li>
                <li>• Mix uppercase and lowercase letters</li>
                <li>• Include numbers and special characters</li>
                <li>• Don't use common words or personal info</li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Changing Password...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Change Password
                </>
              )}
            </button>
          </form>
        </div>

        {/* Warning */}
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-800">
            <strong>⚠️ Important:</strong> After changing your password, you will be logged out and need to sign in again with your new password.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
