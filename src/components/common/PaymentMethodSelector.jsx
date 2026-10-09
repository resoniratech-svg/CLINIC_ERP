import React from 'react';
import { Banknote, Smartphone, Zap, ShieldCheck, CreditCard, CheckCircle } from 'lucide-react';

export const PAYMENT_METHODS = [
  { value: 'cash',      label: 'Cash',                icon: Banknote,    color: 'text-emerald-600',  bg: 'bg-emerald-50' },
  { value: 'upi',       label: 'UPI',                 icon: Smartphone,  color: 'text-blue-600',     bg: 'bg-blue-50' },
  { value: 'razorpay',  label: 'Razor Pay',           icon: Zap,         color: 'text-indigo-600',   bg: 'bg-indigo-50' },
  { value: 'bajaj_pay', label: 'Bajaj Pay',           icon: ShieldCheck, color: 'text-amber-600',    bg: 'bg-amber-50' },
  { value: 'card',      label: 'Debit / Credit Card', icon: CreditCard,  color: 'text-purple-600',   bg: 'bg-purple-50' },
];

/**
 * PaymentMethodSelector
 * Responsive, accessible payment method picker (~3 cols desktop, 2 tablet, 1 mobile).
 */
export const PaymentMethodSelector = ({
  value,
  onChange,
  disabled = false,
  name = 'payment_method',
  label = 'Payment Type',
  required = true,
  className = ''
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-slate-700 block">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PAYMENT_METHODS.map(m => {
          const IconComponent = m.icon;
          const isSelected = value === m.value;
          return (
            <label
              key={m.value}
              className={`relative flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer select-none transition min-h-[46px] ${
                disabled
                  ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                  : isSelected
                  ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={m.value}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(m.value)}
                className="sr-only"
              />
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-600 text-white' : `${m.bg} ${m.color}`}`}>
                <IconComponent className="w-4 h-4" />
              </div>
              <span className="flex-1 truncate leading-tight">{m.label}</span>
              {isSelected ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
};
