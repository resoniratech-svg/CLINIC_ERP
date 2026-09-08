import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Pharmacy Portal — Prescription Queue Integration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. DYNAMIC PRO & PAYMENT BADGE EVALUATION
  // --------------------------------------------------------------------------
  describe('1. PRO and Payment Status Dynamic Mapping', () => {
    const getProStatusText = (proStatus) => {
      const st = proStatus || 'pro_completed';
      switch (st) {
        case 'pro_completed':
          return 'PRO: COMPLETED';
        case 'pro_pending':
          return 'PRO: PENDING';
        default:
          return `PRO: ${st.replace('_', ' ').toUpperCase()}`;
      }
    };

    const getPaymentBadgeText = (payStatus) => {
      const st = payStatus || 'paid';
      switch (st) {
        case 'paid':
        case 'success':
        case 'created':
          return 'PAID';
        case 'partially_paid':
        case 'partial':
          return 'PARTIAL';
        case 'unpaid':
        case 'pending':
          return 'UNPAID';
        case 'unbilled':
          return 'UNBILLED';
        case 'refunded':
          return 'REFUNDED';
        case 'cancelled':
          return 'CANCELLED';
        default:
          return st.toUpperCase();
      }
    };

    test('1.1 Maps "pro_completed" to "PRO: COMPLETED"', () => {
      assert.strictEqual(getProStatusText('pro_completed'), 'PRO: COMPLETED');
    });

    test('1.2 Maps "pro_pending" to "PRO: PENDING"', () => {
      assert.strictEqual(getProStatusText('pro_pending'), 'PRO: PENDING');
    });

    test('1.3 Dynamically formats unknown PRO statuses without hardcoded fallback', () => {
      assert.strictEqual(getProStatusText('manager_review'), 'PRO: MANAGER REVIEW');
    });

    test('1.4 Maps payment status "paid", "success", and "created" to PAID', () => {
      assert.strictEqual(getPaymentBadgeText('paid'), 'PAID');
      assert.strictEqual(getPaymentBadgeText('success'), 'PAID');
      assert.strictEqual(getPaymentBadgeText('created'), 'PAID');
    });

    test('1.5 Maps partial payments to PARTIAL', () => {
      assert.strictEqual(getPaymentBadgeText('partially_paid'), 'PARTIAL');
      assert.strictEqual(getPaymentBadgeText('partial'), 'PARTIAL');
    });

    test('1.6 Maps unpaid and pending payments to UNPAID', () => {
      assert.strictEqual(getPaymentBadgeText('unpaid'), 'UNPAID');
      assert.strictEqual(getPaymentBadgeText('pending'), 'UNPAID');
    });

    test('1.7 Maps unbilled, refunded, and cancelled payment states accurately', () => {
      assert.strictEqual(getPaymentBadgeText('unbilled'), 'UNBILLED');
      assert.strictEqual(getPaymentBadgeText('refunded'), 'REFUNDED');
      assert.strictEqual(getPaymentBadgeText('cancelled'), 'CANCELLED');
    });
  });

  // --------------------------------------------------------------------------
  // 2. PHARMACY DISPENSE STATUS MAPPING
  // --------------------------------------------------------------------------
  describe('2. Pharmacy Dispense Status Mapping', () => {
    const getStatusLabel = (status) => {
      switch (status) {
        case 'dispensed':
          return 'Dispensed';
        case 'processing':
          return 'Processing';
        case 'partially_dispensed':
          return 'Partial';
        case 'on_hold':
          return 'On Hold';
        case 'cancelled':
          return 'Cancelled';
        default:
          return 'Pending';
      }
    };

    test('2.1 Correctly maps all PostgreSQL pharmacy_status_enum values', () => {
      assert.strictEqual(getStatusLabel('pending'), 'Pending');
      assert.strictEqual(getStatusLabel('processing'), 'Processing');
      assert.strictEqual(getStatusLabel('partially_dispensed'), 'Partial');
      assert.strictEqual(getStatusLabel('dispensed'), 'Dispensed');
      assert.strictEqual(getStatusLabel('on_hold'), 'On Hold');
      assert.strictEqual(getStatusLabel('cancelled'), 'Cancelled');
      assert.strictEqual(getStatusLabel(undefined), 'Pending');
    });
  });

  // --------------------------------------------------------------------------
  // 3. SEARCH MATCHING ACROSS FIELDS
  // --------------------------------------------------------------------------
  describe('3. Multi-Field Search Matching Logic', () => {
    const mockQueue = [
      {
        prescription_id: 379,
        token_no: 1439,
        patient_id: 1319,
        registration_id: 1319,
        patient_name: 'Pharmacy Test Patient',
        mobile_number: '9777766661',
        doctor_name: 'Dr. John Smith',
        pharmacy_status: 'dispensed'
      },
      {
        prescription_id: 382,
        token_no: 1442,
        patient_id: 1320,
        registration_id: 'REG-2026-88',
        patient_name: 'Ananya Sharma',
        mobile_number: '9848022338',
        doctor_name: 'Dr. Sarah Connor',
        pharmacy_status: 'pending'
      }
    ];

    const matchSearch = (item, query) => {
      if (!query || !query.trim()) return true;
      const term = query.toLowerCase();
      return (
        item.patient_name?.toLowerCase().includes(term) ||
        String(item.patient_id).includes(term) ||
        String(item.registration_id || '').toLowerCase().includes(term) ||
        String(item.prescription_id).includes(term) ||
        String(item.token_no || '').includes(term) ||
        item.mobile_number?.includes(term) ||
        item.doctor_name?.toLowerCase().includes(term)
      );
    };

    test('3.1 Searches by patient full name (case-insensitive)', () => {
      const results = mockQueue.filter(i => matchSearch(i, 'ananya'));
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].prescription_id, 382);
    });

    test('3.2 Searches by exact Rx ID', () => {
      const results = mockQueue.filter(i => matchSearch(i, '379'));
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].patient_name, 'Pharmacy Test Patient');
    });

    test('3.3 Searches by token number', () => {
      const results = mockQueue.filter(i => matchSearch(i, '1442'));
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].patient_name, 'Ananya Sharma');
    });

    test('3.4 Searches by patient phone number', () => {
      const results = mockQueue.filter(i => matchSearch(i, '9848022338'));
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].patient_id, 1320);
    });

    test('3.5 Searches by alphanumeric registration ID', () => {
      const results = mockQueue.filter(i => matchSearch(i, 'reg-2026'));
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].prescription_id, 382);
    });

    test('3.6 Searches by consulting doctor name', () => {
      const results = mockQueue.filter(i => matchSearch(i, 'connor'));
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].doctor_name, 'Dr. Sarah Connor');
    });
  });

  // --------------------------------------------------------------------------
  // 4. ACTION LINK BEHAVIOR
  // --------------------------------------------------------------------------
  describe('4. Context-Aware Action Link Behavior', () => {
    test('4.1 Dispensed prescriptions present "View Details" action', () => {
      const isDispensed = (status) => status === 'dispensed';
      const getActionLabel = (status) => (isDispensed(status) ? 'View Details' : 'Process');

      assert.strictEqual(getActionLabel('dispensed'), 'View Details');
      assert.strictEqual(getActionLabel('pending'), 'Process');
      assert.strictEqual(getActionLabel('processing'), 'Process');
      assert.strictEqual(getActionLabel('partially_dispensed'), 'Process');
      assert.strictEqual(getActionLabel('on_hold'), 'Process');
    });
  });

  // --------------------------------------------------------------------------
  // 5. DATE AND TIME FORMATTING
  // --------------------------------------------------------------------------
  describe('5. Date & Time Formatting Integrity', () => {
    const formatDate = (dateStr) => {
      if (!dateStr) return { date: '—', time: '' };
      try {
        const d = new Date(dateStr);
        return {
          date: d.toLocaleDateString('en-GB'),
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      } catch {
        return { date: dateStr, time: '' };
      }
    };

    test('5.1 Formats ISO timestamp to DD/MM/YYYY', () => {
      const { date } = formatDate('2026-09-06T11:15:44.870Z');
      assert.strictEqual(date, '06/09/2026');
    });

    test('5.2 Gracefully returns dash when date string is missing or null', () => {
      const { date, time } = formatDate(null);
      assert.strictEqual(date, '—');
      assert.strictEqual(time, '');
    });
  });
});
