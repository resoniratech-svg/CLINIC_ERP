import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  ArrowDownRight,
  History,
  RefreshCw,
  DollarSign,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Printer,
  FileText
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PaymentMethodSelector } from '../../components/common/PaymentMethodSelector';
import { RefundModal } from './RefundModal';
import { RefundSlipModal } from './RefundSlipModal';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, roundMoney, safeSubtract } from '../../utils/moneyUtils';

export const PROPaymentsPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const urlBillId = searchParams.get('bill_id');
  const urlAmount = searchParams.get('amount');

  const path = location.pathname;
  const initialTab = path.includes('/due-collection')
    ? 'due-collection'
    : path.includes('/refunds')
    ? 'refunds'
    : path.includes('/history')
    ? 'history'
    : 'today';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [payments, setPayments] = useState([]);
  const [dues, setDues] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPayModal, setShowPayModal] = useState(!!urlBillId);

  // Refund Modal State
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState(null);

  // Refund Slip View / Print State
  const [activeRefundSlip, setActiveRefundSlip] = useState(null);
  const [viewRefundId, setViewRefundId] = useState(null);
  const [showSlipModal, setShowSlipModal] = useState(false);

  // Form State for Record Payment
  const [payForm, setPayForm] = useState({
    bill_id: urlBillId || '',
    amount: urlAmount || '',
    payment_method: 'cash',
    remarks: ''
  });

  const fetchData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'today') {
        const res = await proApi.getTodayPayments();
        if (res.success) setPayments(res.data || []);
      } else if (tab === 'due-collection') {
        const res = await proApi.getDueCollections();
        if (res.success) setDues(res.data || []);
      } else if (tab === 'history') {
        const res = await proApi.getPaymentHistory();
        if (res.success) setPayments(res.data || []);
      } else if (tab === 'refunds') {
        const res = await proApi.getRefunds();
        if (res.success) setRefunds(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load payments data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
    fetchData(initialTab);
  }, [location.pathname]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    navigate(`/pro/payments/${tabKey}`);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payForm.bill_id || !payForm.amount || parseFloat(payForm.amount) <= 0) {
      showToast('Bill ID and a positive payment amount are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.recordPayment({
        bill_id: parseInt(payForm.bill_id),
        amount: roundMoney(payForm.amount),
        payment_method: payForm.payment_method,
        remarks: payForm.remarks || null
      });

      if (res.success) {
        showToast('Payment recorded successfully! Doctor targets updated.', 'success');
        setShowPayModal(false);
        setPayForm({ bill_id: '', amount: '', payment_method: 'cash', remarks: '' });
        fetchData(activeTab);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefundSuccess = (data) => {
    setSelectedPaymentForRefund(null);
    showToast(data?.message || 'Payment refunded successfully! Doctor targets updated.', 'success');
    fetchData(activeTab);

    // Immediately open printable refund slip
    if (data?.slip) {
      setActiveRefundSlip(data.slip);
      setViewRefundId(null);
      setShowSlipModal(true);
    }
  };

  const handleViewRefundSlip = (refund) => {
    setActiveRefundSlip(null);
    setViewRefundId(refund.refund_id);
    setShowSlipModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#1565C0] flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>
            <CreditCard className="w-5 h-5 text-[#D32F2F]" />
            <span>Payments & Collections</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Collect bill payments, manage outstanding dues, process refunds, and view real-time collections
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(activeTab)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowPayModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 btn-brand-gradient font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Record Payment</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {[
          { id: 'today', label: "Today's Payments", icon: DollarSign },
          { id: 'due-collection', label: 'Due Collections', icon: ArrowDownRight },
          { id: 'history', label: 'Payment History', icon: History },
          { id: 'refunds', label: 'Refund History', icon: RotateCcw },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#D32F2F] text-white shadow-xs shadow-red-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <LoadingSpinner label="Loading payment records..." />
      ) : activeTab === 'due-collection' ? (
        dues.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">All patient dues are cleared!</p>
            <p className="text-xs text-slate-400 mt-1">No pending due collections at this time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Due ID</th>
                    <th className="py-3.5 px-4">Patient</th>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Outstanding Due</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dues.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">#{d.id}</td>
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/pro/patients/${d.patient_id}`}
                          className="font-bold text-[#1565C0] hover:underline"
                        >
                          {d.patient_name || `Patient #${d.patient_id}`}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{d.bill_number || `Bill #${d.bill_id}`}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#D32F2F]">
                        {formatCurrency(d.due_amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-[#D32F2F]">
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setPayForm({
                              bill_id: String(d.bill_id),
                              amount: String(d.due_amount),
                              payment_method: 'cash',
                              remarks: 'Due collection payment'
                            });
                            setShowPayModal(true);
                          }}
                          className="px-3 py-1.5 bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-bold text-[11px] rounded-xl shadow-xs transition cursor-pointer"
                        >
                          Collect Due
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'refunds' ? (
        refunds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <RotateCcw className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No refunds on record</p>
            <p className="text-xs text-slate-400 mt-1">Processed refunds will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Refund #</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Patient</th>
                    <th className="py-3.5 px-4">Receipt #</th>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Method</th>
                    <th className="py-3.5 px-4">Refund Amount</th>
                    <th className="py-3.5 px-4">Reason</th>
                    <th className="py-3.5 px-4">Processed By</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {refunds.map(r => (
                    <tr key={r.refund_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-red-700">
                        {r.refund_number}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/pro/patients/${r.patient_id}`}
                          className="font-bold text-[#1565C0] hover:underline"
                        >
                          {r.patient_name || `Patient #${r.patient_id}`}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        REC-{r.payment_id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {r.bill_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {r.refund_method?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-red-600">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {r.refunded_by_name || 'Staff'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleViewRefundSlip(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs"
                          title="View and print official refund voucher"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-700" />
                          <span>Slip</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No payment records found</p>
          <p className="text-xs text-slate-400 mt-1">Click "+ Record Payment" to collect a payment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Receipt #</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Amount Paid</th>
                  <th className="py-3.5 px-4">Status</th>
                  {activeTab === 'history' && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => {
                  const paid = parseFloat(p.amount || 0);
                  const refunded = parseFloat(p.refunded_amount || 0);
                  const isFullyRefunded = refunded >= paid || p.status === 'refunded';
                  const isPartiallyRefunded = refunded > 0 && refunded < paid;
                  const remainingRefundable = Math.max(0, safeSubtract(paid, refunded));

                  return (
                    <tr key={p.payment_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        REC-{p.payment_id}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {p.payment_date ? new Date(p.payment_date).toLocaleString() : 'Today'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/pro/patients/${p.patient_id}`}
                          className="font-bold text-[#1565C0] hover:underline"
                        >
                          {p.patient_name || `Patient #${p.patient_id}`}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {p.bill_number || `Bill #${p.bill_id}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                          {p.payment_method?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-emerald-700">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        {isFullyRefunded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            <RotateCcw className="w-3 h-3" />
                            <span>Refunded</span>
                          </span>
                        ) : isPartiallyRefunded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <span>Partially Refunded ({formatCurrency(refunded)})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <span>Success</span>
                          </span>
                        )}
                      </td>
                      {activeTab === 'history' && (
                        <td className="py-3.5 px-4 text-right">
                          {isFullyRefunded ? (
                            <span className="text-[11px] text-slate-400 italic">No balance to refund</span>
                          ) : (
                            <button
                              onClick={() => setSelectedPaymentForRefund(p)}
                              title={`Refund payment (Max: ${formatCurrency(remainingRefundable)}). Reverses doctor targets.`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition shadow-2xs cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Refund</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full flex flex-col max-h-[92vh] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <h2 className="text-sm font-black text-[#1565C0] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#D32F2F]" />
                <span>Record Bill Payment</span>
              </h2>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="pro-record-pay-form" onSubmit={handleRecordPayment} className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Bill / Invoice ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={payForm.bill_id}
                  onChange={e => setPayForm({ ...payForm, bill_id: e.target.value })}
                  placeholder="Enter numeric Bill ID..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Amount to Pay (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={payForm.amount}
                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none font-mono font-bold"
                />
              </div>

              {/* Unified PaymentMethodSelector */}
              <PaymentMethodSelector
                value={payForm.payment_method}
                onChange={(m) => setPayForm({ ...payForm, payment_method: m })}
                disabled={submitting}
                name="pro_payments_page_method"
              />

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Reference / Remarks</label>
                <input
                  type="text"
                  value={payForm.remarks}
                  onChange={e => setPayForm({ ...payForm, remarks: e.target.value })}
                  placeholder="Optional reference / transaction notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-[11px] text-[#1565C0]">
                ⚡ Doctor revenue targets are credited automatically for the paid amount upon recording.
              </div>
            </form>

            {/* Footer */}
            <div className="flex-shrink-0 flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="pro-record-pay-form"
                disabled={submitting}
                className="px-5 py-2 btn-brand-gradient text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Refund Modal */}
      {selectedPaymentForRefund && (
        <RefundModal
          isOpen={Boolean(selectedPaymentForRefund)}
          payment={selectedPaymentForRefund}
          onRefundSuccess={handleRefundSuccess}
          onClose={() => setSelectedPaymentForRefund(null)}
        />
      )}

      {/* Printable Refund Slip Modal */}
      {showSlipModal && (
        <RefundSlipModal
          isOpen={showSlipModal}
          refundId={viewRefundId}
          slipData={activeRefundSlip}
          onClose={() => {
            setShowSlipModal(false);
            setActiveRefundSlip(null);
            setViewRefundId(null);
          }}
        />
      )}
    </div>
  );
};
