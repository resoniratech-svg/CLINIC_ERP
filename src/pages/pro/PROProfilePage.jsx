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
import { proApi, authApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const PROProfilePage = () => {
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Contact form state
  const [contactForm, setContactForm] = useState({ mobile_number: '', email: '' });
  const [savingContact, setSavingContact] = useState(false);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await proApi.getProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        setContactForm({
          mobile_number: res.data.mobile_number || '',
          email: res.data.email || ''
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

    const cleanMobile = contactForm.mobile_number ? contactForm.mobile_number.trim() : '';
    const cleanEmail = contactForm.email ? contactForm.email.trim() : '';

    if (!cleanMobile && !cleanEmail) {
      showToast('At least one contact field (mobile number or email) must be provided', 'warning');
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
      const res = await proApi.updateProfile({
        mobile_number: cleanMobile,
        email: cleanEmail
      });
      if (res.success && res.data) {
        showToast(res.message || 'Contact details updated successfully', 'success');
        // Authoritative update from server data
        setProfile(prev => ({
          ...prev,
          mobile_number: res.data.mobile_number,
          email: res.data.email
        }));
        setContactForm({
          mobile_number: res.data.mobile_number || '',
          email: res.data.email || ''
        });
      } else {
        showToast(res.message || 'Failed to update contact details', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update contact details';
      showToast(msg, 'error');
    } finally {
      setSavingContact(false);
    }
  };

  // Update Password Handler
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (savingPassword) return;

    const { old_password, new_password, confirm_password } = passwordForm;

    if (!old_password || !new_password || !confirm_password) {
      showToast('All password fields are required', 'warning');
      return;
    }

    if (new_password !== confirm_password) {
      showToast('New passwords do not match', 'warning');
      return;
    }

    if (new_password.length < 6) {
      showToast('New password must be at least 6 characters', 'warning');
      return;
    }

    if (old_password === new_password) {
      showToast('New password must be different from current password', 'warning');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authApi.changePassword({
        old_password,
        new_password
      });

      if (res.success) {
        showToast('Password changed successfully!', 'success');
        setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      } else {
        showToast(res.message || 'Failed to change password', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error updating password. Please verify current password.';
      showToast(msg, 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading PRO profile..." />;
  
  if (error && !profile) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-md mx-auto my-12 shadow-sm space-y-4">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Failed to Load Profile</h3>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
        <button
          onClick={fetchProfile}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!profile) return <div className="text-center py-12 text-slate-500 font-bold">Profile not found.</div>;

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between items-center text-xs border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className="text-slate-900 font-bold">{value || '—'}</span>
    </div>
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const [y, m, d] = cleanDate.split('-');
      return y && m && d ? `${d}/${m}/${y}` : cleanDate;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] inline-block" />
            <User className="w-5 h-5 text-[#1565C0]" />
            <span>My Profile & Settings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View operational details, update contact information, and manage your account security credentials
          </p>
        </div>

        <button
          onClick={fetchProfile}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Profile Banner */}
      <div className="bg-gradient-to-r from-[#1565C0] via-[#0D47A1] to-[#B71C1C] rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl font-black shrink-0 shadow-inner">
            {profile.full_name?.charAt(0)?.toUpperCase() || 'P'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black">{profile.full_name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                {profile.designation || 'PRO / Manager'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-blue-100 mt-1.5 flex-wrap">
              <span className="font-mono bg-black/20 px-2 py-0.5 rounded-md">ID: {profile.employee_id || 'PRO001'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                {profile.branch_name || 'Karimnagar Main Branch'} ({profile.branch_code || 'KRM001'})
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Operational / Professional Details (Read-only / Managed by Admin) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#1565C0]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Operational & Employment Details</h3>
                <p className="text-[11px] text-slate-500">Official hospital designation and branch assignment</p>
              </div>
            </div>

            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Professional and branch details are managed strictly by Super Administrator.</span>
            </div>

            <div className="space-y-0.5">
              <InfoRow label="Employee ID" value={profile.employee_id} />
              <InfoRow label="Username" value={profile.username} />
              <InfoRow label="Designation" value={profile.designation || 'PRO / Manager'} />
              <InfoRow label="Department" value={profile.department || 'Administration'} />
              <InfoRow label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '—'} />
              <InfoRow label="Joining Date" value={formatDate(profile.date_of_joining)} />
              <InfoRow
                label="Assigned Branch"
                value={`${profile.branch_name || 'Karimnagar Main'} (${profile.branch_code || 'KRM001'})`}
              />
              <InfoRow
                label="Account Status"
                value={
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    {profile.status || 'Active'}
                  </span>
                }
              />
            </div>
          </div>

          {/* Authorised Module Access Privileges */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Authorised Module Privileges</h3>
                <p className="text-[11px] text-slate-500">Active role-based operational permissions</p>
              </div>
            </div>

            {(profile.permissions && profile.permissions.length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {profile.permissions.map((perm, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl text-slate-700 border border-slate-100">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium text-[11px]">{perm}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No active module privileges assigned. Please contact Super Administrator.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Personal Contact & Security Settings */}
        <div className="space-y-6">
          {/* Card A: Update Contact Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Phone className="w-4 h-4 text-[#1565C0]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Contact Details</h3>
                <p className="text-[11px] text-slate-500">Personal phone number and official email address</p>
              </div>
            </div>

            <form onSubmit={handleUpdateContact} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Mobile Number</label>
                <input
                  type="tel"
                  value={contactForm.mobile_number}
                  onChange={e => setContactForm({ ...contactForm, mobile_number: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="e.g. pro@wecare.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingContact}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {savingContact ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savingContact ? 'Saving...' : 'Update Contact Details'}</span>
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 space-y-1">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Values</h4>
              <InfoRow label="Current Mobile" value={profile.mobile_number} />
              <InfoRow label="Current Email" value={profile.email} />
            </div>
          </div>

          {/* Card B: Update Password */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Lock className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Password</h3>
                <p className="text-[11px] text-slate-500">Change your portal authentication password</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Current Password *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.old_password}
                  onChange={e => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">New Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.new_password}
                    onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    placeholder="Min. 6 characters"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.confirm_password}
                    onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>{savingPassword ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default PROProfilePage;
