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
  X,
  Pill,
  Trash2,
  Eye,
  Receipt
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { MedicineSelector } from '../../components/doctor/MedicineSelector';
import { useToast } from '../../context/ToastContext';
import { PROInvoiceModal } from './PROInvoiceModal';

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

  // Prescription Selector & Item State
  const [prescriptionMeds, setPrescriptionMeds] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  // Package Modals State
  const [viewingPackagePrescription, setViewingPackagePrescription] = useState(null);
  const [viewingPackageDetails, setViewingPackageDetails] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

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
    setSelectedMedicine(null);
  };

  const getPackageDefaultDuration = (pkgType) => {
    switch (pkgType) {
      case 'monthly': return 30;
      case 'quarterly': return 90;
      case 'half_yearly': return 180;
      case 'yearly': return 365;
      default: return 30;
    }
  };

  const handleAddSelectedMedicine = (medToUse = null) => {
    const med = medToUse || selectedMedicine;
    if (!med) {
      showToast('Please search and select a medicine from the dropdown first', 'error');
      return;
    }

    const alreadyAdded = prescriptionMeds.some(m => m.medicine_id === med.id);
    if (alreadyAdded) {
      showToast(`${med.medicine_name} is already added to this prescription`, 'error');
      return;
    }

    const defaultDuration = getPackageDefaultDuration(form.package_type);
    const defaultQty = defaultDuration * 1; // 1 tab, 1 time/day default

    setPrescriptionMeds(prev => [...prev, {
      medicine_id: med.id,
      medicine_name: med.medicine_name,
      generic_name: med.generic_name || '',
      strength: med.strength || '',
      dosage: '1 tab',
      frequency: '1 time/day',
      duration_days: defaultDuration,
      quantity: defaultQty,
      route: 'oral'
    }]);

    showToast(`Added ${med.medicine_name} to prescription`, 'success');
    setSelectedMedicine(null);
  };

  const updatePrescriptionMed = (idx, field, val) => {
    setPrescriptionMeds(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const updated = { ...m, [field]: val };
      if (field === 'duration_days') {
        const days = parseInt(val) || 0;
        let timesPerDay = 1;
        if (updated.frequency.includes('2')) timesPerDay = 2;
        else if (updated.frequency.includes('3')) timesPerDay = 3;
        else if (updated.frequency.includes('4')) timesPerDay = 4;
        updated.quantity = days * timesPerDay;
      } else if (field === 'frequency') {
        const days = parseInt(updated.duration_days) || 0;
        let timesPerDay = 1;
        if (val.includes('2')) timesPerDay = 2;
        else if (val.includes('3')) timesPerDay = 3;
        else if (val.includes('4')) timesPerDay = 4;
        updated.quantity = days * timesPerDay;
      }
      return updated;
    }));
  };

  const removePrescriptionMed = (idx) => {
    setPrescriptionMeds(prev => prev.filter((_, i) => i !== idx));
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

    // Validation of prescription items if added
    for (let i = 0; i < prescriptionMeds.length; i++) {
      const med = prescriptionMeds[i];
      if (!med.dosage || !med.dosage.trim()) {
        showToast(`Please specify dosage for ${med.medicine_name}`, 'error');
        return;
      }
      const dur = parseInt(med.duration_days);
      if (isNaN(dur) || dur <= 0) {
        showToast(`Duration for ${med.medicine_name} must be a positive number of days`, 'error');
        return;
      }
      const qty = parseInt(med.quantity);
      if (isNaN(qty) || qty <= 0) {
        showToast(`Quantity for ${med.medicine_name} must be a positive number`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await proApi.createPackage({
        ...form,
        patient_id: pid,
        package_amount: parseFloat(form.package_amount),
        discount_amount: parseFloat(form.discount_amount || 0),
        prescription_items: prescriptionMeds.map(m => ({
          medicine_id: m.medicine_id,
          dosage: m.dosage.trim(),
          frequency: m.frequency.trim(),
          duration_days: parseInt(m.duration_days),
          quantity: parseInt(m.quantity),
          route: m.route || 'oral'
        }))
      });

      if (res.success) {
        showToast('Package created and enrolled successfully' + (prescriptionMeds.length > 0 ? ' with prescription' : ''), 'success');
        setShowCreateModal(false);
        setIsSelectorOpen(false);
        setSelectedPatient(null);
        setPatientSearchTerm('');
        setPrescriptionMeds([]);
        setSelectedMedicine(null);
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
                  <th className="py-3.5 px-4">Prescription</th>
                  <th className="py-3.5 px-4">Billing Status</th>
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
                      {pkg.prescription_id || (pkg.prescription_medicines && pkg.prescription_medicines.length > 0) || pkg.items_count > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Pill className="w-3 h-3" />
                            <span>
                              {(pkg.prescription_medicines?.length || pkg.items_count || 1)} {(pkg.prescription_medicines?.length === 1 || pkg.items_count === 1) ? 'med' : 'meds'}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setViewingPackagePrescription(pkg)}
                            className="p-1 hover:bg-blue-50 text-[#1565C0] rounded-lg transition cursor-pointer"
                            title="View Prescription Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No medicines</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {pkg.billing_status === 'paid' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            <span>Paid</span>
                          </span>
                          {pkg.invoice_number && (
                            <span className="text-[10px] font-mono text-slate-500 font-semibold">#{pkg.invoice_number}</span>
                          )}
                        </div>
                      ) : pkg.billing_status === 'partially_paid' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Partially Paid</span>
                          </span>
                          <span className="text-[10px] font-bold text-red-600">
                            Due: {formatCurrency(pkg.balance_due || (parseFloat(pkg.final_amount) - parseFloat(pkg.paid_amount || 0)))}
                          </span>
                        </div>
                      ) : pkg.billing_status === 'invoiced' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Receipt className="w-3 h-3" />
                            <span>Invoiced</span>
                          </span>
                          {pkg.invoice_number && (
                            <span className="text-[10px] font-mono text-blue-700 font-semibold">#{pkg.invoice_number}</span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <span>Unbilled</span>
                        </span>
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
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Billing Action: Create Invoice vs View Invoice */}
                        {pkg.billing_status === 'unbilled' || !pkg.invoice_id ? (
                          <Link
                            to={`/pro/billing/new?patient_id=${pkg.patient_id}&package_id=${pkg.package_id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#D32F2F] hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition shadow-2xs"
                            title="Create Package Invoice"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Create Invoice</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceId(pkg.invoice_id);
                              setShowInvoiceModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#1565C0] rounded-lg text-[11px] font-bold transition border border-blue-200 cursor-pointer"
                            title="View Printable Invoice"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>View Invoice</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setViewingPackageDetails(pkg)}
                          className="p-1 hover:bg-slate-100 text-slate-600 rounded-lg transition cursor-pointer"
                          title="View Package Details & Billing Reconciliation"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

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
                      </div>
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
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <h2 className="text-base font-black text-[#1565C0] flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1565C0]" />
                <span>Enroll Patient in Package</span>
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form id="enroll-package-form" onSubmit={handleCreate} className="space-y-4 overflow-y-auto pr-1 flex-1 py-3">
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

              {/* PRESCRIPTION SECTION */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Pill className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Prescription</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                  </label>
                  {prescriptionMeds.length > 0 && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {prescriptionMeds.length} {prescriptionMeds.length === 1 ? 'medicine' : 'medicines'} added
                    </span>
                  )}
                </div>

                {/* Search & Add bar */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600">Prescription Medicine Selector</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <MedicineSelector
                        selectedMedicine={selectedMedicine}
                        onSelectMedicine={(med) => setSelectedMedicine(med)}
                        onClear={() => setSelectedMedicine(null)}
                        disabled={submitting}
                        placeholder="Search medicine by name or generic name..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddSelectedMedicine()}
                      disabled={!selectedMedicine || submitting}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                      title={selectedMedicine ? `Add ${selectedMedicine.medicine_name} to prescription` : 'Select a medicine first'}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add to Prescription</span>
                    </button>
                  </div>

                  {/* Selected Medicine Quick Preview Card */}
                  {selectedMedicine && (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Pill className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>{selectedMedicine.medicine_name}</span>
                            {selectedMedicine.category && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold">
                                {selectedMedicine.category}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                            {selectedMedicine.generic_name && (
                              <span className="italic text-slate-600">Generic: {selectedMedicine.generic_name}</span>
                            )}
                            {selectedMedicine.strength && (
                              <span className="font-semibold text-emerald-700">{selectedMedicine.strength}</span>
                            )}
                            {selectedMedicine.medicine_type && (
                              <span className="capitalize">• {selectedMedicine.medicine_type}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedMedicine(null)}
                          className="px-2.5 py-1 text-slate-500 hover:text-red-600 hover:bg-white rounded-lg text-xs font-bold transition cursor-pointer border border-transparent hover:border-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddSelectedMedicine()}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Medicines List */}
                {prescriptionMeds.length === 0 ? (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    <Pill className="w-4 h-4 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs text-slate-500 font-medium">No medicines added to this package yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Search above and click "+ Add to Prescription" to attach prescription medicines</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {prescriptionMeds.map((med, idx) => (
                      <div key={med.medicine_id || idx} className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-slate-900 text-xs truncate">{med.medicine_name}</span>
                            {med.strength && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold shrink-0">
                                {med.strength}
                              </span>
                            )}
                            {med.generic_name && (
                              <span className="text-[10px] text-slate-400 italic truncate hidden sm:inline">({med.generic_name})</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePrescriptionMed(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer shrink-0"
                            title="Remove medicine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Dosage</label>
                            <input
                              type="text"
                              value={med.dosage}
                              onChange={e => updatePrescriptionMed(idx, 'dosage', e.target.value)}
                              placeholder="e.g. 1 tab"
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none bg-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Frequency</label>
                            <select
                              value={med.frequency}
                              onChange={e => updatePrescriptionMed(idx, 'frequency', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none bg-white"
                            >
                              <option value="1 time/day">1 time/day</option>
                              <option value="2 times/day">2 times/day</option>
                              <option value="3 times/day">3 times/day</option>
                              <option value="4 times/day">4 times/day</option>
                              <option value="At bedtime">At bedtime</option>
                              <option value="As needed">As needed</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Duration (days)</label>
                            <input
                              type="number"
                              min="1"
                              value={med.duration_days}
                              onChange={e => updatePrescriptionMed(idx, 'duration_days', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none bg-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={med.quantity}
                              onChange={e => updatePrescriptionMed(idx, 'quantity', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
            </form>

            {/* Modal Actions Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="enroll-package-form"
                disabled={submitting}
                className="px-4 py-2 btn-brand-gradient text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enrolling...</span>
                  </>
                ) : (
                  <span>Enroll Package</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Package Prescription Details Modal */}
      {viewingPackagePrescription && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  <span>Package Prescription Details</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewingPackagePrescription.package_name} • {viewingPackagePrescription.patient_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPackagePrescription(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1 py-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500">Prescription ID: </span>
                  <span className="font-bold text-slate-800">#{viewingPackagePrescription.prescription_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 mr-1.5">Pharmacy Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                    viewingPackagePrescription.pharmacy_status === 'dispensed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : viewingPackagePrescription.pharmacy_status === 'processing'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {viewingPackagePrescription.pharmacy_status || 'pending'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Prescribed Medicines</h3>
                {viewingPackagePrescription.prescription_medicines && viewingPackagePrescription.prescription_medicines.length > 0 ? (
                  viewingPackagePrescription.prescription_medicines.map((med, idx) => (
                    <div key={med.id || idx} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>{med.medicine_name}</span>
                          {med.strength && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-800 rounded font-semibold border border-emerald-200">
                              {med.strength}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 capitalize">
                          {med.dispense_status || 'pending'}
                        </span>
                      </div>
                      {med.generic_name && (
                        <p className="text-[11px] text-slate-400 italic">Generic: {med.generic_name}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-600 font-medium pt-1 border-t border-slate-50 flex-wrap">
                        <span><strong>Dosage:</strong> {med.dosage || '1 tab'}</span>
                        <span>•</span>
                        <span><strong>Frequency:</strong> {med.frequency || '1 time/day'}</span>
                        <span>•</span>
                        <span><strong>Duration:</strong> {med.duration_days || '—'} days</span>
                        <span>•</span>
                        <span><strong>Quantity:</strong> {med.quantity}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-xl text-center">
                    Prescription ID #{viewingPackagePrescription.prescription_id} is linked to this package.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 shrink-0">
              {viewingPackagePrescription.prescription_id && (
                <Link
                  to={`/pro/prescriptions/${viewingPackagePrescription.prescription_id}`}
                  className="text-xs font-bold text-[#1565C0] hover:underline flex items-center gap-1"
                >
                  <span>Open Full Prescription Review →</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setViewingPackagePrescription(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Package Details & Billing Reconciliation Modal */}
      {viewingPackageDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1565C0] text-white flex items-center justify-center shadow-xs">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>{viewingPackageDetails.package_name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                      {viewingPackageDetails.package_type}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Patient: <strong>{viewingPackageDetails.patient_name || `Patient #${viewingPackageDetails.patient_id}`}</strong> • ID #{viewingPackageDetails.package_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPackageDetails(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1 py-4 space-y-4 text-xs">
              {/* Timeline & Status */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Validity From</span>
                  <span className="font-bold text-slate-800">{viewingPackageDetails.from_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Validity To</span>
                  <span className="font-bold text-slate-800">{viewingPackageDetails.to_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Package Status</span>
                  <span className="font-bold capitalize text-slate-800">{viewingPackageDetails.status}</span>
                </div>
              </div>

              {/* Billing Reconciliation Summary */}
              <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/70 rounded-2xl border border-blue-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#1565C0] uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-[#1565C0]" />
                    <span>Billing & Financial Reconciliation</span>
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    viewingPackageDetails.billing_status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : viewingPackageDetails.billing_status === 'partially_paid'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : viewingPackageDetails.billing_status === 'invoiced'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {(viewingPackageDetails.billing_status || 'unbilled').replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-white rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Package Price</span>
                    <span className="font-bold text-slate-800 font-mono text-sm">{formatCurrency(viewingPackageDetails.package_amount)}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Discount</span>
                    <span className="font-bold text-emerald-700 font-mono text-sm">-{formatCurrency(viewingPackageDetails.discount_amount || 0)}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Invoiced</span>
                    <span className="font-black text-[#D32F2F] font-mono text-sm">{formatCurrency(viewingPackageDetails.final_amount)}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Balance Due</span>
                    <span className="font-black text-red-600 font-mono text-sm">
                      {formatCurrency(viewingPackageDetails.balance_due || (parseFloat(viewingPackageDetails.final_amount) - parseFloat(viewingPackageDetails.paid_amount || 0)))}
                    </span>
                  </div>
                </div>

                {viewingPackageDetails.invoice_id ? (
                  <div className="p-3 bg-white rounded-xl border border-blue-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-bold text-slate-800">
                        Invoice #{viewingPackageDetails.invoice_number}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Date: {viewingPackageDetails.invoice_date || '—'} • Paid: {formatCurrency(viewingPackageDetails.paid_amount || 0)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceId(viewingPackageDetails.invoice_id);
                        setShowInvoiceModal(true);
                      }}
                      className="px-3 py-1.5 bg-[#1565C0] hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>View Full Printable Invoice</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-blue-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="text-slate-600">
                      No bill invoice has been generated for this package yet.
                    </div>
                    <Link
                      to={`/pro/billing/new?patient_id=${viewingPackageDetails.patient_id}&package_id=${viewingPackageDetails.package_id}`}
                      className="px-3 py-1.5 bg-[#D32F2F] hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Generate Invoice Now</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Prescription Information */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-emerald-600" />
                    <span>Clinical Prescription Medicines</span>
                  </span>
                  {viewingPackageDetails.prescription_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewingPackagePrescription(viewingPackageDetails);
                      }}
                      className="text-xs font-bold text-[#1565C0] hover:underline"
                    >
                      View Details →
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {viewingPackageDetails.prescription_id
                    ? `Prescription #${viewingPackageDetails.prescription_id} is linked to this package. Medicines are covered under the package fee and not billed separately.`
                    : 'No prescription was attached to this package enrollment.'}
                </p>
              </div>

              {viewingPackageDetails.remarks && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Remarks</span>
                  <p className="text-slate-700 text-xs mt-0.5">{viewingPackageDetails.remarks}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setViewingPackageDetails(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      <PROInvoiceModal
        billId={selectedInvoiceId}
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedInvoiceId(null);
        }}
      />
    </div>
  );
};
