import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { proApi } from '../../api';
import { LoadingSpinner } from './LoadingSpinner';

const PAYMENT_METHODS = [
  { value: 'cash',      label: 'Cash' },
  { value: 'upi',       label: 'UPI' },
  { value: 'razorpay',  label: 'Razor Pay' },
  { value: 'bajaj_pay', label: 'Bajaj Pay' },
  { value: 'card',      label: 'Debit / Credit Card' },
];

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

/**
 * PROPaymentModal — Inline payment modal (NO page navigation).
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
      const finalAmt  = parseFloat(propBill.final_amount || propBill.total_amount || 0);
      const paidAmt   = parseFloat(propBill.paid_amount || 0);
      const remaining = Math.max(0, finalAmt - paidAmt);
      setForm({ amount: remaining > 0 ? String(remaining) : '', payment_method: '', remarks: '' });
    } else {
      setForm({ amount: '', payment_method: '', remarks: '' });
    }
  }, [isOpen, propBill]);

  if (!isOpen) return null;

  const bill         = propBill;
  const finalAmount  = parseFloat(bill?.final_amount || bill?.total_amount || 0);
  const paidAmount   = parseFloat(bill?.paid_amount || 0);
  const remainingDue = Math.max(0, finalAmount - paidAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(form.amount);
    if (!form.payment_method) {
      setError('Please select a payment method');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setError('Payment amount must be a positive number');
      return;
    }
    if (amount > remainingDue + 0.01) {
      setError(`Payment amount ₹${amount} exceeds remaining due ₹${remainingDue.toFixed(2)}`);
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

  const isValid = form.payment_method && parseFloat(form.amount) > 0;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-black text-slate-900">Record Payment</span>
            {bill?.bill_number && (
              <span className="font-mono text-xs text-slate-500 font-bold">— {bill.bill_number}</span>
            )}
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bill Summary */}
        <div className="px-5 pt-4 pb-0">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs space-y-1.5 mb-4">
            {bill?.patient_name && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Patient</span>
                <span className="font-bold text-slate-900">{bill.patient_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Final Amount</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(finalAmount)}</span>
            </div>
            {paidAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Already Paid</span>
                <span className="font-mono font-bold text-emerald-700">{formatCurrency(paidAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1">
              <span className="text-slate-700 font-bold">Remaining Due</span>
              <span className="font-mono font-black text-red-600 text-sm">{formatCurrency(remainingDue)}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">

          {/* Payment Amount */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Payment Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={remainingDue}
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder={`Max: ₹${remainingDue.toFixed(0)}`}
              required
              autoFocus
              className="w-full px-3 py-2.5 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              Payment Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {PAYMENT_METHODS.map(m => (
                <label
                  key={m.value}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm font-medium select-none ${
                    form.payment_method === m.value
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={m.value}
                    checked={form.payment_method === m.value}
                    onChange={() => setForm(prev => ({ ...prev, payment_method: m.value }))}
                    className="accent-emerald-600"
                  />
                  {m.label}
                  {form.payment_method === m.value && (
                    <CheckCircle className="w-4 h-4 text-emerald-600 ml-auto" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Remarks (optional) */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Remarks <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.remarks}
              onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="e.g. Partial payment, cheque no..."
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isValid}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <LoadingSpinner size="sm" label="" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirm Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
