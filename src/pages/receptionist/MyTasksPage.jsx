import React, { useState, useEffect, useMemo } from 'react';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { formatDisplayDate, toLocalDateString, getTodayDateString } from '../../utils/dateUtils';
import {
  CheckSquare,
  Clock,
  Calendar,
  PhoneCall,
  CheckCircle2,
  RotateCcw,
  User,
  Filter,
  AlertCircle,
  Search,
  RefreshCw,
  Sparkles,
  ArrowRight,
  PhoneForwarded,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PURPOSE_LABELS = {
  followup: 'Follow-up',
  renewal: 'Registration Renewal',
  due_payment: 'Due Payment',
  acq: 'ACQ Care Plan',
  ocnr: 'OC/NR Attrition',
  appointment: 'Appointment Confirmation',
  general_enquiry: 'General Enquiry',
  callback: 'Scheduled Callback',
  patient_feedback: 'Patient Feedback',
  other: 'Other',
};

export const MyTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, today, overdue, upcoming
  const [searchTerm, setSearchTerm] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [newCallbackDate, setNewCallbackDate] = useState('');
  const [newCallbackTime, setNewCallbackTime] = useState('11:00:00');
  const [saving, setSaving] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getMyTasks();
      if (res.success) {
        setTasks(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch daily tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCompleteTask = async (callId) => {
    try {
      const res = await receptionistApi.completeTask(callId);
      if (res.success) {
        showToast('Callback task marked as completed!', 'success');
        fetchTasks();
      }
    } catch (err) {
      showToast(err.message || 'Failed to complete task', 'error');
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleTarget || !newCallbackDate) return;

    setSaving(true);
    try {
      const res = await receptionistApi.rescheduleTask(rescheduleTarget.call_id, {
        callback_date: newCallbackDate,
        callback_time: newCallbackTime,
      });

      if (res.success) {
        showToast('Callback task rescheduled successfully!', 'success');
        setRescheduleTarget(null);
        fetchTasks();
      }
    } catch (err) {
      showToast(err.message || 'Failed to reschedule task', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Classify task urgency relative to today
  const getTaskUrgency = (dateStr) => {
    if (!dateStr) return { type: 'normal', label: 'Pending', color: 'bg-slate-100 text-slate-700' };
    const today = getTodayDateString();
    const taskDate = toLocalDateString(dateStr);

    if (taskDate === today) {
      return { type: 'today', label: 'Due Today', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    } else if (taskDate < today) {
      return { type: 'overdue', label: 'Overdue', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    } else {
      return { type: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
  };

  // Filter counts
  const filterCounts = useMemo(() => {
    let todayCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    const today = getTodayDateString();

    tasks.forEach((t) => {
      const taskDate = t.callback_date ? toLocalDateString(t.callback_date) : '';
      if (!taskDate || taskDate === today) todayCount++;
      else if (taskDate < today) overdueCount++;
      else upcomingCount++;
    });

    return {
      all: tasks.length,
      today: todayCount,
      overdue: overdueCount,
      upcoming: upcomingCount,
    };
  }, [tasks]);

  // Filtered tasks list
  const filteredTasks = useMemo(() => {
    const today = getTodayDateString();
    return tasks.filter((t) => {
      const taskDate = t.callback_date ? toLocalDateString(t.callback_date) : '';

      // 1. Filter by category
      if (activeFilter === 'today' && taskDate !== today) return false;
      if (activeFilter === 'overdue' && taskDate >= today) return false;
      if (activeFilter === 'upcoming' && taskDate <= today) return false;

      // 2. Filter by search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const contact = (t.contact_name || t.patient_name || t.lead_name || '').toLowerCase();
      const mobile = (t.mobile_number || '').toLowerCase();
      const remarks = (t.remarks || '').toLowerCase();
      const id = String(t.call_id);
      const purpose = (t.call_purpose || '').toLowerCase();

      return (
        contact.includes(term) ||
        mobile.includes(term) ||
        remarks.includes(term) ||
        id.includes(term) ||
        purpose.includes(term)
      );
    });
  }, [tasks, activeFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span>My Daily Front-Desk Tasks & Callbacks</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated queue of requested callbacks, follow-ups, renewal reminders, and patient outreach assigned to you.
          </p>
        </div>

        <button
          onClick={fetchTasks}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Tasks</span>
        </button>
      </div>

      {/* Filter Chips & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Tasks', count: filterCounts.all },
            { id: 'today', label: 'Due Today', count: filterCounts.today },
            { id: 'overdue', label: 'Overdue', count: filterCounts.overdue },
            { id: 'upcoming', label: 'Upcoming', count: filterCounts.upcoming },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === f.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeFilter === f.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter tasks by name, mobile, ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading daily tasks..." />
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-3">
            <CheckCircle2 className="w-9 h-9 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-slate-700">
                {searchTerm
                  ? 'No tasks matching your search filter.'
                  : activeFilter === 'today'
                  ? 'No callback tasks due today. Great job!'
                  : activeFilter === 'overdue'
                  ? 'No overdue callback tasks. All clear!'
                  : activeFilter === 'upcoming'
                  ? 'No upcoming scheduled callbacks found.'
                  : 'No pending tasks in your queue for today. Great job!'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Tasks are automatically assigned when CRM calls are recorded with status &quot;Call Back Requested&quot;.
              </p>
            </div>

            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Search</span>
              </button>
            )}

            {!searchTerm && tasks.length === 0 && (
              <button
                onClick={() => navigate('/receptionist/crm')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>+ Log New CRM Call</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Task Type & ID</th>
                  <th className="py-3.5 px-4">Patient / Contact</th>
                  <th className="py-3.5 px-4">Scheduled Callback</th>
                  <th className="py-3.5 px-4">Schedule Urgency</th>
                  <th className="py-3.5 px-4">Task Notes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTasks.map((t) => {
                  const urgency = getTaskUrgency(t.callback_date);
                  const purposeLabel = PURPOSE_LABELS[t.call_purpose] || t.call_purpose?.replace('_', ' ') || 'Callback';

                  return (
                    <tr key={t.call_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-blue-700 block">Callback Task</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-mono font-bold">#{t.call_id}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold capitalize">
                            {purposeLabel}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {t.contact_name || t.patient_name || t.lead_name || 'Registered Contact'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {t.mobile_number || (t.patient_id ? `Patient #${t.patient_id}` : '—')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <span className="font-bold text-slate-800 block">
                          {formatDisplayDate(t.callback_date)}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {t.callback_time ? `${t.callback_time.slice(0, 5)} hrs` : 'Anytime'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border inline-block ${urgency.color}`}
                        >
                          {urgency.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {t.remarks || <span className="text-slate-400 italic">No notes provided</span>}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {t.task_status !== 'completed' && (
                          <>
                            <button
                              onClick={() =>
                                navigate('/receptionist/crm', {
                                  state: {
                                    patient: {
                                      patient_id: t.patient_id,
                                      patient_name: t.contact_name || t.patient_name || t.lead_name,
                                      mobile_number: t.mobile_number,
                                    },
                                    callPurpose: t.call_purpose || 'callback',
                                  },
                                })
                              }
                              title="Open in CRM & Log Call"
                              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>Call</span>
                            </button>

                            <button
                              onClick={() => {
                                setRescheduleTarget(t);
                                setNewCallbackDate(t.callback_date ? toLocalDateString(t.callback_date) : getTodayDateString());
                                setNewCallbackTime(t.callback_time ? t.callback_time.slice(0, 5) : '11:00');
                              }}
                              title="Reschedule Callback Date/Time"
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                            >
                              Reschedule
                            </button>

                            <button
                              onClick={() => handleCompleteTask(t.call_id)}
                              title="Mark Task as Completed"
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Done</span>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reschedule Task Modal */}
      {rescheduleTarget && (
        <Modal
          isOpen={true}
          onClose={() => setRescheduleTarget(null)}
          title={`Reschedule Callback Task #${rescheduleTarget.call_id}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-900 block">
                {rescheduleTarget.contact_name || rescheduleTarget.patient_name || rescheduleTarget.lead_name}
              </span>
              <span className="text-[11px] text-slate-500 font-mono block">
                {rescheduleTarget.mobile_number} • Current: {formatDisplayDate(rescheduleTarget.callback_date)} at {rescheduleTarget.callback_time?.slice(0, 5) || '11:00'} hrs
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Callback Date *</label>
              <input
                type="date"
                required
                value={newCallbackDate}
                onChange={(e) => setNewCallbackDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Callback Time</label>
              <input
                type="time"
                value={newCallbackTime}
                onChange={(e) => setNewCallbackTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
              >
                {saving ? 'Saving...' : 'Confirm Reschedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
