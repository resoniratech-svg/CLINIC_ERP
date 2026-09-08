import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  PhoneCall,
  PhoneForwarded,
  RefreshCw,
  Clock,
  CalendarCheck,
  History,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  User,
  Package,
  DollarSign,
  Wallet,
  X
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

// Helper for clean callback date & time formatting (DD/MM/YYYY, hh:mm A)
const formatCallback = (dateStr, timeStr) => {
  if (!dateStr) return '—';
  try {
    const cleanDate = typeof dateStr === 'string' && dateStr.includes('T')
      ? dateStr.split('T')[0]
      : String(dateStr);
    const parts = cleanDate.split('-');
    let dateFormatted = cleanDate;
    if (parts.length === 3) {
      const [y, m, d] = parts;
      dateFormatted = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    if (!timeStr) return dateFormatted;

    const timeParts = String(timeStr).split(':');
    if (timeParts.length >= 2) {
      let h = parseInt(timeParts[0], 10);
      const m = timeParts[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${dateFormatted}, ${h.toString().padStart(2, '0')}:${m} ${ampm}`;
    }
    return `${dateFormatted}, ${timeStr}`;
  } catch (err) {
    return `${dateStr} ${timeStr || ''}`;
  }
};

// Reusable Patient Search Component for Modals
const PatientSelector = ({ value, onChange, label = 'Select Patient *' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const searchTimeout = useRef(null);

  // Load initial patient if value is provided
  useEffect(() => {
    if (value && (!selectedPatient || selectedPatient.patient_id !== parseInt(value))) {
      proApi.searchPatients({ patient_id: value })
        .then(res => {
          if (res.success && res.data && res.data.length > 0) {
            setSelectedPatient(res.data[0]);
          }
        })
        .catch(() => {});
    } else if (!value) {
      setSelectedPatient(null);
      setSearchTerm('');
    }
  }, [value]);

  const handleSearch = (term) => {
    setSearchTerm(term);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!term.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await proApi.searchPatients({ search: term.trim(), limit: 10 });
        if (res.success) {
          setResults(res.data || []);
          setIsOpen(true);
        }
      } catch (e) {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelect = (pt) => {
    setSelectedPatient(pt);
    onChange(pt.patient_id);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedPatient(null);
    onChange('');
    setSearchTerm('');
  };

  return (
    <div className="space-y-1 relative">
      <label className="text-xs font-bold text-slate-700">{label}</label>
      {selectedPatient ? (
        <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#1565C0]" />
            <div>
              <div className="text-xs font-bold text-slate-900">
                {selectedPatient.full_name || selectedPatient.name}
              </div>
              <div className="text-[11px] text-slate-500">
                ID #{selectedPatient.patient_id} • {selectedPatient.phone || 'No phone'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition cursor-pointer"
            title="Change Patient"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (results.length > 0) setIsOpen(true); }}
              placeholder="Search by name, phone or ID..."
              className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
            />
            {isSearching && (
              <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400 animate-spin" />
            )}
          </div>

          {isOpen && results.length > 0 && (
            <div className="absolute z-60 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
              {results.map((pt) => (
                <button
                  key={pt.patient_id}
                  type="button"
                  onClick={() => handleSelect(pt)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">{pt.full_name || pt.name}</div>
                    <div className="text-[10px] text-slate-500">
                      ID #{pt.patient_id} • {pt.gender || '—'}, {pt.age ? `${pt.age}y` : ''} • {pt.phone || 'No phone'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#1565C0] bg-blue-50 px-2 py-0.5 rounded-full">
                    Select
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const PROCRMPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const path = location.pathname;
  const initialTab = path.includes('/followups')
    ? 'followups'
    : path.includes('/renewals')
    ? 'renewals'
    : path.includes('/dues')
    ? 'dues'
    : path.includes('/acq')
    ? 'acq'
    : path.includes('/ocnr')
    ? 'ocnr'
    : 'calls';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCallModal, setShowCallModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showOCNRModal, setShowOCNRModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Due Collection Modal
  const [showDueModal, setShowDueModal] = useState(false);
  const [selectedDue, setSelectedDue] = useState(null);
  const [duePaymentForm, setDuePaymentForm] = useState({
    amount: '',
    payment_method: 'cash',
    remarks: ''
  });

  // Forms
  const [callForm, setCallForm] = useState({
    patient_id: '',
    interaction_type: 'outbound',
    call_purpose: 'followup',
    call_status: 'connected',
    callback_date: '',
    callback_time: '10:00:00',
    remarks: ''
  });

  const [followupForm, setFollowupForm] = useState({
    patient_id: '',
    followup_type: 'treatment',
    followup_date: new Date().toISOString().split('T')[0],
    purpose: '',
    remarks: ''
  });

  const [renewalForm, setRenewalForm] = useState({
    patient_id: '',
    package_id: '',
    renewal_amount: '',
    call_status: 'renewed',
    remarks: ''
  });

  const [ocnrForm, setOCNRForm] = useState({
    patient_id: '',
    classification: 'oc',
    reason: 'not_interested',
    remarks: ''
  });

  const fetchTabContent = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'calls') {
        const res = await proApi.getTodayCalls();
        if (res.success) setData(res.data || []);
      } else if (tab === 'followups') {
        const res = await proApi.getFollowups();
        if (res.success) setData(res.data || []);
      } else if (tab === 'renewals') {
        const res = await proApi.getRenewalsQueue();
        if (res.success) setData(res.data || { expired_packages: [], renewals: [] });
      } else if (tab === 'dues') {
        const res = await proApi.getDuePatients();
        if (res.success) setData(res.data || []);
      } else if (tab === 'acq') {
        const res = await proApi.getACQPatients();
        if (res.success) setData(res.data || []);
      } else if (tab === 'ocnr') {
        const res = await proApi.getOCNRPatients();
        if (res.success) setData(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load CRM data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
    // Reset data to correct shape for the new tab to prevent render crashes
    setData(initialTab === 'renewals' ? { expired_packages: [], renewals: [] } : []);
    fetchTabContent(initialTab);
  }, [location.pathname]);

  const handleTabChange = (tabKey) => {
    // Reset data to correct shape BEFORE switching tab to prevent
    // render crash (e.g. renewals uses object, others use array)
    setData(tabKey === 'renewals' ? { expired_packages: [], renewals: [] } : []);
    setActiveTab(tabKey);
    navigate(`/pro/crm/${tabKey}`);
  };

  // Complete Followup Action
  const handleCompleteFollowup = async (followupId) => {
    try {
      const res = await proApi.updateFollowupStatus(followupId, { status: 'completed' });
      if (res.success) {
        showToast('Follow-up marked as completed', 'success');
        fetchTabContent('followups');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update follow-up', 'error');
    }
  };

  // Submit Call
  const handleLogCall = async (e) => {
    e.preventDefault();
    if (!callForm.patient_id) { showToast('Patient selection is required', 'error'); return; }
    if (callForm.call_status === 'callback_requested' && !callForm.callback_date) {
      showToast('Callback date is required when callback is requested', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await proApi.createCall({
        ...callForm,
        patient_id: parseInt(callForm.patient_id, 10)
      });
      if (res.success) {
        showToast('Call outcome logged successfully', 'success');
        setShowCallModal(false);
        setCallForm({ patient_id: '', interaction_type: 'outbound', call_purpose: 'followup', call_status: 'connected', callback_date: '', callback_time: '10:00:00', remarks: '' });
        fetchTabContent('calls');
      }
    } catch (err) {
      showToast(err.message || 'Failed to log call', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Followup
  const handleCreateFollowup = async (e) => {
    e.preventDefault();
    if (!followupForm.patient_id || !followupForm.purpose.trim()) {
      showToast('Patient selection and purpose are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await proApi.createFollowup({
        ...followupForm,
        patient_id: parseInt(followupForm.patient_id, 10)
      });
      if (res.success) {
        showToast('Follow-up task scheduled successfully', 'success');
        setShowFollowupModal(false);
        setFollowupForm({ patient_id: '', followup_type: 'treatment', followup_date: new Date().toISOString().split('T')[0], purpose: '', remarks: '' });
        fetchTabContent('followups');
      }
    } catch (err) {
      showToast(err.message || 'Failed to create follow-up', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Renewal
  const handleRecordRenewal = async (e) => {
    e.preventDefault();
    if (!renewalForm.patient_id || !renewalForm.renewal_amount) {
      showToast('Patient selection and renewal amount are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await proApi.createRenewal({
        patient_id: parseInt(renewalForm.patient_id, 10),
        package_id: renewalForm.package_id ? parseInt(renewalForm.package_id, 10) : null,
        renewal_amount: parseFloat(renewalForm.renewal_amount),
        call_status: renewalForm.call_status,
        remarks: renewalForm.remarks
      });
      if (res.success) {
        showToast('Package renewal recorded successfully', 'success');
        setShowRenewalModal(false);
        setRenewalForm({ patient_id: '', package_id: '', renewal_amount: '', call_status: 'renewed', remarks: '' });
        fetchTabContent('renewals');
      }
    } catch (err) {
      showToast(err.message || 'Failed to record renewal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit OC / NR
  const handleRecordOCNR = async (e) => {
    e.preventDefault();
    if (!ocnrForm.patient_id) {
      showToast('Patient selection is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await proApi.createOCNRPatient({
        patient_id: parseInt(ocnrForm.patient_id, 10),
        classification: ocnrForm.classification,
        reason: ocnrForm.reason,
        remarks: ocnrForm.remarks
      });
      if (res.success) {
        showToast('OC / NR patient recorded successfully', 'success');
        setShowOCNRModal(false);
        setOCNRForm({ patient_id: '', classification: 'oc', reason: 'not_interested', remarks: '' });
        fetchTabContent('ocnr');
      }
    } catch (err) {
      showToast(err.message || 'Failed to record OC/NR patient', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Collect Due Modal
  const handleOpenDueModal = (due) => {
    setSelectedDue(due);
    setDuePaymentForm({
      amount: String(due.due_amount || ''),
      payment_method: 'cash',
      remarks: ''
    });
    setShowDueModal(true);
  };

  // Submit Due Collection Payment
  const handleCollectDue = async (e) => {
    e.preventDefault();
    if (!selectedDue) return;
    const payAmount = parseFloat(duePaymentForm.amount);
    if (!payAmount || payAmount <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    if (payAmount > parseFloat(selectedDue.due_amount)) {
      showToast(`Payment amount (₹${payAmount}) exceeds outstanding due (₹${selectedDue.due_amount})`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await proApi.recordPayment({
        bill_id: selectedDue.bill_id,
        amount: payAmount,
        payment_method: duePaymentForm.payment_method,
        remarks: duePaymentForm.remarks || `Due collection for ${selectedDue.bill_number}`
      });
      if (res.success) {
        const remaining = res.data?.remaining_due ?? 0;
        showToast(
          remaining > 0
            ? `₹${payAmount} collected. Remaining due: ₹${remaining}`
            : `₹${payAmount} collected. Bill fully paid!`,
          'success'
        );
        setShowDueModal(false);
        setSelectedDue(null);
        fetchTabContent('dues');
      }
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] inline-block" />
            <PhoneCall className="w-5 h-5 text-[#1565C0]" />
            <span>CRM & Patient Calling Hub</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Outbound patient care calls, treatment follow-ups, renewal opportunities, and dues management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTabContent(activeTab)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {activeTab === 'calls' && (
            <button
              onClick={() => setShowCallModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Call</span>
            </button>
          )}

          {activeTab === 'followups' && (
            <button
              onClick={() => setShowFollowupModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Follow-up</span>
            </button>
          )}

          {activeTab === 'renewals' && (
            <button
              onClick={() => setShowRenewalModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Renewal</span>
            </button>
          )}

          {activeTab === 'ocnr' && (
            <button
              onClick={() => setShowOCNRModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record OC / NR</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {[
          { id: 'calls', label: "Today's Calls", icon: PhoneCall },
          { id: 'followups', label: 'Follow-ups', icon: PhoneForwarded },
          { id: 'renewals', label: 'Renewals Queue', icon: RefreshCw },
          { id: 'dues', label: 'Due Reminders', icon: Clock },
          { id: 'acq', label: 'ACQ Patients', icon: CalendarCheck },
          { id: 'ocnr', label: 'OC / NR Patients', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#1565C0] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {loading ? (
        <LoadingSpinner label={`Loading CRM ${activeTab}...`} />
      ) : activeTab === 'calls' ? (
        !Array.isArray(data) || data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <PhoneCall className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No calls logged today</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Log Call" to record an inbound or outbound call outcome.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Time</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Purpose</th>
                  <th className="py-3.5 px-4">Call Status</th>
                  <th className="py-3.5 px-4">Callback Details</th>
                  <th className="py-3.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(c => (
                  <tr key={c.call_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                      {c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link to={`/pro/patients/${c.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                        {c.patient_name || `Patient #${c.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 capitalize">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.interaction_type === 'inbound' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {c.interaction_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 capitalize font-medium text-slate-800">
                      {c.call_purpose?.replace('_', ' ')}
                    </td>
                    <td className="py-3.5 px-4 capitalize">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {c.call_status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                      {formatCallback(c.callback_date, c.callback_time)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{c.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : activeTab === 'followups' ? (
        !Array.isArray(data) || data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <PhoneForwarded className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No scheduled follow-ups</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Schedule Follow-up" to schedule a treatment or renewal check-in.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Assigned To</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(f => {
                  const fId = f.id || f.followup_id;
                  const isPending = f.status === 'pending';
                  return (
                    <tr key={fId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{f.due_date}</td>
                      <td className="py-3.5 px-4">
                        <Link to={`/pro/patients/${f.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                          {f.patient_name || `Patient #${f.patient_id}`}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 capitalize">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1565C0]">
                          {f.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{f.assigned_to_name || 'PRO / Manager'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          f.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : f.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{f.remarks || '—'}</td>
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <button
                            onClick={() => handleCompleteFollowup(fId)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Complete</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : activeTab === 'renewals' ? (
        <div className="space-y-6">
          {/* Expiring / Expired Packages section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Packages Expiring within 7 Days or Expired ({(data.expired_packages || []).length})</span>
            </h3>
            {(data.expired_packages || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No packages currently due for renewal.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.expired_packages.map(p => (
                  <div key={p.package_id} className="py-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{p.package_name}</div>
                      <div className="text-[11px] text-slate-500">
                        Patient: <Link to={`/pro/patients/${p.patient_id}`} className="font-bold text-[#1565C0] hover:underline">{p.patient_name}</Link> • Validity Ended: <span className="text-red-600 font-bold">{p.to_date}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setRenewalForm({
                          patient_id: String(p.patient_id),
                          package_id: String(p.package_id),
                          renewal_amount: String(p.final_amount || ''),
                          call_status: 'renewed',
                          remarks: 'Renewed from renewals queue'
                        });
                        setShowRenewalModal(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition cursor-pointer"
                    >
                      Record Renewal
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recorded Renewals History */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Recorded Package Renewals ({(data.renewals || []).length})
            </h3>
            {(data.renewals || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No renewals recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Patient</th>
                      <th className="py-2.5 px-3">Doctor</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.renewals.map(r => (
                      <tr key={r.id || r.renewal_id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">{r.renewal_date}</td>
                        <td className="py-2.5 px-3">
                          <Link to={`/pro/patients/${r.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                            {r.patient_name || `Patient #${r.patient_id}`}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{r.doctor_name || '—'}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{formatCurrency(r.amount)}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 capitalize">
                            {r.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'dues' ? (
        !Array.isArray(data) || data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No Outstanding Dues</p>
            <p className="text-xs text-slate-400 mt-1">All patient bills are fully paid. Outstanding balances will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-4.5 h-4.5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Outstanding</p>
                  <p className="text-lg font-black text-red-600">
                    {formatCurrency(data.reduce((sum, d) => sum + parseFloat(d.due_amount || 0), 0))}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {data.length} patient{data.length !== 1 ? 's' : ''} with dues
              </span>
            </div>

            {/* Dues table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Patient</th>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Due Balance</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <Link to={`/pro/patients/${d.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                          {d.patient_name || `Patient #${d.patient_id}`}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{d.bill_number}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-red-600">{formatCurrency(d.due_amount)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          d.status === 'paid' ? 'bg-emerald-100 text-emerald-800'
                            : d.status === 'partially_paid' ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {d.status?.replace('_', ' ') || 'pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {parseFloat(d.due_amount) > 0 && d.status !== 'paid' ? (
                          <button
                            onClick={() => handleOpenDueModal(d)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <DollarSign className="w-3 h-3" />
                            <span>Collect Due</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold">Paid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'acq' ? (
        !Array.isArray(data) || data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No ACQ monthly patients recorded</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Renewal Date</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(a => (
                  <tr key={a.acq_id || a.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <Link to={`/pro/patients/${a.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                        {a.patient_name || `Patient #${a.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-mono">{a.renewal_date || '—'}</td>
                    <td className="py-3.5 px-4 capitalize">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        !Array.isArray(data) || data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No OC / NR records</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Reason for Not Continuing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(o => (
                  <tr key={o.oc_nr_id || o.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 text-slate-500">
                      {o.marked_at ? new Date(o.marked_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link to={`/pro/patients/${o.patient_id}`} className="font-bold text-[#1565C0] hover:underline">
                        {o.patient_name || `Patient #${o.patient_id}`}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 uppercase font-bold text-slate-900">{o.classification}</td>
                    <td className="py-3.5 px-4 text-slate-700 capitalize">{o.reason?.replace('_', ' ') || 'Not given'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Log Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#1565C0]" />
                <span>Log Patient Call</span>
              </h2>
              <button onClick={() => setShowCallModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleLogCall} className="space-y-3.5">
              <PatientSelector
                value={callForm.patient_id}
                onChange={(pId) => setCallForm({ ...callForm, patient_id: pId })}
                label="Patient *"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Type *</label>
                  <select
                    value={callForm.interaction_type}
                    onChange={e => setCallForm({ ...callForm, interaction_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none bg-white font-medium"
                  >
                    <option value="outbound">Outbound (We Called)</option>
                    <option value="inbound">Inbound (Patient Called)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Call Purpose *</label>
                  <select
                    value={callForm.call_purpose}
                    onChange={e => setCallForm({ ...callForm, call_purpose: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none bg-white font-medium"
                  >
                    <option value="followup">Follow-up</option>
                    <option value="renewal">Package Renewal</option>
                    <option value="due_payment">Due Reminder</option>
                    <option value="acq">ACQ Care</option>
                    <option value="ocnr">OC / NR Inquiry</option>
                    <option value="appointment">Appointment</option>
                    <option value="general_enquiry">General Enquiry</option>
                    <option value="callback">Callback</option>
                    <option value="patient_feedback">Patient Feedback</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Call Status *</label>
                <select
                  value={callForm.call_status}
                  onChange={e => setCallForm({ ...callForm, call_status: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none bg-white font-medium"
                >
                  <option value="connected">Connected & Discussed</option>
                  <option value="callback_requested">Callback Requested</option>
                  <option value="not_connected">Not Connected / No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="switched_off">Switched Off / Unreachable</option>
                  <option value="interested">Interested</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="appointment_booked">Appointment Booked</option>
                  <option value="followup_required">Follow-up Required</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {callForm.call_status === 'callback_requested' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div>
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">Callback Date *</label>
                    <input
                      type="date"
                      required
                      value={callForm.callback_date}
                      onChange={e => setCallForm({ ...callForm, callback_date: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-amber-300 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">Callback Time</label>
                    <input
                      type="time"
                      value={callForm.callback_time}
                      onChange={e => setCallForm({ ...callForm, callback_time: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-amber-300 outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Remarks / Outcome</label>
                <input
                  type="text"
                  value={callForm.remarks}
                  onChange={e => setCallForm({ ...callForm, remarks: e.target.value })}
                  placeholder="Notes from discussion..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowCallModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !callForm.patient_id} className="px-5 py-2 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <PhoneForwarded className="w-4 h-4 text-[#1565C0]" />
                <span>Schedule CRM Follow-up</span>
              </h2>
              <button onClick={() => setShowFollowupModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFollowup} className="space-y-3.5">
              <PatientSelector
                value={followupForm.patient_id}
                onChange={(pId) => setFollowupForm({ ...followupForm, patient_id: pId })}
                label="Patient *"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Category *</label>
                  <select
                    value={followupForm.followup_type}
                    onChange={e => setFollowupForm({ ...followupForm, followup_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none bg-white font-medium"
                  >
                    <option value="treatment">Treatment</option>
                    <option value="appointment">Appointment</option>
                    <option value="renewal">Renewal</option>
                    <option value="due">Due</option>
                    <option value="acq">ACQ</option>
                    <option value="ocnr">OC / NR</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={followupForm.followup_date}
                    onChange={e => setFollowupForm({ ...followupForm, followup_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Purpose *</label>
                <input
                  type="text"
                  required
                  value={followupForm.purpose}
                  onChange={e => setFollowupForm({ ...followupForm, purpose: e.target.value })}
                  placeholder="e.g. Check medicine tolerance after 7 days"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Remarks</label>
                <input
                  type="text"
                  value={followupForm.remarks}
                  onChange={e => setFollowupForm({ ...followupForm, remarks: e.target.value })}
                  placeholder="Additional context or notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowFollowupModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !followupForm.patient_id} className="px-5 py-2 bg-[#1565C0] hover:bg-[#0D47A1] text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50">
                  {submitting ? 'Scheduling...' : 'Schedule Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {showRenewalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <span>Record Package Renewal</span>
              </h2>
              <button onClick={() => setShowRenewalModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordRenewal} className="space-y-3.5">
              <PatientSelector
                value={renewalForm.patient_id}
                onChange={(pId) => setRenewalForm({ ...renewalForm, patient_id: pId })}
                label="Patient *"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Package ID (Optional)</label>
                  <input
                    type="number"
                    value={renewalForm.package_id}
                    onChange={e => setRenewalForm({ ...renewalForm, package_id: e.target.value })}
                    placeholder="Existing Pkg ID..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Renewal Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={renewalForm.renewal_amount}
                    onChange={e => setRenewalForm({ ...renewalForm, renewal_amount: e.target.value })}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Remarks</label>
                <input
                  type="text"
                  value={renewalForm.remarks}
                  onChange={e => setRenewalForm({ ...renewalForm, remarks: e.target.value })}
                  placeholder="Notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowRenewalModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !renewalForm.patient_id} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50">
                  {submitting ? 'Recording...' : 'Record Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OC / NR Modal */}
      {showOCNRModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700" />
                <span>Record OC / NR Patient</span>
              </h2>
              <button onClick={() => setShowOCNRModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordOCNR} className="space-y-3.5">
              <PatientSelector
                value={ocnrForm.patient_id}
                onChange={(pId) => setOCNRForm({ ...ocnrForm, patient_id: pId })}
                label="Patient *"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Classification *</label>
                  <select
                    value={ocnrForm.classification}
                    onChange={e => setOCNRForm({ ...ocnrForm, classification: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-slate-400 outline-none bg-white font-medium"
                  >
                    <option value="oc">OC (One-time Consultation)</option>
                    <option value="nr">NR (Not Responding / Dropped)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Reason *</label>
                  <select
                    value={ocnrForm.reason}
                    onChange={e => setOCNRForm({ ...ocnrForm, reason: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-slate-400 outline-none bg-white font-medium"
                  >
                    <option value="not_interested">Not Interested</option>
                    <option value="cost_concern">Cost Concern</option>
                    <option value="will_decide_later">Will Decide Later</option>
                    <option value="wants_second_opinion">Wants 2nd Opinion</option>
                    <option value="relocated">Relocated / Distance</option>
                    <option value="other">Other Reason</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Remarks</label>
                <input
                  type="text"
                  value={ocnrForm.remarks}
                  onChange={e => setOCNRForm({ ...ocnrForm, remarks: e.target.value })}
                  placeholder="Specific patient feedback..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-slate-400 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowOCNRModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !ocnrForm.patient_id} className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50">
                  {submitting ? 'Recording...' : 'Record OC/NR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Due Payment Modal */}
      {showDueModal && selectedDue && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Collect Outstanding Due</span>
              </h2>
              <button onClick={() => { setShowDueModal(false); setSelectedDue(null); }} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">
                ✕
              </button>
            </div>

            {/* Bill Info Summary */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Patient</span>
                <span className="font-bold text-slate-900">{selectedDue.patient_name || `Patient #${selectedDue.patient_id}`}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Invoice</span>
                <span className="font-mono font-bold text-slate-700">{selectedDue.bill_number}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-500 font-bold">Outstanding Due</span>
                <span className="font-mono font-black text-red-600 text-sm">{formatCurrency(selectedDue.due_amount)}</span>
              </div>
            </div>

            <form onSubmit={handleCollectDue} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedDue.due_amount}
                    step="0.01"
                    value={duePaymentForm.amount}
                    onChange={e => setDuePaymentForm({ ...duePaymentForm, amount: e.target.value })}
                    placeholder="e.g. 200"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Payment Method *</label>
                  <select
                    value={duePaymentForm.payment_method}
                    onChange={e => setDuePaymentForm({ ...duePaymentForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none bg-white font-medium"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="razorpay">Razorpay</option>
                    <option value="bajaj_pay">Bajaj Pay</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Remarks</label>
                <input
                  type="text"
                  value={duePaymentForm.remarks}
                  onChange={e => setDuePaymentForm({ ...duePaymentForm, remarks: e.target.value })}
                  placeholder="Payment notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => { setShowDueModal(false); setSelectedDue(null); }} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !duePaymentForm.amount} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50">
                  {submitting ? 'Processing...' : 'Collect Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default PROCRMPage;
