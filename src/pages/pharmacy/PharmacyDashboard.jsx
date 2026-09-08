import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Ban,
  Archive,
  RotateCcw,
  Boxes,
  PlusCircle,
  FileSpreadsheet,
  Users,
  Search,
  RefreshCw,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const PharmacyDashboard = () => {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardMetrics = async () => {
    setLoading(true);
    try {
      const res = await pharmacyApi.getDashboard();
      if (res.success && res.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load pharmacy dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading pharmacy operations dashboard..." />;
  }

  const kpis = [
    {
      title: 'Pending Rx',
      value: metrics?.pending_rx ?? 0,
      icon: ClipboardList,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      link: '/pharmacy/queue'
    },
    {
      title: 'Processing',
      value: metrics?.processing ?? 0,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      link: '/pharmacy/dispensing/processing'
    },
    {
      title: 'Dispensed Today',
      value: metrics?.dispensed_today ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      link: '/pharmacy/dispensing/dispensed'
    },
    {
      title: 'Low Stock',
      value: metrics?.low_stock ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      link: '/pharmacy/inventory/low-stock'
    },
    {
      title: 'Expiring Soon',
      value: metrics?.expiring ?? 0,
      icon: Calendar,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      link: '/pharmacy/inventory/expiring'
    },
    {
      title: 'Out of Stock',
      value: metrics?.out_of_stock ?? 0,
      icon: Archive,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      link: '/pharmacy/inventory/out-of-stock'
    },
    {
      title: 'Expired',
      value: metrics?.expired ?? 0,
      icon: Ban,
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      link: '/pharmacy/inventory/expired'
    },
    {
      title: 'Returns Today',
      value: metrics?.returns_today ?? 0,
      icon: RotateCcw,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      link: '/pharmacy/returns'
    },
    {
      title: 'Stock Quantity',
      value: metrics?.total_stock_quantity ?? 0,
      icon: Boxes,
      color: 'text-[#1565C0]',
      bg: 'bg-blue-50/60',
      border: 'border-blue-200',
      link: '/pharmacy/inventory/stock'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] inline-block" />
            <span>Pharmacy Operations Dashboard</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time prescription dispensing queue, FEFO inventory tracking, and stock compliance
          </p>
        </div>

        <button
          onClick={fetchDashboardMetrics}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Grid (3x3 matching specification) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={idx}
              to={kpi.link}
              className={`p-5 rounded-2xl border bg-white shadow-xs hover:shadow-md transition-all group flex items-center justify-between ${kpi.border}`}
            >
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {kpi.title}
                </span>
                <span className="text-2xl font-black text-slate-900 group-hover:text-[#1565C0] transition">
                  {kpi.value.toLocaleString()}
                </span>
              </div>
              <div className={`w-12 h-12 rounded-2xl ${kpi.bg} ${kpi.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1565C0]" />
          <span>Quick Operational Actions</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Link
            to="/pharmacy/queue"
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-300 text-center transition group"
          >
            <ClipboardList className="w-5 h-5 text-[#1565C0] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#1565C0]">Prescription Queue</span>
          </Link>

          <Link
            to="/pharmacy/queue"
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-emerald-50/60 hover:border-emerald-300 text-center transition group"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-emerald-700">Dispense Medicine</span>
          </Link>

          <Link
            to="/pharmacy/inventory/add-stock"
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-300 text-center transition group"
          >
            <PlusCircle className="w-5 h-5 text-[#1565C0] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#1565C0]">Add Stock</span>
          </Link>

          <Link
            to="/pharmacy/inventory/import-excel"
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-teal-50/60 hover:border-teal-300 text-center transition group"
          >
            <FileSpreadsheet className="w-5 h-5 text-teal-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-teal-700">Import Excel</span>
          </Link>

          <Link
            to="/pharmacy/inventory/stock"
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-purple-50/60 hover:border-purple-300 text-center transition group"
          >
            <Boxes className="w-5 h-5 text-purple-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-purple-700">Inventory</span>
          </Link>

          <Link
            to="/pharmacy/inventory/low-stock"
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-amber-50/60 hover:border-amber-300 text-center transition group"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-amber-700">Low Stock</span>
          </Link>

          <Link
            to="/pharmacy/inventory/expiring"
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-orange-50/60 hover:border-orange-300 text-center transition group"
          >
            <Calendar className="w-5 h-5 text-orange-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-orange-700">Expiring</span>
          </Link>

          <Link
            to="/pharmacy/patients"
            className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-center transition group"
          >
            <Search className="w-5 h-5 text-slate-600 mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 group-hover:text-slate-900">Search Patient</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
export default PharmacyDashboard;
