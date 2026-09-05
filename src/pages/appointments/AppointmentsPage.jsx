import React, { useEffect, useState } from 'react';
import { receptionistApi, doctorsApi } from '../../api';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { toLocalDateString, getTodayDateString, formatDisplayDate } from '../../utils/dateUtils';
import { Calendar, Clock, Stethoscope, Search, RotateCcw } from 'lucide-react';

export const AppointmentsPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Exact Day-by-Day From - To Date Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (doctorFilter) params.doctor_id = doctorFilter;
      if (statusFilter) params.status = statusFilter;

      const [apptRes, docRes] = await Promise.all([
        receptionistApi.getAppointments(params),
        doctorsApi.getDoctors({ status: 'active' }),
      ]);

      if (apptRes.success) setAppointments(apptRes.data || []);
      if (docRes.success) setDoctors(docRes.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch appointments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [doctorFilter, statusFilter]);

  // Quick preset handlers
  const handleSetToday = () => {
    const today = getTodayDateString();
    setFromDate(today);
    setToDate(today);
  };

  const handleSetThisMonth = () => {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setFromDate(toLocalDateString(firstDay));
    setToDate(toLocalDateString(lastDay));
  };

  const handleResetDates = () => {
    setFromDate('');
    setToDate('');
  };

  // Day-accurate filtering
  const filteredAppointments = appointments.filter((a) => {
    const rawDate = a.appointment_date;
    const itemDateStr = toLocalDateString(rawDate);

    if (fromDate && itemDateStr && itemDateStr < fromDate) return false;
    if (toDate && itemDateStr && itemDateStr > toDate) return false;

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const ptMatch = a.patient_name?.toLowerCase().includes(s);
      const docMatch = a.doctor_name?.toLowerCase().includes(s);
      const idMatch = a.appointment_id?.toString().includes(s);
      if (!ptMatch && !docMatch && !idMatch) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>Appointment Registry Surveillance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor clinical bookings, consultation stages, slot allocation, and doctor OPD queues
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient or doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Filter Bar with Day-by-Day From - To Date Range */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* From to To inputs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Appointment Date:</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSetToday}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSetThisMonth}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                This Month
              </button>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={handleResetDates}
                  title="Clear date filter to view all"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Doctor and Status dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>
                  Dr. {d.full_name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="checked_in">Checked In</option>
              <option value="in_consultation">In Consultation</option>
              <option value="doctor_completed">Doctor Completed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span>
            Showing <strong className="text-blue-700 font-mono">{filteredAppointments.length}</strong> appointments
            {fromDate && toDate ? ` from ${fromDate} to ${toDate}` : fromDate ? ` from ${fromDate} onwards` : toDate ? ` up to ${toDate}` : ' across all dates'}
          </span>
          <span className="text-slate-400">Total in registry: {appointments.length}</span>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading appointments registry..." />
        ) : filteredAppointments.length === 0 ? (
          <EmptyState
            title="No appointments found"
            description={
              fromDate || toDate
                ? `No consultations match the date range ${fromDate || 'earliest'} to ${toDate || 'latest'}. Try selecting a different date range or clearing the filter.`
                : 'No consultations match the selected doctor or status filter.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Consultant Doctor</th>
                  <th className="py-3 px-4">Appointment Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAppointments.map((a) => (
                  <tr key={a.appointment_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{a.patient_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">#{a.appointment_id}</div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      Dr. {a.doctor_name}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-semibold text-slate-900 font-mono">
                        {formatDisplayDate(a.appointment_date)}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{a.appointment_time?.slice(0, 5) || '10:00'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="capitalize px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {a.appointment_type || 'New'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {a.created_by_name || 'Front Desk'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Badge variant={a.status}>{a.status?.replace('_', ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
