import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { ClipboardList, Search, Eye, Filter, RefreshCw } from 'lucide-react';

const statusColors = {
  draft: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

export const ConsultationHistoryPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await doctorApi.getConsultationHistory(params);
      if (res.success) setConsultations(res.data || []);
    } catch {
      showToast('Failed to load consultation history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [dateFilter, statusFilter]);

  const filtered = consultations.filter(c =>
    !search ||
    c.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.registration_id?.toLowerCase().includes(search.toLowerCase()) ||
    c.primary_diagnosis_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.primary_diagnosis_text?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-600" /> Consultation History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">All consultations conducted</p>
        </div>
        <button onClick={fetch} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or diagnosis..." className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none" />
        </div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-400" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-emerald-400 bg-white">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
        {(dateFilter || statusFilter) && (
          <button onClick={() => { setDateFilter(''); setStatusFilter(''); }} className="text-xs text-red-600 hover:text-red-700 font-bold px-2">Clear</button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading consultation history..." />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-12 text-center">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">No consultations found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Consultations ({filtered.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Patient</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Diagnosis</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Chief Complaint</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.consultation_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{c.patient_name}</div>
                      <div className="text-[10px] text-slate-400">{c.registration_id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.primary_diagnosis_name || c.primary_diagnosis_text || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{c.chief_complaint || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[c.status] || 'bg-slate-100 text-slate-600'}`}>
                        {c.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/doctor/consultation/${c.consultation_id}`)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
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
