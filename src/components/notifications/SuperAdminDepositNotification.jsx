import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cashApi } from '../../api';
import {
  Building,
  ArrowRight,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  DollarSign
} from 'lucide-react';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

export function SuperAdminDepositNotification() {
  const [pendingData, setPendingData] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedUntilCountChanges, setDismissedUntilCountChanges] = useState(null);
  const navigate = useNavigate();
  const pollTimerRef = useRef(null);
  const autoDismissTimerRef = useRef(null);

  const fetchPendingRequests = async () => {
    try {
      const res = await cashApi.getPendingDepositRequestsCount();
      if (res && res.success && res.data) {
        const { count, pending_requests } = res.data;
        setPendingData(res.data);

        if (count > 0) {
          // If user dismissed this exact batch, do not auto-reopen immediately unless count changed
          if (dismissedUntilCountChanges !== count) {
            setIsOpen(true);

            // Minimum 3 seconds rule: stay visible for 8 seconds before auto-dismiss
            if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
            autoDismissTimerRef.current = setTimeout(() => {
              setIsOpen(false);
            }, 8000);
          }
        } else {
          setIsOpen(false);
        }
      }
    } catch (err) {
      // Quiet fail on network hiccups
    }
  };

  useEffect(() => {
    // 1. Fetch immediately upon mount (Super Admin login / session load)
    fetchPendingRequests();

    // 2. Poll periodically every 20 seconds for continuous in-session awareness
    pollTimerRef.current = setInterval(fetchPendingRequests, 20000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    };
  }, []);

  const handleDismiss = (e) => {
    e?.stopPropagation();
    setIsOpen(false);
    if (pendingData?.count) {
      setDismissedUntilCountChanges(pendingData.count);
    }
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
  };

  const handleReview = () => {
    setIsOpen(false);
    navigate('/billing/cash?tab=requests');
  };

  if (!isOpen || !pendingData || pendingData.count === 0) {
    return null;
  }

  const count = pendingData.count;
  const latest = pendingData.pending_requests && pendingData.pending_requests[0];

  return (
    <div
      className="fixed top-20 right-6 z-50 max-w-md w-full animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
      role="alert"
    >
      <div className="bg-white border-2 border-amber-400 rounded-2xl shadow-2xl p-4.5 overflow-hidden relative">
        {/* Amber accent line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-700">
              <Building className="w-5 h-5" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-500 text-white">
                  ACTION REQUIRED
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {count > 1 ? `${count} Pending Requests` : `Request #DR-${String(latest?.id).padStart(6, '0')}`}
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 leading-snug">
                PRO Deposit Approval Required
              </h4>

              {latest && (
                <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span>PRO:</span>
                    <span className="text-blue-700">{latest.requester_name || 'PRO Manager'}</span>
                    {latest.requester_employee_id && (
                      <span className="text-[10px] text-slate-400 font-mono">({latest.requester_employee_id})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Branch:</span>
                    <span className="font-semibold text-slate-700">{latest.branch_name || 'Main Branch'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-slate-500">Amount:</span>
                    <span className="font-black font-mono text-emerald-700 text-sm">
                      {formatCurrency(latest.requested_amount)}
                    </span>
                  </div>
                </div>
              )}

              {count > 1 && (
                <p className="text-[11px] text-amber-800 font-semibold pt-1">
                  +{count - 1} other PRO deposit request{count - 1 > 1 ? 's' : ''} awaiting your review.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Visible for review</span>
          </span>

          <button
            onClick={handleReview}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <span>Review Deposit{count > 1 ? 's' : ''}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
