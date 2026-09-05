import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import {
  UserCheck,
  Clock,
  Search,
  RefreshCw,
  Users,
  Stethoscope,
  Building,
  CheckCircle2,
  Calendar,
  Filter,
  Sparkles,
  X
} from 'lucide-react';

export const CheckinQueuePage = () => {
  const location = useLocation();
  const [waitingList, setWaitingList] = useState([]);
  const [scheduledList, setScheduledList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(location.state?.doctorName || 'ALL');
  const [highlightedAppointmentId, setHighlightedAppointmentId] = useState(location.state?.appointmentId || null);
  const { showToast } = useToast();

  // Sync state if navigation location changes
  useEffect(() => {
    if (location.state?.doctorName) {
      setSelectedDoctor(location.state.doctorName);
    }
    if (location.state?.appointmentId) {
      setHighlightedAppointmentId(location.state.appointmentId);
    }
  }, [location.state]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [waitRes, schedRes] = await Promise.all([
        receptionistApi.getWaitingQueue(),
        receptionistApi.getAppointments({ date: today, status: 'scheduled' }),
      ]);

      if (waitRes.success) setWaitingList(waitRes.data || []);
      if (schedRes.success) setScheduledList(schedRes.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load waiting queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000); // Poll every 30s for live OPD queue
    return () => clearInterval(interval);
  }, []);

  const handleCheckin = async (appointmentId) => {
    try {
      const res = await receptionistApi.checkinAppointment(appointmentId);
      if (res.success) {
        showToast('Patient checked-in successfully! Added to doctor waiting lounge.', 'success');
        fetchQueue();
      }
    } catch (err) {
      showToast(err.message || 'Check-in failed', 'error');
    }
  };

  // Derive unique doctor list from queue
  const availableDoctors = useMemo(() => {
    const names = new Set();
    waitingList.forEach((w) => {
      if (w.doctor_name) names.add(w.doctor_name);
    });
    scheduledList.forEach((s) => {
      if (s.doctor_name) names.add(s.doctor_name);
    });
    if (location.state?.doctorName) {
      names.add(location.state.doctorName);
    }
    return Array.from(names).sort();
  }, [waitingList, scheduledList, location.state]);

  const filteredWaiting = waitingList.filter((w) => {
    const matchesDoctor =
      selectedDoctor === 'ALL' || !selectedDoctor
        ? true
        : w.doctor_name?.toLowerCase() === selectedDoctor.toLowerCase();

    const matchesSearch =
      !searchTerm.trim() ||
      w.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.mobile_number?.includes(searchTerm) ||
      w.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.registration_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(w.appointment_id).includes(searchTerm);

    return matchesDoctor && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-600" />
            <span>Check-in & Live Doctor Waiting Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time OPD lounge monitoring: Mark arriving patients as Checked-in to route to Doctor Consultation Queue.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Main Grid: Waiting Queue vs Scheduled Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live Waiting Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Checked-in Waiting Lounge ({filteredWaiting.length})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Option B: Doctor Dropdown Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <select
                    value={selectedDoctor}
                    onChange={(e) => {
                      setSelectedDoctor(e.target.value);
                      setHighlightedAppointmentId(null);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="ALL">All Doctors ({waitingList.length})</option>
                    {availableDoctors.map((doc) => {
                      const count = waitingList.filter((w) => w.doctor_name?.toLowerCase() === doc.toLowerCase()).length;
                      return (
                        <option key={doc} value={doc}>
                          Dr. {doc} ({count} waiting)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedDoctor !== 'ALL' && (
                  <button
                    onClick={() => {
                      setSelectedDoctor('ALL');
                      setHighlightedAppointmentId(null);
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    title="Reset to All Doctors"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear Filter</span>
                  </button>
                )}

                {/* Patient Search Input */}
                <div className="relative w-full sm:w-52">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter patients..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                  </input>
                </div>
              </div>
            </div>

            {loading ? (
              <LoadingSpinner label="Compiling live queue..." />
            ) : filteredWaiting.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs">
                {selectedDoctor !== 'ALL' ? (
                  <div className="space-y-2">
                    <p>No patients currently waiting for Dr. {selectedDoctor}.</p>
                    <button
                      onClick={() => setSelectedDoctor('ALL')}
                      className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-bold rounded-lg text-xs hover:bg-amber-100 cursor-pointer"
                    >
                      Show All Doctors
                    </button>
                  </div>
                ) : (
                  'No patients currently waiting in the OPD lounge.'
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredWaiting.map((item, idx) => {
                  const isHighlighted = highlightedAppointmentId && Number(highlightedAppointmentId) === Number(item.appointment_id);
                  return (
                    <div
                      key={item.appointment_id}
                      className={`py-3.5 px-3 rounded-2xl transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        isHighlighted
                          ? 'bg-amber-50/70 border-2 border-amber-400 shadow-sm'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-2xl font-black flex items-center justify-center text-xs shrink-0 border ${
                          isHighlighted
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          #{idx + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{item.patient_name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Waiting
                            </span>
                            {isHighlighted && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white flex items-center gap-1 shadow-2xs">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>In Focus</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {item.registration_id} • {item.mobile_number} • Token #{item.appointment_id}
                          </div>
                        </div>
                      </div>

                      <div className="text-right sm:self-center pl-12 sm:pl-0 space-y-0.5">
                        <div className="font-bold text-blue-700 flex items-center gap-1 justify-end">
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Dr. {item.doctor_name}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 block">
                          Slot: {item.appointment_time?.slice(0, 5)} hrs • <span className="capitalize">{item.appointment_type}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Today's Scheduled Patients Awaiting Check-in */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Today's Arriving ({scheduledList.length})</span>
              </h3>
            </div>

            {scheduledList.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                All scheduled patients for today are checked-in or completed.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto pr-1">
                {scheduledList.map((s) => (
                  <div key={s.appointment_id} className="py-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">{s.patient_name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {s.appointment_time?.slice(0, 5)} hrs • Dr. {s.doctor_name}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCheckin(s.appointment_id)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Check-in Patient</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
