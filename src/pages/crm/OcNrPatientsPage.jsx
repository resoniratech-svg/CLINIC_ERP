import React, { useState, useEffect, useRef } from 'react';
import { crmApi, receptionistApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { UserMinus, CheckCircle2, AlertTriangle, Search, ChevronDown, X } from 'lucide-react';

export const OcNrPatientsPage = () => {
  const [patientId, setPatientId] = useState('');
  const [classification, setClassification] = useState('oc');
  const [reason, setReason] = useState('Patient relocated');
  const [saving, setSaving] = useState(false);

  // Searchable Patient Combobox state
  const [patients, setPatients] = useState([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const patientDropdownRef = useRef(null);

  const { showToast } = useToast();

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await receptionistApi.searchPatients({ search: '%' });
        if (res.success) {
          const list = res.data?.patients || (Array.isArray(res.data) ? res.data : []);
          setPatients(list);
        }
      } catch (err) {}
    };
    fetchPatients();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(event.target)) {
        setIsPatientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPatients = patients.filter((p) => {
    if (!patientSearchTerm.trim()) return true;
    const q = patientSearchTerm.toLowerCase();
    const name = (p.patient_name || p.full_name || '').toLowerCase();
    const mobile = (p.mobile_number || '').toLowerCase();
    const regId = (p.registration_id || '').toLowerCase();
    const id = String(p.patient_id || '');
    return name.includes(q) || mobile.includes(q) || regId.includes(q) || id.includes(q);
  });

  const selectedPatientObj = patients.find((p) => String(p.patient_id) === String(patientId));

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
        showToast(`Patient #${patientId} classified as ${classification.toUpperCase()}`, 'success');
        setPatientId('');
        setPatientSearchTerm('');
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
            <div className="space-y-1 relative" ref={patientDropdownRef}>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Patient *
              </label>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={
                    isPatientDropdownOpen
                      ? patientSearchTerm
                      : selectedPatientObj
                      ? `${selectedPatientObj.patient_name || selectedPatientObj.full_name} (ID: #${selectedPatientObj.patient_id} • ${selectedPatientObj.mobile_number})`
                      : patientSearchTerm
                  }
                  onFocus={() => {
                    setIsPatientDropdownOpen(true);
                    if (selectedPatientObj) {
                      setPatientSearchTerm(selectedPatientObj.patient_name || selectedPatientObj.full_name);
                    }
                  }}
                  onChange={(e) => {
                    setPatientSearchTerm(e.target.value);
                    setIsPatientDropdownOpen(true);
                    if (!e.target.value) {
                      setPatientId('');
                    }
                  }}
                  placeholder="Search by patient name, mobile, or ID..."
                  className={`w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border ${
                    patientId ? 'border-red-500 bg-red-50/20 font-bold text-slate-900' : 'border-slate-300 bg-white'
                  } focus:ring-2 focus:ring-red-500 focus:outline-none transition-all`}
                />

                {patientId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPatientId('');
                      setPatientSearchTerm('');
                      setIsPatientDropdownOpen(true);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Floating Dropdown Menu */}
              {isPatientDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-52 overflow-y-auto z-50 divide-y divide-slate-100">
                  {filteredPatients.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      No patients found matching "{patientSearchTerm}"
                    </div>
                  ) : (
                    filteredPatients.map((p) => {
                      const isSelected = String(p.patient_id) === String(patientId);
                      return (
                        <div
                          key={p.patient_id}
                          onClick={() => {
                            setPatientId(p.patient_id);
                            setPatientSearchTerm(p.patient_name || p.full_name);
                            setIsPatientDropdownOpen(false);
                          }}
                          className={`p-2.5 hover:bg-red-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected ? 'bg-red-50 font-bold text-red-900' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{p.patient_name || p.full_name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                                ID: #{p.patient_id}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {p.mobile_number} • {p.registration_id || 'REG'}
                            </div>
                          </div>

                          {isSelected && (
                            <span className="text-red-600 text-[11px] font-bold">✓</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
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
    </div>
  );
};
