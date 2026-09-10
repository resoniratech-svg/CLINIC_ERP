import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { usersApi, settingsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { UserCheck, Loader2, Edit3, Shield } from 'lucide-react';

// Canonical receptionist permission labels matching CreateUserModal
const RECEPTIONIST_PERMISSION_LABELS = {
  registration:            'Registration',
  enquiry:                 'Enquiry',
  appointment:             'Appointment',
  checkin:                 'Check-in',
  consultation_fee_billing:'Consultation Fee Billing',
  payment_collection:      'Payment Collection',
  crm_calling:             'CRM Calling',
  followup:                'Follow-up',
  renewal:                 'Renewal',
  due_management:          'Due Management',
  coupon_management:       'Coupon Management',
};

// Safe empty baseline where every permission is unchecked (false)
const EMPTY_RECEPTIONIST_PERMS = {
  registration: false,
  enquiry: false,
  appointment: false,
  checkin: false,
  consultation_fee_billing: false,
  payment_collection: false,
  crm_calling: false,
  followup: false,
  renewal: false,
  due_management: false,
  coupon_management: false,
};

const PRO_PERMISSION_LABELS = {
  counselling:      'Counselling',
  billing:          'Billing',
  payment:          'Payment',
  due_collection:   'Due Collection',
  crm:              'CRM',
  followup:         'Follow-up',
  renewals:         'Renewals',
  complaints:       'Complaints',
  feedback:         'Feedback',
  reports:          'Reports',
  accountant:       'Accountant',
  coupon_management:'Coupon Management',
};

const EMPTY_PRO_PERMS = {
  counselling: false,
  billing: false,
  payment: false,
  due_collection: false,
  crm: false,
  followup: false,
  renewals: false,
  complaints: false,
  feedback: false,
  reports: false,
  accountant: false,
  coupon_management: false,
};

const DOCTOR_PERMISSION_LABELS = {
  coupon_management: 'Coupon Management',
};

const EMPTY_DOCTOR_PERMS = {
  coupon_management: false,
};

/**
 * Generic normalizer for extracting boolean permission states from backend shapes
 */
const normalizePermissions = (perms, emptyTemplate) => {
  if (!perms || typeof perms !== 'object') {
    return { ...emptyTemplate };
  }
  const result = { ...emptyTemplate };
  for (const key of Object.keys(emptyTemplate)) {
    const val = perms[key];
    result[key] = val === true || val === 'true' || val === 1;
  }
  return result;
};

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

  const [receptionistPerms, setReceptionistPerms] = useState(EMPTY_RECEPTIONIST_PERMS);
  const [proPerms, setProPerms] = useState(EMPTY_PRO_PERMS);
  const [doctorPerms, setDoctorPerms] = useState(EMPTY_DOCTOR_PERMS);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    settingsApi.getMasterData('departments', { status: 'active' })
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) setDepartmentsList(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen || !user) {
      setFormData({
        full_name: '',
        mobile_number: '',
        email: '',
        gender: 'male',
        department: '',
        designation: '',
        status: 'active',
      });
      setReceptionistPerms({ ...EMPTY_RECEPTIONIST_PERMS });
      setProPerms({ ...EMPTY_PRO_PERMS });
      setDoctorPerms({ ...EMPTY_DOCTOR_PERMS });
      setPermissionsLoading(false);
      return;
    }

    // Immediately populate personal & organization fields from prop
    setFormData({
      full_name: user.full_name || '',
      mobile_number: user.mobile_number || '',
      email: user.email || '',
      gender: user.gender || 'male',
      department: user.department || '',
      designation: user.designation || '',
      status: user.status || 'active',
    });

    const isPermRole = ['receptionist', 'pro_manager', 'doctor'].includes(user.role);

    if (isPermRole) {
      // Step A: Immediately apply permissions from user prop if present
      if (user.permissions && typeof user.permissions === 'object') {
        if (user.role === 'receptionist') setReceptionistPerms(normalizePermissions(user.permissions, EMPTY_RECEPTIONIST_PERMS));
        if (user.role === 'pro_manager') setProPerms(normalizePermissions(user.permissions, EMPTY_PRO_PERMS));
        if (user.role === 'doctor') setDoctorPerms(normalizePermissions(user.permissions, EMPTY_DOCTOR_PERMS));
      } else {
        setReceptionistPerms({ ...EMPTY_RECEPTIONIST_PERMS });
        setProPerms({ ...EMPTY_PRO_PERMS });
        setDoctorPerms({ ...EMPTY_DOCTOR_PERMS });
      }

      // Step B: Asynchronously fetch latest authoritative permissions from backend
      setPermissionsLoading(true);
      let isMounted = true;

      usersApi.getUserById(user.user_id)
        .then((res) => {
          if (!isMounted) return;
          if (res?.success && res.data) {
            const fetchedUser = res.data;
            setFormData((prev) => ({
              ...prev,
              full_name: fetchedUser.full_name || prev.full_name,
              mobile_number: fetchedUser.mobile_number || prev.mobile_number,
              email: fetchedUser.email !== undefined ? (fetchedUser.email || '') : prev.email,
              gender: fetchedUser.gender || prev.gender,
              department: fetchedUser.department || prev.department,
              designation: fetchedUser.designation || prev.designation,
              status: fetchedUser.status || prev.status,
            }));

            if (user.role === 'receptionist') {
              setReceptionistPerms(normalizePermissions(fetchedUser.permissions, EMPTY_RECEPTIONIST_PERMS));
            } else if (user.role === 'pro_manager') {
              setProPerms(normalizePermissions(fetchedUser.permissions, EMPTY_PRO_PERMS));
            } else if (user.role === 'doctor') {
              setDoctorPerms(normalizePermissions(fetchedUser.permissions, EMPTY_DOCTOR_PERMS));
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load fresh user permissions in EditUserModal:', err);
        })
        .finally(() => {
          if (isMounted) setPermissionsLoading(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setPermissionsLoading(false);
    }
  }, [isOpen, user?.user_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.mobile_number.trim()) {
      showToast('Full name and mobile number are required', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        mobile_number: formData.mobile_number.trim(),
        email: formData.email.trim() || null,
        gender: formData.gender,
        department: formData.department.trim() || null,
        designation: formData.designation.trim() || null,
        status: formData.status,
      };

      // Include accurate permissions in the payload when editing
      if (user.role === 'receptionist') {
        payload.permissions = receptionistPerms;
      } else if (user.role === 'pro_manager') {
        payload.permissions = proPerms;
      } else if (user.role === 'doctor') {
        payload.permissions = doctorPerms;
      }

      const res = await usersApi.updateUser(user.user_id, payload);

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
                {departmentsList.map((d) => (
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

        {/* Receptionist Granular Permissions */}
        {user.role === 'receptionist' && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Receptionist Granular Permissions
                </h4>
              </div>
              {permissionsLoading && (
                <span className="flex items-center gap-1.5 text-[11px] text-blue-600 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading saved permissions...
                </span>
              )}
            </div>

            <div
              className={`bg-blue-50/50 p-3.5 rounded-2xl border border-blue-200/70 transition-opacity ${
                permissionsLoading ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-700">
                {Object.entries(RECEPTIONIST_PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={permissionsLoading}
                      checked={receptionistPerms[key] === true}
                      onChange={(e) =>
                        setReceptionistPerms((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium">{label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] text-blue-600 font-medium">
                ⚠ The user must log out and log back in for permission changes to take effect.
              </p>
            </div>
          </div>
        )}

        {/* PRO / Manager Granular Permissions */}
        {user.role === 'pro_manager' && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  PRO / Manager Granular Permissions
                </h4>
              </div>
              {permissionsLoading && (
                <span className="flex items-center gap-1.5 text-[11px] text-purple-600 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading saved permissions...
                </span>
              )}
            </div>

            <div
              className={`bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200/70 transition-opacity ${
                permissionsLoading ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-700">
                {Object.entries(PRO_PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={permissionsLoading}
                      checked={proPerms[key] === true}
                      onChange={(e) =>
                        setProPerms((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 disabled:opacity-50 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium">{label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] text-purple-600 font-medium">
                ⚠ The user must log out and log back in for permission changes to take effect.
              </p>
            </div>
          </div>
        )}

        {/* Doctor Granular Permissions */}
        {user.role === 'doctor' && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Doctor Granular Permissions
                </h4>
              </div>
              {permissionsLoading && (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading saved permissions...
                </span>
              )}
            </div>

            <div
              className={`bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 transition-opacity ${
                permissionsLoading ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-700">
                {Object.entries(DOCTOR_PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={permissionsLoading}
                      checked={doctorPerms[key] === true}
                      onChange={(e) =>
                        setDoctorPerms((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium">{label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] text-emerald-600 font-medium">
                ⚠ The doctor must log out and log back in for permission changes to take effect.
              </p>
            </div>
          </div>
        )}

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
            disabled={loading || permissionsLoading}
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
