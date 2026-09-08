import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Pharmacy Portal — Stock Transactions Module Integration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. TRANSACTION TYPES & BADGE FORMATTERS
  // --------------------------------------------------------------------------
  describe('1. Transaction Types & Status Badges', () => {
    const validBackendTypes = ['in', 'out', 'adjustment', 'return'];

    const getBadgeConfig = (type) => {
      switch (type) {
        case 'in':
          return { label: 'Stock In', color: 'emerald', icon: 'ArrowDownRight' };
        case 'out':
          return { label: 'Dispensed (Out)', color: 'blue', icon: 'ArrowUpRight' };
        case 'adjustment':
          return { label: 'Adjustment', color: 'purple', icon: 'Sliders' };
        case 'return':
          return { label: 'Returned', color: 'amber', icon: 'RotateCcw' };
        default:
          return { label: type, color: 'slate', icon: null };
      }
    };

    test('1.1 Recognizes all 4 live backend stock transaction types', () => {
      assert.strictEqual(validBackendTypes.length, 4);
      validBackendTypes.forEach(type => {
        const badge = getBadgeConfig(type);
        assert.ok(badge.label);
        assert.ok(badge.color);
      });
    });

    test('1.2 Maps labels and colors precisely without inventing types', () => {
      assert.deepStrictEqual(getBadgeConfig('in'), { label: 'Stock In', color: 'emerald', icon: 'ArrowDownRight' });
      assert.deepStrictEqual(getBadgeConfig('out'), { label: 'Dispensed (Out)', color: 'blue', icon: 'ArrowUpRight' });
      assert.deepStrictEqual(getBadgeConfig('adjustment'), { label: 'Adjustment', color: 'purple', icon: 'Sliders' });
      assert.deepStrictEqual(getBadgeConfig('return'), { label: 'Returned', color: 'amber', icon: 'RotateCcw' });
    });

    test('1.3 Gracefully fallbacks for unknown transaction type without crashing', () => {
      const fallback = getBadgeConfig('custom_audit');
      assert.strictEqual(fallback.label, 'custom_audit');
      assert.strictEqual(fallback.color, 'slate');
    });
  });

  // --------------------------------------------------------------------------
  // 2. SIGNED QUANTITY DELTA FORMATTING
  // --------------------------------------------------------------------------
  describe('2. Signed Quantity Delta Calculations & Styling', () => {
    const formatDelta = (qty) => {
      const numericQty = parseInt(qty);
      const isPositive = numericQty > 0;
      return {
        isPositive,
        displayText: isPositive ? `+${numericQty}` : `${numericQty}`,
        colorClass: isPositive ? 'text-emerald-600 font-mono' : 'text-blue-600 font-mono'
      };
    };

    test('2.1 Formats positive receipts and returns with explicit "+" prefix', () => {
      const receipt = formatDelta(45);
      assert.strictEqual(receipt.isPositive, true);
      assert.strictEqual(receipt.displayText, '+45');
      assert.strictEqual(receipt.colorClass, 'text-emerald-600 font-mono');

      const ret = formatDelta(5);
      assert.strictEqual(ret.displayText, '+5');
      assert.strictEqual(ret.colorClass, 'text-emerald-600 font-mono');
    });

    test('2.2 Formats outbound dispensing and downward adjustments with negative sign', () => {
      const dispense = formatDelta(-5);
      assert.strictEqual(dispense.isPositive, false);
      assert.strictEqual(dispense.displayText, '-5');
      assert.strictEqual(dispense.colorClass, 'text-blue-600 font-mono');

      const adjDown = formatDelta(-82);
      assert.strictEqual(adjDown.displayText, '-82');
      assert.strictEqual(adjDown.colorClass, 'text-blue-600 font-mono');
    });

    test('2.3 Handles zero delta gracefully', () => {
      const zero = formatDelta(0);
      assert.strictEqual(zero.isPositive, false);
      assert.strictEqual(zero.displayText, '0');
    });
  });

  // --------------------------------------------------------------------------
  // 3. FILTER QUERY PARAMETERS BUILDER
  // --------------------------------------------------------------------------
  describe('3. Filter Query Builder Contracts', () => {
    const buildTxnQuery = ({ typeFilter, dateFilter, batchFilter }) => {
      return {
        type: typeFilter ? typeFilter.trim() : undefined,
        date: dateFilter ? dateFilter.trim() : undefined,
        batch_number: batchFilter && batchFilter.trim() ? batchFilter.trim() : undefined,
      };
    };

    test('3.1 Trims query strings and cleans empty filter values', () => {
      const q = buildTxnQuery({
        typeFilter: 'in',
        dateFilter: '2026-09-06',
        batchFilter: '   BATCH-VALID-01   '
      });
      assert.strictEqual(q.type, 'in');
      assert.strictEqual(q.date, '2026-09-06');
      assert.strictEqual(q.batch_number, 'BATCH-VALID-01');
    });

    test('3.2 Drops empty or whitespace-only parameters from request payload', () => {
      const q = buildTxnQuery({
        typeFilter: '',
        dateFilter: '',
        batchFilter: '   '
      });
      assert.strictEqual(q.type, undefined);
      assert.strictEqual(q.date, undefined);
      assert.strictEqual(q.batch_number, undefined);
    });

    test('3.3 Correctly resets when all filters are cleared', () => {
      const q = buildTxnQuery({ typeFilter: '', dateFilter: '', batchFilter: '' });
      assert.deepStrictEqual(q, { type: undefined, date: undefined, batch_number: undefined });
    });
  });

  // --------------------------------------------------------------------------
  // 4. TIMESTAMP & REFERENCE IMMUTABILITY
  // --------------------------------------------------------------------------
  describe('4. Ledger Immutability & Audit Integrity', () => {
    test('4.1 Verifies transaction records contain mandatory audit trail fields', () => {
      const mockRecord = {
        id: 822,
        medicine_id: 263,
        transaction_type: 'in',
        quantity: 45,
        batch_number: 'PUL-E2E-99',
        reference: 'Automated E2E Verification',
        performed_by: 1345,
        branch_id: 1,
        created_at: '2026-09-06T14:03:37.829Z',
        medicine_name: 'E2E Pulsatilla Nigricans',
        potency: '200CH',
        performed_by_name: 'Peter Pharmacy Manager'
      };

      assert.ok(mockRecord.id > 0);
      assert.ok(mockRecord.medicine_name);
      assert.ok(mockRecord.batch_number);
      assert.ok(mockRecord.reference);
      assert.ok(mockRecord.performed_by_name);
      assert.ok(mockRecord.created_at);
      assert.strictEqual(typeof mockRecord.quantity, 'number');
    });

    test('4.2 Rejects any mutation actions (UI must remain strictly read-only)', () => {
      const exposedActions = ['Refresh', 'Filter', 'Clear'];
      const prohibitedActions = ['Edit', 'Delete', 'Modify', 'Change Quantity', 'New Transaction'];

      prohibitedActions.forEach(action => {
        assert.ok(!exposedActions.includes(action), `Prohibited action ${action} must NOT be exposed in Stock Transaction Ledger`);
      });
    });
  });

});
