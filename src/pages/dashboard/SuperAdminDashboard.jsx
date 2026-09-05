import React, { useEffect, useState } from 'react';
import { dashboardApi } from '../../api';
import { StatCard } from '../../components/common/StatCard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Receipt,
  CreditCard,
  Banknote,
  Sparkles,
  PhoneCall,
  UserCheck,
  Package,
  Layers,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  ArrowRight,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const SuperAdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await dashboardApi.getDashboard();
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Compiling WeCare Hospital operational metrics..." size="lg" />;
  }

  const overview = data?.today_overview || {};
  const revenue = data?.revenue_today || {};
  const cashPos = data?.cash_position || {};
  const target = data?.monthly_target || {};
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="space-y-6">
      {/* Top Banner with WeCare Branding */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-red-600/20 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider">
              WeCare Homeopathy
            </span>
            <span className="text-blue-200 text-xs font-semibold">Karimnagar Main Branch (KRM001)</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Super Admin Operations Console
          </h1>
          <p className="text-xs text-blue-200 mt-1 italic">
            "We Care. We Heal. We Serve." — Real-Time Clinical & Financial Command Center
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-xs text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {/* Critical Surveillance Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-2 text-xs text-red-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-red-800 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>Immediate Operational Surveillance Alerts ({alerts.length})</span>
            </div>
            <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold uppercase tracking-wider">
              Action Required
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {alerts.map((alert, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-red-200/80">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="font-medium text-slate-800">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 1: Today's Clinical & Footfall Overview */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <span>Today's Hospital Footfall & Operational Activity</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <StatCard title="New Patients" value={overview.new_patients || 0} icon={UserCheck} color="blue" />
          <StatCard title="Appointments" value={overview.appointments || 0} icon={Calendar} color="indigo" />
          <StatCard title="Walk-ins" value={overview.walk_ins || 0} icon={ArrowUpRight} color="blue" />
          <StatCard title="New Enquiries" value={overview.new_enquiries || 0} icon={PhoneCall} color="purple" />
          <StatCard title="Lead Conversions" value={overview.conversions || 0} icon={Layers} color="emerald" />
          <StatCard title="Follow-ups Due" value={overview.followups_due || 0} icon={Activity} color="amber" />
          <StatCard title="Renewals" value={overview.renewals || 0} icon={TrendingUp} color="amber" />
          <StatCard title="ACQ Patients" value={overview.acq_patients || 0} icon={Sparkles} color="purple" />
          <StatCard title="Pending Dues Count" value={overview.due_patients_count || 0} icon={AlertTriangle} color="red" />
          <StatCard
            title="Pending Dues Total"
            value={formatCurrency(overview.due_patients_amount || 0)}
            icon={DollarSign}
            color="red"
          />
        </div>
      </div>

      {/* Section 2: Revenue by 5 Channels & Grand Total */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span>Today's Multichannel Revenue Breakdown</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict Formula: Grand Total = Cash + Card + UPI + Razorpay + Bajaj Pay
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-2xl flex items-center gap-3">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Grand Total:</span>
            <span className="text-xl font-black text-blue-900 font-mono">
              {formatCurrency(revenue.grand_total)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Physical Cash</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
              {formatCurrency(revenue.cash)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Credit / Debit Card</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
              {formatCurrency(revenue.card)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Direct UPI</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
              {formatCurrency(revenue.upi)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Razorpay Gateway</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
              {formatCurrency(revenue.razorpay)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Bajaj Pay Finance</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
              {formatCurrency(revenue.bajaj_pay)}
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Cash Position (Cash Drawer Formula) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>Cash Day-Closing Position (Physical Drawer Only)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Formula: Closing = Opening + Cash Rev - Cash Exp - Bank Deposit (Excludes Digital Payments)
            </p>
          </div>

          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            Closing: {formatCurrency(cashPos.closing_balance)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Opening Balance</span>
            <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(cashPos.opening_balance)}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">2. Cash Revenue (+)</span>
            <span className="text-base font-bold text-emerald-900 font-mono mt-0.5 block">{formatCurrency(cashPos.cash_revenue)}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-red-50/50 border border-red-200">
            <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block">3. Cash Expenditure (-)</span>
            <span className="text-base font-bold text-red-900 font-mono mt-0.5 block">{formatCurrency(cashPos.cash_expenditure)}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">4. Bank Deposit (-)</span>
            <span className="text-base font-bold text-blue-900 font-mono mt-0.5 block">{formatCurrency(cashPos.deposited_amount)}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">5. Final Closing</span>
            <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">{formatCurrency(cashPos.closing_balance)}</span>
          </div>
        </div>
      </div>

      {/* Section 4: Monthly Targets Overview */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-600" />
              <span>Monthly Target Progress (Overall = Enquiry + Unit)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enquiry: New Walk-ins & Calls • Unit: Existing, Renewals, Referrals, Dues
            </p>
          </div>
          <span className="text-sm font-black text-blue-700 font-mono">
            {target.overall_achievement_pct || 0}% Achieved
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 mb-5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-600 to-red-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(target.overall_achievement_pct || 0, 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Overall Target:</span>
              <span className="font-mono text-slate-900">{formatCurrency(target.overall_target)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-emerald-600 mt-1 font-medium">
              <span>Achieved:</span>
              <span className="font-mono font-bold">{formatCurrency(target.overall_achieved)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-red-600 mt-0.5 font-medium">
              <span>Remaining:</span>
              <span className="font-mono font-bold">{formatCurrency(target.overall_remaining)}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200">
            <div className="flex justify-between items-center text-xs font-bold text-blue-900">
              <span>Enquiry Target (New):</span>
              <span className="font-mono">{formatCurrency(target.enquiry_target)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-blue-700 mt-1 font-medium">
              <span>Achieved:</span>
              <span className="font-mono font-bold">{formatCurrency(target.enquiry_achieved)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-0.5 font-medium">
              <span>Target Quota:</span>
              <span className="font-mono font-bold">
                {target.enquiry_target > 0
                  ? `${Math.round((target.enquiry_achieved / target.enquiry_target) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-red-50/50 border border-red-200">
            <div className="flex justify-between items-center text-xs font-bold text-red-900">
              <span>Unit Target (Existing):</span>
              <span className="font-mono">{formatCurrency(target.unit_target)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-red-700 mt-1 font-medium">
              <span>Achieved:</span>
              <span className="font-mono font-bold">{formatCurrency(target.unit_achieved)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-0.5 font-medium">
              <span>Target Quota:</span>
              <span className="font-mono font-bold">
                {target.unit_target > 0
                  ? `${Math.round((target.unit_achieved / target.unit_target) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
