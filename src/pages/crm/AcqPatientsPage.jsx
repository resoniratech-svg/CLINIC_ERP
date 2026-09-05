import React, { useState, useEffect, useRef } from 'react';
import { crmApi, receptionistApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/common/Badge';
import { formatDisplayDate } from '../../utils/dateUtils';
import { Sparkles, CheckCircle2, UserCheck, ShieldAlert, Search, ChevronDown, X, Calendar, DollarSign, Clock } from 'lucide-react';

export const AcqPatientsPage = () => {
  const [patientId, setPatientId] = useState('');
  const [monthlyPlan, setMonthlyPlan] = useState('Standard Care Plan');
  const [monthlyAmount, setMonthlyAmount] = useState(2500);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  // Searchable Patient Combobox state
  const [patients, setPatients] = useState([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const patientDropdownRef = useRef(null);

  // ACQ Subscriptions List
  const [acqList, setAcqList] = useState([]);
  const [loadingAcq, setLoadingAcq] = useState(false);

  const { showToast } = useToast();

  const fetchPatients = async () => {
    try {
      const res = await receptionistApi.searchPatients({ search: '%' });
      if (res.success) {
        const list = res.data?.patients || (Array.isArray(res.data) ? res.data : []);
        setPatients(list);
      }
    } catch (err) {}
  };

  const fetchAcqList = async () => {
    setLoadingAcq(true);
    try {
      const res = await crmApi.getAcqPatients();
      if (res.success) {
        setAcqList(res.data || []);
      }
    } catch (err) {
      // PRO/Super admin view
    } finally {
      setLoadingAcq(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchAcqList();
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

  const handlePlanChange = (planName) => {
    setMonthlyPlan(planName);
    const planPrices = {
      'Standard Care Plan': 2500,
      'Comprehensive Chronic Plan': 5000,
      'Senior Wellness Retainer': 3500,
      'Family Comprehensive Plan': 8000,
    };
    if (planPrices[planName]) {
      setMonthlyAmount(planPrices[planName]);
    }
  };

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

  const handleRegisterAcq = async (e) => {
    e.preventDefault();
    if (!patientId) {
      showToast('Please select a patient', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await crmApi.createAcqPatient({
        patient_id: parseInt(patientId),
        monthly_plan_amount: parseFloat(monthlyAmount) || 0,
        start_date: startDate || new Date().toISOString().split('T')[0],
        frequency: 'monthly',
      });

      if (res.success) {
        showToast(`Patient #${patientId} enrolled into ACQ Monthly Care Plan (₹${monthlyAmount}/mo)`, 'success');
        setPatientId('');
        setPatientSearchTerm('');
        fetchAcqList();
      }
    } catch (err) {
      showToast(err.message || 'Failed to register ACQ care plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span>ACQ Recurring Care Plan Registration</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Enroll chronic care and ongoing treatment patients into monthly retainer subscriptions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Enrollment Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
            Enroll Patient into ACQ Plan
          </h3>

          <form onSubmit={handleRegisterAcq} className="space-y-4 text-xs text-slate-700">
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
                    patientId ? 'border-purple-500 bg-purple-50/20 font-bold text-slate-900' : 'border-slate-300 bg-white'
                  } focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all`}
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
                          className={`p-2.5 hover:bg-purple-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected ? 'bg-purple-50 font-bold text-purple-900' : 'text-slate-700'
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
                            <span className="text-purple-600 text-[11px] font-bold">✓</span>
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
                Care Subscription Plan *
              </label>
              <select
                value={monthlyPlan}
                onChange={(e) => handlePlanChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="Standard Care Plan">Standard Care Plan (₹2,500/mo)</option>
                <option value="Comprehensive Chronic Plan">Comprehensive Chronic Plan (₹5,000/mo)</option>
                <option value="Senior Wellness Retainer">Senior Wellness Retainer (₹3,500/mo)</option>
                <option value="Family Comprehensive Plan">Family Comprehensive Plan (₹8,000/mo)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Subscription Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 uppercase text-[11px] mb-1">
                Monthly Amount (₹) *
              </label>
              <input
                type="number"
                required
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-xl text-xs shadow-md shadow-purple-500/20 transition-all cursor-pointer mt-2 disabled:opacity-50"
            >
              {saving ? 'Activating...' : 'Activate ACQ Subscription'}
            </button>
          </form>
        </div>

        {/* Info Card */}
        <div className="bg-purple-50/50 p-6 rounded-3xl border border-purple-100 space-y-4">
          <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>About ACQ Care Protocols</span>
          </h3>
          <p className="text-xs text-purple-800 leading-relaxed">
            ACQ (Acquisition Care Protocol) facilitates ongoing care plans and retainer subscriptions for patients undergoing chronic homeopathic treatments.
          </p>
          <ul className="space-y-2.5 text-xs text-purple-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>Records monthly retainer subscriptions linked directly to patient profiles.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>Integrates with CRM Follow-ups queue under category <strong>ACQ Monthly Care</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>Supports customized monthly subscription amounts and flexible start dates.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>Audited under Super Admin & PRO Care Management governance.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Enrolled ACQ Subscriptions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Active ACQ Care Subscriptions ({acqList.length})
          </h3>
        </div>

        {acqList.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No active ACQ care subscriptions enrolled yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Monthly Fee</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {acqList.map((item) => (
                  <tr key={item.id || item.acq_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{item.patient_name || `Patient #${item.patient_id}`}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-normal">
                        ID: #{item.patient_id}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                      ₹{parseFloat(item.monthly_plan_amount || 0).toFixed(2)}/mo
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {formatDisplayDate(item.start_date)}
                    </td>

                    <td className="py-3.5 px-4 uppercase text-slate-600 font-medium text-[11px]">
                      {item.frequency || 'monthly'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Badge variant={item.status || 'active'}>{item.status || 'active'}</Badge>
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
