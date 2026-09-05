import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../components/common/Modal';
import { receptionistApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  Stethoscope,
  ShieldCheck,
  Users,
  HeartHandshake,
  Calendar
} from 'lucide-react';

const InvoiceReceiptCard = ({
  currentPatient,
  currentInvoice,
  referral,
  formattedDate,
  baseFee,
  discount,
  finalAmount,
  paidAmount,
  dueAmount,
  isPaidInFull,
  regExpiry,
  formatCurrency,
  formatDocName
}) => {
  return (
    <div className="bg-white text-slate-800 p-5 rounded-xl border border-slate-200 space-y-3.5 text-xs font-sans">
      {/* 1. Hospital Header */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white p-1 border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
              <img
                src="/assets/wecare_logo.png"
                alt="WeCare Homeopathy"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/src/assets/wecare.logo.png';
                }}
              />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                WeCare Homeopathy Clinics
              </h2>
              <p className="text-[11px] text-blue-700 font-semibold">Karimnagar Main Branch (KRM001)</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 pt-0.5">
            Plot #12, Near Medical Center, Collectorate Road, Karimnagar • Ph: +91 98765 43210
          </p>
        </div>

        <div className="text-right">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
            OPD Consultation Memo
          </span>
          <div className="font-mono font-bold text-blue-700 text-xs mt-1">
            {currentInvoice?.bill_number || `INV-${String(currentPatient?.patient_id || 1).padStart(5, '0')}`}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">{formattedDate}</div>
        </div>
      </div>

      {/* 2. Patient & Doctor Meta Grid */}
      <div className="grid grid-cols-2 gap-3.5 p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
        {/* Patient Details */}
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Patient Information
          </span>
          <div className="font-bold text-slate-900 text-sm">
            {currentPatient?.full_name || currentPatient?.patient_name || 'Patient'}
          </div>
          <div className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-700">Reg ID:</span>{' '}
            <span className="font-mono font-bold text-blue-700">
              {currentPatient?.registration_id || `REG-${String(currentPatient?.patient_id || 0).padStart(5, '0')}`}
            </span>{' '}
            • #{currentPatient?.patient_id}
          </div>
          <div className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-700">Contact:</span>{' '}
            <span className="font-mono font-bold">{currentPatient?.mobile_number || '—'}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {currentPatient?.age ? `${currentPatient.age} yrs` : ''}{' '}
            {currentPatient?.gender ? `• ${currentPatient.gender.toUpperCase()}` : ''}{' '}
            {currentPatient?.village || currentPatient?.village_mandal || currentPatient?.location ? `• ${currentPatient.village || currentPatient.village_mandal || currentPatient.location}` : ''}
          </div>

          {/* Referral Information (Rendered ONLY if patient has referral) */}
          {referral && referral.is_referral && (
            <div className="mt-2 pt-1.5 border-t border-slate-200/90 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  {referral.referral_type === 'employee' ? (
                    <Users className="w-3 h-3 text-purple-600" />
                  ) : (
                    <HeartHandshake className="w-3 h-3 text-indigo-600" />
                  )}
                  <span>Referred By</span>
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                    referral.referral_type === 'employee'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}
                >
                  {referral.referral_type_label || (referral.referral_type === 'employee' ? 'Employee Referral' : 'Patient Referral')}
                </span>
              </div>

              <div className="font-bold text-slate-900 text-xs">
                {referral.referrer_name}
              </div>

              <div className="text-[10px] text-slate-500 font-mono">
                {referral.referral_type === 'employee' ? (
                  <span>
                    Employee ID: <strong className="text-slate-800">{referral.referrer_id}</strong>
                    {referral.department && ` • ${referral.department}`}
                  </span>
                ) : (
                  <span>
                    Reg ID: <strong className="text-indigo-700">{referral.referrer_id}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Consultation & Doctor Details */}
        <div className="space-y-0.5 text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Consultation & Schedule
          </span>
          <div className="font-bold text-slate-900 text-sm flex items-center justify-end gap-1">
            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
            <span>{formatDocName(currentInvoice?.doctor_name || currentPatient?.current_doctor_name)}</span>
          </div>
          <div className="text-[11px] text-slate-600">
            {currentInvoice?.specialization || 'Homeopathic Physician'} • {currentInvoice?.qualification || 'BHMS / MD'}
          </div>
          <div className="text-[11px] text-slate-600 capitalize">
            Type: <span className="font-bold text-slate-800">{currentInvoice?.appointment_type || 'New Consultation'}</span>
          </div>
          {(currentInvoice?.appointment_date || currentInvoice?.appointment_time) && (
            <div className="text-[11px] text-slate-700 font-medium flex items-center justify-end gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className="text-slate-500">Scheduled:</span>{' '}
              <span className="font-bold text-slate-900">
                {currentInvoice?.appointment_date
                  ? new Date(currentInvoice.appointment_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })
                  : '—'}
              </span>
              {currentInvoice?.appointment_time && (
                <span className="text-slate-600 font-mono">
                  at {currentInvoice.appointment_time.slice(0, 5)} hrs
                </span>
              )}
            </div>
          )}
          <div className="pt-0.5">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isPaidInFull ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isPaidInFull ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              <span>{isPaidInFull ? 'PAID IN FULL' : 'PARTIAL / DUE'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Itemized Financial Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">Service / Fee Description</th>
              <th className="py-2 px-3 text-right">Standard Fee</th>
              <th className="py-2 px-3 text-right">Discount</th>
              <th className="py-2 px-3 text-right">Net Payable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            <tr>
              <td className="py-2.5 px-3 font-mono text-slate-400">01</td>
              <td className="py-2.5 px-3">
                <div className="font-bold text-slate-800">
                  OPD Doctor Consultation & Clinical Assessment
                </div>
                <div className="text-[10px] text-slate-400">
                  Includes standard 30-day follow-up consultation entitlement
                </div>
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCurrency(baseFee)}</td>
              <td className="py-2.5 px-3 text-right font-mono text-red-600">
                {discount > 0 ? `-₹${discount.toFixed(2)}` : '—'}
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                {formatCurrency(finalAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Financial Totals Strip */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 space-y-1 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Total Consultation Amount:</span>
            <span className="font-mono font-semibold text-slate-900">{formatCurrency(finalAmount)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span className="flex items-center gap-1">
              <span>Paid via</span>
              <span className="uppercase font-bold text-slate-800">
                {currentInvoice?.payment_method || 'CASH'}
              </span>
              <span>:</span>
            </span>
            <span className="font-mono font-bold text-emerald-700">{formatCurrency(paidAmount)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-200">
            <span className={`font-bold ${dueAmount > 0 ? 'text-red-600' : 'text-slate-700'}`}>
              Outstanding Balance (Due):
            </span>
            <span className={`font-mono font-bold ${dueAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              DUE : {formatCurrency(dueAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Terms & Conditions Section */}
      <div className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1 text-[9px] leading-relaxed text-slate-600">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-0.5 font-bold uppercase tracking-wider text-[9.5px]">
          <span className="text-slate-800 flex items-center gap-1">
            <FileText className="w-3 h-3 text-blue-600" />
            <span>Terms & Conditions</span>
          </span>
          <span className={`font-mono font-extrabold ${dueAmount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            DUE : {formatCurrency(dueAmount)}
          </span>
        </div>

        <ol className="list-decimal list-inside space-y-0.5 text-slate-500 pl-0.5">
          <li>The facilities of joining the card includes any number of consultations with physician. Only the bearer can avail the facilities of the card.</li>
          <li>The card facilities are given only to the one on whose name the card is made.</li>
          <li>The fee is non transferable, non refundable and non extendable.</li>
          <li>Patients are strictly advised to use medicines as per attending physicians recommendation. We assume patients have the responsibility to inform the attending physician about the status of the health or any serious disorder during the course of treatment.</li>
          <li>We expect & would appreciate patients to visit the clinic as per the due date of their consultations.</li>
          <li>Patients are requested to co-operate with the mode of treatment, as sometimes, the speed of recovery is slow (the time of recovery may vary).</li>
          <li>The duration of treatment and results may vary from patient.</li>
          <li>The Doctor and the clinic has given no guarantee to me (Patient) about the results and duration of the treatment.</li>
          <li>During critical emergencies patients / attendants are adviced to inform the attending physician.</li>
          <li>Case Sheet Record are (Digital) and kept with the Doctor (in Server) till the end of the course of the treatment.</li>
          <li>This Corporate Clinic, promises to provide Best Service and Treatment to all Patients.</li>
          <li>All disputes are subject to Hyderabad Court Jurisdication only. E&OE.</li>
        </ol>
      </div>

      {/* 5. Receptionist & Validity Footer */}
      <div className="pt-1.5 flex items-end justify-between border-t border-slate-200 text-[10px] text-slate-500">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Received By: {currentInvoice?.cashier_name || 'Reception Desk'} ({currentInvoice?.cashier_employee_id || 'REC_OPD'})</span>
          </div>
          <p className="text-[10px] text-slate-400">
            Registration Validity:{' '}
            <span className="font-bold text-slate-700">
              {regExpiry ? new Date(regExpiry).toLocaleDateString() : '30 Days from issue'}
            </span>
          </p>
          <p className="text-[9px] text-slate-400 italic">
            * Computer-generated tax invoice. No signature required.
          </p>
        </div>

        <div className="text-right">
          <div className="inline-block border border-slate-300 rounded-lg p-1.5 bg-slate-50/50 text-center">
            <div className="w-20 h-5 border-b border-dashed border-slate-300 mb-0.5 flex items-center justify-center text-[9px] text-slate-400">
              [ HOSPITAL SEAL ]
            </div>
            <span className="text-[9px] font-bold text-slate-600 block uppercase tracking-wider">
              Authorized Cashier
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PatientInvoiceReceiptModal = ({ isOpen, onClose, patient, patientId }) => {
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState(0);
  const { showToast } = useToast();

  const targetId = patientId || patient?.patient_id;

  useEffect(() => {
    if (isOpen && targetId) {
      fetchInvoices();
    } else {
      setInvoiceData(null);
      setSelectedInvoiceIndex(0);
    }
  }, [isOpen, targetId]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await receptionistApi.getPatientInvoices(targetId);
      if (res.success && res.data) {
        setInvoiceData(res.data);
      } else {
        showToast('Failed to load patient invoices', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch invoice details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val || 0);

  const formatDocName = (name) => {
    if (!name) return 'Consultant Doctor';
    return name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`;
  };

  const currentPatient = invoiceData?.patient || patient;
  const invoices = invoiceData?.invoices || [];
  const currentInvoice = invoices[selectedInvoiceIndex] || invoiceData?.latest_invoice;
  const referral = invoiceData?.referral || invoiceData?.patient?.referral || currentPatient?.referral;

  const baseFee = parseFloat(currentInvoice?.amount || 500);
  const discount = parseFloat(currentInvoice?.discount_amount || 0);
  const finalAmount = parseFloat(currentInvoice?.final_amount || (baseFee - discount));
  const paidAmount = parseFloat(currentInvoice?.paid_amount !== undefined ? currentInvoice.paid_amount : finalAmount);
  const dueAmount = parseFloat(currentInvoice?.due_amount !== undefined ? currentInvoice.due_amount : Math.max(0, finalAmount - paidAmount));
  const isPaidInFull = dueAmount <= 0;

  const regExpiry = currentPatient?.registration_expiry || currentPatient?.expiry_date;
  const formattedDate = currentInvoice?.created_at
    ? new Date(currentInvoice.created_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const invoiceProps = {
    currentPatient,
    currentInvoice,
    referral,
    formattedDate,
    baseFee,
    discount,
    finalAmount,
    paidAmount,
    dueAmount,
    isPaidInFull,
    regExpiry,
    formatCurrency,
    formatDocName
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Patient Consultation Invoice & Cash Memo" maxWidth="max-w-2xl">
        {loading ? (
          <div className="py-12">
            <LoadingSpinner label="Generating official invoice receipt..." />
          </div>
        ) : !currentInvoice && !currentPatient ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            No consultation invoice found for this patient record.
          </div>
        ) : (
          <div className="space-y-4 text-xs text-slate-800">
            {/* Invoice Version Selector if patient has multiple bills */}
            {invoices.length > 1 && (
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto print:hidden">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 px-2">
                  Invoices ({invoices.length}):
                </span>
                {invoices.map((inv, idx) => (
                  <button
                    key={inv.bill_id || idx}
                    onClick={() => setSelectedInvoiceIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shrink-0 ${
                      selectedInvoiceIndex === idx
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {inv.bill_number || `INV-#${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            {/* On-Screen Modal Preview */}
            <div className="print:hidden">
              <InvoiceReceiptCard {...invoiceProps} />
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-between pt-2 print:hidden border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Click print to output receipt on 80mm slip or A4 page.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Invoice</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Dedicated Clean Print Portal Mounted Directly to Body */}
      {isOpen &&
        (currentInvoice || currentPatient) &&
        createPortal(
          <div id="print-root-invoice">
            <InvoiceReceiptCard {...invoiceProps} />
          </div>,
          document.body
        )}

      {/* Global Print Media Rules */}
      <style>{`
        #print-root-invoice {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide entire interactive app & background */
          #root {
            display: none !important;
          }

          /* Display ONLY the dedicated body-portaled receipt */
          #print-root-invoice {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          #print-root-invoice > div {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </>
  );
};

