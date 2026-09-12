import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { CalendarDays, Search, RefreshCw, Stethoscope, User, Clock, RotateCcw } from 'lucide-react';
import { ReassignDoctorModal } from '../../components/common/ReassignDoctorModal';

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-700',
  waiting: 'bg-amber-100 text-amber-700',
  checked_in: 'bg-sky-100 text-sky-700',
  in_consultation: 'bg-purple-100 text-purple-700',
  doctor_completed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-slate-100 text-slate-600',
};

export const DoctorAppointmentsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startingId, setStartingId] = useState(null);
  const [reassignAppt, setReassignAppt] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await doctorApi.getTodayAppointments({ date });
      if (res.success) setAppointments(res.data || []);
    } catch (err) {
      showToast('Failed to fetch appointments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(); }, [date]);

  const handleStartConsultation = async (appt) => {
    setStartingId(appt.appointment_id);
    try {
      const res = await doctorApi.startConsultation({ appointment_id: appt.appointment_id });
      if (res.success) {
        showToast(`Consultation started for ${appt.patient_name}`, 'success');
        navigate(`/doctor/consultation/${res.data.consultation_id}`, {
          state: { patient: appt, consultation: res.data }
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to start consultation', 'error');
    } finally {
      setStartingId(null);
    }
  };

  const handleResumeConsultation = async (appt) => {
    if (appt.consultation_id) {
      navigate(`/doctor/consultation/${appt.consultation_id}`, {
        state: { patient: appt }
      });
      return;
    }
    setStartingId(appt.appointment_id);
    try {
      const res = await doctorApi.startConsultation({ appointment_id: appt.appointment_id });
      if (res.success && res.data?.consultation_id) {
        showToast(`Resuming consultation for ${appt.patient_name}`, 'info');
        navigate(`/doctor/consultation/${res.data.consultation_id}`, {
          state: { patient: appt, consultation: res.data }
        });
      } else {
        showToast(res?.message || 'Unable to resume consultation', 'error');
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err.message || 'Failed to resume consultation', 'error');
    } finally {
      setStartingId(null);
    }
  };

  const filtered = appointments.filter(a => {
    // Search
    const matchesSearch = !search ||
      a.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.registration_id?.toLowerCase().includes(search.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'scheduled') matchesStatus = a.status === 'scheduled';
    else if (statusFilter === 'waiting') matchesStatus = ['waiting', 'checked_in'].includes(a.status);
    else if (statusFilter === 'in_consultation') matchesStatus = a.status === 'in_consultation';
    else if (statusFilter === 'completed') matchesStatus = ['doctor_completed', 'completed'].includes(a.status);
    else if (statusFilter === 'cancelled') matchesStatus = ['cancelled', 'no_show'].includes(a.status);

    // Type filter
    let matchesType = true;
    if (typeFilter !== 'all') {
      matchesType = a.appointment_type === typeFilter;
    }

    return matchesSearch && matchesStatus && matchesType;
  });

  const counts = {
    total: appointments.length,
    waiting: appointments.filter(a => ['waiting', 'checked_in'].includes(a.status)).length,
    inConsultation: appointments.filter(a => a.status === 'in_consultation').length,
    completed: appointments.filter(a => ['doctor_completed', 'completed'].includes(a.status)).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            Appointments
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Scheduled patients for the selected date</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Date Selectors */}
          <button
            type="button"
            onClick={() => setDate(todayStr)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
              date === todayStr
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDate(tomorrowStr)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
              date === tomorrowStr
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tomorrow
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-400 bg-white"
          />
          <button onClick={fetchAppointments} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.total, color: 'text-slate-800' },
          { label: 'Waiting', value: counts.waiting, color: 'text-amber-700' },
          { label: 'In Consultation', value: counts.inConsultation, color: 'text-purple-700' },
          { label: 'Completed', value: counts.completed, color: 'text-emerald-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3 text-center">
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient name or ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none bg-white"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-400 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="waiting">Waiting</option>
            <option value="in_consultation">In Consultation</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled / No-show</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Type:</span>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-400 bg-white"
          >
            <option value="all">All Types</option>
            <option value="new">New Patient</option>
            <option value="followup">Follow-up</option>
          </select>
        </div>

        {/* Clear Filters */}
        {(search || statusFilter !== 'all' || typeFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); }}
            className="text-xs text-red-600 hover:text-red-700 font-bold px-2 py-1"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner label="Loading appointments..." />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-12 text-center">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">No appointments found</p>
          <p className="text-xs text-slate-400 mt-1">No matching patients scheduled for the selected criteria</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Patient</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a, idx) => (
                  <tr key={a.appointment_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center">
                        {idx + 1}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{a.patient_name}</div>
                      <div className="text-[10px] text-slate-400">{a.registration_id} • {a.age}y • {a.gender}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3 h-3" />
                        {a.appointment_time || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        a.appointment_type === 'new' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {a.appointment_type === 'new' ? 'NEW' : 'FOLLOW-UP'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${statusColors[a.status] || 'bg-slate-100 text-slate-600'}`}>
                        {a.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Start or Resume button */}
                        {['waiting', 'checked_in', 'scheduled'].includes(a.status) ? (
                          <button
                            onClick={() => handleStartConsultation(a)}
                            disabled={startingId === a.appointment_id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            {startingId === a.appointment_id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Stethoscope className="w-3 h-3" />
                            )}
                            Start
                          </button>
                        ) : a.status === 'in_consultation' ? (
                          <button
                            onClick={() => handleResumeConsultation(a)}
                            disabled={startingId === a.appointment_id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            {startingId === a.appointment_id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Stethoscope className="w-3 h-3" />
                            )}
                            Resume
                          </button>
                        ) : null}

                        {/* View Patient Button — ALWAYS visible for all rows */}
                        <button
                          onClick={() => navigate('/doctor/patients', { state: { patient_id: a.patient_id } })}
                          title="View Patient 360 Record"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          <User className="w-3 h-3 text-slate-500" />
                          <span>View Patient</span>
                        </button>

                        {/* Reassign / Reschedule Doctor Button */}
                        {['waiting', 'checked_in', 'scheduled'].includes(a.status) && (
                          <button
                            onClick={() => setReassignAppt(a)}
                            title="Reassign to another Doctor or Reschedule Slot"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 text-indigo-600" />
                            <span>Reassign</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Doctor Reassign & Reschedule Modal */}
      {reassignAppt && (
        <ReassignDoctorModal
          isOpen={!!reassignAppt}
          onClose={() => setReassignAppt(null)}
          appointment={reassignAppt}
          role="doctor"
          onReassigned={() => {
            setReassignAppt(null);
            fetchAppointments();
          }}
        />
      )}
    </div>
  );
};
