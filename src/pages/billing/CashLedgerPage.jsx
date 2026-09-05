import React, { useEffect, useState } from 'react';
import { cashApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { Banknote, Plus, ArrowDownRight, ArrowUpRight, DollarSign, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const CashLedgerPage = () => {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Modal states
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    amount: '',
    expense_category: 'Clinic Supplies',
    description: '',
    payment_type: 'cash',
  });
  const [savingExp, setSavingExp] = useState(false);

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depForm, setDepForm] = useState({
    deposited_amount: '',
    deposit_reference: '',
    bank_name: 'SBI Main Branch',
  });
  const [savingDep, setSavingDep] = useState(false);

  const { showToast } = useToast();

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await cashApi.getCashLedger({ date: selectedDate });
      if (res.success && res.data) {
        setLedger(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch cash ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [selectedDate]);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expForm.amount) return;

    setSavingExp(true);
    try {
      const res = await cashApi.createExpenditure({
        ...expForm,
        amount: parseFloat(expForm.amount),
        branch_id: 1,
      });

      if (res.success) {
        showToast('Cash expenditure recorded successfully', 'success');
        setIsExpModalOpen(false);
        setExpForm({ amount: '', expense_category: 'Clinic Supplies', description: '', payment_type: 'cash' });
        fetchLedger();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record expense', 'error');
    } finally {
      setSavingExp(false);
    }
  };

  const handleCreateDeposit = async (e) => {
    e.preventDefault();
    if (!depForm.deposited_amount) return;

    setSavingDep(true);
    try {
      const res = await cashApi.createCashDeposit({
        ...depForm,
        deposited_amount: parseFloat(depForm.deposited_amount),
        branch_id: 1,
      });

      if (res.success) {
        showToast('Cash bank deposit recorded successfully', 'success');
        setIsDepositModalOpen(false);
        setDepForm({ deposited_amount: '', deposit_reference: '', bank_name: 'SBI Main Branch' });
        fetchLedger();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record deposit', 'error');
    } finally {
      setSavingDep(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            <span>Cash Day-Closing Position & Drawer Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict Formula: Closing = Opening + Cash Rev - Cash Exp - Bank Deposit (CASH ONLY)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => setIsExpModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors cursor-pointer"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Log Cash Expense</span>
          </button>

          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Bank Deposit Challan</span>
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Auditing physical cash drawer position..." />
      ) : (
        <div className="space-y-6">
          {/* Main Formula Breakdown */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Physical Cash Ledger Calculations for {new Date(selectedDate).toLocaleDateString()}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  1. Opening Balance
                </span>
                <span className="text-xl font-black text-slate-800 font-mono mt-1 block">
                  {formatCurrency(ledger?.opening_balance)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Day start cash</span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  2. Cash Revenue (+)
                </span>
                <span className="text-xl font-black text-emerald-900 font-mono mt-1 block">
                  {formatCurrency(ledger?.cash_revenue)}
                </span>
                <span className="text-[10px] text-emerald-600 mt-1 block">Cash collections today</span>
              </div>

              <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
                <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block">
                  3. Cash Expenses (-)
                </span>
                <span className="text-xl font-black text-red-900 font-mono mt-1 block">
                  {formatCurrency(ledger?.cash_expenditure)}
                </span>
                <span className="text-[10px] text-red-600 mt-1 block">Petty cash spent</span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                  4. Bank Deposit (-)
                </span>
                <span className="text-xl font-black text-blue-900 font-mono mt-1 block">
                  {formatCurrency(ledger?.deposited_amount)}
                </span>
                <span className="text-[10px] text-blue-600 mt-1 block">Deposited to bank</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  5. Closing Balance
                </span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                  {formatCurrency(ledger?.closing_balance)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Physical drawer cash</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log Cash Expense */}
      <Modal
        isOpen={isExpModalOpen}
        onClose={() => setIsExpModalOpen(false)}
        title="Record Cash Expenditure"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Expense Amount (₹) *</label>
            <input
              type="number"
              required
              value={expForm.amount}
              onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Category</label>
            <select
              value={expForm.expense_category}
              onChange={(e) => setExpForm({ ...expForm, expense_category: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Clinic Supplies">Clinic Supplies</option>
              <option value="Hospital Maintenance">Hospital Maintenance</option>
              <option value="Refreshments">Refreshments</option>
              <option value="Travel & Transport">Travel & Transport</option>
              <option value="Office Stationery">Office Stationery</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Description / Voucher #</label>
            <textarea
              rows={2}
              value={expForm.description}
              onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsExpModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingExp}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingExp ? 'Saving...' : 'Deduct from Drawer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Bank Deposit */}
      <Modal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        title="Record Bank Cash Deposit"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateDeposit} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Deposit Amount (₹) *</label>
            <input
              type="number"
              required
              value={depForm.deposited_amount}
              onChange={(e) => setDepForm({ ...depForm, deposited_amount: e.target.value })}
              className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Bank Name</label>
            <input
              type="text"
              value={depForm.bank_name}
              onChange={(e) => setDepForm({ ...depForm, bank_name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Challan / Ref #</label>
            <input
              type="text"
              value={depForm.deposit_reference}
              onChange={(e) => setDepForm({ ...depForm, deposit_reference: e.target.value })}
              placeholder="CHALLAN-9842"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsDepositModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingDep}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingDep ? 'Saving...' : 'Record Deposit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
