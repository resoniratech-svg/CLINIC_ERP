import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Core domain logic mirroring PROBillingPage & PROPackagesPage
function applyPackageToBillingForm(form, selectedPkg) {
  if (!selectedPkg) {
    return {
      ...form,
      package_id: '',
      bill_type: 'treatment',
      discount_amount: '0',
      items: [{ item_name: 'Treatment Session', charge_type: 'Treatment', quantity: 1, unit_price: 2000 }]
    };
  }

  const pkgAmount = parseFloat(selectedPkg.package_amount || selectedPkg.final_amount || 0);
  const discAmount = parseFloat(selectedPkg.discount_amount || 0);

  return {
    ...form,
    package_id: selectedPkg.package_id,
    bill_type: 'package',
    doctor_id: selectedPkg.doctor_id ? String(selectedPkg.doctor_id) : form.doctor_id,
    discount_amount: String(discAmount),
    items: [
      {
        item_name: selectedPkg.package_name || 'Treatment Package',
        charge_type: 'Package',
        quantity: 1,
        unit_price: pkgAmount
      }
    ]
  };
}

function calculateBillingTotals(items, discountAmount) {
  const subtotal = (items || []).reduce((sum, it) => {
    const qty = parseInt(it.quantity || 1, 10);
    const price = parseFloat(it.unit_price || 0);
    return sum + (price * qty);
  }, 0);
  const discount = Math.max(0, parseFloat(discountAmount || 0));
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  return { subtotal, discount, total };
}

function checkDuplicateBilling(packageObj) {
  if (!packageObj) return { isDuplicate: false, message: null };
  const isBilled = Boolean(packageObj.billing_status && packageObj.billing_status !== 'unbilled');
  return {
    isDuplicate: isBilled,
    message: isBilled
      ? `Package #${packageObj.package_id} already has Invoice #${packageObj.invoice_number || packageObj.invoice_id} (${packageObj.billing_status}). Cannot create duplicate invoice.`
      : null
  };
}

