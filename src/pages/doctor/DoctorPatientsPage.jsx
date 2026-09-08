import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doctorApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { Users, Search, RefreshCw, ChevronRight, User } from 'lucide-react';

export const DoctorPatientsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const fetchPatients = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const res = await doctorApi.getPatients(q ? { search: q } : {});
      if (res.success) setPatients(res.data || []);
    } catch {
      showToast('Failed to load patients', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPatients(); }, []);

  // Automatically select and load patient if passed via router location.state
  useEffect(() => {
    if (location.state?.patient_id) {
      const pid = location.state.patient_id;
      const match = patients.find(p => p.patient_id === pid);
      if (match) {
        loadOverview(match);
      } else {
        doctorApi.getPatientOverview(pid).then(res => {
          if (res.success && res.data?.patient) {
            setSelected(res.data.patient);
            setOverview(res.data);
          }
        }).catch(() => {});
      }
    }
  }, [location.state?.patient_id, patients]);

  const handleSearch = () => fetchPatients(search);

  const loadOverview = async (patient) => {
    setSelected(patient);
    setOverview(null);
    setLoadingOverview(true);
    try {
      const res = await doctorApi.getPatientOverview(patient.patient_id);
      if (res.success) setOverview(res.data);
    } catch {
      showToast('Failed to load patient overview', 'error');
    } finally {
      setLoadingOverview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" /> My Patients
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Patients who have had appointments with you</p>
        </div>
      </div>

      <div className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name, mobile, or patient ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 outline-none"
          />
        </div>
        <button onClick={handleSearch} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl">
          <Search className="w-3.5 h-3.5" /> Search
        </button>
        <button onClick={() => { setSearch(''); fetchPatients(''); }} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Patient List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Patients ({patients.length})</h3>
          </div>
          {loading ? (
            <div className="p-8"><LoadingSpinner label="Loading..." /></div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">No patients found.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {patients.map(p => (
                <button
                  key={p.patient_id}
                  onClick={() => loadOverview(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between ${
                    selected?.patient_id === p.patient_id ? 'bg-emerald-50 border-l-4 border-emerald-600' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {p.patient_name?.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{p.patient_name}</div>
                      <div className="text-[10px] text-slate-400">{p.registration_id} • {p.age}y • {p.gender}</div>
                      {p.last_visit_date && (
                        <div className="text-[10px] text-slate-400">Last visit: {new Date(p.last_visit_date).toLocaleDateString('en-IN')}</div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Patient Overview Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {selected ? `Patient Overview — ${selected.patient_name}` : 'Select a patient to view overview'}
            </h3>
          </div>

          {!selected ? (
            <div className="p-8 text-center text-slate-400">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-xs">Click a patient to see their clinical overview</p>
            </div>
          ) : loadingOverview ? (
            <div className="p-8"><LoadingSpinner label="Loading overview..." /></div>
          ) : overview ? (
            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              {/* Patient Details */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500">Name:</span> <strong>{overview.patient.full_name}</strong></div>
                  <div><span className="text-slate-500">ID:</span> <strong>{overview.patient.registration_id}</strong></div>
                  <div><span className="text-slate-500">Age:</span> <strong>{overview.patient.age}y</strong></div>
                  <div><span className="text-slate-500">Gender:</span> <strong>{overview.patient.gender}</strong></div>
                  <div><span className="text-slate-500">Mobile:</span> <strong>{overview.patient.mobile_number}</strong></div>
                  <div><span className="text-slate-500">Village:</span> <strong>{overview.patient.village}</strong></div>
                </div>
              </div>

              {/* Previous Consultations */}
              {overview.previous_consultations?.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Previous Consultations ({overview.previous_consultations.length})</h4>
                  <div className="space-y-2">
                    {overview.previous_consultations.map(c => (
                      <div key={c.consultation_id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-800">{c.primary_diagnosis_name || c.primary_diagnosis_text || 'N/A'}</span>
                          <span className="text-slate-400">{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="text-slate-500 mt-0.5">{c.chief_complaint}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Prescriptions */}
              {overview.previous_prescriptions?.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Previous Prescriptions ({overview.previous_prescriptions.length})</h4>
                  <div className="space-y-2">
                    {overview.previous_prescriptions.slice(0, 5).map(p => (
                      <div key={p.prescription_id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-500">{new Date(p.created_at).toLocaleDateString('en-IN')}</span>
                          <span className="text-slate-400">{p.doctor_name}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.medicines?.map((m, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">
                              {m.medicine_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Treatments */}
              {overview.previous_treatments?.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Previous Treatments ({overview.previous_treatments.length})</h4>
                  <div className="space-y-2">
                    {overview.previous_treatments.slice(0, 3).map(t => (
                      <div key={t.treatment_id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div className="font-bold text-slate-800">{t.treatment_name}</div>
                        <div className="text-slate-500">{t.treatment_type} • {t.duration} {t.duration_unit}</div>
                        <div className="text-slate-400 text-[10px]">{t.start_date} → {t.end_date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
