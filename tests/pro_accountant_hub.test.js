import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Core Accountant Ledger & Cash Management Domain Logic
function calculateCashLedger({ openingCash = 0, cashRevenue = 0, cashExpenditure = 0, cashDeposited = 0 }) {
  const expectedCash = openingCash + cashRevenue - cashExpenditure;
  const closingCash = expectedCash - cashDeposited;
  return {
    openingCash,
    cashRevenue,
    cashExpenditure,
    expectedCash,
    cashDeposited,
    closingCash
  };
}

function calculateCollections({ cash = 0, card = 0, upi = 0, razorpay = 0, bajaj_pay = 0 }) {
  const grandTotal = cash + card + upi + razorpay + bajaj_pay;
  const physicalCash = cash;
  const digitalModes = card + upi + razorpay + bajaj_pay;
  return {
    grandTotal,
    physicalCash,
    digitalModes,
    breakdown: { cash, card, upi, razorpay, bajaj_pay }
  };
}

function validateExpenditureForm({ category, description, amount }) {
  const errors = [];
  if (!category || !category.trim()) {
    errors.push('Expense category is required');
  }
  if (!description || !description.trim()) {
    errors.push('Expense description is required');
  }
  const amt = parseFloat(amount);
  if (amount === undefined || amount === null || isNaN(amt) || amt <= 0) {
    errors.push('Expense amount must be a positive number greater than 0');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateDepositForm({ deposit_amount, expectedCash }) {
  const errors = [];
  const amt = parseFloat(deposit_amount);
  if (deposit_amount === undefined || deposit_amount === null || isNaN(amt) || amt <= 0) {
    errors.push('Valid deposit amount is required');
  } else if (expectedCash !== undefined && amt > expectedCash) {
    errors.push(`Deposit amount (${amt}) cannot exceed available cash in drawer (${expectedCash})`);
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

describe('PRO Accountant & Cash Management Hub Frontend Test Suite', () => {
  describe('1. Physical Cash Drawer Ledger Mathematical Formulas', () => {
    test('should accurately calculate Expected Cash = Opening Cash + Cash Revenue - Cash Expense', () => {
      const ledger = calculateCashLedger({
        openingCash: 600,
        cashRevenue: 10600,
        cashExpenditure: 0,
        cashDeposited: 0
      });

      assert.equal(ledger.openingCash, 600);
      assert.equal(ledger.cashRevenue, 10600);
      assert.equal(ledger.cashExpenditure, 0);
      assert.equal(ledger.expectedCash, 11200);
      assert.equal(ledger.closingCash, 11200);
    });

    test('should accurately calculate Closing Cash = Expected Cash - Cash Deposited', () => {
      const ledger = calculateCashLedger({
        openingCash: 600,
        cashRevenue: 10600,
        cashExpenditure: 500,
        cashDeposited: 3000
      });

      assert.equal(ledger.expectedCash, 10700);
      assert.equal(ledger.closingCash, 7700);
    });

    test('should match the exact values from the live UI reference screenshot', () => {
      const ledger = calculateCashLedger({
        openingCash: 600,
        cashRevenue: 10600,
        cashExpenditure: 0,
        cashDeposited: 0
      });

      assert.equal(ledger.openingCash, 600);
      assert.equal(ledger.cashRevenue, 10600);
      assert.equal(ledger.cashExpenditure, 0);
      assert.equal(ledger.expectedCash, 11200);
      assert.equal(ledger.cashDeposited, 0);
      assert.equal(ledger.closingCash, 11200);
    });
  });

  describe('2. Collections by Payment Mode & Grand Total Reconciliation', () => {
    test('should match live collections breakdown from UI screenshot', () => {
      const collections = calculateCollections({
        cash: 10600,
        card: 400,
        upi: 900,
        razorpay: 0,
        bajaj_pay: 0
      });

      assert.equal(collections.breakdown.cash, 10600);
      assert.equal(collections.breakdown.card, 400);
      assert.equal(collections.breakdown.upi, 900);
      assert.equal(collections.breakdown.razorpay, 0);
      assert.equal(collections.breakdown.bajaj_pay, 0);

      assert.equal(collections.grandTotal, 11900);
      assert.equal(collections.physicalCash, 10600);
      assert.equal(collections.digitalModes, 1300);
    });

    test('should verify Grand Total equals Physical Cash plus Digital Modes', () => {
      const collections = calculateCollections({
        cash: 5000,
        card: 1500,
        upi: 2500,
        razorpay: 1000,
        bajaj_pay: 500
      });

      assert.equal(collections.grandTotal, 10500);
      assert.equal(collections.physicalCash, 5000);
      assert.equal(collections.digitalModes, 5500);
      assert.equal(collections.grandTotal, collections.physicalCash + collections.digitalModes);
    });
  });

  describe('3. Record Expenditure Form Validation', () => {
    test('should reject empty category or description', () => {
      const v1 = validateExpenditureForm({ category: '', description: 'Tea', amount: 100 });
      assert.equal(v1.isValid, false);
      assert.ok(v1.errors.some(e => /category/i.test(e)));

      const v2 = validateExpenditureForm({ category: 'Clinic Supplies', description: '  ', amount: 100 });
      assert.equal(v2.isValid, false);
      assert.ok(v2.errors.some(e => /description/i.test(e)));
    });

    test('should reject zero or negative amount', () => {
      const v1 = validateExpenditureForm({ category: 'Clinic Supplies', description: 'Tape', amount: 0 });
      assert.equal(v1.isValid, false);

      const v2 = validateExpenditureForm({ category: 'Clinic Supplies', description: 'Tape', amount: -50 });
      assert.equal(v2.isValid, false);
    });

    test('should approve valid expenditure form', () => {
      const v = validateExpenditureForm({
        category: 'Clinic Supplies',
        description: 'Sterile cotton and gauze',
        amount: 350
      });
      assert.equal(v.isValid, true);
      assert.equal(v.errors.length, 0);
    });
  });

  describe('4. Bank Cash Deposit Validation & Overdraft Protection', () => {
    test('should reject zero, negative, or invalid deposit amount', () => {
      const v1 = validateDepositForm({ deposit_amount: 0, expectedCash: 11200 });
      assert.equal(v1.isValid, false);

      const v2 = validateDepositForm({ deposit_amount: -500, expectedCash: 11200 });
      assert.equal(v2.isValid, false);
    });

    test('should reject deposit exceeding available expected cash in drawer (overdraft)', () => {
      const v = validateDepositForm({ deposit_amount: 15000, expectedCash: 11200 });
      assert.equal(v.isValid, false);
      assert.ok(v.errors.some(e => /cannot exceed available cash/i.test(e)));
    });

    test('should approve valid bank cash deposit within expected cash balance', () => {
      const v = validateDepositForm({ deposit_amount: 5000, expectedCash: 11200 });
      assert.equal(v.isValid, true);
      assert.equal(v.errors.length, 0);
    });
  });

  describe('5. Indian Rupee Currency Formatting', () => {
    test('should format amounts using Indian numbering system', () => {
      // e.g. 10600 -> ₹10,600
      const formatted = formatCurrency(10600);
      assert.ok(formatted.includes('10,600'));
      assert.ok(formatted.includes('₹'));

      const formattedTotal = formatCurrency(11900);
      assert.ok(formattedTotal.includes('11,900'));
    });
  });
});
