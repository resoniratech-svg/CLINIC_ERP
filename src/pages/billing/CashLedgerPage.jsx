import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cashApi, settingsApi, usersApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Banknote,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  X,
  Eye,
  Filter,
  RefreshCw,
  Building,
  UserCheck,
  Calendar,
  FileText
} from 'lucide-react';

export const CashLedgerPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'requests';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Modals for Actions
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
    remarks: ''
  });
  const [savingDep, setSavingDep] = useState(false);
  const [expenseCategoriesList, setExpenseCategoriesList] = useState([]);

  // Data lists
  const [depositRequests, setDepositRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [depositHistory, setDepositHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expendituresList, setExpendituresList] = useState([]);
  const [loadingExpList, setLoadingExpList] = useState(false);

  // Filter state for Deposit Ledger
  const [depFilters, setDepFilters] = useState({
    date_from: '',
    date_to: '',
    deposit_type: 'all',
    status: 'all',
    pro_id: 'all',
    branch_id: 'all'
  });

  // Filter state for Requests
  const [reqFilters, setReqFilters] = useState({
    status: 'all',
    branch_id: 'all',
    date_from: '',
    date_to: ''
  });

  // Filter state for Expenditures
  const [expFilters, setExpFilters] = useState({
    date_from: '',
    date_to: '',
    category: 'all',
    pro_id: 'all',
    branch_id: 'all'
  });

  // Review & Approval Modals
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Master lists for filters
  const [proUsersList, setProUsersList] = useState([]);
  const [branchesList, setBranchesList] = useState([]);

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

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await cashApi.getDepositRequests(reqFilters);
      if (res.success && Array.isArray(res.data)) {
        setDepositRequests(res.data);
      }
    } catch (err) {
      // Quiet handling
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchDepositHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await cashApi.getDepositHistory(depFilters);
      if (res.success && Array.isArray(res.data)) {
        setDepositHistory(res.data);
      }
    } catch (err) {
      // Quiet handling
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchExpendituresList = async () => {
    setLoadingExpList(true);
    try {
      const res = await cashApi.getExpenditures(expFilters);
      if (res.success && Array.isArray(res.data)) {
        setExpendituresList(res.data);
      }
    } catch (err) {
      // Quiet handling
    } finally {
      setLoadingExpList(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [selectedDate]);

  useEffect(() => {
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'deposits') fetchDepositHistory();
    if (activeTab === 'expenses') fetchExpendituresList();
  }, [activeTab, reqFilters, depFilters, expFilters]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['requests', 'deposits', 'expenses'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    settingsApi.getMasterData('expense_categories', { status: 'active' })
      .then(res => { if (res?.success && Array.isArray(res.data)) setExpenseCategoriesList(res.data); })
      .catch(() => {});

    // Fetch PROs and branches for dropdown filters
    usersApi?.getUsers?.({ role: 'pro_manager' })
      .then(res => { if (res?.success && Array.isArray(res.data)) setProUsersList(res.data); })
      .catch(() => {});

    settingsApi?.getBranches?.()
      .then(res => { if (res?.success && Array.isArray(res.data)) setBranchesList(res.data); })
      .catch(() => {});
  }, []);

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
        if (activeTab === 'expenses') fetchExpendituresList();
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
        showToast('Cash bank deposit recorded successfully as SUPER_ADMIN', 'success');
        setIsDepositModalOpen(false);
        setDepForm({ deposited_amount: '', deposit_reference: '', bank_name: 'SBI Main Branch', remarks: '' });
        fetchLedger();
        if (activeTab === 'deposits') fetchDepositHistory();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record deposit', 'error');
    } finally {
      setSavingDep(false);
    }
  };

  const handleApprove = async (requestItem) => {
    setProcessingAction(true);
    try {
      const res = await cashApi.approveDepositRequest(requestItem.id);
      if (res.success) {
        showToast(`Deposit request #DR-${String(requestItem.id).padStart(6, '0')} approved successfully`, 'success');
        setIsReviewModalOpen(false);
        setSelectedRequest(null);
        fetchRequests();
        fetchLedger();
      }
    } catch (err) {
      showToast(err.message || 'Failed to approve deposit request', 'error');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleRejectConfirm = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !rejectionReason.trim()) {
      showToast('Rejection reason is required', 'error');
      return;
    }

    setProcessingAction(true);
    try {
      const res = await cashApi.rejectDepositRequest(selectedRequest.id, {
        rejection_reason: rejectionReason.trim()
      });
      if (res.success) {
        showToast(`Deposit request #DR-${String(selectedRequest.id).padStart(6, '0')} rejected`, 'success');
        setIsRejectModalOpen(false);
        setIsReviewModalOpen(false);
        setSelectedRequest(null);
        setRejectionReason('');
        fetchRequests();
        fetchLedger();
      }
    } catch (err) {
      showToast(err.message || 'Failed to reject deposit request', 'error');
    } finally {
      setProcessingAction(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const pendingCount = depositRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
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
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-1 py-0.5 text-xs rounded-lg border-0 bg-transparent font-medium focus:ring-0"
            />
          </div>

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
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Physical Cash Ledger Calculations for {new Date(selectedDate).toLocaleDateString()}
              </h3>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Available in Drawer: {formatCurrency(ledger?.available_cash)}
              </span>
            </div>

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

          {/* Tabbed Navigation: 1. PRO Deposit Requests, 2. Bank Deposit Ledger, 3. Cash Expenditure History */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-3 gap-2 overflow-x-auto">
              <button
                onClick={() => {
                  setActiveTab('requests');
                  setSearchParams({ tab: 'requests' });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer ${
                  activeTab === 'requests'
                    ? 'bg-white text-blue-600 border-t-2 border-x border-b-0 border-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>PRO Deposit Requests</span>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('deposits');
                  setSearchParams({ tab: 'deposits' });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer ${
                  activeTab === 'deposits'
                    ? 'bg-white text-blue-600 border-t-2 border-x border-b-0 border-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Bank Deposit Ledger History</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('expenses');
                  setSearchParams({ tab: 'expenses' });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer ${
                  activeTab === 'expenses'
                    ? 'bg-white text-blue-600 border-t-2 border-x border-b-0 border-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Cash Expenditure History</span>
              </button>
            </div>

            <div className="p-6">
              {/* TAB 1: PRO DEPOSIT REQUESTS */}
              {activeTab === 'requests' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-500">Status:</span>
                        <select
                          value={reqFilters.status}
                          onChange={(e) => setReqFilters({ ...reqFilters, status: e.target.value })}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-xs focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="all">All Statuses</option>
                          <option value="pending">Pending Approval</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-500">Date From:</span>
                        <input
                          type="date"
                          value={reqFilters.date_from}
                          onChange={(e) => setReqFilters({ ...reqFilters, date_from: e.target.value })}
                          className="px-2 py-1 rounded-xl border border-slate-200 bg-white font-medium text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-500">Date To:</span>
                        <input
                          type="date"
                          value={reqFilters.date_to}
                          onChange={(e) => setReqFilters({ ...reqFilters, date_to: e.target.value })}
                          className="px-2 py-1 rounded-xl border border-slate-200 bg-white font-medium text-xs"
                        />
                      </div>
                    </div>

                    <button
                      onClick={fetchRequests}
                      disabled={loadingRequests}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Requests Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Request ID</th>
                          <th className="py-3 px-4">PRO / Requester</th>
                          <th className="py-3 px-4">Branch</th>
                          <th className="py-3 px-4 text-right">Amount (₹)</th>
                          <th className="py-3 px-4">Request Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Challan / Ref</th>
                          <th className="py-3 px-4">Remarks</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingRequests ? (
                          <tr>
                            <td colSpan="9" className="text-center py-8 text-slate-400">
                              <LoadingSpinner label="Loading deposit requests..." />
                            </td>
                          </tr>
                        ) : depositRequests.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="text-center py-8 text-slate-400">
                              No deposit requests matching current criteria.
                            </td>
                          </tr>
                        ) : (
                          depositRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                                #DR-{String(req.id).padStart(6, '0')}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-800">{req.requester_name || 'PRO'}</div>
                                {req.requester_employee_id && (
                                  <div className="text-[10px] text-slate-400 font-mono">{req.requester_employee_id}</div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                <span className="font-medium">{req.branch_name}</span>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                                {formatCurrency(req.requested_amount)}
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                {req.request_date}
                              </td>
                              <td className="py-3.5 px-4">
                                {req.status === 'pending' && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                    PENDING
                                  </span>
                                )}
                                {req.status === 'approved' && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                                    APPROVED
                                  </span>
                                )}
                                {req.status === 'rejected' && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200" title={req.rejection_reason}>
                                    REJECTED
                                  </span>
                                )}
                                {req.status === 'completed' && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    COMPLETED
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                                {req.challan_reference || '—'}
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={req.remarks || ''}>
                                {req.remarks || '—'}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {req.status === 'pending' ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setIsReviewModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                                      title="Review Request"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Review</span>
                                    </button>
                                    <button
                                      onClick={() => handleApprove(req)}
                                      disabled={processingAction}
                                      className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
                                      title="Quick Approve"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setIsRejectModalOpen(true);
                                      }}
                                      disabled={processingAction}
                                      className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition cursor-pointer"
                                      title="Reject"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setSelectedRequest(req);
                                      setIsReviewModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 text-slate-500 hover:text-slate-800 font-medium text-xs rounded-lg transition cursor-pointer"
                                  >
                                    View Details
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: BANK DEPOSIT LEDGER HISTORY (SUPER ADMIN + PRO DISTINGUISHED) */}
              {activeTab === 'deposits' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date From</label>
                      <input
                        type="date"
                        value={depFilters.date_from}
                        onChange={(e) => setDepFilters({ ...depFilters, date_from: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date To</label>
                      <input
                        type="date"
                        value={depFilters.date_to}
                        onChange={(e) => setDepFilters({ ...depFilters, date_to: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Deposit Type</label>
                      <select
                        value={depFilters.deposit_type}
                        onChange={(e) => setDepFilters({ ...depFilters, deposit_type: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      >
                        <option value="all">All Types</option>
                        <option value="SUPER_ADMIN">Super Admin Deposit</option>
                        <option value="PRO">PRO Deposit</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PRO Filter</label>
                      <select
                        value={depFilters.pro_id}
                        onChange={(e) => setDepFilters({ ...depFilters, pro_id: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      >
                        <option value="all">All PROs</option>
                        {proUsersList.map((u) => (
                          <option key={u.user_id} value={u.user_id}>
                            {u.full_name} ({u.employee_id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Branch</label>
                      <select
                        value={depFilters.branch_id}
                        onChange={(e) => setDepFilters({ ...depFilters, branch_id: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      >
                        <option value="all">All Branches</option>
                        {branchesList.map((b) => (
                          <option key={b.branch_id} value={b.branch_id}>
                            {b.branch_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={fetchDepositHistory}
                        disabled={loadingHistory}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                        <span>Filter</span>
                      </button>
                    </div>
                  </div>

                  {/* History Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Deposit ID</th>
                          <th className="py-3 px-4">Deposit Type</th>
                          <th className="py-3 px-4 text-right">Amount (₹)</th>
                          <th className="py-3 px-4">Requested By</th>
                          <th className="py-3 px-4">Approved By</th>
                          <th className="py-3 px-4">Completed By</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Challan / Ref #</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingHistory ? (
                          <tr>
                            <td colSpan="9" className="text-center py-8 text-slate-400">
                              <LoadingSpinner label="Loading bank deposit ledger..." />
                            </td>
                          </tr>
                        ) : depositHistory.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="text-center py-8 text-slate-400">
                              No deposit records matching filters.
                            </td>
                          </tr>
                        ) : (
                          depositHistory.map((d) => (
                            <tr key={d.deposit_id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3.5 px-4 text-slate-600 font-medium">
                                {d.deposit_date}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                                #DEP-{String(d.deposit_id).padStart(6, '0')}
                              </td>
                              <td className="py-3.5 px-4">
                                {d.deposit_type === 'PRO' ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                    PRO Deposit
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                                    Super Admin Deposit
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                                {formatCurrency(d.amount)}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700 font-medium">
                                {d.requested_by_name || (d.deposit_type === 'SUPER_ADMIN' ? 'Super Admin' : '—')}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700 font-medium">
                                {d.approved_by_name || (d.deposit_type === 'SUPER_ADMIN' ? 'Super Admin (Self)' : '—')}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700 font-medium">
                                {d.completed_by_name || '—'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Completed</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                                {d.challan_reference || '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: CASH EXPENDITURE HISTORY */}
              {activeTab === 'expenses' && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date From</label>
                      <input
                        type="date"
                        value={expFilters.date_from}
                        onChange={(e) => setExpFilters({ ...expFilters, date_from: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date To</label>
                      <input
                        type="date"
                        value={expFilters.date_to}
                        onChange={(e) => setExpFilters({ ...expFilters, date_to: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                      <select
                        value={expFilters.category}
                        onChange={(e) => setExpFilters({ ...expFilters, category: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      >
                        <option value="all">All Categories</option>
                        {expenseCategoriesList.map((c) => (
                          <option key={c.id || c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Entered By / PRO</label>
                      <select
                        value={expFilters.pro_id}
                        onChange={(e) => setExpFilters({ ...expFilters, pro_id: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium"
                      >
                        <option value="all">All Users</option>
                        {proUsersList.map((u) => (
                          <option key={u.user_id} value={u.user_id}>
                            {u.full_name} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={fetchExpendituresList}
                        disabled={loadingExpList}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingExpList ? 'animate-spin' : ''}`} />
                        <span>Filter Expenses</span>
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Expense ID</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Entered By</th>
                          <th className="py-3 px-4">Branch</th>
                          <th className="py-3 px-4 text-right">Amount (₹)</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Description / Voucher</th>
                          <th className="py-3 px-4">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingExpList ? (
                          <tr>
                            <td colSpan="8" className="text-center py-8 text-slate-400">
                              <LoadingSpinner label="Loading cash expenditures..." />
                            </td>
                          </tr>
                        ) : expendituresList.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="text-center py-8 text-slate-400">
                              No cash expenditures found.
                            </td>
                          </tr>
                        ) : (
                          expendituresList.map((exp) => (
                            <tr key={exp.expense_id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                                #EXP-{String(exp.expense_id).padStart(6, '0')}
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 font-medium">
                                {exp.expense_date}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-slate-800">{exp.entered_by_name || 'Staff'}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">({exp.entered_by_role || 'user'})</span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                {exp.branch_name}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-black text-red-700 text-sm">
                                {formatCurrency(exp.amount)}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-slate-700">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px]">
                                  {exp.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={exp.description || ''}>
                                {exp.description || '—'}
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={exp.remarks || ''}>
                                {exp.remarks || '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review / Approval Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedRequest(null);
        }}
        title={`Review PRO Deposit Request #DR-${String(selectedRequest?.id || '').padStart(6, '0')}`}
        maxWidth="max-w-lg"
      >
        {selectedRequest && (
          <div className="space-y-4 text-xs text-slate-700">
            {/* Warning Callout per Section 13 */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Physical Verification Mandatory</span>
                <span className="text-[11px] text-amber-800">
                  Verify the physical cash amount in the branch drawer before approving this deposit.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">PRO Name</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{selectedRequest.requester_name}</span>
                {selectedRequest.requester_employee_id && (
                  <span className="text-[10px] font-mono text-slate-400">({selectedRequest.requester_employee_id})</span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Branch</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{selectedRequest.branch_name}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Requested Amount</span>
                <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                  {formatCurrency(selectedRequest.requested_amount)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Request Date</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block">{selectedRequest.request_date}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Bank Challan / Ref</span>
                <span className="text-xs font-mono text-slate-800 mt-0.5 block">{selectedRequest.challan_reference || '—'}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Status</span>
                <span className="text-xs font-bold uppercase text-slate-800 mt-0.5 block">{selectedRequest.status}</span>
              </div>
            </div>

            {selectedRequest.remarks && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">PRO Remarks</span>
                <p className="text-xs text-slate-700 mt-0.5">{selectedRequest.remarks}</p>
              </div>
            )}

            {selectedRequest.rejection_reason && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                <span className="text-[10px] text-red-700 font-bold uppercase block">Rejection Reason</span>
                <p className="text-xs text-red-900 mt-0.5">{selectedRequest.rejection_reason}</p>
              </div>
            )}

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setSelectedRequest(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
              >
                Cancel
              </button>

              {selectedRequest.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRejectModalOpen(true);
                    }}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl border border-red-200 transition cursor-pointer"
                  >
                    Reject Request
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={processingAction}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {processingAction ? 'Approving...' : 'Approve Deposit'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false);
          setRejectionReason('');
        }}
        title="Reject Deposit Request"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRejectConfirm} className="space-y-4 text-xs text-slate-700">
          <p className="text-slate-600">
            Please provide a specific reason for rejecting this PRO deposit request. The PRO will see this reason in their portal.
          </p>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Rejection Reason *
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Cash amount does not match physical drawer count."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsRejectModalOpen(false);
                setRejectionReason('');
              }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processingAction || !rejectionReason.trim()}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {processingAction ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>

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
              min="1"
              step="0.01"
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
              {expenseCategoriesList.length > 0 ? (
                <>
                  {expenseCategoriesList.map(ec => (
                    <option key={ec.id || ec.name} value={ec.name}>{ec.name}</option>
                  ))}
                  {expForm.expense_category && !expenseCategoriesList.some(ec => ec.name === expForm.expense_category) && (
                    <option value={expForm.expense_category}>{expForm.expense_category}</option>
                  )}
                </>
              ) : (
                <>
                  <option value="Clinic Supplies">Clinic Supplies</option>
                  <option value="Hospital Maintenance">Hospital Maintenance</option>
                  <option value="Refreshments">Refreshments</option>
                  <option value="Travel & Transport">Travel &amp; Transport</option>
                  <option value="Office Stationery">Office Stationery</option>
                </>
              )}
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

      {/* Modal: Bank Deposit (Super Admin Direct Deposit) */}
      <Modal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        title="Record Bank Cash Deposit (Super Admin Direct Deposit)"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateDeposit} className="space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900">
            <span>Available cash in drawer: </span>
            <span className="font-mono font-bold">{formatCurrency(ledger?.available_cash)}</span>
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Deposit Amount (₹) *</label>
            <input
              type="number"
              required
              min="1"
              step="0.01"
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
              {savingDep ? 'Saving...' : 'Record Direct Deposit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
