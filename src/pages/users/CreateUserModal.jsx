import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { usersApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { UserPlus, Loader2 } from 'lucide-react';

export const CreateUserModal = ({ isOpen, onClose, onUserCreated }) => {
  const [role, setRole] = useState('receptionist');
  const [formData, setFormData] = useState({
    full_name: '',
    employee_id: '',
    mobile_number: '',
    email: '',
    gender: 'male',
    date_of_joining: new Date().toISOString().split('T')[0],
    username: '',
    password: '',
    department: '',
    designation: '',
    status: 'active',
  });

  // Role-specific sub-states
  const [receptionistPerms, setReceptionistPerms] = useState({
    registration: true,
    enquiry: true,
    appointment: true,
    checkin: true,
    consultation_fee_billing: true,
    payment_collection: true,
    crm_calling: true,
    followup: true,
    renewal: true,
    due_management: true,
  });

  const [doctorDetails, setDoctorDetails] = useState({
    qualification: 'MBBS, MD',
    specialization: 'Homeopathy Specialist',
    medical_registration_number: '',
    experience_years: 5,
    working_days: 'Mon,Tue,Wed,Thu,Fri',
    start_time: '09:00',
    end_time: '17:00',
    slot_duration_minutes: 15,
    new_consultation_fee: 500,
    renewal_consultation_fee: 300,
    followup_consultation_fee: 200,
  });

  const [proPerms, setProPerms] = useState({
    counselling: true,
    billing: true,
    payment: true,
    due_collection: true,
    crm: true,
    followup: true,
    renewals: true,
    complaints: true,
    feedback: true,
    reports: true,
    accountant: true,
  });

  const [execDetails, setExecDetails] = useState({
    per_lead_incentive: 100,
    incentive_type: 'per_lead',
    incentive_amount: 100,
    incentive_trigger: 'created',
  });

  const [pharmacyPerms, setPharmacyPerms] = useState({
    prescription_queue: true,
    dispensing: true,
    inventory: true,
    stock: true,
    batch: true,
    expiry: true,
    returns: true,
    stock_adjustment: true,
    stock_transactions: true,
  });

  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'super_admin') {
      setFormData((prev) => ({ ...prev, department: 'Administration', designation: 'Super Administrator' }));
    } else if (newRole === 'executive') {
      setFormData((prev) => ({ ...prev, department: 'Call Center', designation: 'Executive' }));
    } else if (newRole === 'doctor') {
      setFormData((prev) => ({ ...prev, department: 'Consultation', designation: 'Consultant Doctor' }));
    } else if (newRole === 'receptionist') {
      setFormData((prev) => ({ ...prev, department: 'Front Desk', designation: 'Receptionist' }));
    } else if (newRole === 'pro_manager') {
      setFormData((prev) => ({ ...prev, department: 'Administration', designation: 'PRO / Manager' }));
    } else if (newRole === 'pharmacy') {
      setFormData((prev) => ({ ...prev, department: 'Pharmacy', designation: 'Pharmacist' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.employee_id || !formData.mobile_number || !formData.username || !formData.password) {
      showToast('Please fill all required personal & login fields', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        role,
        branch_id: 1, // Single branch
      };

      if (role === 'receptionist') {
        payload.permissions = receptionistPerms;
      } else if (role === 'doctor') {
        payload.doctor_details = doctorDetails;
      } else if (role === 'pro_manager') {
        payload.permissions = proPerms;
      } else if (role === 'executive') {
        payload.executive_details = execDetails;
      } else if (role === 'pharmacy') {
        payload.permissions = pharmacyPerms;
      }

      const res = await usersApi.createUser(payload);
      if (res.success) {
        showToast(`User ${formData.full_name} (${role}) created successfully!`, 'success');
        if (onUserCreated) onUserCreated();
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create user', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Onboard Hospital Staff User" maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Selection Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Select User Role *</label>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {[
              { id: 'super_admin', label: 'Super Admin' },
              { id: 'receptionist', label: 'Receptionist' },
              { id: 'doctor', label: 'Doctor' },
              { id: 'pro_manager', label: 'PRO / Manager' },
              { id: 'executive', label: 'Executive' },
              { id: 'pharmacy', label: 'Pharmacy' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleChange(r.id)}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                  role === r.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section: Personal Information */}
        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">1. Personal Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Employee ID *</label>
              <input
                type="text"
                required
                placeholder="e.g. EMP005"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <input
                type="tel"
                required
                placeholder="9876543210"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="user@wecare.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date of Joining</label>
              <input
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section: Organization & Credentials */}
        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Organization & Credentials</h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Branch</label>
              <input
                type="text"
                disabled
                value="Karimnagar Main (KRM001)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g. Front Desk"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. ramesh_k"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Initial Password *</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section: Role-Specific Configuration */}
        {role === 'receptionist' && (
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200/70 space-y-3">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              3. Receptionist Granular Permissions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
              {Object.keys(receptionistPerms).map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receptionistPerms[perm]}
                    onChange={(e) => setReceptionistPerms({ ...receptionistPerms, [perm]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="capitalize text-[11px] font-medium">{perm.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {role === 'doctor' && (
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200/70 space-y-3">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
              3. Doctor Clinical & Fee Settings
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Specialization *</label>
                <input
                  type="text"
                  value={doctorDetails.specialization}
                  onChange={(e) => setDoctorDetails({ ...doctorDetails, specialization: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Qualification</label>
                <input
                  type="text"
                  value={doctorDetails.qualification}
                  onChange={(e) => setDoctorDetails({ ...doctorDetails, qualification: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Medical Reg Number</label>
                <input
                  type="text"
                  value={doctorDetails.medical_registration_number}
                  onChange={(e) => setDoctorDetails({ ...doctorDetails, medical_registration_number: e.target.value })}
                  placeholder="MCI-XXXXX"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Consultation Fee (₹)</label>
                <input
                  type="number"
                  value={doctorDetails.new_consultation_fee}
                  onChange={(e) => setDoctorDetails({ ...doctorDetails, new_consultation_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Renewal Fee (₹)</label>
                <input
                  type="number"
                  value={doctorDetails.renewal_consultation_fee}
                  onChange={(e) => setDoctorDetails({ ...doctorDetails, renewal_consultation_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Follow-up Fee (₹)</label>
                <input
                  type="number"
                  value={doctorDetails.followup_consultation_fee}
                  onChange={(e) => setDoctorDetails({ ...doctorDetails, followup_consultation_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {role === 'executive' && (
          <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-200/70 space-y-3">
            <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider">
              3. Call Center & Incentive Configuration
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Per Lead Incentive (₹) *</label>
                <input
                  type="number"
                  value={execDetails.per_lead_incentive}
                  onChange={(e) => setExecDetails({ ...execDetails, per_lead_incentive: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Incentive Trigger</label>
                <select
                  value={execDetails.incentive_trigger}
                  onChange={(e) => setExecDetails({ ...execDetails, incentive_trigger: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="created">Lead Created</option>
                  <option value="qualified">Lead Qualified</option>
                  <option value="converted">Lead Converted</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {role === 'pro_manager' && (
          <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-200/70 space-y-3">
            <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
              3. PRO / Manager & Accountant Permissions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
              {Object.keys(proPerms).map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={proPerms[perm]}
                    onChange={(e) => setProPerms({ ...proPerms, [perm]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="capitalize text-[11px] font-medium">{perm.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {role === 'pharmacy' && (
          <div className="bg-red-50/50 p-4 rounded-2xl border border-red-200/70 space-y-3">
            <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">
              3. Pharmacy Operational Permissions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
              {Object.keys(pharmacyPerms).map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pharmacyPerms[perm]}
                    onChange={(e) => setPharmacyPerms({ ...pharmacyPerms, [perm]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="capitalize text-[11px] font-medium">{perm.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span>Save User Record</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
