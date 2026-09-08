import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  FileText,
  CreditCard,
  Building,
  User,
  Stethoscope,
  Receipt
} from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

export const PROInvoiceModal = ({ billId, initialBill, isOpen, onClose }) => {
  const { showToast } = useToast();
  const [bill, setBill] = useState(initialBill || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (billId) {
      setLoading(true);
      proApi.getBillDetails(billId)
        .then(res => {
          if (res.success && res.data) {
            setBill(res.data);
          } else {
            showToast('Failed to load bill details', 'error');
          }
        })
        .catch(err => {
          showToast(err.message || 'Error loading invoice details', 'error');
        })
        .finally(() => setLoading(false));
    } else if (initialBill) {
      setBill(initialBill);
    }
  }, [isOpen, billId, initialBill, showToast]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const finalAmount = parseFloat(bill?.final_amount || bill?.total_amount || 0);
  const paidAmount = parseFloat(bill?.paid_amount || 0);
  const dueAmount = parseFloat(bill?.due_amount || Math.max(0, finalAmount - paidAmount));
  const isPaid = dueAmount <= 0 || bill?.payment_status === 'paid';

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="print:hidden flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#1565C0]" />
            <span className="text-xs font-bold text-slate-800">
              PRO Treatment / Package Invoice
            </span>
            <span className="font-mono text-xs text-slate-500 font-bold">
              {bill?.bill_number || `#${billId}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1565C0] hover:bg-[#0D47A1] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center">
              <LoadingSpinner label="Loading Invoice Details..." />
            </div>
          ) : !bill ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <span>Invoice not found or could not be loaded.</span>
            </div>
          ) : (
            <div className="space-y-5 text-xs text-slate-800 printable-invoice">
              {/* 1. Hospital Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div className="space-y-1">
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
                      <h2 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                        WeCare Homeopathy Clinics
                      </h2>
                      <p className="text-[11px] text-blue-700 font-bold">
                        Karimnagar Main Branch (KRM001)
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Plot #12, Near Medical Center, Collectorate Road, Karimnagar • Ph: +91 98765 43210
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1565C0] border border-blue-200">
                    {bill.bill_type?.toUpperCase() || 'TREATMENT'} MEMO
                  </span>
                  <div className="font-mono font-bold text-[#1565C0] text-sm mt-1">
                    {bill.bill_number || `BILL-${bill.bill_id}`}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {bill.created_at ? new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleDateString('en-IN')}
                  </div>
                </div>
              </div>

              {/* 2. Patient & Attributed Doctor Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
                {/* Patient Information */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Patient Details</span>
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {bill.patient_name || 'Patient'}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Reg ID:</span>{' '}
                    <span className="font-mono font-bold text-[#1565C0]">
                      {bill.registration_id || `ID #${bill.patient_id}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Mobile:</span>{' '}
                    <span className="font-mono font-bold">{bill.mobile_number || '—'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {bill.age ? `${bill.age} yrs` : ''} {bill.gender ? `• ${String(bill.gender).toUpperCase()}` : ''} {bill.patient_location ? `• ${bill.patient_location}` : ''}
                  </div>
                </div>

                {/* Doctor & Service Details */}
                <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                    <Stethoscope className="w-3 h-3" />
                    <span>Clinical Reference</span>
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {bill.doctor_name ? `Dr. ${bill.doctor_name}` : 'Consulting Doctor'}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Specialization:</span>{' '}
                    <span>{bill.doctor_specialization || 'Homeopathy Specialist'}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Bill Type:</span>{' '}
                    <span className="capitalize font-bold text-slate-800">{bill.bill_type} Charges</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <span>Generated By: <strong>{bill.created_by_name || 'PRO Desk'}</strong></span>
                  </div>
                </div>
              </div>

              {/* 3. Itemized Bill Breakdown */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/90 text-slate-600 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Charge Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(bill.items || []).map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.charge_type || 'Treatment'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.description || 'Treatment Service'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 4. Financial Calculations Grid */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Status</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase inline-flex items-center gap-1 ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : paidAmount > 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                      {isPaid ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      <span>{isPaid ? 'PAID IN FULL' : paidAmount > 0 ? 'PARTIALLY PAID' : 'UNPAID'}</span>
                    </span>
                  </div>
                  {dueAmount > 0 && (
                    <p className="text-[11px] text-red-600 font-semibold pt-1">
                      Outstanding balance of {formatCurrency(dueAmount)} recorded in Patient Dues.
                    </p>
                  )}
                </div>

                <div className="w-full sm:w-64 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(bill.amount || finalAmount)}</span>
                  </div>
                  {parseFloat(bill.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span>- {formatCurrency(bill.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-300">
                    <span>Final Total:</span>
                    <span className="text-[#1565C0]">{formatCurrency(finalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-red-600 font-bold pt-1 border-t border-slate-200">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(dueAmount)}</span>
                  </div>
                </div>
              </div>

              {/* 5. Payments History Ledger */}
              {bill.payments && bill.payments.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Payment Receipts ({bill.payments.length})
                  </div>
                  <div className="space-y-1.5">
                    {bill.payments.map(p => (
                      <div key={p.payment_id} className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-bold text-emerald-900">
                            Receipt #{p.payment_id}
                          </span>
                          <span className="text-slate-500 font-sans capitalize">
                            via {p.payment_method}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-800">{formatCurrency(p.amount)}</span>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Footer Disclaimer & Signatures */}
              <div className="pt-4 border-t border-slate-200 flex items-end justify-between text-[10px] text-slate-500">
                <div>
                  <p>• Computer generated electronic tax invoice. No signature required.</p>
                  <p>• Treatment plans and homeopathic services are non-refundable once initiated.</p>
                </div>
                <div className="text-right">
                  <div className="w-28 border-b border-slate-300 mb-1" />
                  <span className="font-bold text-slate-600">Authorized Signatory</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
