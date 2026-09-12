import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  User,
  Calendar,
  Clock,
  RotateCcw,
  DollarSign,
  PhoneCall,
  UserCheck,
  FileText,
  AlertCircle,
  Stethoscope,
  Building,
  CheckCircle2,
  XCircle,
  History,
  Edit2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EditPatientModal } from '../../components/common/EditPatientModal';
import { ReassignDoctorModal } from '../../components/common/ReassignDoctorModal';

export const PatientOverviewModal = ({ isOpen, onClose, patientId, onActionTriggered }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [reassignAppt, setReassignAppt] = useState(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && patientId) {
      fetchOverview();
    } else {
      setData(null);
    }
  }, [isOpen, patientId]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getPatientOverview(patientId);
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch patient overview', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async (appointmentId) => {
    try {
      const res = await receptionistApi.checkinAppointment(appointmentId);
      if (res.success) {
        showToast('Patient successfully checked-in! Added to doctor waiting queue.', 'success');
        fetchOverview();
        if (onActionTriggered) onActionTriggered();
      }
    } catch (err) {
      showToast(err.message || 'Check-in failed', 'error');
    }
  };

  if (!isOpen) return null;

  const profile = data?.patient || data?.profile || {};
  const patientName = profile.full_name || profile.patient_name || 'Patient';
  const regExpiry = profile.registration_expiry || profile.expiry_date;
  const todayStr = new Date().toISOString().split('T')[0];
  const isExpired = profile.registration_status === 'expired' || 
    (regExpiry ? String(regExpiry).slice(0, 10) < todayStr : false);

  const formatDocName = (name) => {
    if (!name || name === 'Unassigned') return 'Unassigned';
    const trimmed = String(name).trim();
    if (trimmed === 'General OPD') return 'General OPD';
    return trimmed.startsWith('Dr.') ? trimmed : `Dr. ${trimmed}`;
  };

  const visits = data?.previous_visits || data?.recent_visits || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Patient Medical & Operational Overview: ${patientName}`}
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="py-12">
          <LoadingSpinner label="Compiling 360° patient records..." />
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          Patient record not found.
        </div>
      ) : (
        <div className="space-y-6 text-xs text-slate-700">
          {/* Header ID Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-md shadow-blue-500/20">
                {patientName?.charAt(0) || 'P'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">{patientName}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isExpired ? 'EXPIRED' : 'ACTIVE'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Reg ID: <span className="font-bold text-blue-700">{profile.registration_id || `REG-${String(profile.patient_id).padStart(5, '0')}`}</span> • ID: #{profile.patient_id}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsEditingPatient(true)}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigate('/receptionist/appointments', { state: { patient: profile } });
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                + Book Appointment
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigate('/receptionist/renewals', { state: { patient: profile } });
                }}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                🔄 Renew
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigate('/receptionist/crm', { state: { patient: profile } });
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                📞 Log Call
              </button>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white rounded-2xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Mobile Number</span>
              <span className="font-mono font-bold text-slate-800">{profile.mobile_number}</span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Demographics</span>
              <span className="font-medium text-slate-800">
                {profile.age ? `${profile.age} yrs` : '—'} • {profile.gender || '—'}
              </span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Village / Mandal</span>
              <span className="font-medium text-slate-800">{profile.village || profile.village_mandal || 'Hyderabad'}</span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Outstanding Due</span>
              <span className={`font-mono font-bold ${data?.due_amount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                ₹{data?.due_amount || 0}
              </span>
            </div>
          </div>

          {/* Clinical & Appointment Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upcoming Appointment */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Upcoming Appointment</span>
              </span>

              {data?.upcoming_appointment ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {formatDocName(data.upcoming_appointment.doctor_name)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {String(data.upcoming_appointment.appointment_date).slice(0, 10)} at {data.upcoming_appointment.appointment_time?.slice(0, 5)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 capitalize">
                      {data.upcoming_appointment.status}
                    </span>
                  </div>

                  {data.upcoming_appointment.status === 'scheduled' && (
                    <button
                      onClick={() => handleCheckin(data.upcoming_appointment.appointment_id)}
                      className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Check-in Patient Now (Waiting Queue)</span>
                    </button>
                  )}

                  {['scheduled', 'waiting', 'confirmed', 'checked_in', 'pending'].includes(data.upcoming_appointment.status?.toLowerCase()) && (
                    <button
                      onClick={() => setReassignAppt(data.upcoming_appointment)}
                      className="w-full mt-1.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Reassign / Reschedule Doctor</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-slate-400 text-xs py-3">No upcoming appointment scheduled.</div>
              )}
            </div>

            {/* Doctor Assignment & Validity */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                <span>Primary Doctor & Validity</span>
              </span>
              <div className="pt-1 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Primary Doctor:</span>
                  <span className="font-bold text-slate-900">{formatDocName(profile.current_doctor_name)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registration Date:</span>
                  <span className="font-mono text-slate-800">{profile.registration_date ? profile.registration_date.slice(0, 10) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Validity Expiry:</span>
                  <span className="font-mono font-bold text-slate-800">{profile.expiry_date ? profile.expiry_date.slice(0, 10) : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Past Consultations & Visits (View-only) */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Past Clinical Visits & Prescriptions (Protected View)</span>
            </h4>

            {visits.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs">
                No past visit records found for this patient.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {visits.map((v, i) => (
                  <div key={i} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{formatDocName(v.doctor_name)}</span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        {v.appointment_date || v.visit_date} • {v.appointment_type ? `${v.appointment_type} consultation` : (v.visit_type || 'Consultation')}
                      </span>
                    </div>
                    <span className="text-slate-600 italic text-[11px]">
                      {v.specialization ? `${v.specialization} OPD` : (v.status ? `Status: ${v.status}` : 'Completed')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Patient Demographic Details Modal */}
      <EditPatientModal
        isOpen={isEditingPatient}
        onClose={() => setIsEditingPatient(false)}
        patient={profile}
        onPatientUpdated={() => {
          setIsEditingPatient(false);
          fetchOverview();
          if (onActionTriggered) onActionTriggered();
        }}
      />

      {/* Reassign / Reschedule Doctor Modal */}
      {reassignAppt && (
        <ReassignDoctorModal
          isOpen={!!reassignAppt}
          onClose={() => setReassignAppt(null)}
          appointment={reassignAppt}
          onReassigned={() => {
            setReassignAppt(null);
            fetchOverview();
            if (onActionTriggered) onActionTriggered();
          }}
        />
      )}
    </Modal>
  );
};
