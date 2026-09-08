import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { usersApi, settingsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { UserCheck, Loader2, Edit3, Shield } from 'lucide-react';

export const EditUserModal = ({ isOpen, onClose, user, onUserUpdated }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    mobile_number: '',
    email: '',
    gender: 'male',
    department: '',
    designation: '',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    settingsApi.getMasterData('departments', { status: 'active' })
      .then(res => { if (res?.success && Array.isArray(res.data)) setDepartmentsList(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        mobile_number: user.mobile_number || '',
        email: user.email || '',
        gender: user.gender || 'male',
        department: user.department || '',
        designation: user.designation || '',
        status: user.status || 'active',
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.mobile_number.trim()) {
      showToast('Full name and mobile number are required', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await usersApi.updateUser(user.user_id, {
        full_name: formData.full_name.trim(),
        mobile_number: formData.mobile_number.trim(),
        email: formData.email.trim() || null,
        gender: formData.gender,
        department: formData.department.trim() || null,
        designation: formData.designation.trim() || null,
        status: formData.status,
      });

      if (res.success) {
        showToast(`Staff member ${formData.full_name} updated successfully`, 'success');
        if (onUserUpdated) onUserUpdated();
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update user record', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Staff Member: ${user.full_name}`} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-700">
        {/* Read-only Credentials Header */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Employee ID & Username</span>
            <div className="font-mono font-bold text-slate-800 text-xs">
              {user.employee_id} • @{user.username}
            </div>
          </div>
          <div className="text-right space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Role</span>
            <span className="capitalize font-bold text-blue-700 px-2.5 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-[11px]">
              {user.role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Editable Personal Details */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Staff Profile Details</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <input
                type="tel"
                required
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@wecare.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Organization Information */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Organization & Status</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                list="edit-user-departments-datalist"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g. Front Desk"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="edit-user-departments-datalist">
                {departmentsList.map(d => (
                  <option key={d.id || d.name} value={d.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g. Senior Staff"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
