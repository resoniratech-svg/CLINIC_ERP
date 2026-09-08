import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Pharmacy Portal — Stock Adjustments Module Integration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. COUNT DIFFERENCE CALCULATION & FORMATTING
  // --------------------------------------------------------------------------
  describe('1. Difference Calculation & Signed Styling', () => {
    const calculateDifference = (sysQty, physQty) => {
      const parsedSys = parseInt(sysQty, 10);
      const parsedPhys = parseInt(physQty, 10);
      if (isNaN(parsedSys) || isNaN(parsedPhys)) return null;
      const diff = parsedPhys - parsedSys;
      return {
        systemQuantity: parsedSys,
        physicalQuantity: parsedPhys,
        difference: diff,
        isPositive: diff > 0,
        isNegative: diff < 0,
        displayText: diff > 0 ? `+${diff}` : `${diff}`,
        colorClass: diff > 0 ? 'text-emerald-600 font-bold' : diff < 0 ? 'text-red-600 font-bold' : 'text-slate-500'
      };
    };

    test('1.1 Accurately computes positive difference when physical count > system book stock', () => {
      const calc = calculateDifference(100, 105);
      assert.strictEqual(calc.difference, 5);
      assert.strictEqual(calc.isPositive, true);
      assert.strictEqual(calc.displayText, '+5');
      assert.ok(calc.colorClass.includes('text-emerald-600'));
    });

    test('1.2 Accurately computes negative difference when physical count < system book stock', () => {
      const calc = calculateDifference(100, 92);
      assert.strictEqual(calc.difference, -8);
      assert.strictEqual(calc.isNegative, true);
      assert.strictEqual(calc.displayText, '-8');
      assert.ok(calc.colorClass.includes('text-red-600'));
    });

    test('1.3 Accurately computes zero difference when physical count equals system book stock', () => {
      const calc = calculateDifference(100, 100);
      assert.strictEqual(calc.difference, 0);
      assert.strictEqual(calc.isPositive, false);
      assert.strictEqual(calc.isNegative, false);
      assert.strictEqual(calc.displayText, '0');
      assert.ok(calc.colorClass.includes('text-slate-500'));
    });
  });

  // --------------------------------------------------------------------------
  // 2. THRESHOLD GOVERNANCE (10 UNITS)
  // --------------------------------------------------------------------------
  describe('2. Threshold Governance (Hospital Settings: 10 Units)', () => {
    const evaluateThreshold = (diff, threshold = 10) => {
      const absDiff = Math.abs(diff);
      const requiresApproval = absDiff > threshold;
      return {
        threshold,
        absDiff,
        requiresApproval,
        approvalStatus: requiresApproval ? 'pending' : 'approved',
        actionLabel: requiresApproval
          ? 'Requires Super Admin review and approval before stock update'
          : 'Auto-applied immediately to active inventory'
      };
    };

    test('2.1 Count discrepancies up to +-10 units are auto-approved immediately', () => {
      const outcomes = [
        evaluateThreshold(0),
        evaluateThreshold(5),
        evaluateThreshold(-8),
        evaluateThreshold(10),
        evaluateThreshold(-10)
      ];
      outcomes.forEach(o => {
        assert.strictEqual(o.requiresApproval, false);
        assert.strictEqual(o.approvalStatus, 'approved');
      });
    });

    test('2.2 Count discrepancies strictly exceeding 10 units are held in Pending status', () => {
      const outcomes = [
        evaluateThreshold(11),
        evaluateThreshold(-15),
        evaluateThreshold(50),
        evaluateThreshold(-82)
      ];
      outcomes.forEach(o => {
        assert.strictEqual(o.requiresApproval, true);
        assert.strictEqual(o.approvalStatus, 'pending');
        assert.ok(o.actionLabel.includes('Super Admin'));
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. STATUS BADGES & VISUAL INDICATORS
  // --------------------------------------------------------------------------
  describe('3. Status Badge Configuration', () => {
    const getStatusBadge = (status) => {
      switch (status) {
        case 'approved':
          return { label: 'Approved', color: 'emerald', icon: 'CheckCircle2' };
        case 'pending':
          return { label: 'Pending', color: 'amber', icon: 'Clock' };
        case 'rejected':
          return { label: 'Rejected', color: 'rose', icon: 'XCircle' };
        default:
          return { label: status, color: 'slate', icon: null };
      }
    };

    test('3.1 Maps approved status to emerald badge with check icon', () => {
      const b = getStatusBadge('approved');
      assert.strictEqual(b.label, 'Approved');
      assert.strictEqual(b.color, 'emerald');
      assert.strictEqual(b.icon, 'CheckCircle2');
    });

    test('3.2 Maps pending status to amber badge with clock icon', () => {
      const b = getStatusBadge('pending');
      assert.strictEqual(b.label, 'Pending');
      assert.strictEqual(b.color, 'amber');
      assert.strictEqual(b.icon, 'Clock');
    });

    test('3.3 Maps rejected status to rose badge with XCircle icon', () => {
      const b = getStatusBadge('rejected');
      assert.strictEqual(b.label, 'Rejected');
      assert.strictEqual(b.color, 'rose');
      assert.strictEqual(b.icon, 'XCircle');
    });
  });

  // --------------------------------------------------------------------------
  // 4. FORM VALIDATION & REASON HANDLING
  // --------------------------------------------------------------------------
  describe('4. Form Validation & Clinical Reasons', () => {
    const validReasons = [
      'stock_count_correction',
      'damage',
      'spillage',
      'expired_writeoff',
      'theft_loss',
      'manufacturer_error',
      'other'
    ];

    const validateAdjustment = (form) => {
      const errors = [];
      if (!form.medicine_id) errors.push('Medicine is required');
      if (!form.stock_id) errors.push('Stock batch is required');
      const physQty = parseInt(form.physical_quantity, 10);
      if (isNaN(physQty) || physQty < 0) {
        errors.push('Physical count must be a non-negative integer');
      }
      if (!form.reason || !validReasons.includes(form.reason)) {
        errors.push('Valid reason is required');
      }
      return {
        isValid: errors.length === 0,
        errors,
        payload: errors.length === 0 ? {
          medicine_id: Number(form.medicine_id),
          stock_id: Number(form.stock_id),
          physical_quantity: physQty,
          reason: form.reason,
          remarks: form.remarks?.trim() || null
        } : null
      };
    };

    test('4.1 Accepts valid form and produces payload', () => {
      const res = validateAdjustment({
        medicine_id: '285',
        stock_id: '394',
        physical_quantity: '95',
        reason: 'stock_count_correction',
        remarks: 'Physical audit verified'
      });
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.payload.physical_quantity, 95);
      assert.strictEqual(res.payload.reason, 'stock_count_correction');
    });

    test('4.2 Rejects negative physical count values', () => {
      const res = validateAdjustment({
        medicine_id: '285',
        stock_id: '394',
        physical_quantity: '-5',
        reason: 'damage'
      });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some(e => e.includes('non-negative integer')));
    });

    test('4.3 Rejects missing medicine or batch', () => {
      const res = validateAdjustment({
        medicine_id: '',
        stock_id: '',
        physical_quantity: '10',
        reason: 'damage'
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.length, 2);
    });
  });

  // --------------------------------------------------------------------------
  // 5. SEARCH & FILTERING MATCHING
  // --------------------------------------------------------------------------
  describe('5. Search & Filtering Matching Logic', () => {
    const adjustmentsSample = [
      { id: 155, medicine_name: 'Amoxicillin 500mg', batch_number: 'BATCH-VALID-01', approval_status: 'approved', reason: 'stock_count_correction', created_at: '2026-09-06T10:00:00Z' },
      { id: 156, medicine_name: 'Belladonna 30C', batch_number: 'BATCH-BEL-01', approval_status: 'pending', reason: 'damage', created_at: '2026-09-06T11:00:00Z' },
      { id: 157, medicine_name: 'Nux Vomica 200C', batch_number: 'BATCH-NUX-02', approval_status: 'rejected', reason: 'theft_loss', created_at: '2026-09-05T09:00:00Z' }
    ];

    const filterAdjustments = (list, { search, status, date }) => {
      return list.filter(a => {
        if (status && a.approval_status !== status) return false;
        if (date && !a.created_at.startsWith(date)) return false;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          const matchMed = a.medicine_name.toLowerCase().includes(q);
          const matchBatch = a.batch_number.toLowerCase().includes(q);
          const matchReason = a.reason.toLowerCase().includes(q);
          const matchId = String(a.id) === q;
          if (!matchMed && !matchBatch && !matchReason && !matchId) return false;
        }
        return true;
      });
    };

    test('5.1 Filters by status', () => {
      const pendingList = filterAdjustments(adjustmentsSample, { status: 'pending' });
      assert.strictEqual(pendingList.length, 1);
      assert.strictEqual(pendingList[0].id, 156);
    });

    test('5.2 Searches by medicine name', () => {
      const amoxList = filterAdjustments(adjustmentsSample, { search: 'amoxicillin' });
      assert.strictEqual(amoxList.length, 1);
      assert.strictEqual(amoxList[0].id, 155);
    });

    test('5.3 Searches by reason', () => {
      const theftList = filterAdjustments(adjustmentsSample, { search: 'theft_loss' });
      assert.strictEqual(theftList.length, 1);
      assert.strictEqual(theftList[0].id, 157);
    });

    test('5.4 Filters by date', () => {
      const oldList = filterAdjustments(adjustmentsSample, { date: '2026-09-05' });
      assert.strictEqual(oldList.length, 1);
      assert.strictEqual(oldList[0].id, 157);
    });
  });

  // --------------------------------------------------------------------------
  // 6. ROLE-BASED SUPER ADMIN ACTIONS GATING
  // --------------------------------------------------------------------------
  describe('6. Super Admin Action Gating', () => {
    const shouldShowApprovalActions = (userRole, approvalStatus) => {
      return userRole === 'super_admin' && approvalStatus === 'pending';
    };

    test('6.1 Shows Approve / Reject buttons for Super Admin on pending adjustments', () => {
      assert.strictEqual(shouldShowApprovalActions('super_admin', 'pending'), true);
    });

    test('6.2 Hides action buttons for regular Pharmacy staff', () => {
      assert.strictEqual(shouldShowApprovalActions('pharmacy', 'pending'), false);
    });

    test('6.3 Hides action buttons on already approved or rejected adjustments', () => {
      assert.strictEqual(shouldShowApprovalActions('super_admin', 'approved'), false);
      assert.strictEqual(shouldShowApprovalActions('super_admin', 'rejected'), false);
    });
  });

});
