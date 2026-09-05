import React, { useEffect, useState } from 'react';
import { billingApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { DollarSign, Calendar, TrendingUp, AlertCircle, ArrowUpRight } from 'lucide-react';

export const RevenueSummaryPage = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { showToast } = useToast();

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const res = await billingApi.getRevenueReport({
        start_date: startDate,
        end_date: endDate,
      });

      if (res.success && res.data) {
        setReport(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch revenue analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, [startDate, endDate]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const breakdown = report?.breakdown || report?.payment_method_breakdown || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span>Multichannel Revenue Surveillance & Grand Total</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict Formula: Grand Total = Cash + Card + UPI + Razorpay + Bajaj Pay
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-400 font-bold">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Auditing revenue collections across payment gateways..." />
      ) : (
        <div className="space-y-6">
          {/* Grand Total Hero Banner */}
          <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2 relative z-10">
              <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">
                Consolidated Collections
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                {formatCurrency(report?.grand_total)}
              </div>
              <p className="text-xs text-blue-200">
                Aggregated total across all confirmed patient payment transactions
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 relative z-10 text-right space-y-1">
              <span className="text-[11px] font-bold text-red-200 uppercase tracking-wider block">
                Outstanding Patient Dues
              </span>
              <span className="text-2xl font-black text-red-400 font-mono block">
                {formatCurrency(report?.outstanding_due)}
              </span>
              <span className="text-[10px] text-slate-300 block">Pending collection</span>
            </div>
          </div>

          {/* 5 Channel Breakdown Cards */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Payment Gateway Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs text-center space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cash</span>
                <span className="text-2xl font-black text-slate-900 font-mono block">{formatCurrency(breakdown.cash)}</span>
                <span className="text-[10px] text-slate-400">Physical Register</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs text-center space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Card</span>
                <span className="text-2xl font-black text-slate-900 font-mono block">{formatCurrency(breakdown.card)}</span>
                <span className="text-[10px] text-slate-400">POS Machine</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs text-center space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">UPI</span>
                <span className="text-2xl font-black text-slate-900 font-mono block">{formatCurrency(breakdown.upi)}</span>
                <span className="text-[10px] text-slate-400">QR / VPA</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs text-center space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Razorpay</span>
                <span className="text-2xl font-black text-slate-900 font-mono block">{formatCurrency(breakdown.razorpay)}</span>
                <span className="text-[10px] text-slate-400">Online Link</span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs text-center space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Bajaj Pay</span>
                <span className="text-2xl font-black text-slate-900 font-mono block">{formatCurrency(breakdown.bajaj_pay)}</span>
                <span className="text-[10px] text-slate-400">Healthcare EMI</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
