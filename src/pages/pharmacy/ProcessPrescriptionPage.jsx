import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Pill,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Save,
  HelpCircle,
  FileEdit,
  History,
  Info,
  Calendar,
  User,
  Phone,
  ShieldCheck,
  Printer
} from 'lucide-react';

export const ProcessPrescriptionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [prescriptionData, setPrescriptionData] = useState(null);
  const [items, setItems] = useState([]);
  const [stockCheck, setStockCheck] = useState({});
  const [batchesByItem, setBatchesByItem] = useState({});
  const [selectedBatches, setSelectedBatches] = useState({});
  const [dispenseQtys, setDispenseQtys] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Modify Days Modal state
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [activeItemForModify, setActiveItemForModify] = useState(null);
  const [modifiedDays, setModifiedDays] = useState('');
  const [modifyReason, setModifyReason] = useState('');
  const [modificationsHistory, setModificationsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Raise Clarification Modal state
  const [clarificationModalOpen, setClarificationModalOpen] = useState(false);
  const [clarificationForm, setClarificationForm] = useState({
    issue_type: 'dosage_clarification',
    description: '',
    priority: 'normal',
    remarks: '',
    prescription_item_id: null,
  });

  // Success print modal state
  const [dispenseSuccess, setDispenseSuccess] = useState(null);

  const fetchPrescriptionDetails = async () => {
    setLoading(true);
    try {
      const res = await pharmacyApi.processPrescription(id);
      if (res.success && res.data) {
        setPrescriptionData(res.data.prescription);
        const rxItems = res.data.items || [];
        setItems(rxItems);

        // Pre-populate quantities and selected batch IDs
        const initialBatches = {};
        const initialQtys = {};
        rxItems.forEach((item) => {
          initialBatches[item.id] = item.selected_batch_id || '';
          initialQtys[item.id] = item.dispensed_quantity || item.quantity;
        });
        setSelectedBatches(initialBatches);
        setDispenseQtys(initialQtys);

        // Fetch stock check in parallel
        loadStockCheck(id);

        // Fetch available FEFO batches for each medicine
        loadBatchesForItems(rxItems);
      } else {
        showToast(res.message || 'Failed to load prescription', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error loading prescription for processing', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStockCheck = async (rxId) => {
    try {
      const res = await pharmacyApi.checkPrescriptionStock(rxId);
      if (res.success && res.data) {
        const checkMap = {};
        res.data.forEach((chk) => {
          checkMap[chk.item_id] = chk;
        });
        setStockCheck(checkMap);
      }
    } catch (err) {
      console.error('Error checking stock:', err);
    }
  };

  const loadBatchesForItems = async (rxItems) => {
    const batchesMap = {};
    for (const item of rxItems) {
      try {
        const bRes = await pharmacyApi.getMedicineBatches(item.medicine_id);
        if (bRes.success) {
          batchesMap[item.id] = bRes.data || [];
          // If no batch currently selected and batches exist, auto-select first FEFO batch
          if (!selectedBatches[item.id] && bRes.data && bRes.data.length > 0) {
            setSelectedBatches((prev) => ({
              ...prev,
              [item.id]: bRes.data[0].id,
            }));
          }
        }
      } catch (err) {
        console.error(`Error loading batches for item ${item.id}:`, err);
        batchesMap[item.id] = [];
      }
    }
    setBatchesByItem(batchesMap);
  };

  useEffect(() => {
    if (id) {
      fetchPrescriptionDetails();
    }
  }, [id]);

  // Handle Modify Days
  const handleOpenModifyModal = async (item) => {
    setActiveItemForModify(item);
    setModifiedDays(item.duration_days || '');
    setModifyReason('');
    setModifyModalOpen(true);
    setHistoryLoading(true);
    try {
      const hRes = await pharmacyApi.getItemModifications(item.id);
      if (hRes.success) {
        setModificationsHistory(hRes.data || []);
      }
    } catch (err) {
      console.error('Error loading item modifications history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveModifiedDays = async (e) => {
    e.preventDefault();
    if (!modifiedDays || parseInt(modifiedDays) <= 0) {
      showToast('Please enter a valid number of duration days', 'warning');
      return;
    }
    if (!modifyReason.trim()) {
      showToast('Reason for modification is required for clinical audit compliance', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await pharmacyApi.modifyPrescriptionItemDays(activeItemForModify.id, {
        modified_days: parseInt(modifiedDays),
        reason: modifyReason.trim(),
      });
      if (res.success) {
        showToast('Prescription duration modified and quantity recalculated', 'success');
        setModifyModalOpen(false);
        // Refresh prescription data
        fetchPrescriptionDetails();
      } else {
        showToast(res.message || 'Failed to modify duration', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error modifying prescription item duration', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Save Draft
  const handleSaveDraft = async () => {
    setSubmitting(true);
    try {
      const itemsPayload = items.map((item) => ({
        item_id: item.id,
        stock_id: selectedBatches[item.id] ? parseInt(selectedBatches[item.id]) : null,
        dispense_quantity: dispenseQtys[item.id] !== undefined ? parseInt(dispenseQtys[item.id]) : item.quantity,
      }));

      const res = await pharmacyApi.saveDispenseDraft(id, { items: itemsPayload });
      if (res.success) {
        showToast('Dispensing draft saved successfully without deducting stock', 'success');
      } else {
        showToast(res.message || 'Failed to save draft', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error saving dispensing draft', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Complete Dispensing
  const handleCompleteDispensing = async () => {
    // Validate that batches are selected
    for (const item of items) {
      if (!selectedBatches[item.id]) {
        showToast(`Please select a valid stock batch for "${item.medicine_name}"`, 'warning');
        return;
      }
      const qty = parseInt(dispenseQtys[item.id] || 0);
      if (qty <= 0) {
        showToast(`Dispense quantity for "${item.medicine_name}" must be greater than 0`, 'warning');
        return;
      }
    }

    setSubmitting(true);
    try {
      const itemsPayload = items.map((item) => ({
        item_id: item.id,
        stock_id: parseInt(selectedBatches[item.id]),
        dispense_quantity: parseInt(dispenseQtys[item.id]),
      }));

      const res = await pharmacyApi.completeDispensing(id, { items: itemsPayload });
      if (res.success) {
        showToast('Prescription dispensing completed successfully. Stock deducted.', 'success');
        setDispenseSuccess(res.data);
      } else {
        showToast(res.message || 'Failed to complete dispensing', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error completing dispensing. Check stock availability.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Raise Clarification
  const handleOpenClarificationModal = (item = null) => {
    setClarificationForm({
      issue_type: 'dosage_clarification',
      description: '',
      priority: 'normal',
      remarks: '',
      prescription_item_id: item ? item.id : null,
    });
    setClarificationModalOpen(true);
  };

  const handleSaveClarification = async (e) => {
    e.preventDefault();
    if (!clarificationForm.description.trim()) {
      showToast('Please enter clinical clarification details for the doctor', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await pharmacyApi.createClarification({
        prescription_id: parseInt(id),
        prescription_item_id: clarificationForm.prescription_item_id,
        issue_type: clarificationForm.issue_type,
        description: clarificationForm.description.trim(),
        priority: clarificationForm.priority,
        remarks: clarificationForm.remarks.trim(),
      });

      if (res.success) {
        showToast('Clarification sent to doctor successfully', 'success');
        setClarificationModalOpen(false);
      } else {
        showToast(res.message || 'Failed to raise clarification', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error submitting clarification', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!prescriptionData) {
    return (
      <div className="p-8">
        <EmptyState
          icon={Pill}
          title="Prescription Not Found"
          description="The requested prescription could not be loaded or is not ready for pharmacy processing."
          actionText="Back to Prescription Queue"
          onAction={() => navigate('/pharmacy/queue')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pharmacy/queue')}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Back to Queue"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">
                Process Prescription #{prescriptionData.prescription_id}
              </h1>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  prescriptionData.pharmacy_status === 'dispensed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : prescriptionData.pharmacy_status === 'partially_dispensed'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {prescriptionData.pharmacy_status || 'Processing'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict FEFO batch allocation & stock verification
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenClarificationModal(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition"
          >
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span>Raise Clarification</span>
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={submitting || prescriptionData.pharmacy_status === 'dispensed'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-600" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={handleCompleteDispensing}
            disabled={submitting || prescriptionData.pharmacy_status === 'dispensed'}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Dispensing...' : 'Complete Dispense'}</span>
          </button>
        </div>
      </div>

      {/* Patient & Handoff Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Patient Details</p>
              <p className="text-sm font-bold text-slate-800">{prescriptionData.patient_name}</p>
              <p className="text-xs text-slate-500">
                Reg ID: #{prescriptionData.patient_id} • {prescriptionData.gender || 'N/A'}, {prescriptionData.age || 'N/A'} yrs
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact & Doctor</p>
              <p className="text-sm font-bold text-slate-800">{prescriptionData.mobile_number || 'No mobile'}</p>
              <p className="text-xs text-slate-500">Prescribed by Dr. {prescriptionData.doctor_name || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">PRO Gating Status</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  PRO Completed
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  Paid
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date & Appointment</p>
              <p className="text-sm font-bold text-slate-800">
                {prescriptionData.appointment_date
                  ? new Date(prescriptionData.appointment_date).toLocaleDateString()
                  : new Date(prescriptionData.created_at).toLocaleDateString()}
              </p>
              <p className="text-xs text-slate-500">Appt #{prescriptionData.appointment_id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Prescription Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Prescription Medicines</h2>
            <p className="text-xs text-slate-500">
              Check stock availability, verify FEFO batch allocations, or modify duration days if necessary.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {items.length} {items.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="p-3.5">#</th>
                <th className="p-3.5">Medicine & Potency</th>
                <th className="p-3.5">Dosage / Frequency</th>
                <th className="p-3.5">Duration</th>
                <th className="p-3.5">Stock Check</th>
                <th className="p-3.5">FEFO Batch Selection</th>
                <th className="p-3.5 text-center">Dispense Qty</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const chk = stockCheck[item.id];
                const availableBatches = batchesByItem[item.id] || [];
                const currentBatchId = selectedBatches[item.id];
                const selectedBatchObj = availableBatches.find((b) => b.id === parseInt(currentBatchId));

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3.5 font-bold text-slate-400">{idx + 1}</td>

                    {/* Medicine */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800 text-sm">{item.medicine_name}</div>
                      <div className="text-slate-500 text-xs">
                        {item.generic_name || 'Homeopathic Dilution'} • {item.potency || '30C'}
                      </div>
                      {item.instructions && (
                        <div className="text-slate-400 text-2xs italic mt-0.5">"{item.instructions}"</div>
                      )}
                    </td>

                    {/* Dosage / Frequency */}
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-700">{item.frequency || '1-0-1'}</div>
                      <div className="text-slate-500 text-2xs">{item.dosage || '4 pills'}</div>
                    </td>

                    {/* Duration Days */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-sm">
                          {item.duration_days || Math.max(1, Math.round(item.quantity / 2))}
                        </span>
                        <span className="text-slate-500 text-xs">days</span>
                        <button
                          onClick={() => handleOpenModifyModal(item)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                          title="Modify Duration Days"
                        >
                          <FileEdit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Stock Check Status */}
                    <td className="p-3.5">
                      {chk ? (
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                              chk.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : chk.status === 'partially_available'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {chk.status === 'available' && <CheckCircle2 className="w-3 h-3" />}
                            {chk.status === 'partially_available' && <AlertTriangle className="w-3 h-3" />}
                            {chk.status === 'out_of_stock' && <AlertTriangle className="w-3 h-3" />}
                            {chk.status.replace('_', ' ')}
                          </span>
                          <p className="text-2xs text-slate-400 mt-0.5">
                            Avail: {chk.available_quantity} / Req: {chk.required_quantity}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-2xs">Checking...</span>
                      )}
                    </td>

                    {/* FEFO Batch Selector */}
                    <td className="p-3.5 min-w-[220px]">
                      {availableBatches.length > 0 ? (
                        <div>
                          <select
                            value={selectedBatches[item.id] || ''}
                            onChange={(e) =>
                              setSelectedBatches({
                                ...selectedBatches,
                                [item.id]: e.target.value,
                              })
                            }
                            className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                          >
                            {availableBatches.map((batch) => {
                              const expDate = batch.expiry_date
                                ? new Date(batch.expiry_date).toLocaleDateString()
                                : 'No Exp';
                              return (
                                <option key={batch.id} value={batch.id}>
                                  {batch.batch_number} (Exp: {expDate} | Stk: {batch.quantity})
                                </option>
                              );
                            })}
                          </select>
                          {selectedBatchObj && (
                            <p className="text-2xs text-slate-500 mt-0.5">
                              MRP: ₹{selectedBatchObj.mrp || '0.00'} • Expiry:{' '}
                              {new Date(selectedBatchObj.expiry_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-500 font-semibold text-2xs flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>No valid FEFO batch in stock</span>
                        </div>
                      )}
                    </td>

                    {/* Dispense Qty */}
                    <td className="p-3.5 text-center">
                      <input
                        type="number"
                        min="1"
                        value={dispenseQtys[item.id] !== undefined ? dispenseQtys[item.id] : item.quantity}
                        onChange={(e) =>
                          setDispenseQtys({
                            ...dispenseQtys,
                            [item.id]: e.target.value,
                          })
                        }
                        className="w-16 text-center bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-1.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenClarificationModal(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition"
                      >
                        <HelpCircle className="w-3 h-3 text-amber-600" />
                        <span>Clarify</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modify Days Modal */}
      <Modal
        isOpen={modifyModalOpen}
        onClose={() => setModifyModalOpen(false)}
        title={`Modify Duration — ${activeItemForModify?.medicine_name || ''}`}
      >
        <form onSubmit={handleSaveModifiedDays} className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
            <p className="font-bold flex items-center gap-1">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              Pharmacist Operational Privilege
            </p>
            You are authorized to adjust duration days for patient availability/refill reasons. The backend will
            automatically recalculate the dispense quantity and record a compliant audit log.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Modified Duration (Days) *
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={modifiedDays}
              onChange={(e) => setModifiedDays(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reason for Duration Modification *
            </label>
            <textarea
              rows="3"
              value={modifyReason}
              onChange={(e) => setModifyReason(e.target.value)}
              placeholder="e.g. Patient traveling, requested 15 days supply instead of 30 days..."
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            />
          </div>

          {/* Modification History */}
          {modificationsHistory.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                Previous Duration Changes
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 text-2xs">
                {modificationsHistory.map((m) => (
                  <div key={m.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-700">
                      {m.original_value} days → {m.modified_value} days
                    </span>{' '}
                    • Reason: <span className="italic text-slate-600">"{m.reason}"</span> by{' '}
                    <span className="font-semibold text-slate-800">{m.modified_by_name || 'Pharmacist'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModifyModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50"
            >
              {submitting ? 'Recalculating...' : 'Apply & Recalculate'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Raise Clarification Modal */}
      <Modal
        isOpen={clarificationModalOpen}
        onClose={() => setClarificationModalOpen(false)}
        title="Raise Clarification to Doctor"
      >
        <form onSubmit={handleSaveClarification} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            Submit a question directly to the prescribing doctor (Dr. {prescriptionData.doctor_name}). Clinical edits
            (changing medicine or potency) must be approved by the doctor.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Issue Category *
              </label>
              <select
                value={clarificationForm.issue_type}
                onChange={(e) => setClarificationForm({ ...clarificationForm, issue_type: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              >
                <option value="dosage_clarification">Dosage Clarification</option>
                <option value="substitution_request">Medicine Substitution Request</option>
                <option value="medicine_unavailable">Medicine Unavailable / Stock</option>
                <option value="quantity_clarification">Quantity Discrepancy</option>
                <option value="duration_clarification">Course Duration Clarification</option>
                <option value="prescription_error">Prescription Error / Ambiguity</option>
                <option value="other">Other Clinical Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Priority</label>
              <select
                value={clarificationForm.priority}
                onChange={(e) => setClarificationForm({ ...clarificationForm, priority: e.target.value })}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              >
                <option value="normal">Normal Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent (Immediate Patient Waiting)</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Clinical Question / Details *
            </label>
            <textarea
              rows="3"
              value={clarificationForm.description}
              onChange={(e) => setClarificationForm({ ...clarificationForm, description: e.target.value })}
              placeholder="e.g. Prescribed Thuja 200CH is out of stock; requesting approval to dispense Thuja 1M or Thuja 30C..."
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Internal Remarks (Optional)
            </label>
            <input
              type="text"
              value={clarificationForm.remarks}
              onChange={(e) => setClarificationForm({ ...clarificationForm, remarks: e.target.value })}
              placeholder="Pharmacist internal reference..."
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setClarificationModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Send Clarification'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dispensing Completed Slip / Success Modal */}
      {dispenseSuccess && (
        <Modal
          isOpen={!!dispenseSuccess}
          onClose={() => {
            setDispenseSuccess(null);
            navigate('/pharmacy/queue');
          }}
          title="Dispensing Completed Successfully"
        >
          <div className="space-y-4 text-center py-2">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Prescription #{dispenseSuccess.prescription_id} Dispensed
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Stock has been decremented from inventory batches. Patient handoff is complete.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-200 text-xs space-y-1">
              <p>
                <span className="font-semibold text-slate-600">Patient:</span>{' '}
                <span className="font-bold text-slate-800">{prescriptionData.patient_name}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Dispense Status:</span>{' '}
                <span className="font-bold text-emerald-700 uppercase">{dispenseSuccess.pharmacy_status}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Items Processed:</span>{' '}
                <span className="font-bold text-slate-800">{dispenseSuccess.dispensed_items_count} items</span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Dispensing Slip</span>
              </button>
              <button
                onClick={() => {
                  setDispenseSuccess(null);
                  navigate('/pharmacy/queue');
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
              >
                <span>Back to Queue</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
