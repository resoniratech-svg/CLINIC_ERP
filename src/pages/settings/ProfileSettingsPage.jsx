import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi, settingsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { User, ShieldCheck, KeyRound, Building, Lock, CheckCircle2, Loader2, Edit3, X, Save, Phone, MapPin, Briefcase } from 'lucide-react';

export const ProfileSettingsPage = () => {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  // Profile data & edit states
  const [profileData, setProfileData] = useState(user || null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [branches, setBranches] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(!user && !profileData);

  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    mobile_number: '',
    branch_id: 1,
    department: '',
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Sync profileData when auth user becomes available
  useEffect(() => {
    if (user && !profileData) {
      setProfileData(user);
    }
  }, [user, profileData]);

  // Fetch fresh profile and branches on mount
  useEffect(() => {
    let isMounted = true;

    const fetchInitialData = async () => {
      try {
        const [profRes, branchRes] = await Promise.all([
          settingsApi.getProfile().catch(() => null),
          settingsApi.getBranches().catch(() => null),
        ]);

        if (isMounted) {
          const profileObj = profRes?.data?.user || profRes?.data;
          if (profRes?.success && profileObj) {
            setProfileData(profileObj);
            setEditForm({
              full_name: profileObj.full_name || '',
              username: profileObj.username || '',
              mobile_number: profileObj.mobile_number || '',
              branch_id: profileObj.branch_id || 1,
              department: profileObj.department || 'Administration',
            });
            if (updateUser) updateUser(profileObj);
          } else if (user) {
            setProfileData(user);
            setEditForm({
              full_name: user.full_name || '',
              username: user.username || '',
              mobile_number: user.mobile_number || '',
              branch_id: user.branch_id || 1,
              department: user.department || 'Administration',
            });
          }

          if (branchRes?.success && Array.isArray(branchRes.data)) {
            setBranches(branchRes.data);
          } else {
            // Fallback default branches if fetch empty
            setBranches([
              { branch_id: 1, branch_name: 'Karimnagar Main Branch', branch_code: 'KRM001' },
              { branch_id: 2, branch_name: 'Isolation Branch 2', branch_code: 'ISO2' },
              { branch_id: 3, branch_name: 'Hyderabad Main Branch', branch_code: 'HYD001' },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to load profile settings data:', err);
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    };

    fetchInitialData();
    return () => { isMounted = false; };
  }, []);

  // Enter edit mode
  const handleStartEdit = () => {
    const current = profileData || user;
    setEditForm({
      full_name: current?.full_name || '',
      username: current?.username || '',
      mobile_number: current?.mobile_number || '',
      branch_id: current?.branch_id || 1,
      department: current?.department || 'Administration',
    });
    setIsEditing(true);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    const current = profileData || user;
    setEditForm({
      full_name: current?.full_name || '',
      username: current?.username || '',
      mobile_number: current?.mobile_number || '',
      branch_id: current?.branch_id || 1,
      department: current?.department || 'Administration',
    });
    setIsEditing(false);
  };

  // Save profile changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (!editForm.full_name.trim()) {
      showToast('Full Name is required', 'warning');
      return;
    }

    const cleanUsername = editForm.username.trim().replace(/^@+/, '').trim();
    if (!cleanUsername) {
      showToast('Username is required', 'warning');
      return;
    }

    if (cleanUsername.length < 3) {
      showToast('Username must be at least 3 characters long', 'warning');
      return;
    }

    if (editForm.mobile_number.trim()) {
      const cleanDigits = editForm.mobile_number.replace(/[\s\-()+]/g, '');
      if (cleanDigits.length < 7 || cleanDigits.length > 15 || !/^\d+$/.test(cleanDigits)) {
        showToast('Invalid mobile number format. Must be 7 to 15 digits', 'warning');
        return;
      }
    }

    setSavingProfile(true);
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        username: cleanUsername,
        mobile_number: editForm.mobile_number.trim() || null,
        branch_id: editForm.branch_id,
        department: editForm.department.trim() || null,
      };

      const res = await settingsApi.updateProfile(payload);

      if (res.success && res.data) {
        const updatedUser = res.data.user;
        const refreshedToken = res.data.token;

        setProfileData(updatedUser);
        updateUser(updatedUser, refreshedToken);
        setIsEditing(false);
        showToast(res.message || 'Profile updated successfully', 'success');
      } else {
        showToast(res.message || 'Failed to update profile', 'error');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to update profile. Please try again.';
      showToast(errorMsg, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Password change handler
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

    setSubmittingPassword(true);
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
      setSubmittingPassword(false);
    }
  };

  const displayUser = profileData || user || {};
  const currentBranch = Array.isArray(branches) ? branches.find((b) => b?.branch_id === displayUser?.branch_id) : null;
  const branchDisplayName = currentBranch
    ? `${currentBranch.branch_name} (${currentBranch.branch_code})`
    : displayUser?.branch_name
    ? `${displayUser.branch_name} (${displayUser.branch_code || 'KRM001'})`
    : 'Karimnagar Main (KRM001)';

  if (loadingInitial && !profileData && !user) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 font-medium text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading Profile Settings...</span>
        </div>
      </div>
    );
  }

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
          {/* Card Top Title & Action */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                {isEditing ? 'Edit Profile' : 'Super Admin Profile'}
              </h3>
            </div>

            {!isEditing && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {!isEditing ? (
            /* VIEW MODE */
            <>
              <div className="text-center space-y-2.5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-red-600 p-0.5 mx-auto shadow-md shadow-blue-500/10">
                  <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center text-blue-800 font-black text-2xl">
                    {displayUser?.full_name ? displayUser.full_name.charAt(0).toUpperCase() : 'A'}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-900">{displayUser?.full_name || 'Super Administrator'}</h3>
                  <span className="font-mono text-slate-400 text-xs">{displayUser?.employee_id || 'EMP000'}</span>
                </div>

                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 tracking-wider uppercase">
                  {displayUser?.role?.replace('_', ' ') || 'SUPER ADMIN'}
                </span>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Username</span>
                  <span className="font-mono font-bold text-slate-800">@{displayUser?.username || 'admin'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Mobile Number</span>
                  <span className="font-medium text-slate-800">{displayUser?.mobile_number || '—'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Assigned Branch</span>
                  <span className="font-bold text-slate-800">{branchDisplayName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Department</span>
                  <span className="font-medium text-slate-800">{displayUser?.department || 'Administration'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Employee ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-700 font-semibold">{displayUser?.employee_id || 'EMP000'}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                      READ ONLY
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Role</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-blue-800 uppercase">{displayUser?.role?.replace('_', ' ') || 'SUPER ADMIN'}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                      READ ONLY
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Account Status</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Edit Profile Details</span>
                </button>
              </div>
            </>
          ) : (
            /* EDIT MODE */
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block font-bold text-slate-800 text-[11px] uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  placeholder="Super Administrator"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-900"
                />
              </div>

              {/* Employee ID (Read-only) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-500 text-[11px] uppercase">
                    Employee ID
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    READ ONLY
                  </span>
                </div>
                <input
                  type="text"
                  disabled
                  value={displayUser?.employee_id || 'EMP000'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 font-mono font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block font-bold text-slate-800 text-[11px] uppercase mb-1">
                  Username *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-mono font-bold">
                    @
                  </div>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    placeholder="admin"
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block font-bold text-slate-800 text-[11px] uppercase mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={editForm.mobile_number}
                  onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-900"
                />
              </div>

              {/* Assigned Branch */}
              <div>
                <label className="block font-bold text-slate-800 text-[11px] uppercase mb-1">
                  Assigned Branch *
                </label>
                <select
                  required
                  value={editForm.branch_id}
                  onChange={(e) => setEditForm({ ...editForm, branch_id: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-900 cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.branch_id} value={b.branch_id}>
                      {b.branch_name} ({b.branch_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block font-bold text-slate-800 text-[11px] uppercase mb-1">
                  Department
                </label>
                <input
                  type="text"
                  list="department-options"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  placeholder="Administration"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-900"
                />
                <datalist id="department-options">
                  <option value="Administration" />
                  <option value="Consultation" />
                  <option value="Front Desk" />
                  <option value="Pharmacy" />
                  <option value="Call Center" />
                  <option value="Accounts" />
                </datalist>
              </div>

              {/* Role (Read Only) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-500 text-[11px] uppercase">
                    Role
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    READ ONLY
                  </span>
                </div>
                <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 font-bold text-blue-800 cursor-not-allowed uppercase flex items-center justify-between">
                  <span>SUPER ADMIN</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                </div>
              </div>

              {/* Account Status (Read Only) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-500 text-[11px] uppercase">
                    Account Status
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    READ ONLY
                  </span>
                </div>
                <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 font-bold text-emerald-700 cursor-not-allowed flex items-center justify-between">
                  <span>ACTIVE</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center gap-2 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingProfile}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
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
                disabled={submittingPassword}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingPassword ? (
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
