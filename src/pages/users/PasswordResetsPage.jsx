import React, { useEffect, useState } from 'react';
import { passwordResetApi } from '../../api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { KeyRound, Check, X, ShieldCheck, Copy } from 'lucide-react';

export const PasswordResetsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [approvedResult, setApprovedResult] = useState(null);

  const { showToast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await passwordResetApi.getRequests(statusFilter ? { status: statusFilter } : {});
      if (res.success) {
        setRequests(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch password reset requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const handleApprove = async (id, userName) => {
    if (!window.confirm(`Approve password reset for ${userName}? A new temporary password will be generated.`)) return;
    try {
      const res = await passwordResetApi.approveRequest(id);
      if (res.success) {
        setApprovedResult(res.data);
        showToast('Password reset request approved', 'success');
        fetchRequests();
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
        fetchRequests();
      }
    } catch (err) {
      showToast(err.message || 'Failed to reject request', 'error');
    }
  };

  return (
    <div className="space-y-6">
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending Only</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading reset requests..." />
        ) : requests.length === 0 ? (
          <EmptyState
            title="No password reset requests"
            description="Users who click 'Forgot Password' on the login portal will appear here for Super Admin approval."
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
