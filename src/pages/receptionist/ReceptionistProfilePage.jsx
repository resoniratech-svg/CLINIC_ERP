import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { User, ShieldCheck, KeyRound, Building, Lock, CheckCircle2 } from 'lucide-react';

export const ReceptionistProfilePage = () => {
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
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });

      if (res.success) {
        showToast('Password changed successfully!', 'success');
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <span>Staff Profile & Security</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View operational profile credentials, assigned branch details, and update login password.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Profile Summary Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xl mx-auto shadow-md shadow-blue-500/20">
              {user?.full_name?.charAt(0) || 'R'}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">{user?.full_name || 'Receptionist Staff'}</h3>
              <span className="font-mono text-slate-400 text-xs">{user?.employee_id || 'REC001'}</span>
            </div>
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 uppercase">
              {user?.role?.replace('_', ' ') || 'RECEPTIONIST'}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Username:</span>
              <span className="font-mono font-bold text-slate-800">@{user?.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mobile:</span>
              <span className="font-mono font-bold text-slate-800">{user?.mobile_number || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Assigned Branch:</span>
              <span className="font-bold text-slate-800">Karimnagar Main (KRM001)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Department:</span>
              <span className="font-medium text-slate-800">{user?.department || 'Front Desk OPD'}</span>
            </div>
          </div>
        </div>

        {/* Right: Change Password Form */}
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
              Change Account Password
            </h3>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Current Password *
              </label>
              <input
                type="password"
                required
                value={passwordForm.old_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                placeholder="Enter current password"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
