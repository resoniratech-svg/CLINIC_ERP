import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  PhoneCall,
  PhoneIncoming,
  PhoneForwarded,
  CheckCircle2,
  Users2,
  CalendarClock,
  HeartHandshake,
  UserX,
  CalendarCheck,
  Coins,
  ArrowUpRight,
  RefreshCw,
  Search,
  Clock,
  Headphones,
  UserPlus
} from 'lucide-react';

export const ExecutiveDashboard = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [quickMobile, setQuickMobile] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await executiveApi.getDashboard();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        showToast('Failed to load dashboard metrics', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error fetching dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  if (loading && !data) {
    return (
      <div className="py-20">
        <LoadingSpinner label="Loading Executive performance metrics..." />
      </div>
    );
  }

  const incentive = data?.incentive || {};
  const perLeadIncentive = incentive.per_lead_incentive || 100;
  const leadsGenerated = incentive.leads_generated || data?.leads_created || 0;
  const currentIncentive = incentive.current_incentive !== undefined ? incentive.current_incentive : leadsGenerated * perLeadIncentive;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Executive Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
              Call Center
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, <strong className="text-slate-800">{user?.full_name || 'Executive'}</strong> • Daily call engagements, lead conversion & incentive tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/executive/calls/inbound"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <PhoneIncoming className="w-3.5 h-3.5" />
            <span>Inbound Search</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Primary 3 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Calls Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Calls Handled Today
            </span>
            <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
              {data?.calls_today || 0}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span>Connected:</span>
              <strong className="text-blue-700">{data?.connected || 0}</strong>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <PhoneCall className="w-6 h-6" />
          </div>
        </div>

        {/* Connected Calls */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Connected Calls
            </span>
            <div className="text-3xl font-black text-emerald-600 tracking-tight font-mono">
              {data?.connected || 0}
            </div>
            <div className="text-[11px] text-slate-500">
              Connection Rate:{' '}
              <strong className="text-slate-800">
                {data?.calls_today > 0 ? `${Math.round((data.connected / data.calls_today) * 100)}%` : '0%'}
              </strong>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Leads Created Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Leads Generated (Today)
            </span>
            <div className="text-3xl font-black text-indigo-600 tracking-tight font-mono">
              {data?.leads_created || 0}
            </div>
            <div className="text-[11px] text-slate-500">
              Handoff to Receptionist: <strong className="text-indigo-700">{data?.leads_created || 0}</strong>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Secondary Detailed Breakdown Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Inbound */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Inbound</span>
            <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{data?.inbound || 0}</div>
          <span className="text-[10px] text-slate-400 block">Patient Callers</span>
        </div>

        {/* Outbound */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Outbound</span>
            <PhoneForwarded className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">{data?.outbound || 0}</div>
          <span className="text-[10px] text-slate-400 block">Excel & Queue</span>
        </div>

        {/* Callbacks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Callbacks</span>
            <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 font-mono">{data?.callbacks || 0}</div>
          <span className="text-[10px] text-slate-400 block">Scheduled Tasks</span>
        </div>

        {/* Interested */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Interested</span>
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-600 font-mono">{data?.interested || 0}</div>
          <span className="text-[10px] text-slate-400 block">Converted to Lead</span>
        </div>

        {/* Not Interested */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Not Interested</span>
            <UserX className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-xl font-bold text-slate-600 font-mono">{data?.not_interested || 0}</div>
          <span className="text-[10px] text-slate-400 block">Archived Calls</span>
        </div>

        {/* Appointments Converted */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Appointments</span>
            <CalendarCheck className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-purple-700 font-mono">{data?.appointments_converted || 0}</div>
          <span className="text-[10px] text-slate-400 block">Doctor Bookings</span>
        </div>
      </div>

      {/* 4. Incentive & Monthly Performance Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-indigo-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold border border-white/10">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Current Month Incentive Earnings</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Earn {formatCurrency(perLeadIncentive)} per Generated Lead
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every qualified lead generated via Inbound or Outbound calls automatically credits to your official monthly incentive report upon handoff to the Receptionist queue.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 text-center min-w-[240px] space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-300 font-bold">
              Month Total Earned
            </div>
            <div className="text-3xl font-black text-amber-400 font-mono">
              {formatCurrency(currentIncentive)}
            </div>
            <div className="text-[11px] text-slate-300">
              <span className="font-bold text-white">{leadsGenerated}</span> Leads × <span className="font-bold text-white">{formatCurrency(perLeadIncentive)}</span>
            </div>
            <Link
              to="/executive/incentives"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-white text-indigo-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer mt-2"
            >
              <span>View Incentive Breakdown</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Fast Action Shortcuts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quick Inbound Search */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <PhoneIncoming className="w-4 h-4 text-emerald-600" />
            <span>Instant Inbound Patient Lookup</span>
          </div>
          <p className="text-xs text-slate-500">
            Caller on phone? Enter their 10-digit mobile to view existing history or create a new lead immediately.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={quickMobile}
              onChange={(e) => setQuickMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Link
              to={`/executive/calls/inbound?mobile=${quickMobile}`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Outbound Calling Queue Shortcut */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <PhoneForwarded className="w-4 h-4 text-blue-600" />
              <span>Outbound Calling Queue</span>
            </div>
            <p className="text-xs text-slate-500">
              Access your campaign leads list, click to call, and log outcomes with 1-click lead conversion.
            </p>
          </div>
          <Link
            to="/executive/outbound/queue"
            className="py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <span>Open Calling Queue</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Scheduled Callbacks Shortcut */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              <span>Pending Callbacks ({data?.callbacks || 0})</span>
            </div>
            <p className="text-xs text-slate-500">
              Patients who requested a follow-up call today or this week. Stay on top of commitments.
            </p>
          </div>
          <Link
            to="/executive/callbacks"
            className="py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <span>View Scheduled Callbacks</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
