import React, { useEffect, useState } from 'react';
import { targetsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { Target, TrendingUp, DollarSign, Award, CheckCircle2, AlertCircle } from 'lucide-react';

export const TargetManagementPage = () => {
  const [targetData, setTargetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [form, setForm] = useState({
    enquiry_target: 200000,
    unit_target: 300000,
    overall_target: 500000,
  });

  const { showToast } = useToast();

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const res = await targetsApi.getTargets({ month, year });
      if (res.success && res.data) {
        setTargetData(res.data);
        setForm({
          enquiry_target: res.data.enquiry?.target || 0,
          unit_target: res.data.unit?.target || 0,
          overall_target: res.data.overall?.target || 0,
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch targets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, [month, year]);

  const handleEnquiryChange = (val) => {
    const enq = parseFloat(val) || 0;
    setForm((prev) => ({
      ...prev,
      enquiry_target: enq,
      overall_target: enq + prev.unit_target,
    }));
  };

  const handleUnitChange = (val) => {
    const unit = parseFloat(val) || 0;
    setForm((prev) => ({
      ...prev,
      unit_target: unit,
      overall_target: prev.enquiry_target + unit,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await targetsApi.setTarget({
        month,
        year,
        overall_target: form.overall_target,
        enquiry_target: form.enquiry_target,
        unit_target: form.unit_target,
      });

      if (res.success) {
        showToast('Monthly hospital targets updated successfully', 'success');
        fetchTargets();
      }
    } catch (err) {
      showToast(err.message || 'Failed to save targets', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-red-600" />
            <span>Monthly Target Allocation Matrix</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict Formula Governance: <strong className="text-slate-800">Enquiry Target + Unit Target = Overall Target</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500"
          >
            {[
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ].map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-20 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading target quotas and progress..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Progress / Status Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Target Achievement Progress ({month}/{year})
                  </h3>
                  <span className="text-xs text-slate-400">Real-time revenue conversion tracking</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-blue-700 font-mono">
                    {targetData?.overall?.achievement_pct || 0}%
                  </span>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Achieved</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-red-600 h-3.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(targetData?.overall?.achievement_pct || 0, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Quota</span>
                  <span className="text-lg font-bold text-slate-900 font-mono mt-1 block">
                    {formatCurrency(targetData?.overall?.target)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Achieved Revenue</span>
                  <span className="text-lg font-bold text-emerald-900 font-mono mt-1 block">
                    {formatCurrency(targetData?.overall?.achieved)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
                  <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block">Remaining Balance</span>
                  <span className="text-lg font-bold text-red-900 font-mono mt-1 block">
                    {formatCurrency(targetData?.overall?.remaining)}
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase">Enquiry Target (New)</span>
                  <span className="text-xs font-mono font-bold text-blue-700">{targetData?.enquiry?.achievement_pct || 0}%</span>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">{formatCurrency(targetData?.enquiry?.target)}</div>
                <div className="text-xs text-slate-500 flex justify-between pt-2 border-t border-slate-100">
                  <span>Achieved: <strong>{formatCurrency(targetData?.enquiry?.achieved)}</strong></span>
                  <span>Rem: <strong>{formatCurrency(targetData?.enquiry?.remaining)}</strong></span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-900 uppercase">Unit Target (Existing)</span>
                  <span className="text-xs font-mono font-bold text-red-700">{targetData?.unit?.achievement_pct || 0}%</span>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">{formatCurrency(targetData?.unit?.target)}</div>
                <div className="text-xs text-slate-500 flex justify-between pt-2 border-t border-slate-100">
                  <span>Achieved: <strong>{formatCurrency(targetData?.unit?.achieved)}</strong></span>
                  <span>Rem: <strong>{formatCurrency(targetData?.unit?.remaining)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Form Column */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Allocate Targets for {month}/{year}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-blue-950 uppercase text-[11px] mb-1">
                  1. Enquiry Target (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={form.enquiry_target}
                  onChange={(e) => handleEnquiryChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Allocated for new patient walk-ins & incoming enquiries</span>
              </div>

              <div>
                <label className="block font-bold text-red-950 uppercase text-[11px] mb-1">
                  2. Unit Target (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={form.unit_target}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Allocated for renewals, referrals, due collections & ACQ</span>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  3. Computed Overall Target (₹)
                </span>
                <div className="text-xl font-black text-blue-950 font-mono mt-1">
                  {formatCurrency(form.overall_target)}
                </div>
                <span className="text-[10px] text-blue-700 mt-1 block">
                  Auto-calculated via Enquiry Target + Unit Target formula
                </span>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save & Publish Targets'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
