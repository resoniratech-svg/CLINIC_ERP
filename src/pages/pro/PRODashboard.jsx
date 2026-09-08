import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Clock,
  CheckCircle,
  Receipt,
  DollarSign,
  TrendingUp,
  PhoneCall,
  CalendarCheck,
  Target,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Building,
  AlertCircle
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

export const PRODashboard = () => {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await proApi.getDashboard();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load PRO dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading PRO dashboard metrics..." />;
  }

  const d = data || {
    pro_pending: 0,
    in_progress: 0,
    completed_today: 0,
    pending_bills: 0,
    todays_cash: 0,
    todays_revenue: 0,
    due_amount: 0,
    callbacks: 0,
    followups: 0,
    targets: { revenue_target: 0, revenue_achieved: 0, unit_target: 0, unit_achieved: 0 }
  };

  const revTarget = d.targets?.revenue_target || 0;
  const revAchieved = d.targets?.revenue_achieved || 0;
  const revPct = revTarget > 0 ? Math.min(100, Math.round((revAchieved / revTarget) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#1565C0] flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>
            <span>PRO / Manager Dashboard</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time patient flow, financial collection, target attribution, and CRM status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            to="/pro/queue"
            className="flex items-center gap-1.5 px-4 py-2 btn-brand-gradient font-bold text-xs rounded-xl shadow-xs transition"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Patient Queue</span>
          </Link>
        </div>
      </div>

      {/* Row 1: Patient Flow Metric Cards */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Patient Pipeline (Doctor Completed → PRO Completed)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/pro/queue?status=pending"
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#1565C0] transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">PRO Pending</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black text-slate-900">{d.pro_pending}</div>
              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                Awaiting PRO
              </span>
            </div>
          </Link>

          <Link
            to="/pro/queue?status=in_progress"
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#1565C0] transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">In Progress</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1565C0] flex items-center justify-center">
                <RefreshCw className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black text-slate-900">{d.in_progress}</div>
              <span className="text-[10px] text-[#1565C0] font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                Active Session
              </span>
            </div>
          </Link>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Completed Today</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black text-slate-900">{d.completed_today}</div>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                Sent to Pharmacy
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Financial Metrics */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Financial Status & Cash Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/pro/billing/pending"
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#D32F2F] transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Pending Bills</span>
              <div className="w-8 h-8 rounded-xl bg-red-50 text-[#D32F2F] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-black text-slate-900">{d.pending_bills}</div>
              <span className="text-[10px] text-slate-400">Invoices</span>
            </div>
          </Link>

          <Link
            to="/pro/accountant/cash-revenue"
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Today's Cash</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-700">{formatCurrency(d.todays_cash)}</div>
              <span className="text-[10px] text-slate-400">Physical Cash only</span>
            </div>
          </Link>

          <Link
            to="/pro/accountant/grand-total"
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#1565C0] transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Today's Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1565C0] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-[#1565C0]">{formatCurrency(d.todays_revenue)}</div>
              <span className="text-[10px] text-slate-400">All payment modes (Grand Total)</span>
            </div>
          </Link>

          <Link
            to="/pro/payments/due-collection"
            className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#D32F2F] transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Total Outstanding Due</span>
              <div className="w-8 h-8 rounded-xl bg-red-50 text-[#D32F2F] flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-[#D32F2F]">{formatCurrency(d.due_amount)}</div>
              <span className="text-[10px] text-red-600 font-semibold">Action required</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Row 3: Target Summary & CRM Quick Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Doctor Revenue Target Card (Read-Only) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#1565C0]" />
              <h3 className="text-sm font-bold text-slate-900">Doctor Realized Targets</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1565C0] border border-blue-100">
              Current Month
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Revenue Realized:</span>
              <span className="font-black text-slate-900">{formatCurrency(revAchieved)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Monthly Target:</span>
              <span className="font-bold text-slate-700">{formatCurrency(revTarget)}</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1565C0] to-[#D32F2F] rounded-full transition-all duration-500"
                style={{ width: `${revPct}%` }}
              />
            </div>
            <div className="text-right text-[11px] font-bold text-[#1565C0]">
              {revPct}% Achieved
            </div>
          </div>

          <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
            Target attribution is credited upon realized paid revenue. Targets are view-only for PRO.
          </p>
        </div>

        {/* CRM Tasks Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-[#1565C0]" />
              <h3 className="text-sm font-bold text-slate-900">CRM & Calling Tasks</h3>
            </div>
            <Link to="/pro/crm/calls" className="text-xs text-[#1565C0] font-bold hover:underline">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/pro/tasks"
              className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition text-center"
            >
              <div className="text-xl font-black text-slate-900">{d.callbacks}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Pending Callbacks</div>
            </Link>
            <Link
              to="/pro/crm/followups"
              className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition text-center"
            >
              <div className="text-xl font-black text-slate-900">{d.followups}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Pending Follow-ups</div>
            </Link>
          </div>

          <div className="flex gap-2">
            <Link
              to="/pro/crm/renewals"
              className="flex-1 py-2 text-center text-xs font-bold text-[#1565C0] bg-blue-50 rounded-xl hover:bg-blue-100 transition"
            >
              Renewals Queue
            </Link>
            <Link
              to="/pro/crm/dues"
              className="flex-1 py-2 text-center text-xs font-bold text-[#D32F2F] bg-red-50 rounded-xl hover:bg-red-100 transition"
            >
              Due Reminders
            </Link>
          </div>
        </div>

        {/* Quick Operations Action Hub */}
        <div className="bg-gradient-to-br from-[#1565C0] via-[#0D47A1] to-[#D32F2F] text-white p-5 rounded-2xl shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-black">Quick Action Hub</h3>
            <p className="text-xs text-blue-100 mt-1">Direct access to primary PRO duties</p>
          </div>

          <div className="space-y-2">
            <Link
              to="/pro/queue"
              className="flex items-center justify-between px-3.5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition"
            >
              <span>1. Open Patient Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/pro/patients"
              className="flex items-center justify-between px-3.5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition"
            >
              <span>2. Patient 360° Overview</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/pro/billing/new"
              className="flex items-center justify-between px-3.5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition"
            >
              <span>3. Create New Bill</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/pro/accountant/daily-summary"
              className="flex items-center justify-between px-3.5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition"
            >
              <span>4. Day-End Cash Summary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
