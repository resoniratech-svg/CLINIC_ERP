import React, { useState, useEffect } from 'react';
import { logsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Clock, Search, MapPin } from 'lucide-react';

export function LoginHistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
  });

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await logsApi.getLoginLogs(filters);
      if (res.data?.success) {
        setLogs(res.data.data || []);
      } else {
        setLogs(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch login logs:', err);
      setError('Failed to load login history logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!filters.search) return true;
    const term = filters.search.toLowerCase();
    return (
      (log.username && log.username.toLowerCase().includes(term)) ||
      (log.full_name && log.full_name.toLowerCase().includes(term)) ||
      (log.employee_id && log.employee_id.toLowerCase().includes(term))
    );
  });

  const formatDuration = (seconds, logoutTime) => {
    if (!logoutTime && (!seconds || seconds === 0)) {
      return <span className="font-semibold text-slate-700">Active Session</span>;
    }
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return <span className="text-slate-600">{`${m}m ${s}s`}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Staff Authentication & Login Access Surveillance
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Audit trail of logins, session durations, assigned branch locations, devices, and IP addresses
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search operator by name or employ..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          />
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-4">OPERATOR</th>
                  <th className="px-6 py-4">ROLE</th>
                  <th className="px-6 py-4">LOGIN TIMESTAMP</th>
                  <th className="px-6 py-4">SESSION DURATION</th>
                  <th className="px-6 py-4">BRANCH / LOCATION</th>
                  <th className="px-6 py-4">IP & WORKSTATION</th>
                  <th className="px-6 py-4 text-center">AUTH STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-slate-400 font-medium">
                      No login surveillance logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id || log.login_time} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{log.full_name || log.username || 'User'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {log.employee_id || 'EMP000'} • @{log.username || 'admin'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 capitalize">
                          {log.role ? log.role.replace('_', ' ') : 'super admin'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                        {log.login_time ? new Date(log.login_time).toLocaleString('en-US') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {formatDuration(log.session_duration_seconds, log.logout_time)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{log.location || 'Karimnagar Main Branch'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-slate-600 text-[11px]">{log.ip_address || '::1'}</div>
                        <div className="text-[11px] text-slate-400">
                          {log.device || 'Desktop'} • {log.browser || 'Chrome'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 capitalize">
                          {log.status || 'success'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
