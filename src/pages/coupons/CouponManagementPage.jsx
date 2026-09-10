import React, { useState, useEffect, useCallback } from 'react';
import { couponsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { CreateCouponModal } from './CreateCouponModal';
import { CouponDetailsModal } from './CouponDetailsModal';
import { EditCouponModal } from './EditCouponModal';
import {
  Ticket,
  Percent,
  IndianRupee,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  Edit3,
  Power,
  Ban,
  Copy,
  Check,
  Calendar,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Tag,
  Gift
} from 'lucide-react';

export const CouponManagementPage = () => {
  const { showToast } = useToast();

  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState({
    total_coupons: 0,
    active_coupons: 0,
    redeemed_coupons: 0,
    expired_coupons: 0,
    total_discount_given: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailsCouponId, setDetailsCouponId] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        discount_type: typeFilter !== 'all' ? typeFilter : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      };
      const res = await couponsApi.getCoupons(params);
      if (res.success && res.data) {
        setCoupons(res.data.items || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
      showToast(err.message || 'Failed to load coupons', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, fromDate, toDate, showToast]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Code "${code}" copied!`, 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggleStatus = async (coupon) => {
    if (coupon.status === 'redeemed') {
      showToast('Redeemed coupons cannot be altered', 'warning');
      return;
    }
    const newStatus = coupon.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await couponsApi.updateStatus(coupon.id, newStatus);
      if (res.success) {
        showToast(`Coupon marked as ${newStatus}`, 'success');
        fetchCoupons();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleCancelCoupon = async (coupon) => {
    if (coupon.status === 'redeemed') {
      showToast('Redeemed coupons cannot be cancelled', 'warning');
      return;
    }
    if (!window.confirm(`Are you sure you want to cancel coupon "${coupon.coupon_code}"?`)) {
      return;
    }
    try {
      const res = await couponsApi.updateStatus(coupon.id, 'cancelled');
      if (res.success) {
        showToast('Coupon cancelled successfully', 'success');
        fetchCoupons();
      }
    } catch (err) {
      showToast(err.message || 'Failed to cancel coupon', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      active: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
      inactive: { bg: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
      redeemed: { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
      expired: { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
      cancelled: { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
    };
    const c = config[status] || config.inactive;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${c.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shadow-2xs">
              <Ticket className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Coupon Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Create, manage and track patient referral coupons and discounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchCoupons()}
            className="p-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-colors shadow-2xs cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Create Coupon</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Coupons */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Coupons
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {stats.total_coupons}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Ticket className="w-5 h-5" />
          </div>
        </div>

        {/* Active Coupons */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Coupons
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {stats.active_coupons}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Gift className="w-5 h-5" />
          </div>
        </div>

        {/* Redeemed Coupons */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Redeemed
            </span>
            <span className="text-2xl font-black text-purple-600 mt-1 block">
              {stats.redeemed_coupons}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Total Discount Applied */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Discount Given
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              ₹{stats.total_discount_given.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          {[
            { id: 'all', label: 'All Coupons' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' },
            { id: 'redeemed', label: 'Redeemed' },
            { id: 'expired', label: 'Expired' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Controls Row: Search + Type Filter + Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by code, patient name, mobile, referred..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Discount Type */}
          <div className="sm:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-700"
            >
              <option value="all">All Discount Types</option>
              <option value="percentage">Percentage Discount (%)</option>
              <option value="cash">Cash Discount (₹)</option>
            </select>
          </div>

          {/* Date Filter: From Date */}
          <div className="sm:col-span-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              title="Filter from valid date"
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700"
            />
          </div>

          {/* Date Filter: To Date */}
          <div className="sm:col-span-2">
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              title="Filter to valid date"
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-xs font-semibold text-slate-500">Loading coupons registry...</span>
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
              <Ticket className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No coupons found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your search query or filters to find coupons.'
                : 'Get started by creating your first patient referral coupon reward.'}
            </p>
            {(!search && statusFilter === 'all' && typeFilter === 'all') && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Referral Coupon</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5 pl-5">Coupon Code</th>
                  <th className="p-3.5">Patient (Owner)</th>
                  <th className="p-3.5">Mobile</th>
                  <th className="p-3.5">Referred Patient</th>
                  <th className="p-3.5">Discount</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Valid From</th>
                  <th className="p-3.5">Valid Until</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created By</th>
                  <th className="p-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Coupon Code */}
                    <td className="p-3.5 pl-5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg text-xs">
                          {c.coupon_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(c.coupon_code)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                          title="Copy Code"
                        >
                          {copiedCode === c.coupon_code ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Patient (Owner) */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 text-xs">{c.referring_patient_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">UHID: {c.referring_patient_uhid}</div>
                    </td>

                    {/* Mobile */}
                    <td className="p-3.5 font-medium text-slate-600 text-xs">
                      {c.referring_patient_mobile || '—'}
                    </td>

                    {/* Referred Patient */}
                    <td className="p-3.5">
                      {c.referred_patient_name ? (
                        <div>
                          <div className="font-semibold text-slate-800 text-xs">{c.referred_patient_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">UHID: {c.referred_patient_uhid}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Open Referral</span>
                      )}
                    </td>

                    {/* Discount Value */}
                    <td className="p-3.5 font-bold text-slate-900 text-xs">
                      {c.discount_type === 'percentage' ? (
                        <span className="text-blue-700 font-black">
                          {c.discount_value}%
                          {c.max_discount_limit && (
                            <span className="text-[10px] font-normal text-slate-400 ml-1">
                              (Cap ₹{c.max_discount_limit})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-black">
                          ₹{parseFloat(c.discount_value).toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="p-3.5">
                      <span className="capitalize text-slate-600 font-medium text-xs">
                        {c.discount_type}
                      </span>
                    </td>

                    {/* Valid From */}
                    <td className="p-3.5 text-slate-600 text-xs whitespace-nowrap">
                      {c.valid_from}
                    </td>

                    {/* Valid Until */}
                    <td className="p-3.5 text-slate-600 text-xs whitespace-nowrap">
                      {c.valid_until}
                    </td>

                    {/* Status */}
                    <td className="p-3.5 whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>

                    {/* Created By & Date */}
                    <td className="p-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                      <div>{c.created_by_name || 'Admin'}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right pr-5 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details */}
                        <button
                          type="button"
                          onClick={() => setDetailsCouponId(c.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-blue-600 transition-colors"
                          title="View Details & Redemptions"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit (disabled if redeemed) */}
                        {c.status !== 'redeemed' && (
                          <button
                            type="button"
                            onClick={() => setEditingCoupon(c)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-indigo-600 transition-colors"
                            title="Edit Coupon"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Activate / Deactivate Toggle */}
                        {c.status !== 'redeemed' && c.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(c)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              c.status === 'active'
                                ? 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                                : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                            }`}
                            title={c.status === 'active' ? 'Deactivate Coupon' : 'Activate Coupon'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Cancel */}
                        {c.status !== 'redeemed' && c.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleCancelCoupon(c)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Cancel Coupon"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && coupons.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-800">{coupons.length}</span> of{' '}
              <span className="font-bold text-slate-800">{pagination.total}</span> total coupons
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors inline-flex items-center gap-1 cursor-pointer font-semibold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="px-3 font-semibold text-slate-700">
                Page {page} of {pagination.totalPages || 1}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors inline-flex items-center gap-1 cursor-pointer font-semibold"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Coupon Modal */}
      <CreateCouponModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCouponCreated={() => {
          fetchCoupons();
        }}
      />

      {/* Coupon Details Modal */}
      <CouponDetailsModal
        isOpen={Boolean(detailsCouponId)}
        onClose={() => setDetailsCouponId(null)}
        couponId={detailsCouponId}
      />

      {/* Edit Coupon Modal */}
      <EditCouponModal
        isOpen={Boolean(editingCoupon)}
        onClose={() => setEditingCoupon(null)}
        coupon={editingCoupon}
        onCouponUpdated={() => {
          fetchCoupons();
        }}
      />
    </div>
  );
};
