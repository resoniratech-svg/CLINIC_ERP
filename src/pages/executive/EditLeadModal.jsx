import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { AilmentSelect } from '../../components/common/AilmentSelect';
import { executiveApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import {
  Users2,
  Phone,
  MapPin,
  FileText,
  Save,
  Tag,
  AlertCircle
} from 'lucide-react';

export const EditLeadModal = ({ isOpen, onClose, lead, onLeadUpdated, isOutbound = false }) => {
  const [formData, setFormData] = useState({
    lead_name: '',
    mobile_number: '',
    age: '',
    gender: 'male',
    village: '',
    mandal: '',
    requirement: '',
    campaign: '',
    status: 'new',
    remarks: ''
  });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (lead && isOpen) {
      setFormData({
        lead_name: lead.lead_name || lead.patient_name || lead.name || '',
        mobile_number: lead.mobile_number || '',
        age: lead.age !== null && lead.age !== undefined ? String(lead.age) : '',
        gender: lead.gender ? lead.gender.toLowerCase() : 'male',
        village: lead.village || '',
        mandal: lead.mandal || '',
        requirement: lead.requirement || lead.problem || '',
        campaign: lead.campaign || '',
        status: lead.status || 'new',
        remarks: lead.remarks || ''
      });
    }
  }, [lead, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lead_name.trim() || !formData.mobile_number.trim()) {
      showToast('Patient Name and Mobile Number are required', 'warning');
      return;
    }

    const cleanMobile = formData.mobile_number.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      showToast('Please enter a valid 10-digit mobile number', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (isOutbound) {
        const payload = {
          patient_name: formData.lead_name.trim(),
          mobile_number: cleanMobile,
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender,
          village: formData.village.trim() || null,
          mandal: formData.mandal.trim() || null,
          problem: formData.requirement.trim() || null,
          campaign: formData.campaign.trim() || null,
          status: formData.status,
          remarks: formData.remarks.trim() || null
        };
        const res = await executiveApi.updateOutboundLead(lead.id, payload);
        if (res.success) {
          showToast('Outbound lead details updated successfully!', 'success');
          if (onLeadUpdated) onLeadUpdated(res.data);
          onClose();
        } else {
          showToast('Failed to update outbound lead', 'error');
        }
      } else {
        const payload = {
          lead_name: formData.lead_name.trim(),
          mobile_number: cleanMobile,
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender,
          village: formData.village.trim() || null,
          campaign: formData.campaign.trim() || null,
          requirement: formData.requirement.trim() || null,
          source: lead.source || 'Inbound Call',
          status: formData.status,
          remarks: formData.remarks.trim() || null
        };
        const res = await executiveApi.updateLead(lead.lead_id, payload);
        if (res.success) {
          showToast('Lead details updated successfully! Changes synced with Receptionist Queue.', 'success');
          if (onLeadUpdated) onLeadUpdated(res.data);
          onClose();
        } else {
          showToast('Failed to update lead record', 'error');
        }
      }
    } catch (err) {
      showToast(err.message || 'Error saving lead corrections', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isOutbound ? `Edit Outbound Contact #${lead?.id || ''}` : `Edit Lead LEAD-${String(lead?.lead_id || '').padStart(5, '0')}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
        <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-900 leading-relaxed">
            Update corrections for caller name, phone number, location, and health complaints. Changes sync immediately to the <strong>Receptionist Verification Queue</strong>.
          </p>
        </div>

        {/* Name & Mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Patient / Lead Name *
            </label>
            <input
              type="text"
              required
              value={formData.lead_name}
              onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Ramesh Kumar"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mobile Number (10 Digits) *
            </label>
            <input
              type="tel"
              required
              value={formData.mobile_number}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 9876543210"
            />
          </div>
        </div>

        {/* Age, Gender & Status */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Age (Years)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 35"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Gender
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Lead Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="new">New / Pending</option>
              <option value="interested">Interested</option>
              <option value="not_interested">Not Interested</option>
            </select>
          </div>
        </div>

        {/* Location: Village & Mandal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Village / Locality
            </label>
            <input
              type="text"
              value={formData.village}
              onChange={(e) => setFormData({ ...formData, village: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Gandhi Nagar"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mandal / Sub-District
            </label>
            <input
              type="text"
              value={formData.mandal}
              onChange={(e) => setFormData({ ...formData, mandal: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Karimnagar"
            />
          </div>
        </div>

        {/* Problem / Requirement & Campaign */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AilmentSelect
            label="Health Complaint / Problem"
            labelClassName="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1"
            value={formData.requirement}
            onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
            placeholder="e.g. Skin Allergy / Joint Pain"
            inputClassName="bg-slate-50 border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Campaign / Referral Tag
            </label>
            <input
              type="text"
              value={formData.campaign}
              onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Outbound Campaign / Direct Call"
            />
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Internal Notes / Correction Remarks
          </label>
          <textarea
            rows="2"
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Corrected misspelled patient name and mobile number"
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
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
