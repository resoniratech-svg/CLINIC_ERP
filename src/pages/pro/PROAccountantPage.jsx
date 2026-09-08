import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Calculator,
  Plus,
  DollarSign,
  TrendingUp,
  ArrowDownRight,
  Building,
  RefreshCw,
  Calendar,
  CreditCard,
  Receipt,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';
import { proApi, settingsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

export const PROAccountantPage = () => {
  const { showToast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Expense Form
  const [expenseForm, setExpenseForm] = useState({
    category: 'Clinic Supplies',
    description: '',
    amount: '',
    remarks: ''
  });

  // Deposit Form
  const [depositForm, setDepositForm] = useState({
    deposit_amount: '',
    deposit_reference: '',
    remarks: ''
  });

  const [expenseCategoriesList, setExpenseCategoriesList] = useState([]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await proApi.getDailyCashSummary({ date });
      if (res.success) {
        setSummary(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load daily cash summary');
      showToast(err.message || 'Failed to load daily cash summary', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [date]);

  useEffect(() => {
    settingsApi.getMasterData('expense_categories', { status: 'active' })
      .then(res => { if (res?.success && Array.isArray(res.data)) setExpenseCategoriesList(res.data); })
      .catch(() => {});
  }, []);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const amt = parseFloat(expenseForm.amount);
    if (!expenseForm.category || !expenseForm.description || !expenseForm.amount) {
      showToast('Category, description, and amount are required', 'error');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      showToast('Expense amount must be a positive number greater than 0', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.createExpenditure({
        ...expenseForm,
        amount: amt
      });
      if (res.success) {
        showToast('Cash expenditure recorded successfully', 'success');
        setShowExpenseModal(false);
        setExpenseForm({ category: 'Clinic Supplies', description: '', amount: '', remarks: '' });
        fetchSummary();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record expenditure', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepositCash = async (e) => {
    e.preventDefault();
    const amt = parseFloat(depositForm.deposit_amount);
    if (!depositForm.deposit_amount || isNaN(amt) || amt <= 0) {
      showToast('Valid deposit amount is required', 'error');
      return;
    }

    if (summary && amt > summary.expected_cash) {
      showToast(`Deposit amount (${formatCurrency(amt)}) cannot exceed available cash in drawer (${formatCurrency(summary.expected_cash)})`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.depositCash({
        deposit_amount: amt,
        deposit_reference: depositForm.deposit_reference || null,
        remarks: depositForm.remarks || null
      });
      if (res.success) {
        showToast('Bank cash deposit recorded successfully', 'success');
        setShowDepositModal(false);
        setDepositForm({ deposit_amount: '', deposit_reference: '', remarks: '' });
        fetchSummary();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record bank deposit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !summary) {
    return <LoadingSpinner label="Loading accountant ledger & cash summary..." />;
  }

  const s = summary || {
    opening_cash: 0,
    cash_revenue: 0,
    cash_expenditure: 0,
    expected_cash: 0,
    cash_deposited: 0,
    closing_cash: 0,
    payment_method_breakdown: { cash: 0, card: 0, upi: 0, razorpay: 0, bajaj_pay: 0 },
    grand_total: 0
  };

  const b = s.payment_method_breakdown || {};

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-600" />
            <span>Accountant & Cash Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile daily physical cash drawer vs. total revenue collections across all payment modes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none"
            />
          </div>

          <button
            onClick={fetchSummary}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Building className="w-3.5 h-3.5" />
            <span>Bank Deposit</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchSummary}
            className="font-bold underline hover:text-red-900 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* SECTION 1: PHYSICAL CASH POSITION (Formula Card) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Physical Cash Drawer Ledger
            </h2>
          </div>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Date: {date}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Opening Cash</span>
            <span className="text-base font-black text-slate-900 font-mono">
              {formatCurrency(s.opening_cash)}
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 font-bold uppercase block">+ Cash Revenue</span>
            <span className="text-base font-black text-emerald-700 font-mono">
              {formatCurrency(s.cash_revenue)}
            </span>
          </div>

          <div className="p-3.5 bg-red-50/60 rounded-xl border border-red-200">
            <span className="text-[10px] text-red-700 font-bold uppercase block">− Cash Expense</span>
            <span className="text-base font-black text-red-700 font-mono">
              {formatCurrency(s.cash_expenditure)}
            </span>
          </div>

          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
            <span className="text-[10px] text-blue-700 font-bold uppercase block">= Expected Cash</span>
            <span className="text-base font-black text-blue-700 font-mono">
              {formatCurrency(s.expected_cash)}
            </span>
          </div>

          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
            <span className="text-[10px] text-[#1565C0] font-bold uppercase block">− Bank Deposited</span>
            <span className="text-base font-black text-[#1565C0] font-mono">
              {formatCurrency(s.cash_deposited)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-xs">
            <span className="text-[10px] text-slate-300 font-bold uppercase block">= Closing Cash</span>
            <span className="text-base font-black text-emerald-400 font-mono">
              {formatCurrency(s.closing_cash)}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic">
          Formula: Opening Cash ({formatCurrency(s.opening_cash)}) + Cash Revenue ({formatCurrency(s.cash_revenue)}) − Expenditure ({formatCurrency(s.cash_expenditure)}) = Expected ({formatCurrency(s.expected_cash)}) − Deposited ({formatCurrency(s.cash_deposited)}) = Closing Cash in Hand ({formatCurrency(s.closing_cash)}).
        </p>
      </div>

      {/* SECTION 2: GRAND TOTAL REVENUE VS PHYSICAL CASH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#1565C0]" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Collections by Payment Mode
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Daily Breakdown</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="font-bold text-emerald-800 block">1. Cash</span>
              <span className="text-base font-black text-emerald-900 font-mono mt-1 block">
                {formatCurrency(b.cash || 0)}
              </span>
            </div>

            <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200">
              <span className="font-bold text-blue-800 block">2. Card</span>
              <span className="text-base font-black text-blue-900 font-mono mt-1 block">
                {formatCurrency(b.card || 0)}
              </span>
            </div>

            <div className="p-3.5 bg-sky-50 rounded-xl border border-sky-200">
              <span className="font-bold text-sky-800 block">3. UPI</span>
              <span className="text-base font-black text-sky-900 font-mono mt-1 block">
                {formatCurrency(b.upi || 0)}
              </span>
            </div>

            <div className="p-3.5 bg-indigo-50 rounded-xl border border-indigo-200">
              <span className="font-bold text-indigo-800 block">4. Razorpay</span>
              <span className="text-base font-black text-indigo-900 font-mono mt-1 block">
                {formatCurrency(b.razorpay || 0)}
              </span>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
              <span className="font-bold text-amber-800 block">5. Bajaj Pay</span>
              <span className="text-base font-black text-amber-900 font-mono mt-1 block">
                {formatCurrency(b.bajaj_pay || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Grand Total Card */}
        <div className="bg-gradient-to-br from-[#1565C0] via-blue-800 to-slate-900 text-white rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="text-xs text-blue-200 font-bold uppercase tracking-wider block">
              Daily Grand Total Revenue
            </span>
            <div className="text-3xl font-black font-mono mt-2">
              {formatCurrency(s.grand_total)}
            </div>
            <p className="text-xs text-blue-200/80 mt-2">
              Sum total of all payment collections across Cash, Card, UPI, Razorpay & Bajaj Pay.
            </p>
          </div>

          <div className="p-3 bg-white/10 rounded-xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-blue-200">Physical Cash:</span>
              <span className="font-mono font-bold">{formatCurrency(b.cash || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Digital Modes:</span>
              <span className="font-mono font-bold">
                {formatCurrency((s.grand_total || 0) - (b.cash || 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-red-600" />
                <span>Record Cash Expenditure</span>
              </h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Expense Category *</label>
                <select
                  value={expenseForm.category}
                  onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none bg-white font-medium"
                >
                  {expenseCategoriesList.length > 0 ? (
                    <>
                      {expenseCategoriesList.map(ec => (
                        <option key={ec.id || ec.name} value={ec.name}>{ec.name}</option>
                      ))}
                      {expenseForm.category && !expenseCategoriesList.some(ec => ec.name === expenseForm.category) && (
                        <option value={expenseForm.category}>{expenseForm.category}</option>
                      )}
                    </>
                  ) : (
                    <>
                      <option value="Clinic Supplies">Clinic Supplies</option>
                      <option value="Maintenance & Repairs">Maintenance & Repairs</option>
                      <option value="Tea & Refreshments">Tea & Refreshments</option>
                      <option value="Printing & Stationery">Printing & Stationery</option>
                      <option value="Staff Conveyance">Staff Conveyance</option>
                      <option value="Courier & Postage">Courier & Postage</option>
                      <option value="Other Petty Cash">Other Petty Cash</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description *</label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g. Purchased sanitizers and gloves"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400">Payment mode is permanently cash for petty cash expenses.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Remarks / Bill Ref</label>
                <input
                  type="text"
                  value={expenseForm.remarks}
                  onChange={e => setExpenseForm({ ...expenseForm, remarks: e.target.value })}
                  placeholder="Voucher or invoice reference..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-red-400 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Record Cash Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-[#1565C0]" />
                <span>Record Bank Cash Deposit</span>
              </h2>
              <button onClick={() => setShowDepositModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleDepositCash} className="space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500">Available Expected Cash in Drawer:</span>
                <div className="font-mono font-black text-slate-900 text-sm">
                  {formatCurrency(s.expected_cash)}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Deposit Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={depositForm.deposit_amount}
                  onChange={e => setDepositForm({ ...depositForm, deposit_amount: e.target.value })}
                  placeholder={`Max: ${s.expected_cash || 0}`}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Bank Deposit Challan / Ref #</label>
                <input
                  type="text"
                  value={depositForm.deposit_reference}
                  onChange={e => setDepositForm({ ...depositForm, deposit_reference: e.target.value })}
                  placeholder="e.g. HDFC-CHALLAN-9842"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Remarks</label>
                <input
                  type="text"
                  value={depositForm.remarks}
                  onChange={e => setDepositForm({ ...depositForm, remarks: e.target.value })}
                  placeholder="Bank branch or deposit note..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 btn-brand-gradient text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Depositing...' : 'Confirm Cash Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
