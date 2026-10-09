import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AutocompleteSearch, HighlightMatch } from '../../components/common/AutocompleteSearch';
import { PatientInvoiceReceiptModal } from './PatientInvoiceReceiptModal';
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

  const [selectedPatient, setSelectedPatient] = useState(location.state?.patient || null);
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
        const docRes = await receptionistApi.getActiveDoctors();
        if (docRes.success && docRes.data?.length > 0) {
          setDoctors(docRes.data);
          setFormData((prev) => ({ ...prev, assigned_doctor_id: docRes.data[0].doctor_id }));
        }
      } catch (err) {
        showToast('Failed to load active doctors', 'error');
      }
    };
    fetchPrerequisites();
  }, []);

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

        <div className="space-y-2">
          <AutocompleteSearch
            searchFn={(term) => receptionistApi.searchPatients({ search: term })}
            onSelect={(p) => setSelectedPatient(p)}
            onClear={() => setSelectedPatient(null)}
            placeholder="Type Patient Name, Mobile Number, or Registration ID..."
            findButtonText="Find Patient"
            findButtonColor="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white"
            inputClassName="border-slate-300 focus:ring-teal-500 py-2 text-xs rounded-xl"
            renderItem={(p, { isSelected, query }) => {
              const patientName = p.full_name || p.patient_name || p.name || 'Patient';
              const regExpiry = p.registration_expiry || p.expiry_date;
              const isExp = p.registration_status === 'expired' || (regExpiry && new Date(regExpiry) < new Date());

              return (
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <HighlightMatch text={patientName} query={query} />
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600">
                        <HighlightMatch text={p.registration_id || `REG-${String(p.patient_id).padStart(5, '0')}`} query={query} />
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      <HighlightMatch text={p.mobile_number} query={query} /> • {p.age ? `${p.age} yrs` : '—'} • {p.gender} • {p.village || p.village_mandal || p.address || 'Local'}
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
            }}
          />
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

      {/* Real Patient Consultation Invoice & Cash Memo Modal */}
      <PatientInvoiceReceiptModal
        isOpen={!!completedRenewal}
        onClose={handleResetForNext}
        patientId={completedRenewal?.patient?.patient_id}
        patient={completedRenewal?.patient}
        targetInvoiceId={completedRenewal?.bill?.bill_id || completedRenewal?.bill?.bill_number}
        successBanner="Registration renewal and consultation scheduled successfully!"
        onRegisterAnother={handleResetForNext}
        onGoToQueue={() => navigate('/receptionist/check-in')}
      />
    </div>
  );
};
