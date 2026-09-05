import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { formatDisplayDate } from '../../utils/dateUtils';
import {
  PhoneCall,
  Plus,
  Search,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  PhoneForwarded,
  RotateCcw,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
  Filter,
  CheckSquare
} from 'lucide-react';

const PURPOSE_LABELS = {
  followup: 'Follow-up',
  renewal: 'Registration Renewal',
  due_payment: 'Due Payment',
  acq: 'ACQ Care Plan',
  ocnr: 'OC/NR Attrition',
  appointment: 'Appointment Confirmation',
  general_enquiry: 'General Enquiry',
  callback: 'Scheduled Callback',
  patient_feedback: 'Patient Feedback',
  other: 'Other',
};

const STATUS_BADGES = {
  connected: { label: 'Connected', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  callback_requested: { label: 'Callback Requested', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
  busy: { label: 'Line Busy', bg: 'bg-orange-100 text-orange-800 border-orange-200' },
  not_connected: { label: 'Not Connected', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
  switched_off: { label: 'Switched Off', bg: 'bg-rose-100 text-rose-800 border-rose-200' },
  interested: { label: 'Interested', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
  not_interested: { label: 'Not Interested', bg: 'bg-slate-100 text-slate-500 border-slate-200' },
  appointment_booked: { label: 'Appointment Booked', bg: 'bg-teal-100 text-teal-800 border-teal-200' },
  followup_required: { label: 'Followup Required', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  completed: { label: 'Completed', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  closed: { label: 'Closed', bg: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const ReceptionistCrmPage = () => {
  const location = useLocation();
  const { showToast } = useToast();

  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(!!location.state?.patient);
  const [submitting, setSubmitting] = useState(false);

  // Search for patient in call modal
  const [searchPtTerm, setSearchPtTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(
    location.state?.patient
      ? {
          patient_id: location.state.patient.patient_id,
          full_name: location.state.patient.patient_name || location.state.patient.full_name,
          registration_id: location.state.patient.registration_id || 'REG-PATIENT',
          mobile_number: location.state.patient.mobile_number,
        }
      : null
  );
  const [searchingPt, setSearchingPt] = useState(false);

  const [formData, setFormData] = useState({
    interaction_type: 'outbound',
    call_purpose: location.state?.callPurpose || 'followup',
    call_status: 'connected',
    callback_date: '',
    callback_time: '11:00:00',
    remarks: '',
  });

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getCallRecords();
      if (res.success) {
        setCalls(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch CRM call logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const handleSearchPatient = async () => {
    if (!searchPtTerm.trim()) {
      showToast('Please enter a mobile number, name, or registration ID', 'warning');
      return;
    }
    setSearchingPt(true);
    try {
      const res = await receptionistApi.searchPatients({ search: searchPtTerm.trim() });
      if (res.success && res.data?.patients?.length > 0) {
        setSearchResults(res.data.patients);
        if (res.data.patients.length === 1) {
          setSelectedPatient(res.data.patients[0]);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
        showToast('No patient found matching search term', 'warning');
      }
    } catch (e) {
      showToast('Search failed', 'error');
    } finally {
      setSearchingPt(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      showToast('Please search and select a patient first', 'warning');
      return;
    }
    if (formData.call_status === 'callback_requested' && !formData.callback_date) {
      showToast('Callback date is required when status is Callback Requested', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await receptionistApi.logCallRecord({
        patient_id: selectedPatient.patient_id,
        interaction_type: formData.interaction_type,
        call_purpose: formData.call_purpose,
        call_status: formData.call_status,
        callback_date: formData.call_status === 'callback_requested' ? formData.callback_date : null,
        callback_time: formData.call_status === 'callback_requested' ? formData.callback_time : null,
        remarks: formData.remarks.trim() || null,
      });

      if (res.success) {
        showToast(
          formData.call_status === 'callback_requested'
            ? 'Call record logged & automated callback task scheduled!'
            : 'Call record logged successfully!',
          'success'
        );
        setIsModalOpen(false);
        setSelectedPatient(null);
        setSearchPtTerm('');
        setSearchResults([]);
        setFormData({
          interaction_type: 'outbound',
          call_purpose: 'followup',
          call_status: 'connected',
          callback_date: '',
          callback_time: '11:00:00',
          remarks: '',
        });
        fetchCalls();
      }
    } catch (err) {
      showToast(err.message || 'Failed to log call', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Tab counts
  const tabCounts = useMemo(() => {
    let callbacks = 0;
    let followup = 0;
    let renewal = 0;
    let dues = 0;

    calls.forEach((c) => {
      if (c.call_status === 'callback_requested' || c.call_purpose === 'callback') callbacks++;
      if (c.call_purpose === 'followup' || c.call_status === 'followup_required') followup++;
      if (c.call_purpose === 'renewal') renewal++;
      if (c.call_purpose === 'due_payment') dues++;
    });

    return {
      all: calls.length,
      callbacks,
      followup,
      renewal,
      dues,
    };
  }, [calls]);

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      // 1. Tab filtering
      let matchesTab = true;
      if (activeTab === 'callbacks') {
        matchesTab = c.call_status === 'callback_requested' || c.call_purpose === 'callback';
      } else if (activeTab === 'followup') {
        matchesTab = c.call_purpose === 'followup' || c.call_status === 'followup_required';
      } else if (activeTab === 'renewal') {
        matchesTab = c.call_purpose === 'renewal';
      } else if (activeTab === 'dues') {
        matchesTab = c.call_purpose === 'due_payment';
      }

      if (!matchesTab) return false;

      // 2. Search filtering
      if (!tableSearchTerm.trim()) return true;
      const term = tableSearchTerm.toLowerCase().trim();
      const patientName = (c.patient_name || c.lead_name || '').toLowerCase();
      const handlerName = (c.handled_by_name || '').toLowerCase();
      const remarks = (c.remarks || '').toLowerCase();
      const callId = String(c.call_id);
      const purpose = (c.call_purpose || '').toLowerCase();
      const status = (c.call_status || '').toLowerCase();

      return (
        patientName.includes(term) ||
        handlerName.includes(term) ||
        remarks.includes(term) ||
        callId.includes(term) ||
        purpose.includes(term) ||
        status.includes(term)
      );
    });
  }, [calls, activeTab, tableSearchTerm]);

  const formatScheduleText = (dateStr, timeStr) => {
    if (!dateStr) return '—';
    const displayDate = formatDisplayDate(dateStr);
    const timeFormatted = timeStr ? `${timeStr.slice(0, 5)} hrs` : '';
    return timeFormatted ? `${displayDate} at ${timeFormatted}` : displayDate;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-red-600" />
            <span>CRM Telecalling & Patient Retention</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log outbound/inbound patient communications, follow-ups, renewal reminders, and automated callbacks.
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setSearchResults([]);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Log Patient Call</span>
        </button>
      </div>

      {/* Tabs Toolbar & Table Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Call Records', count: tabCounts.all },
            { id: 'callbacks', label: 'Callbacks', count: tabCounts.callbacks },
            { id: 'followup', label: 'Follow-ups', count: tabCounts.followup },
            { id: 'renewal', label: 'Renewals', count: tabCounts.renewal },
            { id: 'dues', label: 'Due Reminders', count: tabCounts.dues },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Live Search Filter in Table */}
        <div className="relative w-full lg:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={tableSearchTerm}
            onChange={(e) => setTableSearchTerm(e.target.value)}
            placeholder="Search records by name, ID, notes..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading CRM call records from database..." />
        ) : filteredCalls.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <PhoneForwarded className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">
              {activeTab === 'renewal'
                ? 'No registration renewal calls logged yet.'
                : activeTab === 'dues'
                ? 'No due payment reminder calls logged yet.'
                : activeTab === 'callbacks'
                ? 'No callback requests logged in this branch.'
                : activeTab === 'followup'
                ? 'No follow-up calls logged yet.'
                : 'No call records found.'}
            </p>
            <p className="text-[11px] text-slate-400">
              {activeTab === 'renewal'
                ? 'Use "+ Log Patient Call" and select Purpose: "Registration Renewal" to log patient renewal outreach.'
                : activeTab === 'dues'
                ? 'Use "+ Log Patient Call" and select Purpose: "Due Payment Reminder" to log collections outreach.'
                : 'Click "+ Log Patient Call" above to record an inbound or outbound call.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Call ID & Direction</th>
                  <th className="py-3.5 px-4">Patient / Contact</th>
                  <th className="py-3.5 px-4">Call Purpose</th>
                  <th className="py-3.5 px-4">Call Status</th>
                  <th className="py-3.5 px-4">Callback Schedule</th>
                  <th className="py-3.5 px-4">Handled By</th>
                  <th className="py-3.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCalls.map((c) => {
                  const statusInfo = STATUS_BADGES[c.call_status] || {
                    label: c.call_status?.replace('_', ' '),
                    bg: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const purposeLabel = PURPOSE_LABELS[c.call_purpose] || c.call_purpose?.replace('_', ' ');

                  return (
                    <tr key={c.call_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900 block">#{c.call_id}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                            c.interaction_type === 'inbound'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.interaction_type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {c.patient_name || c.lead_name || 'Registered Patient'}
                        </div>
                        {c.patient_id && (
                          <div className="text-[10px] text-slate-400 font-mono">Patient #{c.patient_id}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="capitalize font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] inline-block">
                          {purposeLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border inline-block ${statusInfo.bg}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {c.callback_date ? (
                          <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{formatScheduleText(c.callback_date, c.callback_time)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.handled_by_name || 'Staff User'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate">
                        {c.remarks || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Call Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSearchResults([]);
        }}
        title="Log Patient CRM Call & Schedule Callback"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
          {/* Patient Picker */}
          <div className="p-3.5 bg-red-50/50 rounded-2xl border border-red-200 space-y-2">
            <label className="block text-[11px] font-bold text-red-900 uppercase tracking-wider">
              1. Search & Select Patient *
            </label>

            {!selectedPatient ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchPtTerm}
                    onChange={(e) => setSearchPtTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchPatient();
                      }
                    }}
                    placeholder="Search by Mobile, Registration ID, or Name..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-red-300 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSearchPatient}
                    disabled={searchingPt}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
                  >
                    {searchingPt ? 'Finding...' : 'Find'}
                  </button>
                </div>

                {/* Multiple search results picker */}
                {searchResults.length > 0 && (
                  <div className="bg-white rounded-xl border border-red-200 divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {searchResults.map((pt) => (
                      <div
                        key={pt.patient_id}
                        onClick={() => {
                          setSelectedPatient(pt);
                          setSearchResults([]);
                        }}
                        className="p-2.5 hover:bg-red-50/60 cursor-pointer flex justify-between items-center transition-colors text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{pt.full_name || pt.patient_name}</span>
                          <span className="text-[11px] text-slate-500 font-mono block">
                            {pt.registration_id} • {pt.mobile_number}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded">
                          Select
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-red-200 text-xs flex justify-between items-center shadow-2xs">
                <div>
                  <span className="font-bold text-slate-900 block text-sm">
                    {selectedPatient.full_name || selectedPatient.patient_name}
                  </span>
                  <span className="text-slate-500 font-mono text-[11px] block mt-0.5">
                    {selectedPatient.registration_id} • {selectedPatient.mobile_number}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setSearchResults([]);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer border border-red-200"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Interaction Direction *</label>
              <select
                value={formData.interaction_type}
                onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none font-bold"
              >
                <option value="outbound">Outbound (We Called)</option>
                <option value="inbound">Inbound (Patient Called)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Call Purpose *</label>
              <select
                value={formData.call_purpose}
                onChange={(e) => setFormData({ ...formData, call_purpose: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none capitalize font-medium"
              >
                <option value="followup">Follow-up Call</option>
                <option value="renewal">Registration Renewal</option>
                <option value="due_payment">Due Payment Reminder</option>
                <option value="acq">ACQ Monthly Care Plan</option>
                <option value="ocnr">OC / NR Attrition Check</option>
                <option value="appointment">Appointment Confirmation</option>
                <option value="general_enquiry">General Enquiry</option>
                <option value="callback">Scheduled Callback</option>
                <option value="patient_feedback">Patient Feedback</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Call Outcome Status *</label>
            <select
              value={formData.call_status}
              onChange={(e) => setFormData({ ...formData, call_status: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none font-bold capitalize"
            >
              <option value="connected">Connected / Spoke with Patient</option>
              <option value="callback_requested">Call Back Requested (Creates Task)</option>
              <option value="busy">Line Busy</option>
              <option value="not_connected">Not Connected / Ringing</option>
              <option value="switched_off">Switched Off</option>
              <option value="interested">Patient Interested</option>
              <option value="not_interested">Not Interested</option>
              <option value="appointment_booked">Appointment Booked</option>
              <option value="followup_required">Follow-up Required</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Conditional Callback Date/Time */}
          {formData.call_status === 'callback_requested' && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
              <span className="text-[11px] font-bold text-amber-900 block flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>Callback Schedule (Automatic Task Creation) *</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-amber-800 mb-1">Callback Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.callback_date}
                    onChange={(e) => setFormData({ ...formData, callback_date: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-amber-800 mb-1">Callback Time</label>
                  <input
                    type="time"
                    value={formData.callback_time}
                    onChange={(e) => setFormData({ ...formData, callback_time: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Call Notes & Remarks</label>
            <input
              type="text"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="e.g. Patient mentioned recovering well, requested callback Wednesday"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setSearchResults([]);
              }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Call Log'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
