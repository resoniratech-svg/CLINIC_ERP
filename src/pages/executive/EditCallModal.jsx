import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { executiveApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import {
  PhoneCall,
  Calendar,
  Clock,
  Save,
  AlertCircle,
  FileText
} from 'lucide-react';

// PostgreSQL call_status_type enum supported values
const CALL_STATUS_OPTIONS = [
  { value: 'interested', label: 'Interested (Lead Generated)' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'connected', label: 'Connected (General Talk)' },
  { value: 'not_connected', label: 'Not Connected / No Answer' },
  { value: 'busy', label: 'Line Busy' },
  { value: 'switched_off', label: 'Switched Off / Unreachable' },
  { value: 'appointment_booked', label: 'Appointment Booked' },
  { value: 'followup_required', label: 'Follow-up Required' },
  { value: 'completed', label: 'Completed / Resolved' },
  { value: 'closed', label: 'Closed' }
];

// PostgreSQL call_purpose_type enum supported values
const CALL_PURPOSE_OPTIONS = [
  { value: 'general_enquiry', label: 'General Enquiry' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'appointment', label: 'Appointment Confirmation' },
  { value: 'callback', label: 'Scheduled Callback' },
  { value: 'renewal', label: 'Registration Renewal' },
  { value: 'due_payment', label: 'Payment Due' },
  { value: 'acq', label: 'ACQ Care Plan' },
  { value: 'ocnr', label: 'OC / NR Retention' },
  { value: 'patient_feedback', label: 'Patient Feedback' },
  { value: 'other', label: 'Other' }
];

// Normalize purpose into valid Postgres enum
const normalizePurpose = (p) => {
  if (!p) return 'general_enquiry';
  const str = p.toString().toLowerCase().trim();
  if (str === 'enquiry' || str === 'general') return 'general_enquiry';
  if (str === 'treatment') return 'acq';
  const found = CALL_PURPOSE_OPTIONS.find((opt) => opt.value === str);
  return found ? found.value : 'general_enquiry';
};

// Normalize status into valid Postgres enum
const normalizeStatus = (s) => {
  if (!s) return 'connected';
  const str = s.toString().toLowerCase().trim().replace('-', '_');
  if (str === 'call_back_requested' || str === 'call_back') return 'callback_requested';
  if (str === 'not_reachable') return 'switched_off';
  if (str === 'wrong_number') return 'not_connected';
  const found = CALL_STATUS_OPTIONS.find((opt) => opt.value === str);
  return found ? found.value : 'connected';
};

export const EditCallModal = ({ isOpen, onClose, call, onCallUpdated }) => {
  const [formData, setFormData] = useState({
    call_status: 'connected',
    call_purpose: 'general_enquiry',
    callback_date: '',
    callback_time: '',
    remarks: ''
  });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (call && isOpen) {
      let rawDate = '';
      if (call.callback_date) {
        if (typeof call.callback_date === 'string' && !call.callback_date.includes('T')) {
          rawDate = call.callback_date;
        } else {
          try {
            const d = new Date(call.callback_date);
            if (!isNaN(d.getTime())) {
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              rawDate = `${yyyy}-${mm}-${dd}`;
            }
          } catch (e) {
            rawDate = '';
          }
        }
      }

      let rawTime = '';
      if (call.callback_time) {
        if (typeof call.callback_time === 'string') {
          rawTime = call.callback_time.slice(0, 5);
        }
      }

      setFormData({
        call_status: normalizeStatus(call.call_status),
        call_purpose: normalizePurpose(call.call_purpose),
        callback_date: rawDate,
        callback_time: rawTime,
        remarks: call.remarks || ''
      });
    }
  }, [call, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (formData.call_status === 'callback_requested') {
      if (!formData.callback_date || !formData.callback_time) {
        showToast('Callback Date and Time are required when Callback is requested', 'warning');
        return;
      }
    }

    setSaving(true);
    try {
      const isCallback = formData.call_status === 'callback_requested';
      const payload = {
        call_status: formData.call_status,
        call_purpose: formData.call_purpose,
        callback_date: isCallback ? (formData.callback_date || null) : null,
        callback_time: isCallback ? (formData.callback_time || null) : null,
        remarks: formData.remarks ? formData.remarks.trim() : null
      };

      const res = await executiveApi.updateCallRecord(call.call_id, payload);
      if (res.success) {
        showToast('Call outcome updated successfully! Associated lead status synchronized.', 'success');
        if (onCallUpdated) onCallUpdated(res.data);
        onClose();
      } else {
        showToast(res.message || 'Failed to update call record', 'error');
      }
    } catch (err) {
      console.error('Update call error:', err);
      showToast(err.message || 'Error updating call outcome', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Call Outcome • #${call?.call_id || ''}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
        <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-900 leading-relaxed">
            Correct mistaken call outcome status (e.g. changing from <strong>Interested</strong> to <strong>Not Interested</strong>). The associated lead status will automatically synchronize with the Receptionist Queue.
          </p>
        </div>

        {/* Call Status */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Call Outcome Status *
          </label>
          <select
            value={formData.call_status}
            onChange={(e) => setFormData({ ...formData, call_status: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {CALL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Callback Date & Time (Conditional) */}
        {formData.call_status === 'callback_requested' && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Callback Date *
              </label>
              <input
                type="date"
                required
                value={formData.callback_date}
                onChange={(e) => setFormData({ ...formData, callback_date: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Callback Time *
              </label>
              <input
                type="time"
                required
                value={formData.callback_time}
                onChange={(e) => setFormData({ ...formData, callback_time: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        )}

        {/* Call Purpose */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Call Purpose
          </label>
          <select
            value={formData.call_purpose}
            onChange={(e) => setFormData({ ...formData, call_purpose: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {CALL_PURPOSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Call Notes / Updated Remarks
          </label>
          <textarea
            rows="3"
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Caller mentioned not interested currently, corrected from interested"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Updating...' : 'Save Call Update'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

