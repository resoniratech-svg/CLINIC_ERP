import React, { useEffect, useState, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { doctorsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Stethoscope, ArrowRight, AlertTriangle, ShieldCheck, Loader2, Search, ChevronDown, X, Check } from 'lucide-react';

export const DoctorTransferModal = ({ isOpen, onClose, sourceDoctor, activeDoctors = [], onTransferSuccess }) => {
  const [summary, setSummary] = useState(null);
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isConfirmStep, setIsConfirmStep] = useState(false);

  // Searchable combobox state
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const { showToast } = useToast();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && sourceDoctor) {
      setLoadingSummary(true);
      setIsConfirmStep(false);
      setTargetDoctorId('');
      setDoctorSearchTerm('');
      setIsDropdownOpen(false);
      doctorsApi
        .getDoctorSummary(sourceDoctor.doctor_id)
        .then((res) => {
          if (res.success) setSummary(res.data);
        })
        .catch((err) => {
          showToast(err.message || 'Failed to fetch doctor summary', 'error');
        })
        .finally(() => setLoadingSummary(false));
    } else {
      setSummary(null);
    }
  }, [isOpen, sourceDoctor]);

  // Eligible replacement doctors: must be active and not the resigning doctor
  const eligibleDoctors = activeDoctors.filter(
    (d) => d.doctor_id !== sourceDoctor?.doctor_id && d.status === 'active'
  );

  const filteredDoctors = eligibleDoctors.filter((d) => {
    if (!doctorSearchTerm.trim()) return true;
    const term = doctorSearchTerm.toLowerCase();
    const name = (d.full_name || '').toLowerCase();
    const code = (d.doctor_code || '').toLowerCase();
    const spec = (d.specialization || '').toLowerCase();
    const qual = (d.qualification || '').toLowerCase();
    const empId = (d.employee_id || '').toLowerCase();
    return name.includes(term) || code.includes(term) || spec.includes(term) || qual.includes(term) || empId.includes(term);
  });

  const selectedDoctorObj = eligibleDoctors.find(
    (d) => String(d.doctor_id) === String(targetDoctorId)
  );

  const handleNext = (e) => {
    e.preventDefault();
    if (!targetDoctorId) {
      showToast('Please select a replacement doctor to transfer responsibilities to', 'warning');
      return;
    }
    setIsConfirmStep(true);
  };

  const handleConfirmTransfer = async () => {
    setSubmitting(true);
    try {
      const res = await doctorsApi.transferResponsibilities(sourceDoctor.doctor_id, {
        to_doctor_id: parseInt(targetDoctorId),
      });

      if (res.success) {
        showToast(
          `Doctor ${sourceDoctor.full_name} marked inactive. ${res.data.appointments_moved} appointments & ${res.data.followups_moved} followups transferred successfully. Historical records preserved!`,
          'success',
          6000
        );
        if (onTransferSuccess) onTransferSuccess();
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Transfer failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Doctor Resignation & Reassignment: Dr. ${sourceDoctor?.full_name || ''}`}
      maxWidth="max-w-2xl"
    >
      {loadingSummary ? (
        <LoadingSpinner label="Auditing active doctor responsibilities..." />
      ) : !isConfirmStep ? (
        <form onSubmit={handleNext} className="space-y-5 text-xs text-slate-700">
          {/* Strict Notice banner */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div className="space-y-1 text-red-900 leading-relaxed">
              <div className="font-bold">Doctor Deactivation & Historical Integrity Policy</div>
              <p>
                Resigned doctors are <strong>never deleted</strong> from the ERP. Historical diagnoses, prescriptions, and completed consultations remain permanently linked to Dr. {sourceDoctor?.full_name}. Only upcoming scheduled appointments and pending followups will be reassigned.
              </p>
            </div>
          </div>

          {/* Active Workload Summary Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Current Active Workload for Dr. {sourceDoctor?.full_name}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Future Appointments</span>
                <span className="text-xl font-bold text-slate-900 font-mono">{summary?.upcoming_appointments_count || 0}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Active Patients</span>
                <span className="text-xl font-bold text-slate-900 font-mono">{summary?.active_treatments_count || 0}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pending Followups</span>
                <span className="text-xl font-bold text-slate-900 font-mono">{summary?.pending_followups_count || 0}</span>
              </div>
            </div>
          </div>

          {/* Searchable Replacement Doctor Selector */}
          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="block font-bold text-slate-800 uppercase text-[11px]">
              Select Replacement Active Doctor *
            </label>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                required
                value={
                  isDropdownOpen
                    ? doctorSearchTerm
                    : selectedDoctorObj
                    ? `Dr. ${selectedDoctorObj.full_name} — ${selectedDoctorObj.specialization} (${selectedDoctorObj.doctor_code})`
                    : doctorSearchTerm
                }
                onFocus={() => {
                  setIsDropdownOpen(true);
                  if (selectedDoctorObj) {
                    setDoctorSearchTerm(selectedDoctorObj.full_name);
                  }
                }}
                onChange={(e) => {
                  setDoctorSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                  if (!e.target.value) {
                    setTargetDoctorId('');
                  }
                }}
                placeholder="Search active doctors by name, code, or specialization..."
                className={`w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border ${
                  targetDoctorId ? 'border-blue-500 bg-blue-50/20 font-bold text-slate-900' : 'border-slate-300 bg-white'
                } focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all`}
              />

              {targetDoctorId ? (
                <button
                  type="button"
                  onClick={() => {
                    setTargetDoctorId('');
                    setDoctorSearchTerm('');
                    setIsDropdownOpen(true);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Clear selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Floating Search Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
                {eligibleDoctors.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No active replacement doctors available in clinic.
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No matching active doctors found for "{doctorSearchTerm}"
                  </div>
                ) : (
                  filteredDoctors.map((d) => {
                    const isSelected = String(d.doctor_id) === String(targetDoctorId);
                    return (
                      <div
                        key={d.doctor_id}
                        onClick={() => {
                          setTargetDoctorId(d.doctor_id);
                          setDoctorSearchTerm(`Dr. ${d.full_name}`);
                          setIsDropdownOpen(false);
                        }}
                        className={`p-3 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          isSelected ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>Dr. {d.full_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100/70 font-mono text-blue-700">
                              {d.doctor_code}
                            </span>
                            {d.qualification && (
                              <span className="text-[10px] text-slate-400">
                                • {d.qualification}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span className="font-medium text-slate-700">{d.specialization}</span>
                            {d.experience_years && (
                              <span>({d.experience_years} yrs exp)</span>
                            )}
                            <span className="text-slate-300">|</span>
                            <span className="font-mono text-slate-600">New: ₹{d.new_consultation_fee}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 text-blue-600 font-bold text-xs shrink-0">
                            <Check className="w-4 h-4" />
                            <span>Selected</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <span>Review Transfer Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      ) : (
        /* Confirmation Screen */
        <div className="space-y-5 text-xs text-slate-700">
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Confirm Permanent Resignation & Responsibilities Transfer</span>
            </h4>
            <p className="leading-relaxed">
              Please verify the transfer parameters below. Once confirmed, Dr. {sourceDoctor?.full_name} will be immediately set to <strong>INACTIVE</strong> and barred from logging in or accepting future bookings.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-200/60 font-semibold">
              <span className="text-slate-500">Outgoing Resigned Doctor:</span>
              <span className="text-red-700 font-bold text-sm">Dr. {sourceDoctor?.full_name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200/60 font-semibold">
              <span className="text-slate-500">Incoming Replacement Doctor:</span>
              <span className="text-blue-700 font-bold text-sm">Dr. {selectedDoctorObj?.full_name} ({selectedDoctorObj?.specialization})</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200/60">
              <span className="text-slate-500">Upcoming Appointments Reassigned:</span>
              <span className="font-mono font-bold text-slate-900">{summary?.upcoming_appointments_count || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200/60">
              <span className="text-slate-500">Pending Follow-ups Reassigned:</span>
              <span className="font-mono font-bold text-slate-900">{summary?.pending_followups_count || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-emerald-800 font-medium">
              <span>Past Consultations & Prescriptions:</span>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold">PRESERVED (Read-Only)</span>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-slate-200">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsConfirmStep(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmTransfer}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl shadow-md shadow-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Transfer & Audit Log...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm Resignation & Transfer Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
