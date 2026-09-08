import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Pill,
  Search,
  History,
  AlertTriangle,
  Edit3,
  Loader2,
  XCircle,
  RefreshCw,
  Clock,
  CheckCircle,
  User,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  Stethoscope,
  Lock
} from 'lucide-react';
import { proApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

const statusBadge = (status) => {
  const map = {
    applied: 'bg-emerald-100 text-emerald-800',
    pending_doctor_confirmation: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${statusBadge(status)}`}>
    {status?.replace(/_/g, ' ')}
  </span>
);

const ModificationHistory = ({ itemId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) return;
    proApi.getPrescriptionItemModifications(itemId)
      .then(res => {
        if (res.success) setHistory(res.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [itemId]);

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="w-4 h-4 text-[#1565C0] animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-2 text-center">No modification history recorded for this item.</p>
    );
  }

  return (
    <div className="space-y-2 py-2">
      {history.map((h, i) => (
        <div key={h.id || i} className="bg-slate-50 rounded-xl p-3 text-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-slate-800 capitalize">
              Field: {h.field_changed?.replace(/_/g, ' ')}
            </span>
            <StatusBadge status={h.status} />
          </div>
          <div className="text-slate-600 text-[11px]">
            <span className="line-through text-slate-400 mr-2">{h.original_value}</span>
            <span className="text-[#1565C0] font-bold">→ {h.modified_value}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between flex-wrap gap-2">
            <span>By: <strong>{h.modified_by_name || `User #${h.modified_by}`}</strong> ({h.modifier_role})</span>
            {h.reason && <span>Reason: <em>"{h.reason}"</em></span>}
          </div>
        </div>
      ))}
    </div>
  );
};

