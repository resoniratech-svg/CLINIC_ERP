import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ArrowRight,
  Stethoscope,
  Receipt,
  UserCheck,
  MessagesSquare,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const PROPatientQueuePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const currentStatus = searchParams.get('status') || 'all';
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentStatus !== 'all') {
        params.status = currentStatus;
      }
      const res = await proApi.getPatientQueue(params);
      if (res.success) {
        setQueue(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch patient queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // 30 second auto-refresh
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [currentStatus]);

  const filteredQueue = queue.filter(item => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      item.patient_name?.toLowerCase().includes(term) ||
      item.registration_id?.toLowerCase().includes(term) ||
      String(item.token_number)?.includes(term) ||
      item.doctor_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#1565C0] flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F]"></span>
            <Users className="w-5 h-5 text-[#1565C0]" />
            <span>PRO Patient Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Patients who have completed doctor consultation and are ready for prescription review, treatment & billing processing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchQueue}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Queue' },
            { id: 'pending', label: 'PRO Pending' },
            { id: 'in_progress', label: 'In Progress' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ status: tab.id })}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                currentStatus === tab.id
                  ? 'bg-[#D32F2F] text-white shadow-xs shadow-red-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient, reg ID, token..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20 outline-none"
          />
        </div>
      </div>

      {/* Queue Table */}
      {loading ? (
        <LoadingSpinner label="Loading PRO patient queue..." />
      ) : filteredQueue.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No patients waiting in PRO queue</p>
          <p className="text-xs text-slate-400 mt-1">
            Patients appear here automatically when Doctor completes consultation.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Token #</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Demographics</th>
                  <th className="py-3.5 px-4">Doctor</th>
                  <th className="py-3.5 px-4">Appt Type</th>
                  <th className="py-3.5 px-4">PRO Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQueue.map(pt => (
                  <tr key={pt.appointment_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #{pt.token_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{pt.patient_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{pt.registration_id}</div>
                    </td>
                    <td className="py-3.5 px-4 capitalize">
                      {pt.age ? `${pt.age} yrs` : '—'} • {pt.gender || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <Stethoscope className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{pt.doctor_name || 'Assigned Doctor'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                        {pt.appointment_type || 'regular'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          pt.pro_status === 'PRO Pending'
                            ? 'bg-amber-100 text-amber-800'
                            : pt.pro_status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {pt.pro_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/pro/patients/${pt.patient_id}`}
                          className="flex items-center gap-1 px-3 py-1.5 btn-brand-gradient rounded-xl font-bold text-[11px] shadow-xs transition"
                        >
                          <span>Open 360°</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
