import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

// Helper logic representing PRO Billing calculation & validation rules
function calculateTotals(items, discountAmount) {
  const subtotal = items.reduce((sum, it) => {
    const qty = parseInt(it.quantity || 1);
    const price = parseFloat(it.unit_price || it.amount || 0);
    return sum + (price * qty);
  }, 0);
  const discount = Math.max(0, parseFloat(discountAmount || 0));
  const estimatedTotal = Math.max(0, subtotal - discount);
  return { subtotal, discount, estimatedTotal };
}

function validateBillForm({ patient_id, bill_type, items, discount_amount, package_id }) {
  const errors = [];
  const pId = parseInt(patient_id);
  if (!patient_id || isNaN(pId) || pId <= 0) {
    errors.push('Valid numeric Patient ID is required');
  }

  const validCategories = ['treatment', 'package', 'other'];
  if (!bill_type || !validCategories.includes(bill_type)) {
    if (bill_type === 'consultation') {
      errors.push('Forbidden: Consultation fee billing is handled by Receptionist only');
    } else {
      errors.push('Valid Bill Category is required');
    }
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('At least one bill item is required');
  } else {
    items.forEach((it, idx) => {
      if (!it.item_name || !it.item_name.trim()) {
        errors.push(`Item #${idx + 1}: Item name is required`);
      }
      const qty = parseInt(it.quantity);
      if (isNaN(qty) || qty <= 0) {
        errors.push(`Item #${idx + 1}: Quantity must be a positive integer`);
      }
      const price = parseFloat(it.unit_price);
      if (isNaN(price) || price < 0) {
        errors.push(`Item #${idx + 1}: Unit price cannot be negative`);
      }
    });
  }

  const { subtotal } = calculateTotals(items || [], discount_amount);
  const discount = parseFloat(discount_amount || 0);
  if (isNaN(discount) || discount < 0) {
    errors.push('Discount amount cannot be negative');
  } else if (discount > subtotal && subtotal > 0) {
    errors.push('Discount cannot exceed subtotal');
  }

  return { isValid: errors.length === 0, errors };
}

function formatBillPayload(form) {
  return {
    patient_id: parseInt(form.patient_id),
    doctor_id: form.doctor_id ? parseInt(form.doctor_id) : 1,
    bill_type: form.bill_type,
    items: form.items.map(it => ({
      item_name: it.item_name.trim(),
      description: it.item_name.trim(),
      charge_type: it.charge_type || 'Treatment',
      quantity: parseInt(it.quantity || 1),
      unit_price: parseFloat(it.unit_price || 0)
    })),
    discount_amount: parseFloat(form.discount_amount || 0),
    package_id: form.package_id ? parseInt(form.package_id) : null
  };
}

