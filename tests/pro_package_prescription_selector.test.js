import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// WECARE HOMEOPATHY ERP - PRO PACKAGE ENROLLMENT PRESCRIPTION INTEGRATION SUITE
// Verifies frontend prescription selection, duration defaults, duplicate
// prevention, line item modification, payload generation, and contract validation.
// ============================================================================

describe('PRO Package Enrollment — Prescription Integration Frontend Logic', () => {

  // 1. Duration Default Calculation Helper
  const getPackageDefaultDuration = (packageType) => {
    switch (packageType) {
      case '1_month': return 30;
      case '3_months': return 90;
      case '6_months': return 180;
      case '1_year': return 365;
      default: return 30;
    }
  };

  test('1. Calculates correct default duration based on selected package type', () => {
    assert.strictEqual(getPackageDefaultDuration('1_month'), 30);
    assert.strictEqual(getPackageDefaultDuration('3_months'), 90);
    assert.strictEqual(getPackageDefaultDuration('6_months'), 180);
    assert.strictEqual(getPackageDefaultDuration('1_year'), 365);
    assert.strictEqual(getPackageDefaultDuration('other'), 30);
  });

  // 2. Add Selected Medicine to Prescription State
  const addMedicineToPrescription = (currentMeds, selectedMed, defaultDuration = 30) => {
    if (!selectedMed) return { meds: currentMeds, error: 'No medicine selected' };
    
    // Duplicate prevention
    const exists = currentMeds.some(m => m.medicine_id === selectedMed.id);
    if (exists) {
      return { meds: currentMeds, error: 'This medicine is already added to the prescription list.' };
    }

    const newMedItem = {
      medicine_id: selectedMed.id,
      medicine_name: selectedMed.medicine_name,
      strength: selectedMed.strength || '',
      dosage: '2 drops',
      frequency: 'twice_daily',
      duration_days: defaultDuration,
      quantity: 1,
      instructions: selectedMed.instructions || 'Take after meals'
    };

    return {
      meds: [...currentMeds, newMedItem],
      error: null
    };
  };

  test('2. Successfully adds selected medicine with correct default clinical attributes', () => {
    let meds = [];
    const medA = { id: 101, medicine_name: 'Arnica Montana 200CH', strength: '200CH' };
    
    const res = addMedicineToPrescription(meds, medA, 90);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.meds.length, 1);
    
    const item = res.meds[0];
    assert.strictEqual(item.medicine_id, 101);
    assert.strictEqual(item.medicine_name, 'Arnica Montana 200CH');
    assert.strictEqual(item.dosage, '2 drops');
    assert.strictEqual(item.frequency, 'twice_daily');
    assert.strictEqual(item.duration_days, 90);
    assert.strictEqual(item.quantity, 1);
  });

  test('3. Prevents duplicate addition of the same medicine', () => {
    const medA = { id: 101, medicine_name: 'Arnica Montana 200CH', strength: '200CH' };
    const initial = [{
      medicine_id: 101,
      medicine_name: 'Arnica Montana 200CH',
      strength: '200CH',
      dosage: '2 drops',
      frequency: 'twice_daily',
      duration_days: 30,
      quantity: 1
    }];

    const res = addMedicineToPrescription(initial, medA, 30);
    assert.strictEqual(res.meds.length, 1);
    assert.strictEqual(res.error, 'This medicine is already added to the prescription list.');
  });

  // 3. Update Line Item Attributes
  const updatePrescriptionMed = (meds, index, field, value) => {
    return meds.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, [field]: value };
    });
  };

  test('4. Updates line item attributes (dosage, frequency, duration, quantity)', () => {
    let meds = [{
      medicine_id: 101,
      medicine_name: 'Arnica Montana 200CH',
      strength: '200CH',
      dosage: '2 drops',
      frequency: 'twice_daily',
      duration_days: 30,
      quantity: 1,
      instructions: ''
    }];

    meds = updatePrescriptionMed(meds, 0, 'dosage', '4 pills');
    meds = updatePrescriptionMed(meds, 0, 'frequency', 'thrice_daily');
    meds = updatePrescriptionMed(meds, 0, 'duration_days', 60);
    meds = updatePrescriptionMed(meds, 0, 'quantity', 2);
    meds = updatePrescriptionMed(meds, 0, 'instructions', 'Before bedtime');

    assert.strictEqual(meds[0].dosage, '4 pills');
    assert.strictEqual(meds[0].frequency, 'thrice_daily');
    assert.strictEqual(meds[0].duration_days, 60);
    assert.strictEqual(meds[0].quantity, 2);
    assert.strictEqual(meds[0].instructions, 'Before bedtime');
  });

  // 4. Remove Medicine Item
  const removePrescriptionMed = (meds, index) => {
    return meds.filter((_, idx) => idx !== index);
  };

  test('5. Removes medicine from list by index', () => {
    const meds = [
      { medicine_id: 101, medicine_name: 'Arnica Montana 200CH' },
      { medicine_id: 102, medicine_name: 'Rhus Tox 30C' }
    ];

    const updated = removePrescriptionMed(meds, 0);
    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].medicine_id, 102);
  });

  // 5. Payload Generation for Package Enrollment API
  const buildEnrollmentPayload = (formData, prescriptionMeds) => {
    return {
      patient_id: parseInt(formData.patient_id),
      package_name: formData.package_name,
      package_type: formData.package_type,
      from_date: formData.from_date,
      package_amount: parseFloat(formData.package_amount) || 0,
      discount_amount: parseFloat(formData.discount_amount) || 0,
      remarks: formData.remarks || null,
      medicines: prescriptionMeds.map(m => ({
        medicine_id: m.medicine_id,
        dosage: m.dosage,
        frequency: m.frequency,
        duration_days: parseInt(m.duration_days) || 30,
        quantity: parseInt(m.quantity) || 1,
        instructions: m.instructions || ''
      }))
    };
  };

  test('6. Generates valid API payload when enrolling without prescription (optional)', () => {
    const formData = {
      patient_id: 1246,
      package_name: '1 Month Wellness Care',
      package_type: '1_month',
      from_date: '2026-09-16',
      package_amount: '5000',
      discount_amount: '500',
      remarks: 'No meds needed upfront'
    };

    const payload = buildEnrollmentPayload(formData, []);
    assert.strictEqual(payload.patient_id, 1246);
    assert.strictEqual(payload.package_name, '1 Month Wellness Care');
    assert.strictEqual(payload.package_amount, 5000);
    assert.strictEqual(payload.discount_amount, 500);
    assert.deepStrictEqual(payload.medicines, []);
  });

  test('7. Generates valid API payload when enrolling with multiple medicines', () => {
    const formData = {
      patient_id: 1246,
      package_name: '6 Month Chronic Care Package',
      package_type: '6_months',
      from_date: '2026-09-16',
      package_amount: '18000',
      discount_amount: '1000',
      remarks: 'Package includes 2 homeopathic remedies'
    };

    const prescriptionMeds = [
      {
        medicine_id: 101,
        medicine_name: 'Arnica Montana 200CH',
        dosage: '2 drops',
        frequency: 'twice_daily',
        duration_days: 180,
        quantity: 3,
        instructions: 'Morning and Night'
      },
      {
        medicine_id: 102,
        medicine_name: 'Bryonia Alba 30C',
        dosage: '4 pills',
        frequency: 'thrice_daily',
        duration_days: 90,
        quantity: 2,
        instructions: 'Before meals'
      }
    ];

    const payload = buildEnrollmentPayload(formData, prescriptionMeds);
    assert.strictEqual(payload.patient_id, 1246);
    assert.strictEqual(payload.medicines.length, 2);
    assert.strictEqual(payload.medicines[0].medicine_id, 101);
    assert.strictEqual(payload.medicines[0].duration_days, 180);
    assert.strictEqual(payload.medicines[0].quantity, 3);
    assert.strictEqual(payload.medicines[1].medicine_id, 102);
    assert.strictEqual(payload.medicines[1].duration_days, 90);
    assert.strictEqual(payload.medicines[1].quantity, 2);
  });
});
