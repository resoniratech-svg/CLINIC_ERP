import React, { useEffect, useState } from 'react';
import { receptionistApi } from '../../api';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { toLocalDateString, getTodayDateString, formatDisplayDate } from '../../utils/dateUtils';
import { Users, Search, Eye, Calendar, RotateCcw, Stethoscope, Clock, Phone, AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';

export const PatientsMonitoringPage = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // From - To Exact Date Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Patient overview modal
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const { showToast } = useToast();

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const queryParam = searchTerm.trim() || '%';
      const res = await receptionistApi.searchPatients({ search: queryParam });
      if (res.success) {
        const list = res.data?.patients || (Array.isArray(res.data) ? res.data : []);
        setPatients(list);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch patients directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleOpenOverview = async (patientId) => {
    setSelectedPatientId(patientId);
    setLoadingOverview(true);
    try {
      const res = await receptionistApi.getPatientOverview(patientId);
      if (res.success) {
        setOverview(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch patient overview', 'error');
    } finally {
      setLoadingOverview(false);
    }
  };

  const handleSetToday = () => {
    const today = getTodayDateString();
    setFromDate(today);
    setToDate(today);
  };

  const handleResetDates = () => {
    setFromDate('');
    setToDate('');
  };

  // Day-accurate filtering based on registration date / created_at
  const filteredPatients = patients.filter((p) => {
    const rawDate = p.registration_date || p.created_at;
    const itemDateStr = toLocalDateString(rawDate);

    if (fromDate && itemDateStr && itemDateStr < fromDate) return false;
    if (toDate && itemDateStr && itemDateStr > toDate) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Patient Registry Surveillance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Surveillance of all registered patients, assigned consulting doctors, and registration dates
          </p>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, mobile, or registration #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* From to To Day-by-Day Date Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Registration Date:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSetToday}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Today
          </button>

          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={handleResetDates}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          )}
        </div>

        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-blue-700 font-mono">{filteredPatients.length}</span> of{' '}
          <span className="font-bold text-slate-800 font-mono">{patients.length}</span> patients
        </div>
      </div>

      {/* Patient Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading patients from database..." />
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            title="No patients found"
            description={
              fromDate || toDate
                ? `No patient registrations found between ${fromDate || 'earliest'} and ${toDate || 'latest'}. Try adjusting your dates.`
                : 'Adjust your search criteria to view registered patients.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Demographics</th>
                  <th className="py-3 px-4">Registration Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPatients.map((p) => {
                  const rawDate = p.registration_date || p.created_at;
                  return (
                    <tr key={p.patient_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{p.full_name}</div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {p.registration_id || `#${p.patient_id}`}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700 font-medium">
                        {p.mobile_number}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 capitalize">
                        {p.age ? `${p.age} yrs` : '—'} • {p.gender || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium font-mono">
                        {formatDisplayDate(rawDate)}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={p.registration_status || 'active'}>
                          {p.registration_status || 'active'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenOverview(p.patient_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer border border-blue-200"
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

      {/* Modal: Patient Overview */}
      <Modal
        isOpen={!!selectedPatientId}
        onClose={() => {
          setSelectedPatientId(null);
          setOverview(null);
        }}
        title={`Patient Clinical & Financial Overview`}
        maxWidth="max-w-2xl"
      >
        {loadingOverview || !overview ? (
          <LoadingSpinner label="Compiling patient overview..." />
        ) : (
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">{overview.patient?.full_name}</h3>
                <div className="text-slate-500 text-[11px] mt-0.5 font-mono">
                  Reg: {overview.patient?.registration_id || `#${overview.patient?.patient_id}`} • Mobile: {overview.patient?.mobile_number}
                </div>
                <div className="text-slate-400 text-[10px] mt-0.5 capitalize">
                  {overview.patient?.age ? `${overview.patient?.age} Yrs` : ''} {overview.patient?.gender ? `• ${overview.patient?.gender}` : ''} {overview.patient?.address ? `• ${overview.patient?.address}` : ''}
                </div>
              </div>
              <Badge variant={overview.registration_status || 'active'}>
                {overview.registration_status?.toUpperCase() || 'ACTIVE'}
              </Badge>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Visits</span>
                <span className="text-lg font-bold text-slate-900 block mt-1 font-mono">
                  {overview.previous_visits?.length || 0}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Prescriptions</span>
                <span className="text-lg font-bold text-slate-900 block mt-1 font-mono">
                  {overview.previous_prescriptions?.length || 0}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Recent Calls</span>
                <span className="text-lg font-bold text-slate-900 block mt-1 font-mono">
                  {overview.recent_calls?.length || 0}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Due Balance</span>
                <span className="text-lg font-bold text-red-600 block mt-1 font-mono">
                  ₹{overview.due_amount || 0}
                </span>
              </div>
            </div>

            {/* Upcoming Appointment Section if present */}
            {overview.upcoming_appointment && (
              <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Next Scheduled Consultation</span>
                </div>
                <div className="text-[11px] text-blue-800">
                  <strong>Dr. {overview.upcoming_appointment.doctor_name}</strong> ({overview.upcoming_appointment.specialization || 'Consultant'}) on{' '}
                  <span className="font-mono font-bold">{formatDisplayDate(overview.upcoming_appointment.appointment_date)}</span> at{' '}
                  <span className="font-mono">{overview.upcoming_appointment.appointment_time?.slice(0, 5) || '10:00'}</span>
                </div>
              </div>
            )}

            {/* Previous Clinical Consultations */}
            {overview.previous_visits && overview.previous_visits.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Recent Consultations
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {overview.previous_visits.map((v, i) => (
                    <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-semibold text-slate-800">Dr. {v.doctor_name}</span>
                        <span className="text-slate-400 ml-2 font-mono">{formatDisplayDate(v.appointment_date)}</span>
                      </div>
                      <Badge variant={v.status}>{v.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
