import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { proApi } from '../../api';
import { PaymentMethodSelector } from '../../components/common/PaymentMethodSelector';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatCurrency, roundMoney, safeSubtract, toPaise } from '../../utils/moneyUtils';

/**
 * RefundModal
 * In-app refund modal supporting full and partial refunds with doctor target reversal warnings.
 */
export const RefundModal = ({
  isOpen,
  payment,
  onRefundSuccess,
  onClose
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    refund_method: 'cash',
    reason: ''
  });

  const amountPaid = parseFloat(payment?.amount || 0);
  const alreadyRefunded = parseFloat(payment?.refunded_amount || 0);
  const maxRefundable = Math.max(0, safeSubtract(amountPaid, alreadyRefunded));

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);

    setForm({
      amount: maxRefundable > 0 ? maxRefundable.toFixed(2) : '',
      refund_method: payment?.payment_method || 'cash',
      reason: ''
    });
  }, [isOpen, payment, maxRefundable]);

  if (!isOpen || !payment) return null;

  const parsedAmount = parseFloat(form.amount);
  let amountError = null;
  if (form.amount !== '' && !isNaN(parsedAmount)) {
    if (parsedAmount <= 0) {
      amountError = 'Refund amount must be greater than ₹0';
    } else if (toPaise(parsedAmount) > toPaise(maxRefundable)) {
      amountError = `Refund amount ₹${parsedAmount.toFixed(2)} exceeds maximum refundable of ₹${maxRefundable.toFixed(2)}`;
    }
  }

  const isAmountValid = !isNaN(parsedAmount) && parsedAmount > 0 && toPaise(parsedAmount) <= toPaise(maxRefundable);
  const isReasonValid = Boolean(form.reason && form.reason.trim());
  const isValid = isAmountValid && isReasonValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent double-clicks
    setError(null);

    if (!isValid) {
      setError('Please enter a valid refund amount and provide a refund reason.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.refundPayment(payment.payment_id, {
        amount: parsedAmount,
        refund_method: form.refund_method,
        reason: form.reason.trim()
      });

      if (res.success) {
        if (typeof onRefundSuccess === 'function') {
          onRefundSuccess(res.data);
        }
      } else {
        setError(res.message || 'Failed to process refund. Please try again.');
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to process refund. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 my-auto">

        {/* 1. Header (Sticky Top) */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-black text-slate-900 block leading-tight">Process Payment Refund</span>
              <span className="font-mono text-[11px] text-slate-500 font-bold block truncate">
                Receipt REC-{payment.payment_id} • {payment.bill_number || `Bill #${payment.bill_id}`}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Scrollable Body */}
        <form id="refund-payment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
          
          {/* Target Reversal Warning Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Important Notice: Doctor Target Reversal</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Refunding this payment will reverse the consultant doctor's revenue target contribution by the refunded amount and update net collections across reports.
              </p>
            </div>
          </div>

          {/* Payment & Refund Summary Card */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Patient</span>
              <span className="font-bold text-slate-900">{payment.patient_name || `Patient #${payment.patient_id}`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Invoice Number</span>
              <span className="font-mono font-bold text-slate-800">{payment.bill_number || `Bill #${payment.bill_id}`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Original Paid Amount</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(amountPaid)}</span>
            </div>
            {alreadyRefunded > 0 && (
              <div className="flex justify-between items-center text-red-600">
                <span className="font-medium">Already Refunded</span>
                <span className="font-mono font-bold">{formatCurrency(alreadyRefunded)}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 mt-1">
              <span className="text-slate-800 font-bold">Maximum Refundable</span>
              <span className="font-mono font-black text-emerald-700 text-sm">{formatCurrency(maxRefundable)}</span>
            </div>
          </div>

          {/* Refund Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Refund Amount (₹) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, amount: maxRefundable.toFixed(2) }))}
                className="text-[11px] font-bold text-[#1565C0] hover:underline cursor-pointer"
              >
                Refund Full Balance ({formatCurrency(maxRefundable)})
              </button>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={maxRefundable.toFixed(2)}
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder={`Max: ₹${maxRefundable.toFixed(2)}`}
              required
              autoFocus
              className={`w-full px-3 py-2 text-sm font-mono font-bold border rounded-xl focus:outline-none focus:ring-2 transition ${
                amountError
                  ? 'border-red-400 focus:ring-red-400/20 bg-red-50/20 text-red-900'
                  : 'border-slate-300 focus:ring-red-500 focus:border-red-400'
              }`}
            />
            {amountError && (
              <p className="text-[11px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{amountError}</span>
              </p>
            )}
          </div>

          {/* Refund Method Selector */}
          <PaymentMethodSelector
            label="Refund Method"
            value={form.refund_method}
            onChange={(m) => setForm(prev => ({ ...prev, refund_method: m }))}
            disabled={submitting}
            name="refund_method"
          />

          {/* Reason (Required) */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Refund Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={form.reason}
              onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="State the reason for this refund (e.g., patient cancelled appointment, treatment discontinued, billing correction)..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-400 transition resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* 3. Footer (Sticky Bottom) */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="refund-payment-form"
            disabled={submitting || !isValid}
            className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <LoadingSpinner size="sm" label="" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Refund</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
