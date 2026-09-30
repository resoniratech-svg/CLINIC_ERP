/**
 * Safe Financial & Monetary Calculation Utilities
 * Guarantees 2-decimal precision and eliminates IEEE 754 floating-point drift.
 */

export function toPaise(val) {
  const num = parseFloat(val || 0);
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100);
}

export function fromPaise(paise) {
  return Math.round(paise) / 100;
}

export function roundMoney(val) {
  return fromPaise(toPaise(val));
}

export function safeAdd(a, b) {
  return fromPaise(toPaise(a) + toPaise(b));
}

export function safeSubtract(a, b) {
  return fromPaise(toPaise(a) - toPaise(b));
}

export function safeMultiply(price, qty) {
  const numPrice = parseFloat(price || 0);
  const numQty = parseFloat(qty || 0);
  if (isNaN(numPrice) || isNaN(numQty)) return 0;
  return Math.round((numPrice * numQty + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(val) {
  const num = roundMoney(val);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
