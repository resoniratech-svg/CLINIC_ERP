import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Stethoscope, Users, Clock, CheckCircle, Calendar, Target,
  TrendingUp, ArrowRight, Activity, Building, RefreshCw, HeartPulse
} from 'lucide-react';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

const TargetBar = ({ label, target, achieved, pct, color }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-600 font-medium">{label}</span>
      <span className="font-bold text-slate-800">{pct}%</span>
    </div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
    <div className="flex justify-between text-[10px] text-slate-400">
      <span>Achieved: {typeof achieved === 'number' && achieved > 1000 ? formatCurrency(achieved) : achieved}</span>
      <span>Target: {typeof target === 'number' && target > 1000 ? formatCurrency(target) : target}</span>
    </div>
  </div>
);

export const DoctorDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const [upcomingCount, setUpcomingCount] = useState(0);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, upcomingRes] = await Promise.allSettled([
        doctorApi.getDashboard(),
        doctorApi.getUpcomingAppointments()
      ]);
      if (dashRes.status === 'fulfilled' && dashRes.value.success) setData(dashRes.value.data);
      if (upcomingRes.status === 'fulfilled' && upcomingRes.value.success) {
        setUpcomingCount((upcomingRes.value.data || []).length);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) return <LoadingSpinner label="Loading doctor dashboard..." />;

  const stats = [
    { label: "Today's Appointments", value: data?.today_appts || 0, icon: Calendar, color: 'bg-blue-100 text-blue-700', link: '/doctor/appointments' },
    { label: 'Waiting Queue', value: data?.waiting || 0, icon: Clock, color: 'bg-amber-100 text-amber-700', link: '/doctor/queue' },
    { label: 'In Consultation', value: data?.in_consultation || 0, icon: Activity, color: 'bg-purple-100 text-purple-700', link: '/doctor/queue' },
    { label: 'Completed Today', value: data?.completed_today || 0, icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700', link: '/doctor/consultations' },
    { label: 'Upcoming Assigned', value: upcomingCount, icon: Target, color: upcomingCount > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500', link: '/doctor/appointments' },
  ];

  const ts = data?.target_summary;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-100 text-xs font-semibold">
            <Building className="w-3.5 h-3.5 text-emerald-300" />
            <span>{user?.branch_name || 'Karimnagar Main Branch'} • Doctor Workstation</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, Dr. {user?.full_name?.split(' ').pop()}
          </h1>
          <p className="text-xs text-emerald-100/90 max-w-xl">
            Manage your patient queue, conduct consultations, write prescriptions, and track your clinical performance.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <Link
            to="/doctor/queue"
            className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 rounded-xl text-xs font-bold text-white transition-all"
          >
            <HeartPulse className="w-4 h-4" />
            <span>Patient Queue</span>
          </Link>
          <button
            onClick={fetchDashboard}
            className="p-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 rounded-xl text-white transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Decorative BG circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full bg-white/5" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.link} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all mt-1" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Target Summary + Recent Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Target Card */}
        {ts && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Target className="w-4 h-4 text-indigo-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Monthly Targets</h3>
                  <p className="text-[10px] text-slate-500">
                    {new Date().toLocaleString('default', { month: 'long' })} {ts.year}
                  </p>
                </div>
              </div>
              <Link to="/doctor/targets" className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                View Details <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-4">
              <TargetBar
                label="Revenue Target"
                target={ts.revenue_target.target}
                achieved={ts.revenue_target.achieved}
                pct={ts.revenue_target.achievement_pct}
                color="bg-emerald-500"
              />
              <TargetBar
                label="Unit Target"
                target={ts.unit_target.target}
                achieved={ts.unit_target.achieved}
                pct={ts.unit_target.achievement_pct}
                color="bg-blue-500"
              />
              <TargetBar
                label="New Patient Referrals"
                target={ts.referral_target.target}
                achieved={ts.referral_target.achieved}
                pct={ts.referral_target.achievement_pct}
                color="bg-purple-500"
              />
            </div>
          </div>
        )}

        {/* Recent Follow-ups */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-amber-700" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Recommended Follow-ups</h3>
            </div>
            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {data?.recommended_followups || 0} Today
            </span>
          </div>

          {data?.my_followup_view?.length > 0 ? (
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {data.my_followup_view.map((f) => (
                <div key={f.consultation_id} className="flex items-start justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{f.patient_name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Follow-up: {f.followup_recommended_date ? new Date(f.followup_recommended_date).toLocaleDateString('en-IN') : 'TBD'}
                    </div>
                    {f.followup_instructions && (
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{f.followup_instructions}</div>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    f.appointment_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {f.appointment_status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No follow-ups on record</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/doctor/queue" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors text-center">
            <HeartPulse className="w-5 h-5 text-emerald-700" />
            <span className="text-xs font-bold text-emerald-800">Patient Queue</span>
          </Link>
          <Link to="/doctor/appointments" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors text-center">
            <Calendar className="w-5 h-5 text-blue-700" />
            <span className="text-xs font-bold text-blue-800">Appointments</span>
          </Link>
          <Link to="/doctor/consultations" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-colors text-center">
            <Stethoscope className="w-5 h-5 text-purple-700" />
            <span className="text-xs font-bold text-purple-800">Consultation History</span>
          </Link>
          <Link to="/doctor/leaves" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 transition-colors text-center">
            <TrendingUp className="w-5 h-5 text-red-700" />
            <span className="text-xs font-bold text-red-800">Apply Leave</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
