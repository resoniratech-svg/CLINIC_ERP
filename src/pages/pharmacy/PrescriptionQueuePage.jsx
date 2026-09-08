import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pill,
  ArrowRight,
  Eye,
  User,
  Phone,
  Calendar,
  AlertCircle,
  XCircle,
  Check
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const PrescriptionQueuePage = () => {
  const { showToast } = useToast();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchQueue = useCallback(async (customSearch = searchTerm) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const trimmedSearch = customSearch.trim();
      if (trimmedSearch) params.search = trimmedSearch;

      const res = await pharmacyApi.getPrescriptionQueue(params);
      if (res.success) {
        setQueue(res.data || []);
      } else {
        setError(res.message || 'Failed to load prescription queue');
        showToast(res.message || 'Failed to load prescription queue', 'error');
      }
    } catch (err) {
      const msg = err.message || 'Error connecting to server';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, showToast]);

  useEffect(() => {
    fetchQueue();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchQueue(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    fetchQueue('');
  };

  // Instant client-side fallback filter for rapid search
  const filteredQueue = queue.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.patient_name?.toLowerCase().includes(term) ||
      String(item.patient_id).includes(term) ||
      String(item.registration_id || '').includes(term) ||
      String(item.prescription_id).includes(term) ||
      String(item.token_no || '').includes(term) ||
      item.mobile_number?.includes(term) ||
      item.doctor_name?.toLowerCase().includes(term)
    );
  });

  // Dynamic Status Badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'dispensed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Dispensed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" /> Processing
          </span>
        );
      case 'partially_dispensed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
            <AlertTriangle className="w-3 h-3" /> Partial
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
            <AlertCircle className="w-3 h-3" /> On Hold
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  // Dynamic PRO Status Badge
  const getProBadge = (proStatus) => {
    const st = proStatus || 'pro_completed';
    switch (st) {
      case 'pro_completed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            PRO: COMPLETED
          </span>
        );
      case 'pro_pending':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            PRO: PENDING
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            {st.replace('_', ' ').toUpperCase()}
          </span>
        );
    }
  };

  // Dynamic Payment Status Badge
  const getPaymentBadge = (payStatus) => {
    const st = payStatus || 'paid';
    switch (st) {
      case 'paid':
      case 'success':
      case 'created':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            PAID
          </span>
        );
      case 'partially_paid':
      case 'partial':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            PARTIAL
          </span>
        );
      case 'unpaid':
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            UNPAID
          </span>
        );
      case 'unbilled':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            UNBILLED
          </span>
        );
      case 'refunded':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            REFUNDED
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-200">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            {st.toUpperCase()}
          </span>
        );
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return { date: '—', time: '' };
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString('en-GB'), // DD/MM/YYYY
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  const statusFilterTabs = [
    { key: '', label: 'All Prescriptions' },
    { key: 'pending', label: 'Pending' },
    { key: 'processing', label: 'Processing' },
    { key: 'partially_dispensed', label: 'Partially Dispensed' },
    { key: 'dispensed', label: 'Dispensed' },
    { key: 'on_hold', label: 'On Hold' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1565C0] inline-block" />
            <ClipboardList className="w-5 h-5 text-[#1565C0]" />
            <span>Prescription Dispensing Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Prescriptions released after PRO consultation, billing, and payment completion
          </p>
        </div>

        <button
          onClick={() => fetchQueue()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
          {statusFilterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-[#1565C0] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-72 flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient, ID, doctor, token..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-1 focus:ring-[#1565C0] outline-hidden bg-slate-50 focus:bg-white"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* Main Queue Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12">
            <LoadingSpinner label="Loading prescription queue..." />
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Failed to load prescription queue</p>
              <p className="text-xs text-rose-600 mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchQueue()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <ClipboardList className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No prescriptions found in queue</p>
            <p className="text-xs text-slate-500">
              {statusFilter
                ? `No prescriptions currently matching the filter "${statusFilter.replace('_', ' ').toUpperCase()}".`
                : searchTerm
                ? `No prescriptions matching "${searchTerm}". Try a different search term.`
                : 'Prescriptions will appear here once the PRO completes patient consultation handoff, billing, and payment.'}
            </p>
            {(statusFilter || searchTerm) && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setSearchTerm('');
                  fetchQueue('');
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#1565C0] hover:underline"
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on Small Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Token / Rx ID</th>
                    <th className="py-3 px-4">Patient Details</th>
                    <th className="py-3 px-4">Consulting Doctor</th>
                    <th className="py-3 px-4">Rx Date</th>
                    <th className="py-3 px-4">PRO & Payment</th>
                    <th className="py-3 px-4">Pharmacy Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredQueue.map(item => {
                    const rxId = item.prescription_id || item.id;
                    const { date, time } = formatDate(item.prescription_date);
                    const isDispensed = item.pharmacy_status === 'dispensed';

                    return (
                      <tr key={rxId} className="hover:bg-slate-50/80 transition">
                        {/* Token & Rx ID */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">Token #{item.token_no || rxId}</div>
                          <div className="text-[11px] font-mono text-slate-500">Rx #{rxId}</div>
                        </td>

                        {/* Patient Details */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.patient_name || 'Anonymous Patient'}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>Reg #{item.registration_id || item.patient_id}</span>
                            <span>•</span>
                            <span>{item.mobile_number || 'N/A'}</span>
                          </div>
                        </td>

                        {/* Consulting Doctor */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">
                            {item.doctor_name ? (item.doctor_name.startsWith('Dr.') ? item.doctor_name : `Dr. ${item.doctor_name}`) : 'Dr. Consultant'}
                          </div>
                          <div className="text-[10px] text-slate-400">Homeopathy Dept</div>
                        </td>

                        {/* Prescription Date & Time */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-700">{date}</div>
                          {time && <div className="text-[10px] text-slate-400">{time}</div>}
                        </td>

                        {/* PRO & Payment Badges */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getProBadge(item.pro_status)}
                            {getPaymentBadge(item.payment_status)}
                          </div>
                        </td>

                        {/* Pharmacy Dispense Status */}
                        <td className="py-3 px-4">
                          {getStatusBadge(item.pharmacy_status)}
                        </td>

                        {/* Action Link */}
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/pharmacy/prescriptions/${rxId}/process`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer ${
                              isDispensed
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-[#1565C0] hover:bg-[#0D47A1] text-white shadow-xs'
                            }`}
                          >
                            {isDispensed ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>View Details</span>
                              </>
                            ) : (
                              <>
                                <Pill className="w-3.5 h-3.5" />
                                <span>Process</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Visible on Small Screens) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredQueue.map(item => {
                const rxId = item.prescription_id || item.id;
                const { date, time } = formatDate(item.prescription_date);
                const isDispensed = item.pharmacy_status === 'dispensed';

                return (
                  <div key={rxId} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">Token #{item.token_no || rxId}</span>
                        <span className="font-mono text-xs text-slate-400">Rx #{rxId}</span>
                      </div>
                      {getStatusBadge(item.pharmacy_status)}
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <div className="font-bold text-sm text-slate-900">{item.patient_name}</div>
                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>Reg #{item.registration_id || item.patient_id}</span>
                        <span>{item.mobile_number || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div>
                        <span className="font-medium text-slate-800">
                          {item.doctor_name ? (item.doctor_name.startsWith('Dr.') ? item.doctor_name : `Dr. ${item.doctor_name}`) : 'Dr. Consultant'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span>{date}</span>
                        {time && <span className="text-[10px] text-slate-400 block">{time}</span>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        {getProBadge(item.pro_status)}
                        {getPaymentBadge(item.payment_status)}
                      </div>

                      <Link
                        to={`/pharmacy/prescriptions/${rxId}/process`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs rounded-xl shadow-2xs transition ${
                          isDispensed
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-[#1565C0] hover:bg-[#0D47A1] text-white shadow-xs'
                        }`}
                      >
                        {isDispensed ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>View</span>
                          </>
                        ) : (
                          <>
                            <Pill className="w-3.5 h-3.5" />
                            <span>Process</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PrescriptionQueuePage;

