import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doctorApi, pharmacyApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { MedicineSelector } from '../../components/doctor/MedicineSelector';
import { useToast } from '../../context/ToastContext';
import {
  Stethoscope, Save, CheckCircle, ChevronRight, ChevronLeft, Plus, Trash2,
  Search, User, Activity, FileText, Pill, ClipboardList, RefreshCw, AlertCircle,
  HeartPulse
} from 'lucide-react';

const TABS = [
  { id: 'history', label: 'Patient History', icon: FileText },
  { id: 'vitals', label: 'Vitals', icon: Activity },
  { id: 'complaint', label: 'Chief Complaint', icon: AlertCircle },
  { id: 'examination', label: 'Examination', icon: Stethoscope },
  { id: 'diagnosis', label: 'Diagnosis', icon: ClipboardList },
  { id: 'prescription', label: 'Prescription', icon: Pill },
  { id: 'treatment', label: 'Treatment Plan', icon: HeartPulse },
  { id: 'summary', label: 'Summary & Complete', icon: CheckCircle },
];

const Field = ({ label, children, required }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-700">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Input = ({ ...props }) => (
  <input
    {...props}
    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
  />
);

const Textarea = ({ rows = 3, ...props }) => (
  <textarea
    rows={rows}
    {...props}
    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition resize-none"
  />
);

const Select = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition bg-white"
  >
    {children}
  </select>
);

