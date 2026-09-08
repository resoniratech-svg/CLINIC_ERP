import React, { useEffect, useState, useCallback } from 'react';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Package,
  User,
  RefreshCw,
  Info,
  Calendar,
  X,
  Filter,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const MedicineReturnsPage = () => {
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modal data
  const [medicines, setMedicines] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [formData, setFormData] = useState({
    patient_id: '',
    prescription_id: '',
    medicine_id: '',
    stock_id: '',
    return_quantity: '',
    return_reason: 'Discontinued by Doctor',
    condition: 'good',
    remarks: '',
  });

  const { showToast } = useToast();

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (conditionFilter) params.condition = conditionFilter;
      if (dateFilter) params.date = dateFilter;

      const res = await pharmacyApi.getMedicineReturns(params);
      if (res.success) {
        setReturnsList(res.data || []);
      } else {
        showToast(res.message || 'Failed to load medicine returns', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to load medicine returns', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, conditionFilter, dateFilter, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReturns();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchReturns]);

  const handleOpenModal = async () => {
    setIsModalOpen(true);
    setPatientSearchTerm('');
    setPatientSearchResults([]);
    setSelectedPatient(null);
    setFormData({
      patient_id: '',
      prescription_id: '',
      medicine_id: '',
      stock_id: '',
      return_quantity: '',
      return_reason: 'Discontinued by Doctor',
      condition: 'good',
      remarks: '',
    });
    try {
      const mRes = await pharmacyApi.getMedicines();
      if (mRes.success) setMedicines(mRes.data || []);
    } catch (err) {
      console.error('Error fetching medicines:', err);
    }
  };

  const searchPatients = async (query) => {
    setPatientSearchTerm(query);
    if (!query || query.trim().length < 2) {
      setPatientSearchResults([]);
      return;
    }
    setPatientSearching(true);
    try {
      const res = await pharmacyApi.searchPatients({ search: query.trim() });
      if (res.success) {
        setPatientSearchResults(res.data || []);
      }
    } catch (err) {
      console.error('Error searching patients:', err);
    } finally {
      setPatientSearching(false);
    }
  };

  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    setFormData((prev) => ({ ...prev, patient_id: p.patient_id }));
    setPatientSearchTerm(`${p.full_name} (${p.registration_id || `#${p.patient_id}`})`);
    setPatientSearchResults([]);
  };

  const handleMedicineChange = async (medId) => {
    setFormData((prev) => ({ ...prev, medicine_id: medId, stock_id: '' }));
    if (!medId) {
      setStockBatches([]);
      return;
    }
    try {
      const bRes = await pharmacyApi.getMedicineBatches(medId);
      if (bRes.success) {
        setStockBatches(bRes.data || []);
        if (bRes.data && bRes.data.length > 0) {
          setFormData((prev) => ({ ...prev, stock_id: bRes.data[0].id }));
        }
      }
    } catch (err) {
      console.error('Error loading batches:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patient_id || !formData.medicine_id || !formData.stock_id || !formData.return_quantity) {
      showToast('Please fill all required fields', 'warning');
      return;
    }

    const qty = parseInt(formData.return_quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Return quantity must be a positive number', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await pharmacyApi.createMedicineReturn({
        patient_id: parseInt(formData.patient_id, 10),
        prescription_id: formData.prescription_id ? parseInt(formData.prescription_id, 10) : null,
        medicine_id: parseInt(formData.medicine_id, 10),
        stock_id: parseInt(formData.stock_id, 10),
        return_quantity: qty,
        return_reason: formData.return_reason,
        condition: formData.condition,
        remarks: formData.remarks.trim() || undefined,
      });

      if (res.success) {
        showToast(
          formData.condition === 'good'
            ? 'Medicine return logged and inventory automatically restocked!'
            : 'Medicine return logged as quarantined (not added to active inventory)',
          'success'
        );
        setIsModalOpen(false);
        fetchReturns();
      } else {
        showToast(res.message || 'Failed to process return', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error processing medicine return', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setConditionFilter('');
    setDateFilter('');
  };

  const getConditionBadge = (condition, restocked) => {
    switch (condition) {
      case 'good':
        return (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              GOOD
            </span>
            {restocked ? (
              <span className="text-2xs font-bold text-emerald-700 flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Restocked
              </span>
            ) : (
              <span className="text-2xs font-semibold text-slate-400">Quarantined</span>
            )}
          </div>
        );
      case 'damaged':
        return (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
              DAMAGED
            </span>
            <span className="text-2xs font-semibold text-slate-400">Quarantined</span>
          </div>
        );
      case 'expired':
        return (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
              EXPIRED
            </span>
            <span className="text-2xs font-semibold text-slate-400">Quarantined</span>
          </div>
        );
      case 'opened':
        return (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
              OPENED
            </span>
            <span className="text-2xs font-semibold text-slate-400">Quarantined</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800">
              {condition}
            </span>
            <span className="text-2xs font-semibold text-slate-400">
              {restocked ? 'Restocked' : 'Quarantined'}
            </span>
          </div>
        );
    }
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

  const hasActiveFilters = Boolean(searchTerm || conditionFilter || dateFilter);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Medicine Returns Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Accept returned medicines with condition inspection and automated stock re-entry controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Process Return</span>
          </button>
          <button
            onClick={fetchReturns}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Hospital Pharmacy Policy Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <span className="font-bold">Hospital Pharmacy Policy:</span> Items returned in{' '}
          <span className="font-bold underline">"Good"</span> condition are automatically restocked into active inventory
          and recorded in the transaction ledger. Items marked as{' '}
          <span className="font-bold text-red-700">"Damaged / Opened"</span> or{' '}
          <span className="font-bold text-red-700">"Expired"</span> are quarantined for disposal and will not enter active stock.
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Patient, Medicine, Batch number, or Return ID..."
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
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden font-medium"
            >
              <option value="">All Conditions</option>
              <option value="good">Good (Restocked)</option>
              <option value="damaged">Damaged (Quarantined)</option>
              <option value="expired">Expired (Quarantined)</option>
              <option value="opened">Opened (Quarantined)</option>
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              title="Filter by Return Date"
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

      {/* Returns List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : returnsList.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={RotateCcw}
              title={hasActiveFilters ? "No Matching Returns Found" : "No Medicine Returns"}
              description={
                hasActiveFilters
                  ? "Try adjusting your search query, condition, or date filter."
                  : "No returns recorded in this branch yet."
              }
              actionText={hasActiveFilters ? "Clear Filters" : "Record First Return"}
              onAction={hasActiveFilters ? handleResetFilters : handleOpenModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Patient Details</th>
                  <th className="p-4">Medicine & Batch</th>
                  <th className="p-4 text-center">Quantity</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Condition & Restock</th>
                  <th className="p-4">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnsList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4 font-bold text-slate-400">#{r.id}</td>
                    <td className="p-4 whitespace-nowrap text-slate-700">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm">{r.patient_name || 'Walk-in Patient'}</div>
                      <div className="text-slate-400 text-2xs">Patient #{r.patient_id}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm">
                        {r.medicine_name} {r.medicine_strength && `— ${r.medicine_strength}`}
                      </div>
                      <div className="text-slate-500 font-mono text-2xs">Batch: {r.batch_number || 'N/A'}</div>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-800 text-sm">{r.return_quantity}</td>
                    <td className="p-4 text-slate-600 max-w-xs truncate" title={r.return_reason}>
                      {r.return_reason}
                      {r.remarks && (
                        <div className="text-2xs text-slate-400 italic truncate" title={r.remarks}>
                          Note: {r.remarks}
                        </div>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {getConditionBadge(r.condition, r.restocked)}
                    </td>
                    <td className="p-4 font-semibold text-slate-800">{r.processed_by_name || 'Pharmacist'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Process Return Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Process Medicine Return">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Lookup */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Patient *
            </label>
            <div className="relative">
              <input
                type="text"
                value={patientSearchTerm}
                onChange={(e) => searchPatients(e.target.value)}
                placeholder="Search patient by name, mobile, or enter Patient ID..."
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
              {patientSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <LoadingSpinner size="xs" />
                </div>
              )}
            </div>

            {/* Patient Search Results Dropdown */}
            {patientSearchResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                {patientSearchResults.map((p) => (
                  <button
                    key={p.patient_id}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{p.full_name}</span>
                      <span className="text-slate-400 text-2xs ml-2">({p.registration_id || `#${p.patient_id}`})</span>
                    </div>
                    <span className="text-2xs text-slate-500 font-mono">{p.mobile || ''}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Direct numeric fallback if typing ID */}
            {!selectedPatient && patientSearchTerm && !isNaN(Number(patientSearchTerm.trim())) && (
              <div className="mt-1 text-2xs text-blue-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Using Patient ID #{patientSearchTerm.trim()}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Prescription ID (Optional)
              </label>
              <input
                type="number"
                value={formData.prescription_id}
                onChange={(e) => setFormData({ ...formData, prescription_id: e.target.value })}
                placeholder="e.g. 12"
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Return Quantity *
              </label>
              <input
                type="number"
                min="1"
                value={formData.return_quantity}
                onChange={(e) => setFormData({ ...formData, return_quantity: e.target.value })}
                placeholder="e.g. 10"
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Medicine Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Medicine Returned *
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
                  {m.medicine_name} {m.strength && `— ${m.strength}`} ({m.dosage_form || 'Form'})
                </option>
              ))}
            </select>
          </div>

          {/* Stock Batch Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Stock Batch *
            </label>
            <select
              value={formData.stock_id}
              onChange={(e) => setFormData({ ...formData, stock_id: e.target.value })}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              required
              disabled={!formData.medicine_id || stockBatches.length === 0}
            >
              <option value="">
                {!formData.medicine_id
                  ? 'First choose a medicine above...'
                  : stockBatches.length === 0
                  ? 'No batches available for this medicine'
                  : 'Select Batch...'}
              </option>
              {stockBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} (Exp: {formatDate(b.expiry_date)} | Current Stock: {b.quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Return Reason *
              </label>
              <select
                value={formData.return_reason}
                onChange={(e) => setFormData({ ...formData, return_reason: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              >
                <option value="Discontinued by Doctor">Discontinued by Doctor</option>
                <option value="Adverse Effect / Reaction">Adverse Effect / Reaction</option>
                <option value="Patient Cured Early">Patient Cured Early</option>
                <option value="Wrong Medicine Dispensed">Wrong Medicine Dispensed</option>
                <option value="Patient Preference">Patient Preference</option>
                <option value="Packaging Damaged">Packaging Damaged</option>
                <option value="Expired">Expired</option>
                <option value="Other">Other Reason</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Package Condition *
              </label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-bold"
              >
                <option value="good">Good / Sealed (Will Restock)</option>
                <option value="damaged">Damaged / Broken Seal (Quarantine)</option>
                <option value="expired">Expired (Quarantine)</option>
                <option value="opened">Opened / Partial (Quarantine)</option>
              </select>
            </div>
          </div>

          {/* Condition Feedback Callout */}
          <div
            className={`p-3 rounded-xl border text-2xs font-medium flex items-center gap-2 ${
              formData.condition === 'good'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {formData.condition === 'good' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Restock Action:</strong> This item will be automatically returned to active inventory (+
                  {formData.return_quantity || '0'} units) and recorded in the stock transaction ledger.
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Quarantine Action:</strong> This item will be quarantined for safe disposal and will{' '}
                  <strong>NOT</strong> be added to active inventory.
                </span>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Inspection Remarks (Optional)
            </label>
            <textarea
              rows="2"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Packaging inspection details, seal condition, or verification notes..."
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
              <span>{submitting ? 'Processing...' : 'Confirm Return'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
