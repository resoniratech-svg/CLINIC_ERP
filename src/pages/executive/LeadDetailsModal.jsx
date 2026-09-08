import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EditCallModal } from './EditCallModal';
import { useToast } from '../../context/ToastContext';
import {
  Users2,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  ShieldCheck,
  HeartHandshake,
  Pencil
} from 'lucide-react';

export const LeadDetailsModal = ({ isOpen, onClose, leadId, onEditLead }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [editingCall, setEditingCall] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && leadId) {
      fetchDetails();
    } else {
      setData(null);
    }
  }, [isOpen, leadId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await executiveApi.getLeadDetails(leadId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        showToast('Failed to load lead details', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error fetching lead details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const lead = data?.lead;
  const callHistory = data?.call_history || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Executive Lead Information & Handoff Audit" maxWidth="max-w-2xl">
      {loading ? (
        <div className="py-12">
          <LoadingSpinner label="Retrieving lead details & call records..." />
        </div>
      ) : !lead ? (
        <div className="p-8 text-center text-slate-500 text-xs">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          No lead record found.
        </div>
      ) : (
        <div className="space-y-4 text-xs text-slate-800">
          {/* Top Header Card */}
          <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 rounded-2xl border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <Users2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {lead.lead_name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      lead.status === 'new'
                        ? 'bg-blue-100 text-blue-800'
                        : lead.status === 'interested'
                        ? 'bg-emerald-100 text-emerald-800'
                        : lead.status === 'converted'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {lead.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Lead ID: <strong className="text-blue-700">LEAD-{String(lead.lead_id).padStart(5, '0')}</strong> • #{lead.lead_id}
                </div>
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Handoff Queue</span>
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                Receptionist Queue
              </span>
              {onEditLead && (
                <div className="pt-1">
                  <button
                    onClick={() => onEditLead(lead)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Lead</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            {/* Contact Details */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Contact Information
              </span>
              <div className="text-slate-700">
                <span className="font-semibold">Mobile:</span>{' '}
                <span className="font-mono font-bold text-blue-700">{lead.mobile_number}</span>
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Demographics:</span>{' '}
                {lead.age ? `${lead.age} yrs • ` : ''}<span className="capitalize">{lead.gender || 'male'}</span>
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Location:</span>{' '}
                {lead.village || lead.mandal ? `${lead.village || ''} ${lead.mandal ? `(${lead.mandal})` : ''}` : '—'}
              </div>
            </div>

            {/* Source & Attribution */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Origin & Attribution
              </span>
              <div className="text-slate-700">
                <span className="font-semibold">Channel:</span>{' '}
                <span className="font-bold capitalize">{lead.lead_source || lead.source || 'Inbound'}</span>
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Campaign:</span>{' '}
                <span className="font-mono">{lead.campaign || 'Direct Call'}</span>
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Generated By:</span>{' '}
                <span className="font-bold text-slate-900">{lead.executive_name || 'Executive Staff'}</span> ({lead.executive_employee_id || 'EX001'})
              </div>
              <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                Created: {new Date(lead.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Requirement / Ailment Reason */}
          {(lead.requirement || lead.problem) && (
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
                Requirement / Medical Ailment
              </span>
              <p className="text-xs font-semibold text-amber-950">
                {lead.requirement || lead.problem}
              </p>
            </div>
          )}

          {/* Call History linked with this lead */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Engagement & Call History ({callHistory.length})
            </h4>

            {callHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                No specific call logs attached.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {callHistory.map((call) => (
                  <div key={call.call_id} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 capitalize">
                        {call.interaction_type} Call • {call.call_purpose}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {call.remarks || 'No notes provided'}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {call.call_status}
                        </span>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {new Date(call.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingCall(call)}
                        className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Edit Call Outcome"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            {onEditLead ? (
              <button
                onClick={() => onEditLead(lead)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Lead Information</span>
              </button>
            ) : <div />}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

          {/* Edit Call Outcome Modal */}
          <EditCallModal
            isOpen={Boolean(editingCall)}
            onClose={() => setEditingCall(null)}
            call={editingCall}
            onCallUpdated={() => {
              fetchDetails();
              setEditingCall(null);
            }}
          />
        </div>
      )}
    </Modal>
  );
};
