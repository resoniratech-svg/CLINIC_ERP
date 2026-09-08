import React, { useState, useEffect } from 'react';
import { logsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { Shield, Eye, Filter } from 'lucide-react';

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    module: '',
    role: '',
  });

  const [inspectItem, setInspectItem] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await logsApi.getAuditLogs(filters);
      if (res.data?.success) {
        setLogs(res.data.data || []);
      } else {
        setLogs(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to load audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters.module, filters.role]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Immutable System Mutation Audit Trails
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Cryptographically tracked data mutations, user actions, IP addresses, workstations, and state diffs
            </p>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-3">
          <select
            value={filters.module}
            onChange={(e) => setFilters((prev) => ({ ...prev, module: e.target.value }))}
            className="py-2 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          >
            <option value="">All Modules</option>
            <option value="AUTH">Auth</option>
            <option value="EXECUTIVE / CALL CENTER">Executive / Call Center</option>
            <option value="Hospital Settings">Hospital Settings</option>
            <option value="Users">Users</option>
            <option value="Doctors">Doctors</option>
            <option value="Billing">Billing</option>
            <option value="Pharmacy">Pharmacy</option>
            <option value="CRM">CRM</option>
          </select>

          <select
            value={filters.role}
            onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
            className="py-2 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="receptionist">Receptionist</option>
            <option value="executive">Executive</option>
            <option value="doctor">Doctor</option>
            <option value="pro_manager">PRO Manager</option>
            <option value="pharmacy">Pharmacy</option>
          </select>
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
                  <th className="px-6 py-4">TIMESTAMP</th>
                  <th className="px-6 py-4">OPERATOR</th>
                  <th className="px-6 py-4">MODULE</th>
                  <th className="px-6 py-4">ACTION</th>
                  <th className="px-6 py-4">IP & DEVICE</th>
                  <th className="px-6 py-4 text-center">STATE DIFF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-slate-400 font-medium">
                      No mutation audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id || log.created_at} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                        {log.created_at ? new Date(log.created_at).toLocaleString('en-US') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{log.username || log.full_name || 'System'}</div>
                        <div className="text-[11px] text-slate-400 capitalize">{log.role ? log.role.replace('_', ' ') : 'Executive'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 uppercase tracking-wide">
                          {log.module || 'SYSTEM'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{log.action || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-slate-600 text-[11px]">{log.ip_address || '::1'}</div>
                        <div className="text-[11px] text-slate-400">
                          {log.device || 'Desktop'} • {log.browser || 'Chrome'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setInspectItem(log)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect State Diff Modal */}
      {inspectItem && (
        <Modal
          isOpen={!!inspectItem}
          onClose={() => setInspectItem(null)}
          title="Audit Trail State Mutation Inspector"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Action</span>
                <p className="font-semibold text-slate-800">{inspectItem.action}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Module</span>
                <p className="font-semibold text-indigo-600">{inspectItem.module}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Operator</span>
                <p className="font-semibold text-slate-800">{inspectItem.username || inspectItem.full_name}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Timestamp</span>
                <p className="font-semibold text-slate-800">
                  {inspectItem.created_at ? new Date(inspectItem.created_at).toLocaleString() : '-'}
                </p>
              </div>
            </div>

            {/* Old vs New State Diff */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Previous State (Before)
                </h4>
                <pre className="bg-slate-900 text-amber-300 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                  {inspectItem.old_value
                    ? JSON.stringify(inspectItem.old_value, null, 2)
                    : 'null (Created Record)'}
                </pre>
              </div>
              <div>
                <h4 className="font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Mutated State (After)
                </h4>
                <pre className="bg-slate-900 text-emerald-300 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                  {inspectItem.new_value
                    ? JSON.stringify(inspectItem.new_value, null, 2)
                    : JSON.stringify(inspectItem, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
