import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Search,
  Phone,
  Calendar,
  FileText,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Pill,
  CheckCircle2,
  Clock,
  ExternalLink,
  X
} from 'lucide-react';

export const PharmacyPatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Selected patient for Dispensing History Modal
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const { showToast } = useToast();

  // Search debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch patients list
  const fetchPatients = useCallback(async (query = debouncedSearch) => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = (query || '').trim();
      const res = await pharmacyApi.searchPatients({
        search: trimmed || undefined,
      });
      if (res.success) {
        setPatients(res.data || []);
      } else {
        setError(res.message || 'Failed to search patients');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load patients';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, showToast]);

  useEffect(() => {
    fetchPatients(debouncedSearch);
  }, [debouncedSearch, fetchPatients]);

  // Fetch dispensing history for selected patient
  const fetchPatientDispensingHistory = async (patient) => {
    setSelectedPatient(patient);
    setHistoryLoading(true);
    setHistoryError(null);
    setPatientHistory([]);

    try {
      const res = await pharmacyApi.getDispensingHistory({
        patient_id: patient.patient_id,
      });
      if (res.success) {
        setPatientHistory(res.data || []);
      } else {
        setHistoryError(res.message || 'Failed to fetch dispensing history');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch dispensing records';
      setHistoryError(msg);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPatients(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    fetchPatients('');
  };

  const getStatusBadge = (status) => {
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

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pharmacy Patients Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Look up patient identity and pharmacy dispensing records (strictly excludes doctor clinical notes)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPatients(searchTerm)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-3 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <span className="font-bold">Patient Privacy Compliance:</span> In accordance with hospital clinical data
          governance, pharmacy staff are authorized to view patient contact details, demographics, and dispensing records.
          Doctor consultation notes, clinical diagnoses, and confidential treatment plans are securely restricted to clinical practitioners.
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Patient Name, Phone Number, or Registration ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition shrink-0 shadow-2xs"
          >
            Search
          </button>
        </form>

        {/* Search Results Summary */}
        {!loading && (
          <div className="mt-3 flex items-center justify-between text-2xs text-slate-500 px-1">
            <span>
              {searchTerm
                ? `Showing results for "${searchTerm}" (${patients.length} patient${patients.length === 1 ? '' : 's'} found)`
                : `Total ${patients.length} patient${patients.length === 1 ? '' : 's'} in directory`}
            </span>
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="text-blue-600 hover:underline font-semibold"
              >
                Reset Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchPatients(searchTerm)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Patients Directory Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col justify-center items-center gap-3">
            <LoadingSpinner size="md" />
            <span className="text-xs text-slate-500 font-medium">Searching patient records...</span>
          </div>
        ) : patients.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title={searchTerm ? 'No Patients Found' : 'Patients Directory Empty'}
              description={
                searchTerm
                  ? `No patient records match "${searchTerm}". Please verify the spelling or try searching by phone number.`
                  : 'No patients found for this branch in the directory.'
              }
            />
            {searchTerm && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleClearSearch}
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
                    <th className="p-4">Reg ID</th>
                    <th className="p-4">Patient Name</th>
                    <th className="p-4">Contact Number</th>
                    <th className="p-4">Age & Gender</th>
                    <th className="p-4">Address / City</th>
                    <th className="p-4 text-right">Dispensing History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.map((p) => {
                    const regId = p.registration_id || p.patient_id;
                    return (
                      <tr key={p.patient_id} className="hover:bg-slate-50/70 transition">
                        <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                          #{regId}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800 text-sm">{p.full_name}</div>
                          <div className="text-2xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Homeopathy Patient</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{p.mobile_number || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-600 whitespace-nowrap">
                          {p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : 'N/A'}
                          {p.age ? `, ${p.age} yrs` : ''}
                        </td>
                        <td className="p-4 text-slate-600 max-w-xs truncate">
                          <div className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{p.address || p.village || p.mandal || 'Local Branch Patient'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => fetchPatientDispensingHistory(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Dispenses</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {patients.map((p) => {
                const regId = p.registration_id || p.patient_id;
                return (
                  <div key={p.patient_id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{p.full_name}</div>
                        <div className="text-2xs text-slate-500 mt-0.5">
                          Reg #{regId} • {p.gender || 'N/A'}{p.age ? `, ${p.age} yrs` : ''}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        Homeopathy
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.mobile_number || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1 truncate text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{p.address || p.village || 'Local'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchPatientDispensingHistory(p)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Dispensing History</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* In-Page Dispensing History Modal */}
      <Modal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient ? `Dispensing Records — ${selectedPatient.full_name}` : 'Dispensing Records'}
        maxWidth="max-w-3xl"
      >
        {selectedPatient && (
          <div className="space-y-6">
            {/* Patient Header Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-base font-bold text-slate-800">{selectedPatient.full_name}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>Reg ID: #{selectedPatient.registration_id || selectedPatient.patient_id}</span>
                  <span>•</span>
                  <span>{selectedPatient.gender || 'N/A'}{selectedPatient.age ? `, ${selectedPatient.age} yrs` : ''}</span>
                  <span>•</span>
                  <span>{selectedPatient.mobile_number || 'No contact'}</span>
                </div>
              </div>
              <div className="text-2xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Confidential Dispense Audit</span>
              </div>
            </div>

            {/* Dispensing History Content */}
            {historyLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="md" />
                <span className="text-xs text-slate-500 font-medium">Fetching dispensing history...</span>
              </div>
            ) : historyError ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-800 text-xs">
                <span>{historyError}</span>
                <button
                  onClick={() => fetchPatientDispensingHistory(selectedPatient)}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700"
                >
                  Retry
                </button>
              </div>
            ) : patientHistory.length === 0 ? (
              <div className="py-8 text-center">
                <EmptyState
                  icon={Pill}
                  title="No Dispensing Records Found"
                  description="This patient has no prescriptions dispensed or processed yet in the pharmacy."
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Prescription Dispense Log ({patientHistory.length} record{patientHistory.length === 1 ? '' : 's'})
                </div>

                <div className="space-y-3">
                  {patientHistory.map((rx) => {
                    const rxId = rx.prescription_id || rx.id;
                    const items = rx.items || [];
                    return (
                      <div
                        key={rxId}
                        className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3"
                      >
                        {/* Rx Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-800">
                              Prescription #{rxId}
                            </span>
                            {getStatusBadge(rx.status || rx.pharmacy_status)}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {rx.prescription_date
                                  ? new Date(rx.prescription_date).toLocaleDateString()
                                  : 'N/A'}
                              </span>
                            </div>
                            <span>•</span>
                            <span className="font-medium text-slate-700">
                              {rx.doctor_name ? `Dr. ${rx.doctor_name}` : 'Doctor'}
                            </span>
                          </div>
                        </div>

                        {/* Medicine Items List */}
                        {items.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="text-2xs font-bold text-slate-500 uppercase border-b border-slate-100">
                                  <th className="py-1.5 pr-2">Medicine</th>
                                  <th className="py-1.5 px-2">Potency</th>
                                  <th className="py-1.5 px-2">Dosage / Freq</th>
                                  <th className="py-1.5 px-2 text-center">Prescribed</th>
                                  <th className="py-1.5 px-2 text-center">Dispensed</th>
                                  <th className="py-1.5 px-2">Batch #</th>
                                  <th className="py-1.5 pl-2 text-right">Item Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 text-slate-700">
                                {items.map((item, idx) => (
                                  <tr key={item.item_id || idx} className="hover:bg-slate-50/50">
                                    <td className="py-2 pr-2 font-semibold text-slate-800">
                                      {item.medicine_name}
                                    </td>
                                    <td className="py-2 px-2 text-slate-600">
                                      {item.potency || '—'}
                                    </td>
                                    <td className="py-2 px-2 text-slate-600">
                                      {item.dosage || 'Standard'}
                                    </td>
                                    <td className="py-2 px-2 text-center font-bold text-slate-700">
                                      {item.quantity}
                                    </td>
                                    <td className="py-2 px-2 text-center font-bold text-emerald-700">
                                      {item.dispensed_quantity ?? item.quantity}
                                    </td>
                                    <td className="py-2 px-2 text-slate-600 font-mono text-2xs">
                                      {item.batch_number || '—'}
                                    </td>
                                    <td className="py-2 pl-2 text-right">
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
                        ) : (
                          <div className="text-xs text-slate-400 italic py-1">
                            No individual item lines recorded.
                          </div>
                        )}

                        {/* Prescription Action */}
                        <div className="flex justify-end pt-1">
                          <Link
                            to={`/pharmacy/prescriptions/${rxId}/process`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <span>Open Prescription Workspace</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Link
                to={`/pharmacy/dispensing/history?patient_id=${selectedPatient.patient_id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Dispensing Hub</span>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
