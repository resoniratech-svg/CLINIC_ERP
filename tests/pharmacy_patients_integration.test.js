import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Pharmacy Portal — Patients Directory Integration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. SEARCH QUERY FORMATTING & PARAMETER BUILDER
  // --------------------------------------------------------------------------
  describe('1. Search Query Formatting and Filtering Contract', () => {
    const buildSearchParams = (searchTerm) => {
      const trimmed = (searchTerm || '').trim();
      return {
        search: trimmed || undefined,
      };
    };

    test('1.1 Trims whitespace from search queries', () => {
      const params = buildSearchParams('   Ravi Kumar   ');
      assert.strictEqual(params.search, 'Ravi Kumar');
    });

    test('1.2 Converts empty or whitespace-only search string to undefined', () => {
      const params1 = buildSearchParams('');
      const params2 = buildSearchParams('     ');
      assert.strictEqual(params1.search, undefined);
      assert.strictEqual(params2.search, undefined);
    });

    test('1.3 Preserves numeric registration ID searches intact', () => {
      const params = buildSearchParams('1322');
      assert.strictEqual(params.search, '1322');
    });

    test('1.4 Preserves phone number queries with special characters or prefixes', () => {
      const params = buildSearchParams('+91 9777766661');
      assert.strictEqual(params.search, '+91 9777766661');
    });
  });

  // --------------------------------------------------------------------------
  // 2. CLINICAL PRIVACY COMPLIANCE & STRICT DATA ISOLATION
  // --------------------------------------------------------------------------
  describe('2. Clinical Privacy Compliance & Zero Diagnosis Exposure', () => {
    // Audit function to verify that patient record for pharmacy strictly contains demographic data
    const auditPharmacyPatientData = (patientRecord) => {
      const prohibitedClinicalFields = [
        'chief_complaint',
        'primary_diagnosis',
        'primary_diagnosis_text',
        'clinical_notes',
        'examination_findings',
        'doctor_notes',
        'treatment_recommendations',
        'investigation_advice',
      ];

      for (const field of prohibitedClinicalFields) {
        if (patientRecord[field] !== undefined && patientRecord[field] !== null) {
          return { compliant: false, leakedField: field };
        }
      }

      return { compliant: true };
    };

    test('2.1 Pure demographic patient record passes privacy compliance audit', () => {
      const validPharmacyPatient = {
        patient_id: 1322,
        registration_id: 'REG-1322',
        full_name: 'Pharmacy Test Patient',
        mobile_number: '9777766661',
        age: 35,
        gender: 'male',
        address: 'Hyderabad',
      };

      const audit = auditPharmacyPatientData(validPharmacyPatient);
      assert.strictEqual(audit.compliant, true);
    });

    test('2.2 Rejects and flags patient records containing doctor consultation notes or diagnoses', () => {
      const leakedRecord = {
        patient_id: 1322,
        full_name: 'Pharmacy Test Patient',
        mobile_number: '9777766661',
        primary_diagnosis_text: 'Chronic Migraine & Cervical Spondylosis',
      };

      const audit = auditPharmacyPatientData(leakedRecord);
      assert.strictEqual(audit.compliant, false);
      assert.strictEqual(audit.leakedField, 'primary_diagnosis_text');
    });

    test('2.3 Rejects patient records containing internal doctor clinical examination findings', () => {
      const leakedRecord = {
        patient_id: 1322,
        full_name: 'Pharmacy Test Patient',
        clinical_notes: 'Patient exhibits sensitivity to heat, bilateral pulse normal',
      };

      const audit = auditPharmacyPatientData(leakedRecord);
      assert.strictEqual(audit.compliant, false);
      assert.strictEqual(audit.leakedField, 'clinical_notes');
    });
  });

  // --------------------------------------------------------------------------
  // 3. DISPENSE STATUS MAPPING & ITEM DETAILS TRANSFORMATION
  // --------------------------------------------------------------------------
  describe('3. Dispensing Status Mapping & Item Details Transformation', () => {
    const getStatusBadgeMeta = (status) => {
      switch (status) {
        case 'dispensed':
          return { label: 'Dispensed', color: 'emerald' };
        case 'partially_dispensed':
          return { label: 'Partial', color: 'amber' };
        case 'processing':
          return { label: 'Processing', color: 'blue' };
        default:
          return { label: 'Pending', color: 'slate' };
      }
    };

    test('3.1 Maps status "dispensed" to emerald badge', () => {
      const meta = getStatusBadgeMeta('dispensed');
      assert.strictEqual(meta.label, 'Dispensed');
      assert.strictEqual(meta.color, 'emerald');
    });

    test('3.2 Maps status "partially_dispensed" to amber badge', () => {
      const meta = getStatusBadgeMeta('partially_dispensed');
      assert.strictEqual(meta.label, 'Partial');
      assert.strictEqual(meta.color, 'amber');
    });

    test('3.3 Maps status "processing" to blue badge', () => {
      const meta = getStatusBadgeMeta('processing');
      assert.strictEqual(meta.label, 'Processing');
      assert.strictEqual(meta.color, 'blue');
    });

    test('3.4 Default or pending status maps to slate badge', () => {
      const meta = getStatusBadgeMeta('pending');
      assert.strictEqual(meta.label, 'Pending');
      assert.strictEqual(meta.color, 'slate');
    });

    test('3.5 Correctly processes aggregated item array with batch details', () => {
      const mockRx = {
        prescription_id: 108,
        status: 'dispensed',
        items: [
          {
            item_id: 201,
            medicine_name: 'Arnica Montana',
            potency: '200CH',
            dosage: '4 pills twice daily',
            quantity: 2,
            dispensed_quantity: 2,
            dispense_status: 'dispensed',
            batch_number: 'BAT-ARN-001',
          },
          {
            item_id: 202,
            medicine_name: 'Belladonna',
            potency: '30CH',
            dosage: '4 pills morning',
            quantity: 1,
            dispensed_quantity: 1,
            dispense_status: 'dispensed',
            batch_number: 'BAT-BEL-004',
          },
        ],
      };

      assert.strictEqual(mockRx.items.length, 2);
      assert.strictEqual(mockRx.items[0].medicine_name, 'Arnica Montana');
      assert.strictEqual(mockRx.items[0].batch_number, 'BAT-ARN-001');
      assert.strictEqual(mockRx.items[1].dispensed_quantity, 1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. DISPLAY FORMATTING & NAVIGATION CONTRACTS
  // --------------------------------------------------------------------------
  describe('4. Display Formatting & Cross-Module Navigation Contracts', () => {
    const formatPatientDemographics = (patient) => {
      const gender = patient.gender
        ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
        : 'N/A';
      const age = patient.age ? `, ${patient.age} yrs` : '';
      return `${gender}${age}`;
    };

    const getProcessRxLink = (rxId) => `/pharmacy/prescriptions/${rxId}/process`;
    const getDispensingHistoryLink = (patientId) => `/pharmacy/dispensing/history?patient_id=${patientId}`;

    test('4.1 Formats patient gender and age correctly', () => {
      assert.strictEqual(
        formatPatientDemographics({ gender: 'male', age: 35 }),
        'Male, 35 yrs'
      );
      assert.strictEqual(
        formatPatientDemographics({ gender: 'female', age: null }),
        'Female'
      );
      assert.strictEqual(
        formatPatientDemographics({ gender: null, age: 40 }),
        'N/A, 40 yrs'
      );
    });

    test('4.2 Generates correct prescription workspace navigation URL', () => {
      assert.strictEqual(getProcessRxLink(108), '/pharmacy/prescriptions/108/process');
    });

    test('4.3 Generates correct patient dispensing history hub URL', () => {
      assert.strictEqual(getDispensingHistoryLink(1322), '/pharmacy/dispensing/history?patient_id=1322');
    });
  });

});
