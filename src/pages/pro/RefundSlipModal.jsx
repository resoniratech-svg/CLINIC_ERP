import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, RotateCcw, AlertCircle, CheckCircle, HeartHandshake } from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/moneyUtils';

/**
 * RefundSlipModal
 * Printable official Refund Voucher & Credit Memo matching WeCare Homeopathy invoice format.
 */
export const RefundSlipModal = ({
  isOpen,
  refundId,
  slipData: initialSlipData,
  onClose
}) => {
  const [slip, setSlip] = useState(initialSlipData || null);
  const [loading, setLoading] = useState(!initialSlipData && Boolean(refundId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialSlipData) {
      setSlip(initialSlipData);
      setLoading(false);
      return;
    }

    if (refundId) {
      setLoading(true);
      setError(null);
      proApi.getRefundById(refundId)
        .then(res => {
          if (res.success && res.data) {
            setSlip(res.data);
          } else {
            setError(res.message || 'Failed to load refund voucher details');
          }
        })
        .catch(err => {
          setError(err?.response?.data?.message || err?.message || 'Error fetching refund slip');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, refundId, initialSlipData]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = slip?.created_at
    ? new Date(slip.created_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150 my-auto print:max-h-none print:shadow-none print:border-none print:w-full">

        {/* Action Bar (Hidden on Print) */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-red-600" />
            <span className="text-sm font-black text-slate-900">Patient Refund Slip</span>
            {slip?.refund_number && (
              <span className="font-mono text-xs text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                {slip.refund_number}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !slip}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1565C0] hover:bg-[#0D47A1] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 print:p-0 print:overflow-visible">
          {loading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="md" label="Loading refund voucher..." />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to load refund voucher</span>
              </div>
              <p>{error}</p>
            </div>
          ) : slip ? (
            <div className="bg-white text-slate-800 rounded-xl border border-slate-200 p-5 space-y-4 text-xs font-sans print:border-none print:p-0">
              
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
                      <p className="text-[11px] text-blue-700 font-semibold">
                        {slip.branch_name || 'Karimnagar Main Branch (KNR001)'}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    {slip.branch_address || 'Plot #12, Near Medical Center, Collectorate Road, Karimnagar'} • Ph: {slip.branch_phone || '+91 98765 43210'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                    Refund Voucher & Credit Memo
                  </span>
                  <div className="font-mono font-bold text-red-700 text-xs mt-1">
                    {slip.refund_number}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{formattedDate}</div>
                </div>
              </div>

              {/* 2. Patient & Transaction Grid */}
              <div className="grid grid-cols-2 gap-3.5 p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                {/* Patient Information */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Patient Information
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {slip.patient_name || 'Patient'}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Reg ID:</span>{' '}
                    <span className="font-mono font-bold text-blue-700">
                      {slip.registration_id || `REG-${String(slip.patient_id).padStart(5, '0')}`}
                    </span>{' '}
                    • #{slip.patient_id}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Contact:</span>{' '}
                    <span className="font-mono font-bold">{slip.mobile_number || '—'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {slip.age ? `${slip.age} yrs` : ''}{' '}
                    {slip.gender ? `• ${slip.gender.toUpperCase()}` : ''}{' '}
                    {slip.patient_location ? `• ${slip.patient_location}` : ''}
                  </div>
                </div>

                {/* Original Transaction Details */}
                <div className="space-y-0.5 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Original Transaction
                  </span>
                  <div className="font-mono text-slate-800">
                    Receipt: <strong className="font-bold text-slate-900">REC-{slip.payment_id}</strong>
                  </div>
                  <div className="font-mono text-slate-800">
                    Invoice: <strong className="font-bold text-blue-700">{slip.bill_number}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Invoice Total: <strong className="font-mono">{formatCurrency(slip.bill_final_amount)}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Original Payment: <strong className="font-mono">{formatCurrency(slip.original_payment_amount)}</strong> ({slip.original_payment_method?.toUpperCase()})
                  </div>
                </div>
              </div>

              {/* 3. Refund Details Breakdown */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">Payment Reversal / Refund</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Reason: <span className="text-slate-700 font-medium">{slip.reason}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {slip.refund_method?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-red-600 text-sm">
                        {formatCurrency(slip.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4. Financial Summary Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="space-y-1">
                  <div className="text-slate-500">Processed By:</div>
                  <div className="font-bold text-slate-900">{slip.refunded_by_name || 'PRO / Manager'}</div>
                  <div className="text-[10px] text-slate-400 font-mono">ID #{slip.refunded_by}</div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Retained on Invoice:</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(slip.net_bill_paid)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1">
                    <span className="text-slate-700 font-bold">Invoice Outstanding Due:</span>
                    <span className="font-mono font-bold text-red-600">{formatCurrency(slip.remaining_due)}</span>
                  </div>
                </div>
              </div>

              {/* 5. Footer & Terms */}
              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-400 flex items-center justify-between">
                <div>
                  <p>• Refund recorded in WeCare Homeopathy ERP system.</p>
                  <p>• Doctor targets and collections ledger adjusted accordingly.</p>
                </div>
                <div className="text-right">
                  <div className="h-8 border-b border-slate-300 w-32 ml-auto mb-1"></div>
                  <div className="font-medium text-slate-600">Authorized Signature</div>
                </div>
              </div>

            </div>
          ) : null}
        </div>

        {/* Bottom Footer (Hidden on Print) */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-200 print:hidden">
          <div className="text-[11px] text-slate-500">
            Official WeCare Homeopathy Patient Refund Record
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !slip}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1565C0] hover:bg-[#0D47A1] rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Refund Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
