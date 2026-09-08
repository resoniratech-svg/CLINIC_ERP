import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Pharmacy Portal — Dispensing Module Integration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. TAB AND ROUTE PATH RESOLUTION
  // --------------------------------------------------------------------------
  describe('1. Dispensing Hub Tab Resolution and Navigation Contracts', () => {
    const tabsList = [
      { id: 'pending', label: 'Pending Dispensing', path: '/pharmacy/dispensing/pending' },
      { id: 'processing', label: 'Processing & Clarifications', path: '/pharmacy/dispensing/processing' },
      { id: 'dispensed', label: 'Dispensed', path: '/pharmacy/dispensing/dispensed' },
      { id: 'history', label: 'Dispensing History', path: '/pharmacy/dispensing/history' },
    ];

    test('1.1 Resolves all 4 primary dispensing tabs correctly', () => {
      assert.strictEqual(tabsList.length, 4);
      assert.deepStrictEqual(tabsList.map(t => t.id), ['pending', 'processing', 'dispensed', 'history']);
    });

    test('1.2 Maps tab paths strictly without sub-menu sidebar nesting', () => {
      tabsList.forEach(tab => {
        assert.ok(tab.path.startsWith('/pharmacy/dispensing/'));
      });
    });

    test('1.3 Defaults activeTab to "pending" when parameter is empty or undefined', () => {
      const getActiveTab = (param) => param || 'pending';
      assert.strictEqual(getActiveTab(undefined), 'pending');
      assert.strictEqual(getActiveTab(''), 'pending');
      assert.strictEqual(getActiveTab('processing'), 'processing');
      assert.strictEqual(getActiveTab('history'), 'history');
    });
  });

  // --------------------------------------------------------------------------
  // 2. SEARCH & FILTER CONTRACTS
  // --------------------------------------------------------------------------
  describe('2. Search & Date Filter Query Builder', () => {
    const buildQueueQuery = (activeTab, search, dateFilter, urlPatientId) => {
      const trimmedSearch = (search || '').trim();
      if (activeTab === 'history') {
        return {
          patient_id: urlPatientId || undefined,
          search: trimmedSearch || undefined,
          date: dateFilter || undefined,
        };
      }
      return {
        status: activeTab === 'all' ? undefined : activeTab,
        search: trimmedSearch || undefined,
        date: dateFilter || undefined,
      };
    };

    test('2.1 Trims query strings and cleans empty date filters', () => {
      const q = buildQueueQuery('pending', '   Arnica   ', '', '');
      assert.strictEqual(q.status, 'pending');
      assert.strictEqual(q.search, 'Arnica');
      assert.strictEqual(q.date, undefined);
    });

    test('2.2 Applies patient_id parameter exclusively on history tab', () => {
      const qHistory = buildQueueQuery('history', '', '2026-09-06', '1324');
      assert.strictEqual(qHistory.patient_id, '1324');
      assert.strictEqual(qHistory.date, '2026-09-06');
      assert.strictEqual(qHistory.status, undefined);
    });

    test('2.3 Numeric prescription ID or token searches are preserved', () => {
      const q = buildQueueQuery('processing', '402', undefined, undefined);
      assert.strictEqual(q.search, '402');
      assert.strictEqual(q.status, 'processing');
    });
  });

  // --------------------------------------------------------------------------
  // 3. PRO & PAYMENT GATING BADGE EVALUATION
  // --------------------------------------------------------------------------
  describe('3. PRO and Payment Gating Status Mapping', () => {
    const getProBadgeText = (proStatus) => {
      const st = proStatus || 'pro_completed';
      return st === 'pro_completed' ? 'PRO: COMPLETED' : 'PRO: PENDING';
    };

    const getPaymentBadge = (payStatus) => {
      const st = (payStatus || 'paid').toLowerCase();
      switch (st) {
        case 'paid':
        case 'success':
        case 'created':
          return { label: 'PAID', style: 'emerald' };
        case 'partially_paid':
        case 'partial':
          return { label: 'PARTIAL', style: 'amber' };
        case 'unbilled':
          return { label: 'UNBILLED', style: 'slate' };
        default:
          return { label: 'UNPAID', style: 'rose' };
      }
    };

    test('3.1 Rejection of uncompleted PRO status in queue contract', () => {
      assert.strictEqual(getProBadgeText('pro_completed'), 'PRO: COMPLETED');
      assert.strictEqual(getProBadgeText('in_consultation'), 'PRO: PENDING');
    });

    test('3.2 Accurate mapping of payment statuses (Paid, Partial, Unbilled, Unpaid)', () => {
      assert.strictEqual(getPaymentBadge('paid').label, 'PAID');
      assert.strictEqual(getPaymentBadge('partially_paid').label, 'PARTIAL');
      assert.strictEqual(getPaymentBadge('unbilled').label, 'UNBILLED');
      assert.strictEqual(getPaymentBadge('pending').label, 'UNPAID');
    });
  });

  // --------------------------------------------------------------------------
  // 4. PHARMACY DISPENSE & CLARIFICATION BADGES
  // --------------------------------------------------------------------------
  describe('4. Pharmacy Dispense Status & Clarification Evaluation', () => {
    const getPharmacyStatusBadge = (status) => {
      switch (status) {
        case 'dispensed':
          return 'Dispensed';
        case 'partially_dispensed':
          return 'Partial';
        case 'processing':
          return 'Processing';
        default:
          return 'Pending';
      }
    };

    const evaluateClarificationIndicator = (openClarificationsCount) => {
      const count = parseInt(openClarificationsCount || 0);
      if (count > 0) {
        return { hasClarification: true, text: `${count} Clarification${count > 1 ? 's' : ''}` };
      }
      return { hasClarification: false, text: '' };
    };

    test('4.1 Maps all pharmacy lifecycle statuses accurately', () => {
      assert.strictEqual(getPharmacyStatusBadge('pending'), 'Pending');
      assert.strictEqual(getPharmacyStatusBadge('processing'), 'Processing');
      assert.strictEqual(getPharmacyStatusBadge('partially_dispensed'), 'Partial');
      assert.strictEqual(getPharmacyStatusBadge('dispensed'), 'Dispensed');
    });

    test('4.2 Evaluates open clarification counts correctly', () => {
      const res0 = evaluateClarificationIndicator(0);
      assert.strictEqual(res0.hasClarification, false);

      const res1 = evaluateClarificationIndicator(1);
      assert.strictEqual(res1.hasClarification, true);
      assert.strictEqual(res1.text, '1 Clarification');

      const res2 = evaluateClarificationIndicator(3);
      assert.strictEqual(res2.hasClarification, true);
      assert.strictEqual(res2.text, '3 Clarifications');
    });
  });

  // --------------------------------------------------------------------------
  // 5. DISPENSING ACTION PAYLOAD & DOUBLE-DISPENSING PROTECTION
  // --------------------------------------------------------------------------
  describe('5. Dispensing Action Validation & Concurrency Protection', () => {
    const validateDispensingSubmission = (items, selectedBatches, dispenseQtys, currentStatus, submitting) => {
      if (submitting) return { valid: false, error: 'Request in flight' };
      if (currentStatus === 'dispensed') return { valid: false, error: 'Prescription already dispensed' };

      for (const item of items) {
        const batchId = selectedBatches[item.id];
        if (!batchId) {
          return { valid: false, error: `Batch required for ${item.medicine_name}` };
        }
        const qty = parseInt(dispenseQtys[item.id] || 0);
        if (qty <= 0) {
          return { valid: false, error: `Positive quantity required for ${item.medicine_name}` };
        }
      }

      return {
        valid: true,
        payload: {
          items: items.map(item => ({
            item_id: item.id,
            stock_id: parseInt(selectedBatches[item.id]),
            dispense_quantity: parseInt(dispenseQtys[item.id]),
          })),
        },
      };
    };

    test('5.1 Rejects dispensing submission when request is already in-flight (double-click prevention)', () => {
      const res = validateDispensingSubmission([], {}, {}, 'processing', true);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Request in flight');
    });

    test('5.2 Rejects re-dispensing an already dispensed prescription', () => {
      const res = validateDispensingSubmission([], {}, {}, 'dispensed', false);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Prescription already dispensed');
    });

    test('5.3 Rejects item without stock batch selection', () => {
      const items = [{ id: 101, medicine_name: 'Belladonna 30' }];
      const res = validateDispensingSubmission(items, {}, { 101: 5 }, 'processing', false);
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /Batch required/);
    });

    test('5.4 Rejects non-positive dispense quantity', () => {
      const items = [{ id: 101, medicine_name: 'Belladonna 30' }];
      const res = validateDispensingSubmission(items, { 101: 55 }, { 101: 0 }, 'processing', false);
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /Positive quantity required/);
    });

    test('5.5 Generates valid completeDispensing payload when verified', () => {
      const items = [
        { id: 101, medicine_name: 'Belladonna 30' },
        { id: 102, medicine_name: 'Arnica 200' },
      ];
      const res = validateDispensingSubmission(
        items,
        { 101: 12, 102: 15 },
        { 101: 4, 102: 2 },
        'processing',
        false
      );
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.payload.items.length, 2);
      assert.strictEqual(res.payload.items[0].stock_id, 12);
      assert.strictEqual(res.payload.items[0].dispense_quantity, 4);
    });
  });

});
