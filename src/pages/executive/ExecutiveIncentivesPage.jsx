import React, { useState, useEffect } from 'react';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Coins,
  Calendar,
  CheckCircle2,
  Users2,
  PhoneCall,
  TrendingUp,
  Award,
  RefreshCw,
  ShieldCheck,
  Building
} from 'lucide-react';

export const ExecutiveIncentivesPage = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const { showToast } = useToast();
  const { user } = useAuth();

  const fetchIncentives = async () => {
    setLoading(true);
    try {
      const res = await executiveApi.getIncentives({ month, year });
      if (res.success && res.data) {
        setData(res.data);
      } else {
        showToast('Failed to load incentive data', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error fetching incentive report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncentives();
  }, [month, year]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Executive Incentive Ledger
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
              {monthNames[month - 1]} {year}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Official monthly incentive earnings calculated automatically by Hospital ERP backend rule.
          </p>
        </div>

        {/* Month & Year Filter */}
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            {monthNames.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>

          <button
            onClick={fetchIncentives}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-20 bg-white rounded-2xl border border-slate-200/80">
          <LoadingSpinner label="Calculating monthly incentive performance..." />
        </div>
      ) : (
        <>
          {/* 2. Primary Earnings Hero Card */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white p-7 rounded-3xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold">
                <Award className="w-4 h-4 text-white" />
                <span>Executive Lead Generation Incentive</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">
                Total Incentive: {formatCurrency(data?.total_incentive_earned || 0)}
              </h2>
              <p className="text-xs text-amber-100 max-w-lg leading-relaxed">
                Calculated for <strong className="text-white">{user?.full_name}</strong> based on {data?.leads_generated || 0} qualified leads handed off to the Receptionist Lead Queue at {formatCurrency(data?.per_lead_incentive || 100)} / lead.
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur-md p-5 rounded-2xl border border-white/25 text-center min-w-[200px]">
              <span className="text-[10px] uppercase font-bold text-amber-100 block">
                Rate per Lead
              </span>
              <div className="text-3xl font-black font-mono mt-1">
                {formatCurrency(data?.per_lead_incentive || 100)}
              </div>
              <span className="text-[10px] text-amber-100 block mt-1">
                Configured by Super Admin
              </span>
            </div>
          </div>

          {/* 3. Performance Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Total Calls Handled */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Calls ({monthNames[month - 1]})
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {data?.total_calls || 0}
              </div>
              <p className="text-[10px] text-slate-400">Total caller interactions</p>
            </div>

            {/* Connected Calls */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Connected Calls
              </span>
              <div className="text-2xl font-black text-blue-600 font-mono">
                {data?.connected_calls || 0}
              </div>
              <p className="text-[10px] text-slate-400">Conversations held</p>
            </div>

            {/* Leads Generated */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Leads Generated
              </span>
              <div className="text-2xl font-black text-emerald-600 font-mono">
                {data?.leads_generated || 0}
              </div>
              <p className="text-[10px] text-slate-400">Eligible for incentive</p>
            </div>

            {/* Net Total Earnings */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Incentive Earned
              </span>
              <div className="text-2xl font-black text-amber-600 font-mono">
                {formatCurrency(data?.total_incentive_earned || 0)}
              </div>
              <p className="text-[10px] text-slate-400">{data?.leads_generated || 0} × {formatCurrency(data?.per_lead_incentive || 100)}</p>
            </div>
          </div>

          {/* 4. Policy & Audit Info Box */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Incentive Audit & Compliance Rules</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600">
              <li>Incentives are credited automatically when an Executive generates a qualified lead from Inbound or Outbound calls.</li>
              <li>Leads are routed immediately to the <strong>Receptionist Leads Queue</strong> for doctor assignment.</li>
              <li>Monthly incentive disbursements are processed alongside monthly payroll under Super Admin approval.</li>
              <li>Duplicate mobile numbers or invalid entries do not qualify for incentive credit.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
