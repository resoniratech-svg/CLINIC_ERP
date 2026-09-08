import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  Clock,
  ArrowDownRight,
  History,
  RefreshCw,
  Search,
  DollarSign,
  Receipt,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash (Physical)' },
  { value: 'card', label: 'Card (POS / Debit / Credit)' },
  { value: 'upi', label: 'UPI (GPay / PhonePe / QR)' },
  { value: 'razorpay', label: 'Razorpay Gateway' },
  { value: 'bajaj_pay', label: 'Bajaj Pay / EMI' },
];

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
    : path.includes('/history')
    ? 'history'
    : 'today';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [payments, setPayments] = useState([]);
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPayModal, setShowPayModal] = useState(!!urlBillId);

  // Form State
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
        amount: parseFloat(payForm.amount),
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

  const handleRefund = async (paymentId) => {
    if (!window.confirm('Are you sure you want to refund this payment? Doctor target contribution will also be reversed.')) {
      return;
    }

    try {
      const res = await proApi.refundPayment(paymentId);
      if (res.success) {
        showToast(`Payment #${paymentId} refunded successfully`, 'success');
        fetchData(activeTab);
      }
    } catch (err) {
      showToast(err.message || 'Failed to refund payment', 'error');
    }
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
            Collect bill payments, manage outstanding dues, and view real-time collections
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

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {[
          { id: 'today', label: "Today's Payments", icon: DollarSign },
          { id: 'due-collection', label: 'Due Collections', icon: ArrowDownRight },
          { id: 'history', label: 'Payment History', icon: History },
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

      {/* Table Content */}
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
                  {activeTab === 'history' && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
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
                    {activeTab === 'history' && (
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleRefund(p.payment_id)}
                          title="Refund payment and reverse targets"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-[#1565C0] flex items-center gap-2">
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

            <form onSubmit={handleRecordPayment} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={payForm.payment_method}
                    onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white font-medium"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

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

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 btn-brand-gradient text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
