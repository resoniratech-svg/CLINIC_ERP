import React, { useState, useEffect } from 'react';
import { crmApi, receptionistApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/common/Badge';
import { formatDisplayDate } from '../../utils/dateUtils';
import { AutocompleteSearch, HighlightMatch } from '../../components/common/AutocompleteSearch';
import { UserMinus, CheckCircle2, AlertTriangle, Search, ChevronDown, X, History } from 'lucide-react';

export const OcNrPatientsPage = () => {
  const [patientId, setPatientId] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [classification, setClassification] = useState('oc');
  const [reason, setReason] = useState('Patient relocated');
  const [saving, setSaving] = useState(false);

  // OC / NR Dropout History
  const [ocnrList, setOcnrList] = useState([]);
  const [loadingOcnr, setLoadingOcnr] = useState(false);

  const { showToast } = useToast();

  const fetchOcnrList = async () => {
    setLoadingOcnr(true);
    try {
      const res = await crmApi.getOcNrPatients();
      if (res.success) {
        setOcnrList(res.data || []);
      }
    } catch (err) {
      // Quiet fail if not authorized
    } finally {
      setLoadingOcnr(false);
    }
  };

  useEffect(() => {
    fetchOcnrList();
  }, []);

  const handleMark = async (e) => {
    e.preventDefault();
    if (!patientId) {
      showToast('Please select a patient', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await crmApi.markOcNrPatient({
        patient_id: parseInt(patientId),
        classification,
        reason,
      });

      if (res.success) {
        showToast(`Patient #${patientId} classified as ${classification.toUpperCase()} (14-day reactivation scheduled)`, 'success');
        setPatientId('');
        setSelectedPatient(null);
        fetchOcnrList();
      }
    } catch (err) {
      showToast(err.message || 'Failed to classify patient', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-red-600" />
            <span>OC / NR Patient Dropout Classification</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Classify and analyze One-Consultation (OC) and Not-Returned (NR) patient attrition patterns
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
            Classify Dropout Patient
          </h3>

          <form onSubmit={handleMark} className="space-y-4 text-xs text-slate-700">
            {/* Unified Single-Field Searchable Patient Selector */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Patient *
              </label>
              <AutocompleteSearch
                searchFn={(term) => receptionistApi.searchPatients({ search: term })}
                onSelect={(p) => {
                  setSelectedPatient(p);
                  setPatientId(p.patient_id);
                }}
                selectedItem={selectedPatient}
                onClear={() => {
                  setSelectedPatient(null);
                  setPatientId('');
                }}
                placeholder="Search by patient name, mobile, or ID..."
                findButtonColor="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white"
                inputClassName="border-slate-300 focus:ring-red-500 rounded-xl"
                renderItem={(p, { isSelected, query }) => (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <HighlightMatch text={p.patient_name || p.full_name} query={query} />
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                          ID: #{p.patient_id}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        <HighlightMatch text={p.mobile_number} query={query} /> • <HighlightMatch text={p.registration_id || 'REG'} query={query} />
                      </div>
                    </div>
                  </div>
                )}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Classification *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setClassification('oc')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    classification === 'oc'
                      ? 'bg-red-50 border-red-300 text-red-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <span className="block font-black text-sm">OC</span>
                  <span className="text-[10px]">One Consultation Only</span>
                </button>

                <button
                  type="button"
                  onClick={() => setClassification('nr')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    classification === 'nr'
                      ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <span className="block font-black text-sm">NR</span>
                  <span className="text-[10px]">Not Returned Patient</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Primary Reason / Feedback
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Relocated to another city, cured after first prescription..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl text-xs shadow-md shadow-red-500/20 transition-all cursor-pointer mt-2"
            >
              {saving ? 'Saving...' : 'Confirm Classification'}
            </button>
          </form>
        </div>

        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Retention Strategy Guidelines
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Patients logged as OC or NR trigger automated CRM reactivation tasks for the Executive and Receptionist calling teams after 14 days.
          </p>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
              <span><strong>OC (One Consultation):</strong> Patient attended the initial appointment but never scheduled a follow-up or renewal.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
              <span><strong>NR (Not Returned):</strong> Patient was prescribed a medicine course but discontinued without doctor review.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Classified OC / NR Dropouts History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>Classified OC / NR Drop Patients ({ocnrList.length})</span>
          </h3>
        </div>

        {ocnrList.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No patients classified as OC or NR yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Primary Reason / Feedback</th>
                  <th className="py-3 px-4">Marked Date</th>
                  <th className="py-3 px-4 text-right">Reactivation Protocol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {ocnrList.map((item) => {
                  const isOC = (item.classification || '').toLowerCase() === 'oc';
                  return (
                    <tr key={item.id || item.oc_nr_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{item.patient_name || `Patient #${item.patient_id}`}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          ID: #{item.patient_id} {item.mobile_number ? `• ${item.mobile_number}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isOC
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOC ? 'bg-red-500' : 'bg-amber-500'}`} />
                          {isOC ? 'OC (One Consultation)' : 'NR (Not Returned)'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {item.reason || <span className="italic text-slate-400">No reason specified</span>}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {formatDisplayDate(item.marked_at || item.created_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          14-Day CRM Task Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
