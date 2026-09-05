import React, { useState } from 'react';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  UserCheck,
  Search,
  User,
  Calendar,
  Clock,
  Users2,
  ShieldCheck,
  PhoneIncoming,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ExecutivePatientsPage = () => {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { showToast } = useToast();

  const handleSearch = async (e) => {
    e?.preventDefault();
    const cleanMob = mobile.replace(/\D/g, '');
    if (!cleanMob || cleanMob.length < 10) {
      showToast('Please enter a valid 10-digit mobile number', 'warning');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await executiveApi.searchPatientInbound({ mobile: cleanMob });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        showToast('Search failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error querying patient directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Patient Registry • Executive Search
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 uppercase tracking-wider">
              Non-Clinical Overview
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Search patient records by registered mobile number • Non-clinical overview compliant with patient privacy standards.
          </p>
        </div>
      </div>

      {/* 2. Search Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <form onSubmit={handleSearch} className="max-w-xl space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Search by Patient Mobile Number
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="tel"
                placeholder="Enter 10-digit mobile number (e.g. 9876543210)"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || mobile.length < 10}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Lookup Patient</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Search Results */}
      {loading ? (
        <div className="py-16 bg-white rounded-2xl border border-slate-200/80">
          <LoadingSpinner label="Searching patient database..." />
        </div>
      ) : result && !result.is_existing ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">
            No Existing Patient Registered with Mobile {mobile}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You can capture this caller as a New Inbound Lead to route them to the clinic receptionist.
          </p>
          <Link
            to={`/executive/calls/inbound?mobile=${mobile}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <PhoneIncoming className="w-3.5 h-3.5" />
            <span>Create New Inbound Lead</span>
          </Link>
        </div>
      ) : result && result.is_existing ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          {/* Patient Header Card */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-base">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {result.patient?.full_name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 uppercase">
                    Active Patient
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Patient ID: <strong className="text-slate-800">#{result.patient?.patient_id}</strong> • Reg ID:{' '}
                  <strong className="text-blue-700 font-mono">{result.patient?.registration_id || 'REG-0000'}</strong>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Contact</span>
              <span className="font-mono font-bold text-xs text-slate-900">{result.patient?.mobile_number}</span>
            </div>
          </div>

          {/* 3 Overview Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Appointments */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Appointment Schedule ({result.patient?.previous_appointments?.length || 0})</span>
              </div>
              {result.patient?.previous_appointments?.length > 0 ? (
                <div className="space-y-1.5 text-xs">
                  {result.patient.previous_appointments.map((apt) => (
                    <div key={apt.appointment_id} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-center text-[11px]">
                      <div>
                        <div className="font-bold text-slate-800">{new Date(apt.appointment_date).toLocaleDateString()}</div>
                        <div className="text-slate-400 text-[10px]">{apt.appointment_time}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-700">
                        {apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No appointment history.</p>
              )}
            </div>

            {/* Leads */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Users2 className="w-4 h-4 text-indigo-600" />
                <span>Previous Inquiries & Leads ({result.patient?.previous_leads?.length || 0})</span>
              </div>
              {result.patient?.previous_leads?.length > 0 ? (
                <div className="space-y-1.5 text-xs">
                  {result.patient.previous_leads.map((lead) => (
                    <div key={lead.lead_id} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-center text-[11px]">
                      <div>
                        <div className="font-bold text-slate-800">Lead #{lead.lead_id}</div>
                        <div className="text-slate-400 text-[10px]">{new Date(lead.created_at).toLocaleDateString()}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-50 text-indigo-700">
                        {lead.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No prior lead records.</p>
              )}
            </div>

            {/* Call History */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Call Logs ({result.patient?.call_history?.length || 0})</span>
              </div>
              {result.patient?.call_history?.length > 0 ? (
                <div className="space-y-1.5 text-xs">
                  {result.patient.call_history.map((call) => (
                    <div key={call.call_id} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-center text-[11px]">
                      <div>
                        <div className="font-bold text-slate-800 capitalize">{call.interaction_type}</div>
                        <div className="text-slate-400 text-[10px]">{new Date(call.created_at).toLocaleDateString()}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700">
                        {call.call_status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No prior call logs.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
