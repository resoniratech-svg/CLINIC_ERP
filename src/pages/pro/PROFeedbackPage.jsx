import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  MessageSquare,
  User,
  Heart
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const FEEDBACK_CATEGORIES = [
  { value: 'doctor_experience', label: 'Doctor Experience' },
  { value: 'treatment_experience', label: 'Treatment Experience' },
  { value: 'pro_experience', label: 'PRO & Counselling Experience' },
  { value: 'pharmacy_experience', label: 'Pharmacy Experience' },
  { value: 'staff_experience', label: 'Staff & Reception Experience' },
  { value: 'suggestion', label: 'Patient Suggestion' },
  { value: 'general', label: 'General Hospital Experience' },
];

export const PROFeedbackPage = () => {
  const { showToast } = useToast();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    patient_id: '',
    category_type: 'treatment_experience',
    description: '',
    rating: 5,
    remarks: ''
  });

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const res = await proApi.getFeedback();
      if (res.success) {
        setFeedbacks(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load feedbacks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient_id || !form.description.trim()) {
      showToast('Patient ID and feedback description are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.createFeedback({
        ...form,
        patient_id: parseInt(form.patient_id),
        rating: parseInt(form.rating || 5)
      });
      if (res.success) {
        showToast('Patient feedback recorded successfully', 'success');
        setShowModal(false);
        setForm({ patient_id: '', category_type: 'treatment_experience', description: '', rating: 5, remarks: '' });
        fetchFeedbacks();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record feedback', 'error');
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
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>Patient Feedback & Reviews</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Capture patient satisfaction ratings, service feedback, and care suggestions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchFeedbacks}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 btn-brand-gradient text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Feedback</span>
          </button>
        </div>
      </div>

      {/* Feedbacks Grid / Table */}
      {loading ? (
        <LoadingSpinner label="Loading patient feedback..." />
      ) : feedbacks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No patient feedback logged</p>
          <p className="text-xs text-slate-400 mt-1">Click "+ Record Feedback" to log patient responses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feedbacks.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 capitalize">
                    {f.category_type?.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= (f.rating || 5)
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-800 font-medium mt-3 italic">
                  "{f.description}"
                </p>

                {f.remarks && (
                  <p className="text-[11px] text-slate-400 mt-2">
                    Remarks: {f.remarks}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to={`/pro/patients/${f.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                  {f.patient_name || `Patient #${f.patient_id}`}
                </Link>
                <span className="text-slate-400">
                  {f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Record Patient Feedback</span>
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Patient ID *</label>
                <input
                  type="number"
                  required
                  value={form.patient_id}
                  onChange={e => setForm({ ...form, patient_id: e.target.value })}
                  placeholder="Patient ID..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-amber-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category *</label>
                  <select
                    value={form.category_type}
                    onChange={e => setForm({ ...form, category_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-amber-400 outline-none bg-white font-medium"
                  >
                    {FEEDBACK_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Star Rating (1-5)</label>
                  <select
                    value={form.rating}
                    onChange={e => setForm({ ...form, rating: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-amber-400 outline-none bg-white font-medium"
                  >
                    <option value="5">⭐⭐⭐⭐⭐ (5 - Excellent)</option>
                    <option value="4">⭐⭐⭐⭐ (4 - Good)</option>
                    <option value="3">⭐⭐⭐ (3 - Average)</option>
                    <option value="2">⭐⭐ (2 - Below Expectations)</option>
                    <option value="1">⭐ (1 - Poor)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Feedback Description *</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="In the patient's own words..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-amber-400 outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Internal Remarks</label>
                <input
                  type="text"
                  value={form.remarks}
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Staff observations..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-amber-400 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
