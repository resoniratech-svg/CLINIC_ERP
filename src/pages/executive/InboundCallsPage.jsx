import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { executiveApi, settingsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AilmentSelect } from '../../components/common/AilmentSelect';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  PhoneIncoming,
  Search,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Users2,
  FileText,
  HeartHandshake,
  Send,
  Building,
  RefreshCw
} from 'lucide-react';

export const InboundCallsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMobile = searchParams.get('mobile') || '';
  const [mobile, setMobile] = useState(initialMobile);
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Lead Form State
  const [leadForm, setLeadForm] = useState({
    lead_name: '',
    mobile_number: '',
    age: '',
    gender: 'male',
    village: '',
    mandal: '',
    requirement: '',
    remarks: ''
  });

  const { showToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [villagesList, setVillagesList] = useState([]);
  const [mandalsList, setMandalsList] = useState([]);
  const [ailmentsList, setAilmentsList] = useState([]);

  useEffect(() => {
    Promise.all([
      settingsApi.getMasterData('villages', { status: 'active' }).catch(() => ({ data: [] })),
      settingsApi.getMasterData('mandals', { status: 'active' }).catch(() => ({ data: [] })),
      settingsApi.getMasterData('ailments', { status: 'active' }).catch(() => ({ data: [] })),
    ]).then(([vRes, mRes, aRes]) => {
      if (vRes?.success && Array.isArray(vRes.data)) setVillagesList(vRes.data);
      if (mRes?.success && Array.isArray(mRes.data)) setMandalsList(mRes.data);
      if (aRes?.success && Array.isArray(aRes.data)) setAilmentsList(aRes.data);
    });
  }, []);


  useEffect(() => {
    if (initialMobile && initialMobile.length === 10) {
      handleSearch(initialMobile);
    }
  }, [initialMobile]);

  const handleSearch = async (targetMobile = mobile) => {
    const cleanMob = targetMobile.replace(/\D/g, '');
    if (!cleanMob || cleanMob.length < 10) {
      showToast('Please enter a valid 10-digit mobile number', 'warning');
      return;
    }

    setLoading(true);
    setSearchResult(null);
    try {
      const res = await executiveApi.searchPatientInbound({ mobile: cleanMob });
      if (res.success && res.data) {
        setSearchResult(res.data);
        if (!res.data.is_existing) {
          setLeadForm((prev) => ({
            ...prev,
            mobile_number: cleanMob,
            lead_name: '',
            requirement: '',
            remarks: ''
          }));
        }
      } else {
        showToast('Search failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error searching patient record', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadForm.lead_name.trim() || !leadForm.mobile_number.trim()) {
      showToast('Lead Name and Mobile Number are required', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        lead_name: leadForm.lead_name.trim(),
        mobile_number: leadForm.mobile_number.trim(),
        age: leadForm.age ? parseInt(leadForm.age) : null,
        gender: leadForm.gender,
        village: leadForm.village.trim() || null,
        requirement: leadForm.requirement.trim() || null,
        source: 'Inbound Call',
        lead_source: 'inbound',
        remarks: leadForm.remarks.trim() || 'Inbound phone caller lead'
      };

      const res = await executiveApi.createLead(payload);
      if (res.success && res.data) {
        showToast('Inbound Lead created & sent to Receptionist Queue! Incentive credited.', 'success');
        setLeadForm({
          lead_name: '',
          mobile_number: '',
          age: '',
          gender: 'male',
          village: '',
          mandal: '',
          requirement: '',
          remarks: ''
        });
        setSearchResult(null);
        setMobile('');
        setSearchParams({});
      } else {
        showToast('Failed to create lead', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error creating lead', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Inbound Calls & Patient Enquiry
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Live Dial-In
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Patient calls hospital • Search mobile number to identify existing history or immediately capture new inbound lead.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <Building className="w-3.5 h-3.5 text-blue-600" />
          <span>{user?.branch_name || 'Karimnagar Main'}</span>
        </div>
      </div>

      {/* 2. Mobile Search Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="max-w-xl space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Search Patient by Caller Mobile Number (Primary)
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
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading || mobile.length < 10}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer shrink-0"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PhoneIncoming className="w-4 h-4" />}
              <span>Search / Verify</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-400 block">
            The system will automatically differentiate between an Existing Registered Patient and a New Caller.
          </span>
        </div>
      </div>

      {/* 3. Search Results State */}
      {loading && (
        <div className="py-12 bg-white rounded-2xl border border-slate-200/80">
          <LoadingSpinner label="Querying patient directory & previous enquiry records..." />
        </div>
      )}

      {/* Scenario A: Existing Patient Found */}
      {!loading && searchResult && searchResult.is_existing && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-6 p-6">
          {/* Status Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {searchResult.patient?.full_name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                    Existing Patient
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Patient ID: <span className="font-mono font-bold text-slate-800">#{searchResult.patient?.patient_id}</span> • Reg ID: <span className="font-mono font-bold text-blue-700">{searchResult.patient?.registration_id || 'REG-0000'}</span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">Registered Mobile</span>
              <span className="text-xs font-mono font-bold text-slate-900">{searchResult.patient?.mobile_number}</span>
            </div>
          </div>

          {/* 3 Columns Non-Clinical Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Previous Appointments */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Recent Appointments ({searchResult.patient?.previous_appointments?.length || 0})</span>
              </div>
              {searchResult.patient?.previous_appointments?.length > 0 ? (
                <div className="space-y-1.5 text-[11px]">
                  {searchResult.patient.previous_appointments.map((apt) => (
                    <div key={apt.appointment_id} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
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
                <p className="text-[11px] text-slate-400 italic">No past appointments recorded.</p>
              )}
            </div>

            {/* Previous Leads */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Users2 className="w-4 h-4 text-indigo-600" />
                <span>Previous Leads ({searchResult.patient?.previous_leads?.length || 0})</span>
              </div>
              {searchResult.patient?.previous_leads?.length > 0 ? (
                <div className="space-y-1.5 text-[11px]">
                  {searchResult.patient.previous_leads.map((lead) => (
                    <div key={lead.lead_id} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
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
                <p className="text-[11px] text-slate-400 italic">No prior leads linked to this caller.</p>
              )}
            </div>

            {/* Call History */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Call Logs ({searchResult.patient?.call_history?.length || 0})</span>
              </div>
              {searchResult.patient?.call_history?.length > 0 ? (
                <div className="space-y-1.5 text-[11px]">
                  {searchResult.patient.call_history.map((call) => (
                    <div key={call.call_id} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800 capitalize">{call.interaction_type} • {call.call_purpose}</div>
                        <div className="text-slate-400 text-[10px]">{new Date(call.created_at).toLocaleDateString()}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700">
                        {call.call_status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No past calls logged for this patient.</p>
              )}
            </div>
          </div>

          {/* Action to create new follow-up lead */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Is this patient requesting a new consultation or appointment?
            </span>
            <button
              onClick={() => {
                setLeadForm({
                  lead_name: searchResult.patient?.full_name || '',
                  mobile_number: searchResult.patient?.mobile_number || '',
                  age: '',
                  gender: 'male',
                  village: '',
                  mandal: '',
                  requirement: 'Repeat Consultation Request',
                  remarks: 'Existing patient called in for follow-up appointment'
                });
                setSearchResult({ ...searchResult, is_existing: false });
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Generate Inbound Follow-up Lead</span>
            </button>
          </div>
        </div>
      )}

      {/* Scenario B: New Patient (Capture Lead Form) */}
      {!loading && searchResult && !searchResult.is_existing && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 to-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  New Caller • Inbound Lead Generation
                </h3>
                <p className="text-xs text-slate-500">
                  Capture caller details. Lead will automatically route to Receptionist for Doctor Assignment & Consultation.
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
              Earn ₹100 Incentive
            </span>
          </div>

          <form onSubmit={handleLeadSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Lead Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Caller / Lead Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Reddy"
                  value={leadForm.lead_name}
                  onChange={(e) => setLeadForm({ ...leadForm, lead_name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit number"
                  value={leadForm.mobile_number}
                  onChange={(e) => setLeadForm({ ...leadForm, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Age (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 38"
                  value={leadForm.age}
                  onChange={(e) => setLeadForm({ ...leadForm, age: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Gender
                </label>
                <select
                  value={leadForm.gender}
                  onChange={(e) => setLeadForm({ ...leadForm, gender: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Village */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Village / Locality
                </label>
                <input
                  type="text"
                  list="inbound-villages-datalist"
                  placeholder="e.g. Subhash Nagar"
                  value={leadForm.village}
                  onChange={(e) => setLeadForm({ ...leadForm, village: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <datalist id="inbound-villages-datalist">
                  {villagesList.map(v => <option key={v.id || v.name} value={v.name} />)}
                </datalist>
              </div>

              {/* Mandal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mandal / City
                </label>
                <input
                  type="text"
                  list="inbound-mandals-datalist"
                  placeholder="e.g. Karimnagar"
                  value={leadForm.mandal}
                  onChange={(e) => setLeadForm({ ...leadForm, mandal: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <datalist id="inbound-mandals-datalist">
                  {mandalsList.map(m => <option key={m.id || m.name} value={m.name} />)}
                </datalist>
              </div>
            </div>

            {/* Requirement / Reason */}
            <AilmentSelect
              label="Requirement / Ailment Reason"
              labelClassName="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              required
              value={leadForm.requirement}
              onChange={(e) => setLeadForm({ ...leadForm, requirement: e.target.value })}
              placeholder="e.g. Chronic Joint Pain, Psoriasis, Asthma, Child Immunity Consultation"
              ailments={ailmentsList}
              inputClassName="px-3.5 py-2 bg-slate-50 border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-emerald-500"
            />

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Executive Remarks / Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Caller requested evening slot around 5 PM, willing to visit clinic on Saturday."
                value={leadForm.remarks}
                onChange={(e) => setLeadForm({ ...leadForm, remarks: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-400">
                Source: <strong className="text-slate-700">Inbound Call</strong> • Executive: <strong className="text-slate-700">{user?.full_name}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchResult(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Generate Lead & Send to Receptionist</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
