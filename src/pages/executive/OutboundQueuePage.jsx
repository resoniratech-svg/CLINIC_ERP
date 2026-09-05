import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { EditLeadModal } from './EditLeadModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  PhoneForwarded,
  PhoneCall,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  HeartHandshake,
  UserX,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Send,
  UserCheck,
  Pencil
} from 'lucide-react';

export const OutboundQueuePage = () => {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Outcome Modal State
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingOutboundLead, setEditingOutboundLead] = useState(null);
  const [outcomeStatus, setOutcomeStatus] = useState('connected');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [outcomeRemarks, setOutcomeRemarks] = useState('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  const { showToast } = useToast();
  const { user } = useAuth();

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await executiveApi.getOutboundQueue();
      if (res.success && res.data) {
        setQueue(res.data);
      } else {
        showToast('Failed to load outbound calling queue', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error fetching outbound queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const openOutcomeModal = (lead) => {
    setSelectedLead(lead);
    setOutcomeStatus('interested');
    setCallbackDate('');
    setCallbackTime('');
    setOutcomeRemarks('');
  };

  const handleOutcomeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    if (outcomeStatus === 'callback_requested' && (!callbackDate || !callbackTime)) {
      showToast('Callback Date and Time are required for Callback Requested', 'warning');
      return;
    }

    setSubmittingOutcome(true);
    try {
      const payload = {
        outbound_lead_id: selectedLead.id,
        patient_name: selectedLead.patient_name || selectedLead.name,
        mobile_number: selectedLead.mobile_number,
        age: selectedLead.age || null,
        gender: selectedLead.gender || null,
        campaign: selectedLead.campaign || 'Outbound Calling Queue',
        interaction_type: 'outbound',
        call_purpose: 'followup',
        call_status: outcomeStatus,
        callback_date: callbackDate || null,
        callback_time: callbackTime || null,
        remarks: outcomeRemarks.trim() || null
      };

      const res = await executiveApi.recordCallOutcome(payload);
      if (res.success && res.data) {
        if (outcomeStatus === 'interested' || outcomeStatus === 'lead_created') {
          showToast('Call recorded as INTERESTED! Lead generated & routed to Receptionist Queue.', 'success');
        } else if (outcomeStatus === 'callback_requested') {
          showToast('Callback scheduled and added to your Callbacks tab.', 'info');
        } else {
          showToast('Call outcome updated successfully.', 'success');
        }
        setSelectedLead(null);
        fetchQueue();
      } else {
        showToast('Failed to record call outcome', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error updating call outcome', 'error');
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const filteredQueue = queue.filter((item) => {
    const name = (item.patient_name || item.name || '').toLowerCase();
    const mob = (item.mobile_number || '').toLowerCase();
    const camp = (item.campaign || '').toLowerCase();
    const q = searchTerm.toLowerCase();

    const matchesSearch = name.includes(q) || mob.includes(q) || camp.includes(q);
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              My Outbound Calling Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
              {queue.length} Pending
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Campaign contacts assigned to you • Call patients, gauge interest, and hand off qualified leads to Receptionist.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/executive/outbound/import"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import Excel Data</span>
          </Link>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by name, mobile or campaign..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full sm:w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="call_back">Call Back</option>
            <option value="contacted">Contacted</option>
          </select>
        </div>
      </div>

      {/* 3. Calling Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Fetching outbound calling queue..." />
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <PhoneForwarded className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800">
              No calling tasks in queue
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All campaign leads have been completed, or no outbound records are currently assigned to your account.
            </p>
            <Link
              to="/executive/outbound/import"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import Excel Contact List</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Contact / Patient Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Problem / Requirement</th>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredQueue.map((lead, idx) => (
                  <tr key={lead.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {lead.serial_no || String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {lead.patient_name || lead.name || 'Unknown Patient'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {lead.village || lead.mandal ? `${lead.village || ''} ${lead.mandal ? `• ${lead.mandal}` : ''}` : 'Location: —'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {lead.mobile_number}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {lead.problem || lead.requirement || 'General Health Followup'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {lead.campaign || 'August Campaign'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          lead.status === 'new'
                            ? 'bg-blue-100 text-blue-800'
                            : lead.status === 'call_back'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingOutboundLead(lead)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          title="Edit Contact Information"
                        >
                          <Pencil className="w-3.5 h-3.5 text-blue-600" />
                          <span>Edit</span>
                        </button>

                        <a
                          href={`tel:${lead.mobile_number}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Call</span>
                        </a>

                        <button
                          onClick={() => openOutcomeModal(lead)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          <span>Update Call</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Edit Outbound Contact Modal */}
      <EditLeadModal
        isOpen={Boolean(editingOutboundLead)}
        onClose={() => setEditingOutboundLead(null)}
        lead={editingOutboundLead}
        isOutbound={true}
        onLeadUpdated={() => {
          fetchQueue();
          setEditingOutboundLead(null);
        }}
      />

      {/* 5. Update Call Outcome Modal */}
      <Modal
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        title="Record Outbound Call Outcome"
        maxWidth="max-w-lg"
      >
        {selectedLead && (
          <form onSubmit={handleOutcomeSubmit} className="space-y-4 text-xs text-slate-800">
            {/* Lead Meta Strip */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Patient Contact
                </span>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedLead.patient_name || selectedLead.name}
                </div>
                <div className="text-slate-500 text-[11px] font-mono">
                  {selectedLead.mobile_number}
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-600">
                {selectedLead.campaign || 'Campaign Lead'}
              </span>
            </div>

            {/* Outcome Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Call Outcome / Patient Response <span className="text-red-500">*</span>
              </label>
              <select
                value={outcomeStatus}
                onChange={(e) => setOutcomeStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="interested">Interested (Automatically Generate Lead for Receptionist)</option>
                <option value="callback_requested">Call Back Requested (Schedule Followup)</option>
                <option value="connected">Connected (General Talk)</option>
                <option value="not_interested">Not Interested (Archived)</option>
                <option value="busy">Line Busy</option>
                <option value="switched_off">Switched Off / Not Reachable</option>
                <option value="not_connected">No Answer / Not Connected</option>
              </select>
            </div>

            {/* Notice if Interested */}
            {outcomeStatus === 'interested' && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 flex items-start gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Incentive Credited:</strong> Selecting <em>Interested</em> will automatically generate an official Lead, assign your Executive ID, and route it to the <strong>Receptionist Leads Queue</strong> for Doctor Assignment.
                </p>
              </div>
            )}

            {/* Callback Date & Time Fields if callback_requested */}
            {outcomeStatus === 'callback_requested' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                    Callback Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                    Callback Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={callbackTime}
                    onChange={(e) => setCallbackTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Remarks / Conversation Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Call Conversation Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Discussed homeopathy treatment for chronic back pain. Patient willing to attend next Tuesday."
                value={outcomeRemarks}
                onChange={(e) => setOutcomeRemarks(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submittingOutcome}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                {submittingOutcome ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Save Call Outcome</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
