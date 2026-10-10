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

/**
 * Shared helper to determine if any line on an invoice has a discount > 0.
 * Decides whether the Discount column and discount totals rows should be shown.
 *
 * @param {Array} lines - Array of invoice line items or discount values
 * @returns {boolean} - true if at least one line has discount > 0
 */
export function hasDiscount(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return false;
  return lines.some((l) => {
    if (l == null) return false;
    const val = typeof l === 'object' ? (l.discount ?? l.discount_amount ?? 0) : l;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  });
}

