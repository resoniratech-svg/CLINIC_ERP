import React, { useEffect, useState, useRef } from 'react';
import { crmApi, usersApi, receptionistApi } from '../../api';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { Layers, Plus, Calendar, Phone, CheckCircle2, ShieldAlert, Search, ChevronDown, X, User } from 'lucide-react';

export const CRMManagementPage = () => {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [eligibleStaff, setEligibleStaff] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const patientDropdownRef = useRef(null);

  const [taskForm, setTaskForm] = useState({
    patient_id: '',
    category: 'treatment',
    due_date: new Date().toISOString().split('T')[0],
    assigned_to: '',
    remarks: '',
  });
  const [savingTask, setSavingTask] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(event.target)) {
        setIsPatientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFollowups = async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await crmApi.getFollowups(params);
      if (res.success) {
        setFollowups(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch CRM followups', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffAndPatients = async () => {
    try {
      const [usersRes, ptsRes] = await Promise.all([
        usersApi.getUsers({ status: 'active' }),
        receptionistApi.searchPatients({ search: '%' }),
      ]);

      if (usersRes.success) {
        const staff = (usersRes.data || []).filter(
          (u) => u.role === 'receptionist' || u.role === 'pro_manager'
        );
        setEligibleStaff(staff);
      }

      if (ptsRes.success) {
        const ptsList = ptsRes.data?.patients || (Array.isArray(ptsRes.data) ? ptsRes.data : []);
        setPatients(ptsList);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchFollowups();
    fetchStaffAndPatients();
  }, [categoryFilter, statusFilter]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.patient_id || !taskForm.assigned_to) {
      showToast('Patient ID and Assigned Staff are required', 'warning');
      return;
    }

    setSavingTask(true);
    try {
      const res = await crmApi.createFollowup({
        patient_id: parseInt(taskForm.patient_id),
        category: taskForm.category || 'treatment',
        assigned_to: parseInt(taskForm.assigned_to),
        due_date: taskForm.due_date,
        remarks: taskForm.remarks || null,
      });

      if (res.success) {
        showToast('CRM follow-up task scheduled successfully', 'success');
        setIsCreateModalOpen(false);
        setTaskForm({
          patient_id: '',
          category: 'treatment',
          due_date: new Date().toISOString().split('T')[0],
          assigned_to: '',
          remarks: '',
        });
        fetchFollowups();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create CRM follow-up task', 'error');
    } finally {
      setSavingTask(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    if (!patientSearchTerm.trim()) return true;
    const q = patientSearchTerm.toLowerCase();
    const name = (p.patient_name || p.full_name || '').toLowerCase();
    const mobile = (p.mobile_number || '').toLowerCase();
    const regId = (p.registration_id || '').toLowerCase();
    const id = String(p.patient_id || '');
    return name.includes(q) || mobile.includes(q) || regId.includes(q) || id.includes(q);
  });

  const selectedPatientObj = patients.find((p) => String(p.patient_id) === String(taskForm.patient_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>CRM Follow-up & Patient Retention Command</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Assignment Policy: CRM calling strictly restricted to <strong>Receptionists</strong> and <strong>PRO / Managers</strong>
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule CRM Follow-up</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="treatment">Treatment Follow-up</option>
          <option value="appointment">Appointment Reminder</option>
          <option value="renewal">Registration Renewal</option>
          <option value="due">Payment Due Follow-up</option>
          <option value="acq">ACQ Monthly Care</option>
          <option value="ocnr">OC / NR Retention</option>
          <option value="general">General Care</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending Only</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading CRM patient queue..." />
        ) : followups.length === 0 ? (
          <EmptyState
            title="No CRM follow-ups found"
            description="All scheduled patient tasks are up to date. Schedule a new task above."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Assigned Personnel</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {followups.map((f) => {
                  const categoryLabels = {
                    treatment: 'Treatment Progress',
                    appointment: 'Appointment Reminder',
                    renewal: 'Registration Renewal',
                    due: 'Payment Due',
                    acq: 'ACQ Monthly Care',
                    ocnr: 'OC / NR Retention',
                    general: 'General Care',
                  };
                  const categoryStyles = {
                    treatment: 'bg-blue-50 text-blue-800 border-blue-200',
                    appointment: 'bg-cyan-50 text-cyan-800 border-cyan-200',
                    renewal: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                    due: 'bg-amber-50 text-amber-800 border-amber-200',
                    acq: 'bg-purple-50 text-purple-800 border-purple-200',
                    ocnr: 'bg-rose-50 text-rose-800 border-rose-200',
                    general: 'bg-slate-50 text-slate-800 border-slate-200',
                  };
                  const categoryKey = (f.category || '').toLowerCase();
                  const displayCategory = categoryLabels[categoryKey] || f.category || 'General';
                  const displayStyle = categoryStyles[categoryKey] || 'bg-slate-50 text-slate-800 border-slate-200';

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{f.patient_name || `Patient #${f.patient_id}`}</div>
                        {f.mobile_number && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            {f.mobile_number}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`capitalize px-2.5 py-1 rounded-full text-[10px] font-bold border ${displayStyle}`}>
                          {displayCategory}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {f.due_date ? new Date(f.due_date).toLocaleDateString() : '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{f.assigned_user_name || 'Assigned Staff'}</div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {f.assigned_role ? f.assigned_role.replace('_', ' ') : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={f.status}>{f.status}</Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-600 text-[11px] max-w-[200px] truncate" title={f.remarks || ''}>
                        {f.remarks || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Schedule Follow-up */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule CRM Follow-up Task"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs text-slate-700">
          {/* Unified Single-Field Searchable Patient Selector */}
          <div className="space-y-1 relative" ref={patientDropdownRef}>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Patient *
            </label>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                required
                value={
                  isPatientDropdownOpen
                    ? patientSearchTerm
                    : selectedPatientObj
                    ? `${selectedPatientObj.patient_name || selectedPatientObj.full_name} (ID: #${selectedPatientObj.patient_id} • ${selectedPatientObj.mobile_number})`
                    : patientSearchTerm
                }
                onFocus={() => {
                  setIsPatientDropdownOpen(true);
                  if (selectedPatientObj) {
                    setPatientSearchTerm(selectedPatientObj.patient_name || selectedPatientObj.full_name);
                  }
                }}
                onChange={(e) => {
                  setPatientSearchTerm(e.target.value);
                  setIsPatientDropdownOpen(true);
                  if (!e.target.value) {
                    setTaskForm({ ...taskForm, patient_id: '' });
                  }
                }}
                placeholder="Search by patient name, mobile, or ID..."
                className={`w-full pl-9 pr-8 py-2 text-xs rounded-xl border ${
                  taskForm.patient_id ? 'border-blue-500 bg-blue-50/20 font-bold text-slate-900' : 'border-slate-300 bg-white'
                } focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all`}
              />

              {taskForm.patient_id ? (
                <button
                  type="button"
                  onClick={() => {
                    setTaskForm({ ...taskForm, patient_id: '' });
                    setPatientSearchTerm('');
                    setIsPatientDropdownOpen(true);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Floating Dropdown Menu */}
            {isPatientDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-52 overflow-y-auto z-50 divide-y divide-slate-100">
                {filteredPatients.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-xs">
                    No patients found matching "{patientSearchTerm}"
                  </div>
                ) : (
                  filteredPatients.map((p) => {
                    const isSelected = String(p.patient_id) === String(taskForm.patient_id);
                    return (
                      <div
                        key={p.patient_id}
                        onClick={() => {
                          setTaskForm({ ...taskForm, patient_id: p.patient_id });
                          setPatientSearchTerm(p.patient_name || p.full_name);
                          setIsPatientDropdownOpen(false);
                        }}
                        className={`p-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          isSelected ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{p.patient_name || p.full_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                              ID: #{p.patient_id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {p.mobile_number} • {p.registration_id || 'REG'}
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-blue-600 text-[11px] font-bold">✓</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Category *</label>
            <select
              value={taskForm.category}
              onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="treatment">Treatment Progress Follow-up</option>
              <option value="appointment">Appointment Confirmation</option>
              <option value="renewal">Registration Renewal</option>
              <option value="due">Payment Due Follow-up</option>
              <option value="acq">ACQ Monthly Care Plan</option>
              <option value="ocnr">OC / NR Retention Call</option>
              <option value="general">General Wellness Check</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Due Date *</label>
            <input
              type="date"
              required
              value={taskForm.due_date}
              onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Assigned Personnel (Receptionist or PRO only) *
            </label>
            <select
              required
              value={taskForm.assigned_to}
              onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Select Receptionist or PRO --</option>
              {eligibleStaff.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name} ({s.role?.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Instructions / Notes</label>
            <textarea
              rows={2}
              value={taskForm.remarks}
              onChange={(e) => setTaskForm({ ...taskForm, remarks: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTask}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingTask ? 'Assigning...' : 'Assign Follow-up'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
