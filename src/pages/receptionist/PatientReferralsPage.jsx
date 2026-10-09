import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { AutocompleteSearch, HighlightMatch } from '../../components/common/AutocompleteSearch';
import { VillageMandalSelect } from '../../components/common/VillageMandalSelect';
import { useToast } from '../../context/ToastContext';
import { HeartHandshake, Plus, Search, CheckCircle2, UserPlus, Users, ChevronDown, X } from 'lucide-react';

export const PatientReferralsPage = () => {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Referring patient search state
  const [selectedReferringPt, setSelectedReferringPt] = useState(null);

  const [formData, setFormData] = useState({
    patient_name: '',
    mobile_number: '',
    age: '',
    gender: 'male',
    village_mandal: '',
    reason: '',
    remarks: '',
  });

  const { showToast } = useToast();

  const fetchPrerequisites = async () => {
    setLoading(true);
    try {
      const refRes = await receptionistApi.getPatientReferrals();
      if (refRes.success) setReferrals(refRes.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load patient referrals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrerequisites();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReferringPt) {
      showToast('Please search and select the existing Referring Patient', 'warning');
      return;
    }
    if (!formData.patient_name.trim() || !formData.mobile_number.trim()) {
      showToast('New patient name and mobile number are required', 'warning');
      return;
    }

    const cleanMobile = formData.mobile_number.trim().replace(/\D/g, '');
    if (!/^[0-9]{10}$/.test(cleanMobile)) {
      showToast('Mobile number must be exactly 10 digits', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await receptionistApi.createPatientReferral({
        patient_name: formData.patient_name.trim(),
        mobile_number: cleanMobile,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        village_mandal: formData.village_mandal.trim() || null,
        reason: formData.reason.trim() || null,
        referring_patient_id: selectedReferringPt.patient_id,
        remarks: formData.remarks.trim() || null,
      });

      if (res.success) {
        showToast('Patient referral recorded! Generated referral ID and routed to Unit Target.', 'success');
        setIsModalOpen(false);
        setSelectedReferringPt(null);
        setSearchPtTerm('');
        setFormData({
          patient_name: '',
          mobile_number: '',
          age: '',
          gender: 'male',
          village_mandal: '',
          reason: '',
          remarks: '',
        });
        fetchPrerequisites();
      }
    } catch (err) {
      showToast(err.message || 'Failed to record referral', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-indigo-600" />
            <span>Patient-to-Patient Referrals</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record patient referrals where existing registered patients recommend friends/family (Contributes to Unit Target).
          </p>
        </div>

        <button
          onClick={() => navigate('/receptionist/patients/register', { state: { leadSource: 'patient_referral' } })}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Patient Referral</span>
        </button>
      </div>

      {/* Referrals Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading patient referrals..." />
        ) : referrals.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            No patient referrals recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Referral Code</th>
                  <th className="py-3.5 px-4">New Patient</th>
                  <th className="py-3.5 px-4">Referred By (Existing Patient)</th>
                  <th className="py-3.5 px-4">Target Category</th>
                  <th className="py-3.5 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {referrals.map((ref) => {
                  const referrerObj = allPatients.find((p) => String(p.patient_id) === String(ref.referring_patient_id));
                  const referrerName =
                    ref.referring_patient_name ||
                    ref.referrer_name ||
                    referrerObj?.full_name ||
                    referrerObj?.patient_name ||
                    'Registered Patient';
                  const referrerId = referrerObj?.registration_id || ref.referrer_reg_id || `ID: #${ref.referring_patient_id}`;

                  return (
                    <tr key={ref.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        {ref.referral_code || `REF-${ref.id}`}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{ref.patient_name || ref.full_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{ref.mobile_number}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{referrerName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {referrerId}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          Unit Target
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {ref.created_at ? new Date(ref.created_at).toLocaleDateString() : 'Today'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Patient Referral Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Patient-to-Patient Referral"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
          {/* Search Existing Referrer */}
          <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-2">
            <label className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
              1. Search Existing Referring Patient *
            </label>
            <AutocompleteSearch
              searchFn={(term) => receptionistApi.searchPatients({ search: term })}
              onSelect={(p) => setSelectedReferringPt(p)}
              selectedItem={selectedReferringPt}
              onClear={() => setSelectedReferringPt(null)}
              placeholder="Search patient by name, mobile, or Reg ID..."
              findButtonColor="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white"
              inputClassName="border-indigo-300 focus:ring-indigo-500 rounded-xl"
              renderItem={(p, { isSelected, query }) => (
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <HighlightMatch text={p.full_name || p.patient_name || 'Patient'} query={query} />
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                        <HighlightMatch text={p.registration_id || `#${p.patient_id}`} query={query} />
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      <HighlightMatch text={p.mobile_number} query={query} /> • {p.village || p.village_mandal || 'Hyderabad'}
                    </div>
                  </div>
                </div>
              )}
            />
          </div>

          {/* New Patient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Patient Name *</label>
              <input
                type="text"
                required
                value={formData.patient_name}
                onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                placeholder="e.g. Vinay Kumar"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData?.getData('text') || '';
                  setFormData({ ...formData, mobile_number: text.replace(/\D/g, '').slice(0, 10) });
                }}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Age</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="32"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <VillageMandalSelect
            label="Village / Mandal"
            value={formData.village_mandal}
            onChange={(e, val) => setFormData({ ...formData, village_mandal: val })}
            onSelect={(selection) => setFormData({ ...formData, village_mandal: selection.displayName })}
            placeholder="e.g. Pothugal, Karimnagar"
          />

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Referral Remarks</label>
            <input
              type="text"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="e.g. Neighbour of referring patient"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Record Referral'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
