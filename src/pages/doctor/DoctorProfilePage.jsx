import React, { useEffect, useState } from 'react';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { User, Save, RefreshCw, Stethoscope, Shield } from 'lucide-react';

export const DoctorProfilePage = () => {
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ mobile_number: '', email: '' });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await doctorApi.getProfile();
      if (res.success) {
        setProfile(res.data);
        setForm({ mobile_number: res.data.mobile_number || '', email: res.data.email || '' });
      }
    } catch {
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await doctorApi.updateProfile(form);
      if (res.success) {
        showToast('Contact details updated successfully', 'success');
        fetchProfile();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading profile..." />;
  if (!profile) return <div className="text-center py-12 text-slate-500">Profile not found.</div>;

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between text-xs border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className="text-slate-900 font-bold">{value || '—'}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <User className="w-6 h-6 text-emerald-600" /> My Profile
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">View professional details and update personal contact information</p>
      </div>

      {/* Profile Banner */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl font-black">
            {profile.full_name?.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-black">{profile.full_name}</h2>
            <div className="flex items-center gap-2 text-xs text-emerald-200 mt-1">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{profile.specialization || 'Homeopathic Physician'}</span>
              {profile.qualification && <span>• {profile.qualification}</span>}
            </div>
            <div className="text-xs text-emerald-100 mt-0.5">{profile.employee_id}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Professional Info (read-only) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-indigo-700" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Professional Details</h3>
          </div>
          <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-4">
            🔒 Professional details are managed by Super Admin only
          </div>
          <InfoRow label="Employee ID" value={profile.employee_id} />
          <InfoRow label="Specialization" value={profile.specialization} />
          <InfoRow label="Qualification" value={profile.qualification} />
          <InfoRow label="Reg. Number" value={profile.medical_registration_number} />
          <InfoRow label="Gender" value={profile.gender} />
          <InfoRow label="Joining Date" value={profile.date_of_joining ? new Date(profile.date_of_joining).toLocaleDateString('en-IN') : '—'} />
          <InfoRow label="Department" value={profile.department} />
          <InfoRow label="Status" value={profile.doctor_status} />
        </div>

        {/* Editable Contact Info */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Update Contact Details</h3>
          </div>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Mobile Number</label>
              <input
                type="tel"
                value={form.mobile_number}
                onChange={e => setForm(f => ({...f, mobile_number: e.target.value}))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none"
                placeholder="Your mobile number"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({...f, email: e.target.value}))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none"
                placeholder="Your email address"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Update Contact Details'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 mb-2">Current Values</h4>
            <InfoRow label="Mobile" value={profile.mobile_number} />
            <InfoRow label="Email" value={profile.email} />
          </div>
        </div>
      </div>
    </div>
  );
};
