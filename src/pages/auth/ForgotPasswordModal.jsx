import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { authApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { KeyRound, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [identifier, setIdentifier] = useState('');
  const [reason, setReason] = useState('Password Forgotten');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [workflowResult, setWorkflowResult] = useState(null);

  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      showToast('Please enter your Employee ID, Username, or Mobile', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ identifier: identifier.trim(), reason: reason.trim() });
      if (res?.success) {
        setSubmitted(true);
        const wf = res.data?.workflow || 'authorization_queue';
        setWorkflowResult({
          workflow: wf,
          email: res.data?.recovery_email || 'wecarehomeopathyknr@gmail.com'
        });
        if (wf === 'self_email') {
          showToast('Recovery instructions dispatched to administrator email', 'success');
        } else {
          showToast('Password reset request submitted successfully', 'success');
        }
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err.message || 'Failed to submit reset request', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setWorkflowResult(null);
    setIdentifier('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Hospital Staff Password Reset" maxWidth="max-w-md">
      {!submitted ? (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 leading-relaxed">
            <p className="font-semibold">Authorization Workflow:</p>
            <p className="text-[11px] mt-0.5">
              Reset requests for clinic staff are forwarded to the Super Admin Authorization Queue. Super Admin accounts receive a one-time temporary password via registered administrator email.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Employee ID / Username / Mobile *
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. EMP005 or 9876543210"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
              Reason for Request
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      ) : workflowResult?.workflow === 'self_email' ? (
        <div className="space-y-4 text-center py-4 text-xs text-slate-700">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Recovery Email Dispatched</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              A secure one-time temporary password has been sent to the configured administrator recovery email:
            </p>
            <div className="mt-2.5 p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-mono font-bold text-blue-900 text-xs select-all">
              {workflowResult?.email}
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 leading-normal">
              Please check your Gmail inbox (and spam folder). Copy the temporary password to sign in on the login page and set a new permanent password.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer transition"
          >
            Return to Login
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-center py-4 text-xs text-slate-700">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Request Forwarded</h3>
            <p className="text-xs text-slate-500 mt-1">
              Your reset request has been logged in the Super Admin dashboard. Contact your Super Admin for your temporary access code.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl cursor-pointer"
          >
            Done & Close
          </button>
        </div>
      )}
    </Modal>
  );
};
