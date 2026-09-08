import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  Pill,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  Calendar,
  Phone,
  FileText,
  Eye,
  X,
  CheckCircle2,
  ExternalLink,
  Filter
} from 'lucide-react';

export const DoctorPrescriptionsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Selected prescription for detail modal
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchPrescriptions = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = {};
      if (search && search.trim()) params.search = search.trim();
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;

      const res = await doctorApi.getMyPrescriptions(params);
      if (res && res.success) {
        setPrescriptions(res.data || []);
      } else {
        throw new Error(res?.message || 'Failed to load prescriptions from server');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load prescriptions';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, dateFilter, showToast]);

  // Fetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPrescriptions();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPrescriptions]);

  // Open detail modal and fetch fresh record from backend
  const handleViewDetails = async (prescriptionId) => {
    setLoadingDetail(true);
    try {
      const res = await doctorApi.getPrescriptionDetails(prescriptionId);
      if (res && res.success) {
        setSelectedPrescription(res.data);
      } else {
        throw new Error(res?.message || 'Failed to fetch prescription details');
      }
    } catch (err) {
      // Fallback to local item if detail call fails
      const fallback = prescriptions.find(p => p.prescription_id === prescriptionId);
      if (fallback) {
        setSelectedPrescription(fallback);
      } else {
        showToast(err.message || 'Unable to open prescription details', 'error');
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFilter('');
  };

  const getStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'dispensed':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Dispensed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" /> Processing
          </span>
        );
      case 'partially_dispensed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Clock className="w-3 h-3" /> Partially Dispensed
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> Pharmacy Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Pill className="w-6 h-6 text-emerald-600" /> My Prescriptions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time record of all clinical prescriptions issued by your account
          </p>
        </div>

        <button
          onClick={() => fetchPrescriptions(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by patient name, ID, phone, or RX #..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Pharmacy Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">All Pharmacy Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="dispensed">Dispensed</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-emerald-500 outline-none cursor-pointer"
            />
          </div>

          {/* Clear Filters button */}
          {(search || statusFilter !== 'all' || dateFilter) && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1.5 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner label="Loading prescriptions from PostgreSQL..." />
        </div>
      ) : error ? (
        /* SECTION 15: Explicit API Error State (NEVER show "No prescriptions found" on error) */
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-red-900">Failed to Load Prescriptions</h3>
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={() => fetchPrescriptions(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      ) : prescriptions.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3 border border-slate-100">
            <Pill className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">No prescriptions found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'all' || dateFilter
              ? 'No prescriptions match your current search/filter criteria.'
              : 'You have not issued any prescriptions yet. Prescriptions prescribed during patient consultations will automatically appear here.'}
          </p>
          {(search || statusFilter !== 'all' || dateFilter) && (
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
            >
              Clear Search & Filters
            </button>
          )}
        </div>
      ) : (
        /* Prescription Cards Grid */
        <div className="space-y-3.5">
          <div className="text-xs text-slate-500 font-medium px-1">
            Showing {prescriptions.length} prescription{prescriptions.length === 1 ? '' : 's'}
          </div>

          {prescriptions.map(p => (
            <div
              key={p.prescription_id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow p-5 space-y-4"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900">
                      {p.patient_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                      {p.registration_id}
                    </span>
                    {p.patient_age && (
                      <span className="text-xs text-slate-400">
                        {p.patient_age}y • {p.patient_gender || 'Patient'}
                      </span>
                    )}
                    {p.patient_phone && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {p.patient_phone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(p.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(p.created_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {p.consultation_id && (
                      <button
                        onClick={() => navigate(`/doctor/consultation/${p.consultation_id}`)}
                        className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline font-semibold cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        Consultation #{p.consultation_id}
                      </button>
                    )}
                  </div>
                </div>

                {/* Badges & Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(p.pharmacy_status)}
                  <span className="px-2.5 py-0.5 rounded-full font-bold font-mono text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                    RX #{p.prescription_id}
                  </span>
                  <button
                    onClick={() => handleViewDetails(p.prescription_id)}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Details
                  </button>
                </div>
              </div>

              {/* Medicines Summary Chips */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Prescribed Medicines ({p.medicines?.length || 0})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {p.medicines && p.medicines.length > 0 ? (
                    p.medicines.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200/70 transition-colors text-xs space-y-1"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-slate-800 line-clamp-1">
                            {m.medicine_name}
                          </span>
                          {m.category && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 text-[9px] font-semibold shrink-0">
                              {m.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-slate-500 text-[11px] flex-wrap">
                          <span className="font-semibold text-emerald-700">{m.dosage || '1 dose'}</span>
                          {m.frequency && <span>• {m.frequency}</span>}
                          {m.duration_days && <span>• {m.duration_days} days</span>}
                          {m.quantity && (
                            <span className="font-mono text-slate-600">Qty: {m.quantity}</span>
                          )}
                        </div>

                        {(m.timing || m.food_instruction || m.special_instructions) && (
                          <div className="text-[10px] text-slate-400 italic line-clamp-1">
                            {[m.timing, m.food_instruction, m.special_instructions].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">No medicine items found</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prescription Details Modal (Section 12) */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    Prescription #{selectedPrescription.prescription_id}
                    {getStatusBadge(selectedPrescription.pharmacy_status)}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Issued on {new Date(selectedPrescription.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPrescription(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Patient & Consultation Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient</span>
                  <span className="font-bold text-slate-900">{selectedPrescription.patient_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Registration ID</span>
                  <span className="font-mono font-bold text-slate-700">{selectedPrescription.registration_id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone Number</span>
                  <span className="text-slate-700">{selectedPrescription.patient_phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Demographics</span>
                  <span className="text-slate-700">
                    {selectedPrescription.patient_age ? `${selectedPrescription.patient_age}y` : 'Age N/A'} • {selectedPrescription.patient_gender || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Doctor</span>
                  <span className="font-semibold text-slate-800">{selectedPrescription.doctor_name || 'Assigned Doctor'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Consultation</span>
                  {selectedPrescription.consultation_id ? (
                    <button
                      onClick={() => {
                        const cId = selectedPrescription.consultation_id;
                        setSelectedPrescription(null);
                        navigate(`/doctor/consultation/${cId}`);
                      }}
                      className="font-bold text-emerald-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      #{selectedPrescription.consultation_id} <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <span className="text-slate-400">Direct Prescription</span>
                  )}
                </div>
              </div>

              {/* Medicine Table */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center justify-between">
                  <span>Prescribed Items ({selectedPrescription.medicines?.length || 0})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Real PostgreSQL records</span>
                </h4>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                        <th className="p-3">#</th>
                        <th className="p-3">Medicine</th>
                        <th className="p-3">Dosage</th>
                        <th className="p-3">Frequency</th>
                        <th className="p-3">Duration</th>
                        <th className="p-3">Qty</th>
                        <th className="p-3">Route / Timing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPrescription.medicines && selectedPrescription.medicines.length > 0 ? (
                        selectedPrescription.medicines.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{m.medicine_name}</div>
                              {m.category && (
                                <div className="text-[10px] text-slate-400">{m.category}</div>
                              )}
                              {m.special_instructions && (
                                <div className="text-[10px] text-amber-700 mt-0.5 italic">
                                  Note: {m.special_instructions}
                                </div>
                              )}
                            </td>
                            <td className="p-3 font-semibold text-emerald-700">{m.dosage || '—'}</td>
                            <td className="p-3 text-slate-600">{m.frequency || '—'}</td>
                            <td className="p-3 text-slate-600">{m.duration_days ? `${m.duration_days} days` : '—'}</td>
                            <td className="p-3 font-mono font-bold text-slate-800">{m.quantity || '—'}</td>
                            <td className="p-3 text-slate-500">
                              <div>{m.route || 'oral'}</div>
                              {(m.timing || m.food_instruction) && (
                                <div className="text-[10px] text-slate-400">
                                  {[m.timing, m.food_instruction].filter(Boolean).join(', ')}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                            No prescription items recorded
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Verified with PostgreSQL database
              </span>
              <div className="flex items-center gap-2">
                {selectedPrescription.consultation_id && (
                  <button
                    onClick={() => {
                      const cId = selectedPrescription.consultation_id;
                      setSelectedPrescription(null);
                      navigate(`/doctor/consultation/${cId}`);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Open Consultation
                  </button>
                )}
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