export const ConsultationPage = () => {
  const { id: consultId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('history');
  const [consult, setConsult] = useState(null);
  const [patient, setPatient] = useState(location.state?.patient || null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    // History
    present_illness: '', previous_medical_history: '', previous_treatment_history: '',
    surgical_history: '', family_history: '', current_medications: '', other_history: '',
    allergy_status: 'none', allergies: [],
    // Vitals
    height_cm: '', weight_kg: '', temperature: '', pulse_rate: '',
    bp_systolic: '', bp_diastolic: '', respiratory_rate: '', spo2: '',
    // Complaint
    chief_complaint: '', complaint_duration: '', complaint_severity: '',
    complaint_onset: '', associated_symptoms: [], symptoms: '', symptom_progression: '',
    // Examination
    general_examination: '', physical_examination: '', system_examination: '',
    local_examination: '', other_findings: '',
    // Diagnosis
    primary_diagnosis_id: '', primary_diagnosis_text: '',
    secondary_diagnosis_text: '', diagnosis_description: '', diagnosis_notes: '',
    investigations: [],
    // Follow-up / PRO
    followup_recommended: false, followup_recommended_date: '', followup_instructions: '',
    pro_required: false, pro_reason: '', pro_priority: 'normal', pro_instructions: '',
    doctor_notes: '',
  });

  // Prescription state
  const [prescriptionMeds, setPrescriptionMeds] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  // Treatment plan state
  const [treatmentForm, setTreatmentForm] = useState({
    treatment_name: '', treatment_type: 'homeopathy', start_date: new Date().toISOString().split('T')[0],
    duration: '', duration_unit: 'days', frequency: '', instructions: '', treatment_notes: ''
  });
  const [treatments, setTreatments] = useState([]);

  // Diagnosis search
  const [diagSearch, setDiagSearch] = useState('');
  const [diagResults, setDiagResults] = useState([]);

  // Summary
  const [summary, setSummary] = useState(null);

  // Load consultation
  const loadConsultation = useCallback(async () => {
    setLoading(true);
    try {
      const consultRes = await doctorApi.getConsultationDetails(consultId);
      if (consultRes.success) {
        const c = consultRes.data;
        setConsult(c);
        if (!patient) setPatient({ patient_id: c.patient_id, patient_name: c.patient_name });
        setForm(prev => ({
          ...prev,
          present_illness: c.present_illness || '',
          previous_medical_history: c.previous_medical_history || '',
          previous_treatment_history: c.previous_treatment_history || '',
          surgical_history: c.surgical_history || '',
          family_history: c.family_history || '',
          current_medications: c.current_medications || '',
          other_history: c.other_history || '',
          allergy_status: c.allergy_status || 'none',
          allergies: c.allergies || [],
          height_cm: c.height_cm || '',
          weight_kg: c.weight_kg || '',
          temperature: c.temperature || '',
          pulse_rate: c.pulse_rate || '',
          bp_systolic: c.bp_systolic || '',
          bp_diastolic: c.bp_diastolic || '',
          respiratory_rate: c.respiratory_rate || '',
          spo2: c.spo2 || '',
          chief_complaint: c.chief_complaint || '',
          complaint_duration: c.complaint_duration || '',
          complaint_severity: c.complaint_severity || '',
          complaint_onset: c.complaint_onset || '',
          associated_symptoms: c.associated_symptoms || [],
          symptoms: c.symptoms || '',
          symptom_progression: c.symptom_progression || '',
          general_examination: c.general_examination || '',
          physical_examination: c.physical_examination || '',
          system_examination: c.system_examination || '',
          local_examination: c.local_examination || '',
          other_findings: c.other_findings || '',
          primary_diagnosis_id: c.primary_diagnosis_id || '',
          primary_diagnosis_text: c.primary_diagnosis_text || '',
          secondary_diagnosis_text: c.secondary_diagnosis_text || '',
          diagnosis_description: c.diagnosis_description || '',
          diagnosis_notes: c.diagnosis_notes || '',
          investigations: c.investigations || [],
          followup_recommended: c.followup_recommended || false,
          followup_recommended_date: c.followup_recommended_date ? c.followup_recommended_date.split('T')[0] : '',
          followup_instructions: c.followup_instructions || '',
          pro_required: c.pro_required || false,
          pro_reason: c.pro_reason || '',
          pro_priority: c.pro_priority || 'normal',
          pro_instructions: c.pro_instructions || '',
          doctor_notes: c.doctor_notes || '',
        }));

        // Attach existing prescriptions and treatment plans for this consultation
        if (c.prescriptions && c.prescriptions.length > 0) {
          const allMeds = c.prescriptions.flatMap(p => p.medicines || []);
          setPrescriptionMeds(allMeds);
        }
        if (c.treatment_plans && c.treatment_plans.length > 0) {
          setTreatments(c.treatment_plans);
        }

        // Load patient overview
        if (c.patient_id) {
          const ovRes = await doctorApi.getPatientOverview(c.patient_id);
          if (ovRes.success) setOverview(ovRes.data);
        }
      }
    } catch (err) {
      showToast('Failed to load consultation', 'error');
    } finally {
      setLoading(false);
    }
  }, [consultId]);

  useEffect(() => { loadConsultation(); }, [loadConsultation]);

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async (advanceNext = false) => {
    setSaving(true);
    try {
      // Update clinical data first
      await doctorApi.updateConsultation(consultId, form);
      // Then save draft
      await doctorApi.saveDraft(consultId);
      showToast(advanceNext ? 'Saved & continued' : 'Draft saved successfully', 'success');
      if (advanceNext && canGoNext) {
        setActiveTab(TABS[tabIdx + 1].id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!form.chief_complaint) {
      showToast('Chief complaint is required to complete consultation', 'error');
      setActiveTab('complaint');
      return;
    }
    if (!form.primary_diagnosis_text && !form.primary_diagnosis_id) {
      showToast('Primary diagnosis is required to complete consultation', 'error');
      setActiveTab('diagnosis');
      return;
    }

    setCompleting(true);
    try {
      // Final data update
      await doctorApi.updateConsultation(consultId, form);
      // Complete
      const res = await doctorApi.completeConsultation({ consultation_id: parseInt(consultId) });
      if (res.success) {
        showToast('Consultation completed! Patient moved to PRO queue.', 'success');
        navigate('/doctor/queue');
      }
    } catch (err) {
      showToast(err.message || 'Failed to complete consultation', 'error');
    } finally {
      setCompleting(false);
    }
  };

  // Diagnosis search
  const handleDiagSearch = async (val) => {
    setDiagSearch(val);
    if (val.length < 2) { setDiagResults([]); return; }
    try {
      const res = await doctorApi.searchDiagnoses(val);
      if (res.success) setDiagResults(res.data || []);
    } catch {}
  };

  // Handle adding selected medicine from Search + Dropdown selector to prescription
  const handleAddSelectedMedicine = (medToUse = null) => {
    const med = medToUse || selectedMedicine;
    if (!med) {
      showToast('Please select a medicine from the dropdown first', 'error');
      return;
    }

    const alreadyAdded = prescriptionMeds.some(m => m.medicine_id === med.id);
    if (alreadyAdded) {
      showToast(`${med.medicine_name} is already added to this prescription`, 'error');
      return;
    }

    setPrescriptionMeds(prev => [...prev, {
      medicine_id: med.id,
      medicine_name: med.medicine_name,
      dosage: '1 tab',
      frequency: '3 times/day',
      route: 'oral',
      duration_days: 7,
      quantity: 21
    }]);

    showToast(`Added ${med.medicine_name} to prescription`, 'success');
    setSelectedMedicine(null);
  };

  const updateMed = (idx, field, val) => {
    setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };

  const removeMed = (idx) => {
    setPrescriptionMeds(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSavePrescription = async () => {
    if (saving) return;
    if (prescriptionMeds.length === 0) { showToast('Add at least one medicine', 'error'); return; }
    setSaving(true);
    try {
      const res = await doctorApi.createPrescription({
        consultation_id: parseInt(consultId),
        medicines: prescriptionMeds
      });
      if (res.success) showToast('Prescription saved!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save prescription', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTreatment = async () => {
    if (saving) return;
    if (!treatmentForm.treatment_name || !treatmentForm.duration) {
      showToast('Treatment name and duration are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await doctorApi.createTreatmentPlan({
        consultation_id: parseInt(consultId),
        ...treatmentForm
      });
      if (res.success) {
        setTreatments(prev => [...prev, res.data]);
        showToast('Treatment plan saved!', 'success');
        setTreatmentForm(t => ({ ...t, treatment_name: '', duration: '', instructions: '', treatment_notes: '' }));
      }
    } catch (err) {
      showToast(err.message || 'Failed to save treatment plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadSummary = async () => {
    try {
      await doctorApi.updateConsultation(consultId, form).catch(() => {});
      const res = await doctorApi.getConsultationSummary(consultId);
      if (res.success) setSummary(res.data.summary);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'summary') loadSummary();
  }, [activeTab]);

  if (loading) return <LoadingSpinner label="Loading consultation..." />;
  if (!consult) return <div className="text-center py-12 text-slate-500">Consultation not found.</div>;

  const isCompleted = consult.status === 'completed';

  const tabIdx = TABS.findIndex(t => t.id === activeTab);
  const canGoNext = tabIdx < TABS.length - 1;
  const canGoPrev = tabIdx > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-emerald-600" />
              Consultation #{consultId}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {consult.patient_name}
              </span>
              <span>•</span>
              <span>{overview?.patient?.registration_id || 'Loading...'}</span>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleSaveDraft(false)}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isCompleted ? 'Save Changes' : 'Save Draft'}
            </button>
            {!isCompleted && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {completing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Complete Consultation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Completed Status Notice */}
      {isCompleted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2.5 text-xs text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Completed Consultation:</strong> This consultation has been completed and handed off to PRO/Pharmacy. Clinical records, prescriptions, and treatment plans remain fully editable below.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold text-[10px] uppercase shrink-0">Editable</span>
        </div>
      )}

      {/* Patient quick info bar */}
      {overview?.patient && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-6 text-xs text-emerald-800 flex-wrap">
          <span><strong>Age:</strong> {overview.patient.age}y</span>
          <span><strong>Gender:</strong> {overview.patient.gender}</span>
          <span><strong>Mobile:</strong> {overview.patient.mobile_number}</span>
          <span><strong>Village:</strong> {overview.patient.village}</span>
          {overview.patient.blood_group && <span><strong>Blood Group:</strong> {overview.patient.blood_group}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Tab Nav */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Consultation Sections</h3>
            </div>
            <nav className="p-2 space-y-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    activeTab === tab.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5 shrink-0" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            {/* ===== PATIENT HISTORY TAB ===== */}
            {activeTab === 'history' && (
              <div className="space-y-5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> Patient History
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Present Illness / History of Present Complaint">
                    <Textarea value={form.present_illness} onChange={e => handleFormChange('present_illness', e.target.value)} placeholder="Detailed description..." rows={3} />
                  </Field>
                  <Field label="Previous Medical History">
                    <Textarea value={form.previous_medical_history} onChange={e => handleFormChange('previous_medical_history', e.target.value)} placeholder="Past illnesses, hospitalizations..." rows={3} />
                  </Field>
                  <Field label="Previous Treatment History">
                    <Textarea value={form.previous_treatment_history} onChange={e => handleFormChange('previous_treatment_history', e.target.value)} placeholder="Previous treatments taken..." rows={3} />
                  </Field>
                  <Field label="Surgical History">
                    <Textarea value={form.surgical_history} onChange={e => handleFormChange('surgical_history', e.target.value)} placeholder="Past surgeries..." rows={3} />
                  </Field>
                  <Field label="Family History">
                    <Textarea value={form.family_history} onChange={e => handleFormChange('family_history', e.target.value)} placeholder="Family medical history..." rows={3} />
                  </Field>
                  <Field label="Current Medications">
                    <Textarea value={form.current_medications} onChange={e => handleFormChange('current_medications', e.target.value)} placeholder="Medicines currently taking..." rows={3} />
                  </Field>
                </div>
                <Field label="Allergy Status">
                  {/*
                    IMPORTANT: allergy_status is a PostgreSQL enum (allergy_status_type)
                    with exactly two values: 'none' and 'known'.
                    Do NOT send any other value — it causes a 500 Internal Server Error.
                    Allergy type detail (medicine/food/environmental) goes into allergies[] array.
                  */}
                  <Select value={form.allergy_status} onChange={e => handleFormChange('allergy_status', e.target.value)}>
                    <option value="none">No Known Allergies</option>
                    <option value="known">Known Allergy</option>
                  </Select>
                </Field>
                {form.allergy_status === 'known' && (
                  <Field label="Allergy Details (type and specific allergens)">
                    <Input
                      value={form.allergies?.join(', ') || ''}
                      onChange={e => handleFormChange('allergies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="e.g. Medicine: Penicillin, Food: Peanuts, Environmental: Dust"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Separate multiple allergens with commas</p>
                  </Field>
                )}

                {/* Previous Consultations (from overview) */}
                {overview?.previous_consultations?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Previous Consultations</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {overview.previous_consultations.map(pc => (
                        <div key={pc.consultation_id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-800">{pc.primary_diagnosis_name || pc.primary_diagnosis_text || 'N/A'}</span>
                            <span className="text-slate-400">{new Date(pc.created_at).toLocaleDateString('en-IN')}</span>
                          </div>
                          <div className="text-slate-500 mt-0.5">Dr. {pc.doctor_name}</div>
                          {pc.chief_complaint && <div className="text-slate-400 mt-0.5 truncate">{pc.chief_complaint}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== VITALS TAB ===== */}
            {activeTab === 'vitals' && (
              <div className="space-y-5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" /> Vitals
                </h2>
                <p className="text-xs text-slate-500">BMI is automatically calculated server-side from height and weight.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Height (cm)">
                    <Input type="number" value={form.height_cm} onChange={e => handleFormChange('height_cm', e.target.value)} placeholder="e.g. 170" />
                  </Field>
                  <Field label="Weight (kg)">
                    <Input type="number" value={form.weight_kg} onChange={e => handleFormChange('weight_kg', e.target.value)} placeholder="e.g. 65" />
                  </Field>
                  <Field label="Temperature (°F)">
                    <Input type="number" value={form.temperature} onChange={e => handleFormChange('temperature', e.target.value)} placeholder="e.g. 98.6" />
                  </Field>
                  <Field label="Pulse Rate (bpm)">
                    <Input type="number" value={form.pulse_rate} onChange={e => handleFormChange('pulse_rate', e.target.value)} placeholder="e.g. 72" />
                  </Field>
                  <Field label="BP Systolic (mmHg)">
                    <Input type="number" value={form.bp_systolic} onChange={e => handleFormChange('bp_systolic', e.target.value)} placeholder="e.g. 120" />
                  </Field>
                  <Field label="BP Diastolic (mmHg)">
                    <Input type="number" value={form.bp_diastolic} onChange={e => handleFormChange('bp_diastolic', e.target.value)} placeholder="e.g. 80" />
                  </Field>
                  <Field label="Respiratory Rate (bpm)">
                    <Input type="number" value={form.respiratory_rate} onChange={e => handleFormChange('respiratory_rate', e.target.value)} placeholder="e.g. 16" />
                  </Field>
                  <Field label="SpO2 (%)">
                    <Input type="number" value={form.spo2} onChange={e => handleFormChange('spo2', e.target.value)} placeholder="e.g. 98" />
                  </Field>
                </div>
                {consult.bmi && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                    <span className="font-bold text-emerald-700">Calculated BMI: {consult.bmi}</span>
                  </div>
                )}
              </div>
            )}

            {/* ===== CHIEF COMPLAINT TAB ===== */}
            {activeTab === 'complaint' && (
              <div className="space-y-5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-emerald-600" /> Chief Complaint
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Chief Complaint" required>
                    <Textarea value={form.chief_complaint} onChange={e => handleFormChange('chief_complaint', e.target.value)} placeholder="Primary complaint in patient's own words..." rows={3} />
                  </Field>
                  <Field label="Duration of Complaint">
                    <Input value={form.complaint_duration} onChange={e => handleFormChange('complaint_duration', e.target.value)} placeholder="e.g. 3 days, 2 weeks" />
                  </Field>
                  <Field label="Severity (1-10)">
                    <Input type="number" min="1" max="10" value={form.complaint_severity} onChange={e => handleFormChange('complaint_severity', e.target.value)} placeholder="1 = mild, 10 = severe" />
                  </Field>
                  <Field label="Onset">
                    <Select value={form.complaint_onset} onChange={e => handleFormChange('complaint_onset', e.target.value)}>
                      <option value="">Select onset type</option>
                      <option value="sudden">Sudden</option>
                      <option value="gradual">Gradual</option>
                      <option value="chronic">Chronic</option>
                      <option value="intermittent">Intermittent</option>
                    </Select>
                  </Field>
                  <Field label="Symptoms">
                    <Textarea value={form.symptoms} onChange={e => handleFormChange('symptoms', e.target.value)} placeholder="Describe all symptoms in detail..." rows={4} />
                  </Field>
                  <Field label="Symptom Progression">
                    <Textarea value={form.symptom_progression} onChange={e => handleFormChange('symptom_progression', e.target.value)} placeholder="How symptoms have changed over time..." rows={4} />
                  </Field>
                </div>
              </div>
            )}

            {/* ===== EXAMINATION TAB ===== */}
            {activeTab === 'examination' && (
              <div className="space-y-5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-emerald-600" /> Clinical Examination
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="General Examination">
                    <Textarea value={form.general_examination} onChange={e => handleFormChange('general_examination', e.target.value)} placeholder="General appearance, consciousness..." rows={4} />
                  </Field>
                  <Field label="Physical Examination">
                    <Textarea value={form.physical_examination} onChange={e => handleFormChange('physical_examination', e.target.value)} placeholder="Head-to-toe physical findings..." rows={4} />
                  </Field>
                  <Field label="System Examination">
                    <Textarea value={form.system_examination} onChange={e => handleFormChange('system_examination', e.target.value)} placeholder="CVS, RS, GI, CNS findings..." rows={4} />
                  </Field>
                  <Field label="Local Examination">
                    <Textarea value={form.local_examination} onChange={e => handleFormChange('local_examination', e.target.value)} placeholder="Local site findings..." rows={4} />
                  </Field>
                  <Field label="Other Findings">
                    <Textarea value={form.other_findings} onChange={e => handleFormChange('other_findings', e.target.value)} placeholder="Any other clinical findings..." rows={4} />
                  </Field>
                </div>
              </div>
            )}

            {/* ===== DIAGNOSIS TAB ===== */}
            {activeTab === 'diagnosis' && (
              <div className="space-y-5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-600" /> Diagnosis
                </h2>
                {/* Primary Diagnosis Search */}
                <Field label="Primary Diagnosis" required>
                  <div className="relative">
                    <Input
                      value={diagSearch || form.primary_diagnosis_text}
                      onChange={e => {
                        setDiagSearch(e.target.value);
                        handleFormChange('primary_diagnosis_text', e.target.value);
                        handleDiagSearch(e.target.value);
                      }}
                      placeholder="Type to search diagnoses or enter manually..."
                    />
                    {diagResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {diagResults.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              handleFormChange('primary_diagnosis_id', d.id);
                              handleFormChange('primary_diagnosis_text', d.name);
                              setDiagSearch('');
                              setDiagResults([]);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-0"
                          >
                            <span className="font-semibold text-slate-800">{d.name}</span>
                            {d.category && <span className="ml-2 text-[10px] text-slate-400">({d.category})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Secondary Diagnosis">
                  <Input value={form.secondary_diagnosis_text} onChange={e => handleFormChange('secondary_diagnosis_text', e.target.value)} placeholder="Secondary/additional diagnosis..." />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Diagnosis Description">
                    <Textarea value={form.diagnosis_description} onChange={e => handleFormChange('diagnosis_description', e.target.value)} placeholder="Detailed diagnosis description..." />
                  </Field>
                  <Field label="Diagnosis Notes / Remarks">
                    <Textarea value={form.diagnosis_notes} onChange={e => handleFormChange('diagnosis_notes', e.target.value)} placeholder="Clinical notes for this diagnosis..." />
                  </Field>
                  <Field label="Investigations Ordered">
                    <Textarea value={(form.investigations || []).map(i => (typeof i === 'string' ? i : i.name)).join('\n')} onChange={e => handleFormChange('investigations', e.target.value.split('\n').filter(Boolean).map(i => ({ name: i })))} placeholder="Each investigation on a new line..." />
                  </Field>
                  <Field label="Doctor's Private Notes">
                    <Textarea value={form.doctor_notes} onChange={e => handleFormChange('doctor_notes', e.target.value)} placeholder="Private clinical notes (not shared with Receptionist/PRO)..." />
                  </Field>
                </div>

                {/* Follow-up & PRO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="followup" checked={form.followup_recommended} onChange={e => handleFormChange('followup_recommended', e.target.checked)} className="rounded text-emerald-600" />
                      <label htmlFor="followup" className="text-xs font-bold text-slate-700">Recommend Follow-up?</label>
                    </div>
                    {form.followup_recommended && (
                      <>
                        <Field label="Follow-up Date">
                          <Input type="date" value={form.followup_recommended_date} onChange={e => handleFormChange('followup_recommended_date', e.target.value)} />
                        </Field>
                        <Field label="Follow-up Instructions">
                          <Textarea value={form.followup_instructions} onChange={e => handleFormChange('followup_instructions', e.target.value)} placeholder="Instructions for the follow-up visit..." />
                        </Field>
                      </>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="pro" checked={form.pro_required} onChange={e => handleFormChange('pro_required', e.target.checked)} className="rounded text-purple-600" />
                      <label htmlFor="pro" className="text-xs font-bold text-slate-700">PRO Manager Required?</label>
                    </div>
                    {form.pro_required && (
                      <>
                        <Field label="PRO Reason">
                          <Input value={form.pro_reason} onChange={e => handleFormChange('pro_reason', e.target.value)} placeholder="Why PRO intervention is needed..." />
                        </Field>
                        <Field label="Priority">
                          <Select value={form.pro_priority} onChange={e => handleFormChange('pro_priority', e.target.value)}>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </Select>
                        </Field>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===== PRESCRIPTION TAB ===== */}
            {activeTab === 'prescription' && (
              <div className="space-y-5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" /> Prescription
                </h2>

                <div className="space-y-3">
                  <Field label="Prescription Medicine Selector">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <MedicineSelector
                          selectedMedicine={selectedMedicine}
                          onSelectMedicine={(med) => setSelectedMedicine(med)}
                          onClear={() => setSelectedMedicine(null)}
                          disabled={isCompleted || saving}
                          placeholder="Search medicine by name or generic name..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddSelectedMedicine()}
                        disabled={!selectedMedicine || isCompleted || saving}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                        title={selectedMedicine ? `Add ${selectedMedicine.medicine_name} to prescription` : 'Select a medicine first'}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Prescription</span>
                      </button>
                    </div>
                  </Field>

                  {/* Selected Medicine Confirmation & Quick-Add Bar */}
                  {selectedMedicine && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-950 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Pill className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-slate-900 flex items-center gap-2 flex-wrap">
                            <span>{selectedMedicine.medicine_name}</span>
                            {selectedMedicine.category && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold">
                                {selectedMedicine.category}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                            {selectedMedicine.generic_name && (
                              <span className="italic text-slate-600">Generic: {selectedMedicine.generic_name}</span>
                            )}
                            {selectedMedicine.strength && (
                              <span className="font-semibold text-emerald-700">{selectedMedicine.strength}</span>
                            )}
                            {selectedMedicine.medicine_type && (
                              <span className="capitalize">• {selectedMedicine.medicine_type}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedMedicine(null)}
                          className="px-2.5 py-1 text-slate-500 hover:text-red-600 hover:bg-white rounded-lg text-xs font-bold transition cursor-pointer border border-transparent hover:border-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddSelectedMedicine()}
                          disabled={isCompleted || saving}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prescription Table */}
                {prescriptionMeds.length > 0 ? (
                  <div className="space-y-3">
                    {prescriptionMeds.map((med, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{med.medicine_name}</span>
                          <button onClick={() => removeMed(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <Field label="Dosage">
                            <Input value={med.dosage} onChange={e => updateMed(idx, 'dosage', e.target.value)} placeholder="e.g. 1 tab" />
                          </Field>
                          <Field label="Frequency">
                            <Select value={med.frequency} onChange={e => updateMed(idx, 'frequency', e.target.value)}>
                              <option>1 time/day</option>
                              <option>2 times/day</option>
                              <option>3 times/day</option>
                              <option>4 times/day</option>
                              <option>At bedtime</option>
                              <option>As needed</option>
                            </Select>
                          </Field>
                          <Field label="Duration (days)">
                            <Input type="number" value={med.duration_days} onChange={e => updateMed(idx, 'duration_days', parseInt(e.target.value) || 1)} />
                          </Field>
                          <Field label="Quantity">
                            <Input type="number" value={med.quantity} onChange={e => updateMed(idx, 'quantity', parseInt(e.target.value) || 1)} />
                          </Field>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={handleSavePrescription}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Prescription
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Pill className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No medicines added yet. Search and add medicines above.</p>
                  </div>
                )}

                {/* Previous Prescriptions from Overview */}
                {overview?.previous_prescriptions?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Previous Prescriptions</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {overview.previous_prescriptions.slice(0, 5).map(p => (
                        <div key={p.prescription_id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-700">{new Date(p.created_at).toLocaleDateString('en-IN')}</span>
                            <span className="text-slate-500">{p.doctor_name}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.medicines?.map((m, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                                {m.medicine_name} ({m.dosage})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== TREATMENT PLAN TAB ===== */}
            {activeTab === 'treatment' && (
              <div className="space-y-5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-emerald-600" /> Treatment Plan
                </h2>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
                  <h3 className="text-xs font-bold text-slate-700">Add Treatment Plan</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Treatment Name" required>
                      <Input value={treatmentForm.treatment_name} onChange={e => setTreatmentForm(t => ({...t, treatment_name: e.target.value}))} placeholder="e.g. Homeopathic Course 1" />
                    </Field>
                    <Field label="Treatment Type">
                      <Select value={treatmentForm.treatment_type} onChange={e => setTreatmentForm(t => ({...t, treatment_type: e.target.value}))}>
                        <option value="homeopathy">Homeopathy</option>
                        <option value="diet">Diet Plan</option>
                        <option value="lifestyle">Lifestyle Modification</option>
                        <option value="exercise">Exercise Regimen</option>
                        <option value="therapy">Therapy</option>
                        <option value="other">Other</option>
                      </Select>
                    </Field>
                    <Field label="Start Date" required>
                      <Input type="date" value={treatmentForm.start_date} onChange={e => setTreatmentForm(t => ({...t, start_date: e.target.value}))} />
                    </Field>
                    <Field label="Duration" required>
                      <div className="flex gap-2">
                        <Input type="number" value={treatmentForm.duration} onChange={e => setTreatmentForm(t => ({...t, duration: e.target.value}))} placeholder="e.g. 30" className="flex-1" />
                        <Select value={treatmentForm.duration_unit} onChange={e => setTreatmentForm(t => ({...t, duration_unit: e.target.value}))} className="w-28">
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
                        </Select>
                      </div>
                    </Field>
                    <Field label="Frequency">
                      <Input value={treatmentForm.frequency} onChange={e => setTreatmentForm(t => ({...t, frequency: e.target.value}))} placeholder="e.g. Daily morning dose" />
                    </Field>
                    <Field label="Instructions">
                      <Textarea value={treatmentForm.instructions} onChange={e => setTreatmentForm(t => ({...t, instructions: e.target.value}))} rows={2} placeholder="Patient instructions..." />
                    </Field>
                  </div>
                  <button
                    onClick={handleSaveTreatment}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add Treatment Plan
                  </button>
                </div>

                {/* Added Treatments */}
                {treatments.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Saved Treatment Plans</h3>
                    {treatments.map(t => (
                      <div key={t.treatment_id} className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900">{t.treatment_name}</span>
                            <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px]">{t.treatment_type}</span>
                          </div>
                          <span className="text-slate-500">{t.duration} {t.duration_unit}</span>
                        </div>
                        <div className="text-slate-500 mt-1">Start: {t.start_date} → End: {t.end_date}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== SUMMARY & COMPLETE TAB ===== */}
            {activeTab === 'summary' && (
              <div className="space-y-5">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Consultation Summary
                </h2>

                {summary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3 text-xs">
                        <div className="text-slate-500 font-medium">Chief Complaint</div>
                        <div className="text-slate-900 font-bold mt-1">{summary.chief_complaint || '—'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-xs">
                        <div className="text-slate-500 font-medium">Diagnosis</div>
                        <div className="text-slate-900 font-bold mt-1">{summary.diagnosis || '—'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-xs">
                        <div className="text-slate-500 font-medium">Investigations</div>
                        <div className="text-slate-900 font-bold mt-1">{summary.investigations_count || 0} ordered</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-xs">
                        <div className="text-slate-500 font-medium">Prescription</div>
                        <div className="text-slate-900 font-bold mt-1">{summary.prescriptions_summary}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-xs">
                        <div className="text-slate-500 font-medium">Follow-up</div>
                        <div className="text-slate-900 font-bold mt-1">{summary.followup_recommended ? `Yes — ${summary.followup_recommended_date || 'Date TBD'}` : 'Not Recommended'}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-xs">
                        <div className="text-slate-500 font-medium">PRO Required</div>
                        <div className="text-slate-900 font-bold mt-1">{summary.pro_required ? 'Yes' : 'No'}</div>
                      </div>
                    </div>

                    {!isCompleted && (
                      <div className="pt-3 border-t border-slate-100">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 mb-4">
                          <strong>⚠️ Before completing:</strong> Ensure Chief Complaint and Primary Diagnosis are filled. This action is irreversible.
                        </div>
                        <button
                          onClick={handleComplete}
                          disabled={completing}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors"
                        >
                          {completing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          {completing ? 'Completing...' : 'Complete Consultation & Hand Off to PRO'}
                        </button>
                      </div>
                    )}

                    {isCompleted && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 text-center">
                        <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                        <strong>Consultation Completed.</strong> Patient has been moved to the PRO Manager queue. All clinical records, prescriptions, and treatment plans remain fully editable.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner label="Loading summary..." />
                  </div>
                )}
              </div>
            )}

            {/* Tab Navigation Buttons */}
            <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-100">
              <button
                disabled={!canGoPrev}
                onClick={() => setActiveTab(TABS[tabIdx - 1].id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>

              <button
                onClick={() => handleSaveDraft(true)}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isCompleted ? 'Save Changes & Continue' : 'Save & Continue'}
              </button>

              <button
                disabled={!canGoNext}
                onClick={() => setActiveTab(TABS[tabIdx + 1].id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
