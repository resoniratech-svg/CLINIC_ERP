import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Plus,
  Search,
  HeartHandshake,
  CheckCircle2,
  UserPlus,
  Building,
  UserCheck,
  ChevronDown,
  X,
  Phone,
  BadgeCheck
} from 'lucide-react';

export const EmployeeReferralsPage = () => {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Employee search inside modal
  const [empSearchTerm, setEmpSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const empDropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    patient_name: '',
    mobile_number: '',
    age: '',
    gender: 'male',
    village_mandal: '',
    reason: '',
    remarks: '',
  });

  const { showToast } = useToast();

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getEmployeeReferrals();
      if (res.success) setReferrals(res.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load employee referrals', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async (searchTerm = '') => {
    setLoadingEmps(true);
    try {
      const params = {};
      if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      const res = await receptionistApi.getEmployees(params);
      if (res.success && Array.isArray(res.data)) {
        setEmployees(res.data);
      }
    } catch (err) {
      console.error('Failed to load eligible employees:', err);
    } finally {
      setLoadingEmps(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
    fetchEmployees();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target)) {
        setIsEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter employees locally or trigger fetch
  const filteredEmployees = employees.filter((emp) => {
    if (!empSearchTerm.trim()) return true;
    const q = empSearchTerm.toLowerCase();
    const name = (emp.full_name || '').toLowerCase();
    const empId = (emp.employee_id || '').toLowerCase();
    const mobile = (emp.mobile_number || '').toLowerCase();
    const dept = (emp.department || emp.role || '').toLowerCase();
    return name.includes(q) || empId.includes(q) || mobile.includes(q) || dept.includes(q);
  });

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setIsEmpDropdownOpen(false);
    setEmpSearchTerm('');
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setEmpSearchTerm('');
    fetchEmployees();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) {
      showToast('Please search and select a referring employee', 'warning');
      return;
    }
    if (!formData.patient_name.trim() || !formData.mobile_number.trim()) {
      showToast('Patient name and mobile number are required', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await receptionistApi.createEmployeeReferral({
        patient_name: formData.patient_name.trim(),
        mobile_number: formData.mobile_number.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        village_mandal: formData.village_mandal.trim() || null,
        reason: formData.reason.trim() || null,
        referring_employee_id: parseInt(selectedEmployee.user_id),
        remarks: formData.remarks.trim() || null,
      });

      if (res.success) {
        showToast('Employee referral recorded! Created patient with valid registration & credited to Unit Target.', 'success');
        setIsModalOpen(false);
        setSelectedEmployee(null);
        setFormData({
          patient_name: '',
          mobile_number: '',
          age: '',
          gender: 'male',
          village_mandal: '',
          reason: '',
          remarks: '',
        });
        fetchReferrals();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record referral', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span>Employee Referral Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record hospital staff patient referrals with real employee tagging and automatic patient registration. Contributes directly to Unit Target.
          </p>
        </div>

        <button
          onClick={() => navigate('/receptionist/patients/register', { state: { leadSource: 'employee_referral' } })}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Employee Referral</span>
        </button>
      </div>

      {/* Referrals Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading employee referrals..." />
        ) : referrals.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            No employee referrals recorded yet. Click "+ New Employee Referral" to record staff recommendations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Referral Code</th>
                  <th className="py-3.5 px-4">Patient Name</th>
                  <th className="py-3.5 px-4">Referring Employee</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Target Type</th>
                  <th className="py-3.5 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {referrals.map((ref) => {
                  const empName = ref.referring_employee_name || ref.full_name || 'Hospital Staff';
                  const empId = ref.employee_id || (ref.referring_employee_id ? `EMP#${ref.referring_employee_id}` : 'Staff');

                  return (
                    <tr key={ref.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                        {ref.referral_code || `REF-${ref.id}`}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{ref.patient_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{ref.mobile_number}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{empName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{empId}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {ref.department || 'General Staff'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          Unit Target
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {ref.created_at ? new Date(ref.created_at).toLocaleDateString() : 'Today'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Employee Referral Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record New Employee Referral"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
          {/* Searchable Referring Employee Selector */}
          <div className="p-3.5 bg-purple-50/70 rounded-2xl border border-purple-200 space-y-2.5">
            <label className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center justify-between">
              <span>Select Referring Employee <span className="text-red-500">*</span></span>
              {selectedEmployee && (
                <span className="text-[10px] text-purple-700 font-normal font-mono">
                  User ID #{selectedEmployee.user_id}
                </span>
              )}
            </label>

            {selectedEmployee ? (
              <div className="p-3 bg-white rounded-xl border border-purple-300 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs shrink-0">
                    {selectedEmployee.full_name?.charAt(0) || 'E'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>{selectedEmployee.full_name}</span>
                      <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded font-mono text-[10px]">
                        {selectedEmployee.employee_id || `EMP${selectedEmployee.user_id}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{selectedEmployee.department || selectedEmployee.role || 'Staff'}</span>
                      {selectedEmployee.mobile_number && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{selectedEmployee.mobile_number}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Change Employee"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative" ref={empDropdownRef}>
                <div className="relative">
                  <Search className="w-4 h-4 text-purple-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by Employee ID, Name, or Mobile Number..."
                    value={empSearchTerm}
                    onFocus={() => setIsEmpDropdownOpen(true)}
                    onChange={(e) => {
                      setEmpSearchTerm(e.target.value);
                      setIsEmpDropdownOpen(true);
                      fetchEmployees(e.target.value);
                    }}
                    className="w-full pl-9 pr-8 py-2.5 text-xs bg-white border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium"
                  />
                  {empSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpSearchTerm('');
                        fetchEmployees('');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isEmpDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                    {loadingEmps ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        Searching active employees...
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        No active employees found matching "{empSearchTerm}".
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <div
                          key={emp.user_id}
                          onClick={() => handleSelectEmployee(emp)}
                          className="p-2.5 hover:bg-purple-50 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {emp.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-purple-700 font-semibold">{emp.employee_id || `EMP${emp.user_id}`}</span>
                              <span>•</span>
                              <span>{emp.department || emp.role || 'Staff'}</span>
                            </div>
                          </div>
                          {emp.mobile_number && (
                            <span className="text-[11px] font-mono text-slate-400">
                              {emp.mobile_number}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Patient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Patient Full Name *</label>
              <input
                type="text"
                required
                value={formData.patient_name}
                onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                placeholder="e.g. Anjali Devi"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <input
                type="tel"
                required
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Age</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="28"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Village / Mandal</label>
            <input
              type="text"
              value={formData.village_mandal}
              onChange={(e) => setFormData({ ...formData, village_mandal: e.target.value })}
              placeholder="e.g. Secunderabad"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Reason / Symptoms</label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g. Chronic joint pain, skin condition"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Referral Remarks</label>
            <input
              type="text"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="e.g. Colleague family member"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? <LoadingSpinner size="sm" /> : <UserPlus className="w-4 h-4" />}
              <span>Record Referral</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

