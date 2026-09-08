import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  ShieldAlert,
  MessageSquare,
  Edit3
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const PROComplaintsPage = () => {
  const { showToast } = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Create Form
  const [createForm, setCreateForm] = useState({
    patient_id: '',
    category_type: 'Billing Dispute',
    description: '',
    priority: 'normal',
    remarks: ''
  });

  // Resolve / Update Form
  const [updateForm, setUpdateForm] = useState({
    status: 'resolved',
    action_taken: '',
    resolution: '',
    remarks: ''
  });

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await proApi.getComplaints();
      if (res.success) {
        setComplaints(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load complaints', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.patient_id || !createForm.description.trim()) {
      showToast('Patient ID and description are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.createComplaint({
        ...createForm,
        patient_id: parseInt(createForm.patient_id)
      });
      if (res.success) {
        showToast('Complaint recorded and escalated', 'success');
        setShowCreateModal(false);
        setCreateForm({ patient_id: '', category_type: 'Billing Dispute', description: '', priority: 'normal', remarks: '' });
        fetchComplaints();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record complaint', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    setSubmitting(true);
    try {
      const res = await proApi.updateComplaint(selectedComplaint.id, updateForm);
      if (res.success) {
        showToast(`Complaint #${selectedComplaint.id} updated successfully`, 'success');
        setSelectedComplaint(null);
        fetchComplaints();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update complaint', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1565C0] inline-block" />
            <AlertTriangle className="w-5 h-5 text-[#D32F2F]" />
            <span>Complaints & Escalations</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track patient grievances, management escalations, and resolution actions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchComplaints}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Log Complaint</span>
          </button>
        </div>
      </div>

      {/* Complaints Table */}
      {loading ? (
        <LoadingSpinner label="Loading complaints..." />
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No active complaints or escalations</p>
          <p className="text-xs text-slate-400 mt-1">All patient complaints have been resolved.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Case #</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Complaint Type</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Description & Resolution</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">#{c.id}</td>
                    <td className="py-3.5 px-4">
                      <Link to={`/pro/patients/${c.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                        {c.patient_name || `Patient #${c.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{c.category_type}</td>
                    <td className="py-3.5 px-4 capitalize">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.priority === 'urgent'
                          ? 'bg-red-100 text-red-800'
                          : c.priority === 'high'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.status === 'resolved' || c.status === 'closed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : c.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="text-slate-900 font-medium truncate">{c.description}</div>
                      {c.resolution && (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 truncate">
                          ✓ Resolution: {c.resolution}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedComplaint(c);
                          setUpdateForm({
                            status: c.status || 'resolved',
                            action_taken: c.action_taken || '',
                            resolution: c.resolution || '',
                            remarks: c.remarks || ''
                          });
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        Update / Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Complaint Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Log Patient Complaint</span>
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Patient ID *</label>
                <input
                  type="number"
                  required
                  value={createForm.patient_id}
                  onChange={e => setCreateForm({ ...createForm, patient_id: e.target.value })}
                  placeholder="Patient ID..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Complaint Category *</label>
                  <select
                    value={createForm.category_type}
                    onChange={e => setCreateForm({ ...createForm, category_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none bg-white font-medium"
                  >
                    <option value="Billing Dispute">Billing Dispute</option>
                    <option value="Treatment Concern">Treatment Concern</option>
                    <option value="Waiting Time">Excessive Waiting Time</option>
                    <option value="Medicine Delay">Medicine Dispensing Delay</option>
                    <option value="Staff Behaviour">Staff Behaviour</option>
                    <option value="Doctor Availability">Doctor Availability</option>
                    <option value="Other">Other Grievance</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Priority *</label>
                  <select
                    value={createForm.priority}
                    onChange={e => setCreateForm({ ...createForm, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none bg-white font-medium"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Detailed Description *</label>
                <textarea
                  required
                  rows={3}
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Detailed description of patient concern..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50">
                  {submitting ? 'Logging...' : 'Log & Escalate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update / Resolve Complaint Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#1565C0]" />
                <span>Update Complaint #{selectedComplaint.id}</span>
              </h2>
              <button onClick={() => setSelectedComplaint(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Lifecycle Status *</label>
                <select
                  value={updateForm.status}
                  onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none bg-white font-medium"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Action Taken</label>
                <input
                  type="text"
                  value={updateForm.action_taken}
                  onChange={e => setUpdateForm({ ...updateForm, action_taken: e.target.value })}
                  placeholder="e.g. Consulted doctor regarding wait time"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Resolution Details</label>
                <textarea
                  rows={2}
                  value={updateForm.resolution}
                  onChange={e => setUpdateForm({ ...updateForm, resolution: e.target.value })}
                  placeholder="Final resolution agreed with patient..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setSelectedComplaint(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 btn-brand-gradient text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50">
                  {submitting ? 'Updating...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
