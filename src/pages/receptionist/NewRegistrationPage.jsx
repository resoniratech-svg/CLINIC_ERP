import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { receptionistApi, settingsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  UserPlus,
  Search,
  CheckCircle2,
  Calendar,
  Clock,
  DollarSign,
  CreditCard,
  Building,
  UserCheck,
  AlertCircle,
  FileText,
  Printer,
  ArrowRight,
  ChevronDown,
  X,
  Stethoscope,
  ShieldAlert,
  Users,
  HeartHandshake,
  BadgeCheck
} from 'lucide-react';

export const NewRegistrationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [doctors, setDoctors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [registrationAccess, setRegistrationAccess] = useState('full');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Searchable Doctor Dropdown State
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const doctorDropdownRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    mobile_number: location.state?.initialMobile || location.state?.mobile || '',
    full_name: location.state?.patientName || location.state?.leadName || location.state?.name || '',
    age: location.state?.age !== undefined && location.state?.age !== null ? String(location.state.age) : '',
    gender: location.state?.gender || 'male',
    village_mandal: location.state?.village || location.state?.village_mandal || location.state?.mandal || '',
    ailment_reason: (() => {
      const explicitAilment = location.state?.ailment_reason || location.state?.requirement || '';
      if (explicitAilment) return explicitAilment;
      const channelKeywords = [
        'inbound call', 'outbound call', 'excel import', 'import from excel',
        'outbound excel', 'call center outreach', 'inbound consultation enquiry',
        'call center executive lead', 'general consultation request', 'phone inquiry', 'phone enquiry'
      ];
      const fallbackReason = location.state?.reason || '';
      if (fallbackReason && !channelKeywords.includes(fallbackReason.toLowerCase().trim())) {
        return fallbackReason;
      }
      return '';
    })(),
    lead_source: (location.state?.leadId || location.state?.leadSource === 'executive_lead') ? 'executive_lead' : (location.state?.leadSource || 'walkin'),
    lead_id: location.state?.leadId || null,
    referring_employee_id: '',
    referring_patient_name: '',
    assigned_doctor_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00:00',
    appointment_type: 'new',
    discount_amount: 0,
    discount_reason: '',
    payment_method: 'cash',
    payment_amount: '',
    remarks: '',
  });

  // Base Fee & Calculations
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [existingCheckLoading, setExistingCheckLoading] = useState(false);
  const [existingPatientInfo, setExistingPatientInfo] = useState(null);

  // Completion Modal State
  const [completedRecord, setCompletedRecord] = useState(null);

  // Referring Employee & Patient State for Referral Source
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empSearchTerm, setEmpSearchTerm] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const empDropdownRef = useRef(null);

  const [referringPatientList, setReferringPatientList] = useState([]);
  const [selectedReferringPt, setSelectedReferringPt] = useState(null);
  const [ptSearchTerm, setPtSearchTerm] = useState('');
  const [isPtDropdownOpen, setIsPtDropdownOpen] = useState(false);
  const ptDropdownRef = useRef(null);
  const [searchingPt, setSearchingPt] = useState(false);
  const [ailmentsList, setAilmentsList] = useState([]);
  const [isAilmentDropdownOpen, setIsAilmentDropdownOpen] = useState(false);
  const [ailmentDropdownDirection, setAilmentDropdownDirection] = useState('down');
  const [ailmentMaxHeight, setAilmentMaxHeight] = useState(260);
  const ailmentDropdownRef = useRef(null);

  const filteredAilments = useMemo(() => {
    if (!formData.ailment_reason || !formData.ailment_reason.trim()) {
      return ailmentsList;
    }
    const q = formData.ailment_reason.toLowerCase().trim();
    return ailmentsList.filter((a) => (a.name || '').toLowerCase().includes(q));
  }, [ailmentsList, formData.ailment_reason]);

  const updateAilmentDropdownPosition = () => {
    if (!ailmentDropdownRef.current) return;
    const rect = ailmentDropdownRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const dropdownPreferredHeight = 260;
    const margin = 16;

    if (spaceBelow < dropdownPreferredHeight && spaceAbove > spaceBelow) {
      setAilmentDropdownDirection('up');
      setAilmentMaxHeight(Math.max(120, Math.min(dropdownPreferredHeight, spaceAbove - margin)));
    } else {
      setAilmentDropdownDirection('down');
      setAilmentMaxHeight(Math.max(120, Math.min(dropdownPreferredHeight, spaceBelow - margin)));
    }
  };
  const [villagesList, setVillagesList] = useState([]);
  const [mandalsList, setMandalsList] = useState([]);
  const [leadSourcesList, setLeadSourcesList] = useState([]);
  const [referralSourcesList, setReferralSourcesList] = useState([]);

  useEffect(() => {
    const fetchPrerequisites = async () => {
      setLoadingInitial(true);
      try {
        const [docRes, empRes, permRes, ailRes, vilRes, manRes, lsRes, refRes] = await Promise.all([
          receptionistApi.getActiveDoctors(),
          receptionistApi.getEmployees().catch(() => ({ data: [] })),
          settingsApi.getPermissionsMatrix().catch(() => ({ data: [] })),
          settingsApi.getMasterData('ailments', { status: 'active' }).catch(() => ({ data: [] })),
          settingsApi.getMasterData('villages', { status: 'active' }).catch(() => ({ data: [] })),
          settingsApi.getMasterData('mandals', { status: 'active' }).catch(() => ({ data: [] })),
          settingsApi.getMasterData('lead_sources', { status: 'active' }).catch(() => ({ data: [] })),
          settingsApi.getMasterData('referral_sources', { status: 'active' }).catch(() => ({ data: [] })),
        ]);

        if (ailRes?.success && Array.isArray(ailRes.data)) {
          setAilmentsList(ailRes.data);
        }
        if (vilRes?.success && Array.isArray(vilRes.data)) {
          setVillagesList(vilRes.data);
        }
        if (manRes?.success && Array.isArray(manRes.data)) {
          setMandalsList(manRes.data);
        }
        if (lsRes?.success && Array.isArray(lsRes.data)) {
          setLeadSourcesList(lsRes.data);
        }
        if (refRes?.success && Array.isArray(refRes.data)) {
          setReferralSourcesList(refRes.data);
        }

        if (docRes.success && docRes.data) {
          setDoctors(docRes.data);
          if (docRes.data.length > 0) {
            setFormData((prev) => ({ ...prev, assigned_doctor_id: docRes.data[0].doctor_id }));
            setSelectedDoctor(docRes.data[0]);
          }
        }

        if (empRes.success && Array.isArray(empRes.data)) {
          setEmployeesList(empRes.data);
          if (location.state?.referringEmployeeId) {
            const matchEmp = empRes.data.find(e => String(e.user_id) === String(location.state.referringEmployeeId));
            if (matchEmp) setSelectedEmp(matchEmp);
          }
        }

        if (permRes && permRes.data && Array.isArray(permRes.data)) {
          const currentRole = user?.role || 'receptionist';
          if (currentRole !== 'super_admin') {
            const regPerm = permRes.data.find(
              (p) => p.role === currentRole && p.module?.toLowerCase() === 'registration'
            );
            if (regPerm) {
              setRegistrationAccess(regPerm.access_level);
            }
          }
        }
      } catch (err) {
        showToast('Failed to load active doctors or front-desk configuration', 'error');
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchPrerequisites();
  }, [user]);

  // Update selected doctor object & fee when doctor or appt type changes
  useEffect(() => {
    if (formData.assigned_doctor_id && doctors.length > 0) {
      const doc = doctors.find((d) => String(d.doctor_id) === String(formData.assigned_doctor_id));
      setSelectedDoctor(doc || null);
    }
  }, [formData.assigned_doctor_id, doctors]);

  const formatDocName = (name) => {
    if (!name) return 'Doctor';
    return name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(event.target)) {
        setIsDoctorDropdownOpen(false);
      }
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target)) {
        setIsEmpDropdownOpen(false);
      }
      if (ptDropdownRef.current && !ptDropdownRef.current.contains(event.target)) {
        setIsPtDropdownOpen(false);
      }
      if (ailmentDropdownRef.current && !ailmentDropdownRef.current.contains(event.target)) {
        setIsAilmentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isAilmentDropdownOpen) return;
    updateAilmentDropdownPosition();
    const handleScrollOrResize = () => {
      updateAilmentDropdownPosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isAilmentDropdownOpen]);

  const handleSearchReferringPatient = async () => {
    if (!ptSearchTerm.trim()) {
      showToast('Enter patient name, mobile number or registration ID', 'warning');
      return;
    }
    setSearchingPt(true);
    try {
      const res = await receptionistApi.searchPatients({ search: ptSearchTerm.trim() });
      if (res.success && res.data?.patients?.length > 0) {
        setReferringPatientList(res.data.patients);
        setIsPtDropdownOpen(true);
      } else {
        setReferringPatientList([]);
        showToast('No registered patient found with that term', 'warning');
      }
    } catch (e) {
      showToast(e.message || 'Search failed', 'error');
    } finally {
      setSearchingPt(false);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    if (!doctorSearchTerm.trim()) return true;
    const q = doctorSearchTerm.toLowerCase();
    const name = (doc.doctor_name || doc.full_name || '').toLowerCase();
    const spec = (doc.specialization || '').toLowerCase();
    const qual = (doc.qualification || '').toLowerCase();
    return name.includes(q) || spec.includes(q) || qual.includes(q);
  });

  // Determine Base Fee
  const getBaseFee = () => {
    if (!selectedDoctor) return 500;
    if (formData.appointment_type === 'renewal') return parseFloat(selectedDoctor.renewal_consultation_fee || 300);
    if (formData.appointment_type === 'followup') return parseFloat(selectedDoctor.followup_consultation_fee || 200);
    return parseFloat(selectedDoctor.new_consultation_fee || 500);
  };

  const baseFee = getBaseFee();
  const discount = Math.max(0, parseFloat(formData.discount_amount) || 0);
  const finalFee = Math.max(0, baseFee - discount);
  const paymentAmount = formData.payment_amount === '' ? finalFee : parseFloat(formData.payment_amount) || 0;
  const dueAmount = Math.max(0, finalFee - paymentAmount);

  // Auto-check Mobile on blur
  const checkExistingMobile = async () => {
    const mobile = formData.mobile_number.trim();
    if (mobile.length >= 10) {
      setExistingCheckLoading(true);
      try {
        const res = await receptionistApi.searchPatients({ search: mobile });
        if (res.success && res.data?.patients?.length > 0) {
          const match = res.data.patients.find((p) => p.mobile_number === mobile);
          if (match) {
            setExistingPatientInfo(match);
            setFormData((prev) => ({
              ...prev,
              full_name: match.full_name || match.patient_name || prev.full_name,
              age: match.age || prev.age,
              gender: match.gender || prev.gender,
              village_mandal: match.village || match.village_mandal || prev.village_mandal,
              appointment_type: 'renewal', // auto recommend renewal for existing
            }));
            showToast(`Existing patient detected: ${match.full_name || match.patient_name} (${match.registration_id})`, 'info');
          } else {
            setExistingPatientInfo(null);
          }
        } else {
          setExistingPatientInfo(null);
        }
      } catch (e) {
        setExistingPatientInfo(null);
      } finally {
        setExistingCheckLoading(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.mobile_number || !formData.full_name || !formData.assigned_doctor_id || !formData.appointment_date) {
      showToast('Please fill all required registration fields (*)', 'warning');
      return;
    }

    if (formData.lead_source === 'employee_referral' && !selectedEmp) {
      showToast('Please select a referring employee for this employee referral', 'warning');
      return;
    }

    if (formData.lead_source === 'patient_referral' && !selectedReferringPt) {
      showToast('Please search and select the referring patient', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        mobile_number: formData.mobile_number.trim(),
        full_name: formData.full_name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        village_mandal: formData.village_mandal.trim() || null,
        ailment_reason: formData.ailment_reason.trim() || null,
        lead_source: formData.lead_source,
        source: formData.lead_source === 'executive_lead' ? 'Call Center Executive Lead' : (formData.lead_source === 'employee_referral' ? 'Employee Referral' : (formData.lead_source === 'patient_referral' ? 'Patient Referral' : formData.lead_source)),
        lead_id: formData.lead_id || null,
        referring_employee_id: formData.lead_source === 'employee_referral' && selectedEmp ? selectedEmp.user_id : null,
        referring_patient_id: formData.lead_source === 'patient_referral' && selectedReferringPt ? selectedReferringPt.patient_id : null,
        assigned_doctor_id: parseInt(formData.assigned_doctor_id),
        appointment_date: formData.appointment_date,
        appointment_time: formData.appointment_time,
        appointment_type: formData.appointment_type,
        discount_amount: discount,
        payment_method: formData.payment_method,
        payment_amount: paymentAmount,
        remarks: formData.remarks.trim() || null,
      };

      const res = await receptionistApi.registerPatient(payload);
      if (res.success) {
        showToast('Patient registered & consultation payment recorded successfully!', 'success');
        setCompletedRecord({
          ...res.data,
          patientName: formData.full_name,
          mobile: formData.mobile_number,
          doctorName: selectedDoctor?.doctor_name || selectedDoctor?.full_name,
          finalFee,
          paidAmount: paymentAmount,
          dueAmount,
          paymentMethod: formData.payment_method,
        });
      }
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return <LoadingSpinner label="Loading registration console..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <span>New Patient Registration & Intake Console</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single-flow registration: Patient details → Doctor schedule → Consultation fee billing → Check-in.
          </p>
        </div>

        <button
          onClick={() => navigate('/receptionist/patients')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <Search className="w-4 h-4" />
          <span>Search Registry</span>
        </button>
      </div>

      {/* RBAC Restriction Alert Banner */}
      {registrationAccess !== 'full' && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
          <div className="space-y-1 text-amber-950 text-xs">
            <div className="font-bold">Patient Registration Restricted for {user?.role ? user.role.toUpperCase() : 'YOUR ROLE'}</div>
            <p>
              Hospital RBAC security policy currently sets Registration access to <span className="uppercase font-bold underline">{registrationAccess}</span>. Direct patient onboarding submissions will be rejected by backend authorization.
            </p>
          </div>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Patient Contact & Demographics */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[11px]">1</span>
              <span>Patient Profile & Contact Information</span>
            </h3>
            {existingPatientInfo && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Existing Patient: {existingPatientInfo.registration_id}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Mobile Number */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Mobile Number * (10 Digits)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={formData.mobile_number}
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                  onBlur={checkExistingMobile}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold"
                />
                {existingCheckLoading && (
                  <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-medium animate-pulse">
                    Checking...
                  </span>
                )}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Patient Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. Ravi Kumar"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
            </div>

            {/* Age & Gender */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Age *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="120"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder="35"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender *</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Village / Mandal */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Village / Mandal *
              </label>
              <input
                type="text"
                required
                list="registered-villages-datalist"
                value={formData.village_mandal}
                onChange={(e) => setFormData({ ...formData, village_mandal: e.target.value })}
                placeholder="e.g. Kukatpally, Hyderabad"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="registered-villages-datalist">
                {villagesList.map((v) => (
                  <option key={v.id || v.name} value={v.name} />
                ))}
                {mandalsList.map((m) => (
                  <option key={`mandal-${m.id || m.name}`} value={m.name} />
                ))}
              </datalist>
            </div>

            {/* Lead Source */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Patient Source / Acquisition *
              </label>
              <select
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              >
                {/* Always-present system keys that drive conditional UI panels */}
                <option value="walkin">Walk-in Patient</option>
                <option value="employee_referral">Employee Referral</option>
                <option value="patient_referral">Patient-to-Patient Referral</option>
                <option value="executive_lead">Call Center Executive Lead</option>
                {/* Dynamic master data options from Super Admin */}
                {leadSourcesList.filter(ls =>
                  !['walkin', 'employee_referral', 'patient_referral', 'executive_lead'].includes(ls.name?.toLowerCase().replace(/\s+/g, '_'))
                ).map((ls) => (
                  <option key={ls.id || ls.name} value={ls.name}>{ls.name}</option>
                ))}
                {/* Fallback static options if master list is empty */}
                {leadSourcesList.length === 0 && (
                  <>
                    <option value="phone_enquiry">Phone Enquiry</option>
                    <option value="camp_data">Health Camp Data</option>
                    <option value="cold_data">Cold Outreach Data</option>
                    <option value="other">Other</option>
                  </>
                )}
              </select>
            </div>

            {/* Reason for Visit */}
            <div className="relative" ref={ailmentDropdownRef}>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Ailment / Reason for Visit (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.ailment_reason}
                  onFocus={() => {
                    updateAilmentDropdownPosition();
                    setIsAilmentDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, ailment_reason: e.target.value }));
                    updateAilmentDropdownPosition();
                    setIsAilmentDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsAilmentDropdownOpen(false);
                    }
                  }}
                  placeholder="e.g. Fever, Bronchial Asthma, Allergy"
                  className="w-full pl-3 pr-14 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-medium"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {formData.ailment_reason && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData((prev) => ({ ...prev, ailment_reason: '' }));
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer transition-colors"
                      title="Clear ailment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAilmentDropdownOpen) {
                        updateAilmentDropdownPosition();
                        setIsAilmentDropdownOpen(true);
                      } else {
                        setIsAilmentDropdownOpen(false);
                      }
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer transition-colors"
                    tabIndex={-1}
                    title="Toggle ailments list"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isAilmentDropdownOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Viewport-aware Floating Ailment Dropdown */}
              {isAilmentDropdownOpen && (
                <div
                  style={{ maxHeight: `${ailmentMaxHeight}px` }}
                  className={`absolute left-0 right-0 w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-y-auto z-50 divide-y divide-slate-100 ${
                    ailmentDropdownDirection === 'up'
                      ? 'bottom-full mb-1'
                      : 'top-full mt-1'
                  }`}
                >
                  {ailmentsList.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      No registered ailments found in master data.
                    </div>
                  ) : filteredAilments.length === 0 ? (
                    <div className="p-3 text-center text-slate-500 text-xs space-y-1">
                      <div>No registered ailments matching "{formData.ailment_reason}".</div>
                      <div className="text-[10px] text-slate-400">
                        Click outside or keep typing to use this custom entry.
                      </div>
                    </div>
                  ) : (
                    filteredAilments.map((a) => {
                      const isSelected =
                        (formData.ailment_reason || '').trim().toLowerCase() ===
                        (a.name || '').trim().toLowerCase();
                      return (
                        <div
                          key={a.id || a.name}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, ailment_reason: a.name }));
                            setIsAilmentDropdownOpen(false);
                          }}
                          className={`px-3.5 py-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected
                              ? 'bg-blue-50 font-bold text-blue-900'
                              : 'text-slate-700'
                          }`}
                        >
                          <span className="truncate pr-2 font-medium">{a.name}</span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Conditional Referral Panel: Employee Referral */}
          {formData.lead_source === 'employee_referral' && (
            <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Referring Hospital Employee Metadata (Unit Target Attribution)</span>
                </span>
                {selectedEmp && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" /> Selected: {selectedEmp.full_name} ({selectedEmp.employee_id || 'ID: ' + selectedEmp.user_id})
                  </span>
                )}
              </div>

              <div className="relative" ref={empDropdownRef}>
                <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                  Search & Select Referring Employee *
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={
                      isEmpDropdownOpen
                        ? empSearchTerm
                        : selectedEmp
                        ? `${selectedEmp.full_name} — ${selectedEmp.employee_id || 'Staff'} (${selectedEmp.department || selectedEmp.role || 'Hospital'})`
                        : empSearchTerm
                    }
                    onFocus={() => setIsEmpDropdownOpen(true)}
                    onChange={(e) => {
                      setEmpSearchTerm(e.target.value);
                      setIsEmpDropdownOpen(true);
                    }}
                    placeholder="Type name, employee ID, mobile or department to search staff..."
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-purple-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
                  />
                  {selectedEmp && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmp(null);
                        setEmpSearchTerm('');
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isEmpDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-200 max-h-52 overflow-y-auto py-1">
                    {employeesList
                      .filter((emp) => {
                        if (!empSearchTerm.trim()) return true;
                        const q = empSearchTerm.toLowerCase();
                        return (
                          (emp.full_name || '').toLowerCase().includes(q) ||
                          (emp.employee_id || '').toLowerCase().includes(q) ||
                          (emp.department || '').toLowerCase().includes(q) ||
                          (emp.mobile_number || '').toLowerCase().includes(q)
                        );
                      })
                      .map((emp) => (
                        <div
                          key={emp.user_id}
                          onClick={() => {
                            setSelectedEmp(emp);
                            setIsEmpDropdownOpen(false);
                            setEmpSearchTerm('');
                          }}
                          className={`px-3 py-2 text-xs hover:bg-purple-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-0 ${
                            selectedEmp?.user_id === emp.user_id ? 'bg-purple-100 font-bold text-purple-900' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{emp.full_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {emp.employee_id || 'ID: ' + emp.user_id} • {emp.department || emp.role} • {emp.mobile_number || 'No mobile'}
                            </div>
                          </div>
                          {selectedEmp?.user_id === emp.user_id && (
                            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                          )}
                        </div>
                      ))}
                    {employeesList.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-400 text-center">No employees available</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conditional Referral Panel: Patient Referral */}
          {formData.lead_source === 'patient_referral' && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-indigo-600" />
                  <span>Referring Patient Metadata (Patient-to-Patient Recommendation)</span>
                </span>
                {selectedReferringPt && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" /> Selected: {selectedReferringPt.full_name || selectedReferringPt.patient_name} ({selectedReferringPt.registration_id})
                  </span>
                )}
              </div>

              <div className="space-y-2 relative" ref={ptDropdownRef}>
                <label className="block text-[11px] font-semibold text-indigo-900">
                  Search & Link Existing Referring Patient *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={
                        selectedReferringPt
                          ? `${selectedReferringPt.full_name || selectedReferringPt.patient_name} (${selectedReferringPt.registration_id} • ${selectedReferringPt.mobile_number})`
                          : ptSearchTerm
                      }
                      onFocus={() => {
                        if (!selectedReferringPt) setIsPtDropdownOpen(true);
                      }}
                      onChange={(e) => {
                        setPtSearchTerm(e.target.value);
                        if (selectedReferringPt) setSelectedReferringPt(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchReferringPatient();
                        }
                      }}
                      placeholder="Enter mobile number, registration ID, or patient name..."
                      className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    />
                    {selectedReferringPt && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReferringPt(null);
                          setPtSearchTerm('');
                        }}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSearchReferringPatient}
                    disabled={searchingPt}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-500/20"
                  >
                    {searchingPt ? 'Searching...' : 'Search Patient'}
                  </button>
                </div>

                {isPtDropdownOpen && referringPatientList.length > 0 && !selectedReferringPt && (
                  <div className="absolute z-30 mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-200 max-h-52 overflow-y-auto py-1">
                    {referringPatientList.map((pt) => (
                      <div
                        key={pt.patient_id}
                        onClick={() => {
                          setSelectedReferringPt(pt);
                          setIsPtDropdownOpen(false);
                          setPtSearchTerm('');
                        }}
                        className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-0"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{pt.full_name || pt.patient_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {pt.registration_id} • {pt.mobile_number} • {pt.village || pt.village_mandal || 'Location N/A'}
                          </div>
                        </div>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                          Select
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Doctor Selection & Appointment Scheduling */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[11px]">2</span>
              <span>Doctor Assignment & Consultation Schedule</span>
            </h3>
            {selectedDoctor && (
              <span className="text-[11px] font-semibold text-blue-700">
                {formatDocName(selectedDoctor.doctor_name || selectedDoctor.full_name)} • {selectedDoctor.specialization}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            {/* Searchable Doctor Dropdown */}
            <div className="space-y-1 relative" ref={doctorDropdownRef}>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Assigned Doctor * (Active Doctors Only)
              </label>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={
                    isDoctorDropdownOpen
                      ? doctorSearchTerm
                      : selectedDoctor
                      ? `${formatDocName(selectedDoctor.doctor_name || selectedDoctor.full_name)} (${selectedDoctor.specialization || 'General'})`
                      : doctorSearchTerm
                  }
                  onFocus={() => {
                    setIsDoctorDropdownOpen(true);
                    if (selectedDoctor) {
                      setDoctorSearchTerm(selectedDoctor.doctor_name || selectedDoctor.full_name || '');
                    }
                  }}
                  onChange={(e) => {
                    setDoctorSearchTerm(e.target.value);
                    setIsDoctorDropdownOpen(true);
                  }}
                  placeholder="Search doctor by name or specialty..."
                  className={`w-full pl-9 pr-7 py-2 text-xs rounded-xl border ${
                    formData.assigned_doctor_id ? 'border-blue-500 bg-blue-50/20 font-bold text-slate-900' : 'border-slate-300 bg-white'
                  } focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all`}
                />

                <button
                  type="button"
                  onClick={() => setIsDoctorDropdownOpen(!isDoctorDropdownOpen)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Floating Doctor Dropdown List */}
              {isDoctorDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-52 overflow-y-auto z-50 divide-y divide-slate-100">
                  {filteredDoctors.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      No active doctors found matching "{doctorSearchTerm}"
                    </div>
                  ) : (
                    filteredDoctors.map((doc) => {
                      const isSelected = String(doc.doctor_id) === String(formData.assigned_doctor_id);
                      const name = formatDocName(doc.doctor_name || doc.full_name);
                      return (
                        <div
                          key={doc.doctor_id}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, assigned_doctor_id: doc.doctor_id }));
                            setSelectedDoctor(doc);
                            setDoctorSearchTerm(doc.doctor_name || doc.full_name || '');
                            setIsDoctorDropdownOpen(false);
                          }}
                          className={`p-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{name}</span>
                              {doc.specialization && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100/70 font-semibold text-blue-700">
                                  {doc.specialization}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Fee: ₹{doc.new_consultation_fee || 500} • {doc.qualification || 'MBBS / BHMS'}
                            </div>
                          </div>

                          {isSelected && (
                            <span className="text-blue-600 text-xs font-bold">✓</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Appointment Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Appointment Date *
              </label>
              <input
                type="date"
                required
                value={formData.appointment_date}
                onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
            </div>

            {/* Appointment Time Slot */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Time Slot *
              </label>
              <select
                required
                value={formData.appointment_time}
                onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              >
                {['09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00', '12:00:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00', '17:00:00'].map((t) => (
                  <option key={t} value={t}>
                    {t.slice(0, 5)} hrs
                  </option>
                ))}
              </select>
            </div>

            {/* Appointment Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Appointment Type *
              </label>
              <select
                value={formData.appointment_type}
                onChange={(e) => setFormData({ ...formData, appointment_type: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold capitalize"
              >
                <option value="new">New Consultation</option>
                <option value="renewal">Renewal Consultation</option>
                <option value="followup">Follow-up Consultation</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Consultation Fee Billing & Payment Collection */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[11px]">3</span>
              <span>Consultation Fee Billing & Payment Recording</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              Auto-resolved from doctor pricing matrix
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            {/* Base Fee (Auto) */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Standard Fee (Auto)</span>
              <span className="text-lg font-black text-slate-900 font-mono">₹{baseFee}</span>
            </div>

            {/* Allowed Discount */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                min="0"
                max={baseFee}
                value={formData.discount_amount}
                onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-medium"
              />
            </div>

            {/* Final Payable Amount */}
            <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200">
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">Final Payable</span>
              <span className="text-lg font-black text-blue-800 font-mono">₹{finalFee}</span>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Method *
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI / QR Code</option>
                <option value="card">Debit / Credit Card</option>
                <option value="razorpay">Razorpay Online</option>
                <option value="bajaj_pay">Bajaj Pay Health EMI</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Amount Paid Today (₹) *
              </label>
              <input
                type="number"
                min="0"
                max={finalFee}
                value={formData.payment_amount}
                onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                placeholder={`Full payment: ₹${finalFee}`}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-slate-900"
              />
              {dueAmount > 0 && (
                <span className="text-[11px] text-red-600 font-bold mt-1 block">
                  Partial payment: Remaining ₹{dueAmount} due will be recorded in Due Patients ledger.
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Front Desk Remarks
              </label>
              <input
                type="text"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="e.g. VIP patient, referred by Dr. Suresh"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit & Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/receptionist/dashboard')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting || registrationAccess !== 'full'}
            className={`flex items-center gap-2 px-8 py-3 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer ${
              registrationAccess !== 'full'
                ? 'bg-slate-400 opacity-60 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-500/25 disabled:opacity-50'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>
              {submitting
                ? 'Registering Patient...'
                : registrationAccess !== 'full'
                ? 'Registration Restricted by Policy'
                : 'Complete Registration & Check-in'}
            </span>
          </button>
        </div>
      </form>

      {/* Instant Completion & Bill Receipt Modal */}
      {completedRecord && (
        <Modal
          isOpen={true}
          onClose={() => {
            setCompletedRecord(null);
            navigate('/receptionist/dashboard');
          }}
          title="Registration & Consultation Bill Receipt"
          maxWidth="max-w-lg"
        >
          <div className="space-y-5 text-xs text-slate-700">
            {/* Success Badge */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-sm text-emerald-900">Patient Successfully Registered</h3>
              <p className="text-[11px] text-emerald-700">
                Patient has been added to the doctor consultation schedule.
              </p>
            </div>

            {/* Generated System IDs */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Registration ID</span>
                <span className="font-mono font-bold text-blue-700 text-xs">
                  {completedRecord.registration_id || completedRecord.patient?.registration_id || `REG-${completedRecord.patient_id}`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Patient ID</span>
                <span className="font-mono font-bold text-slate-800 text-xs">#{completedRecord.patient_id}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Appointment Token</span>
                <span className="font-mono font-bold text-slate-800 text-xs">#{completedRecord.appointment?.appointment_id}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Bill Invoice #</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{completedRecord.bill?.bill_number}</span>
              </div>
            </div>

            {/* Consultation Summary */}
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Patient:</span>
                <span className="font-bold text-slate-900">{completedRecord.patientName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Doctor:</span>
                <span className="font-bold text-slate-900">{formatDocName(completedRecord.doctorName)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Total Consultation Fee:</span>
                <span className="font-mono font-bold text-slate-900">₹{completedRecord.finalFee}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Paid Amount ({completedRecord.paymentMethod?.toUpperCase()}):</span>
                <span className="font-mono font-bold text-emerald-700">₹{completedRecord.paidAmount}</span>
              </div>
              {completedRecord.dueAmount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-red-600 font-bold">Outstanding Balance (Due):</span>
                  <span className="font-mono font-bold text-red-600">₹{completedRecord.dueAmount}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Slip</span>
              </button>

              <button
                onClick={() => {
                  setCompletedRecord(null);
                  navigate('/receptionist/check-in');
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Go to Waiting Queue
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
