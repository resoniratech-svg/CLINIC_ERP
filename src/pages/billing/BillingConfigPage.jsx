import React, { useEffect, useState, useRef } from 'react';
import { billingApi, doctorsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { Receipt, DollarSign, ShieldAlert, CheckCircle2, Percent, CreditCard, Stethoscope, ArrowUpRight, Search, ChevronDown, X, Check } from 'lucide-react';

// Format doctor name cleanly without duplicate "Dr. Dr." prefix
const formatDoctorName = (name) => {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.toLowerCase().startsWith('dr.') || trimmed.toLowerCase().startsWith('dr ')) {
    return trimmed;
  }
  return `Dr. ${trimmed}`;
};

// Searchable Doctor Select / Combobox Component
const SearchableDoctorSelect = ({ doctors, value, onChange, label = 'Select Doctor *' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter doctors based on search text
  const filteredDoctors = doctors.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const nameMatch = d.full_name?.toLowerCase().includes(q);
    const specMatch = d.specialization?.toLowerCase().includes(q);
    const idMatch = d.doctor_id?.toString().includes(q);
    return nameMatch || specMatch || idMatch;
  });

  const selectedDoctor = doctors.find((d) => String(d.doctor_id) === String(value));

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-700 hover:border-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer text-left shadow-2xs"
      >
        <span className="truncate">
          {selectedDoctor
            ? `${formatDoctorName(selectedDoctor.full_name)} (${selectedDoctor.specialization || 'General'})`
            : '-- Select Doctor --'}
        </span>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setIsOpen(false);
              }}
              title="Clear doctor selection"
              className="hover:text-red-500 p-0.5 rounded cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu with Search Option */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 w-full bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in duration-100">
          {/* Search Input inside Dropdown */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search doctor by name or specialization..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Doctors List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 text-xs">
            {/* Reset / Default Option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-blue-50/60 transition-colors cursor-pointer ${
                !value ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-500'
              }`}
            >
              <span>-- Select Doctor --</span>
              {!value && <Check className="w-3.5 h-3.5 text-blue-600" />}
            </button>

            {filteredDoctors.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No doctors found matching "{search}"
              </div>
            ) : (
              filteredDoctors.map((d) => {
                const isSelected = String(d.doctor_id) === String(value);
                return (
                  <button
                    key={d.doctor_id}
                    type="button"
                    onClick={() => {
                      onChange(d.doctor_id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-blue-50/60 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-medium">{formatDoctorName(d.full_name)}</div>
                      {d.specialization && (
                        <div className="text-[10px] text-slate-400 truncate">{d.specialization}</div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const BillingConfigPage = () => {
  const [fees, setFees] = useState([]);
  const [rules, setRules] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fee matrix table search
  const [matrixSearch, setMatrixSearch] = useState('');

  // Fee modification form
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [feeForm, setFeeForm] = useState({
    new_consultation_fee: 500,
    renewal_consultation_fee: 300,
    followup_consultation_fee: 200,
  });
  const [savingFee, setSavingFee] = useState(false);

  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feesRes, rulesRes, docRes] = await Promise.all([
        billingApi.getConsultationFees(),
        billingApi.getBillingRules(),
        doctorsApi.getDoctors({ status: 'active' }),
      ]);

      if (feesRes.success) setFees(feesRes.data || []);
      if (rulesRes.success) setRules(rulesRes.data);
      if (docRes.success) setDoctors(docRes.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load billing configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDoctorSelect = (docId) => {
    setSelectedDoctorId(docId);
    if (docId) {
      const doc = doctors.find((d) => String(d.doctor_id) === String(docId));
      if (doc) {
        setFeeForm({
          new_consultation_fee: parseFloat(doc.new_consultation_fee) || 500,
          renewal_consultation_fee: parseFloat(doc.renewal_consultation_fee) || 300,
          followup_consultation_fee: parseFloat(doc.followup_consultation_fee) || 200,
        });
      }
    } else {
      setFeeForm({
        new_consultation_fee: 500,
        renewal_consultation_fee: 300,
        followup_consultation_fee: 200,
      });
    }
  };

  const handleFeeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      showToast('Please select a doctor', 'warning');
      return;
    }

    setSavingFee(true);
    try {
      const promises = [
        billingApi.setConsultationFee({
          doctor_id: parseInt(selectedDoctorId),
          appointment_type: 'new',
          fee_amount: parseFloat(feeForm.new_consultation_fee) || 0,
        }),
        billingApi.setConsultationFee({
          doctor_id: parseInt(selectedDoctorId),
          appointment_type: 'renewal',
          fee_amount: parseFloat(feeForm.renewal_consultation_fee) || 0,
        }),
        billingApi.setConsultationFee({
          doctor_id: parseInt(selectedDoctorId),
          appointment_type: 'followup',
          fee_amount: parseFloat(feeForm.followup_consultation_fee) || 0,
        }),
      ];

      await Promise.all(promises);
      showToast('Doctor consultation fees updated successfully', 'success');
      setSelectedDoctorId('');
      fetchData();
    } catch (err) {
      showToast(err.message || 'Failed to update consultation fees', 'error');
    } finally {
      setSavingFee(false);
    }
  };

  // Filtered fee matrix for table
  const filteredFees = fees.filter((f) => {
    if (!matrixSearch.trim()) return true;
    const q = matrixSearch.toLowerCase().trim();
    const docMatch = f.doctor_name?.toLowerCase().includes(q);
    const codeMatch = f.doctor_code?.toLowerCase().includes(q);
    const typeMatch = f.appointment_type?.toLowerCase().includes(q);
    return docMatch || codeMatch || typeMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <span>Billing Configuration & Consultation Fee Governance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure fee structures, approved discount thresholds, and accepted payment options
          </p>
        </div>
      </div>

      {/* Strict Role Segregation Notice */}
      <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
        <div className="space-y-1 text-blue-950 text-xs leading-relaxed">
          <span className="font-bold block">Hospital ERP Role Separation Policy</span>
          <p>
            • <strong>Receptionist:</strong> Authorized to collect <em>Consultation Fees only</em> upon patient registration/check-in.<br />
            • <strong>PRO / Manager:</strong> Authorized to handle <em>Treatment Billing, Package Plans, Discounts, and Accountant Duties</em>.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading billing matrices and financial rules..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Fees Table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Configured Consultation Fee Matrix
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">{filteredFees.length} active rates</span>
                </div>

                {/* Search option for fee matrix */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Search doctor or type..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Doctor</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Fee (₹)</th>
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredFees.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div>{formatDoctorName(f.doctor_name)}</div>
                          {f.doctor_code && (
                            <div className="text-[10px] text-slate-400 font-mono font-normal">
                              {f.doctor_code}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            f.appointment_type === 'new'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : f.appointment_type === 'renewal'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {f.appointment_type === 'new' ? 'NEW' : f.appointment_type === 'renewal' ? 'RENEWAL' : 'FOLLOW-UP'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          ₹{parseFloat(f.fee_amount || 0).toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          Karimnagar Main
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                            {f.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discount Rules */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Percent className="w-4 h-4 text-blue-600" />
                <span>Approved Discount Thresholds</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {(rules?.discount_rules || []).slice(0, 4).map((r) => (
                  <div key={r.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">{r.name}</div>
                      <div className="text-[11px] text-slate-500">Approver: {r.approver_role?.replace('_', ' ')}</div>
                    </div>
                    <span className="text-base font-mono font-black text-blue-700">{parseFloat(r.max_discount_pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fee Configuration Form */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
                Update Doctor Consultation Fees
              </h3>

              <form onSubmit={handleFeeSubmit} className="space-y-4 text-xs text-slate-700">
                {/* Searchable Doctor Dropdown */}
                <SearchableDoctorSelect
                  doctors={doctors}
                  value={selectedDoctorId}
                  onChange={handleDoctorSelect}
                  label="Select Doctor *"
                />

                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                    New Consultation Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={feeForm.new_consultation_fee}
                    onChange={(e) => setFeeForm({ ...feeForm, new_consultation_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                    Renewal Consultation Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={feeForm.renewal_consultation_fee}
                    onChange={(e) => setFeeForm({ ...feeForm, renewal_consultation_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                    Follow-up Consultation Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={feeForm.followup_consultation_fee}
                    onChange={(e) => setFeeForm({ ...feeForm, followup_consultation_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingFee || !selectedDoctorId}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingFee ? 'Updating...' : 'Save Consultation Fees'}
                </button>
              </form>
            </div>

            {/* Payment Methods */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Accepted Payment Methods</span>
              </h3>
              <div className="space-y-1.5 text-xs">
                {(rules?.payment_methods || []).map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold uppercase text-[11px] text-slate-700">{pm.method_name.replace('_', ' ')}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Enabled</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingConfigPage;
