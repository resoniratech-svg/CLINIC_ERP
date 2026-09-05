import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  History,
  PhoneForwarded,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Clock,
  Search,
  Filter,
  RefreshCw,
  PhoneCall
} from 'lucide-react';

export const OutboundHistoryPage = () => {
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { showToast } = useToast();

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await executiveApi.getCallHistory();
      if (res.success && res.data) {
        // Filter outbound calls only
        const outboundOnly = res.data.filter((c) => c.interaction_type === 'outbound');
        setCalls(outboundOnly);
      } else {
        showToast('Failed to load outbound history', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error fetching outbound history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredCalls = calls.filter((c) => {
    const name = (c.patient_name || c.lead_name || '').toLowerCase();
    const rem = (c.remarks || '').toLowerCase();
    const q = searchTerm.toLowerCase();

    const matchesSearch = name.includes(q) || rem.includes(q);
    const matchesStatus = statusFilter === 'all' || c.call_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Outbound Calling & Import History
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
              {calls.length} Total Logs
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Historical log of outbound engagements, call outcomes, and campaign follow-ups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
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
            <span>Upload New Excel</span>
          </Link>
        </div>
      </div>

      {/* 2. Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search contact name or notes..."
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
            <option value="all">All Call Outcomes</option>
            <option value="interested">Interested</option>
            <option value="callback_requested">Callback Requested</option>
            <option value="connected">Connected</option>
            <option value="not_interested">Not Interested</option>
            <option value="busy">Busy / Unreachable</option>
          </select>
        </div>
      </div>

      {/* 3. History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner label="Loading outbound call history..." />
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <History className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No outbound call logs found</p>
            <p className="text-[11px] text-slate-400">Calls made from your Outbound Queue will automatically appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4"># Call ID</th>
                  <th className="py-3 px-4">Contact / Lead</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Remarks / Followup</th>
                  <th className="py-3 px-4 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCalls.map((call) => (
                  <tr key={call.call_id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">
                      #{call.call_id}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {call.patient_name || call.lead_name || 'Contact'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">
                      {call.call_purpose || 'Outbound Campaign'}
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
                    <td className="py-3 px-4 text-right text-slate-400 font-mono text-[11px]">
                      {new Date(call.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
