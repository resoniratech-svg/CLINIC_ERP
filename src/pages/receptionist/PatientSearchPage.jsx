import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { PatientOverviewModal } from './PatientOverviewModal';
import { PatientInvoiceReceiptModal } from './PatientInvoiceReceiptModal';
import { EditPatientModal } from '../../components/common/EditPatientModal';
import {
  Search,
  UserPlus,
  Phone,
  User,
  Calendar,
  Eye,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  FileText,
  Edit2
} from 'lucide-react';

export const PatientSearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedInvoicePatient, setSelectedInvoicePatient] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      showToast('Please enter mobile number, patient name, or registration ID', 'warning');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await receptionistApi.searchPatients({ search: searchTerm.trim() });
      if (res.success) {
        setPatients(res.data?.patients || []);
      }
    } catch (err) {
      showToast(err.message || 'Search query failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDocName = (name) => {
    if (!name) return 'General OPD';
    const trimmed = name.trim();
    if (trimmed === 'General OPD') return 'General OPD';
    return trimmed.startsWith('Dr.') ? trimmed : `Dr. ${trimmed}`;
  };

  const handleClear = () => {
    setSearchTerm('');
    setHasSearched(false);
    loadInitial();
  };

  const loadInitial = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.searchPatients({ limit: 50 });
      if (res.success) {
        setPatients(res.data?.patients || []);
      }
    } catch (e) {
      // silent initial load fail
    } finally {
      setLoading(false);
    }
  };

  // Load initial active patients
  useEffect(() => {
    loadInitial();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            <span>Patient Search & Central Overview</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search existing patients by Mobile (Primary), Registration ID, or Name to avoid duplication.
          </p>
        </div>

        <Link
          to="/receptionist/patients/register"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ New Patient Registration</span>
        </Link>
      </div>

      {/* Primary Search Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Mobile Number (Primary), Reg ID (e.g. REG-00001), or Patient Name..."
              className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Clear Search"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 shadow-sm"
          >
            {loading ? 'Searching...' : 'Search Patient'}
          </button>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Quick Tips:</span>
            <span>Entering a 10-digit mobile number instantly verifies if the patient is New or Existing.</span>
          </div>
          {patients.length > 0 && (
            <span className="font-mono font-bold text-slate-600">
              Showing {patients.length} patient record{patients.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Search Results Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Searching patient registry..." />
        ) : patients.length === 0 ? (
          <div className="p-10 text-center space-y-4">
            <EmptyState
              title={hasSearched ? 'No matching patient records found' : 'No patients loaded'}
              description={
                hasSearched
                  ? 'The mobile number or query is not registered in the system. You can onboard this as a New Patient.'
                  : 'Enter a search term above or click New Patient Registration.'
              }
            />
            {hasSearched && (
              <button
                onClick={() => navigate('/receptionist/patients/register', { state: { initialMobile: searchTerm } })}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register as New Patient</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Patient Profile</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Demographics</th>
                  <th className="py-3.5 px-4">Current Doctor</th>
                  <th className="py-3.5 px-4">Validity Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {patients.map((p) => {
                  const patientName = p.full_name || p.patient_name || 'Patient';
                  const regExpiry = p.registration_expiry || p.expiry_date;
                  const isExp = p.registration_status === 'expired' || (regExpiry && new Date(regExpiry) < new Date());
                  const location = p.village || p.village_mandal || 'Hyderabad';
                  const doctorName = p.current_doctor_name || p.doctor_name;

                  return (
                    <tr key={p.patient_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{patientName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {p.registration_id || `REG-${String(p.patient_id).padStart(5, '0')}`} • #{p.patient_id}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-800">{p.mobile_number}</div>
                        <div className="text-[11px] text-slate-500">{location}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        {p.age ? `${p.age} yrs` : '—'} • <span className="capitalize">{p.gender || '—'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">
                          {formatDocName(doctorName)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isExp ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isExp ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          <span>{isExp ? 'Expired' : 'Active'}</span>
                        </span>
                        {regExpiry && (
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                            Exp: {regExpiry.slice(0, 10)}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setEditingPatient(p)}
                          title="Edit Patient Demographic Details"
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] border border-amber-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => setSelectedInvoicePatient(p)}
                          title="View & Print Consultation Invoice Receipt"
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] border border-emerald-200"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                        </button>

                        <button
                          onClick={() => setSelectedPatientId(p.patient_id)}
                          title="Open 360° Overview"
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] border border-blue-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Overview</span>
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

      {/* Central Patient Overview Modal */}
      <PatientOverviewModal
        isOpen={!!selectedPatientId}
        onClose={() => setSelectedPatientId(null)}
        patientId={selectedPatientId}
        onActionTriggered={() => handleSearch()}
      />

      {/* Patient Consultation Invoice & Cash Memo Modal */}
      <PatientInvoiceReceiptModal
        isOpen={!!selectedInvoicePatient}
        onClose={() => setSelectedInvoicePatient(null)}
        patient={selectedInvoicePatient}
      />

      {/* Edit Patient Demographic Details Modal */}
      <EditPatientModal
        isOpen={!!editingPatient}
        onClose={() => setEditingPatient(null)}
        patient={editingPatient}
        onPatientUpdated={() => handleSearch()}
      />
    </div>
  );
};
