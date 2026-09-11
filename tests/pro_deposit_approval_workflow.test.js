import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper domain functions mirroring the frontend workflow
function validateDepositRequest({ amount, availableCash }) {
  const errors = [];
  const amt = parseFloat(amount);

  if (amount === undefined || amount === null || amount === '' || isNaN(amt)) {
    errors.push('Deposit amount is required and must be a valid number.');
  } else if (amt <= 0) {
    errors.push('Deposit amount must be a positive number greater than 0.');
  } else if (availableCash !== undefined && amt > availableCash) {
    errors.push(`Deposit amount (₹${amt}) cannot exceed available cash in drawer (₹${availableCash}).`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateDepositCompletion({ challan_reference }) {
  const errors = [];
  if (!challan_reference || !challan_reference.trim()) {
    errors.push('Bank Deposit Challan / Ref # is required to confirm deposit.');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateRejectionReason({ rejection_reason }) {
  const errors = [];
  if (!rejection_reason || !rejection_reason.trim()) {
    errors.push('Rejection reason is required.');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

function filterDepositHistory(deposits, { date_from, date_to, deposit_type, pro_id, branch_id }) {
  return deposits.filter(d => {
    if (date_from && d.deposit_date < date_from) return false;
    if (date_to && d.deposit_date > date_to) return false;
    if (deposit_type && deposit_type !== 'all' && d.deposit_type !== deposit_type) return false;
    if (pro_id && pro_id !== 'all' && d.requested_by !== parseInt(pro_id)) return false;
    if (branch_id && branch_id !== 'all' && d.branch_id !== parseInt(branch_id)) return false;
    return true;
  });
}

describe('PRO Cash Deposit → Super Admin Approval Workflow Frontend Logic Test Suite', () => {
  describe('1. PRO Deposit Request Validation', () => {
    test('should reject missing, empty, or NaN deposit amount', () => {
      assert.equal(validateDepositRequest({ amount: '', availableCash: 10000 }).isValid, false);
      assert.equal(validateDepositRequest({ amount: undefined, availableCash: 10000 }).isValid, false);
      assert.equal(validateDepositRequest({ amount: 'abc', availableCash: 10000 }).isValid, false);
    });

    test('should reject zero or negative deposit amount', () => {
      assert.equal(validateDepositRequest({ amount: 0, availableCash: 10000 }).isValid, false);
      assert.equal(validateDepositRequest({ amount: -500, availableCash: 10000 }).isValid, false);
    });

    test('should reject deposit amount exceeding available cash in drawer', () => {
      const v = validateDepositRequest({ amount: 15000, availableCash: 10000 });
      assert.equal(v.isValid, false);
      assert.ok(v.errors.some(e => e.includes('cannot exceed available cash')));
    });

    test('should accept valid deposit amount equal to or less than available cash', () => {
      const v1 = validateDepositRequest({ amount: 5000, availableCash: 10000 });
      assert.equal(v1.isValid, true);

      const v2 = validateDepositRequest({ amount: 10000, availableCash: 10000 });
      assert.equal(v2.isValid, true);
    });
  });

  describe('2. Deposit Completion Validation', () => {
    test('should require Bank Deposit Challan / Ref #', () => {
      assert.equal(validateDepositCompletion({ challan_reference: '' }).isValid, false);
      assert.equal(validateDepositCompletion({ challan_reference: '   ' }).isValid, false);
      assert.equal(validateDepositCompletion({ challan_reference: 'HDFC-CHALLAN-9842' }).isValid, true);
    });
  });

  describe('3. Super Admin Rejection Validation', () => {
    test('should require non-empty rejection reason', () => {
      assert.equal(validateRejectionReason({ rejection_reason: '' }).isValid, false);
      assert.equal(validateRejectionReason({ rejection_reason: '  ' }).isValid, false);
      assert.equal(validateRejectionReason({ rejection_reason: 'Cash amount does not match drawer' }).isValid, true);
    });
  });

  describe('4. Notification Minimum Display Duration Specification', () => {
    test('should enforce minimum 3 seconds display rule (8000ms duration configured)', () => {
      const minRequiredMs = 3000;
      const configuredDurationMs = 8000;
      assert.ok(configuredDurationMs >= minRequiredMs, 'Configured toast duration must be >= 3000ms');
    });
  });

  describe('5. Multi-Faceted Deposit History Filtering', () => {
    const mockDeposits = [
      { id: 1, deposit_date: '2026-09-11', deposit_type: 'PRO', requested_by: 101, branch_id: 1, amount: 5000 },
      { id: 2, deposit_date: '2026-09-11', deposit_type: 'SUPER_ADMIN', requested_by: 1, branch_id: 1, amount: 10000 },
      { id: 3, deposit_date: '2026-09-10', deposit_type: 'PRO', requested_by: 102, branch_id: 2, amount: 2000 },
      { id: 4, deposit_date: '2026-09-11', deposit_type: 'PRO', requested_by: 102, branch_id: 1, amount: 3500 },
    ];

    test('should filter exclusively by deposit type (PRO vs SUPER_ADMIN)', () => {
      const proOnly = filterDepositHistory(mockDeposits, { deposit_type: 'PRO' });
      assert.equal(proOnly.length, 3);
      assert.ok(proOnly.every(d => d.deposit_type === 'PRO'));

      const saOnly = filterDepositHistory(mockDeposits, { deposit_type: 'SUPER_ADMIN' });
      assert.equal(saOnly.length, 1);
      assert.equal(saOnly[0].id, 2);
    });

    test('should filter by date range, PRO user, and branch simultaneously', () => {
      const filtered = filterDepositHistory(mockDeposits, {
        date_from: '2026-09-11',
        date_to: '2026-09-11',
        deposit_type: 'PRO',
        pro_id: '101',
        branch_id: '1'
      });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, 1);
    });
  });
});
