/**
 * Safe Financial & Monetary Calculation Utilities
 * Guarantees 2-decimal precision and eliminates IEEE 754 floating-point drift.
 */

function toPaise(val) {
  const num = parseFloat(val || 0);
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100);
}

function fromPaise(paise) {
  return Math.round(paise) / 100;
}

function roundMoney(val) {
  return fromPaise(toPaise(val));
}

function safeAdd(a, b) {
  return fromPaise(toPaise(a) + toPaise(b));
}

function safeSubtract(a, b) {
  return fromPaise(toPaise(a) - toPaise(b));
}

function safeMultiply(price, qty) {
  const numPrice = parseFloat(price || 0);
  const numQty = parseFloat(qty || 0);
  if (isNaN(numPrice) || isNaN(numQty)) return 0;
  return Math.round((numPrice * numQty + Number.EPSILON) * 100) / 100;
}

function formatCurrency(val) {
  const num = roundMoney(val);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

module.exports = {
  toPaise,
  fromPaise,
  roundMoney,
  safeAdd,
  safeSubtract,
  safeMultiply,
  formatCurrency
};
