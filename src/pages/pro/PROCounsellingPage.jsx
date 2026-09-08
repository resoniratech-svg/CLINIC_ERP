import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  MessagesSquare,
  Plus,
  Search,
  Filter,
  RefreshCw,
  User,
  Calendar,
  Clock,
  CheckCircle,
  FileText,
  ChevronDown,
  X,
  AlertCircle
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const COUNSELLING_TYPES = [
  { value: 'treatment', label: 'Treatment Counselling' },
  { value: 'medication', label: 'Medication Counselling' },
  { value: 'package', label: 'Package Counselling' },
  { value: 'procedure', label: 'Procedure Counselling' },
  { value: 'followup', label: 'Follow-up Counselling' },
  { value: 'general', label: 'General Counselling' },
  { value: 'other', label: 'Other Counselling' }
];

export const PROCounsellingPage = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const urlPatientId = searchParams.get('patient_id');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(!!urlPatientId);

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

  // Form State
  const [form, setForm] = useState({
    patient_id: urlPatientId || '',
    counselling_type: 'treatment',
    notes: '',
    patient_understanding: 'good',
    patient_response: '',
    remarks: ''
  });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = urlPatientId ? { patient_id: urlPatientId } : {};
      const res = await proApi.getCounsellingHistory(params);
      if (res.success) {
        setRecords(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load counselling history', 'error');
    } finally {
      setLoading(false);
    }
  }, [urlPatientId, showToast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Handle URL patient_id pre-population
  useEffect(() => {
    if (urlPatientId) {
      const pId = parseInt(urlPatientId);
      if (!isNaN(pId)) {
        setForm(prev => ({ ...prev, patient_id: String(pId) }));
        // Look up patient name/details to show in the selector
        proApi.searchPatients({ patient_id: pId })
          .then(res => {
            if (res.success && res.data && res.data.length > 0) {
              const pt = res.data[0];
              setSelectedPatient(pt);
              setPatientSearchTerm(pt.full_name || pt.patient_name || `Patient #${pt.patient_id}`);
            } else {
              // Fallback to overview if search returned empty
              proApi.getPatientOverview(pId)
                .then(ovRes => {
                  if (ovRes.success && ovRes.data?.patient) {
                    const pt = ovRes.data.patient;
                    setSelectedPatient(pt);
                    setPatientSearchTerm(pt.full_name || pt.patient_name || `Patient #${pt.patient_id}`);
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
    // Don't search if the input matches the selected patient's display name
    if (selectedPatient && patientSearchTerm === (selectedPatient.full_name || selectedPatient.patient_name || `Patient #${selectedPatient.patient_id}`)) {
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
          setPatientSearchTerm(selectedPatient.full_name || selectedPatient.patient_name || `Patient #${selectedPatient.patient_id}`);
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
    setPatientSearchTerm(pt.full_name || pt.patient_name || `Patient #${pt.patient_id}`);
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
    setShowModal(false);
    setIsSelectorOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pid = parseInt(form.patient_id);
    if (!pid || isNaN(pid)) {
      showToast('Please select a valid patient from the list', 'error');
      return;
    }
    if (!form.notes.trim()) {
      showToast('Counselling notes are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.createCounselling({
        ...form,
        patient_id: pid
      });
      if (res.success) {
        showToast('Counselling session recorded successfully', 'success');
        setShowModal(false);
        setIsSelectorOpen(false);
        setSelectedPatient(null);
        setPatientSearchTerm('');
        setForm({
          patient_id: '',
          counselling_type: 'treatment',
          notes: '',
          patient_understanding: 'good',
          patient_response: '',
          remarks: ''
        });
        fetchHistory();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to save counselling record', 'error');
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
            <MessagesSquare className="w-5 h-5 text-[#1565C0]" />
            <span>Patient Counselling Hub</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record treatment and medication counselling sessions with patients
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 btn-brand-gradient font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Counselling</span>
          </button>
        </div>
      </div>

      {/* Counselling Records Table */}
      {loading ? (
        <LoadingSpinner label="Loading counselling history..." />
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <MessagesSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No counselling records found</p>
          <p className="text-xs text-slate-400 mt-1">
            Click "+ Record Counselling" to log a patient counselling session.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Counselling Type</th>
                  <th className="py-3.5 px-4">Understanding</th>
                  <th className="py-3.5 px-4">Counsellor</th>
                  <th className="py-3.5 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(rec => (
                  <tr key={rec.counselling_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                      <div className="font-bold text-slate-800">
                        {rec.counselling_date ? new Date(rec.counselling_date).toLocaleDateString() : 'Today'}
                      </div>
                      <div className="text-[10px] text-slate-400">{rec.counselling_time}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/pro/patients/${rec.patient_id}`}
                        className="font-bold text-[#1565C0] hover:underline"
                      >
                        {rec.patient_name || `Patient #${rec.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 capitalize">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1565C0] border border-blue-200/60">
                        {rec.counselling_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 capitalize">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        rec.patient_understanding === 'good' || rec.patient_understanding === 'agreed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {rec.patient_understanding}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {rec.counselled_by_name || 'PRO Manager'}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                      {rec.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Counselling Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-[#1565C0] flex items-center gap-2">
                <MessagesSquare className="w-4 h-4 text-[#1565C0]" />
                <span>Record Counselling Session</span>
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Counselling Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.counselling_type}
                    onChange={e => setForm({ ...form, counselling_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white"
                  >
                    {COUNSELLING_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Patient Understanding <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.patient_understanding}
                    onChange={e => setForm({ ...form, patient_understanding: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none bg-white"
                  >
                    <option value="good">Good / Agreed</option>
                    <option value="partial">Partial</option>
                    <option value="poor">Poor / Needs Review</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Counselling Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Details of instructions, package explanation, dosage guidance given to patient..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Patient Response / Remarks</label>
                <input
                  type="text"
                  value={form.patient_response}
                  onChange={e => setForm({ ...form, patient_response: e.target.value })}
                  placeholder="e.g. Agreed to 6-month package, asked about diet restrictions"
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
                  {submitting ? 'Saving...' : 'Save Counselling Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
