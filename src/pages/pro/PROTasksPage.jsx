import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  Calendar,
  PhoneCall,
  RefreshCw,
  AlertCircle,
  User
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const PROTasksPage = () => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reschedule modal
  const [selectedTask, setSelectedTask] = useState(null);
  const [reschedForm, setReschedForm] = useState({ callback_date: '', callback_time: '11:00:00', remarks: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await proApi.getMyTasks();
      if (res.success) {
        setTasks(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCompleteTask = async (callId) => {
    const remarks = window.prompt('Enter completion remarks (optional):', 'Callback completed successfully');
    if (remarks === null) return; // User cancelled

    try {
      const res = await proApi.completeTask(callId, { remarks });
      if (res.success) {
        showToast('Task marked as completed', 'success');
        fetchTasks();
      }
    } catch (err) {
      showToast(err.message || 'Failed to complete task', 'error');
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!reschedForm.callback_date) {
      showToast('New callback date is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.rescheduleTask(selectedTask.call_id, reschedForm);
      if (res.success) {
        showToast('Task rescheduled successfully', 'success');
        setSelectedTask(null);
        setReschedForm({ callback_date: '', callback_time: '11:00:00', remarks: '' });
        fetchTasks();
      }
    } catch (err) {
      showToast(err.message || 'Failed to reschedule task', 'error');
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
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] inline-block" />
            <CheckSquare className="w-5 h-5 text-[#1565C0]" />
            <span>My Tasks & Callbacks</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personal pending callbacks and CRM tasks assigned to you
          </p>
        </div>

        <button
          onClick={fetchTasks}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tasks Content */}
      {loading ? (
        <LoadingSpinner label="Loading assigned tasks..." />
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">You're all caught up!</p>
          <p className="text-xs text-slate-400 mt-1">No pending callback tasks assigned to you.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Callback Schedule</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Purpose</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map(t => (
                  <tr key={t.call_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{t.callback_date || 'Today'}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{t.callback_time || 'Morning'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Link to={`/pro/patients/${t.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                        {t.patient_name || `Patient #${t.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 capitalize font-medium text-slate-800">
                      {t.call_purpose?.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {t.mobile_number || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {t.remarks || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleCompleteTask(t.call_id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs cursor-pointer"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTask(t);
                            setReschedForm({ callback_date: t.callback_date || '', callback_time: t.callback_time || '11:00:00', remarks: '' });
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                        >
                          Reschedule
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1565C0]" />
                <span>Reschedule Callback</span>
              </h2>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleReschedule} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">New Date *</label>
                  <input
                    type="date"
                    required
                    value={reschedForm.callback_date}
                    onChange={e => setReschedForm({ ...reschedForm, callback_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">New Time</label>
                  <input
                    type="time"
                    value={reschedForm.callback_time}
                    onChange={e => setReschedForm({ ...reschedForm, callback_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Reschedule Reason</label>
                <input
                  type="text"
                  value={reschedForm.remarks}
                  onChange={e => setReschedForm({ ...reschedForm, remarks: e.target.value })}
                  placeholder="e.g. Patient requested morning call..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 btn-brand-gradient text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Reschedule Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
