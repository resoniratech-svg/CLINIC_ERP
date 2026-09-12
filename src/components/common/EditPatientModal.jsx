import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { VillageMandalSelect } from './VillageMandalSelect';
import { AilmentSelect } from './AilmentSelect';
import { useToast } from '../../context/ToastContext';
import { receptionistApi } from '../../api';
import { Lock, User, Phone, MapPin, AlertCircle, Save, X, Calendar, Activity } from 'lucide-react';

export const EditPatientModal = ({
  isOpen,
  onClose,
  patient,
  onPatientUpdated,
  apiUpdateFn = null, // Optional custom update function (e.g. doctorApi.updatePatient)
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    full_name: '',
    mobile_number: '',
    age: '',
    gender: 'male',
    village_mandal: '',
    village_id: null,
    mandal_id: null,
    address: '',
    ailment_reason: '',
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (patient && isOpen) {
      const loc = (patient.village && patient.mandal)
        ? `${patient.village}, ${patient.mandal}`
        : (patient.village || patient.mandal || patient.village_mandal || '');

      setFormData({
        full_name: patient.full_name || patient.patient_name || '',
        mobile_number: patient.mobile_number || '',
        age: patient.age ? String(patient.age) : '',
        gender: patient.gender ? patient.gender.toLowerCase() : 'male',
        village_mandal: loc,
        village_id: patient.village_id || null,
        mandal_id: patient.mandal_id || null,
        address: patient.address || '',
        ailment_reason: patient.ailment_reason || patient.chief_complaint || '',
      });
      setErrors({});
    }
  }, [patient, isOpen]);

  if (!isOpen || !patient) return null;

  const validate = () => {
    const errs = {};
    if (!formData.full_name.trim()) {
      errs.full_name = 'Patient full name cannot be empty';
    }

    const cleanMob = formData.mobile_number.replace(/\D/g, '');
    if (!cleanMob || cleanMob.length !== 10) {
      errs.mobile_number = 'Mobile number must be exactly 10 digits';
    }

    if (formData.age !== '') {
      const ageNum = parseInt(formData.age, 10);
      if (isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
        errs.age = 'Age must be between 1 and 120';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const cleanMob = formData.mobile_number.replace(/\D/g, '');
      const payload = {
        full_name: formData.full_name.trim(),
        mobile_number: cleanMob,
        age: formData.age ? parseInt(formData.age, 10) : null,
        gender: formData.gender,
        village_mandal: formData.village_mandal,
        village_id: formData.village_id,
        mandal_id: formData.mandal_id,
        address: formData.address.trim(),
        ailment_reason: formData.ailment_reason.trim()
      };

      const updateCall = apiUpdateFn || receptionistApi.updatePatient;
      const res = await updateCall(patient.patient_id, payload);

      if (res?.success) {
        showToast('Patient details updated successfully!', 'success');
        if (onPatientUpdated) {
          onPatientUpdated(res.data);
        }
        onClose();
      } else {
        showToast(res?.message || 'Failed to update patient details', 'error');
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Error updating patient details';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const regId = patient.registration_id || `REG-${String(patient.patient_id).padStart(5, '0')}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Patient Details"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Immutable Identity Badges */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200/80 rounded-xl text-slate-600">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-800">Protected Patient Identifiers</div>
              <div className="text-[10px] text-slate-500">
                System identity codes remain strictly immutable for financial and clinical audit integrity.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-blue-700 shadow-2xs">
              {regId}
            </div>
            <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 shadow-2xs">
              ID #{patient.patient_id}
            </div>
          </div>
        </div>

        {/* Demographics Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Patient Full Name"
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-white focus:ring-2 focus:outline-none ${
                  errors.full_name ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
            </div>
            {errors.full_name && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.full_name}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Mobile Number (10 Digits) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="tel"
                maxLength={10}
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value.replace(/\D/g, '') })}
                placeholder="10-digit mobile number"
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-white focus:ring-2 focus:outline-none font-mono font-medium ${
                  errors.mobile_number ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
            </div>
            {errors.mobile_number && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.mobile_number}</span>}
          </div>
        </div>

        {/* Demographics Row 2: Age, Gender, Village/Mandal */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Age (Years)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              placeholder="e.g. 35"
              className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:ring-2 focus:outline-none ${
                errors.age ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
              }`}
            />
            {errors.age && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.age}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Gender <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <VillageMandalSelect
              value={formData.village_mandal}
              villageId={formData.village_id}
              mandalId={formData.mandal_id}
              label="Village / Mandal"
              placeholder="Search Village, Mandal..."
              onSelect={(sel) => {
                setFormData({
                  ...formData,
                  village_mandal: sel.displayName,
                  village_id: sel.villageId || null,
                  mandal_id: sel.mandalId || null
                });
              }}
              onChange={(txt) => setFormData({ ...formData, village_mandal: typeof txt === 'string' ? txt : (txt?.target?.value ?? '') })}
            />
          </div>
        </div>

        {/* Address & Ailment Reason */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Address / Landmark
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="House no, Street, Landmark..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <AilmentSelect
              label="Chief Complaint / Ailment"
              value={formData.ailment_reason}
              onChange={(e) => setFormData({ ...formData, ailment_reason: typeof e === 'string' ? e : (e?.target?.value ?? '') })}
              placeholder="e.g. Migraine, Joint Pain, Chronic Skin Allergy..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Changes...' : 'Save Patient Details'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