const PrescriptionItemRow = ({ item, onModified, isLocked, initialEdit = false }) => {
  const { showToast } = useToast();
  const [showEdit, setShowEdit] = useState(initialEdit);
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    field_changed: 'duration',
    modified_value: String(item.duration_days || item.days || 5),
    reason: ''
  });

  // Calculate daily multiplier from frequency for live quantity preview
  let dailyFreq = 1;
  if (item.frequency) {
    const match = item.frequency.match(/\d+/g);
    if (match) {
      dailyFreq = match.reduce((sum, n) => sum + parseInt(n), 0) || 1;
    }
  }

  const currentValNum = parseInt(form.modified_value) || 0;
  const liveCalculatedQty = form.field_changed === 'duration' ? (currentValNum > 0 ? dailyFreq * currentValNum : 0) : null;

  const handleModify = async (e) => {
    e.preventDefault();
    if (isLocked) {
      showToast('Modifications are locked because the prescription is already dispensed or completed.', 'error');
      return;
    }

    if (!form.modified_value || !form.reason.trim()) {
      showToast('Modified value and reason are required', 'error');
      return;
    }

    const valNum = parseInt(form.modified_value);
    if (isNaN(valNum) || valNum <= 0) {
      showToast('Please enter a valid positive number', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.modifyPrescriptionItem(item.id, {
        field_changed: form.field_changed,
        modified_value: valNum,
        reason: form.reason.trim(),
      });

      if (res.success) {
        showToast('Prescription operational modification applied immediately.', 'success');
        setShowEdit(false);
        setForm({
          field_changed: 'duration',
          modified_value: String(res.data?.duration_days || valNum),
          reason: ''
        });
        onModified?.();
      } else {
        showToast(res.message || 'Failed to modify prescription item', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to modify prescription item', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {item.medicine_name || `Medicine #${item.medicine_id}`}
            </h3>
            {item.generic_name && (
              <span className="text-[10px] text-slate-500 italic">({item.generic_name})</span>
            )}
            {item.strength && (
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                {item.strength}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>Dosage: <strong>{item.dosage || '1 tab'}</strong></span>
            <span>•</span>
            <span>Freq: <strong>{item.frequency || '1 time/day'}</strong></span>
            <span>•</span>
            <span>Route: <strong>{item.route || 'oral'}</strong></span>
            <span>•</span>
            <span className="text-[#1565C0] font-bold">
              Duration: {item.duration_days || item.days || 5} Days (Qty: {item.quantity || 1})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold border border-slate-200 cursor-not-allowed">
              <Lock className="w-3.5 h-3.5" />
              <span>Locked</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!showEdit) {
                  setForm({
                    field_changed: 'duration',
                    modified_value: String(item.duration_days || item.days || 5),
                    reason: ''
                  });
                }
                setShowEdit(!showEdit);
                setShowHistory(false);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                showEdit
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-blue-50 text-[#1565C0] hover:bg-blue-100 border-blue-200/60'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{showEdit ? 'Close' : 'Modify'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { setShowHistory(!showHistory); setShowEdit(false); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
              showHistory
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Edit Form */}
      {showEdit && !isLocked && (
        <form onSubmit={handleModify} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Operational Adjustment (Supply Duration / Quantity)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Item #{item.id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Operational Field to Modify *</label>
              <select
                value={form.field_changed}
                onChange={e => {
                  const field = e.target.value;
                  setForm({
                    ...form,
                    field_changed: field,
                    modified_value: field === 'duration' ? String(item.duration_days || 5) : String(item.quantity || 1)
                  });
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white"
              >
                <option value="duration">Supply Duration (Days)</option>
                <option value="quantity">Supply Quantity (Units)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {form.field_changed === 'duration' ? 'New Supply Duration (Days) *' : 'New Supply Quantity (Units) *'}
              </label>
              <input
                type="number"
                min="1"
                max={form.field_changed === 'duration' ? 365 : 1000}
                required
                value={form.modified_value}
                onChange={e => setForm({ ...form, modified_value: e.target.value })}
                placeholder={form.field_changed === 'duration' ? 'e.g. 7, 10, 15, 30...' : 'e.g. 10, 20...'}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white"
              />
            </div>
          </div>

          {/* Operational Calculation Feedback */}
          {form.field_changed === 'duration' && currentValNum > 0 && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center justify-between">
              <span>
                <strong>Calculated Operational Quantity:</strong> {liveCalculatedQty} units
              </span>
              <span className="text-[10px] text-emerald-700 font-mono">
                ({dailyFreq} unit{dailyFreq > 1 ? 's' : ''}/day × {currentValNum} days)
              </span>
            </div>
          )}

          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-[#1565C0] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#1565C0] shrink-0" />
            <span>
              <strong>Clinical Authority Protected:</strong> Medicine selection, dosage, and frequency are clinical decisions set by the Doctor and cannot be altered. PRO can only adjust package supply duration and quantity.
            </span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Reason for Modification *</label>
            <input
              type="text"
              required
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Extended supply to match 7-day treatment plan"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowEdit(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white btn-brand-gradient hover:opacity-95 shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Applying...' : 'Apply Modification'}
            </button>
          </div>
        </form>
      )}

      {/* History Trail */}
      {showHistory && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-xs font-bold text-slate-700 mb-2">Item Modification Audit History</div>
          <ModificationHistory itemId={item.id} />
        </div>
      )}
    </div>
  );
};

export const PROPrescriptionPage = ({ defaultEdit = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramPrescriptionId } = useParams();
  const { showToast } = useToast();

  const isModifyRoute = location.pathname.endsWith('/modify') || defaultEdit;
  const [prescriptionId, setPrescriptionId] = useState(paramPrescriptionId || '');
  const [searchId, setSearchId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!paramPrescriptionId);
  const [fetchError, setFetchError] = useState(null);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (data?.prescription?.patient_id) {
      navigate(`/pro/patients/${data.prescription.patient_id}`);
    } else {
      navigate('/pro/queue');
    }
  };

  const fetchPrescription = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await proApi.getPrescriptionDetails(id);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData(null);
        setFetchError(res.message || 'Prescription not found');
        showToast(res.message || 'Prescription record not found', 'error');
      }
    } catch (err) {
      setData(null);
      setFetchError(err.message || 'Failed to load prescription details');
      showToast(err.message || 'Failed to load prescription details', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (paramPrescriptionId) {
      setPrescriptionId(paramPrescriptionId);
      fetchPrescription(paramPrescriptionId);
    }
  }, [paramPrescriptionId, fetchPrescription]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    const targetId = searchId.trim();
    setPrescriptionId(targetId);
    navigate(`/pro/prescriptions/${targetId}`);
  };

  const pharmacyStatus = (data?.prescription?.pharmacy_status || 'pending').toLowerCase();
  const isLocked = ['dispensed', 'completed', 'cancelled'].includes(pharmacyStatus);

  return (
    <ErrorBoundary title="Prescription Review Error" message="An error occurred while displaying the prescription review page.">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-200 cursor-pointer shadow-xs"
              title="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-xl font-black text-[#1565C0] flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>
                <Pill className="w-5 h-5 text-[#1565C0]" />
                <span>Prescription Review & Operational Adjustments</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Review doctor prescriptions. Adjust operational supply duration (days) or quantities to match package plans. Clinical decisions are protected.
              </p>
            </div>
          </div>
        </div>

        {/* Prescription ID Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                placeholder="Enter Prescription ID (e.g. 516)..."
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 btn-brand-gradient font-bold text-xs rounded-xl shadow-xs transition cursor-pointer text-white"
            >
              Load Prescription
            </button>
          </form>

          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition border border-slate-200 cursor-pointer shadow-xs"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>

        {/* Prescription View */}
        {loading ? (
          <LoadingSpinner label="Loading prescription details..." />
        ) : !data ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              {prescriptionId ? `Prescription #${prescriptionId} Not Found` : 'No Prescription Loaded'}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {fetchError || 'Please enter a valid prescription ID above or open via Patient 360° Overview.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Go Back
              </button>
              {prescriptionId && (
                <button
                  type="button"
                  onClick={() => fetchPrescription(prescriptionId)}
                  className="px-4 py-2 btn-brand-gradient text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header Metadata Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Prescription ID</span>
                  <span className="font-mono font-bold text-slate-900">#{data.prescription?.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Patient</span>
                  <Link
                    to={`/pro/patients/${data.prescription?.patient_id}`}
                    className="font-bold text-[#1565C0] hover:underline block truncate"
                  >
                    {data.prescription?.patient_name || `Patient #${data.prescription?.patient_id}`}
                  </Link>
                  {data.prescription?.patient_mobile && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {data.prescription.patient_mobile}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Doctor</span>
                  <span className="font-bold text-slate-800 block truncate">
                    {data.prescription?.doctor_name ? `Dr. ${data.prescription.doctor_name}` : 'Consultant Doctor'}
                  </span>
                  {data.prescription?.doctor_specialization && (
                    <span className="text-[10px] text-slate-400 block">
                      {data.prescription.doctor_specialization}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Pharmacy Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize mt-0.5 ${
                    pharmacyStatus === 'completed' || pharmacyStatus === 'dispensed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : pharmacyStatus === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {data.prescription?.pharmacy_status || 'Pending'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {data.prescription?.created_at ? new Date(data.prescription.created_at).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Prescription Items ({data.items?.length || 0})
                </h2>
                {isLocked && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                    <Lock className="w-3 h-3" />
                    <span>Modifications locked ({pharmacyStatus})</span>
                  </span>
                )}
              </div>

              {(!data.items || data.items.length === 0) ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-500 text-xs">
                  No medicine items attached to this prescription.
                </div>
              ) : (
                data.items.map((item, idx) => (
                  <PrescriptionItemRow
                    key={item.id}
                    item={item}
                    isLocked={isLocked}
                    initialEdit={isModifyRoute && idx === 0}
                    onModified={() => fetchPrescription(prescriptionId)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
