import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { authApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Lock, CheckCircle2, Loader2, AlertCircle, KeyRound } from 'lucide-react';

export const ChangePasswordModal = ({ isOpen, onClose, onSuccess, isForced = false }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword.trim() || !newPassword.trim()) {
      showToast('Please enter both current and new passwords', 'warning');
      return;
    }

    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long', 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.changePassword({
        old_password: oldPassword.trim(),
        new_password: newPassword.trim(),
      });

      if (res.success) {
        showToast('Password updated successfully! Security credentials renewed.', 'success');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isForced ? undefined : onClose}
      title={isForced ? "Security Notice: Password Reset Required" : "Change Account Password"}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        {isForced ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold mb-0.5 text-amber-800">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Temporary Password Detected</span>
            </div>
            <p className="text-[11px]">
              You have logged in with a temporary password. You must set a permanent secure password before accessing the system.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px]">
            Ensure your new password contains at least 6 characters.
          </div>
        )}

        <div>
          <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
            {isForced ? 'Temporary Password *' : 'Current Password *'}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
            New Secure Password *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
          {!isForced && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Set Permanent Password</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
