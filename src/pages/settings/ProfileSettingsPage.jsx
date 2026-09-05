import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { User, ShieldCheck, KeyRound, Building, Lock, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

export const ProfileSettingsPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!passwordForm.old_password.trim() || !passwordForm.new_password.trim()) {
      showToast('Please enter both current and new passwords', 'warning');
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('New passwords do not match', 'warning');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      showToast('New password must be at least 6 characters long', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.changePassword({
        old_password: passwordForm.old_password.trim(),
        new_password: passwordForm.new_password.trim(),
      });

      if (res.success) {
        showToast('Your Super Admin password was changed successfully!', 'success');
        setPasswordForm({
          old_password: '',
          new_password: '',
          confirm_password: '',
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <span>Super Admin Profile & Security Settings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authenticated administrative credentials, assigned branch details, and self-service password changes.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-red-600 text-white text-xs font-bold shadow-xs">
          <ShieldCheck className="w-4 h-4" />
          <span>SUPER ADMIN</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Super Admin Profile Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5 text-xs">
          <div className="text-center space-y-2.5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-red-600 p-0.5 mx-auto shadow-md shadow-blue-500/10">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-blue-800 font-black text-2xl">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-base text-slate-900">{user?.full_name || 'Super Administrator'}</h3>
              <span className="font-mono text-slate-400 text-xs">{user?.employee_id || 'EMP000'}</span>
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 tracking-wider uppercase">
              {user?.role?.replace('_', ' ') || 'SUPER ADMIN'}
            </span>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Username</span>
              <span className="font-mono font-bold text-slate-800">@{user?.username || 'admin'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Assigned Branch</span>
              <span className="font-bold text-slate-800">Karimnagar Main (KRM001)</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Department</span>
              <span className="font-medium text-slate-800">{user?.department || 'Administration'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Account Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Right: Self-Service Password Change Card */}
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
              Self-Service Password Change
            </h3>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-blue-900 text-[11px] leading-relaxed">
            Update your own master access password. Ensure your new password contains at least 6 characters. No other administrative approval is required.
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Current Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  type="password"
                  required
                  value={passwordForm.old_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                  placeholder="Enter current password"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    placeholder="Repeat new password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
