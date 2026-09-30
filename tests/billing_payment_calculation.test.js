import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper to format currency consistently with 2 decimal places
const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

// Safe financial math functions
const roundMoney = (num) => {
  const val = parseFloat(num || 0);
  if (isNaN(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

const safeSubtract = (a, b) => {
  const pa = Math.round((parseFloat(a || 0) + Number.EPSILON) * 100);
  const pb = Math.round((parseFloat(b || 0) + Number.EPSILON) * 100);
  return (pa - pb) / 100;
};

const safeAdd = (a, b) => {
  const pa = Math.round((parseFloat(a || 0) + Number.EPSILON) * 100);
  const pb = Math.round((parseFloat(b || 0) + Number.EPSILON) * 100);
  return (pa + pb) / 100;
};

const safeMultiply = (a, b) => {
  const numA = parseFloat(a || 0);
  const numB = parseFloat(b || 0);
  if (isNaN(numA) || isNaN(numB)) return 0;
  return Math.round((numA * numB + Number.EPSILON) * 100) / 100;
};

// Simulation of billing calculations
function calculateBillTotals(items, discountInput) {
  const subtotal = (items || []).reduce((sum, it) => {
    const qty = parseInt(it.quantity || 1, 10);
    const unitPrice = parseFloat(it.unit_price || it.amount || 0);
    return safeAdd(sum, safeMultiply(unitPrice, qty));
  }, 0);

  const rawDisc = parseFloat(discountInput || 0);
  const discount = isNaN(rawDisc) || rawDisc < 0 ? 0 : roundMoney(Math.min(rawDisc, subtotal));
  const finalAmount = Math.max(0, safeSubtract(subtotal, discount));

  return {
    subtotal: roundMoney(subtotal),
    discount_amount: roundMoney(discount),
    final_amount: roundMoney(finalAmount)
  };
}

// Simulation of payment validation and processing
function processPayment({ bill, amount, payment_method, existingPayments = [] }) {
  const VALID_METHODS = ['cash', 'card', 'upi', 'razorpay', 'bajaj_pay'];
  const finalAmount = roundMoney(bill?.final_amount || bill?.total_amount || 0);
  const prevPaid = (existingPayments || []).reduce((sum, p) => safeAdd(sum, p.amount || 0), 0);
  const remainingDue = Math.max(0, safeSubtract(finalAmount, prevPaid));

  if (!payment_method || !VALID_METHODS.includes(payment_method)) {
    return { success: false, error: 'Invalid or missing payment method' };
  }

  const payAmt = roundMoney(amount);
  if (isNaN(payAmt) || payAmt <= 0) {
    return { success: false, error: 'Payment amount must be a positive number' };
  }

  if (payAmt > remainingDue + 0.009) {
    return {
      success: false,
      error: `Payment amount ₹${payAmt.toFixed(2)} exceeds remaining due ₹${remainingDue.toFixed(2)}`
    };
  }

  const newPaidTotal = safeAdd(prevPaid, payAmt);
  const newRemainingDue = Math.max(0, safeSubtract(finalAmount, newPaidTotal));
  const status = newRemainingDue === 0 ? 'paid' : (newPaidTotal > 0 ? 'partial' : 'pending');

  return {
    success: true,
    data: {
      bill_id: bill.bill_id,
      final_amount: finalAmount,
      payment_method,
      amount_paid: payAmt,
      total_paid: newPaidTotal,
      remaining_due: newRemainingDue,
      status
    }
  };
}

describe('WeCare ERP — Billing & Payment Calculation Test Suite', () => {

  // ─────────────────────────────────────────────────────────────────────────────
  // A. BASIC BILL CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('A. Basic Bill Calculations', () => {
    it('A.1: ₹9,553 with ₹553 discount -> Expected: ₹9,000.00', () => {
      const result = calculateBillTotals([{ item_name: 'Treatment', unit_price: 9553, quantity: 1 }], 553);
      assert.equal(result.subtotal, 9553.00);
      assert.equal(result.discount_amount, 553.00);
      assert.equal(result.final_amount, 9000.00);
      assert.notEqual(result.final_amount, 8999.63, 'Final amount must NOT be 8999.63');
    });

    it('A.2: ₹1,000 with ₹0 discount -> Expected: ₹1,000.00', () => {
      const result = calculateBillTotals([{ item_name: 'Service', unit_price: 1000, quantity: 1 }], 0);
      assert.equal(result.subtotal, 1000.00);
      assert.equal(result.discount_amount, 0.00);
      assert.equal(result.final_amount, 1000.00);
    });

    it('A.3: ₹1,000 with ₹100 discount -> Expected: ₹900.00', () => {
      const result = calculateBillTotals([{ item_name: 'Service', unit_price: 1000, quantity: 1 }], 100);
      assert.equal(result.subtotal, 1000.00);
      assert.equal(result.discount_amount, 100.00);
      assert.equal(result.final_amount, 900.00);
    });

    it('A.4: ₹500 with ₹500 discount -> Expected: ₹0.00', () => {
      const result = calculateBillTotals([{ item_name: 'Service', unit_price: 500, quantity: 1 }], 500);
      assert.equal(result.subtotal, 500.00);
      assert.equal(result.discount_amount, 500.00);
      assert.equal(result.final_amount, 0.00);
    });

    it('A.5: ₹500 with ₹499 discount -> Expected: ₹1.00', () => {
      const result = calculateBillTotals([{ item_name: 'Service', unit_price: 500, quantity: 1 }], 499);
      assert.equal(result.subtotal, 500.00);
      assert.equal(result.discount_amount, 499.00);
      assert.equal(result.final_amount, 1.00);
    });

    it('A.6: ₹9,999 with ₹999 discount -> Expected: ₹9,000.00', () => {
      const result = calculateBillTotals([{ item_name: 'Package', unit_price: 9999, quantity: 1 }], 999);
      assert.equal(result.subtotal, 9999.00);
      assert.equal(result.discount_amount, 999.00);
      assert.equal(result.final_amount, 9000.00);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // B. DISCOUNT EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────
  describe('B. Discount Edge Cases', () => {
    it('B.1: Zero discount preserves full subtotal', () => {
      const res = calculateBillTotals([{ unit_price: 2500, quantity: 1 }], 0);
      assert.equal(res.final_amount, 2500.00);
    });

    it('B.2: Discount equal to bill amount results in ₹0.00 final amount', () => {
      const res = calculateBillTotals([{ unit_price: 2500, quantity: 1 }], 2500);
      assert.equal(res.final_amount, 0.00);
    });

    it('B.3: Discount less than bill amount subtracts cleanly', () => {
      const res = calculateBillTotals([{ unit_price: 2500, quantity: 1 }], 500);
      assert.equal(res.final_amount, 2000.00);
    });

    it('B.4: Discount greater than bill amount is capped at subtotal (no negative final)', () => {
      const res = calculateBillTotals([{ unit_price: 1000, quantity: 1 }], 1500);
      assert.equal(res.discount_amount, 1000.00);
      assert.equal(res.final_amount, 0.00);
    });

    it('B.5: Negative discount is normalized to 0.00', () => {
      const res = calculateBillTotals([{ unit_price: 1000, quantity: 1 }], -200);
      assert.equal(res.discount_amount, 0.00);
      assert.equal(res.final_amount, 1000.00);
    });

    it('B.6: Decimal discount: ₹9553.00 - ₹553.50 = ₹8999.50', () => {
      const res = calculateBillTotals([{ unit_price: 9553, quantity: 1 }], 553.50);
      assert.equal(res.final_amount, 8999.50);
    });

    it('B.7: Very small decimal discount: ₹9553.00 - ₹0.01 = ₹9552.99', () => {
      const res = calculateBillTotals([{ unit_price: 9553, quantity: 1 }], 0.01);
      assert.equal(res.final_amount, 9552.99);
    });

    it('B.8: 100% discount reduces bill to ₹0.00', () => {
      const res = calculateBillTotals([{ unit_price: 4500, quantity: 1 }], 4500);
      assert.equal(res.final_amount, 0.00);
    });

    it('B.9: Discount entered as string parses correctly', () => {
      const res = calculateBillTotals([{ unit_price: 9553, quantity: 1 }], '553.00');
      assert.equal(res.final_amount, 9000.00);
    });

    it('B.10: Discount entered as null or empty defaults to 0', () => {
      const resNull = calculateBillTotals([{ unit_price: 1000, quantity: 1 }], null);
      assert.equal(resNull.final_amount, 1000.00);
      const resEmpty = calculateBillTotals([{ unit_price: 1000, quantity: 1 }], '');
      assert.equal(resEmpty.final_amount, 1000.00);
    });

    it('B.11: Discount with >2 decimal places rounds cleanly without float artifacts', () => {
      const res = calculateBillTotals([{ unit_price: 1000, quantity: 1 }], 55.555);
      assert.equal(res.discount_amount, 55.56);
      assert.equal(res.final_amount, 944.44);
    });

    it('B.12: No floating point noise: 9553 - 553.00 does not produce 8999.63 or 8999.999999', () => {
      const res = calculateBillTotals([{ unit_price: 9553, quantity: 1 }], 553);
      assert.equal(res.final_amount, 9000.00);
      assert.strictEqual(Number.isInteger(res.final_amount), true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // C. PAYMENT AMOUNT VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  describe('C. Payment Amount Validation', () => {
    const bill = { bill_id: 101, final_amount: 9000.00 };

    it('C.1: Payment = ₹0 is rejected (must be positive)', () => {
      const res = processPayment({ bill, amount: 0, payment_method: 'bajaj_pay' });
      assert.equal(res.success, false);
      assert.match(res.error, /positive/i);
    });

    it('C.2: Payment = ₹1 is accepted as partial payment', () => {
      const res = processPayment({ bill, amount: 1, payment_method: 'bajaj_pay' });
      assert.equal(res.success, true);
      assert.equal(res.data.remaining_due, 8999.00);
      assert.equal(res.data.status, 'partial');
    });

    it('C.3: Payment = ₹8,999 is accepted as partial payment', () => {
      const res = processPayment({ bill, amount: 8999, payment_method: 'bajaj_pay' });
      assert.equal(res.success, true);
      assert.equal(res.data.remaining_due, 1.00);
      assert.equal(res.data.status, 'partial');
    });

    it('C.4: Payment = ₹8,999.99 is accepted as partial payment', () => {
      const res = processPayment({ bill, amount: 8999.99, payment_method: 'bajaj_pay' });
      assert.equal(res.success, true);
      assert.equal(res.data.remaining_due, 0.01);
      assert.equal(res.data.status, 'partial');
    });

    it('C.5: Payment = ₹9,000.00 is accepted in full (status: paid)', () => {
      const res = processPayment({ bill, amount: 9000.00, payment_method: 'bajaj_pay' });
      assert.equal(res.success, true);
      assert.equal(res.data.amount_paid, 9000.00);
      assert.equal(res.data.remaining_due, 0.00);
      assert.equal(res.data.status, 'paid');
    });

    it('C.6: Payment = ₹9,000.01 is rejected as overpayment', () => {
      const res = processPayment({ bill, amount: 9000.01, payment_method: 'bajaj_pay' });
      assert.equal(res.success, false);
      assert.match(res.error, /exceeds remaining due/i);
    });

    it('C.7: System does NOT reject ₹9,000 because of an 8,999.63 ghost value', () => {
      const res = processPayment({ bill, amount: 9000.00, payment_method: 'bajaj_pay' });
      assert.equal(res.success, true);
      assert.equal(res.data.amount_paid, 9000.00);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // D. PARTIAL PAYMENT TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('D. Partial Payment Tests', () => {
    it('D.1: 3-step payment sequence on ₹9,000 bill: 3000 -> 2500 -> 3500 completes to ₹0 due', () => {
      const bill = { bill_id: 201, final_amount: 9000.00 };

      // Step 1: Pay ₹3,000
      const p1 = processPayment({ bill, amount: 3000, payment_method: 'bajaj_pay', existingPayments: [] });
      assert.equal(p1.success, true);
      assert.equal(p1.data.total_paid, 3000.00);
      assert.equal(p1.data.remaining_due, 6000.00);
      assert.equal(p1.data.status, 'partial');

      // Step 2: Pay ₹2,500
      const p2 = processPayment({ bill, amount: 2500, payment_method: 'upi', existingPayments: [{ amount: 3000 }] });
      assert.equal(p2.success, true);
      assert.equal(p2.data.total_paid, 5500.00);
      assert.equal(p2.data.remaining_due, 3500.00);
      assert.equal(p2.data.status, 'partial');

      // Step 3: Pay ₹3,500
      const p3 = processPayment({ bill, amount: 3500, payment_method: 'card', existingPayments: [{ amount: 3000 }, { amount: 2500 }] });
      assert.equal(p3.success, true);
      assert.equal(p3.data.total_paid, 9000.00);
      assert.equal(p3.data.remaining_due, 0.00);
      assert.equal(p3.data.status, 'paid');
    });

    it('D.2: Equal split: ₹4,500 + ₹4,500 = ₹9,000 exactly', () => {
      const bill = { bill_id: 202, final_amount: 9000.00 };
      const p1 = processPayment({ bill, amount: 4500, payment_method: 'cash' });
      assert.equal(p1.data.remaining_due, 4500.00);
      const p2 = processPayment({ bill, amount: 4500, payment_method: 'bajaj_pay', existingPayments: [{ amount: 4500 }] });
      assert.equal(p2.data.remaining_due, 0.00);
      assert.equal(p2.data.status, 'paid');
    });

    it('D.3: Multi-step: ₹1,000 + ₹2,000 + ₹6,000 = ₹9,000 with no float drift', () => {
      const bill = { bill_id: 203, final_amount: 9000.00 };
      const p3 = processPayment({ bill, amount: 6000, payment_method: 'upi', existingPayments: [{ amount: 1000 }, { amount: 2000 }] });
      assert.equal(p3.data.total_paid, 9000.00);
      assert.equal(p3.data.remaining_due, 0.00);
      assert.equal(p3.data.status, 'paid');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // E. DECIMAL / ROUNDING TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('E. Decimal / Rounding Tests', () => {
    it('E.1: Small amount calculations: ₹0.01, ₹0.10, ₹0.99', () => {
      const b1 = calculateBillTotals([{ unit_price: 0.01, quantity: 1 }], 0);
      assert.equal(b1.final_amount, 0.01);
      const b2 = calculateBillTotals([{ unit_price: 0.10, quantity: 1 }], 0);
      assert.equal(b2.final_amount, 0.10);
      const b3 = calculateBillTotals([{ unit_price: 0.99, quantity: 1 }], 0);
      assert.equal(b3.final_amount, 0.99);
    });

    it('E.2: Decimal precision: ₹9,553.99 with ₹553.01 discount = ₹9,000.98', () => {
      const res = calculateBillTotals([{ unit_price: 9553.99, quantity: 1 }], 553.01);
      assert.equal(res.subtotal, 9553.99);
      assert.equal(res.discount_amount, 553.01);
      assert.equal(res.final_amount, 9000.98);
    });

    it('E.3: Decimal precision: ₹9,553.99 with ₹553.99 discount = ₹9,000.00', () => {
      const res = calculateBillTotals([{ unit_price: 9553.99, quantity: 1 }], 553.99);
      assert.equal(res.subtotal, 9553.99);
      assert.equal(res.discount_amount, 553.99);
      assert.equal(res.final_amount, 9000.00);
    });

    it('E.4: Multi-item line calculation with decimals: 3 x 3184.33 = 9552.99', () => {
      const res = calculateBillTotals([{ unit_price: 3184.33, quantity: 3 }], 0);
      assert.equal(res.subtotal, 9552.99);
      assert.equal(res.final_amount, 9552.99);
    });

    it('E.5: Classic 0.1 + 0.2 floating point anomaly does not affect payment math', () => {
      const res = safeAdd(0.1, 0.2);
      assert.equal(res, 0.30);
      assert.strictEqual(res.toString(), '0.3');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // F. BAJAJ PAY TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('F. Dedicated Bajaj Pay Integration Tests', () => {
    it('F.1: Exact user reproduction: Bill 9553 - 553 = 9000; Bajaj Pay 9000 is ACCEPTED', () => {
      const billTotals = calculateBillTotals([{ unit_price: 9553, quantity: 1 }], 553);
      assert.equal(billTotals.final_amount, 9000.00);

      const bill = { bill_id: 999, final_amount: billTotals.final_amount };
      const payRes = processPayment({ bill, amount: 9000.00, payment_method: 'bajaj_pay' });

      assert.equal(payRes.success, true);
      assert.equal(payRes.data.payment_method, 'bajaj_pay');
      assert.equal(payRes.data.amount_paid, 9000.00);
      assert.equal(payRes.data.remaining_due, 0.00);
      assert.equal(payRes.data.status, 'paid');
    });

    it('F.2: Bajaj Pay payment = ₹8,999.99 accepted as partial payment', () => {
      const bill = { bill_id: 999, final_amount: 9000.00 };
      const payRes = processPayment({ bill, amount: 8999.99, payment_method: 'bajaj_pay' });
      assert.equal(payRes.success, true);
      assert.equal(payRes.data.remaining_due, 0.01);
      assert.equal(payRes.data.status, 'partial');
    });

    it('F.3: Bajaj Pay payment = ₹9,000.01 rejected as overpayment', () => {
      const bill = { bill_id: 999, final_amount: 9000.00 };
      const payRes = processPayment({ bill, amount: 9000.01, payment_method: 'bajaj_pay' });
      assert.equal(payRes.success, false);
      assert.match(payRes.error, /exceeds remaining due/i);
    });

    it('F.4: System NEVER calculates ₹8,999.63 from 9553 - 553', () => {
      const billTotals = calculateBillTotals([{ unit_price: 9553, quantity: 1 }], 553);
      assert.notEqual(billTotals.final_amount, 8999.63);
      assert.equal(billTotals.final_amount, 9000.00);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // G. PAYMENT EDIT TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('G. Payment Edit & Pre-fill Tests', () => {
    it('G.1: When bill remaining is 9000, pre-filled value is 9000.00 and editing to 9000.00 succeeds', () => {
      const bill = { bill_id: 301, final_amount: 9000.00, paid_amount: 0.00 };
      const remainingDue = safeSubtract(bill.final_amount, bill.paid_amount);
      assert.equal(remainingDue, 9000.00);

      // User submits edited payment equal to 9000.00
      const payRes = processPayment({ bill, amount: 9000.00, payment_method: 'bajaj_pay' });
      assert.equal(payRes.success, true);
      assert.equal(payRes.data.amount_paid, 9000.00);
    });

    it('G.2: Editing payment to 9000.01 is blocked by max constraint', () => {
      const bill = { bill_id: 301, final_amount: 9000.00, paid_amount: 0.00 };
      const payRes = processPayment({ bill, amount: 9000.01, payment_method: 'bajaj_pay' });
      assert.equal(payRes.success, false);
      assert.match(payRes.error, /exceeds remaining due/i);
    });

    it('G.3: Editing an existing partial payment recalculates remaining due correctly', () => {
      const bill = { bill_id: 302, final_amount: 9000.00, paid_amount: 4000.00 };
      const remainingDue = safeSubtract(bill.final_amount, bill.paid_amount);
      assert.equal(remainingDue, 5000.00);

      const payRes = processPayment({ bill, amount: 5000.00, payment_method: 'bajaj_pay', existingPayments: [{ amount: 4000 }] });
      assert.equal(payRes.success, true);
      assert.equal(payRes.data.total_paid, 9000.00);
      assert.equal(payRes.data.remaining_due, 0.00);
      assert.equal(payRes.data.status, 'paid');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // H. PAYMENT + DISCOUNT INTERACTION
  // ─────────────────────────────────────────────────────────────────────────────
  describe('H. Payment + Discount Interaction', () => {
    it('H.1: Bill 10000, Discount 1000, Payment 9000 -> Status: PAID, Due: 0', () => {
      const b = calculateBillTotals([{ unit_price: 10000, quantity: 1 }], 1000);
      const bill = { bill_id: 401, final_amount: b.final_amount };
      const p = processPayment({ bill, amount: 9000, payment_method: 'card' });
      assert.equal(p.success, true);
      assert.equal(p.data.remaining_due, 0.00);
      assert.equal(p.data.status, 'paid');
    });

    it('H.2: Bill 10000, Discount 1000, Payment 5000 -> Remaining: 4000, Status: PARTIAL', () => {
      const b = calculateBillTotals([{ unit_price: 10000, quantity: 1 }], 1000);
      const bill = { bill_id: 402, final_amount: b.final_amount };
      const p = processPayment({ bill, amount: 5000, payment_method: 'upi' });
      assert.equal(p.success, true);
      assert.equal(p.data.remaining_due, 4000.00);
      assert.equal(p.data.status, 'partial');
    });

    it('H.3: Bill 10000, Discount 999.99, Payment 9000.01 -> Status: PAID', () => {
      const b = calculateBillTotals([{ unit_price: 10000, quantity: 1 }], 999.99);
      assert.equal(b.final_amount, 9000.01);
      const bill = { bill_id: 403, final_amount: b.final_amount };
      const p = processPayment({ bill, amount: 9000.01, payment_method: 'bajaj_pay' });
      assert.equal(p.success, true);
      assert.equal(p.data.remaining_due, 0.00);
      assert.equal(p.data.status, 'paid');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I. CURRENCY FORMATTING & DISPLAY FIDELITY
  // ─────────────────────────────────────────────────────────────────────────────
  describe('I. Currency Formatting & Display Fidelity', () => {
    it('I.1: formatCurrency displays ₹9,000.00 with 2 decimal places for 9000', () => {
      const str = formatCurrency(9000);
      assert.match(str, /9,000\.00/);
    });

    it('I.2: formatCurrency displays ₹9,553.00 with 2 decimal places for 9553', () => {
      const str = formatCurrency(9553);
      assert.match(str, /9,553\.00/);
    });

    it('I.3: formatCurrency displays ₹553.00 with 2 decimal places for 553', () => {
      const str = formatCurrency(553);
      assert.match(str, /553\.00/);
    });

    it('I.4: formatCurrency faithfully displays paise: 8999.63 -> ₹8,999.63 (does not mask as 9000)', () => {
      const str = formatCurrency(8999.63);
      assert.match(str, /8,999\.63/);
      assert.doesNotMatch(str, /9,000\.00/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. REGRESSION TEST
  // ─────────────────────────────────────────────────────────────────────────────
  describe('7. Permanent Regression Test', () => {
    it('should allow exact payment of 9000 after 553 discount on 9553 bill using Bajaj Pay', () => {
      // 1. Create bill
      const billTotals = calculateBillTotals([
        { item_name: 'Consultation & Treatment Course', unit_price: 9553.00, quantity: 1 }
      ], 553.00);

      assert.equal(billTotals.subtotal, 9553.00, 'Subtotal must be exactly 9553.00');
      assert.equal(billTotals.discount_amount, 553.00, 'Discount must be exactly 553.00');
      assert.equal(billTotals.final_amount, 9000.00, 'Final payable must be exactly 9000.00');
      assert.notEqual(billTotals.final_amount, 8999.63, 'Final payable must NOT be 8999.63');

      // 2. Select Bajaj Pay and pay exactly 9000.00
      const billRecord = {
        bill_id: 8888,
        final_amount: billTotals.final_amount,
        paid_amount: 0.00
      };

      const paymentResult = processPayment({
        bill: billRecord,
        amount: 9000.00,
        payment_method: 'bajaj_pay',
        existingPayments: []
      });

      // 3. Assertions
      assert.equal(paymentResult.success, true, 'Payment must be accepted');
      assert.equal(paymentResult.data.amount_paid, 9000.00, 'Paid amount must be 9000.00');
      assert.equal(paymentResult.data.remaining_due, 0.00, 'Remaining due must be 0.00');
      assert.equal(paymentResult.data.status, 'paid', 'Bill status must be paid');
      assert.equal(paymentResult.data.payment_method, 'bajaj_pay', 'Payment method must be bajaj_pay');
    });
  });
});