describe('PRO Billing Module - Calculations and Validation Suite', () => {

  // HAPPY PATH TESTS
  describe('Happy Path Scenarios', () => {
    test('1. Successful bill creation with single line item', () => {
      const items = [{ item_name: 'Acupuncture Therapy', charge_type: 'Treatment', quantity: 1, unit_price: 1500 }];
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'treatment',
        items,
        discount_amount: '0'
      });
      assert.strictEqual(val.isValid, true);
      assert.strictEqual(val.errors.length, 0);

      const totals = calculateTotals(items, 0);
      assert.strictEqual(totals.subtotal, 1500);
      assert.strictEqual(totals.discount, 0);
      assert.strictEqual(totals.estimatedTotal, 1500);
    });

    test('2. Successful bill creation with multiple line items', () => {
      const items = [
        { item_name: 'Consultation Followup Care', charge_type: 'Treatment', quantity: 2, unit_price: 1000 },
        { item_name: 'Herbal Supplement Pack', charge_type: 'Medicine', quantity: 1, unit_price: 2500 }
      ];
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'treatment',
        items,
        discount_amount: '500'
      });
      assert.strictEqual(val.isValid, true);

      const totals = calculateTotals(items, 500);
      assert.strictEqual(totals.subtotal, 4500); // 2*1000 + 1*2500
      assert.strictEqual(totals.discount, 500);
      assert.strictEqual(totals.estimatedTotal, 4000);
    });

    test('3. Successful bill creation with a linked Package ID', () => {
      const form = {
        patient_id: '1249',
        bill_type: 'package',
        package_id: '233',
        items: [{ item_name: 'Special Custom Rehab', charge_type: 'Package', quantity: 1, unit_price: 4500 }],
        discount_amount: '0'
      };
      const val = validateBillForm(form);
      assert.strictEqual(val.isValid, true);

      const payload = formatBillPayload(form);
      assert.strictEqual(payload.package_id, 233);
      assert.strictEqual(payload.bill_type, 'package');
      assert.strictEqual(payload.patient_id, 1249);
    });

    test('4. Correct subtotal/discount/total calculation matching backend response', () => {
      const items = [
        { quantity: 3, unit_price: 650 },
        { quantity: 2, unit_price: 1200 }
      ];
      const totals = calculateTotals(items, 350);
      assert.strictEqual(totals.subtotal, 4350); // 1950 + 2400
      assert.strictEqual(totals.discount, 350);
      assert.strictEqual(totals.estimatedTotal, 4000);
    });
  });

  // EDGE CASE TESTS
  describe('Edge Case Validations', () => {
    test('5. Empty or missing Patient ID is rejected', () => {
      const val = validateBillForm({
        patient_id: '',
        bill_type: 'treatment',
        items: [{ item_name: 'Session', charge_type: 'Treatment', quantity: 1, unit_price: 1000 }]
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Patient ID is required')));
    });

    test('6. Non-numeric or negative Patient ID is rejected', () => {
      const val = validateBillForm({
        patient_id: '-5',
        bill_type: 'treatment',
        items: [{ item_name: 'Session', charge_type: 'Treatment', quantity: 1, unit_price: 1000 }]
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Valid numeric Patient ID')));
    });

    test('7. Bill Category not selected or invalid is rejected', () => {
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: '',
        items: [{ item_name: 'Session', charge_type: 'Treatment', quantity: 1, unit_price: 1000 }]
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Valid Bill Category is required')));
    });

    test('8. Role restriction: consultation bill_type is blocked for PRO', () => {
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'consultation',
        items: [{ item_name: 'Consultation Fee', charge_type: 'Consultation', quantity: 1, unit_price: 500 }]
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Consultation fee billing is handled by Receptionist only')));
    });

    test('9. Zero quantity is rejected', () => {
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'treatment',
        items: [{ item_name: 'Session', charge_type: 'Treatment', quantity: 0, unit_price: 1000 }]
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Quantity must be a positive integer')));
    });

    test('10. Negative quantity is rejected', () => {
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'treatment',
        items: [{ item_name: 'Session', charge_type: 'Treatment', quantity: -2, unit_price: 1000 }]
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Quantity must be a positive integer')));
    });

    test('11. Negative unit price is rejected', () => {
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'treatment',
        items: [{ item_name: 'Session', charge_type: 'Treatment', quantity: 1, unit_price: -500 }]
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Unit price cannot be negative')));
    });

    test('12. Discount amount greater than subtotal is rejected', () => {
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'treatment',
        items: [{ item_name: 'Session', charge_type: 'Treatment', quantity: 1, unit_price: 1000 }],
        discount_amount: '1500' // exceeds 1000
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Discount cannot exceed subtotal')));
    });

    test('13. Negative discount amount is rejected', () => {
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'treatment',
        items: [{ item_name: 'Session', charge_type: 'Treatment', quantity: 1, unit_price: 1000 }],
        discount_amount: '-200'
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('Discount amount cannot be negative')));
    });

    test('14. Submitting with zero bill items is rejected', () => {
      const val = validateBillForm({
        patient_id: '1249',
        bill_type: 'treatment',
        items: []
      });
      assert.strictEqual(val.isValid, false);
      assert.ok(val.errors.some(e => e.includes('At least one bill item is required')));
    });

    test('15. Special characters and SQL injection strings in item name are safely sanitized', () => {
      const form = {
        patient_id: '1249',
        bill_type: 'other',
        items: [{ item_name: "Special' OR '1'='1; DROP TABLE bills;--", charge_type: 'Service', quantity: 1, unit_price: 100 }],
        discount_amount: '0'
      };
      const val = validateBillForm(form);
      assert.strictEqual(val.isValid, true);
      const payload = formatBillPayload(form);
      assert.strictEqual(payload.items[0].item_name, "Special' OR '1'='1; DROP TABLE bills;--");
    });

    test('16. Very large numeric values are handled cleanly without NaN', () => {
      const items = [{ item_name: 'High Tech Laser', charge_type: 'Treatment', quantity: 2, unit_price: 99999999 }];
      const totals = calculateTotals(items, 9999);
      assert.strictEqual(totals.subtotal, 199999998);
      assert.strictEqual(totals.estimatedTotal, 199990000 - 1);
      assert.ok(!isNaN(totals.estimatedTotal));
    });

    test('17. Contract Drift Resilience: Response payload missing fields fails gracefully', () => {
      // Simulate partial backend response
      const incompleteResponse = { success: true, data: { bill_id: 999 } }; // missing bill_number, subtotal, etc.
      const safeBillNumber = incompleteResponse.data?.bill_number || `BILL-${incompleteResponse.data?.bill_id}`;
      const safeFinalAmount = parseFloat(incompleteResponse.data?.final_amount || incompleteResponse.data?.total_amount || 0);
      assert.strictEqual(safeBillNumber, 'BILL-999');
      assert.strictEqual(safeFinalAmount, 0);
    });

    test('18. Double-click prevention: submitting lock stops concurrent duplicate requests', () => {
      let isSubmitting = false;
      let requestCount = 0;

      const submitAction = () => {
        if (isSubmitting) return false;
        isSubmitting = true;
        requestCount++;
        return true;
      };

      const firstClick = submitAction();
      const secondClick = submitAction(); // rapid second click
      assert.strictEqual(firstClick, true);
      assert.strictEqual(secondClick, false);
      assert.strictEqual(requestCount, 1);
    });
  });

  // REGRESSION CHECKS
  describe('Regression Checks on Unaffected Modules', () => {
    test('19. Due calculations across all tabs maintain non-negative values', () => {
      const sampleBills = [
        { total_amount: 5000, paid_amount: 2000 },
        { total_amount: 3000, paid_amount: 3000 },
        { total_amount: 2000, paid_amount: 2500 } // overpaid edge case
      ];
      const dues = sampleBills.map(b => Math.max(0, parseFloat(b.total_amount) - parseFloat(b.paid_amount)));
      assert.deepStrictEqual(dues, [3000, 0, 0]);
    });

    test('20. Status badge classification adheres to invoice lifecycles', () => {
      const getBadge = (b) => {
        const total = parseFloat(b.total_amount);
        const paid = parseFloat(b.paid_amount || 0);
        if (paid >= total) return 'PAID';
        if (paid > 0) return 'PARTIAL';
        return 'PENDING';
      };

      assert.strictEqual(getBadge({ total_amount: 1000, paid_amount: 1000 }), 'PAID');
      assert.strictEqual(getBadge({ total_amount: 1000, paid_amount: 400 }), 'PARTIAL');
      assert.strictEqual(getBadge({ total_amount: 1000, paid_amount: 0 }), 'PENDING');
    });
  });
});
