import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EditCallModal } from './EditCallModal';
import { useToast } from '../../context/ToastContext';
import {
  History,
  PhoneCall,
  PhoneIncoming,
  PhoneForwarded,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  Clock,
  Pencil
} from 'lucide-react';

export const ExecutiveCallHistoryPage = () => {
  const location = useLocation();
  const isTodayOnly = location.pathname.includes('/today');

  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState([]);
  const [editingCall, setEditingCall] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { showToast } = useToast();

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const res = await executiveApi.getCallHistory();
      if (res.success && res.data) {
        let list = res.data;
        if (isTodayOnly) {
          const todayStr = new Date().toISOString().split('T')[0];
          list = list.filter((c) => c.created_at && c.created_at.startsWith(todayStr));
        }
        setCalls(list);
      } else {
        showToast('Failed to load call history', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error fetching call records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [isTodayOnly]);

  const filteredCalls = calls.filter((c) => {
    const name = (c.patient_name || c.lead_name || '').toLowerCase();
    const rem = (c.remarks || '').toLowerCase();
    const q = searchTerm.toLowerCase();

    const matchesSearch = name.includes(q) || rem.includes(q);
    const matchesType = typeFilter === 'all' || c.interaction_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || c.call_status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {isTodayOnly ? "Today's Calls Log" : "Comprehensive Call History"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
              {filteredCalls.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {isTodayOnly
              ? "All inbound and outbound calls completed by you during today's shift."
              : "Chronological ledger of all patient and contact calling interactions."}
          </p>
        </div>

        <button
          onClick={fetchCalls}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search patient, lead, or conversation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Channel Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Channels</option>
            <option value="inbound">Inbound Calls</option>
            <option value="outbound">Outbound Calls</option>
          </select>

          {/* Outcome Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Outcomes</option>
            <option value="interested">Interested</option>
            <option value="callback_requested">Callback Requested</option>
            <option value="connected">Connected</option>
            <option value="not_interested">Not Interested</option>
            <option value="busy">Busy</option>
          </select>
        </div>
      </div>

      {/* 3. Call History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Retrieving call logs..." />
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <History className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No call history logs match criteria</p>
            <p className="text-[11px] text-slate-400">Calls logged via Inbound Search or Outbound Queue will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4"># Call ID</th>
                  <th className="py-3 px-4">Patient / Contact</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCalls.map((call) => (
                  <tr key={call.call_id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">
                      #{call.call_id}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {call.patient_name || call.lead_name || 'Caller'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 capitalize text-[11px]">
                        {call.interaction_type === 'inbound' ? (
                          <PhoneIncoming className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <PhoneForwarded className="w-3 h-3 text-blue-600" />
                        )}
                        <span>{call.interaction_type}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">
                      {call.call_purpose || 'General Enquiry'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          call.call_status === 'interested'
                            ? 'bg-emerald-100 text-emerald-800'
                            : call.call_status === 'callback_requested'
                            ? 'bg-amber-100 text-amber-800'
                            : call.call_status === 'not_interested'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {call.call_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {call.remarks || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(call.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setEditingCall(call)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Edit Call Outcome"
                      >
                        <Pencil className="w-3.5 h-3.5 text-blue-600" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Edit Call Outcome Modal */}
      <EditCallModal
        isOpen={Boolean(editingCall)}
        onClose={() => setEditingCall(null)}
        call={editingCall}
        onCallUpdated={() => {
          fetchCalls();
          setEditingCall(null);
        }}
      />
    </div>
  );
};
