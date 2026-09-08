import React, { useEffect, useState } from 'react';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { CalendarOff, Plus, RefreshCw, Clock } from 'lucide-react';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

export const DoctorLeavesPage = () => {
  const { showToast } = useToast();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    from_date: '', to_date: '', reason: '', remarks: ''
  });

  const fetchLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await doctorApi.getMyLeaves();
      if (res.success) {
        setLeaves(res.data || []);
      } else {
        setError(res.message || 'Failed to load leave requests');
        showToast(res.message || 'Failed to load leave requests', 'error');
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to load leave requests';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); }, []);

  const handleCancel = () => {
    setForm({ from_date: '', to_date: '', reason: '', remarks: '' });
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.from_date || !form.to_date || !form.reason || !form.reason.trim()) {
      showToast('From date, to date, and reason are required', 'error');
      return;
    }
    if (form.to_date < form.from_date) {
      showToast('To date cannot be earlier than From date', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await doctorApi.applyLeave(form);
      if (res.success) {
        showToast('Leave request submitted successfully. Awaiting Super Admin approval.', 'success');
        handleCancel();
        fetchLeaves();
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to submit leave request';
      showToast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const calcDays = (from, to) => {
    if (!from || !to) return 0;
    const [y1, m1, d1] = String(from).split('-').map(Number);
    const [y2, m2, d2] = String(to).split('-').map(Number);
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
    const t1 = Date.UTC(y1, m1 - 1, d1);
    const t2 = Date.UTC(y2, m2 - 1, d2);
    if (t2 < t1) return 0;
    return Math.round((t2 - t1) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <CalendarOff className="w-6 h-6 text-red-600" /> Leave Requests
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Apply for leave and track approval status</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLeaves}
            disabled={loading}
            title="Refresh leave requests"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              if (showForm) handleCancel();
              else setShowForm(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Apply for Leave
          </button>
        </div>
      </div>

      {/* Apply Leave Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Apply for Leave</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">From Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={form.from_date}
                  onChange={e => setForm(f => ({...f, from_date: e.target.value}))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">To Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={form.to_date}
                  onChange={e => setForm(f => ({...f, to_date: e.target.value}))}
                  min={form.from_date || undefined}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none"
                />
              </div>
            </div>
            {form.from_date && form.to_date && form.to_date >= form.from_date && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <Clock className="w-3.5 h-3.5" />
                <span>{calcDays(form.from_date, form.to_date)} day(s) of leave requested</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Reason <span className="text-red-500">*</span></label>
              <select
                required
                value={form.reason}
                onChange={e => setForm(f => ({...f, reason: e.target.value}))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none bg-white"
              >
                <option value="">Select reason</option>
                <option value="Attending Medical Conference">Attending Medical Conference</option>
                <option value="Medical Leave">Medical Leave</option>
                <option value="Family Emergency">Family Emergency</option>
                <option value="Planned Vacation">Planned Vacation</option>
                <option value="Training/Conference">Training/Conference</option>
                <option value="Personal Reasons">Personal Reasons</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Additional Remarks</label>
              <textarea
                value={form.remarks}
                onChange={e => setForm(f => ({...f, remarks: e.target.value}))}
                rows={2}
                maxLength={500}
                placeholder="Any additional information for the admin (e.g. covering doctor, handover notes)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {submitting ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm font-bold text-red-700">{error}</p>
          <button
            onClick={fetchLeaves}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      )}

      {/* Leave History */}
      {loading ? (
        <LoadingSpinner label="Loading leave requests..." />
      ) : leaves.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-12 text-center">
          <CalendarOff className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">No leave requests found</p>
          <p className="text-xs text-slate-400 mt-1">Apply for leave using the button above</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Leave History ({leaves.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {leaves.map(l => (
              <div key={l.id} className="px-4 py-4 flex items-center justify-between flex-wrap gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-900">{l.reason}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[l.status] || 'bg-slate-100 text-slate-600'}`}>
                      {l.status?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center gap-2">
                    <span>📅 {l.from_date} → {l.to_date}</span>
                    <span className="text-slate-400">({calcDays(l.from_date, l.to_date)} days)</span>
                  </div>
                  {l.remarks && (
                    <div className="text-xs text-slate-600 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 inline-block">
                      {l.remarks}
                    </div>
                  )}
                  {l.approved_by_name && (
                    <div className="text-[10px] text-slate-400">
                      Reviewed by {l.approved_by_name}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 self-start sm:self-center">
                  Applied: {new Date(l.created_at || Date.now()).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
