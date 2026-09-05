import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  UserPlus,
  Search,
  Calendar,
  UserCheck,
  HelpCircle,
  Users,
  Clock,
  RotateCcw,
  AlertCircle,
  CheckSquare,
  DollarSign,
  PhoneCall,
  HeartHandshake,
  Receipt,
  ArrowRight,
  TrendingUp,
  Building
} from 'lucide-react';

export const ReceptionistDashboard = () => {
  const [data, setData] = useState(null);
  const [waitingList, setWaitingList] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, waitRes, docRes] = await Promise.all([
        receptionistApi.getDashboard(),
        receptionistApi.getWaitingQueue(),
        receptionistApi.getActiveDoctors(),
      ]);

      if (dashRes.success) setData(dashRes.data);
      if (waitRes.success) setWaitingList(waitRes.data || []);
      if (docRes.success) setDoctors(docRes.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch receptionist dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  if (loading) {
    return <LoadingSpinner label="Compiling today's front-desk operational metrics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-100 text-xs font-semibold">
            <Building className="w-3.5 h-3.5 text-blue-300" />
            <span>Karimnagar Main Branch • Front Desk Operations</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Receptionist Operational Command
          </h1>
          <p className="text-xs text-blue-100/90 max-w-xl">
            Streamline patient intake, doctor schedules, consultation payments, check-ins, and follow-up queues.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <Link
            to="/receptionist/patients/register"
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-800 hover:bg-blue-50 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span>+ New Patient</span>
          </Link>
          <Link
            to="/receptionist/patients"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Search Patient</span>
          </Link>
        </div>
      </div>

      {/* 8 Quick Actions Matrix */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Fast Operational Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
          {[
            { label: '+ Registration', path: '/receptionist/patients/register', icon: UserPlus, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { label: '+ New Enquiry', path: '/receptionist/enquiries', icon: HelpCircle, color: 'text-sky-600 bg-sky-50 border-sky-200' },
            { label: '+ Emp Referral', path: '/receptionist/referrals/employee', icon: Users, color: 'text-purple-600 bg-purple-50 border-purple-200' },
            { label: '+ Pt Referral', path: '/receptionist/referrals/patient', icon: HeartHandshake, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
            { label: '🔍 Search Pt', path: '/receptionist/patients', icon: Search, color: 'text-slate-700 bg-slate-50 border-slate-200' },
            { label: '+ Appointment', path: '/receptionist/appointments', icon: Calendar, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            { label: '📞 Calling / CRM', path: '/receptionist/crm', icon: PhoneCall, color: 'text-red-600 bg-red-50 border-red-200' },
            { label: '💰 Pay Consult', path: '/receptionist/billing', icon: Receipt, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          ].map((action, idx) => {
            const Icon = action.icon;
            return (
              <Link
                key={idx}
                to={action.path}
                className={`p-3 rounded-2xl border ${action.color} flex flex-col items-center justify-center text-center gap-1.5 font-bold hover:shadow-sm transition-all hover:scale-[1.02] cursor-pointer`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] leading-tight">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 11 Main Today's Operational KPIs */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Today's Operational Summary (Live Database)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* New Patients */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">New Patients</span>
              <UserPlus className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {data?.new_patients_today || 0}
            </div>
            <span className="text-[11px] text-blue-700 font-semibold">Registered today</span>
          </div>

          {/* Appointments */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Appointments</span>
              <Calendar className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {data?.appointments_today || 0}
            </div>
            <span className="text-[11px] text-indigo-700 font-semibold">Scheduled for today</span>
          </div>

          {/* Waiting Patients */}
          <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-2xs space-y-1 bg-amber-50/30">
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-[11px] font-bold uppercase tracking-wider">Waiting Patients</span>
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <div className="text-3xl font-black text-amber-900 font-mono">
              {data?.waiting_patients || 0}
            </div>
            <span className="text-[11px] text-amber-700 font-semibold">Checked-in & in waiting queue</span>
          </div>

          {/* Consultation Revenue */}
          <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-2xs space-y-1 bg-emerald-50/30">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[11px] font-bold uppercase tracking-wider">Consultation Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900 font-mono">
              {formatCurrency(data?.consultation_revenue_today)}
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold">Collected at front desk</span>
          </div>

          {/* Enquiries */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Enquiries Today</span>
              <HelpCircle className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {data?.enquiries_today || 0}
            </div>
            <span className="text-[11px] text-slate-500">Walk-ins & phone calls</span>
          </div>

          {/* Pending Leads */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Executive Leads</span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {data?.pending_leads || 0}
            </div>
            <span className="text-[11px] text-purple-700 font-semibold">Awaiting doctor assignment</span>
          </div>

          {/* Callbacks Today */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Callbacks Today</span>
              <PhoneCall className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {data?.callbacks_today || 0}
            </div>
            <span className="text-[11px] text-red-700 font-semibold">Scheduled callback requests</span>
          </div>

          {/* Renewals */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Renewals Due</span>
              <RotateCcw className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {data?.renewals_today || 0}
            </div>
            <span className="text-[11px] text-teal-700 font-semibold">Registration renewal batch</span>
          </div>

          {/* Due Patients */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Due Patients</span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-black text-amber-600 font-mono">
              {data?.due_patients_count || 0}
            </div>
            <span className="text-[11px] text-slate-500">Outstanding fee balance</span>
          </div>

          {/* Follow-ups Today */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">CRM Follow-ups</span>
              <CheckSquare className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {data?.followups_today || 0}
            </div>
            <span className="text-[11px] text-blue-700 font-semibold">Pending patient follow-ups</span>
          </div>

          {/* Pending Tasks */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">My Pending Tasks</span>
              <CheckSquare className="w-4 h-4 text-slate-700" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {data?.pending_tasks_count || 0}
            </div>
            <span className="text-[11px] text-slate-500">Unresolved front-desk tasks</span>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Live Waiting Queue & Active Doctors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waiting Patients Queue */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Live Waiting Queue</span>
              </h3>
              <span className="text-xs text-slate-400">Patients checked-in and waiting for doctor call</span>
            </div>
            <Link
              to="/receptionist/check-in"
              className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {waitingList.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-xs">
              No patients currently waiting in the OPD lounge.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {waitingList.slice(0, 5).map((w) => (
                <div key={w.appointment_id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{w.patient_name}</span>
                    <div className="text-[11px] text-slate-400">
                      Token: <span className="font-mono font-bold text-slate-700">#{w.appointment_id}</span> • Dr. {w.doctor_name}
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Waiting ({w.appointment_time?.slice(0, 5)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Doctors & OPD Schedules */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Active Doctors & Consultation Fees</span>
              </h3>
              <span className="text-xs text-slate-400">Available medical consultants for appointment booking</span>
            </div>
            <Link
              to="/receptionist/appointments"
              className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Book Appointment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {doctors.slice(0, 5).map((doc) => (
              <div key={doc.doctor_id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900">Dr. {doc.full_name}</span>
                  <div className="text-[11px] text-slate-400">{doc.specialization} ({doc.qualification || 'MBBS'})</div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-blue-700">₹{doc.new_consultation_fee}</span>
                  <span className="block text-[10px] text-slate-400">{doc.start_time?.slice(0, 5)} - {doc.end_time?.slice(0, 5)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
