import React, { useEffect, useState, useCallback } from 'react';
import { pharmacyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Sliders,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Info,
  X,
  Check,
  XCircle,
  ShieldCheck,
  Package
} from 'lucide-react';

export const StockAdjustmentsPage = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Super Admin action state
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'approve' | 'reject', adjustment: ... }

  const [formData, setFormData] = useState({
    medicine_id: '',
    stock_id: '',
    physical_quantity: '',
    reason: 'stock_count_correction',
    remarks: '',
  });

  const [selectedBatchStock, setSelectedBatchStock] = useState(null);

  const { showToast } = useToast();
  const { isSuperAdmin } = useAuth();

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;

      const res = await pharmacyApi.getStockAdjustments(params);
      if (res.success) {
        setAdjustments(res.data || []);
      } else {
        showToast(res.message || 'Failed to load stock adjustments', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to load stock adjustments', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, dateFilter, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAdjustments();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchAdjustments]);

  const handleOpenModal = async () => {
    setIsModalOpen(true);
    setFormData({
      medicine_id: '',
      stock_id: '',
      physical_quantity: '',
      reason: 'stock_count_correction',
      remarks: '',
    });
    setSelectedBatchStock(null);
    setBatches([]);
    try {
      const mRes = await pharmacyApi.getMedicines();
      if (mRes.success) setMedicines(mRes.data || []);
    } catch (err) {
      console.error('Error fetching medicines:', err);
    }
  };

  const handleMedicineChange = async (medId) => {
    setFormData((prev) => ({ ...prev, medicine_id: medId, stock_id: '', physical_quantity: '' }));
    setSelectedBatchStock(null);
    if (!medId) {
      setBatches([]);
      return;
    }
    try {
      const bRes = await pharmacyApi.getMedicineBatches(medId);
      if (bRes.success) {
        setBatches(bRes.data || []);
        if (bRes.data && bRes.data.length > 0) {
          const firstBatch = bRes.data[0];
          setFormData((prev) => ({ ...prev, stock_id: firstBatch.id }));
          setSelectedBatchStock(firstBatch);
        }
      }
    } catch (err) {
      console.error('Error loading batches:', err);
    }
  };

  const handleBatchChange = (stockId) => {
    setFormData((prev) => ({ ...prev, stock_id: stockId }));
    const b = batches.find((item) => item.id === parseInt(stockId, 10));
    setSelectedBatchStock(b || null);
  };

  const calculatedDifference =
    selectedBatchStock && formData.physical_quantity !== ''
      ? parseInt(formData.physical_quantity, 10) - selectedBatchStock.quantity
      : null;

  const requiresApprovalNotice = calculatedDifference !== null && Math.abs(calculatedDifference) > 10;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.medicine_id || !formData.stock_id || formData.physical_quantity === '') {
      showToast('Please select medicine, batch, and enter physical count', 'warning');
      return;
    }

    const physQty = parseInt(formData.physical_quantity, 10);
    if (isNaN(physQty) || physQty < 0) {
      showToast('Physical count must be a non-negative number', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await pharmacyApi.createStockAdjustment({
        medicine_id: parseInt(formData.medicine_id, 10),
        stock_id: parseInt(formData.stock_id, 10),
        physical_quantity: physQty,
        reason: formData.reason,
        remarks: formData.remarks.trim() || undefined,
      });

      if (res.success) {
        showToast(
          requiresApprovalNotice
            ? 'Adjustment requested (>10 units discrepancy). Awaiting Super Admin review.'
            : 'Stock adjustment applied and active inventory updated immediately!',
          'success'
        );
        setIsModalOpen(false);
        fetchAdjustments();
      } else {
        showToast(res.message || 'Failed to submit adjustment', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error creating stock adjustment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveOrReject = async () => {
    if (!confirmModal) return;
    const { type, adjustment } = confirmModal;
    setActionLoading(true);
    try {
      const res =
        type === 'approve'
          ? await pharmacyApi.approveStockAdjustment(adjustment.id)
          : await pharmacyApi.rejectStockAdjustment(adjustment.id);

      if (res.success) {
        showToast(
          type === 'approve'
            ? `Stock adjustment #${adjustment.id} approved and stock updated!`
            : `Stock adjustment #${adjustment.id} rejected. Inventory unchanged.`,
          'success'
        );
        setConfirmModal(null);
        fetchAdjustments();
      } else {
        showToast(res.message || `Failed to ${type} adjustment`, 'error');
      }
    } catch (err) {
      showToast(err.message || `Error executing ${type} action`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setDateFilter('');
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return 'N/A';
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  const formatReason = (reason) => {
    switch (reason) {
      case 'stock_count_correction':
        return 'stock_count_correction';
      case 'damage':
        return 'damage';
      case 'spillage':
        return 'spillage';
      case 'expired_writeoff':
        return 'expired_writeoff';
      case 'theft_loss':
        return 'theft_loss';
      case 'manufacturer_error':
        return 'manufacturer_error';
      default:
        return reason;
    }
  };

  const hasActiveFilters = Boolean(searchTerm || statusFilter || dateFilter);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock Adjustments & Physical Audit</h1>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile physical stock counts with system ledger. Strict threshold approval enforcement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Adjustment</span>
          </button>
          <button
            onClick={fetchAdjustments}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Threshold Governance Information Notice */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Threshold Governance:</span> Minor count discrepancies (up to{' '}
          <span className="font-bold">±10 units</span>) are auto-applied to active inventory immediately. Large count
          discrepancies (<span className="font-bold">&gt;10 units</span>) require Super Admin review and approval before
          inventory numbers are modified.
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Medicine, Batch number, Reason, or Adj ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden font-medium"
            >
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending Approval</option>
              <option value="rejected">Rejected</option>
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              title="Filter by Adjustment Date"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : adjustments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Sliders}
              title={hasActiveFilters ? "No Matching Adjustments Found" : "No Stock Adjustments"}
              description={
                hasActiveFilters
                  ? "Try adjusting your search query, status, or date filter."
                  : "No physical count adjustments recorded in this branch."
              }
              actionText={hasActiveFilters ? "Clear Filters" : "Record Adjustment"}
              onAction={hasActiveFilters ? handleResetFilters : handleOpenModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-4">Adj ID</th>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Medicine & Strength</th>
                  <th className="p-4">Batch Number</th>
                  <th className="p-4 text-center">System Qty</th>
                  <th className="p-4 text-center">Physical Count</th>
                  <th className="p-4 text-center">Difference</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Logged By</th>
                  {isSuperAdmin && <th className="p-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.map((a) => {
                  const isPositive = a.difference > 0;
                  const isNegative = a.difference < 0;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 font-bold text-slate-400">#{a.id}</td>
                      <td className="p-4 whitespace-nowrap text-slate-700">
                        {formatDate(a.created_at)}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-sm">{a.medicine_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a.serial_number && (
                            <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {a.serial_number}
                            </span>
                          )}
                          <span className="text-slate-500 font-mono text-2xs">{a.potency || '30C'}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-700">{a.batch_number || 'N/A'}</td>
                      <td className="p-4 text-center font-semibold text-slate-600">{a.system_quantity}</td>
                      <td className="p-4 text-center font-bold text-slate-800 text-sm">{a.physical_quantity}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-slate-500'
                          }`}
                        >
                          {isPositive ? `+${a.difference}` : a.difference}
                        </span>
                      </td>
                      <td className="p-4">
                        {a.approval_status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        ) : a.approval_status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 uppercase tracking-wider">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 max-w-xs truncate font-mono text-2xs">
                        {formatReason(a.reason)}
                        {a.remarks && (
                          <div className="text-2xs text-slate-400 italic font-sans truncate" title={a.remarks}>
                            {a.remarks}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        <div>{a.performed_by_name || 'Pharmacist'}</div>
                        {a.approved_by_name && (
                          <div className="text-2xs text-slate-400 font-normal">
                            Approved by: {a.approved_by_name}
                          </div>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="p-4 text-center whitespace-nowrap">
                          {a.approval_status === 'pending' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmModal({ type: 'approve', adjustment: a })}
                                className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                                title="Approve Adjustment"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmModal({ type: 'reject', adjustment: a })}
                                className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition"
                                title="Reject Adjustment"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-2xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Adjustment Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Physical Stock Adjustment">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Medicine *
            </label>
            <select
              value={formData.medicine_id}
              onChange={(e) => handleMedicineChange(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              required
            >
              <option value="">Select Medicine...</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.medicine_name} — {m.strength || 'Standard'} — {m.serial_number || `MED-${String(m.id).padStart(5, '0')}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Stock Batch *
            </label>
            <select
              value={formData.stock_id}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              required
              disabled={!formData.medicine_id || batches.length === 0}
            >
              <option value="">
                {!formData.medicine_id
                  ? 'First choose a medicine above...'
                  : batches.length === 0
                  ? 'No batches available for this medicine'
                  : 'Select Batch...'}
              </option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} (Exp: {formatDate(b.expiry_date)} | Book Stock: {b.quantity} units)
                </option>
              ))}
            </select>
          </div>

          {selectedBatchStock && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Current System Book Stock:</span>
              <span className="text-sm font-bold text-slate-800">{selectedBatchStock.quantity} units</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Verified Physical Count *
            </label>
            <input
              type="number"
              min="0"
              value={formData.physical_quantity}
              onChange={(e) => setFormData({ ...formData, physical_quantity: e.target.value })}
              placeholder="Enter physically counted quantity"
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            />
          </div>

          {calculatedDifference !== null && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                requiresApprovalNotice
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {requiresApprovalNotice ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <div>
                  <p className="font-bold">
                    Count Difference: {calculatedDifference > 0 ? `+${calculatedDifference}` : calculatedDifference} units
                  </p>
                  <p className="text-2xs mt-0.5">
                    {requiresApprovalNotice
                      ? 'Discrepancy exceeds 10 units. This adjustment will be held in Pending status for Super Admin review before active inventory is altered.'
                      : 'Discrepancy is within allowable ±10 unit threshold. Active inventory will be updated immediately upon submission.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reason for Adjustment *
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
            >
              <option value="stock_count_correction">stock_count_correction (Physical Count Correction)</option>
              <option value="damage">damage (Breakage / Leakage)</option>
              <option value="spillage">spillage (Dispensing Spillage / Wastage)</option>
              <option value="expired_writeoff">expired_writeoff (Expired Stock Removal)</option>
              <option value="theft_loss">theft_loss (Missing / Unaccounted Unit)</option>
              <option value="manufacturer_error">manufacturer_error (Packaging Error)</option>
              <option value="other">other (Other Reason)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Remarks (Optional)
            </label>
            <textarea
              rows="2"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Physical audit reference notes, witness signature, or reason context..."
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting && <LoadingSpinner size="xs" />}
              <span>{submitting ? 'Submitting...' : 'Submit Adjustment'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Super Admin Approve / Reject Confirmation Modal */}
      {confirmModal && (
        <Modal
          isOpen={Boolean(confirmModal)}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.type === 'approve' ? 'Approve Stock Adjustment' : 'Reject Stock Adjustment'}
        >
          <div className="space-y-4">
            <div
              className={`p-3 rounded-xl border text-xs ${
                confirmModal.type === 'approve'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <p className="font-bold">
                {confirmModal.type === 'approve'
                  ? `Confirm approval of Adjustment #${confirmModal.adjustment.id}?`
                  : `Confirm rejection of Adjustment #${confirmModal.adjustment.id}?`}
              </p>
              <p className="text-2xs mt-1">
                {confirmModal.type === 'approve'
                  ? `Active inventory for batch ${confirmModal.adjustment.batch_number} will be updated to ${confirmModal.adjustment.physical_quantity} units (diff: ${confirmModal.adjustment.difference > 0 ? `+${confirmModal.adjustment.difference}` : confirmModal.adjustment.difference}).`
                  : `Adjustment will be marked as rejected. Active inventory will remain unaltered.`}
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>
                <span className="text-slate-500 font-medium">Medicine:</span>{' '}
                <span className="font-bold text-slate-800">{confirmModal.adjustment.medicine_name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Batch:</span>{' '}
                <span className="font-mono text-slate-700">{confirmModal.adjustment.batch_number}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Reason:</span>{' '}
                <span className="font-mono text-slate-700">{confirmModal.adjustment.reason}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveOrReject}
                disabled={actionLoading}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 ${
                  confirmModal.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading && <LoadingSpinner size="xs" />}
                <span>
                  {actionLoading
                    ? 'Processing...'
                    : confirmModal.type === 'approve'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
