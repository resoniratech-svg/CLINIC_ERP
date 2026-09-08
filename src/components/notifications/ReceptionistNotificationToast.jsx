import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { receptionistApi } from '../../api';
import {
  UserPlus,
  Edit3,
  PhoneCall,
  Calendar,
  CheckCircle2,
  Info,
  X,
  ArrowRight
} from 'lucide-react';

export function ReceptionistNotificationToast() {
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();

  // Seen item trackers for duplicate prevention
  const seenLeadsRef = useRef(new Set());
  const seenCallsRef = useRef(new Set());
  const leadTimestampsRef = useRef(new Map());
  const callTimestampsRef = useRef(new Map());
  const initialLoadDoneRef = useRef(false);

  const addToast = (toastData) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    const newToast = { id, ...toastData };

    setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Keep max 5 visible

    // Auto dismiss logic
    const duration = toastData.priority === 'high' ? 12000 : 6000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const checkExecutiveUpdates = async () => {
    try {
      // 1. Fetch Executive Leads
      const leadsRes = await receptionistApi.getExecutiveLeads({ limit: 50 });
      const leadsData = leadsRes.success ? (leadsRes.data || []) : [];

      // 2. Fetch Call Records
      const callsRes = await receptionistApi.getCallRecords({ limit: 50 });
      const callsData = callsRes.success ? (callsRes.data || []) : [];

      if (!initialLoadDoneRef.current) {
        // Initial Seed: Record existing IDs & timestamps without notifying
        leadsData.forEach((lead) => {
          const lId = String(lead.lead_id);
          seenLeadsRef.current.add(lId);
          leadTimestampsRef.current.set(lId, lead.updated_at || lead.created_at || '');
        });

        callsData.forEach((call) => {
          const cId = String(call.call_id);
          seenCallsRef.current.add(cId);
          callTimestampsRef.current.set(cId, call.updated_at || call.created_at || '');
        });

        initialLoadDoneRef.current = true;
        return;
      }

      // Subsequent Poll Checks for New / Updated Leads
      leadsData.forEach((lead) => {
        const lId = String(lead.lead_id);
        const lastTime = leadTimestampsRef.current.get(lId);
        const currentTime = lead.updated_at || lead.created_at || '';
        const isNew = !seenLeadsRef.current.has(lId);
        const isUpdated = !isNew && lastTime && currentTime && lastTime !== currentTime;

        if (isNew || isUpdated) {
          seenLeadsRef.current.add(lId);
          leadTimestampsRef.current.set(lId, currentTime);

          const executiveName = lead.executive_name || 'Executive';
          const patientName = lead.lead_name || 'New Patient/Lead';

          if (lead.status === 'callback_requested' || lead.last_call_outcome === 'CALLBACK_REQUESTED') {
            // Type 4: Callback Requested (Amber)
            addToast({
              type: 'callback',
              priority: 'high',
              title: '⏰ CALLBACK REQUESTED',
              message: `${patientName} requested a callback.`,
              details: `Callback Date: ${lead.callback_date || 'Today'} • ${lead.callback_time || 'Scheduled'}`,
              operator: `Created by: ${executiveName}`,
              actionLabel: 'Handle Callback',
              route: '/receptionist/leads',
              bgColor: 'bg-amber-50',
              borderColor: 'border-amber-200',
              textColor: 'text-amber-900',
              badgeBg: 'bg-amber-100 text-amber-800',
              icon: <Calendar className="w-5 h-5 text-amber-600" />
            });
          } else if (lead.status === 'interested') {
            // Type 5: Interested Lead / Action Required (Green)
            addToast({
              type: 'interested',
              priority: 'high',
              title: '✓ ACTION REQUIRED',
              message: `${patientName} is interested in visiting the clinic.`,
              details: `Status: Interested in Consultation`,
              operator: `Updated by: ${executiveName}`,
              actionLabel: 'Open Receptionist Queue',
              route: '/receptionist/leads',
              bgColor: 'bg-emerald-50',
              borderColor: 'border-emerald-200',
              textColor: 'text-emerald-900',
              badgeBg: 'bg-emerald-100 text-emerald-800',
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            });
          } else if (isNew) {
            // Type 1: New Lead (Blue)
            addToast({
              type: 'new_lead',
              priority: 'medium',
              title: '👤 NEW LEAD RECEIVED',
              message: `${patientName} has been added as a new lead.`,
              operator: `Created by: ${executiveName}`,
              actionLabel: 'Open Lead',
              route: '/receptionist/leads',
              bgColor: 'bg-blue-50',
              borderColor: 'border-blue-200',
              textColor: 'text-blue-900',
              badgeBg: 'bg-blue-100 text-blue-800',
              icon: <UserPlus className="w-5 h-5 text-blue-600" />
            });
          } else {
            // Type 2: Lead Updated (Purple)
            addToast({
              type: 'lead_updated',
              priority: 'medium',
              title: '✎ LEAD UPDATED',
              message: `${patientName}'s lead information was updated.`,
              details: `Status: ${lead.status ? lead.status.replace('_', ' ') : 'Updated'}`,
              operator: `Updated by: ${executiveName}`,
              actionLabel: 'Review Lead',
              route: '/receptionist/leads',
              bgColor: 'bg-purple-50',
              borderColor: 'border-purple-200',
              textColor: 'text-purple-900',
              badgeBg: 'bg-purple-100 text-purple-800',
              icon: <Edit3 className="w-5 h-5 text-purple-600" />
            });
          }
        }
      });

      // Subsequent Poll Checks for New / Updated Calls
      callsData.forEach((call) => {
        const cId = String(call.call_id);
        const lastTime = callTimestampsRef.current.get(cId);
        const currentTime = call.updated_at || call.created_at || '';
        const isNew = !seenCallsRef.current.has(cId);
        const isUpdated = !isNew && lastTime && currentTime && lastTime !== currentTime;

        if (isNew || isUpdated) {
          seenCallsRef.current.add(cId);
          callTimestampsRef.current.set(cId, currentTime);

          const patientName = call.patient_name || 'Patient';
          const operatorName = call.handled_by_name || 'Executive';
          const outcome = call.call_status ? call.call_status.replace('_', ' ') : 'Updated';

          if (call.call_status === 'callback_requested') {
            addToast({
              type: 'callback_call',
              priority: 'high',
              title: '⏰ CALLBACK REQUESTED',
              message: `${patientName}'s call requires callback action.`,
              details: `Callback: ${call.callback_date || 'Today'} ${call.callback_time || ''}`,
              operator: `Logged by: ${operatorName}`,
              actionLabel: 'Handle Callback',
              route: '/receptionist/crm',
              bgColor: 'bg-amber-50',
              borderColor: 'border-amber-200',
              textColor: 'text-amber-900',
              badgeBg: 'bg-amber-100 text-amber-800',
              icon: <Calendar className="w-5 h-5 text-amber-600" />
            });
          } else {
            // Type 3: Call Outcome Updated (Orange)
            addToast({
              type: 'call_updated',
              priority: 'medium',
              title: '☎ CALL OUTCOME UPDATED',
              message: `${patientName}'s call outcome was updated.`,
              details: `Outcome: ${outcome}`,
              operator: `Updated by: ${operatorName}`,
              actionLabel: 'Review Call',
              route: '/receptionist/crm',
              bgColor: 'bg-orange-50',
              borderColor: 'border-orange-200',
              textColor: 'text-orange-900',
              badgeBg: 'bg-orange-100 text-orange-800',
              icon: <PhoneCall className="w-5 h-5 text-orange-600" />
            });
          }
        }
      });
    } catch (e) {
      // Fail silently to prevent crashing UI
      console.warn('Realtime update check warning:', e);
    }
  };

  useEffect(() => {
    // Initial fetch on mount
    checkExecutiveUpdates();

    // Poll every 8 seconds for new Executive actions
    const interval = setInterval(() => {
      checkExecutiveUpdates();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border shadow-xl p-4 transition-all duration-300 transform translate-y-0 ${toast.bgColor} ${toast.borderColor} ${toast.textColor}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white shadow-2xs shrink-0 mt-0.5">
                {toast.icon}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs tracking-wide uppercase">
                    {toast.title}
                  </span>
                  {toast.priority === 'high' && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-700">
                      Urgent
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-900">{toast.message}</p>
                {toast.details && (
                  <p className="text-[11px] font-medium text-slate-700">{toast.details}</p>
                )}
                {toast.operator && (
                  <p className="text-[10px] text-slate-500 font-medium">{toast.operator}</p>
                )}

                {/* Action Link Button */}
                {toast.actionLabel && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        removeToast(toast.id);
                        if (toast.route) navigate(toast.route);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-900 shadow-xs border border-slate-200 transition-all cursor-pointer"
                    >
                      <span>{toast.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Manual Dismiss X Button */}
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white/60 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
