import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  RotateCcw,
  Search,
  UserCheck,
  Calendar,
  DollarSign,
  AlertCircle,
  CreditCard,
  Building,
  CheckCircle2,
  XCircle,
  ChevronDown,
  X,
  ArrowRight
} from 'lucide-react';

export const RenewalsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(location.state?.patient || null);
  const [allPatients, setAllPatients] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const patientDropdownRef = useRef(null);

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [completedRenewal, setCompletedRenewal] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    assigned_doctor_id: '',
    appointment_date: todayStr,
    appointment_time: '10:00:00',
    discount_amount: 0,
    payment_method: 'cash',
    payment_amount: '',
    remarks: '',
  });

  const formatDocName = (name) => {
    if (!name) return 'Dr. On Duty';
    return `Dr. ${name.replace(/^dr\.?\s+/i, '')}`;
  };

  useEffect(() => {
    const fetchPrerequisites = async () => {
      try {
        const [docRes, ptRes] = await Promise.all([
          receptionistApi.getActiveDoctors(),
          receptionistApi.searchPatients({ limit: 50 }).catch(() => ({ data: [] })),
        ]);

        if (docRes.success && docRes.data?.length > 0) {
          setDoctors(docRes.data);
          setFormData((prev) => ({ ...prev, assigned_doctor_id: docRes.data[0].doctor_id }));
        }

        if (ptRes.success) {
          const list = ptRes.data?.patients || (Array.isArray(ptRes.data) ? ptRes.data : []);
          setAllPatients(list);
        }
      } catch (err) {
        showToast('Failed to load active doctors or patient registry', 'error');
      }
    };
    fetchPrerequisites();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPatients = allPatients.filter((p) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    const name = (p.full_name || p.patient_name || '').toLowerCase();
    const mobile = (p.mobile_number || '').toLowerCase();
    const regId = (p.registration_id || '').toLowerCase();
    const id = String(p.patient_id || '');
    return name.includes(q) || mobile.includes(q) || regId.includes(q) || id.includes(q);
  });

  const handleSearchPatient = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      showToast('Please enter mobile or registration ID', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await receptionistApi.searchPatients({ search: searchQuery.trim() });
      if (res.success && res.data?.patients?.length > 0) {
        const found = res.data.patients[0];
        setSelectedPatient(found);
        setIsDropdownOpen(false);
        showToast(`Selected patient: ${found.full_name || found.patient_name} (${found.registration_id})`, 'info');
      } else {
        showToast('No patient found with that mobile or registration ID', 'warning');
      }
    } catch (err) {
      showToast(err.message || 'Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedDocObj = doctors.find((d) => String(d.doctor_id) === String(formData.assigned_doctor_id));
  const renewalFee = selectedDocObj ? parseFloat(selectedDocObj.renewal_consultation_fee || 300) : 300;
  const discount = Math.max(0, parseFloat(formData.discount_amount) || 0);
  const finalFee = Math.max(0, renewalFee - discount);
  const payAmt = formData.payment_amount === '' ? finalFee : parseFloat(formData.payment_amount) || 0;
  const dueAmt = Math.max(0, finalFee - payAmt);

  const handleRenew = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      showToast('Please search and select an existing patient first', 'warning');
      return;
    }

    if (discount > renewalFee) {
      showToast(`Discount cannot exceed renewal consultation fee of ₹${renewalFee}`, 'warning');
      return;
    }

    if (payAmt > finalFee) {
      showToast(`Payment amount cannot exceed final payable of ₹${finalFee}`, 'warning');
      return;
    }

    setRenewing(true);
    try {
      const res = await receptionistApi.renewRegistration({
        patient_id: selectedPatient.patient_id,
        doctor_id: parseInt(formData.assigned_doctor_id),
        assigned_doctor_id: parseInt(formData.assigned_doctor_id),
        appointment_date: formData.appointment_date,
        appointment_time: formData.appointment_time,
        discount_amount: discount,
        payment_method: formData.payment_method,
        payment_amount: payAmt,
        remarks: formData.remarks || null,
      });

      if (res.success) {
        showToast('Registration renewal and consultation scheduled successfully!', 'success');
        setCompletedRenewal({
          patient: selectedPatient,
          doctor: selectedDocObj,
          bill: res.data?.bill,
          renewal: res.data?.renewal,
          appointment: res.data?.appointment,
          new_expiry: res.data?.new_expiry_date || 'Extended +30 Days',
          paid_amount: payAmt,
          due_amount: dueAmt,
        });
      }
    } catch (err) {
      showToast(err.message || 'Renewal failed', 'error');
    } finally {
      setRenewing(false);
    }
  };

  const handleResetForNext = () => {
    setCompletedRenewal(null);
    setSelectedPatient(null);
    setSearchQuery('');
    setFormData({
      assigned_doctor_id: doctors[0]?.doctor_id || '',
      appointment_date: todayStr,
      appointment_time: '10:00:00',
      discount_amount: 0,
      payment_method: 'cash',
      payment_amount: '',
      remarks: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-teal-600" />
            <span>Patient Registration Renewal</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Renew expired registrations, schedule renewal consultations, and collect renewal fees (Contributes to Unit Target).
          </p>
        </div>
      </div>

      {/* Patient Search Step */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Step 1: Select Existing Patient for Renewal
        </h3>

        <div className="space-y-2 relative" ref={patientDropdownRef}>
          <form onSubmit={handleSearchPatient} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim()) setIsDropdownOpen(true);
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  if (!e.target.value) setSelectedPatient(null);
                }}
                placeholder="Type Patient Name, Mobile Number, or Registration ID..."
                className="w-full pl-10 pr-9 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPatient(null);
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              {loading ? 'Searching...' : 'Find Patient'}
            </button>
          </form>

          {/* Autocomplete Patient Dropdown */}
          {isDropdownOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
              {filteredPatients.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-xs">
                  No patients found matching "{searchQuery}"
                </div>
              ) : (
                filteredPatients.map((p) => {
                  const patientName = p.full_name || p.patient_name || p.name || 'Patient';
                  const regExpiry = p.registration_expiry || p.expiry_date;
                  const isExp = p.registration_status === 'expired' || (regExpiry && new Date(regExpiry) < new Date());

                  return (
                    <div
                      key={p.patient_id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setSearchQuery(`${patientName} (${p.registration_id || `#${p.patient_id}`})`);
                        setIsDropdownOpen(false);
                      }}
                      className="p-3 hover:bg-teal-50/80 cursor-pointer transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{patientName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                            {p.registration_id || `REG-${String(p.patient_id).padStart(5, '0')}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {p.mobile_number} • {p.age ? `${p.age} yrs` : '—'} • {p.gender} • {p.village || p.village_mandal || p.address || 'Local'}
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isExp ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isExp ? 'EXPIRED' : 'ACTIVE'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {selectedPatient && (
          <div className="p-4 bg-teal-50/60 rounded-2xl border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider block">Selected Patient</span>
              <div className="text-sm font-bold text-slate-900">{selectedPatient.full_name || selectedPatient.patient_name || selectedPatient.name}</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                {selectedPatient.registration_id || `REG-${String(selectedPatient.patient_id).padStart(5, '0')}`} • {selectedPatient.mobile_number} • {selectedPatient.age} yrs • {selectedPatient.gender}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 self-start sm:self-auto">
                Ready for Renewal
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Renewal Details & Payment Form */}
      {selectedPatient && (
        <form onSubmit={handleRenew} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
              Step 2: Assign Doctor & Renewal Fee Billing
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Assigned Doctor *
                </label>
                <select
                  required
                  value={formData.assigned_doctor_id}
                  onChange={(e) => setFormData({ ...formData, assigned_doctor_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold"
                >
                  {doctors.map((doc) => (
                    <option key={doc.doctor_id} value={doc.doctor_id}>
                      {formatDocName(doc.doctor_name || doc.full_name)} ({doc.specialization})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Appointment Date *
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={formData.appointment_date}
                  onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Appointment Time *
                </label>
                <select
                  required
                  value={formData.appointment_time}
                  onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                >
                  {['09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00', '12:00:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00', '17:00:00'].map((t) => (
                    <option key={t} value={t}>
                      {t.slice(0, 5)} hrs
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fees Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Renewal Fee</span>
                <span className="text-lg font-black text-slate-900 font-mono">₹{renewalFee}</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={renewalFee}
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>

              <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200">
                <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider block">Final Payable</span>
                <span className="text-lg font-black text-teal-900 font-mono">₹{finalFee}</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR</option>
                  <option value="card">Card</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="bajaj_pay">Bajaj Pay</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Amount Collected Today (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={finalFee}
                  value={formData.payment_amount}
                  onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                  placeholder={`Full amount: ₹${finalFee}`}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono font-bold"
                />
                {dueAmt > 0 && (
                  <span className="text-[11px] text-red-600 font-bold mt-1 block">
                    Remaining ₹{dueAmt} will be recorded as due.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Remarks / Renewal Notes
                </label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g. Annual renewal extension"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={renewing}
              className="flex items-center gap-2 px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-500/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{renewing ? 'Processing Renewal...' : 'Confirm Registration Renewal'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Renewal Confirmation / Receipt Modal */}
      {completedRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-emerald-600 text-white p-6 text-center relative">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 backdrop-blur-xs">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-lg font-black tracking-tight">Registration Renewal Completed</h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Invoice & Consultation Appointment Created Successfully
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Invoice Number</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {completedRenewal.bill?.bill_number || 'INV-00000'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Patient</span>
                  <span className="font-bold text-slate-800">
                    {completedRenewal.patient?.full_name || completedRenewal.patient?.patient_name || completedRenewal.patient?.name} ({completedRenewal.patient?.registration_id})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Assigned Doctor</span>
                  <span className="font-bold text-slate-800">
                    {formatDocName(completedRenewal.doctor?.doctor_name || completedRenewal.doctor?.full_name)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">New Registration Expiry</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {completedRenewal.new_expiry}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{completedRenewal.paid_amount} ({formData.payment_method.toUpperCase()})
                  </span>
                </div>
                {completedRenewal.due_amount > 0 && (
                  <div className="flex justify-between items-center text-red-600 font-bold">
                    <span>Due Amount</span>
                    <span className="font-mono">₹{completedRenewal.due_amount}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetForNext}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer text-center"
                >
                  Renew Another
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/receptionist/check-in')}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20"
                >
                  <span>Go to Waiting Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
