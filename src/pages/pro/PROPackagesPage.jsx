import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Clock,
  Calendar,
  DollarSign,
  Tag,
  CheckCircle2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  X
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

const PACKAGE_TYPES = [
  { value: 'monthly', label: 'Monthly (30 Days)' },
  { value: 'quarterly', label: 'Quarterly (90 Days)' },
  { value: 'half_yearly', label: 'Half-Yearly (180 Days)' },
  { value: 'yearly', label: 'Yearly (365 Days)' },
  { value: 'custom', label: 'Custom Duration' },
];

export const PROPackagesPage = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const urlPatientId = searchParams.get('patient_id');
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Searchable Patient Selector State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const latestSearchIdRef = useRef(0);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('all');

  // Form State
  const [form, setForm] = useState({
    patient_id: urlPatientId || '',
    package_name: '',
    package_type: 'monthly',
    from_date: new Date().toISOString().split('T')[0],
    to_date: '',
    package_amount: '',
    discount_amount: '0',
    payment_status: 'pending',
    remarks: ''
  });

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const params = {};
      if (urlPatientId) params.patient_id = urlPatientId;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await proApi.getPackages(params);
      if (res.success) {
        setPackages(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch packages', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [urlPatientId, statusFilter]);

  // Handle URL patient_id pre-population
  useEffect(() => {
    if (urlPatientId) {
      const pId = parseInt(urlPatientId);
      if (!isNaN(pId)) {
        setForm(prev => ({ ...prev, patient_id: String(pId) }));
        proApi.searchPatients({ patient_id: pId })
          .then(res => {
            if (res.success && res.data && res.data.length > 0) {
              const pt = res.data[0];
              setSelectedPatient(pt);
              setPatientSearchTerm(`${pt.full_name || pt.patient_name} • ID: ${pt.patient_id}`);
            } else {
              proApi.getPatientOverview(pId)
                .then(ovRes => {
                  if (ovRes.success && ovRes.data?.patient) {
                    const pt = ovRes.data.patient;
                    setSelectedPatient(pt);
                    setPatientSearchTerm(`${pt.full_name || pt.patient_name} • ID: ${pt.patient_id}`);
                  }
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      }
    }
  }, [urlPatientId]);

  // Load patients from backend API
  const loadPatients = useCallback(async (query = '') => {
    const searchId = ++latestSearchIdRef.current;
    setIsSearchingPatients(true);
    setSearchError(null);
    try {
      const res = await proApi.searchPatients({ search: query.trim(), limit: 50 });
      if (searchId === latestSearchIdRef.current) {
        if (res.success) {
          setSearchResults(res.data || []);
        } else {
          setSearchError('Unable to search patients. Please try again.');
        }
      }
    } catch (err) {
      if (searchId === latestSearchIdRef.current) {
        setSearchError('Unable to search patients. Please try again.');
      }
    } finally {
      if (searchId === latestSearchIdRef.current) {
        setIsSearchingPatients(false);
      }
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    if (!isSelectorOpen) return;
    if (selectedPatient && patientSearchTerm === `${selectedPatient.full_name || selectedPatient.patient_name} • ID: ${selectedPatient.patient_id}`) {
      return;
    }
    const timer = setTimeout(() => {
      loadPatients(patientSearchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [patientSearchTerm, isSelectorOpen, loadPatients, selectedPatient]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsSelectorOpen(false);
        if (selectedPatient) {
          setPatientSearchTerm(`${selectedPatient.full_name || selectedPatient.patient_name} • ID: ${selectedPatient.patient_id}`);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedPatient]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setPatientSearchTerm(val);
    if (selectedPatient) {
      setSelectedPatient(null);
      setForm(prev => ({ ...prev, patient_id: '' }));
    }
    if (!isSelectorOpen) {
      setIsSelectorOpen(true);
    }
  };

  const handleInputFocus = () => {
    setIsSelectorOpen(true);
    if (searchResults.length === 0 || !selectedPatient) {
      loadPatients(selectedPatient ? '' : patientSearchTerm);
    }
  };

  const handleSelectPatient = (pt) => {
    setSelectedPatient(pt);
    setForm(prev => ({ ...prev, patient_id: String(pt.patient_id) }));
    setPatientSearchTerm(`${pt.full_name || pt.patient_name} • ID: ${pt.patient_id}`);
    setIsSelectorOpen(false);
  };

  const handleClearPatient = (e) => {
    e.stopPropagation();
    setSelectedPatient(null);
    setForm(prev => ({ ...prev, patient_id: '' }));
    setPatientSearchTerm('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setIsSelectorOpen(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const pid = parseInt(form.patient_id);
    if (!pid || isNaN(pid)) {
      showToast('Please select a valid patient from the list', 'error');
      return;
    }

    if (!form.package_name.trim()) {
      showToast('Package Name is required', 'error');
      return;
    }

    if (form.package_amount === '' || isNaN(parseFloat(form.package_amount))) {
      showToast('Valid Package Amount is required', 'error');
      return;
    }

    if (form.package_type === 'custom' && !form.to_date) {
      showToast('To Date is required for custom package duration', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.createPackage({
        ...form,
        patient_id: pid,
        package_amount: parseFloat(form.package_amount),
        discount_amount: parseFloat(form.discount_amount || 0)
      });

      if (res.success) {
        showToast('Package created and enrolled successfully', 'success');
        setShowCreateModal(false);
        setIsSelectorOpen(false);
        setSelectedPatient(null);
        setPatientSearchTerm('');
        setForm({
          patient_id: '',
          package_name: '',
          package_type: 'monthly',
          from_date: new Date().toISOString().split('T')[0],
          to_date: '',
          package_amount: '',
          discount_amount: '0',
          payment_status: 'pending',
          remarks: ''
        });
        fetchPackages();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to create package', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (packageId, newStatus) => {
    try {
      const res = await proApi.updatePackageStatus(packageId, { status: newStatus });
      if (res.success) {
        showToast(`Package status updated to ${newStatus}`, 'success');
        fetchPackages();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update package status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#1565C0] flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>
            <Package className="w-5 h-5 text-[#1565C0]" />
            <span>Packages & Treatment Plans</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage long-term patient packages (monthly, quarterly, yearly, custom)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPackages}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setIsSelectorOpen(false);
              setSearchError(null);
              if (!selectedPatient) {
                setPatientSearchTerm('');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 btn-brand-gradient font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Enroll Package</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {['all', 'active', 'pending', 'completed', 'expired', 'cancelled'].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
              statusFilter === st
                ? 'bg-[#D32F2F] text-white shadow-xs shadow-red-500/20'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Packages Table */}
      {loading ? (
        <LoadingSpinner label="Loading packages..." />
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No packages found</p>
          <p className="text-xs text-slate-400 mt-1">Click "+ Enroll Package" to create a new patient package plan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Package</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Duration & Validity</th>
                  <th className="py-3.5 px-4">Pricing</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.map(pkg => (
                  <tr key={pkg.package_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{pkg.package_name}</div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">{pkg.package_type}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/pro/patients/${pkg.patient_id}`}
                        className="font-bold text-[#1565C0] hover:underline"
                      >
                        {pkg.patient_name || `Patient #${pkg.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">
                        {pkg.from_date} → {pkg.to_date}
                      </div>
                      <div className="text-[10px] text-slate-400">{pkg.duration_days || '—'} days</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#D32F2F]">{formatCurrency(pkg.final_amount)}</div>
                      {parseFloat(pkg.discount_amount) > 0 && (
                        <div className="text-[10px] text-slate-400 line-through">
                          {formatCurrency(pkg.package_amount)}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        pkg.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pkg.status === 'expired'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {pkg.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={pkg.status}
                        onChange={e => handleStatusUpdate(pkg.package_id, e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium outline-none cursor-pointer focus:border-[#1565C0]"
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="expired">Expired</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enroll Package Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-[#1565C0] flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1565C0]" />
                <span>Enroll Patient in Package</span>
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              {/* Searchable Patient Selector */}
              <div className="space-y-1 relative" ref={dropdownRef}>
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Patient <span className="text-red-500">*</span></span>
                  {selectedPatient && (
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Selected ID: #{selectedPatient.patient_id}
                    </span>
                  )}
                </label>

                {/* Single Search Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-3.5 h-3.5 text-[#1565C0]" />
                  </div>

                  <input
                    ref={searchInputRef}
                    type="text"
                    value={patientSearchTerm}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    placeholder="Search patient by ID or name..."
                    className={`w-full pl-9 pr-16 py-2 text-xs rounded-xl border bg-white outline-none transition ${
                      isSelectorOpen
                        ? 'border-[#1565C0] ring-2 ring-[#1565C0]/20'
                        : selectedPatient
                        ? 'border-emerald-400 bg-emerald-50/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  />

                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
                    {(patientSearchTerm || selectedPatient) && (
                      <button
                        type="button"
                        onClick={handleClearPatient}
                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSelectorOpen) {
                          handleInputFocus();
                          searchInputRef.current?.focus();
                        } else {
                          setIsSelectorOpen(false);
                        }
                      }}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition cursor-pointer"
                      title="Toggle patient list"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isSelectorOpen ? 'rotate-180 text-[#1565C0]' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Dropdown Panel - ONLY Results List, NO Inner Search Box */}
                {isSelectorOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden flex flex-col max-h-60">
                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                      {isSearchingPatients ? (
                        <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-[#1565C0] animate-spin" />
                          <span>Searching patients...</span>
                        </div>
                      ) : searchError ? (
                        <div className="p-4 text-center text-xs text-red-600 flex items-center justify-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span>{searchError}</span>
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          {patientSearchTerm.trim() ? `No patients found for "${patientSearchTerm.trim()}"` : 'No patients found'}
                        </div>
                      ) : (
                        searchResults.map(pt => {
                          const isSelected = String(pt.patient_id) === String(form.patient_id);
                          return (
                            <div
                              key={pt.patient_id}
                              onClick={() => handleSelectPatient(pt)}
                              className={`p-3 text-xs cursor-pointer transition flex items-center justify-between hover:bg-blue-50/60 ${
                                isSelected ? 'bg-blue-50/80 font-bold border-l-2 border-[#1565C0]' : ''
                              }`}
                            >
                              <div>
                                <div className="text-slate-900 font-bold flex items-center gap-1.5">
                                  <span>{pt.full_name || pt.patient_name}</span>
                                  {isSelected && (
                                    <CheckCircle className="w-3 h-3 text-[#1565C0] shrink-0" />
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  Patient ID: {pt.patient_id}
                                  {pt.mobile_number && ` • 📞 ${pt.mobile_number}`}
                                  {pt.age ? ` • ${pt.age} yrs` : ''}
                                  {pt.gender ? `, ${pt.gender}` : ''}
                                </div>
                              </div>
                              <div className="text-[10px] font-bold text-[#1565C0] px-2 py-0.5 rounded bg-white border border-blue-200/60">
                                Select
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Package Name *</label>
                <input
                  type="text"
                  required
                  value={form.package_name}
                  onChange={e => setForm({ ...form, package_name: e.target.value })}
                  placeholder="e.g. Annual Homeopathy Care Plan"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Package Type *</label>
                  <select
                    value={form.package_type}
                    onChange={e => setForm({ ...form, package_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white"
                  >
                    {PACKAGE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">From Date *</label>
                  <input
                    type="date"
                    required
                    value={form.from_date}
                    onChange={e => setForm({ ...form, from_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
                  />
                </div>
              </div>

              {form.package_type === 'custom' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">To Date (Custom Duration) *</label>
                  <input
                    type="date"
                    required
                    value={form.to_date}
                    onChange={e => setForm({ ...form, to_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Package Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.package_amount}
                    onChange={e => setForm({ ...form, package_amount: e.target.value })}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Discount Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount_amount}
                    onChange={e => setForm({ ...form, discount_amount: e.target.value })}
                    placeholder="e.g. 2000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Remarks</label>
                <input
                  type="text"
                  value={form.remarks}
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 btn-brand-gradient text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Enroll Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
