import React, { useEffect, useState, useCallback } from 'react';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  HeartPulse,
  RefreshCw,
  Search,
  Plus,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Edit3,
  Check,
  X
} from 'lucide-react';

const statusColors = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const s = String(dateStr).split('T')[0];
    const [y, m, d] = s.split('-');
    if (y && m && d) {
      return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
    }
    return new Date(dateStr).toLocaleDateString('en-IN');
  } catch {
    return String(dateStr);
  }
};

export const TreatmentPlansPage = () => {
  const { showToast } = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals state
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    instructions: '',
    treatment_notes: '',
    frequency: '',
    duration: '',
    duration_unit: 'days'
  });
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // New treatment plan modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draftConsultations, setDraftConsultations] = useState([]);
  const [loadingConsults, setLoadingConsults] = useState(false);
  const [createForm, setCreateForm] = useState({
    consultation_id: '',
    treatment_name: '',
    treatment_type: 'Procedure',
    start_date: new Date().toISOString().split('T')[0],
    duration: '15',
    duration_unit: 'days',
    frequency: 'Daily',
    instructions: '',
    treatment_notes: ''
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const fetchPlans = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search && search.trim()) params.search = search.trim();

      const res = await doctorApi.getMyTreatmentPlans(params);
      if (res && res.success) {
        setPlans(res.data || []);
      } else {
        setError(res?.message || 'Failed to load treatment plans');
      }
    } catch (err) {
      console.error('fetchPlans error:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to load treatment plans';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, search, showToast]);

  // Initial load and filter effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlans();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPlans]);

  // Open plan details modal
  const handleOpenDetails = async (plan) => {
    setSelectedPlan(plan);
    setIsDetailsOpen(true);
    setIsEditing(false);
    setDetailsLoading(true);

    try {
      const res = await doctorApi.getTreatmentPlanDetails(plan.treatment_id);
      if (res && res.success && res.data) {
        setSelectedPlan(res.data);
        setEditForm({
          instructions: res.data.instructions || '',
          treatment_notes: res.data.treatment_notes || '',
          frequency: res.data.frequency || '',
          duration: String(res.data.duration || ''),
          duration_unit: res.data.duration_unit || 'days'
        });
      }
    } catch (err) {
      console.error('getTreatmentPlanDetails error:', err);
      // Fallback to existing card data if details endpoint fails
    } finally {
      setDetailsLoading(false);
    }
  };

  // Status update handler (Complete / Cancel)
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedPlan) return;
    setActionSubmitting(true);
    try {
      const res = await doctorApi.updateTreatmentPlan(selectedPlan.treatment_id, { status: newStatus });
      if (res && res.success) {
        showToast(`Treatment plan marked as ${newStatus}!`, 'success');
        setSelectedPlan(prev => ({ ...prev, ...res.data }));
        setPlans(prev => prev.map(p => p.treatment_id === selectedPlan.treatment_id ? { ...p, ...res.data } : p));
        setIsDetailsOpen(false);
      } else {
        showToast(res?.message || `Failed to update status to ${newStatus}`, 'error');
      }
    } catch (err) {
      console.error('handleUpdateStatus error:', err);
      showToast(err?.response?.data?.message || err?.message || 'Failed to update status', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Save edits handler
  const handleSaveEdits = async () => {
    if (!selectedPlan) return;
    setActionSubmitting(true);
    try {
      const payload = {
        instructions: editForm.instructions,
        treatment_notes: editForm.treatment_notes,
        frequency: editForm.frequency,
        duration: parseInt(editForm.duration, 10),
        duration_unit: editForm.duration_unit
      };
      const res = await doctorApi.updateTreatmentPlan(selectedPlan.treatment_id, payload);
      if (res && res.success) {
        showToast('Treatment plan updated successfully!', 'success');
        setSelectedPlan(prev => ({ ...prev, ...res.data }));
        setPlans(prev => prev.map(p => p.treatment_id === selectedPlan.treatment_id ? { ...p, ...res.data } : p));
        setIsEditing(false);
      } else {
        showToast(res?.message || 'Failed to update treatment plan', 'error');
      }
    } catch (err) {
      console.error('handleSaveEdits error:', err);
      showToast(err?.response?.data?.message || err?.message || 'Failed to save edits', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Open Create Modal and fetch draft consultations
  const handleOpenCreateModal = async () => {
    setIsCreateOpen(true);
    setLoadingConsults(true);
    try {
      const res = await doctorApi.getConsultationHistory({ status: 'draft' });
      if (res && res.success) {
        const drafts = res.data || [];
        setDraftConsultations(drafts);
        if (drafts.length > 0) {
          setCreateForm(prev => ({ ...prev, consultation_id: String(drafts[0].consultation_id) }));
        }
      }
    } catch (err) {
      console.error('Error fetching consultations:', err);
    } finally {
      setLoadingConsults(false);
    }
  };

  // Submit Create Treatment Plan
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.consultation_id) {
      showToast('Please select a patient / consultation', 'error');
      return;
    }
    if (!createForm.treatment_name.trim()) {
      showToast('Treatment name is required', 'error');
      return;
    }
    if (!createForm.duration || parseInt(createForm.duration, 10) <= 0) {
      showToast('Duration must be a positive number', 'error');
      return;
    }

    setCreateSubmitting(true);
    try {
      const payload = {
        consultation_id: parseInt(createForm.consultation_id, 10),
        treatment_name: createForm.treatment_name.trim(),
        treatment_type: createForm.treatment_type,
        start_date: createForm.start_date,
        duration: parseInt(createForm.duration, 10),
        duration_unit: createForm.duration_unit,
        frequency: createForm.frequency ? createForm.frequency.trim() : null,
        instructions: createForm.instructions ? createForm.instructions.trim() : null,
        treatment_notes: createForm.treatment_notes ? createForm.treatment_notes.trim() : null
      };

      const res = await doctorApi.createTreatmentPlan(payload);
      if (res && res.success) {
        showToast('Treatment plan created successfully!', 'success');
        setIsCreateOpen(false);
        // Refresh plans
        fetchPlans(true);
        // Reset form
        setCreateForm({
          consultation_id: '',
          treatment_name: '',
          treatment_type: 'Procedure',
          start_date: new Date().toISOString().split('T')[0],
          duration: '15',
          duration_unit: 'days',
          frequency: 'Daily',
          instructions: '',
          treatment_notes: ''
        });
      } else {
        showToast(res?.message || 'Failed to create treatment plan', 'error');
      }
    } catch (err) {
      console.error('handleCreateSubmit error:', err);
      showToast(err?.response?.data?.message || err?.message || 'Failed to create treatment plan', 'error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-emerald-600" /> Treatment Plans
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">All treatment plans issued for your patients</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none bg-white font-medium text-slate-700 shadow-2xs hover:border-slate-300 transition-colors"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => fetchPlans(true)}
            disabled={refreshing || loading}
            title="Refresh treatment plans"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 shadow-2xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Plan</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search treatment or patient..."
          className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none bg-white shadow-2xs transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Content States */}
      {loading ? (
        <LoadingSpinner label="Loading treatment plans..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <div className="text-sm font-bold text-red-900">Failed to load treatment plans</div>
          <p className="text-xs text-red-600 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchPlans(false)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-12 text-center">
          <HeartPulse className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No treatment plans found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search || statusFilter
              ? 'No records match your search or filter criteria. Try adjusting filters.'
              : 'There are currently no treatment plans recorded under your profile.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(t => (
            <div
              key={t.treatment_id}
              onClick={() => handleOpenDetails(t)}
              className="group bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-emerald-200 p-4 space-y-3 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate group-hover:text-emerald-700 transition-colors">
                      {t.treatment_name}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium">
                      <span>{t.treatment_type}</span>
                      {t.treatment_id && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400">#TRT-{t.treatment_id}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusColors[t.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {t.status}
                  </span>
                </div>

                <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-100">
                  <div className="text-xs text-slate-800 font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{t.patient_name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 pl-5">
                    {t.registration_id}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Start Date:</span>
                    <strong className="text-slate-700">{formatDate(t.start_date)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">End Date:</span>
                    <strong className="text-slate-700">{formatDate(t.end_date)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Duration:</span>
                    <strong className="text-slate-700">{t.duration} {t.duration_unit}</strong>
                  </div>
                  {t.frequency && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Frequency:</span>
                      <strong className="text-slate-700 truncate block">{t.frequency}</strong>
                    </div>
                  )}
                </div>

                {t.instructions && (
                  <div className="text-[10px] text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100 line-clamp-2">
                    <span className="font-semibold text-slate-500 block text-[9px] uppercase tracking-wider mb-0.5">Instructions</span>
                    {t.instructions}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-600 font-bold">
                <span>View Full Details & Actions</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View / Edit Plan Details Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title="Treatment Plan Details"
        maxWidth="max-w-2xl"
      >
        {detailsLoading ? (
          <LoadingSpinner label="Loading details..." />
        ) : selectedPlan ? (
          <div className="space-y-5">
            {/* Header / Status Banner */}
            <div className="flex items-start justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <h2 className="text-base font-black text-slate-900">{selectedPlan.treatment_name}</h2>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>Type: <strong className="text-slate-700">{selectedPlan.treatment_type}</strong></span>
                  <span>•</span>
                  <span>ID: <strong className="text-slate-700">#TRT-{selectedPlan.treatment_id}</strong></span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${statusColors[selectedPlan.status] || 'bg-slate-100 text-slate-600'}`}>
                {selectedPlan.status}
              </span>
            </div>

            {/* Patient & Doctor Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient Details</div>
                <div className="font-bold text-slate-800 text-sm">{selectedPlan.patient_name}</div>
                <div className="text-slate-500">Reg ID: <span className="font-mono text-slate-700">{selectedPlan.registration_id}</span></div>
                {selectedPlan.patient_phone && (
                  <div className="text-slate-500">Phone: <span className="text-slate-700">{selectedPlan.patient_phone}</span></div>
                )}
                {(selectedPlan.patient_age || selectedPlan.patient_gender) && (
                  <div className="text-slate-500">
                    {selectedPlan.patient_age ? `${selectedPlan.patient_age} yrs` : ''} {selectedPlan.patient_gender ? `(${selectedPlan.patient_gender})` : ''}
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doctor Details</div>
                <div className="font-bold text-slate-800 text-sm">{selectedPlan.doctor_name || 'Assigned Doctor'}</div>
                {selectedPlan.doctor_code && (
                  <div className="text-slate-500">Doctor Code: <span className="font-mono text-slate-700">{selectedPlan.doctor_code}</span></div>
                )}
                <div className="text-slate-500">Consultation ID: <span className="font-mono text-slate-700">#{selectedPlan.consultation_id}</span></div>
              </div>
            </div>

            {/* Schedule & Duration */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Start Date</span>
                <strong className="text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(selectedPlan.start_date)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">End Date</span>
                <strong className="text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(selectedPlan.end_date)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Duration</span>
                <strong className="text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {selectedPlan.duration} {selectedPlan.duration_unit}
                </strong>
              </div>
            </div>

            {/* Instructions & Notes (Edit / View Mode) */}
            {isEditing ? (
              <div className="space-y-3 bg-amber-50/50 p-4 rounded-xl border border-amber-200 text-xs">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Edit Treatment Plan
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Duration</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.duration}
                      onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Unit</label>
                    <select
                      value={editForm.duration_unit}
                      onChange={e => setEditForm({ ...editForm, duration_unit: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none"
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Frequency</label>
                  <input
                    value={editForm.frequency}
                    onChange={e => setEditForm({ ...editForm, frequency: e.target.value })}
                    placeholder="e.g. Daily, Alternate days"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Instructions</label>
                  <textarea
                    rows={2}
                    value={editForm.instructions}
                    onChange={e => setEditForm({ ...editForm, instructions: e.target.value })}
                    placeholder="Specific patient instructions..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Clinical Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.treatment_notes}
                    onChange={e => setEditForm({ ...editForm, treatment_notes: e.target.value })}
                    placeholder="Doctor clinical observation notes..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={actionSubmitting}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdits}
                    disabled={actionSubmitting}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {selectedPlan.frequency && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Frequency</span>
                    <span className="text-slate-800 font-medium">{selectedPlan.frequency}</span>
                  </div>
                )}

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Instructions</span>
                  <p className="text-slate-700 whitespace-pre-line">{selectedPlan.instructions || 'No specific instructions provided.'}</p>
                </div>

                {selectedPlan.treatment_notes && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Clinical Notes</span>
                    <p className="text-slate-700 whitespace-pre-line">{selectedPlan.treatment_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {selectedPlan.status === 'active' && !isEditing && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus('completed')}
                      disabled={actionSubmitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Completed</span>
                    </button>

                    <button
                      onClick={() => handleUpdateStatus('cancelled')}
                      disabled={actionSubmitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel Plan</span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedPlan.status === 'active' && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Plan</span>
                  </button>
                )}
                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Create New Treatment Plan Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Treatment Plan"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {loadingConsults ? (
            <LoadingSpinner label="Loading active consultations..." />
          ) : draftConsultations.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2">
              <FileText className="w-8 h-8 text-amber-500 mx-auto" />
              <div className="font-bold text-amber-900">No Active Draft Consultations</div>
              <p className="text-[11px] text-amber-700">
                Treatment plans must be linked to an active patient consultation. Start or open a patient consultation first.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Select Patient & Consultation <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.consultation_id}
                  onChange={e => setCreateForm({ ...createForm, consultation_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                >
                  {draftConsultations.map(c => (
                    <option key={c.consultation_id} value={c.consultation_id}>
                      {c.patient_name} ({c.registration_id}) — Consultation #{c.consultation_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Treatment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.treatment_name}
                  onChange={e => setCreateForm({ ...createForm, treatment_name: e.target.value })}
                  placeholder="e.g. Physiotherapy Sessions, Homeopathy Regimen"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Treatment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.treatment_type}
                    onChange={e => setCreateForm({ ...createForm, treatment_type: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                  >
                    <option value="Procedure">Procedure</option>
                    <option value="Homeopathy">Homeopathy</option>
                    <option value="Physiotherapy">Physiotherapy</option>
                    <option value="Diet">Diet</option>
                    <option value="Lifestyle">Lifestyle</option>
                    <option value="Medication">Medication</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.start_date}
                    onChange={e => setCreateForm({ ...createForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Duration <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={createForm.duration}
                    onChange={e => setCreateForm({ ...createForm, duration: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Duration Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.duration_unit}
                    onChange={e => setCreateForm({ ...createForm, duration_unit: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Frequency</label>
                <input
                  type="text"
                  value={createForm.frequency}
                  onChange={e => setCreateForm({ ...createForm, frequency: e.target.value })}
                  placeholder="e.g. Daily morning session, Once a week"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Instructions</label>
                <textarea
                  rows={2}
                  value={createForm.instructions}
                  onChange={e => setCreateForm({ ...createForm, instructions: e.target.value })}
                  placeholder="Instructions for the patient..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Treatment Notes</label>
                <textarea
                  rows={2}
                  value={createForm.treatment_notes}
                  onChange={e => setCreateForm({ ...createForm, treatment_notes: e.target.value })}
                  placeholder="Clinical notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
                >
                  {createSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Create Plan</span>
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
};
export default TreatmentPlansPage;
