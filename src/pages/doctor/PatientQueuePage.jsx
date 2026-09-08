import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  HeartPulse, Clock, User, RefreshCw, Stethoscope, CheckCircle,
  ChevronRight, Activity, Users
} from 'lucide-react';

const statusColors = {
  waiting: 'bg-amber-100 text-amber-700 border-amber-200',
  checked_in: 'bg-blue-100 text-blue-700 border-blue-200',
  in_consultation: 'bg-purple-100 text-purple-700 border-purple-200',
  doctor_completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const genderBadge = { male: 'bg-blue-50 text-blue-600', female: 'bg-pink-50 text-pink-600', other: 'bg-slate-50 text-slate-600' };

export const PatientQueuePage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await doctorApi.getPatientQueue();
      if (res.success) setQueue(res.data || []);
    } catch (err) {
      showToast('Failed to fetch patient queue', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Auto-refresh every 30 seconds
    const timer = setInterval(fetchQueue, 30000);
    return () => clearInterval(timer);
  }, [fetchQueue]);

  const handleStartConsultation = async (appointment) => {
    setStartingId(appointment.appointment_id);
    try {
      const res = await doctorApi.startConsultation({ appointment_id: appointment.appointment_id });
      if (res.success) {
        const consultId = res.data.consultation_id;
        showToast(`Consultation started for ${appointment.patient_name}`, 'success');
        navigate(`/doctor/consultation/${consultId}`, {
          state: {
            patient: appointment,
            consultation: res.data
          }
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to start consultation', 'error');
    } finally {
      setStartingId(null);
    }
  };

  const inConsultation = queue.filter(p => p.status === 'in_consultation');
  const waiting = queue.filter(p => p.status !== 'in_consultation');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-emerald-600" />
            Patient Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Today's real-time consultation queue</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>{queue.length} patients</span>
          </div>
          <button
            onClick={fetchQueue}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl transition-colors border border-emerald-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Currently In Consultation */}
      {inConsultation.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
          <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Currently In Consultation
          </h3>
          <div className="space-y-2">
            {inConsultation.map(p => (
              <div key={p.appointment_id} className="bg-white border border-purple-100 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-sm">
                    {p.patient_name?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{p.patient_name}</div>
                    <div className="text-[10px] text-slate-400">{p.registration_id} • {p.age}y • {p.gender}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                    IN CONSULTATION
                  </span>
                  <button
                    onClick={() => handleStartConsultation(p)}
                    disabled={startingId === p.appointment_id}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    {startingId === p.appointment_id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Stethoscope className="w-3 h-3" />
                    )}
                    Resume
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting Queue */}
      {loading ? (
        <LoadingSpinner label="Fetching patient queue..." />
      ) : waiting.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
          <h3 className="font-bold text-slate-700 text-sm">Queue is clear!</h3>
          <p className="text-xs text-slate-400 mt-1">No patients waiting. All done for now.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Waiting Patients
            </h3>
            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {waiting.length} waiting
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {waiting.map((p, idx) => (
              <div key={p.appointment_id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Token Number */}
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-black text-sm flex items-center justify-center shrink-0 border border-amber-200">
                    {idx + 1}
                  </div>

                  {/* Patient Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{p.patient_name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${genderBadge[p.gender?.toLowerCase()] || genderBadge.other}`}>
                        {p.gender}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-slate-400">{p.registration_id}</span>
                      <span className="text-[10px] text-slate-400">{p.age}y</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColors[p.status] || 'bg-slate-100 text-slate-600'}`}>
                        {p.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Waiting time */}
                  {p.waiting_time_minutes > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{p.waiting_time_minutes}m</span>
                    </div>
                  )}

                  {/* Type Badge */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.appointment_type === 'new' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {p.appointment_type === 'new' ? 'NEW' : 'FOLLOW-UP'}
                  </span>

                  {/* Start Consultation Button */}
                  <button
                    onClick={() => handleStartConsultation(p)}
                    disabled={startingId === p.appointment_id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {startingId === p.appointment_id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Stethoscope className="w-3.5 h-3.5" />
                    )}
                    <span>{startingId === p.appointment_id ? 'Starting...' : 'Start Consultation'}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
