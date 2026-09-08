import React, { useEffect, useState } from 'react';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { Target, TrendingUp, RefreshCw } from 'lucide-react';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

const TargetCard = ({ label, target, achieved, remaining, pct, color, unit }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-slate-900">{label}</h3>
      <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
        pct >= 100 ? 'bg-emerald-100 text-emerald-700' : pct >= 75 ? 'bg-blue-100 text-blue-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
      }`}>{pct}%</span>
    </div>

    <div className="space-y-2">
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <div className="font-black text-slate-900">{unit === 'currency' ? formatCurrency(achieved) : achieved}</div>
          <div className="text-[10px] text-slate-500">Achieved</div>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <div className="font-black text-slate-900">{unit === 'currency' ? formatCurrency(target) : target}</div>
          <div className="text-[10px] text-slate-500">Target</div>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <div className="font-black text-slate-900">{unit === 'currency' ? formatCurrency(remaining) : remaining}</div>
          <div className="text-[10px] text-slate-500">Remaining</div>
        </div>
      </div>
    </div>
  </div>
);

export const DoctorTargetsPage = () => {
  const { showToast } = useToast();
  const [targets, setTargets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await doctorApi.getMyTargets({ month, year });
      if (res.success) setTargets(res.data);
    } catch {
      showToast('Failed to load targets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [month, year]);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = [2023, 2024, 2025, 2026, 2027];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-600" /> My Targets
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">View-only: Target performance overview (managed by Super Admin)</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none bg-white">
            {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none bg-white">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetch} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200">
            <RefreshCw className="w-3.5 h-3.5" /> Load
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading target data..." />
      ) : !targets ? (
        <div className="text-center py-12 text-slate-400">No target data available</div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 font-medium">
            📊 {months[targets.month - 1]} {targets.year} — Targets are set by Super Admin. You can only view your performance here.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TargetCard
              label="Revenue Target"
              target={targets.revenue_target.target}
              achieved={targets.revenue_target.achieved}
              remaining={targets.revenue_target.remaining}
              pct={targets.revenue_target.achievement_pct}
              color="bg-emerald-500"
              unit="currency"
            />
            <TargetCard
              label="Unit Target"
              target={targets.unit_target.target}
              achieved={targets.unit_target.achieved}
              remaining={targets.unit_target.remaining}
              pct={targets.unit_target.achievement_pct}
              color="bg-blue-500"
              unit="currency"
            />
            <TargetCard
              label="New Patient Referrals"
              target={targets.referral_target.target}
              achieved={targets.referral_target.achieved}
              remaining={targets.referral_target.remaining}
              pct={targets.referral_target.achievement_pct}
              color="bg-purple-500"
              unit="count"
            />
          </div>
        </div>
      )}
    </div>
  );
};
