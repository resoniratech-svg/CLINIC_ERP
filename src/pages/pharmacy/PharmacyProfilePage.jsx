import React, { useEffect, useState } from 'react';
import {
  User,
  Building,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  KeyRound,
  Lock,
  Save,
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { pharmacyApi, authApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const PharmacyProfilePage = () => {
  const { showToast } = useToast();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    full_name: '',
    mobile_number: '',
    email: '',
  });
  const [savingContact, setSavingContact] = useState(false);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pharmacyApi.getProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        setContactForm({
          full_name: res.data.full_name || '',
          mobile_number: res.data.mobile_number || '',
          email: res.data.email || '',
        });
      } else {
        setError(res.message || 'Failed to load profile');
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to load profile details';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Update Contact Details Handler
  const handleUpdateContact = async (e) => {
    e.preventDefault();
    if (savingContact) return;

    const cleanName = contactForm.full_name.trim();
    const cleanMobile = contactForm.mobile_number.trim();
    const cleanEmail = contactForm.email.trim();

    if (!cleanName) {
      showToast('Full Name cannot be empty', 'warning');
      return;
    }

    if (cleanMobile && !/^\d{10,15}$/.test(cleanMobile)) {
      showToast('Invalid mobile number format. Must be between 10 and 15 digits', 'warning');
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast('Invalid email format', 'warning');
      return;
    }

    setSavingContact(true);
    try {
      const res = await pharmacyApi.updateProfile({
        full_name: cleanName,
        mobile_number: cleanMobile,
        email: cleanEmail,
      });
      if (res.success && res.data) {
        showToast(res.message || 'Contact details updated successfully', 'success');
        setProfile((prev) => ({
          ...prev,
          ...res.data,
          full_name: res.data.full_name || cleanName,
          mobile_number: res.data.mobile_number !== undefined ? res.data.mobile_number : cleanMobile,
          email: res.data.email !== undefined ? res.data.email : cleanEmail,
        }));
        if (updateUser) {
          updateUser({ full_name: res.data.full_name || cleanName });
        }
      } else {
        showToast(res.message || 'Failed to update contact details', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error updating contact details', 'error');
    } finally {
      setSavingContact(false);
    }
  };

  // Update Password Handler
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (savingPassword) return;

    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      showToast('All password fields are required', 'warning');
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('New password and confirm password do not match', 'warning');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      showToast('New password must be at least 6 characters long', 'warning');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authApi.changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      if (res.success) {
        showToast('Password changed successfully', 'success');
        setPasswordForm({
          old_password: '',
          new_password: '',
          confirm_password: '',
        });
      } else {
        showToast(res.message || 'Failed to change password', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update password. Check your current password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs max-w-lg mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Profile Unavailable</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error || 'Could not load your pharmacy profile.'}</p>
        <button
          onClick={fetchProfile}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pharmacy User Profile</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered credentials, operational branch assignments, and security settings
          </p>
        </div>
        <button
          onClick={fetchProfile}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Identity Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
            {profile.full_name?.charAt(0) || 'P'}
          </div>
          <div className="text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold text-slate-800">{profile.full_name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                {profile.role || 'Pharmacy'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                {profile.status || 'Active'}
              </span>
            </div>
            {profile.username && (
              <p className="text-xs font-semibold text-blue-600">
                @{profile.username}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Employee ID: <span className="font-bold text-slate-700">{profile.employee_id || 'N/A'}</span> •{' '}
              {profile.branch_name || (profile.branch_id ? `Branch #${profile.branch_id}` : 'Main Branch')}
            </p>
          </div>
        </div>

        {/* Read-only Hospital Master Attributes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span className="text-2xs font-bold uppercase tracking-wider">Role & Scope</span>
            </div>
            <p className="text-xs font-bold text-slate-800 capitalize">{profile.role ? profile.role.replace('_', ' ') : 'Pharmacist'}</p>
            <p className="text-2xs text-slate-500 mt-0.5">{profile.department || 'Dispensing & Stock'}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Building className="w-4 h-4 text-indigo-600" />
              <span className="text-2xs font-bold uppercase tracking-wider">Assigned Branch</span>
            </div>
            <p className="text-xs font-bold text-slate-800">{profile.branch_name || (profile.branch_id ? `Branch #${profile.branch_id}` : 'Assigned Branch')}</p>
            <p className="text-2xs text-slate-500 mt-0.5">{profile.branch_id ? `Branch ID: #${profile.branch_id}` : (profile.branch_code ? `Code: ${profile.branch_code}` : 'Branch ID: N/A')}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-2xs font-bold uppercase tracking-wider">System Privileges</span>
            </div>
            <p className="text-xs font-bold text-slate-800">Dispense, Stock, Audit</p>
            <p className="text-2xs text-slate-500 mt-0.5">FEFO & Clarifications</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Shield className="w-4 h-4 text-red-600" />
              <span className="text-2xs font-bold uppercase tracking-wider">Clinical Restriction</span>
            </div>
            <p className="text-xs font-bold text-slate-800">Doctor Notes Confidential</p>
            <p className="text-2xs text-slate-500 mt-0.5">No Billing / Clinical Override</p>
          </div>
        </div>
      </div>

      {/* Two Columns: Update Contact Details & Update Password */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form 1: Update Contact */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Update Contact Details</h3>
              <p className="text-2xs text-slate-500">Keep personal phone and email synchronized</p>
            </div>
          </div>

          <form onSubmit={handleUpdateContact} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={contactForm.full_name}
                onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={contactForm.mobile_number}
                  onChange={(e) => setContactForm({ ...contactForm, mobile_number: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="pharmacist@wecare.hospital"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingContact}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingContact ? 'Saving Changes...' : 'Save Contact Details'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Form 2: Update Password */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Update Password</h3>
              <p className="text-2xs text-slate-500">Ensure security compliance with regular updates</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Current Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordForm.old_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="Re-enter new password"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{savingPassword ? 'Updating Password...' : 'Change Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
