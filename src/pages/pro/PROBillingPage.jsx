import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  DollarSign,
  ArrowDownRight,
  ShieldCheck,
  History,
  FileText,
  Stethoscope,
  BarChart3,
  TrendingUp,
  Wallet,
  CreditCard
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { PROInvoiceModal } from './PROInvoiceModal';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

export const PROBillingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  // Determine active view from path: /pro/billing/new, pending, paid, partial-due, reports, history
  const path = location.pathname;
  const initialTab = path.includes('/new')
    ? 'new'
    : path.includes('/pending')
    ? 'pending'
    : path.includes('/paid')
    ? 'paid'
    : path.includes('/partial-due')
    ? 'partial-due'
    : path.includes('/reports')
    ? 'reports'
    : 'history';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [bills, setBills] = useState([]);
  const [reports, setReports] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Patient live lookup state
  const [patientLookup, setPatientLookup] = useState({
    loading: false,
    patient: null,
    error: null
  });
  const [availablePackages, setAvailablePackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [prescribedTreatments, setPrescribedTreatments] = useState([]);
  const [consultingDoctor, setConsultingDoctor] = useState(null);

  // New Bill Form State
  const [form, setForm] = useState({
    patient_id: '',
    doctor_id: '1',
    bill_type: 'treatment', // Note: consultation is strictly prohibited for PRO role server-side!
    discount_amount: '0',
    package_id: '',
    items: [
      { item_name: 'Treatment Session', charge_type: 'Treatment', quantity: 1, unit_price: 2000 }
    ]
  });

  const verifyPatient = useCallback(async (idToVerify, explicitDoctorId = null) => {
    const pId = parseInt(idToVerify);
    if (!pId || isNaN(pId)) {
      setPatientLookup({ loading: false, patient: null, error: null });
      setAvailablePackages([]);
      setPrescribedTreatments([]);
      setConsultingDoctor(null);
      return;
    }

    setPatientLookup({ loading: true, patient: null, error: null });
    setLoadingPackages(true);
    try {
      const res = await proApi.getPatientOverview(pId);
      if (res.success && res.data?.patient) {
        setPatientLookup({
          loading: false,
          patient: res.data.patient,
          error: null
        });

        // Track doctor's prescribed treatment plans
        const tps = res.data.treatment_plans || [];
        setPrescribedTreatments(tps);

        // Pre-fill doctor attribution from consultation
        if (res.data.consultation?.doctor_id) {
          setConsultingDoctor({
            doctor_id: res.data.consultation.doctor_id,
            doctor_name: res.data.consultation.doctor_name
          });
          if (!explicitDoctorId) {
            setForm(prev => ({
              ...prev,
              doctor_id: String(res.data.consultation.doctor_id)
            }));
          }
        }

        // Also fetch active/pending packages for this patient
        try {
          const pkgRes = await proApi.getPackages({ patient_id: pId });
          if (pkgRes.success) {
            setAvailablePackages(pkgRes.data || []);
          }
        } catch {
          setAvailablePackages([]);
        }
      } else {
        setPatientLookup({
          loading: false,
          patient: null,
          error: `Patient #${pId} not found in database`
        });
        setAvailablePackages([]);
        setPrescribedTreatments([]);
        setConsultingDoctor(null);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Patient not found';
      setPatientLookup({
        loading: false,
        patient: null,
        error: errMsg.includes('not found') ? `Patient #${pId} not found in database` : errMsg
      });
      setAvailablePackages([]);
      setPrescribedTreatments([]);
      setConsultingDoctor(null);
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  // Handle URL query parameters (e.g. from Patient Overview)
  useEffect(() => {
    const qPatientId = searchParams.get('patient_id');
    const qDoctorId = searchParams.get('doctor_id');
    const qTreatmentName = searchParams.get('treatment_name');
    const qTreatmentType = searchParams.get('treatment_type');

    if (qPatientId) {
      setForm(prev => ({
        ...prev,
        patient_id: qPatientId,
        doctor_id: qDoctorId || prev.doctor_id,
        bill_type: 'treatment',
        items: qTreatmentName ? [
          {
            item_name: qTreatmentName,
            charge_type: qTreatmentType || 'Treatment',
            quantity: 1,
            unit_price: 2000
          }
        ] : prev.items
      }));
      verifyPatient(qPatientId, qDoctorId);
    }
  }, [searchParams, verifyPatient]);

  const applyTreatmentPlan = (tp) => {
    if (!tp) return;
    setForm(prev => ({
      ...prev,
      bill_type: 'treatment',
      doctor_id: tp.doctor_id ? String(tp.doctor_id) : prev.doctor_id,
      items: [
        {
          item_name: tp.treatment_name || 'Prescribed Treatment',
          charge_type: tp.treatment_type || 'Treatment',
          quantity: 1,
          unit_price: 2000
        }
      ]
    }));
    showToast(`Applied doctor prescribed treatment: ${tp.treatment_name}`, 'info');
  };

  const handlePackageSelect = (pkgId) => {
    if (!pkgId) {
      setForm(prev => ({ ...prev, package_id: '' }));
      return;
    }
    const selectedPkg = availablePackages.find(p => String(p.package_id) === String(pkgId));
    if (selectedPkg) {
      setForm(prev => ({
        ...prev,
        package_id: selectedPkg.package_id,
        bill_type: 'package',
        items: [
          {
            item_name: selectedPkg.package_name || 'Treatment Package',
            charge_type: 'Package',
            quantity: 1,
            unit_price: parseFloat(selectedPkg.final_amount || selectedPkg.package_amount || 0)
          }
        ]
      }));
    } else {
      setForm(prev => ({ ...prev, package_id: pkgId }));
    }
  };

  const fetchBills = async (tab) => {
    if (tab === 'new') return;
    setLoading(true);
    try {
      if (tab === 'reports') {
        const res = await proApi.getOperationalReports();
        if (res.success) {
          setReports(res.data || null);
        }
      } else {
        let res;
        if (tab === 'pending') res = await proApi.getPendingBills();
        else if (tab === 'paid') res = await proApi.getPaidBills();
        else if (tab === 'partial-due') res = await proApi.getPartialDueBills();
        else res = await proApi.getBillingHistory();

        if (res.success) {
          setBills(res.data || []);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to load billing data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
    fetchBills(initialTab);
  }, [location.pathname]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setServerError(null);
    navigate(`/pro/billing/${tabKey}`);
  };

  // Bill items management
  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { item_name: '', charge_type: 'Treatment', quantity: 1, unit_price: 0 }]
    }));
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, items: updated };
    });
  };

  // Calculate live preview subtotal
  const previewSubtotal = form.items.reduce((sum, it) => sum + (parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1)), 0);
  const previewDiscount = Math.max(0, parseFloat(form.discount_amount || 0));
  const previewTotal = Math.max(0, previewSubtotal - previewDiscount);
  const isDiscountOverSubtotal = previewDiscount > previewSubtotal && previewSubtotal > 0;

  const handleCreateBill = async (e) => {
    e.preventDefault();
    setServerError(null);

    const pId = parseInt(form.patient_id);
    if (!pId || isNaN(pId)) {
      showToast('Valid numeric Patient ID is required', 'error');
      return;
    }

    if (patientLookup.error) {
      showToast('Cannot generate bill for non-existent patient ID', 'error');
      return;
    }

    if (!form.bill_type) {
      showToast('Bill Category is required', 'error');
      return;
    }

    if (form.bill_type === 'consultation') {
      showToast('Forbidden: Consultation fee billing is handled by Receptionist only', 'error');
      return;
    }

    if (!form.items || form.items.length === 0) {
      showToast('At least one bill item is required', 'error');
      return;
    }

    // Validate line items
    for (let i = 0; i < form.items.length; i++) {
      const item = form.items[i];
      if (!item.item_name || !item.item_name.trim()) {
        showToast(`Item #${i + 1}: Item name is required`, 'error');
        return;
      }
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        showToast(`Item #${i + 1}: Quantity must be a positive integer`, 'error');
        return;
      }
      const price = parseFloat(item.unit_price);
      if (isNaN(price) || price < 0) {
        showToast(`Item #${i + 1}: Unit price cannot be negative`, 'error');
        return;
      }
    }

    const discount = parseFloat(form.discount_amount || 0);
    if (isNaN(discount) || discount < 0) {
      showToast('Discount amount cannot be negative', 'error');
      return;
    }
    if (discount > previewSubtotal) {
      showToast(`Discount amount (₹${discount}) cannot exceed subtotal (₹${previewSubtotal})`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        patient_id: pId,
        doctor_id: form.doctor_id ? parseInt(form.doctor_id) : 1,
        bill_type: form.bill_type,
        items: form.items.map(it => ({
          item_name: it.item_name.trim(),
          description: it.item_name.trim(),
          charge_type: it.charge_type || 'Treatment',
          quantity: parseInt(it.quantity || 1),
          unit_price: parseFloat(it.unit_price || 0)
        })),
        discount_amount: discount,
        package_id: form.package_id ? parseInt(form.package_id) : null
      };

      const res = await proApi.createBill(payload);

      if (res.success) {
        const bill = res.data;
        showToast(`Invoice ${bill?.bill_number || ''} created successfully for ${formatCurrency(bill?.final_amount || bill?.total_amount || 0)}!`, 'success');
        // Reset form & switch to pending bills
        setForm({
          patient_id: '',
          doctor_id: '1',
          bill_type: 'treatment',
          discount_amount: '0',
          package_id: '',
          items: [{ item_name: 'Treatment Session', charge_type: 'Treatment', quantity: 1, unit_price: 2000 }]
        });
        setPatientLookup({ loading: false, patient: null, error: null });
        setAvailablePackages([]);
        handleTabChange('pending');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to create bill';
      setServerError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#1565C0] flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>
            <Receipt className="w-5 h-5 text-[#1565C0]" />
            <span>PRO Billing Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate treatment, package, and service invoices. Consultation fees remain Receptionist-only.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab !== 'new' && (
            <button
              onClick={() => fetchBills(activeTab)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}
          <button
            onClick={() => handleTabChange('new')}
            className="flex items-center gap-1.5 px-4 py-2 btn-brand-gradient font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Create New Bill</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {[
          { id: 'new', label: '+ New Bill Form', icon: Plus },
          { id: 'pending', label: 'Pending Bills', icon: Clock },
          { id: 'partial-due', label: 'Partial / Due Bills', icon: ArrowDownRight },
          { id: 'paid', label: 'Paid Bills', icon: ShieldCheck },
          { id: 'history', label: 'All Invoices History', icon: History },
          { id: 'reports', label: 'Operational Reports', icon: BarChart3 },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#D32F2F] text-white shadow-xs shadow-red-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: New Bill Form */}
      {activeTab === 'new' && (
        <form onSubmit={handleCreateBill} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-black text-[#1565C0] flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[#D32F2F]"></span>
              <span>Generate Patient Bill</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Totals and dues are calculated server-side based on authorized bill items and discounts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Patient ID <span className="text-red-500">*</span>
                </label>
                {form.patient_id && (
                  <button
                    type="button"
                    onClick={() => verifyPatient(form.patient_id)}
                    className="text-[10px] font-bold text-[#1565C0] hover:underline cursor-pointer"
                  >
                    Verify
                  </button>
                )}
              </div>
              <input
                type="number"
                required
                value={form.patient_id}
                onChange={e => {
                  setForm({ ...form, patient_id: e.target.value });
                  if (!e.target.value) {
                    setPatientLookup({ loading: false, patient: null, error: null });
                    setAvailablePackages([]);
                  }
                }}
                onBlur={e => {
                  if (e.target.value) verifyPatient(e.target.value);
                }}
                placeholder="Enter numeric Patient ID..."
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-mono ${
                  patientLookup.error
                    ? 'border-red-400 bg-red-50/20 focus:border-red-500'
                    : patientLookup.patient
                    ? 'border-emerald-400 bg-emerald-50/20 focus:border-emerald-500'
                    : 'border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20'
                }`}
              />

              {patientLookup.loading && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#1565C0] mt-1.5 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Verifying patient in database...</span>
                </div>
              )}

              {patientLookup.patient && (
                <div className="mt-1.5 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1 truncate">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{patientLookup.patient.full_name}</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-700 shrink-0 ml-1">
                    {patientLookup.patient.registration_id || `ID #${patientLookup.patient.patient_id}`}
                  </span>
                </div>
              )}

              {patientLookup.error && (
                <div className="mt-1.5 p-2 bg-red-50 rounded-lg border border-red-200 text-[11px] text-red-800 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{patientLookup.error}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Doctor ID <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={form.doctor_id}
                onChange={e => setForm({ ...form, doctor_id: e.target.value })}
                placeholder="Doctor ID..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {consultingDoctor?.doctor_name
                  ? `Consulting: Dr. ${consultingDoctor.doctor_name}`
                  : 'Attributed consulting doctor'}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Bill Category <span className="text-red-500">*</span>
              </label>
              <select
                value={form.bill_type}
                onChange={e => setForm({ ...form, bill_type: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white font-medium"
              >
                <option value="treatment">Treatment Charges (treatment)</option>
                <option value="package">Package / Plan Charges (package)</option>
                <option value="other">Other Hospital Services (other)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Consultation fee is handled by Receptionist only.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Linked Package (Optional)
              </label>
              {availablePackages.length > 0 ? (
                <select
                  value={form.package_id}
                  onChange={e => handlePackageSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white font-medium"
                >
                  <option value="">-- None (Standard Bill) --</option>
                  {availablePackages.map(pkg => (
                    <option key={pkg.package_id} value={pkg.package_id}>
                      #{pkg.package_id}: {pkg.package_name} ({formatCurrency(pkg.final_amount)}) [{pkg.status}]
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={form.package_id}
                  onChange={e => setForm({ ...form, package_id: e.target.value })}
                  placeholder="Linked Package ID..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none font-mono"
                />
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                {availablePackages.length > 0
                  ? `${availablePackages.length} package(s) available for this patient`
                  : patientLookup.patient
                  ? 'No packages enrolled for this patient'
                  : 'Enter patient ID to list their packages'}
              </p>
            </div>
          </div>

          {/* Doctor Prescribed Treatments Banner */}
          {prescribedTreatments.length > 0 && (
            <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1565C0] flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-[#1565C0]" />
                  <span>Doctor Prescribed Treatments ({prescribedTreatments.length})</span>
                </span>
                {consultingDoctor?.doctor_name && (
                  <span className="text-[11px] text-slate-600 font-medium">
                    Prescribed by: <strong>Dr. {consultingDoctor.doctor_name}</strong>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Click a prescribed plan below to auto-populate invoice line items:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {prescribedTreatments.map(tp => (
                  <button
                    key={tp.treatment_id}
                    type="button"
                    onClick={() => applyTreatmentPlan(tp)}
                    className="px-3 py-1.5 bg-white hover:bg-blue-100 text-[#1565C0] border border-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Apply "{tp.treatment_name}" ({tp.treatment_type || 'Treatment'})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Bill Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1565C0]"></span>
                <span>Bill Items ({form.items.length})</span>
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs text-[#1565C0] hover:text-[#0D47A1] font-bold hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Another Line Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="flex-1 w-full sm:w-auto">
                    <input
                      type="text"
                      required
                      placeholder="Item name / service description..."
                      value={it.item_name}
                      onChange={e => updateItem(idx, 'item_name', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-[#1565C0]"
                    />
                  </div>

                  <div className="w-full sm:w-40">
                    <select
                      value={it.charge_type}
                      onChange={e => updateItem(idx, 'charge_type', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none focus:border-[#1565C0] font-medium"
                    >
                      <option value="Treatment">Treatment</option>
                      <option value="Package">Package</option>
                      <option value="Procedure">Procedure</option>
                      <option value="Investigation">Investigation</option>
                      <option value="Medicine">Medicine</option>
                      <option value="Service">Service</option>
                      <option value="General Charge">General Charge</option>
                    </select>
                  </div>

                  <div className="w-full sm:w-20">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none text-center font-mono focus:border-[#1565C0]"
                    />
                  </div>

                  <div className="w-full sm:w-32">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="Unit Price (₹)"
                      value={it.unit_price}
                      onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white outline-none text-right font-mono focus:border-[#1565C0]"
                    />
                  </div>

                  <div className="w-full sm:w-28 text-right font-mono text-xs font-bold text-slate-700 pr-2">
                    {formatCurrency((parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1)))}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={form.items.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="p-3.5 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-center gap-2.5 font-bold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Calculations Preview Summary */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-w-sm ml-auto space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-bold">{formatCurrency(previewSubtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Discount Amount:</span>
              <div className="w-28">
                <input
                  type="number"
                  min="0"
                  max={previewSubtotal}
                  step="0.01"
                  value={form.discount_amount}
                  onChange={e => setForm({ ...form, discount_amount: e.target.value })}
                  className={`w-full px-2 py-1 text-xs border rounded-lg text-right font-mono outline-none bg-white ${
                    isDiscountOverSubtotal ? 'border-red-400 text-red-600' : 'border-slate-200 focus:border-[#1565C0]'
                  }`}
                />
              </div>
            </div>

            {isDiscountOverSubtotal && (
              <div className="p-1.5 bg-red-50 text-red-700 text-[10px] rounded-lg border border-red-200 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                <span>Discount cannot exceed subtotal</span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900 text-sm">
              <span className="text-slate-900">Estimated Total:</span>
              <span className="text-[#D32F2F] font-mono font-black text-base">{formatCurrency(previewTotal)}</span>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              Note: Final amount is verified and committed server-side.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={submitting || isDiscountOverSubtotal || patientLookup.loading || (patientLookup.error && !!form.patient_id)}
              className="px-6 py-2.5 btn-brand-gradient font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Receipt className="w-4 h-4" />
              <span>{submitting ? 'Generating Invoice...' : 'Generate Bill Invoice'}</span>
            </button>
          </div>
        </form>
      )}

      {/* VIEWS 2 to 5: Tables (Pending, Paid, Partial, History) */}
      {activeTab !== 'new' && activeTab !== 'reports' && (
        <>
          {loading ? (
            <LoadingSpinner label={`Loading ${activeTab} bills...`} />
          ) : bills.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">No {activeTab} invoices found</p>
              <p className="text-xs text-slate-400 mt-1">Invoices appear here once created.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">Patient</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Final Amount</th>
                      <th className="py-3.5 px-4">Paid</th>
                      <th className="py-3.5 px-4">Remaining Due</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bills.map(b => {
                      const totalAmt = parseFloat(b.total_amount || b.final_amount || 0);
                      const paidAmt = parseFloat(b.paid_amount || 0);
                      const dueAmt = Math.max(0, totalAmt - paidAmt);
                      const isFullyPaid = dueAmt <= 0;

                      return (
                        <tr key={b.bill_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {b.bill_number}
                          </td>
                          <td className="py-3.5 px-4">
                            <Link
                              to={`/pro/patients/${b.patient_id}`}
                              className="font-bold text-[#1565C0] hover:underline"
                            >
                              {b.patient_name || `Patient #${b.patient_id}`}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 capitalize">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {b.bill_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {formatCurrency(totalAmt)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                            {formatCurrency(paidAmt)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-red-600">
                            {formatCurrency(dueAmt)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isFullyPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : paidAmt > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isFullyPaid ? 'PAID' : paidAmt > 0 ? 'PARTIAL' : 'PENDING'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoiceId(b.bill_id);
                                  setShowInvoiceModal(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition border border-slate-200 cursor-pointer"
                                title="View Itemized Invoice"
                              >
                                <Receipt className="w-3 h-3 text-[#1565C0]" />
                                <span>Invoice</span>
                              </button>
                              {!isFullyPaid ? (
                                <Link
                                  to={`/pro/payments?bill_id=${b.bill_id}&amount=${dueAmt}`}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                                >
                                  Record Payment
                                </Link>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium px-1">Settled</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* VIEW 6: Operational Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {loading ? (
            <LoadingSpinner label="Compiling live operational report..." />
          ) : !reports ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">No operational reports data available</p>
              <button
                onClick={() => fetchBills('reports')}
                className="mt-3 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Reload Data
              </button>
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Billed</span>
                    <Receipt className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                    {formatCurrency(reports.summary?.total_billed)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Across {reports.summary?.total_bills_count || 0} invoices
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Collected</span>
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-600 mt-2">
                    {formatCurrency(reports.summary?.total_collected)}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                    {reports.summary?.total_payments_count || 0} completed payments
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding Dues</span>
                    <Wallet className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-600 mt-2">
                    {formatCurrency(reports.summary?.total_due)}
                  </div>
                  <div className="text-[11px] text-amber-700 mt-1 font-medium">
                    {reports.summary?.unpaid_bills_count || 0} unpaid or partial bills
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collection Rate</span>
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-purple-700 mt-2">
                    {reports.summary?.collection_rate || 0}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Total revenue realization
                  </div>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#1565C0]" />
                    <span>Invoicing by Bill Type</span>
                  </h3>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5 text-center">Invoices</th>
                          <th className="p-2.5 text-right">Billed</th>
                          <th className="p-2.5 text-right">Collected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(reports.by_category || []).map((cat, i) => (
                          <tr key={i} className="hover:bg-slate-50/70">
                            <td className="p-2.5 capitalize font-bold text-slate-800">{cat.bill_type}</td>
                            <td className="p-2.5 text-center font-mono">{cat.bills_count}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(cat.total_billed)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatCurrency(cat.total_paid)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>Payment Methods Distribution</span>
                  </h3>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2.5">Payment Method</th>
                          <th className="p-2.5 text-center">Transactions</th>
                          <th className="p-2.5 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(reports.by_payment_method || []).map((pm, i) => (
                          <tr key={i} className="hover:bg-slate-50/70">
                            <td className="p-2.5 capitalize font-bold text-slate-800">{pm.payment_method || 'Cash'}</td>
                            <td className="p-2.5 text-center font-mono">{pm.payment_count}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatCurrency(pm.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Recent Transactions List */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-600" />
                    <span>Recent Financial Transactions</span>
                  </h3>
                  <span className="text-xs text-slate-400">Latest 20 settlements</span>
                </div>
                <div className="border border-slate-100 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Payment #</th>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Patient</th>
                        <th className="p-3">Method</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reports.recent_transactions || []).map((tx, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="p-3 font-mono font-bold text-slate-900">{tx.payment_number || `#${tx.payment_id}`}</td>
                          <td className="p-3 font-mono text-slate-700">{tx.bill_number}</td>
                          <td className="p-3 font-medium text-slate-800">{tx.patient_name || `Patient #${tx.patient_id}`}</td>
                          <td className="p-3 capitalize">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {tx.payment_method}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-700">{formatCurrency(tx.amount)}</td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoiceId(tx.bill_id);
                                setShowInvoiceModal(true);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition border border-slate-200 cursor-pointer"
                            >
                              Invoice
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Itemized Invoice Modal */}
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
