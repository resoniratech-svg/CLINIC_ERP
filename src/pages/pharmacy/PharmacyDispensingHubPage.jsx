import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import {
  Pill,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  Calendar,
  User,
  Phone,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export const PharmacyDispensingHubPage = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const activeTab = tab || 'pending';
  const urlPatientId = searchParams.get('patient_id') || '';
  const urlSearch = searchParams.get('search') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [search, setSearch] = useState(urlSearch || urlPatientId || '');
  const [dateFilter, setDateFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRowExpanded = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const fetchDispensingData = useCallback(async (query = search, date = dateFilter) => {
    setLoading(true);
    setError(null);
    try {
      const trimmedSearch = (query || '').trim();
      if (activeTab === 'history') {
        const res = await pharmacyApi.getDispensingHistory({
          patient_id: urlPatientId || undefined,
          search: trimmedSearch || undefined,
          date: date || undefined,
        });
        if (res.success) {
          setPrescriptions(res.data || []);
        } else {
          setError(res.message || 'Failed to load dispensing history');
        }
      } else {
        const res = await pharmacyApi.getPrescriptionQueue({
          status: activeTab === 'all' ? undefined : activeTab,
          search: trimmedSearch || undefined,
          date: date || undefined,
        });
        if (res.success) {
          setPrescriptions(res.data || []);
        } else {
          setError(res.message || 'Failed to load prescription queue');
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load dispensing records';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFilter, search, showToast, urlPatientId]);

  useEffect(() => {
    fetchDispensingData();
  }, [activeTab, dateFilter, fetchDispensingData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDispensingData(search, dateFilter);
  };

  const handleClearFilters = () => {
    setSearch('');
    setDateFilter('');
    fetchDispensingData('', '');
  };

  const getPharmacyStatusBadge = (status) => {
    switch (status) {
      case 'dispensed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" /> Dispensed
          </span>
        );
      case 'partially_dispensed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> Partial
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
            <Clock className="w-3 h-3" /> Processing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
            Pending
          </span>
        );
    }
  };

  const getPaymentBadge = (payStatus) => {
    const st = (payStatus || 'paid').toLowerCase();
    switch (st) {
      case 'paid':
      case 'success':
      case 'created':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
            Paid
          </span>
        );
      case 'partially_paid':
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
            Partial
          </span>
        );
      case 'unbilled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
            Unbilled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
            Unpaid
          </span>
        );
    }
  };

  const tabsList = [
    { id: 'pending', label: 'Pending Dispensing', path: '/pharmacy/dispensing/pending' },
    { id: 'processing', label: 'Processing & Clarifications', path: '/pharmacy/dispensing/processing' },
    { id: 'dispensed', label: 'Dispensed', path: '/pharmacy/dispensing/dispensed' },
    { id: 'history', label: 'Dispensing History', path: '/pharmacy/dispensing/history' },
  ];

  const getEmptyStateDescription = () => {
    if (search || dateFilter) {
      return `No prescription records matched "${search || dateFilter}". Try adjusting your search query or clear the filter.`;
    }
    switch (activeTab) {
      case 'processing':
        return 'No prescriptions are currently in active preparation or awaiting doctor clarification.';
      case 'dispensed':
        return 'No prescriptions have been dispensed today yet.';
      case 'history':
        return 'No historical patient dispensing records found.';
      default:
        return 'All prescriptions have been picked up or there are no new PRO completed patient prescriptions in the queue.';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Medicine Dispensing Hub</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gated dispensing queue for PRO completed homeopathy patient prescriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDispensingData(search, dateFilter)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {tabsList.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => navigate(t.path)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Patient Name, Reg ID, Mobile, or Rx ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchDispensingData('', dateFilter);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear text"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition shrink-0 shadow-2xs"
            >
              Search
            </button>
            {(search || dateFilter) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Results summary counter */}
        {!loading && !error && (
          <div className="mt-3 flex items-center justify-between text-2xs text-slate-500 px-1">
            <span>
              {search || dateFilter
                ? `Showing filtered results (${prescriptions.length} record${prescriptions.length === 1 ? '' : 's'} found)`
                : `Total ${prescriptions.length} prescription${prescriptions.length === 1 ? '' : 's'} in ${activeTab} queue`}
            </span>
            {(search || dateFilter) && (
              <button
                onClick={handleClearFilters}
                className="text-blue-600 hover:underline font-semibold"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchDispensingData(search, dateFilter)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Prescriptions List / Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col justify-center items-center gap-3">
            <LoadingSpinner size="md" />
            <span className="text-xs text-slate-500 font-medium">Loading prescription dispensing records...</span>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Pill}
              title={search || dateFilter ? 'No Matching Prescriptions Found' : `No ${activeTab} Prescriptions Found`}
              description={getEmptyStateDescription()}
            />
            {(search || dateFilter) && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition"
                >
                  Clear Search Filter
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="p-4">Rx ID & Token</th>
                    <th className="p-4">Patient Details</th>
                    <th className="p-4">Prescribed By</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Gating & Payment</th>
                    <th className="p-4">Status & Clarification</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prescriptions.map((rx) => {
                    const rxId = rx.prescription_id || rx.id;
                    const isExpanded = !!expandedRows[rxId];
                    const items = rx.items || [];
                    const openClarifications = parseInt(rx.open_clarifications_count || 0);

                    return (
                      <React.Fragment key={rxId}>
                        <tr className="hover:bg-slate-50/70 transition">
                          <td className="p-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 text-sm">#{rxId}</span>
                            {rx.token_no && (
                              <span className="block text-2xs font-semibold text-blue-600 mt-0.5">
                                Token #{rx.token_no}
                              </span>
                            )}
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-slate-800 text-sm">{rx.patient_name}</div>
                            <div className="text-slate-500 text-xs flex items-center gap-2 mt-0.5">
                              <span>Reg #{rx.registration_id || rx.patient_id}</span>
                              <span>•</span>
                              <span>{rx.mobile_number || 'N/A'}</span>
                            </div>
                          </td>

                          <td className="p-4">
                            <div className="font-semibold text-slate-800">
                              {rx.doctor_name ? `Dr. ${rx.doctor_name}` : 'Consulting Doctor'}
                            </div>
                            <div className="text-2xs text-slate-400">Homeopathy Dept</div>
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            <div className="font-medium text-slate-700">
                              {rx.prescription_date
                                ? new Date(rx.prescription_date).toLocaleDateString()
                                : new Date().toLocaleDateString()}
                            </div>
                            <div className="text-2xs text-slate-400">
                              {rx.prescription_date
                                ? new Date(rx.prescription_date).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </div>
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                                PRO: COMPLETED
                              </span>
                              {getPaymentBadge(rx.payment_status)}
                            </div>
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              {getPharmacyStatusBadge(rx.pharmacy_status || rx.status)}
                              {openClarifications > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <HelpCircle className="w-3 h-3" />
                                  <span>{openClarifications} Clarification{openClarifications > 1 ? 's' : ''}</span>
                                </span>
                              )}
                              {rx.items_count && (
                                <span className="text-2xs text-slate-400">
                                  {rx.items_count} item{rx.items_count === 1 ? '' : 's'} prescribed
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {activeTab === 'history' && items.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpanded(rxId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                                >
                                  <span>{isExpanded ? 'Hide Items' : 'View Items'}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <Link
                                to={`/pharmacy/prescriptions/${rxId}/process`}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition shadow-2xs"
                              >
                                <span>{rx.pharmacy_status === 'dispensed' || rx.status === 'dispensed' ? 'View Details' : 'Process'}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Items Details for History Tab */}
                        {isExpanded && items.length > 0 && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={7} className="p-4">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
                                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                  <span>Dispensed Medicines Breakdown ({items.length} items)</span>
                                  <span className="text-2xs text-slate-400 font-normal">Audit Log</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-100 text-slate-400 font-semibold text-2xs uppercase">
                                        <th className="py-1.5 pr-2">Medicine Name</th>
                                        <th className="py-1.5 px-2">Potency</th>
                                        <th className="py-1.5 px-2">Dosage</th>
                                        <th className="py-1.5 px-2 text-center">Prescribed</th>
                                        <th className="py-1.5 px-2 text-center">Dispensed</th>
                                        <th className="py-1.5 px-2">Batch Number</th>
                                        <th className="py-1.5 pl-2 text-right">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {items.map((item, idx) => (
                                        <tr key={item.item_id || idx} className="hover:bg-slate-50/50">
                                          <td className="py-1.5 pr-2 font-bold text-slate-800">{item.medicine_name}</td>
                                          <td className="py-1.5 px-2 text-slate-600">{item.potency || '—'}</td>
                                          <td className="py-1.5 px-2 text-slate-600">{item.dosage || 'Standard'}</td>
                                          <td className="py-1.5 px-2 text-center font-semibold text-slate-700">{item.quantity}</td>
                                          <td className="py-1.5 px-2 text-center font-bold text-emerald-700">{item.dispensed_quantity ?? item.quantity}</td>
                                          <td className="py-1.5 px-2 font-mono text-2xs text-slate-600">{item.batch_number || '—'}</td>
                                          <td className="py-1.5 pl-2 text-right">
                                            <span className={`inline-block px-2 py-0.5 rounded text-2xs font-semibold ${
                                              item.dispense_status === 'dispensed'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : item.dispense_status === 'processing'
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'bg-slate-100 text-slate-600'
                                            }`}>
                                              {item.dispense_status || 'dispensed'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {prescriptions.map((rx) => {
                const rxId = rx.prescription_id || rx.id;
                const items = rx.items || [];
                const openClarifications = parseInt(rx.open_clarifications_count || 0);

                return (
                  <div key={rxId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">#{rxId}</span>
                          {rx.token_no && (
                            <span className="text-2xs font-semibold text-blue-600">
                              Token #{rx.token_no}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-slate-800 text-sm mt-1">{rx.patient_name}</div>
                        <div className="text-2xs text-slate-500">
                          Reg #{rx.registration_id || rx.patient_id} • {rx.mobile_number || 'N/A'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getPharmacyStatusBadge(rx.pharmacy_status || rx.status)}
                        {openClarifications > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800">
                            <HelpCircle className="w-3 h-3" />
                            <span>{openClarifications} Clarification</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                      <div>
                        <div className="font-semibold text-slate-800">
                          {rx.doctor_name ? `Dr. ${rx.doctor_name}` : 'Doctor'}
                        </div>
                        <div className="text-2xs text-slate-400">
                          {rx.prescription_date ? new Date(rx.prescription_date).toLocaleDateString() : ''}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                          PRO: COMPLETED
                        </span>
                        {getPaymentBadge(rx.payment_status)}
                      </div>
                    </div>

                    <Link
                      to={`/pharmacy/prescriptions/${rxId}/process`}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition shadow-2xs"
                    >
                      <span>{rx.pharmacy_status === 'dispensed' || rx.status === 'dispensed' ? 'View Details' : 'Process Prescription'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
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
