import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { doctorsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import {
  UserCheck, RotateCcw, AlertTriangle, ShieldCheck, Loader2,
  Calendar, Users, ArrowRight, Clock, CheckCircle2, AlertCircle, Info, ChevronRight
} from 'lucide-react';

export const DoctorReactivationModal = ({ isOpen, onClose, doctor, onReactivationSuccess }) => {
  const [selectedOption, setSelectedOption] = useState('restore'); // 'restore' (Option A) or 'fresh' (Option B)
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isConfirmStep, setIsConfirmStep] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && doctor) {
      setIsConfirmStep(false);
      setSelectedOption('restore');
      setLoadingPreview(true);
      doctorsApi
        .getDoctorReactivationPreview(doctor.doctor_id)
        .then((res) => {
          if (res.success) {
            setPreview(res.data);
          }
        })
        .catch((err) => {
          showToast(err.message || 'Failed to load reactivation preview', 'error');
        })
        .finally(() => setLoadingPreview(false));
    } else {
      setPreview(null);
    }
  }, [isOpen, doctor]);

  const handleNext = () => {
    setIsConfirmStep(true);
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        option: selectedOption === 'restore' ? 'A' : 'B',
      };
      const res = await doctorsApi.reactivateDoctor(doctor.doctor_id, payload);
      if (res.success) {
        showToast(
          res.message || `Dr. ${doctor.full_name} has been successfully reactivated!`,
          'success',
          6000
        );
        if (onReactivationSuccess) onReactivationSuccess();
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Reactivation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !doctor) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Reactivate Consultant Doctor</h2>
            <p className="text-xs text-slate-500 font-normal">
              Restore Dr. {doctor.full_name} ({doctor.doctor_code || doctor.employee_id}) to active clinical practice
            </p>
          </div>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto px-1">
        {loadingPreview ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner label="Analyzing patient assignment history & transfer logs..." />
          </div>
        ) : (
          <>
            {/* Step 1: Select Option */}
            {!isConfirmStep ? (
              <div className="space-y-5">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Choose Reactivation Strategy</span>
                  </div>
                  <p>
                    Dr. {doctor.full_name} is currently marked as <span className="font-semibold text-slate-900">{doctor.status}</span>. Select whether to restore previously transferred future appointments or start fresh.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option A Card */}
                  <div
                    onClick={() => setSelectedOption('restore')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      selectedOption === 'restore'
                        ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                          <RotateCcw className="w-4 h-4" />
                        </div>
                        <input
                          type="radio"
                          name="reactivationOption"
                          checked={selectedOption === 'restore'}
                          onChange={() => setSelectedOption('restore')}
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">Option A: Reactivate WITH Patient Restore</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        Reactivate doctor and return upcoming appointments and pending followups for patients who have <span className="font-semibold">not yet been consulted</span> by the replacement doctor.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-emerald-100/80 text-[11px] text-emerald-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Patients returning:</span>
                        <span className="font-bold">{preview?.summary?.returning_patients_count ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Appointments to restore:</span>
                        <span className="font-bold">{preview?.summary?.appointments_to_restore_count ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Patients staying with new doctor:</span>
                        <span className="font-bold">{preview?.summary?.staying_patients_count ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Option B Card */}
                  <div
                    onClick={() => setSelectedOption('fresh')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      selectedOption === 'fresh'
                        ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <input
                          type="radio"
                          name="reactivationOption"
                          checked={selectedOption === 'fresh'}
                          onChange={() => setSelectedOption('fresh')}
                          className="mt-1 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">Option B: Reactivate WITHOUT Patient Restore</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        Reactivate doctor profile and user login account with an <span className="font-semibold">empty queue</span>. All previously transferred appointments and follow-ups stay with their current assigned doctors.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-blue-100/80 text-[11px] text-blue-800 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Doctor can take new appointments immediately</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>No disruptions to current patient schedules</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Preview Section for Option A */}
                {selectedOption === 'restore' && preview && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Patient Restoration Breakdown
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Evaluated against {preview.summary?.returning_patients_count + preview.summary?.staying_patients_count} transferred patients
                      </span>
                    </div>

                    {/* Returning Patients List */}
                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                          <RotateCcw className="w-4 h-4 text-emerald-600" />
                          <span>Patients Returning to Dr. {doctor.full_name} ({preview.patients_returning?.length || 0})</span>
                        </div>
                        <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full font-semibold">
                          Will Be Restored
                        </span>
                      </div>

                      {preview.patients_returning?.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {preview.patients_returning.map((p) => (
                            <div key={p.patient_id} className="p-2.5 bg-white rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-900">{p.patient_name}</span>
                                <span className="text-[11px] text-slate-500 ml-2 font-mono">{p.registration_id}</span>
                                <div className="text-[11px] text-emerald-700 mt-0.5">{p.reason}</div>
                              </div>
                              <div className="text-right text-[11px] text-slate-500 font-medium">
                                <div>{p.appointments_to_restore?.length || 0} appt(s)</div>
                                {p.renewals_to_restore?.length > 0 && (
                                  <div>{p.renewals_to_restore.length} renewal(s)</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic py-1">No unconsulted patients eligible to return.</p>
                      )}
                    </div>

                    {/* Staying Patients List */}
                    {preview.patients_staying?.length > 0 && (
                      <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                            <Users className="w-4 h-4 text-amber-600" />
                            <span>Patients Retained by Replacement Doctor ({preview.patients_staying.length})</span>
                          </div>
                          <span className="text-[11px] text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full font-semibold">
                            Clinical Continuity Kept
                          </span>
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {preview.patients_staying.map((p) => (
                            <div key={p.patient_id} className="p-2.5 bg-white rounded-xl border border-amber-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-900">{p.patient_name}</span>
                                <span className="text-[11px] text-slate-500 ml-2 font-mono">{p.registration_id}</span>
                                <div className="text-[11px] text-amber-700 mt-0.5">{p.reason}</div>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded">
                                Already Consulted
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skipped Items notice if any */}
                    {preview.skipped_items?.length > 0 && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-700">Safety Guard: </span>
                          {preview.skipped_items.length} item(s) (including today's in-queue appointments or past-dated uncompleted appointments) will not be moved to prevent schedule disruptions.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-sm"
                  >
                    <span>Proceed to Review</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Confirmation Step */
              <div className="space-y-5">
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <h3 className="font-bold text-emerald-950">Confirm Doctor Reactivation</h3>
                    <p className="text-emerald-800 leading-relaxed">
                      You are about to reactivate <span className="font-bold text-slate-900">Dr. {doctor.full_name}</span> using <span className="font-bold underline">{selectedOption === 'restore' ? 'Option A (With Patient Restore)' : 'Option B (Without Patient Restore)'}</span>.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 text-xs">
                  <h4 className="font-bold text-slate-800">Summary of Scheduled Actions:</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Doctor status will change from <span className="font-semibold text-slate-800">{doctor.status}</span> to <span className="font-semibold text-emerald-700">active</span>.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Doctor user account login will be re-enabled.</span>
                    </li>
                    {selectedOption === 'restore' ? (
                      <>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <span className="font-bold text-emerald-800">{preview?.summary?.appointments_to_restore_count || 0} upcoming appointments</span> and <span className="font-bold text-emerald-800">{preview?.summary?.renewals_to_restore_count || 0} renewals</span> for <span className="font-bold text-emerald-800">{preview?.summary?.returning_patients_count || 0} unconsulted patients</span> will return to Dr. {doctor.full_name}.
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Patients already consulted by the replacement doctor ({preview?.summary?.staying_patients_count || 0}) remain unaffected.</span>
                        </li>
                      </>
                    ) : (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>All previously transferred appointments and patients will remain with their current doctors.</span>
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>An immutable audit trail log will be permanently recorded.</span>
                    </li>
                  </ul>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setIsConfirmStep(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Back to Selection
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Reactivating Doctor...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Confirm Reactivation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
