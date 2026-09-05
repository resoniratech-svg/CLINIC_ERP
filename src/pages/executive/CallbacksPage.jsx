import React, { useState, useEffect } from 'react';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarClock,
  PhoneCall,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  RefreshCw,
  Send,
  HeartHandshake
} from 'lucide-react';

export const CallbacksPage = () => {
  const [loading, setLoading] = useState(true);
  const [callbacks, setCallbacks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Outcome Modal State
  const [selectedTask, setSelectedTask] = useState(null);
  const [outcomeStatus, setOutcomeStatus] = useState('interested');
  const [nextCallbackDate, setNextCallbackDate] = useState('');
  const [nextCallbackTime, setNextCallbackTime] = useState('');
  const [outcomeRemarks, setOutcomeRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();
  const { user } = useAuth();

  const fetchCallbacks = async () => {
    setLoading(true);
    try {
      const res = await executiveApi.getCallbacks();
      if (res.success && res.data) {
        setCallbacks(res.data);
      } else {
        showToast('Failed to load callbacks', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error fetching callbacks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallbacks();
  }, []);

  const openFollowupModal = (task) => {
    setSelectedTask(task);
    setOutcomeStatus('interested');
    setNextCallbackDate('');
    setNextCallbackTime('');
    setOutcomeRemarks('');
  };

  const handleOutcomeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;

    if (outcomeStatus === 'callback_requested' && (!nextCallbackDate || !nextCallbackTime)) {
      showToast('New Callback Date and Time are required', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const targetName = selectedTask.patient_name || selectedTask.lead_name || 'Patient';
      const targetMob = selectedTask.patient_mobile || selectedTask.lead_mobile || '9000000000';

      const payload = {
        patient_id: selectedTask.patient_id,
        lead_id: selectedTask.lead_id,
        patient_name: targetName,
        mobile_number: targetMob,
        interaction_type: selectedTask.interaction_type || 'outbound',
        call_purpose: 'followup',
        call_status: outcomeStatus,
        callback_date: nextCallbackDate || null,
        callback_time: nextCallbackTime || null,
        remarks: outcomeRemarks.trim() || null
      };

      const res = await executiveApi.recordCallOutcome(payload);
      if (res.success && res.data) {
        if (outcomeStatus === 'interested') {
          showToast('Follow-up marked as INTERESTED! Lead routed to Receptionist Queue.', 'success');
        } else {
          showToast('Follow-up call updated successfully.', 'success');
        }
        setSelectedTask(null);
        fetchCallbacks();
      } else {
        showToast('Failed to update callback status', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error processing follow-up', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredCallbacks = callbacks.filter((cb) => {
    const name = (cb.patient_name || cb.lead_name || '').toLowerCase();
    const mob = (cb.patient_mobile || cb.lead_mobile || '').toLowerCase();
    const rem = (cb.remarks || '').toLowerCase();
    const q = searchTerm.toLowerCase();

    return name.includes(q) || mob.includes(q) || rem.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Scheduled Patient Callbacks
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
              {callbacks.length} Pending Follow-ups
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Patients who requested a call at a specific time • Call them back, record outcome, and convert to Leads.
          </p>
        </div>

        <button
          onClick={fetchCallbacks}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search callbacks by patient name, mobile, or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* 3. Callbacks Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Fetching scheduled callbacks..." />
          </div>
        ) : filteredCallbacks.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <CalendarClock className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No pending callbacks found</p>
            <p className="text-[11px] text-slate-400">When you log a call with "Call Back Requested", it will be queued here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4"># Call ID</th>
                  <th className="py-3 px-4">Contact / Patient Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Scheduled Callback Time</th>
                  <th className="py-3 px-4">Previous Call Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCallbacks.map((cb) => {
                  const cbDateStr = cb.callback_date ? new Date(cb.callback_date).toISOString().split('T')[0] : '';
                  const isToday = cbDateStr === todayStr;

                  return (
                    <tr key={cb.call_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-400">
                        #{cb.call_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {cb.patient_name || cb.lead_name || 'Patient'}
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize">
                          {cb.interaction_type || 'Outbound'} Follow-up
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {cb.patient_mobile || cb.lead_mobile || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isToday
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {cb.callback_date ? new Date(cb.callback_date).toLocaleDateString() : 'Today'}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {cb.callback_time || '10:00 AM'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {cb.remarks || 'No notes provided'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <a
                          href={`tel:${cb.patient_mobile || cb.lead_mobile}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          <PhoneCall className="w-3 h-3 text-emerald-600" />
                          <span>Call</span>
                        </a>

                        <button
                          onClick={() => openFollowupModal(cb)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          <span>Update Outcome</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Follow-up Outcome Modal */}
      <Modal
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title="Update Callback Engagement"
        maxWidth="max-w-lg"
      >
        {selectedTask && (
          <form onSubmit={handleOutcomeSubmit} className="space-y-4 text-xs text-slate-800">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Patient Contact
                </span>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedTask.patient_name || selectedTask.lead_name}
                </div>
                <div className="text-slate-500 font-mono text-[11px]">
                  {selectedTask.patient_mobile || selectedTask.lead_mobile}
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                Callback Task #{selectedTask.call_id}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Outcome of Callback Call <span className="text-red-500">*</span>
              </label>
              <select
                value={outcomeStatus}
                onChange={(e) => setOutcomeStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="interested">Interested (Create Lead for Receptionist Queue)</option>
                <option value="connected">Connected & Resolved (Completed)</option>
                <option value="callback_requested">Reschedule Callback (Pick new time)</option>
                <option value="not_interested">Not Interested (Archived)</option>
                <option value="busy">Busy / Unreachable</option>
                <option value="not_connected">Not Connected / Unreachable</option>
              </select>
            </div>

            {outcomeStatus === 'interested' && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 flex items-start gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Incentive Credited:</strong> The lead will be routed to the <strong>Receptionist Queue</strong> for Doctor Assignment & Consultation.
                </p>
              </div>
            )}

            {outcomeStatus === 'callback_requested' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                    New Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={nextCallbackDate}
                    onChange={(e) => setNextCallbackDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                    New Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={nextCallbackTime}
                    onChange={(e) => setNextCallbackTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Conversation Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Followed up on back pain inquiry. Patient requested appointment on Friday."
                value={outcomeRemarks}
                onChange={(e) => setOutcomeRemarks(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Save Outcome</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
