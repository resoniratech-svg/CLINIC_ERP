import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User,
  Stethoscope,
  Pill,
  Receipt,
  CreditCard,
  Package,
  Clock,
  PhoneCall,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  Building,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Plus,
  History,
  Printer,
  Eye
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { PROInvoiceModal } from './PROInvoiceModal';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

export const PROPatientOverviewPage = () => {
  const { id: paramPatientId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [patientId, setPatientId] = useState(paramPatientId || null);
  const [overview, setOverview] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(!!paramPatientId);
  const [completing, setCompleting] = useState(false);
  const [activeTab, setActiveTab] = useState('clinical'); // clinical | prescription | packages | financials | history | crm | checklist
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Search state when no paramPatientId
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [queuePatients, setQueuePatients] = useState([]);

  useEffect(() => {
    if (paramPatientId) {
      setPatientId(paramPatientId);
    } else {
      // Load current queue patients for quick selection
      proApi.getPatientQueue().then(res => {
        if (res.success) setQueuePatients(res.data || []);
      }).catch(() => {});
    }
  }, [paramPatientId]);

  const loadOverview = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try {
      const [ovRes, chRes] = await Promise.allSettled([
        proApi.getPatientOverview(pid),
        proApi.getPROChecklist(pid)
      ]);

      if (ovRes.status === 'fulfilled' && ovRes.value.success) {
        setOverview(ovRes.value.data);
      } else {
        showToast('Patient overview not found or access denied', 'error');
      }

      if (chRes.status === 'fulfilled' && chRes.value.success) {
        setChecklist(chRes.value.data);
      }
    } catch (err) {
      showToast(err.message || 'Error loading patient 360 overview', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (patientId) {
      loadOverview(patientId);
    }
  }, [patientId, loadOverview]);

  const handleCompletePRO = async () => {
    if (!patientId) return;
    setCompleting(true);
    try {
      const res = await proApi.completePRO(patientId);
      if (res.success) {
        showToast('PRO Completion successful! Prescription released to Pharmacy queue.', 'success');
        // Refresh checklist & overview
        loadOverview(patientId);
      }
    } catch (err) {
      showToast(err.message || 'Checklist incomplete. Complete treatment billing & payment first.', 'error');
      // Switch to checklist tab to show missing items
      setActiveTab('checklist');
    } finally {
      setCompleting(false);
    }
  };

  // If no patient selected, render patient picker / search screen
  if (!patientId) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] inline-block" />
            <User className="w-5 h-5 text-[#1565C0]" />
            <span>Select Patient for 360° Overview</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Choose a patient from the active PRO queue or enter Patient ID below
          </p>

          <div className="mt-4 flex gap-2 max-w-md">
            <input
              type="number"
              placeholder="Enter numeric Patient ID (e.g. 1)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-[#1565C0] outline-none"
            />
            <button
              onClick={() => {
                if (searchQuery.trim()) {
                  navigate(`/pro/patients/${searchQuery.trim()}`);
                }
              }}
              className="px-4 py-2 btn-brand-gradient text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Open Overview
            </button>
          </div>
        </div>

        {/* Current Active Queue Patients */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Recent Patients in Queue
          </h2>
          {queuePatients.length === 0 ? (
            <p className="text-xs text-slate-400">No patients currently in queue.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {queuePatients.map(pt => (
                <div
                  key={pt.appointment_id}
                  onClick={() => navigate(`/pro/patients/${pt.patient_id}`)}
                  className="p-3 rounded-xl border border-slate-200/80 hover:border-[#1565C0] hover:bg-blue-50/20 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{pt.patient_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {pt.registration_id} • Dr. {pt.doctor_name || 'Assigned'}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner label="Loading Patient 360° Overview..." />;
  }

  if (!overview) {
    return (
      <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-700">Patient overview not available</p>
        <Link to="/pro/queue" className="mt-3 inline-block text-xs text-[#1565C0] font-bold hover:underline">
          Return to Patient Queue
        </Link>
      </div>
    );
  }

  const { patient, consultation, prescription, financials, crm, treatment_plans, appointment } = overview;
  const isReadyForHandoff = checklist?.ready_for_pro_completion;

  // Compute operational stage
  const apptStatus = appointment?.appointment_status || appointment?.status || 'booked';
  const consultStatus = consultation?.consultation_status || 'pending';
  const isDoctorDone = consultStatus === 'completed' || ['doctor_completed', 'pro_pending', 'pro_completed', 'completed'].includes(apptStatus) || !!checklist?.doctor_consultation_completed;
  const isProDone = apptStatus === 'pro_completed' || apptStatus === 'completed';

  return (
    <div className="space-y-6">
      {/* Top Patient Demographics Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1565C0] to-[#0D47A1] text-white font-black text-xl flex items-center justify-center shadow-xs">
              {patient?.full_name?.charAt(0) || 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900">{patient?.full_name}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1565C0] border border-blue-200">
                  ID: #{patient?.patient_id}
                </span>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {patient?.registration_id}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span>{patient?.age ? `${patient.age} yrs` : 'Age N/A'}</span>
                <span>•</span>
                <span className="capitalize">{patient?.gender || 'Gender N/A'}</span>
                <span>•</span>
                <span>📞 {patient?.mobile_number || 'No phone'}</span>
                <span>•</span>
                <span>📍 {patient?.village || patient?.mandal || 'Location N/A'}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            {financials?.bills?.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedInvoiceId(financials.bills[0].bill_id);
                  setShowInvoiceModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition border border-slate-200/80 cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-[#1565C0]" />
                <span>View Invoice</span>
              </button>
            )}
            <Link
              to={`/pro/billing/new?patient_id=${patient.patient_id}${consultation?.doctor_id ? `&doctor_id=${consultation.doctor_id}` : ''}`}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1565C0] rounded-xl font-bold text-xs transition border border-blue-200/60"
            >
              Create Bill
            </Link>
            <button
              onClick={handleCompletePRO}
              disabled={completing}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs shadow-xs transition ${
                isReadyForHandoff
                  ? 'btn-brand-gradient text-white shadow-red-500/20'
                  : 'bg-[#1565C0] hover:bg-[#0D47A1] text-white'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{completing ? 'Completing...' : 'Complete PRO Handoff'}</span>
            </button>
          </div>
        </div>

        {/* Operational Workflow Stage Pipeline */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Patient Workflow Stage:</span>
            {isProDone ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span>PRO Completed · Released to Pharmacy</span>
              </span>
            ) : isDoctorDone ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#1565C0] border border-blue-200">
                <Clock className="w-3 h-3 text-[#1565C0] animate-pulse" />
                <span>Doctor Completed · Ready for PRO</span>
              </span>
            ) : apptStatus === 'in_consultation' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Stethoscope className="w-3 h-3 text-amber-700" />
                <span>In Consultation with Doctor</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <User className="w-3 h-3 text-slate-500" />
                <span>Reception Check-in (Fee Paid)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 overflow-x-auto w-full sm:w-auto py-0.5">
            <span className="flex items-center gap-1 text-emerald-700 font-bold whitespace-nowrap">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span>1. Reception</span>
            </span>
            <span>→</span>
            <span className={`flex items-center gap-1 whitespace-nowrap ${isDoctorDone ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>
              {isDoctorDone ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3" />}
              <span>2. Doctor</span>
            </span>
            <span>→</span>
            <span className={`flex items-center gap-1 whitespace-nowrap ${isProDone ? 'text-emerald-700 font-bold' : isDoctorDone ? 'text-[#1565C0] font-bold' : 'text-slate-400'}`}>
              {isProDone ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-[#1565C0]" />}
              <span>3. PRO (Review &amp; Billing)</span>
            </span>
            <span>→</span>
            <span className={`flex items-center gap-1 whitespace-nowrap ${isProDone ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
              <span>4. Pharmacy</span>
            </span>
          </div>
        </div>
      </div>

      {/* Prominent Doctor PRO Instructions Alert Banner */}
      {consultation?.pro_required && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-amber-900 text-xs uppercase tracking-wide">
                Special Doctor Attention Flagged for PRO
              </span>
              {consultation.pro_priority && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  consultation.pro_priority === 'high' || consultation.pro_priority === 'urgent'
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  Priority: {consultation.pro_priority}
                </span>
              )}
            </div>
            <p className="text-xs text-amber-800 mt-1 font-medium">
              {consultation.pro_instructions || consultation.pro_reason || 'Special patient attention needed according to consulting doctor.'}
            </p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-1">
        {[
          { id: 'clinical', label: 'Doctor Clinical Info', icon: Stethoscope },
          { id: 'prescription', label: `Prescription (${prescription?.items?.length || 0})`, icon: Pill },
          { id: 'packages', label: `Treatment Plans & Packages (${(treatment_plans?.length || 0) + (crm?.packages?.length || 0)})`, icon: Package },
          { id: 'financials', label: `Billing & Dues (${financials?.bills?.length || 0})`, icon: Receipt },
          { id: 'history', label: 'Patient Journey & History', icon: History },
          { id: 'crm', label: 'CRM & Calls', icon: PhoneCall },
          { id: 'checklist', label: 'Completion Checklist', icon: CheckCircle },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#D32F2F] text-white shadow-xs shadow-red-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: Clinical Info */}
      {activeTab === 'clinical' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-emerald-600" />
              <span>Doctor Consultation Details</span>
            </h2>
            <div className="text-xs text-slate-500">
              Assigned Doctor: <strong className="text-slate-800">{consultation?.doctor_name || 'Doctor'}</strong>
            </div>
          </div>

          {!consultation ? (
            <p className="text-xs text-slate-400 py-4 text-center">No consultation record found for this patient.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Chief Complaint</span>
                <p className="text-slate-900 font-medium">{consultation.chief_complaint || 'Not recorded'}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Primary Diagnosis</span>
                <p className="text-slate-900 font-bold text-[#1565C0]">
                  {consultation.primary_diagnosis_text || 'None'}
                </p>
                {consultation.secondary_diagnosis_text && (
                  <p className="text-slate-500 text-[11px]">
                    Secondary: {consultation.secondary_diagnosis_text}
                  </p>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Symptoms</span>
                <p className="text-slate-800">{consultation.symptoms || 'None recorded'}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Follow-up Recommendation</span>
                <p className="text-slate-800">
                  {consultation.followup_recommended ? (
                    <span className="font-bold text-emerald-700">
                      Recommended: {consultation.followup_recommended_date ? new Date(consultation.followup_recommended_date).toLocaleDateString() : 'Yes'}
                    </span>
                  ) : (
                    'None'
                  )}
                </p>
                {consultation.followup_instructions && (
                  <p className="text-slate-500 text-[11px]">{consultation.followup_instructions}</p>
                )}
              </div>

              {consultation.pro_required && (
                <div className="md:col-span-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <span className="font-bold text-amber-800 uppercase text-[10px]">Special PRO Instructions from Doctor</span>
                  <p className="text-amber-900 font-medium">{consultation.pro_instructions || consultation.pro_reason || 'Special patient attention needed'}</p>
                </div>
              )}
            </div>
          )}

          <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl flex items-center gap-1.5 border border-slate-100">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            <span>Note: Doctor clinical internal notes are strictly confidential and protected by ERP RBAC.</span>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: Prescription Review & Modifications */}
      {activeTab === 'prescription' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#1565C0] flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#1565C0]" />
              <span>Doctor Prescription Review</span>
            </h2>
            {prescription?.prescription_id && (
              <Link
                to={`/pro/prescriptions/${prescription.prescription_id}`}
                className="text-xs text-[#1565C0] font-bold hover:underline flex items-center gap-1"
              >
                <span>Full Prescription Editor</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          {!prescription || !prescription.items || prescription.items.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No prescription items recorded.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {prescription.items.map(item => (
                <div key={item.id} className="p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{item.medicine_name || `Medicine #${item.medicine_id}`}</div>
                    <div className="text-[11px] text-slate-500">
                      Dosage: {item.dosage || '1 tab'} • Frequency: {item.frequency || '1/day'} • Route: {item.route || 'oral'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="font-bold text-[#1565C0]">{item.duration_days || 5} Days</div>
                      <div className="text-[10px] text-slate-400">Qty: {item.quantity || 1}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: Treatment Plans & Packages */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          {/* Section A: Prescribed Treatment Plans from Doctor */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[#1565C0] flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[#1565C0]" />
                <span>Doctor Prescribed Treatment Plans ({treatment_plans?.length || 0})</span>
              </h2>
            </div>

            {!treatment_plans || treatment_plans.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No treatment plans recorded by doctor for this patient.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {treatment_plans.map(tp => (
                  <div key={tp.treatment_id} className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-black text-slate-900 text-sm">{tp.treatment_name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1565C0] border border-blue-200 uppercase">
                        {tp.treatment_type || 'Treatment'}
                      </span>
                    </div>
                    <div className="text-slate-600 text-[11px] font-medium">
                      Duration: <strong>{tp.duration || 'N/A'} {tp.duration_unit || 'days'}</strong>
                    </div>
                    {tp.instructions && (
                      <p className="text-slate-500 text-[11px] italic bg-white/80 p-2 rounded-lg border border-slate-100">
                        Instructions: {tp.instructions}
                      </p>
                    )}
                    <div className="pt-2 border-t border-blue-100/60 flex justify-end">
                      <Link
                        to={`/pro/billing/new?patient_id=${patient.patient_id}&doctor_id=${tp.doctor_id || consultation?.doctor_id || ''}&treatment_name=${encodeURIComponent(tp.treatment_name)}&treatment_type=${encodeURIComponent(tp.treatment_type || 'Treatment')}`}
                        className="px-3 py-1.5 btn-brand-gradient text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Create Bill for this Treatment</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Enrolled CRM Packages */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[#1565C0] flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1565C0]" />
                <span>Enrolled Packages ({crm?.packages?.length || 0})</span>
              </h2>
              <Link
                to="/pro/packages"
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-[#1565C0] hover:bg-blue-100 rounded-xl text-xs font-bold transition border border-blue-200/60"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Enroll Package</span>
              </Link>
            </div>

            {!crm?.packages || crm.packages.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No package enrolled for this patient yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {crm.packages.map(pkg => (
                  <div key={pkg.package_id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900">{pkg.package_name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1565C0] border border-blue-200/60 capitalize">
                        {pkg.status}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {pkg.package_type?.toUpperCase()} • {pkg.from_date} to {pkg.to_date}
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold">
                      <span className="text-slate-600">Final Amount:</span>
                      <span className="text-[#D32F2F]">{formatCurrency(pkg.final_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: Financials & Dues */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          {/* SECTION 1: PRO Responsibility — Treatment & Package Invoicing */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#D32F2F]" />
                  <span>Action Required: Treatment &amp; Package Billing</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1565C0] border border-blue-200">
                    PRO Responsibility
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate invoices &amp; record payments for Doctor-prescribed treatments, therapy packages, and authorized clinic procedures.
                </p>
              </div>
              <Link
                to={`/pro/billing/new?patient_id=${patient.patient_id}${consultation?.doctor_id ? `&doctor_id=${consultation.doctor_id}` : ''}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 btn-brand-gradient rounded-xl text-xs font-bold text-white transition shadow-xs shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Treatment Bill</span>
              </Link>
            </div>

            {/* Unbilled Treatment Plans Notification Callout */}
            {treatment_plans && treatment_plans.length > 0 && (
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-[#1565C0] flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>Doctor Prescribed Treatments Awaiting Invoicing ({treatment_plans.length})</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {treatment_plans.map(tp => (
                    <div key={tp.treatment_id} className="p-2.5 bg-white rounded-lg border border-blue-100 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{tp.treatment_name}</div>
                        <div className="text-[10px] text-slate-500">Duration: {tp.duration || 'N/A'} {tp.duration_unit || 'days'}</div>
                      </div>
                      <Link
                        to={`/pro/billing/new?patient_id=${patient.patient_id}&doctor_id=${tp.doctor_id || consultation?.doctor_id || ''}&treatment_name=${encodeURIComponent(tp.treatment_name)}&treatment_type=${encodeURIComponent(tp.treatment_type || 'Treatment')}`}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#1565C0] rounded-lg text-[11px] font-bold transition border border-blue-200 shrink-0"
                      >
                        + Bill Treatment
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active PRO Treatment & Package Bills */}
            {(() => {
              const proBills = (financials?.bills || []).filter(b => b.bill_type !== 'consultation');
              if (proBills.length === 0) {
                return (
                  <div className="p-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-1">
                    <Receipt className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No Treatment or Package Invoices Created Yet</p>
                    <p className="text-[11px] text-slate-400">
                      Use the &ldquo;New Treatment Bill&rdquo; button above or select a prescribed treatment plan to generate a bill.
                    </p>
                  </div>
                );
              }

              return (
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Bill Number</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Paid</th>
                        <th className="py-2.5 px-3 text-right">Due Balance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proBills.map(b => {
                        const total = parseFloat(b.final_amount || 0);
                        const paid = parseFloat(b.paid_amount || 0);
                        const due = Math.max(0, total - paid);
                        const isPaid = due <= 0 || b.payment_status === 'paid';

                        return (
                          <tr key={b.bill_id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">{b.bill_number}</td>
                            <td className="py-3 px-3 capitalize">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {b.bill_type}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">{formatCurrency(total)}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">{formatCurrency(paid)}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-red-600">{formatCurrency(due)}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : paid > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {isPaid ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedInvoiceId(b.bill_id);
                                    setShowInvoiceModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer border border-slate-200"
                                  title="View Itemized Invoice"
                                >
                                  <Receipt className="w-3 h-3 text-[#1565C0]" />
                                  <span>Invoice</span>
                                </button>
                                {!isPaid ? (
                                  <Link
                                    to={`/pro/payments?bill_id=${b.bill_id}&amount=${due}`}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                                  >
                                    Collect Payment
                                  </Link>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold px-1.5">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Settled</span>
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* SECTION 2: Historical & Completed Invoices (Receptionist Consultation Fee & Settled Records) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Historical &amp; Completed Invoices</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Read-Only Reference
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consultation fees are collected at Reception during patient check-in. These records are read-only for PRO.
                </p>
              </div>
            </div>

            {(() => {
              const consultBills = (financials?.bills || []).filter(b => b.bill_type === 'consultation');
              if (consultBills.length === 0) {
                return (
                  <p className="text-xs text-slate-400 py-3 text-center">No consultation or receptionist invoices recorded.</p>
                );
              }

              return (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {consultBills.map(b => (
                    <div key={b.bill_id} className="p-3.5 flex items-center justify-between flex-wrap gap-3 text-xs bg-slate-50/40 hover:bg-slate-50 transition">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{b.bill_number}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                            Consultation Fee
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Paid at Reception</span>
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Handled by: <strong className="text-slate-700">{b.created_by_name || 'Receptionist'}</strong> ({b.created_by_role || 'receptionist'})
                          {b.created_at && ` • ${new Date(b.created_at).toLocaleDateString()}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Settled Amount</span>
                          <span className="font-mono font-black text-slate-900 text-sm">{formatCurrency(b.final_amount)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoiceId(b.bill_id);
                            setShowInvoiceModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-200"
                        >
                          <Receipt className="w-3 h-3 text-[#1565C0]" />
                          <span>View Invoice</span>
                        </button>
                        <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200/80">
                          Reception (Read-Only)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: Patient Journey & Complete History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-[#1565C0]" />
                <span>Patient Journey &amp; Operational History</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete longitudinal timeline of appointments, doctor consultations, prescriptions, and pharmacy status.
              </p>
            </div>
          </div>

          {/* Stepper Pipeline */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
            <h3 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">
              Cross-Department Care Pipeline
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-900 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-700">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1. Reception</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  Registration &amp; consultation fee paid
                </div>
              </div>

              <div className={`p-2.5 rounded-xl bg-white border shadow-2xs ${
                isDoctorDone ? 'border-emerald-200 text-emerald-900' : 'border-amber-200 text-amber-900'
              }`}>
                <div className={`flex items-center gap-1.5 font-bold text-[11px] ${
                  isDoctorDone ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {isDoctorDone ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>2. Doctor Consultation</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  {consultation?.doctor_name ? `Dr. ${consultation.doctor_name}` : 'Clinical Consultation'}
                </div>
              </div>

              <div className={`p-2.5 rounded-xl bg-white border shadow-2xs ${
                financials?.bills?.some(b => b.bill_type !== 'consultation')
                  ? 'border-emerald-200 text-emerald-900'
                  : 'border-blue-200 text-blue-900'
              }`}>
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-[#1565C0]">
                  {financials?.bills?.some(b => b.bill_type !== 'consultation') ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Receipt className="w-3.5 h-3.5" />
                  )}
                  <span>3. PRO Billing &amp; Dues</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  Treatment / package invoicing
                </div>
              </div>

              <div className={`p-2.5 rounded-xl bg-white border shadow-2xs ${
                isProDone ? 'border-emerald-200 text-emerald-900' : 'border-slate-200 text-slate-600'
              }`}>
                <div className={`flex items-center gap-1.5 font-bold text-[11px] ${
                  isProDone ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  {isProDone ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Pill className="w-3.5 h-3.5" />}
                  <span>4. Pharmacy Dispensing</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  {isProDone ? 'Unlocked for Dispensing' : 'Awaiting PRO release'}
                </div>
              </div>
            </div>
          </div>

          {/* Past Consultations History */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              <span>Doctor Consultations History ({overview?.history?.consultations?.length || 0})</span>
            </h3>
            {(!overview?.history?.consultations || overview.history.consultations.length === 0) ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">No past consultations on record.</p>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {overview.history.consultations.map(c => (
                  <div key={c.consultation_id} className="p-3.5 hover:bg-slate-50/60 transition flex flex-col sm:flex-row justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900">Dr. {c.doctor_name || 'Consultant'}</strong>
                        {c.created_at && (
                          <span className="text-[11px] text-slate-500">
                            • {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                          {c.status || 'completed'}
                        </span>
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        <strong>Complaint:</strong> {c.chief_complaint || 'None recorded'}
                      </div>
                      <div className="text-[#1565C0] font-bold text-[11px]">
                        <strong>Diagnosis:</strong> {c.primary_diagnosis_text || 'None'}
                      </div>
                    </div>
                    {c.followup_recommended && (
                      <div className="text-right text-[11px] text-emerald-700 font-semibold shrink-0">
                        Follow-up: {c.followup_recommended_date ? new Date(c.followup_recommended_date).toLocaleDateString() : 'Yes'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Prescriptions History */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-[#1565C0]" />
              <span>Prescription Records ({overview?.history?.prescriptions?.length || 0})</span>
            </h3>
            {(!overview?.history?.prescriptions || overview.history.prescriptions.length === 0) ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">No past prescriptions on record.</p>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {overview.history.prescriptions.map(rx => (
                  <div key={rx.prescription_id} className="p-3.5 hover:bg-slate-50/60 transition space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">Rx #{rx.prescription_id}</span>
                        {rx.created_at && (
                          <span className="text-[11px] text-slate-500">
                            • {new Date(rx.created_at).toLocaleDateString()}
                          </span>
                        )}
                        {rx.doctor_name && (
                          <span className="text-[11px] text-slate-600 font-medium">
                            by Dr. {rx.doctor_name}
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        rx.pharmacy_status === 'dispensed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rx.pharmacy_status === 'partial'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-[#1565C0]'
                      }`}>
                        Pharmacy: {rx.pharmacy_status || 'Pending'}
                      </span>
                    </div>

                    {rx.items && rx.items.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                        {rx.items.map(it => (
                          <div key={it.id} className="flex items-center justify-between text-[11px] text-slate-700">
                            <span>
                              <strong>{it.medicine_name || `Medicine #${it.medicine_id}`}</strong> — {it.dosage || '1 tab'}, {it.frequency || '1/day'}, {it.duration_days || 5} days
                            </span>
                            <span className="font-mono text-slate-500">
                              Qty: {it.quantity || 1} {it.dispense_status ? `(${it.dispense_status})` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Appointments */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Appointments Log ({overview?.history?.appointments?.length || 0})</span>
            </h3>
            {(!overview?.history?.appointments || overview.history.appointments.length === 0) ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">No appointments on record.</p>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {overview.history.appointments.map(a => (
                  <div key={a.appointment_id} className="p-3 flex items-center justify-between flex-wrap gap-2 hover:bg-slate-50/60 transition">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">Appt #{a.appointment_id}</span>
                      <span className="text-[11px] text-slate-500">
                        {a.appointment_date ? new Date(a.appointment_date).toLocaleDateString() : ''} {a.appointment_time || ''}
                      </span>
                      {a.doctor_name && (
                        <span className="text-[11px] text-slate-700 font-medium">
                          with Dr. {a.doctor_name}
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: CRM & Calls */}
      {activeTab === 'crm' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-600" />
              <span>CRM History & Follow-ups</span>
            </h2>
            <Link
              to={`/pro/crm/calls?patient_id=${patient.patient_id}`}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Log Call Outcome
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-100 rounded-xl p-3 space-y-2">
              <span className="font-bold text-slate-700 block">Calls History ({crm?.calls?.length || 0})</span>
              {crm?.calls?.length === 0 ? (
                <p className="text-slate-400 text-[11px]">No call records.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {crm.calls.map(c => (
                    <div key={c.call_id} className="p-2 bg-slate-50 rounded-lg text-[11px]">
                      <div className="flex justify-between font-bold">
                        <span className="capitalize">{c.interaction_type} • {c.call_purpose?.replace('_', ' ')}</span>
                        <span className="text-blue-700 capitalize">{c.call_status?.replace('_', ' ')}</span>
                      </div>
                      {c.remarks && <p className="text-slate-500 mt-0.5">{c.remarks}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-slate-100 rounded-xl p-3 space-y-2">
              <span className="font-bold text-slate-700 block">Follow-up Tasks ({crm?.followups?.length || 0})</span>
              {crm?.followups?.length === 0 ? (
                <p className="text-slate-400 text-[11px]">No follow-up tasks.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {crm.followups.map(f => (
                    <div key={f.id} className="p-2 bg-slate-50 rounded-lg text-[11px] flex justify-between">
                      <div>
                        <span className="font-bold capitalize">{f.category}</span>
                        <div className="text-slate-400 text-[10px]">Due: {f.due_date}</div>
                      </div>
                      <span className="font-bold text-amber-700 uppercase text-[10px]">{f.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 7: Checklist & Handoff */}
      {activeTab === 'checklist' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>PRO Patient Completion Checklist</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All mandatory checklist gates must be verified before releasing the patient to Pharmacy
              </p>
            </div>
            <button
              onClick={handleCompletePRO}
              disabled={completing}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                isReadyForHandoff ? 'btn-brand-gradient' : 'bg-[#1565C0] hover:bg-[#0D47A1]'
              }`}
            >
              {completing ? 'Releasing...' : 'Complete PRO & Release to Pharmacy'}
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              {
                key: 'doctor_consultation_completed',
                label: 'Doctor Consultation Completed',
                subtitle: checklist?.metadata?.doctor_name
                  ? `Consulting: Dr. ${checklist.metadata.doctor_name}`
                  : consultation?.doctor_name
                  ? `Consulting: Dr. ${consultation.doctor_name}`
                  : 'Assigned Consulting Doctor'
              },
              {
                key: 'diagnosis_reviewed',
                label: 'Clinical Diagnosis Reviewed',
                subtitle: checklist?.metadata?.primary_diagnosis
                  ? `Diagnosis: ${checklist.metadata.primary_diagnosis}`
                  : consultation?.primary_diagnosis_text
                  ? `Diagnosis: ${consultation.primary_diagnosis_text}`
                  : 'Clinical diagnosis confirmed'
              },
              {
                key: 'prescription_reviewed',
                label: 'Prescription Item Details Reviewed',
                subtitle: checklist?.metadata?.prescription_id
                  ? `Prescription #${checklist.metadata.prescription_id} (${checklist.metadata.prescription_items_count || 0} items)`
                  : prescription?.prescription_id
                  ? `Prescription #${prescription.prescription_id} (${prescription.items?.length || 0} items)`
                  : 'Prescription item review'
              },
              {
                key: 'treatment_package_confirmed',
                label: 'Treatment / Package Details Confirmed',
                subtitle: `${(checklist?.metadata?.treatment_plans_count || treatment_plans?.length || 0)} Treatment Plan(s) / ${(checklist?.metadata?.packages_count || crm?.packages?.length || 0)} Package(s)`
              },
              {
                key: 'billing_completed',
                label: 'Treatment / Package Invoice Generated',
                subtitle: checklist?.metadata?.bill_number
                  ? `Invoice #${checklist.metadata.bill_number} · Total: ${formatCurrency(checklist.metadata.bill_final_amount)}`
                  : proBills?.[0]?.bill_number
                  ? `Invoice #${proBills[0].bill_number} · Total: ${formatCurrency(proBills[0].final_amount)}`
                  : 'Treatment billing generated'
              },
              {
                key: 'payment_or_due_recorded',
                label: 'Payment or Outstanding Due Recorded',
                subtitle: checklist?.metadata?.bill_number
                  ? `Recorded: ${formatCurrency(checklist.metadata.payment_amount)} paid / ${formatCurrency(checklist.metadata.due_amount)} balance due`
                  : proBills?.[0]
                  ? `Recorded: ${formatCurrency(proBills[0].paid_amount)} paid / ${formatCurrency(Math.max(0, proBills[0].final_amount - proBills[0].paid_amount))} balance due`
                  : 'Payment or due recorded'
              },
            ].map(item => {
              const ok = checklist?.checklist?.[item.key];
              return (
                <div
                  key={item.key}
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    ok
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50/60 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {ok ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-slate-900">{item.label}</div>
                      <div className={`text-[11px] mt-0.5 ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                    ok ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {ok ? 'COMPLETED' : 'PENDING'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Global Invoice / Receipt Modal */}
      <PROInvoiceModal
        billId={selectedInvoiceId}
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedInvoiceId(null);
        }}
      />
    </div>
  );
};