function computePackageReconciliation(pkg) {
  const total = parseFloat(pkg.final_amount || pkg.package_amount || 0);
  const paid = parseFloat(pkg.paid_amount || 0);
  const balance = Math.max(0, parseFloat(pkg.balance_due ?? (total - paid)));
  const status = pkg.billing_status || (paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unbilled');
  return { total, paid, balance, status };
}

describe('PRO Package Billing Frontend Logic & Reconciliation Tests', () => {
  const mockUnbilledPackage = {
    package_id: 101,
    patient_id: 202,
    package_name: 'Quarterly Homeopathy Wellness',
    package_type: 'quarterly',
    package_amount: '30000.00',
    discount_amount: '3000.00',
    final_amount: '27000.00',
    billing_status: 'unbilled',
    invoice_id: null,
    invoice_number: null,
    paid_amount: '0.00',
    balance_due: '27000.00'
  };

  const mockInvoicedPackage = {
    package_id: 102,
    patient_id: 202,
    package_name: 'Monthly Skin Care Plan',
    package_type: 'monthly',
    package_amount: '12000.00',
    discount_amount: '1000.00',
    final_amount: '11000.00',
    billing_status: 'invoiced',
    invoice_id: 550,
    invoice_number: 'BILL-PRO-1710000001',
    paid_amount: '0.00',
    balance_due: '11000.00'
  };

  const mockPartiallyPaidPackage = {
    package_id: 103,
    patient_id: 203,
    package_name: 'Annual Chronic Disease Care',
    package_type: 'yearly',
    package_amount: '60000.00',
    discount_amount: '10000.00',
    final_amount: '50000.00',
    billing_status: 'partially_paid',
    invoice_id: 551,
    invoice_number: 'BILL-PRO-1710000002',
    paid_amount: '20000.00',
    balance_due: '30000.00'
  };

  const mockPaidPackage = {
    package_id: 104,
    patient_id: 204,
    package_name: 'Pediatric Care Package',
    package_type: 'monthly',
    package_amount: '8000.00',
    discount_amount: '0.00',
    final_amount: '8000.00',
    billing_status: 'paid',
    invoice_id: 552,
    invoice_number: 'BILL-PRO-1710000003',
    paid_amount: '8000.00',
    balance_due: '0.00'
  };

  test('1. Selecting an unbilled package sets bill_type to package and populates single line item', () => {
    const initialForm = {
      patient_id: '202',
      doctor_id: '1',
      bill_type: 'treatment',
      discount_amount: '0',
      package_id: '',
      items: [{ item_name: 'Treatment Session', charge_type: 'Treatment', quantity: 1, unit_price: 2000 }]
    };

    const updated = applyPackageToBillingForm(initialForm, mockUnbilledPackage);

    assert.equal(updated.bill_type, 'package');
    assert.equal(updated.package_id, 101);
    assert.equal(updated.discount_amount, '3000');
    assert.equal(updated.items.length, 1);
    assert.equal(updated.items[0].charge_type, 'Package');
    assert.equal(updated.items[0].item_name, 'Quarterly Homeopathy Wellness');
    assert.equal(updated.items[0].unit_price, 30000);
  });

  test('2. Authoritative calculations match package agreement (subtotal, discount, final amount)', () => {
    const updatedForm = applyPackageToBillingForm({}, mockUnbilledPackage);
    const totals = calculateBillingTotals(updatedForm.items, updatedForm.discount_amount);

    assert.equal(totals.subtotal, 30000);
    assert.equal(totals.discount, 3000);
    assert.equal(totals.total, 27000);
  });

  test('3. Duplicate invoice guard permits unbilled package and blocks already-invoiced package', () => {
    const unbilledCheck = checkDuplicateBilling(mockUnbilledPackage);
    assert.equal(unbilledCheck.isDuplicate, false);
    assert.equal(unbilledCheck.message, null);

    const invoicedCheck = checkDuplicateBilling(mockInvoicedPackage);
    assert.equal(invoicedCheck.isDuplicate, true);
    assert.match(invoicedCheck.message, /already has Invoice #BILL-PRO-1710000001/);

    const partialCheck = checkDuplicateBilling(mockPartiallyPaidPackage);
    assert.equal(partialCheck.isDuplicate, true);
  });

  test('4. Deselecting package resets to standard bill items and editable state', () => {
    const initialForm = applyPackageToBillingForm({}, mockUnbilledPackage);
    const cleared = applyPackageToBillingForm(initialForm, null);

    assert.equal(cleared.package_id, '');
    assert.equal(cleared.bill_type, 'treatment');
    assert.equal(cleared.discount_amount, '0');
    assert.equal(cleared.items[0].item_name, 'Treatment Session');
    assert.equal(cleared.items[0].charge_type, 'Treatment');
  });

  test('5. Prescription medicines are separated and not added as bill line items', () => {
    const packageWithMeds = {
      ...mockUnbilledPackage,
      prescription_id: 88,
      prescription_medicines: [
        { medicine_name: 'Arnica Montana 30C', quantity: 2 },
        { medicine_name: 'Belladonna 200C', quantity: 1 }
      ]
    };

    const formWithPackage = applyPackageToBillingForm({}, packageWithMeds);

    // Must strictly have exactly 1 line item for the package charge
    assert.equal(formWithPackage.items.length, 1);
    assert.equal(formWithPackage.items[0].charge_type, 'Package');
    assert.equal(formWithPackage.items.some(it => it.charge_type === 'Medicine'), false);
  });

  test('6. Package reconciliation accurately computes balance due for all lifecycle stages', () => {
    const recUnbilled = computePackageReconciliation(mockUnbilledPackage);
    assert.equal(recUnbilled.status, 'unbilled');
    assert.equal(recUnbilled.balance, 27000);

    const recInvoiced = computePackageReconciliation(mockInvoicedPackage);
    assert.equal(recInvoiced.status, 'invoiced');
    assert.equal(recInvoiced.balance, 11000);

    const recPartial = computePackageReconciliation(mockPartiallyPaidPackage);
    assert.equal(recPartial.status, 'partially_paid');
    assert.equal(recPartial.paid, 20000);
    assert.equal(recPartial.balance, 30000);

    const recPaid = computePackageReconciliation(mockPaidPackage);
    assert.equal(recPaid.status, 'paid');
    assert.equal(recPaid.paid, 8000);
    assert.equal(recPaid.balance, 0);
  });

  test('7. Packages table action buttons correctly switch between Create Invoice and View Invoice', () => {
    function getPackageAction(pkg) {
      if (pkg.billing_status === 'unbilled' || !pkg.invoice_id) {
        return { type: 'create', link: `/pro/billing/new?patient_id=${pkg.patient_id}&package_id=${pkg.package_id}` };
      }
      return { type: 'view', invoice_id: pkg.invoice_id };
    }

    const actionUnbilled = getPackageAction(mockUnbilledPackage);
    assert.equal(actionUnbilled.type, 'create');
    assert.equal(actionUnbilled.link, '/pro/billing/new?patient_id=202&package_id=101');

    const actionInvoiced = getPackageAction(mockInvoicedPackage);
    assert.equal(actionInvoiced.type, 'view');
    assert.equal(actionInvoiced.invoice_id, 550);
  });
});
