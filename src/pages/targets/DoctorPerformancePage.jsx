import React, { useEffect, useState, useRef } from 'react';
import { targetsApi, doctorsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Award,
  Search,
  Plus,
  Eye,
  Edit3,
  Calendar,
  Building,
  Target,
  TrendingUp,
  Stethoscope,
  DollarSign,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  X,
  Check
} from 'lucide-react';

export const DoctorPerformancePage = () => {
  const [performance, setPerformance] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [viewingDoc, setViewingDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editForm, setEditForm] = useState({
    enquiry_target: 0,
    unit_target: 0,
    referral_target: 0,
    revenue_target: 0,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Assign Doctor Quota form (right panel)
  const [selectedDocId, setSelectedDocId] = useState('');
  const [docForm, setDocForm] = useState({
    enquiry_target: 50000,
    unit_target: 75000,
    referral_target: 25000,
    revenue_target: 150000,
  });
  const [savingTarget, setSavingTarget] = useState(false);

  const { showToast } = useToast();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [perfRes, docRes] = await Promise.all([
        targetsApi.getDoctorPerformance({ month, year }),
        doctorsApi.getDoctors({ status: 'active' }),
      ]);

      if (perfRes.success) setPerformance(perfRes.data || []);
      if (docRes.success) setDoctors(docRes.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch doctor performance data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const handleDocTargetSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDocId) {
      showToast('Please select an active doctor', 'warning');
      return;
    }

    setSavingTarget(true);
    try {
      const res = await targetsApi.setDoctorTarget({
        doctor_id: parseInt(selectedDocId),
        month,
        year,
        enquiry_target: parseFloat(docForm.enquiry_target) || 0,
        unit_target: parseFloat(docForm.unit_target) || 0,
        referral_target: parseFloat(docForm.referral_target) || 0,
        revenue_target: parseFloat(docForm.revenue_target) || 0,
      });

      if (res.success) {
        showToast('Doctor quota assigned successfully', 'success');
        setSelectedDocId('');
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to assign doctor quota', 'error');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleOpenEdit = (doc) => {
    setEditingDoc(doc);
    setEditForm({
      enquiry_target: doc.enquiry_target || 0,
      unit_target: doc.unit_target || 0,
      referral_target: doc.referral_target || 0,
      revenue_target: doc.revenue_target || (doc.enquiry_target + doc.unit_target) || 0,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;

    setSavingEdit(true);
    try {
      const res = await targetsApi.setDoctorTarget({
        doctor_id: editingDoc.doctor_id,
        month,
        year,
        enquiry_target: parseFloat(editForm.enquiry_target) || 0,
        unit_target: parseFloat(editForm.unit_target) || 0,
        referral_target: parseFloat(editForm.referral_target) || 0,
        revenue_target: parseFloat(editForm.revenue_target) || 0,
      });

      if (res.success) {
        showToast(`Target updated for ${editingDoc.doctor_name}`, 'success');
        setEditingDoc(null);
        fetchData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update doctor target', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const getCleanDocName = (name) => {
    if (!name) return 'Doctor';
    return name.startsWith('Dr.') ? name : `Dr. ${name}`;
  };

  const SearchableQuotaDoctorSelect = ({ doctors, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          setIsOpen(false);
        }
      };
      if (isOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
      if (isOpen && searchInputRef.current) searchInputRef.current.focus();
    }, [isOpen]);

    const filteredDoctors = doctors.filter((d) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        d.full_name?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q) ||
        d.doctor_id?.toString().includes(q)
      );
    });

    const selectedDoctor = doctors.find((d) => String(d.doctor_id) === String(value));

    return (
      <div className="relative" ref={dropdownRef}>
        <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
          Select Active Doctor *
        </label>
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
              ? `${getCleanDocName(selectedDoctor.full_name)} (${selectedDoctor.specialization || 'General'})`
              : '-- Select Active Doctor --'}
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

        {isOpen && (
          <div className="absolute left-0 right-0 mt-1 w-full bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in duration-100">
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

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 text-xs">
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
                <span>-- Select Active Doctor --</span>
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
                        <div className="truncate font-medium">{getCleanDocName(d.full_name)}</div>
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

  const filteredPerf = performance.filter((p) =>
    p.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.specialization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.doctor_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            <span>Doctor Target Quota & Performance Surveillance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluate individual doctor achievements across new enquiries, units, referrals, and collected revenue
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {monthNames.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-20 px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Performance Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search doctors by name, code, or specialization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <LoadingSpinner label="Loading doctor performance quotas..." />
            ) : filteredPerf.length === 0 ? (
              <EmptyState
                title="No performance records"
                description={`No doctor performance records found for ${monthNames[month - 1]} ${year}.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Doctor</th>
                      <th className="py-3.5 px-4">Revenue Quota</th>
                      <th className="py-3.5 px-4">Achieved</th>
                      <th className="py-3.5 px-4">Achievement %</th>
                      <th className="py-3.5 px-4">Progress</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredPerf.map((p) => {
                      const pct = p.achievement_pct || 0;
                      return (
                        <tr key={p.doctor_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{getCleanDocName(p.doctor_name)}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {p.doctor_code || `DOC-${p.doctor_id}`} • {p.specialization}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                            {formatCurrency(p.revenue_target)}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                            {formatCurrency(p.achieved_revenue)}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`font-mono font-bold ${pct >= 100 ? 'text-emerald-700' : pct >= 50 ? 'text-blue-700' : 'text-slate-700'}`}>
                              {pct}%
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${pct >= 100 ? 'bg-emerald-600' : 'bg-gradient-to-r from-blue-600 to-red-600'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => setViewingDoc(p)}
                              title="View Target & Performance Details"
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenEdit(p)}
                              title="Edit Revenue Quota"
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Allocate Doctor Quota Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs h-fit">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Assign Doctor Quota</span>
          </h3>

          <form onSubmit={handleDocTargetSubmit} className="space-y-4 text-xs text-slate-700">
            <SearchableQuotaDoctorSelect
              doctors={doctors}
              value={selectedDocId}
              onChange={setSelectedDocId}
            />

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Total Revenue Target (₹) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={docForm.revenue_target}
                onChange={(e) => setDocForm({ ...docForm, revenue_target: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Enquiry Quota (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={docForm.enquiry_target}
                  onChange={(e) => setDocForm({ ...docForm, enquiry_target: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Unit Quota (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={docForm.unit_target}
                  onChange={(e) => setDocForm({ ...docForm, unit_target: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">Referral Quota (₹)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={docForm.referral_target}
                onChange={(e) => setDocForm({ ...docForm, referral_target: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Contributes toward Unit Target achievement</p>
            </div>

            <button
              type="submit"
              disabled={savingTarget}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {savingTarget ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Assigning Quota...</span>
                </>
              ) : (
                <span>Assign Doctor Quota</span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* VIEW DOCTOR PERFORMANCE MODAL */}
      {viewingDoc && (
        <Modal
          isOpen={!!viewingDoc}
          onClose={() => setViewingDoc(null)}
          title={`Doctor Target & Performance — ${monthNames[month - 1]} ${year}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 text-xs text-slate-700">
            {/* Doctor Profile Header */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-base shadow-xs">
                  <Stethoscope className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{getCleanDocName(viewingDoc.doctor_name)}</h4>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {viewingDoc.doctor_code || `DOC-${viewingDoc.doctor_id}`} • {viewingDoc.specialization}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Assigned Branch
                </span>
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1 justify-end">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  {viewingDoc.branch_name || 'Karimnagar Main Branch'}
                </span>
              </div>
            </div>

            {/* Target vs Achievement Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block mb-1">
                  Revenue Target
                </span>
                <span className="text-sm font-black font-mono text-blue-950">
                  {formatCurrency(viewingDoc.revenue_target)}
                </span>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block mb-1">
                  Achieved Revenue
                </span>
                <span className="text-sm font-black font-mono text-emerald-950">
                  {formatCurrency(viewingDoc.achieved_revenue)}
                </span>
              </div>

              <div className="p-3.5 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block mb-1">
                  Achievement %
                </span>
                <span className="text-sm font-black font-mono text-purple-950">
                  {viewingDoc.achievement_pct}%
                </span>
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-1">
                  Referral Quota
                </span>
                <span className="text-sm font-black font-mono text-amber-950">
                  {formatCurrency(viewingDoc.referral_target)}
                </span>
              </div>
            </div>

            {/* Quota Breakdown Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-200 flex items-center justify-between">
                <span>Quota Parameter</span>
                <span>Assigned Allocation</span>
              </div>
              <div className="divide-y divide-slate-100 p-2 text-xs">
                <div className="flex justify-between py-2 px-2">
                  <div>
                    <span className="text-slate-600 font-medium">New Enquiry Revenue Quota</span>
                    {viewingDoc.enquiry_achieved !== undefined && (
                      <span className="block text-[11px] text-slate-400">
                        Achieved: {formatCurrency(viewingDoc.enquiry_achieved)} ({viewingDoc.enquiry_pct || 0}%)
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(viewingDoc.enquiry_target)}</span>
                </div>
                <div className="flex justify-between py-2 px-2">
                  <div>
                    <span className="text-slate-600 font-medium">Unit / Renewal Quota</span>
                    {viewingDoc.unit_achieved !== undefined && (
                      <span className="block text-[11px] text-slate-400">
                        Achieved: {formatCurrency(viewingDoc.unit_achieved)} (Direct Unit: {formatCurrency(viewingDoc.direct_unit_achieved || 0)} + Referral: {formatCurrency(viewingDoc.referral_achieved || 0)})
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(viewingDoc.unit_target)}</span>
                </div>
                <div className="flex justify-between py-2 px-2">
                  <div>
                    <span className="text-slate-600 font-medium">Patient Referral Quota</span>
                    <span className="block text-[10px] text-amber-600 font-medium">
                      Contributes under Unit Target achievement
                    </span>
                    {viewingDoc.referral_achieved !== undefined && (
                      <span className="block text-[11px] text-slate-400">
                        Referral Revenue Achieved: {formatCurrency(viewingDoc.referral_achieved)}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-800">{formatCurrency(viewingDoc.referral_target)}</span>
                </div>
                <div className="flex justify-between py-2 px-2 bg-slate-50/80 font-bold rounded-xl">
                  <div>
                    <span className="text-slate-900">Total Assigned Revenue Quota</span>
                    {viewingDoc.achieved_revenue !== undefined && (
                      <span className="block text-[11px] text-emerald-600 font-medium">
                        Total Achieved: {formatCurrency(viewingDoc.achieved_revenue)} ({viewingDoc.achievement_pct || 0}%)
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-blue-700">{formatCurrency(viewingDoc.revenue_target)}</span>
                </div>
              </div>
            </div>

            {/* Progress Bar Display */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-slate-600">Target Achievement Progress</span>
                <span className="font-mono text-blue-700">{viewingDoc.achievement_pct}% of Target</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 transition-all duration-500"
                  style={{ width: `${Math.min(viewingDoc.achievement_pct, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setViewingDoc(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* EDIT DOCTOR TARGET MODAL */}
      {editingDoc && (
        <Modal
          isOpen={!!editingDoc}
          onClose={() => setEditingDoc(null)}
          title={`Edit Doctor Target — ${monthNames[month - 1]} ${year}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
              <div className="font-bold text-slate-900 text-xs">{getCleanDocName(editingDoc.doctor_name)}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                {editingDoc.doctor_code || `DOC-${editingDoc.doctor_id}`} • {editingDoc.specialization}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Total Revenue Target (₹) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={editForm.revenue_target}
                onChange={(e) => setEditForm({ ...editForm, revenue_target: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                  Enquiry Quota (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editForm.enquiry_target}
                  onChange={(e) => setEditForm({ ...editForm, enquiry_target: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                  Unit Quota (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editForm.unit_target}
                  onChange={(e) => setEditForm({ ...editForm, unit_target: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Referral Quota (₹)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={editForm.referral_target}
                onChange={(e) => setEditForm({ ...editForm, referral_target: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Contributes toward Unit Target achievement</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingEdit}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Update Target</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
