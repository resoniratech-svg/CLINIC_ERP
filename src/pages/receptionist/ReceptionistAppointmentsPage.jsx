import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Calendar,
  Clock,
  User,
  Plus,
  Search,
  Filter,
  UserCheck,
  RotateCcw,
  XCircle,
  Building,
  CheckCircle2,
  CalendarCheck2,
  ChevronDown,
  X,
  Eye,
  Stethoscope,
  ArrowRight
} from 'lucide-react';

export const ReceptionistAppointmentsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // View Details Modal
  const [viewTarget, setViewTarget] = useState(null);

  // Reschedule Modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleData, setRescheduleData] = useState({
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00:00',
  });
  const [rescheduling, setRescheduling] = useState(false);

  // Cancel Modal
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // New Appointment Modal for quick booking
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [bookingPatient, setBookingPatient] = useState(location.state?.patient || null);
  const [searchPtTerm, setSearchPtTerm] = useState('');
  const [isPtDropdownOpen, setIsPtDropdownOpen] = useState(false);
  const ptDropdownRef = useRef(null);

  // Doctor search state in booking modal
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false);
  const docDropdownRef = useRef(null);

  const [newBookingData, setNewBookingData] = useState({
    doctor_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00:00',
    appointment_type: 'followup',
    remarks: '',
  });
  const [creatingBooking, setCreatingBooking] = useState(false);

  const formatDocName = (name) => {
    if (!name) return 'Doctor';
    return name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ptDropdownRef.current && !ptDropdownRef.current.contains(event.target)) {
        setIsPtDropdownOpen(false);
      }
      if (docDropdownRef.current && !docDropdownRef.current.contains(event.target)) {
        setIsDocDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (selectedDoctorId) params.doctor_id = selectedDoctorId;
      if (selectedStatus) params.status = selectedStatus;

      const [apptRes, docRes, ptRes] = await Promise.all([
        receptionistApi.getAppointments(params),
        receptionistApi.getActiveDoctors(),
        receptionistApi.searchPatients({ search: '%' }).catch(() => ({ data: [] })),
      ]);

      if (apptRes.success) setAppointments(apptRes.data || []);
      if (docRes.success && docRes.data) {
        setDoctors(docRes.data);
        if (!newBookingData.doctor_id && docRes.data.length > 0) {
          setNewBookingData((prev) => ({ ...prev, doctor_id: docRes.data[0].doctor_id }));
        }
      }
      if (ptRes.success) {
        const list = ptRes.data?.patients || (Array.isArray(ptRes.data) ? ptRes.data : []);
        setAllPatients(list);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch appointments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = allPatients.filter((p) => {
    if (!searchPtTerm.trim()) return true;
    const q = searchPtTerm.toLowerCase();
    const name = (p.full_name || p.patient_name || '').toLowerCase();
    const mobile = (p.mobile_number || '').toLowerCase();
    const regId = (p.registration_id || '').toLowerCase();
    const id = String(p.patient_id || '');
    return name.includes(q) || mobile.includes(q) || regId.includes(q) || id.includes(q);
  });

  const filteredDoctors = doctors.filter((doc) => {
    if (!docSearchTerm.trim()) return true;
    const q = docSearchTerm.toLowerCase();
    const name = (doc.doctor_name || doc.full_name || '').toLowerCase();
    const spec = (doc.specialization || '').toLowerCase();
    const qual = (doc.qualification || '').toLowerCase();
    return name.includes(q) || spec.includes(q) || qual.includes(q);
  });

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, selectedDoctorId, selectedStatus]);

  const handleCheckin = async (appointmentId) => {
    try {
      const res = await receptionistApi.checkinAppointment(appointmentId);
      if (res.success) {
        showToast('Patient checked-in successfully! Routed to doctor waiting queue.', 'success');
        fetchAppointments();
      }
    } catch (err) {
      showToast(err.message || 'Check-in failed', 'error');
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleTarget) return;

    setRescheduling(true);
    try {
      const res = await receptionistApi.rescheduleAppointment(rescheduleTarget.appointment_id, {
        appointment_date: rescheduleData.appointment_date,
        appointment_time: rescheduleData.appointment_time,
      });

      if (res.success) {
        showToast('Appointment rescheduled successfully!', 'success');
        setRescheduleTarget(null);
        fetchAppointments();
      }
    } catch (err) {
      showToast(err.message || 'Rescheduling failed', 'error');
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelTarget) return;

    setCancelling(true);
    try {
      const res = await receptionistApi.cancelAppointment(cancelTarget.appointment_id);

      if (res.success) {
        showToast('Appointment cancelled successfully', 'info');
        setCancelTarget(null);
        fetchAppointments();
      }
    } catch (err) {
      showToast(err.message || 'Cancellation failed', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!bookingPatient) {
      showToast('Please search and select a patient first', 'warning');
      return;
    }

    setCreatingBooking(true);
    try {
      const res = await receptionistApi.createAppointment({
        patient_id: bookingPatient.patient_id,
        doctor_id: parseInt(newBookingData.doctor_id),
        appointment_date: newBookingData.appointment_date,
        appointment_time: newBookingData.appointment_time,
        appointment_type: newBookingData.appointment_type,
        remarks: newBookingData.remarks || null,
      });

      if (res.success) {
        showToast('New appointment booked successfully!', 'success');
        setIsNewBookingOpen(false);
        setBookingPatient(null);
        fetchAppointments();
      }
    } catch (err) {
      showToast(err.message || 'Booking failed', 'error');
    } finally {
      setCreatingBooking(false);
    }
  };

  const searchPatientForBooking = async () => {
    if (!searchPtTerm.trim()) return;
    try {
      const res = await receptionistApi.searchPatients({ search: searchPtTerm.trim() });
      if (res.success && res.data?.patients?.length > 0) {
        setBookingPatient(res.data.patients[0]);
      } else {
        showToast('Patient not found', 'warning');
      }
    } catch (e) {
      showToast('Search failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>Doctor Appointments & OPD Scheduling</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Surveillance of patient consultations, doctor slot availability, check-ins, and rescheduling.
          </p>
        </div>

        <button
          onClick={() => setIsNewBookingOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Book Appointment</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Quick Today Button */}
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Today
          </button>

          {/* Doctor Filter */}
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.doctor_id} value={d.doctor_id}>
                {formatDocName(d.doctor_name || d.full_name)} ({d.specialization})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="checked_in">Checked-in</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <button
          onClick={() => {
            setSelectedDate('');
            setSelectedDoctorId('');
            setSelectedStatus('');
          }}
          className="text-slate-400 hover:text-slate-700 text-xs font-semibold cursor-pointer"
        >
          Clear Filters
        </button>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading appointments..." />
        ) : appointments.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            No appointments scheduled matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Token & Time</th>
                  <th className="py-3.5 px-4">Patient Profile</th>
                  <th className="py-3.5 px-4">Assigned Doctor</th>
                  <th className="py-3.5 px-4">Consultation Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {appointments.map((a) => (
                  <tr key={a.appointment_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-blue-700">#{a.appointment_id}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{a.appointment_time?.slice(0, 5)} hrs</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{a.patient_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {a.registration_id} • {a.mobile_number}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800">{formatDocName(a.doctor_name)}</span>
                      <span className="block text-[10px] text-slate-400">{a.specialization}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="capitalize font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                        {a.appointment_type || 'General'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          a.status === 'checked_in'
                            ? 'bg-amber-100 text-amber-800'
                            : a.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {a.status?.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* View Action (Available for ALL statuses) */}
                      <button
                        onClick={() => setViewTarget(a)}
                        title="View Appointment Details"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Status: Scheduled */}
                      {a.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleCheckin(a.appointment_id)}
                            title="Check-in Patient"
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Check-in</span>
                          </button>

                          <button
                            onClick={() => {
                              setRescheduleTarget(a);
                              setRescheduleData({
                                appointment_date: a.appointment_date ? new Date(a.appointment_date).toISOString().split('T')[0] : selectedDate,
                                appointment_time: a.appointment_time || '10:00:00',
                              });
                            }}
                            title="Reschedule Slot"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                          >
                            <CalendarCheck2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setCancelTarget(a);
                              setCancellationReason('');
                            }}
                            title="Cancel Appointment"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Status: Checked In */}
                      {a.status === 'checked_in' && (
                        <>
                          <button
                            onClick={() =>
                              navigate('/receptionist/check-in', {
                                state: {
                                  doctorName: a.doctor_name,
                                  patientName: a.patient_name,
                                  appointmentId: a.appointment_id,
                                },
                              })
                            }
                            title="View in Doctor Waiting Lounge"
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-lg text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>In Queue</span>
                          </button>

                          <button
                            onClick={() => {
                              setRescheduleTarget(a);
                              setRescheduleData({
                                appointment_date: a.appointment_date ? new Date(a.appointment_date).toISOString().split('T')[0] : selectedDate,
                                appointment_time: a.appointment_time || '10:00:00',
                              });
                            }}
                            title="Reschedule Slot"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                          >
                            <CalendarCheck2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setCancelTarget(a);
                              setCancellationReason('');
                            }}
                            title="Cancel Appointment"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Status: Completed */}
                      {a.status === 'completed' && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Done</span>
                        </span>
                      )}

                      {/* Status: Cancelled */}
                      {a.status === 'cancelled' && (
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>Cancelled</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <Modal
          isOpen={true}
          onClose={() => setRescheduleTarget(null)}
          title={`Reschedule Appointment #${rescheduleTarget.appointment_id}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-900 block">{rescheduleTarget.patient_name}</span>
              <span className="text-[11px] text-slate-500">Dr. {rescheduleTarget.doctor_name}</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Date *</label>
              <input
                type="date"
                required
                value={rescheduleData.appointment_date}
                onChange={(e) => setRescheduleData({ ...rescheduleData, appointment_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Time Slot *</label>
              <select
                required
                value={rescheduleData.appointment_time}
                onChange={(e) => setRescheduleData({ ...rescheduleData, appointment_time: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              >
                {['09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00', '12:00:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00', '17:00:00'].map((t) => (
                  <option key={t} value={t}>
                    {t.slice(0, 5)} hrs
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rescheduling}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
              >
                {rescheduling ? 'Saving...' : 'Confirm Reschedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Appointment Modal */}
      {cancelTarget && (
        <Modal
          isOpen={true}
          onClose={() => setCancelTarget(null)}
          title={`Cancel Appointment #${cancelTarget.appointment_id}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs text-slate-700">
            <div className="p-3.5 bg-red-50/70 rounded-2xl border border-red-200 space-y-1">
              <span className="text-[10px] text-red-700 font-bold uppercase tracking-wider block">Confirm Cancellation</span>
              <p className="text-slate-800 text-xs">
                Are you sure you want to cancel the appointment for <strong className="text-slate-900 font-bold">{cancelTarget.patient_name}</strong> with <strong className="text-slate-900 font-bold">{formatDocName(cancelTarget.doctor_name)}</strong>?
              </p>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Token #{cancelTarget.appointment_id} • Slot: {cancelTarget.appointment_time?.slice(0, 5)} hrs
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Cancelling this appointment will immediately release the doctor's time slot for other patients.
            </p>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Keep Appointment
              </button>
              <button
                type="submit"
                disabled={cancelling}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md shadow-red-600/20 transition-all cursor-pointer"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Booking Modal */}
      <Modal
        isOpen={isNewBookingOpen}
        onClose={() => setIsNewBookingOpen(false)}
        title="Schedule Follow-up / New Appointment"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateAppointment} className="space-y-4 text-xs text-slate-700">
          {/* Patient Selection */}
          <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-2 relative" ref={ptDropdownRef}>
            <label className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider">
              1. Search Patient *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                required
                value={
                  isPtDropdownOpen
                    ? searchPtTerm
                    : bookingPatient
                    ? `${bookingPatient.full_name || bookingPatient.patient_name} (${bookingPatient.registration_id || `#${bookingPatient.patient_id}`} • ${bookingPatient.mobile_number})`
                    : searchPtTerm
                }
                onFocus={() => {
                  setIsPtDropdownOpen(true);
                  if (bookingPatient) {
                    setSearchPtTerm(bookingPatient.full_name || bookingPatient.patient_name || '');
                  }
                }}
                onChange={(e) => {
                  setSearchPtTerm(e.target.value);
                  setIsPtDropdownOpen(true);
                  if (!e.target.value) setBookingPatient(null);
                }}
                placeholder="Search patient by name, mobile, or Reg ID..."
                className={`w-full pl-9 pr-8 py-2 text-xs rounded-xl border ${
                  bookingPatient ? 'border-blue-500 bg-blue-50/30 font-bold text-slate-900' : 'border-blue-300 bg-white'
                } focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all`}
              />

              {bookingPatient ? (
                <button
                  type="button"
                  onClick={() => {
                    setBookingPatient(null);
                    setSearchPtTerm('');
                    setIsPtDropdownOpen(true);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPtDropdownOpen(!isPtDropdownOpen)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Floating Patient Dropdown */}
            {isPtDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-100">
                {filteredPatients.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-xs">
                    {searchPtTerm ? `No registered patients matching "${searchPtTerm}"` : 'No registered patients in database'}
                  </div>
                ) : (
                  filteredPatients.map((p) => {
                    const isSelected = bookingPatient && String(p.patient_id) === String(bookingPatient.patient_id);
                    const name = p.full_name || p.patient_name || 'Patient';
                    return (
                      <div
                        key={p.patient_id}
                        onClick={() => {
                          setBookingPatient(p);
                          setSearchPtTerm(name);
                          setIsPtDropdownOpen(false);
                        }}
                        className={`p-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          isSelected ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                              {p.registration_id || `#${p.patient_id}`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {p.mobile_number} • {p.village || p.village_mandal || 'Hyderabad'}
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-blue-600 text-xs font-bold">✓</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Searchable Doctor Selection */}
          <div className="space-y-1 relative" ref={docDropdownRef}>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Doctor * (Active Doctors Only)
            </label>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                required
                value={
                  isDocDropdownOpen
                    ? docSearchTerm
                    : (() => {
                        const d = doctors.find((doc) => String(doc.doctor_id) === String(newBookingData.doctor_id));
                        return d ? `${formatDocName(d.doctor_name || d.full_name)} (${d.specialization || 'General'})` : docSearchTerm;
                      })()
                }
                onFocus={() => {
                  setIsDocDropdownOpen(true);
                  const d = doctors.find((doc) => String(doc.doctor_id) === String(newBookingData.doctor_id));
                  if (d) setDocSearchTerm(d.doctor_name || d.full_name || '');
                }}
                onChange={(e) => {
                  setDocSearchTerm(e.target.value);
                  setIsDocDropdownOpen(true);
                }}
                placeholder="Search doctor by name or specialty..."
                className={`w-full pl-9 pr-7 py-2 text-xs rounded-xl border ${
                  newBookingData.doctor_id ? 'border-blue-500 bg-blue-50/20 font-bold text-slate-900' : 'border-slate-300 bg-white'
                } focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all`}
              />

              <button
                type="button"
                onClick={() => setIsDocDropdownOpen(!isDocDropdownOpen)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Floating Doctor Dropdown List */}
            {isDocDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-100">
                {filteredDoctors.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-xs">
                    No active doctors found matching "{docSearchTerm}"
                  </div>
                ) : (
                  filteredDoctors.map((doc) => {
                    const isSelected = String(doc.doctor_id) === String(newBookingData.doctor_id);
                    const name = formatDocName(doc.doctor_name || doc.full_name);
                    return (
                      <div
                        key={doc.doctor_id}
                        onClick={() => {
                          setNewBookingData((prev) => ({ ...prev, doctor_id: doc.doctor_id }));
                          setDocSearchTerm(doc.doctor_name || doc.full_name || '');
                          setIsDocDropdownOpen(false);
                        }}
                        className={`p-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          isSelected ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{name}</span>
                            {doc.specialization && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100/70 font-semibold text-blue-700">
                                {doc.specialization}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Fee: ₹{doc.new_consultation_fee || 500} • {doc.qualification || 'MBBS / BHMS'}
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-blue-600 text-xs font-bold">✓</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Appointment Date *</label>
              <input
                type="date"
                required
                value={newBookingData.appointment_date}
                onChange={(e) => setNewBookingData({ ...newBookingData, appointment_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Time Slot *</label>
              <select
                required
                value={newBookingData.appointment_time}
                onChange={(e) => setNewBookingData({ ...newBookingData, appointment_time: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              >
                {['09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00', '12:00:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00', '17:00:00'].map((t) => (
                  <option key={t} value={t}>
                    {t.slice(0, 5)} hrs
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewBookingOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingBooking}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
            >
              {creatingBooking ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Appointment View Details Modal */}
      {viewTarget && (
        <Modal
          isOpen={true}
          onClose={() => setViewTarget(null)}
          title={`Appointment Details — Token #${viewTarget.appointment_id}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs text-slate-700">
            {/* Status & Token Header Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Appointment Token</span>
                <span className="text-xl font-mono font-black text-blue-700">#{viewTarget.appointment_id}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Status</span>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold capitalize ${
                    viewTarget.status === 'checked_in'
                      ? 'bg-amber-100 text-amber-800'
                      : viewTarget.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : viewTarget.status === 'cancelled'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {viewTarget.status?.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Patient & Doctor 2-Column Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Patient Information</span>
                <div className="font-bold text-slate-900 text-sm">{viewTarget.patient_name}</div>
                <div className="text-slate-600 font-mono">Reg ID: {viewTarget.registration_id || `REG-${String(viewTarget.patient_id).padStart(5, '0')}`}</div>
                <div className="text-slate-600 font-mono">Mobile: {viewTarget.mobile_number}</div>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Attending Doctor</span>
                <div className="font-bold text-slate-900 text-sm flex items-center justify-end gap-1">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                  <span>{formatDocName(viewTarget.doctor_name)}</span>
                </div>
                <div className="text-slate-600">{viewTarget.specialization}</div>
                <div className="text-[11px] font-semibold text-slate-700 capitalize bg-slate-100 px-2 py-0.5 rounded inline-block mt-1">
                  Type: {viewTarget.appointment_type || 'Consultation'}
                </div>
              </div>
            </div>

            {/* Schedule Info */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>
                  Date:{' '}
                  <strong className="text-slate-900">
                    {viewTarget.appointment_date
                      ? new Date(viewTarget.appointment_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>
                  Slot: <strong className="text-slate-900 font-mono">{viewTarget.appointment_time?.slice(0, 5)} hrs</strong>
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {viewTarget.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => {
                      const apptId = viewTarget.appointment_id;
                      setViewTarget(null);
                      handleCheckin(apptId);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Check-in Patient</span>
                  </button>
                )}

                {viewTarget.status === 'checked_in' && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewTarget(null);
                      navigate('/receptionist/check-in');
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Go to Waiting Queue</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
