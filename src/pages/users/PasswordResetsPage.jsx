import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { passwordResetApi } from '../../api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { KeyRound, Check, X, ShieldCheck, Copy, Search } from 'lucide-react';

const normalizeDateForInput = (d) => {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(d)) {
    const parts = d.split(/[\/-]/);
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return d;
};

export const PasswordResetsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  const initialRole = searchParams.get('role') || '';
  const initialStatus = searchParams.get('status') || '';
  const initialDate = normalizeDateForInput(searchParams.get('date') || '');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state — all automatic
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState(initialRole);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [dateFilter, setDateFilter] = useState(initialDate);

  const [approvedResult, setApprovedResult] = useState(null);

  const { showToast } = useToast();

  const fetchRequests = useCallback(async (search, role, status, date) => {
    setLoading(true);
    try {
      const params = {};
      if (search && search.trim()) params.search = search.trim();
      if (role && role.trim()) params.role = role.trim();
      if (status && status.trim()) params.status = status.trim();
      if (date && date.trim()) params.date = date.trim();

      const res = await passwordResetApi.getRequests(params);
      if (res.success) {
        setRequests(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch password reset requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Automatic debounced filter effect (triggers automatically while typing or changing filters)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Sync URL query params
      const params = {};
      if (searchTerm && searchTerm.trim()) params.search = searchTerm.trim();
      if (roleFilter && roleFilter.trim()) params.role = roleFilter.trim();
      if (statusFilter && statusFilter.trim()) params.status = statusFilter.trim();
      if (dateFilter && dateFilter.trim()) params.date = dateFilter.trim();
      setSearchParams(params, { replace: true });

      fetchRequests(searchTerm, roleFilter, statusFilter, dateFilter);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, roleFilter, statusFilter, dateFilter, fetchRequests, setSearchParams]);

  const handleApprove = async (id, userName) => {
    if (!window.confirm(`Approve password reset for ${userName}? A new temporary password will be generated.`)) return;
    try {
      const res = await passwordResetApi.approveRequest(id);
      if (res.success) {
        setApprovedResult(res.data);
        showToast('Password reset request approved', 'success');
        fetchRequests(searchTerm, roleFilter, statusFilter, dateFilter);
      }
    } catch (err) {
      showToast(err.message || 'Failed to approve request', 'error');
    }
  };

  const handleReject = async (id, userName) => {
    if (!window.confirm(`Reject password reset request for ${userName}?`)) return;
    try {
      const res = await passwordResetApi.rejectRequest(id);
      if (res.success) {
        showToast('Password reset request rejected', 'info');
        fetchRequests(searchTerm, roleFilter, statusFilter, dateFilter);
      }
    } catch (err) {
      showToast(err.message || 'Failed to reject request', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            <span>Password Reset Authorization</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Super Admin verifies user identity and generates secure temporary access credentials
          </p>
        </div>

        {/* Existing Status Filter preserved */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending Only</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Filter and Search Bar — Automatic controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search Input — Automatic while typing */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search requester name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Role Filter — Automatic on select */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
              <option value="pro_manager">PRO / Manager</option>
              <option value="executive">Executive</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {/* Date Filter — Automatic on select/change */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Requested Date:</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading reset requests..." />
        ) : requests.length === 0 ? (
          <EmptyState
            title="No password reset requests found"
            description={
              searchTerm || roleFilter || statusFilter || dateFilter
                ? "Try adjusting your search or filter criteria."
                : "Users who click 'Forgot Password' on the login portal will appear here for Super Admin approval."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Requester</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Requested At</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Authorization Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{r.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {r.employee_id} • @{r.username}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={r.role}>{r.role}</Badge>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {new Date(r.requested_at).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={r.status}>{r.status}</Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {r.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(r.id, r.full_name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Issue Code</span>
                          </button>
                          <button
                            onClick={() => handleReject(r.id, r.full_name)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">
                          {r.status === 'approved' ? `Approved on ${new Date(r.approved_at).toLocaleDateString()}` : 'Rejected'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Temporary Password Modal */}
      <Modal
        isOpen={!!approvedResult}
        onClose={() => setApprovedResult(null)}
        title="Temporary Access Issued"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Reset Approved Successfully</h3>
            <p className="text-xs text-slate-500 mt-1">
              Provide this temporary password to <strong>{approvedResult?.username}</strong>. They will be prompted to create a new password on their next login.
            </p>
          </div>

          <div className="p-4 bg-slate-900 text-blue-400 rounded-2xl font-mono text-lg font-bold tracking-wider flex items-center justify-between">
            <span>{approvedResult?.temporary_password}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(approvedResult.temporary_password);
                showToast('Temporary password copied to clipboard', 'info');
              }}
              title="Copy password"
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            For security compliance, this password will not be displayed again after this dialog is closed.
          </p>

          <button
            onClick={() => setApprovedResult(null)}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Done & Close
          </button>
        </div>
      </Modal>
    </div>
  );
};
export default PasswordResetsPage;
