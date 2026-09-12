import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useToast } from '../../context/ToastContext';
import { receptionistApi, doctorApi } from '../../api';
import {
  RefreshCw,
  User,
  Stethoscope,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  DollarSign
} from 'lucide-react';

export const ReassignDoctorModal = ({
  isOpen,
  onClose,
  appointment,
  onReassigned,
  role = 'receptionist', // 'receptionist' | 'doctor'
  apiReassignFn = null,
  apiGetDoctorsFn = null,
  apiGetSlotsFn = null
}) => {
  const { showToast } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');

  const [slotsData, setSlotsData] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Resolve APIs based on role or passed props
  const fetchDoctorsCall = apiGetDoctorsFn || (role === 'doctor' ? doctorApi.getActiveDoctors : receptionistApi.getActiveDoctors);
  const fetchSlotsCall = apiGetSlotsFn || (role === 'doctor' ? doctorApi.getDoctorSlots : receptionistApi.getDoctorSlots);
  const reassignCall = apiReassignFn || (role === 'doctor' ? doctorApi.reassignDoctor : receptionistApi.reassignDoctor);

  // Initialize form when appointment changes
  useEffect(() => {
    if (isOpen && appointment) {
      setSelectedDoctorId('');
      // Default to TODAY — not the old appointment date (which could be a past date or non-working day)
      setSelectedDate(todayStr);
      setSelectedTime('');
      setReason('');
      setSlotsData(null);

      // Fetch active doctors
      setLoadingDoctors(true);
      fetchDoctorsCall()
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            setDoctors(res.data);
          }
        })
        .catch(() => {
          showToast('Failed to load active doctors list', 'error');
        })
        .finally(() => setLoadingDoctors(false));
    }
  }, [isOpen, appointment]);

  // Fetch slots whenever doctor and date are chosen
  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      setLoadingSlots(true);
      setSelectedTime('');
      fetchSlotsCall(selectedDoctorId, {
        date: selectedDate,
        exclude_appointment_id: appointment?.appointment_id
      })
        .then((res) => {
          if (res?.success && res.data) {
            setSlotsData(res.data);
          } else {
            setSlotsData(null);
          }
        })
        .catch((err) => {
          setSlotsData(null);
          showToast(err?.response?.data?.message || 'Failed to fetch doctor schedule slots', 'error');
        })
        .finally(() => setLoadingSlots(false));
    } else {
      setSlotsData(null);
    }
  }, [selectedDoctorId, selectedDate]);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      showToast('Please select a doctor to reassign to', 'error');
      return;
    }
    if (!selectedDate || !selectedTime) {
      showToast('Please choose an available appointment date and time slot', 'error');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      showToast('A valid reason (minimum 3 characters) is required for doctor reassignment', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doctor_id: parseInt(selectedDoctorId, 10),
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        reason: reason.trim()
      };

      const res = await reassignCall(appointment.appointment_id, payload);
      if (res?.success) {
        showToast(res.message || 'Doctor reassigned and appointment rescheduled successfully!', 'success');
        if (onReassigned) onReassigned(res.data);
        onClose();
      } else {
        showToast(res?.message || 'Failed to reassign doctor', 'error');
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Error reassigning doctor';
      showToast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const currentDocName = appointment.doctor_name
    ? (appointment.doctor_name.startsWith('Dr.') ? appointment.doctor_name : `Dr. ${appointment.doctor_name}`)
    : 'Assigned Doctor';

  const selectedDocObj = doctors.find((d) => String(d.doctor_id) === String(selectedDoctorId));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reassign Doctor & Reschedule Appointment"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Current State Summary Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{appointment.patient_name}</span>
                <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 font-bold">
                  {appointment.registration_id || `#${appointment.patient_id}`}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Mobile: {appointment.mobile_number || '—'}</span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Current Appointment</span>
              <span className="font-semibold text-slate-800">
                {String(appointment.appointment_date).slice(0, 10)} at {appointment.appointment_time?.slice(0, 5)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
              <span>Current Doctor: <strong className="text-slate-900">{currentDocName}</strong></span>
            </div>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 capitalize">
              {appointment.status?.replace(/_/g, ' ') || 'scheduled'}
            </span>
          </div>
        </div>

        {/* Financial Attribution Notice */}
        <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5">
          <DollarSign className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-[11px] text-emerald-900 leading-relaxed">
            <strong className="block font-bold">Automatic Revenue & Target Attribution Transfer</strong>
            When reassigned, the consultation fee billing attribution transfers immediately to the newly chosen doctor. Exactly 1 payment record is preserved, and the patient is <strong className="underline">not charged again</strong>. Total clinic revenue remains identical.
          </div>
        </div>

        {/* Step 1: Select New Doctor */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            New Assigned Doctor <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            disabled={loadingDoctors}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
          >
            <option value="">-- Choose New Doctor --</option>
            {doctors.map((d) => (
              <option key={d.doctor_id} value={d.doctor_id}>
                Dr. {d.doctor_name} ({d.specialization || 'General Physician'}) • Fee: ₹{d.new_consultation_fee || 500}
                {String(d.doctor_id) === String(appointment.doctor_id) ? ' (Currently Assigned)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Date Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              New Appointment Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
            </div>
            {selectedDate && (() => {
              const [y, m, d] = selectedDate.split('-').map(Number);
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const dayName = dayNames[new Date(y, m - 1, d).getDay()];
              const isWeekend = dayName === 'Sunday' || dayName === 'Saturday';
              return (
                <span className={`text-[10px] font-bold mt-0.5 block ${isWeekend ? 'text-amber-600' : 'text-slate-400'}`}>
                  {isWeekend ? '⚠ ' : ''}{dayName}{isWeekend ? ' — verify doctor works this day' : ''}
                </span>
              );
            })()}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Selected Time Slot <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                readOnly
                placeholder="Click an available slot below"
                value={selectedTime ? selectedTime.slice(0, 5) : ''}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:outline-none font-mono font-bold text-blue-700 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Available Slots Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700">Doctor Consultation Slots</span>
            {selectedDocObj && (
              <span className="text-slate-500 text-[10px]">
                Hours: {selectedDocObj.start_time?.slice(0, 5) || '09:00'} - {selectedDocObj.end_time?.slice(0, 5) || '17:00'}
              </span>
            )}
          </div>

          {loadingSlots ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-600" />
              <span>Checking doctor schedule and approved leaves...</span>
            </div>
          ) : !selectedDoctorId ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400">
              Select a doctor and date to view real-time available consultation slots.
            </div>
          ) : slotsData?.on_leave || slotsData?.is_on_leave ? (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Doctor is on Approved Leave</strong>
                <span>Reason: {slotsData.leave_reason || 'Personal / Medical Leave'}. Please choose a different date or doctor.</span>
              </div>
            </div>
          ) : slotsData && slotsData.is_working_day === false ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Doctor Does Not Work on This Day</strong>
                {selectedDate && (() => {
                  const [y, m, d] = selectedDate.split('-').map(Number);
                  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const dayName = dayNames[new Date(y, m - 1, d).getDay()];
                  return <span>The selected doctor is off on <strong>{dayName}s</strong>. Please pick a different date when the doctor is available.</span>;
                })()}
              </div>
            </div>
          ) : slotsData?.slots?.length > 0 ? (
            <div className="max-h-40 overflow-y-auto p-2 bg-slate-50/70 border border-slate-200 rounded-xl grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
              {slotsData.slots.map((s) => {
                const isSelected = selectedTime === s.time || selectedTime === s.display_time;
                const isAvail = s.is_available;

                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={!isAvail}
                    onClick={() => setSelectedTime(s.time)}
                    className={`py-1.5 px-2 rounded-lg text-center font-mono text-[11px] font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs scale-102 ring-2 ring-blue-400'
                        : isAvail
                        ? 'bg-white hover:bg-blue-50 text-slate-800 border border-slate-200 cursor-pointer'
                        : 'bg-slate-200/70 text-slate-400 border border-slate-200 cursor-not-allowed line-through'
                    }`}
                    title={!isAvail ? s.reason || 'Booked' : 'Available'}
                  >
                    {s.display_time || s.time?.slice(0, 5)}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-center">
              No slots available for this doctor on the chosen date.
            </div>
          )}
        </div>

        {/* Step 4: Reassignment Reason (Mandatory) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Reason for Doctor Reassignment <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Patient requested female doctor, previous doctor on emergency call, language preference..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          />
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Minimum 3 characters required. Permanently recorded in the compliance audit trail.
          </span>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting || !selectedDoctorId || !selectedTime || reason.trim().length < 3}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
            <span>{submitting ? 'Transferring Attribution...' : 'Confirm Reassignment'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
