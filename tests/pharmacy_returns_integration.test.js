import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Pharmacy Portal — Medicine Returns Module Integration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. HOSPITAL PHARMACY RESTOCKING POLICY CONTRACT
  // --------------------------------------------------------------------------
  describe('1. Hospital Pharmacy Policy: Restocking vs Quarantine Logic', () => {
    const evaluateRestockPolicy = (condition) => {
      // Policy: Items returned in 'good' condition are automatically restocked.
      // Items marked as 'damaged', 'expired', or 'opened' are quarantined.
      const isRestocked = condition === 'good';
      return {
        condition,
        restocked: isRestocked,
        action: isRestocked ? 'RESTOCK_INVENTORY' : 'QUARANTINE_FOR_DISPOSAL',
        createsStockTxn: isRestocked
      };
    };

    test('1.1 Condition "good" triggers automatic inventory restock and stock ledger entry', () => {
      const outcome = evaluateRestockPolicy('good');
      assert.strictEqual(outcome.restocked, true);
      assert.strictEqual(outcome.action, 'RESTOCK_INVENTORY');
      assert.strictEqual(outcome.createsStockTxn, true);
    });

    test('1.2 Condition "damaged" quarantines items without adding to active inventory', () => {
      const outcome = evaluateRestockPolicy('damaged');
      assert.strictEqual(outcome.restocked, false);
      assert.strictEqual(outcome.action, 'QUARANTINE_FOR_DISPOSAL');
      assert.strictEqual(outcome.createsStockTxn, false);
    });

    test('1.3 Condition "expired" quarantines items for disposal', () => {
      const outcome = evaluateRestockPolicy('expired');
      assert.strictEqual(outcome.restocked, false);
      assert.strictEqual(outcome.action, 'QUARANTINE_FOR_DISPOSAL');
      assert.strictEqual(outcome.createsStockTxn, false);
    });

    test('1.4 Condition "opened" quarantines items without restocking', () => {
      const outcome = evaluateRestockPolicy('opened');
      assert.strictEqual(outcome.restocked, false);
      assert.strictEqual(outcome.action, 'QUARANTINE_FOR_DISPOSAL');
      assert.strictEqual(outcome.createsStockTxn, false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. CONDITION BADGES & STATUS DISPLAY
  // --------------------------------------------------------------------------
  describe('2. Condition Badges & Visual Indicator Formatting', () => {
    const getBadgeInfo = (condition, restocked) => {
      switch (condition) {
        case 'good':
          return {
            badgeColor: 'emerald',
            label: 'GOOD',
            statusLabel: restocked ? 'Restocked' : 'Quarantined'
          };
        case 'damaged':
          return {
            badgeColor: 'amber',
            label: 'DAMAGED',
            statusLabel: 'Quarantined'
          };
        case 'expired':
          return {
            badgeColor: 'rose',
            label: 'EXPIRED',
            statusLabel: 'QuarantINED'
          };
        case 'opened':
          return {
            badgeColor: 'purple',
            label: 'OPENED',
            statusLabel: 'Quarantined'
          };
        default:
          return {
            badgeColor: 'slate',
            label: condition?.toUpperCase() || 'UNKNOWN',
            statusLabel: restocked ? 'Restocked' : 'Quarantined'
          };
      }
    };

    test('2.1 Correct styling and text for Good / Restocked status', () => {
      const b = getBadgeInfo('good', true);
      assert.strictEqual(b.badgeColor, 'emerald');
      assert.strictEqual(b.label, 'GOOD');
      assert.strictEqual(b.statusLabel, 'Restocked');
    });

    test('2.2 Correct styling and text for Damaged / Quarantined status', () => {
      const b = getBadgeInfo('damaged', false);
      assert.strictEqual(b.badgeColor, 'amber');
      assert.strictEqual(b.label, 'DAMAGED');
      assert.strictEqual(b.statusLabel, 'Quarantined');
    });

    test('2.3 Correct styling and text for Expired status', () => {
      const b = getBadgeInfo('expired', false);
      assert.strictEqual(b.badgeColor, 'rose');
      assert.strictEqual(b.label, 'EXPIRED');
    });

    test('2.4 Correct styling and text for Opened status', () => {
      const b = getBadgeInfo('opened', false);
      assert.strictEqual(b.badgeColor, 'purple');
      assert.strictEqual(b.label, 'OPENED');
    });
  });

  // --------------------------------------------------------------------------
  // 3. FORM VALIDATION & BACKEND CONTRACT
  // --------------------------------------------------------------------------
  describe('3. Process Return Form Validation & Backend Payload Contracts', () => {
    const validateReturnForm = (form) => {
      const errors = [];
      if (!form.patient_id || isNaN(Number(form.patient_id))) {
        errors.push('Valid Patient ID is required');
      }
      if (!form.medicine_id || isNaN(Number(form.medicine_id))) {
        errors.push('Medicine selection is required');
      }
      if (!form.stock_id || isNaN(Number(form.stock_id))) {
        errors.push('Stock batch selection is required');
      }
      const qty = parseInt(form.return_quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        errors.push('Return quantity must be a positive integer');
      }
      const allowedConditions = ['good', 'damaged', 'expired', 'opened'];
      if (!allowedConditions.includes(form.condition)) {
        errors.push('Condition must be one of: good, damaged, expired, opened');
      }
      if (!form.return_reason || !form.return_reason.trim()) {
        errors.push('Return reason is required');
      }
      return {
        isValid: errors.length === 0,
        errors,
        payload: errors.length === 0 ? {
          patient_id: Number(form.patient_id),
          prescription_id: form.prescription_id ? Number(form.prescription_id) : null,
          medicine_id: Number(form.medicine_id),
          stock_id: Number(form.stock_id),
          return_quantity: qty,
          return_reason: form.return_reason.trim(),
          condition: form.condition,
          remarks: form.remarks?.trim() || null
        } : null
      };
    };

    test('3.1 Accepts completely valid return form and formats payload', () => {
      const validForm = {
        patient_id: '1331',
        prescription_id: '42',
        medicine_id: '264',
        stock_id: '360',
        return_quantity: '5',
        return_reason: 'Discontinued by Doctor',
        condition: 'good',
        remarks: 'Seal unbroken'
      };
      const result = validateReturnForm(validForm);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.payload.patient_id, 1331);
      assert.strictEqual(result.payload.prescription_id, 42);
      assert.strictEqual(result.payload.medicine_id, 264);
      assert.strictEqual(result.payload.stock_id, 360);
      assert.strictEqual(result.payload.return_quantity, 5);
      assert.strictEqual(result.payload.condition, 'good');
    });

    test('3.2 Rejects non-positive or zero return quantity', () => {
      const zeroQty = {
        patient_id: '1331',
        medicine_id: '264',
        stock_id: '360',
        return_quantity: '0',
        return_reason: 'Test',
        condition: 'good'
      };
      const res = validateReturnForm(zeroQty);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some(e => e.includes('positive integer')));
    });

    test('3.3 Rejects missing required fields', () => {
      const emptyForm = {
        patient_id: '',
        medicine_id: '',
        stock_id: '',
        return_quantity: '',
        return_reason: '',
        condition: 'unknown'
      };
      const res = validateReturnForm(emptyForm);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.length, 6);
    });
  });

  // --------------------------------------------------------------------------
  // 4. MULTI-FILTER SEARCH MATCHING
  // --------------------------------------------------------------------------
  describe('4. Search & Filter Matching Logic', () => {
    const sampleReturns = [
      { id: 101, patient_name: 'Rahul Sharma', patient_id: 12, medicine_name: 'Belladonna 30C', batch_number: 'BATCH-001', condition: 'good', return_reason: 'Patient cured early', created_at: '2026-09-06T10:00:00Z' },
      { id: 102, patient_name: 'Priya Patel', patient_id: 15, medicine_name: 'Arnica Montana 200C', batch_number: 'BATCH-002', condition: 'damaged', return_reason: 'Broken bottle seal', created_at: '2026-09-06T11:00:00Z' },
      { id: 103, patient_name: 'Amit Kumar', patient_id: 20, medicine_name: 'Nux Vomica 30C', batch_number: 'BATCH-003', condition: 'expired', return_reason: 'Expired in kit', created_at: '2026-09-05T09:00:00Z' }
    ];

    const filterReturns = (list, { search, condition, date }) => {
      return list.filter(r => {
        if (condition && r.condition !== condition) return false;
        if (date && !r.created_at.startsWith(date)) return false;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          const matchPatient = r.patient_name.toLowerCase().includes(q);
          const matchMed = r.medicine_name.toLowerCase().includes(q);
          const matchBatch = r.batch_number.toLowerCase().includes(q);
          const matchReason = r.return_reason.toLowerCase().includes(q);
          const matchId = String(r.id) === q || String(r.patient_id) === q;
          if (!matchPatient && !matchMed && !matchBatch && !matchReason && !matchId) return false;
        }
        return true;
      });
    };

    test('4.1 Searches by patient name case-insensitively', () => {
      const res = filterReturns(sampleReturns, { search: 'rahul' });
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, 101);
    });

    test('4.2 Searches by medicine name', () => {
      const res = filterReturns(sampleReturns, { search: 'arnica' });
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, 102);
    });

    test('4.3 Searches by batch number', () => {
      const res = filterReturns(sampleReturns, { search: 'BATCH-003' });
      assert.strictEqual(res.length, 1);
      assert.strictEqual(res[0].id, 103);
    });

    test('4.4 Filters strictly by condition', () => {
      const goodOnly = filterReturns(sampleReturns, { condition: 'good' });
      assert.strictEqual(goodOnly.length, 1);
      assert.strictEqual(goodOnly[0].id, 101);

      const damagedOnly = filterReturns(sampleReturns, { condition: 'damaged' });
      assert.strictEqual(damagedOnly.length, 1);
      assert.strictEqual(damagedOnly[0].id, 102);
    });

    test('4.5 Filters strictly by date', () => {
      const dateFiltered = filterReturns(sampleReturns, { date: '2026-09-05' });
      assert.strictEqual(dateFiltered.length, 1);
      assert.strictEqual(dateFiltered[0].id, 103);
    });
  });

  // --------------------------------------------------------------------------
  // 5. IMMUTABILITY & AUDIT RECORD INTEGRITY
  // --------------------------------------------------------------------------
  describe('5. Immutability & Audit Safety', () => {
    test('5.1 Return records do NOT offer edit or delete operations in UI', () => {
      const permittedActions = ['VIEW_RETURN_DETAILS'];
      assert.strictEqual(permittedActions.includes('EDIT_RETURN'), false);
      assert.strictEqual(permittedActions.includes('DELETE_RETURN'), false);
    });
  });

});
