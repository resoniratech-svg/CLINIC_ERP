import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CreditCard, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from './LoadingSpinner';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { formatCurrency, toPaise, roundMoney, safeSubtract } from '../../utils/moneyUtils';

/**
 * PROPaymentModal — Responsive inline payment modal (NO page navigation).
 *
 * Props:
 *   isOpen           {boolean}
 *   billId           {number}   bill_id
 *   bill             {object}   optional pre-loaded bill row (for display)
 *   onPaymentRecorded {function(data)} called with API response data after success
 *   onClose          {function}
 */
export const PROPaymentModal = ({ isOpen, billId, bill: propBill, onPaymentRecorded, onClose }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    payment_method: '',
    remarks: ''
  });

  // Pre-fill amount with remaining due when bill data is available
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);

    if (propBill) {
      const finalAmt  = roundMoney(propBill.final_amount || propBill.total_amount || 0);
      const paidAmt   = roundMoney(propBill.paid_amount || 0);
      const remaining = safeSubtract(finalAmt, paidAmt);
      setForm({
        amount: remaining > 0 ? remaining.toFixed(2) : '',
        payment_method: '',
        remarks: ''
      });
    } else {
      setForm({ amount: '', payment_method: '', remarks: '' });
    }
  }, [isOpen, propBill]);

  if (!isOpen) return null;

  const bill         = propBill;
  const finalAmount  = roundMoney(bill?.final_amount || bill?.total_amount || 0);
  const paidAmount   = roundMoney(bill?.paid_amount || 0);
  const remainingDue = safeSubtract(finalAmount, paidAmount);

  // Validate amount in real-time for inline feedback
  const parsedAmount = parseFloat(form.amount);
  let amountError = null;
  if (form.amount !== '' && !isNaN(parsedAmount)) {
    if (parsedAmount <= 0) {
      amountError = 'Payment amount must be greater than ₹0';
    } else if (toPaise(parsedAmount) > toPaise(remainingDue)) {
      amountError = `Amount ₹${parsedAmount.toFixed(2)} exceeds remaining due of ₹${remainingDue.toFixed(2)}`;
    }
  }

  const isAmountValid = !isNaN(parsedAmount) && parsedAmount > 0 && toPaise(parsedAmount) <= toPaise(remainingDue);
  const isMethodValid = Boolean(form.payment_method);
  const isValid = isAmountValid && isMethodValid;

  // Helpful hint when disabled
  let disabledHint = null;
  if (!isValid) {
    if (!form.amount && !form.payment_method) {
      disabledHint = 'Enter a payment amount and select a payment type to proceed.';
    } else if (!isAmountValid) {
      disabledHint = amountError || 'Enter a valid payment amount greater than ₹0 and within remaining due.';
    } else if (!isMethodValid) {
      disabledHint = 'Please select a payment type.';
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amount = roundMoney(form.amount);
    if (!form.payment_method) {
      setError('Please select a payment method');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setError('Payment amount must be a positive number');
      return;
    }
    if (toPaise(amount) > toPaise(remainingDue)) {
      setError(`Payment amount ₹${amount.toFixed(2)} exceeds remaining due ₹${remainingDue.toFixed(2)}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await proApi.recordPayment({
        bill_id: parseInt(billId, 10),
        amount,
        payment_method: form.payment_method,
        remarks: form.remarks || null
      });

      if (res.success) {
        if (typeof onPaymentRecorded === 'function') {
          onPaymentRecorded(res.data);
        }
      } else {
        setError(res.message || 'Payment failed. Please try again.');
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to record payment. Please try again.'
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
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-black text-slate-900 block leading-tight">Record Payment</span>
              {bill?.bill_number && (
                <span className="font-mono text-[11px] text-slate-500 font-bold block truncate">{bill.bill_number}</span>
              )}
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
        <form id="record-payment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
          {/* Bill Summary */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs space-y-1.5">
            {bill?.patient_name && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Patient</span>
                <span className="font-bold text-slate-900">{bill.patient_name}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Final Amount</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(finalAmount)}</span>
            </div>
            {paidAmount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Already Paid</span>
                <span className="font-mono font-bold text-emerald-700">{formatCurrency(paidAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 mt-1">
              <span className="text-slate-700 font-bold">Remaining Due</span>
              <span className="font-mono font-black text-red-600 text-sm">{formatCurrency(remainingDue)}</span>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Payment Amount (₹) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, amount: remainingDue.toFixed(2) }))}
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
              >
                Pay Full Due ({formatCurrency(remainingDue)})
              </button>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={remainingDue.toFixed(2)}
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder={`Max: ₹${remainingDue.toFixed(2)}`}
              required
              autoFocus
              className={`w-full px-3 py-2 text-sm font-mono font-bold border rounded-xl focus:outline-none focus:ring-2 transition ${
                amountError
                  ? 'border-red-400 focus:ring-red-400/20 bg-red-50/20 text-red-900'
                  : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-400'
              }`}
            />
            {amountError && (
              <p className="text-[11px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{amountError}</span>
              </p>
            )}
          </div>

          {/* Responsive Payment Method Selector */}
          <PaymentMethodSelector
            value={form.payment_method}
            onChange={(method) => setForm(prev => ({ ...prev, payment_method: method }))}
            disabled={submitting}
            name="record_payment_method"
          />

          {/* Remarks */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Remarks <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.remarks}
              onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="e.g. Partial installment, bank ref no..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition"
            />
          </div>

          {/* General Error Banner */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Disabled Button Helper Hint */}
          {!submitting && disabledHint && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200/80 px-3 py-1.5 rounded-xl">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>{disabledHint}</span>
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
            form="record-payment-form"
            disabled={submitting || !isValid}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <LoadingSpinner size="sm" label="" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Payment</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
