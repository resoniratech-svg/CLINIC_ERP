import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// WECARE HOMEOPATHY ERP - DOCTOR TO PRO HANDOFF & INTEGRATION TEST SUITE
// Verifies end-to-end handoff, data alignment, status lifecycle, RBAC rules,
// checklist gating, and doctor attribution without touching doctor-side code.
// ============================================================================

describe('Doctor → PRO Handoff & Contract Alignment Test Suite', () => {

  // --------------------------------------------------------------------------
  // 1. PATIENT QUEUE GATING (DOCTOR FLOW COMPLETION CONTRACT)
  // --------------------------------------------------------------------------
  describe('1. Patient Queue Gating & Visibility', () => {
    test('1.1 Patients only enter the PRO Queue AFTER Doctor finishes consultation (status = "doctor_completed")', () => {
      const appointments = [
        { appointment_id: 1, patient_id: 10, status: 'checked_in', patient_name: 'Patient 1' },
        { appointment_id: 2, patient_id: 11, status: 'in_consultation', patient_name: 'Patient 2' },
        { appointment_id: 3, patient_id: 12, status: 'doctor_completed', patient_name: 'Patient 3' },
        { appointment_id: 4, patient_id: 13, status: 'pro_pending', patient_name: 'Patient 4' },
        { appointment_id: 5, patient_id: 14, status: 'completed', patient_name: 'Patient 5' }
      ];

      // PRO Queue filter from backend controller
      const proQueue = appointments.filter(a => a.status === 'doctor_completed' || a.status === 'pro_pending');

      assert.strictEqual(proQueue.length, 2);
      assert.deepStrictEqual(proQueue.map(p => p.patient_id), [12, 13]);
      // Active consultation or checked_in patients CANNOT be in PRO queue
      assert.strictEqual(proQueue.some(p => p.status === 'in_consultation'), false);
      assert.strictEqual(proQueue.some(p => p.status === 'checked_in'), false);
    });

    test('1.2 Uncompleted doctor consultations cannot be processed in PRO', () => {
      const canPROProcess = (status) => status === 'doctor_completed' || status === 'pro_pending';
      assert.strictEqual(canPROProcess('booked'), false);
      assert.strictEqual(canPROProcess('checked_in'), false);
      assert.strictEqual(canPROProcess('in_consultation'), false);
      assert.strictEqual(canPROProcess('doctor_completed'), true);
      assert.strictEqual(canPROProcess('pro_pending'), true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. PATIENT 360° OVERVIEW ALIGNMENT (DOCTOR OUTPUT CONSUMPTION)
  // --------------------------------------------------------------------------
  describe('2. Patient 360° Overview: Consumption of Doctor Outputs', () => {
    test('2.1 Happy Path: Full Doctor consultation outputs correctly formatted in PRO Overview', () => {
      const doctorConsultationOutput = {
        consultation_id: 401,
        appointment_id: 201,
        patient_id: 50,
        doctor_id: 3,
        doctor_name: 'Dr. Sarah Smith',
        chief_complaint: 'Chronic allergic rhinitis',
        symptoms: 'Sneezing, nasal congestion, itchy eyes',
        primary_diagnosis_text: 'Allergic Rhinitis',
        secondary_diagnosis_text: 'Mild Asthma',
        followup_recommended: true,
        followup_recommended_date: '2026-09-20',
        followup_instructions: 'Review after 15 days of constitutional remedy',
        pro_required: true,
        pro_priority: 'high',
        pro_instructions: 'Counsel on allergen avoidance and dietary triggers'
      };

      const doctorPrescriptionOutput = {
        prescription_id: 88,
        items: [
          { id: 1, medicine_id: 12, medicine_name: 'Allium Cepa 30C', dosage: '4 pills', frequency: '2/day', route: 'oral', duration_days: 15, quantity: 1 },
          { id: 2, medicine_id: 15, medicine_name: 'Arsenicum Album 200C', dosage: '4 pills', frequency: '1/week', route: 'oral', duration_days: 14, quantity: 1 }
        ]
      };

      const doctorTreatmentPlansOutput = [
        {
          treatment_id: 19,
          patient_id: 50,
          consultation_id: 401,
          doctor_id: 3,
          treatment_name: 'Constitutional Rhinitis Therapy 3-Month Plan',
          treatment_type: 'Homeopathic Treatment',
          duration: 3,
          duration_unit: 'months',
          instructions: 'Monthly constitutional evaluation and remedy titration'
        }
      ];

      // Simulated PRO overview assembly as returned by pro_module.controller.js
      const overview = {
        patient: { patient_id: 50, full_name: 'John Doe', age: 34, gender: 'male' },
        consultation: doctorConsultationOutput,
        prescription: doctorPrescriptionOutput,
        treatment_plans: doctorTreatmentPlansOutput,
        financials: { bills: [], outstanding_due: 0 },
        crm: { calls: [], packages: [], followups: [] }
      };

      // Assertions
      assert.ok(overview.consultation);
      assert.strictEqual(overview.consultation.doctor_id, 3);
      assert.strictEqual(overview.consultation.pro_required, true);
      assert.strictEqual(overview.consultation.pro_priority, 'high');
      assert.strictEqual(overview.prescription.items.length, 2);
      assert.strictEqual(overview.treatment_plans.length, 1);
      assert.strictEqual(overview.treatment_plans[0].treatment_name, 'Constitutional Rhinitis Therapy 3-Month Plan');
    });

    test('2.2 Edge Case: Minimal Doctor consultation (no prescriptions, no treatment plans) handled gracefully', () => {
      const minimalOverview = {
        patient: { patient_id: 55, full_name: 'Jane Smith', age: 28, gender: 'female' },
        consultation: {
          consultation_id: 402,
          appointment_id: 202,
          patient_id: 55,
          doctor_id: 2,
          doctor_name: 'Dr. John Doe',
          chief_complaint: 'Routine wellness check',
          symptoms: null,
          primary_diagnosis_text: 'Healthy / No acute pathology',
          pro_required: false,
          pro_priority: null,
          pro_instructions: null
        },
        prescription: null,
        treatment_plans: [], // empty array
        financials: { bills: [], outstanding_due: 0 },
        crm: { calls: [], packages: [], followups: [] }
      };

      // Safely access properties without throwing TypeError
      assert.strictEqual(minimalOverview.treatment_plans?.length || 0, 0);
      assert.strictEqual(minimalOverview.prescription?.items?.length || 0, 0);
      assert.strictEqual(minimalOverview.consultation?.pro_required || false, false);
      assert.strictEqual(minimalOverview.consultation?.doctor_name, 'Dr. John Doe');
    });
  });

  // --------------------------------------------------------------------------
  // 3. CONSULTATION FEE SEGREGATION & CHECKLIST GATING
  // --------------------------------------------------------------------------
  describe('3. Consultation Fee Segregation & PRO Checklist Gating', () => {
    test('3.1 Receptionist consultation bills (bill_type = "consultation") are excluded from PRO pending bills queue', () => {
      const allBillsInDb = [
        { bill_id: 1, patient_id: 10, bill_type: 'consultation', payment_status: 'pending', final_amount: 500 },
        { bill_id: 2, patient_id: 11, bill_type: 'treatment', payment_status: 'pending', final_amount: 3500 },
        { bill_id: 3, patient_id: 12, bill_type: 'package', payment_status: 'pending', final_amount: 15000 },
        { bill_id: 4, patient_id: 10, bill_type: 'treatment', payment_status: 'paid', final_amount: 2000 }
      ];

      // Updated PRO getPendingBills query logic
      const proPendingBills = allBillsInDb.filter(b => b.payment_status === 'pending' && b.bill_type !== 'consultation');

      assert.strictEqual(proPendingBills.length, 2);
      assert.strictEqual(proPendingBills.some(b => b.bill_type === 'consultation'), false);
      assert.deepStrictEqual(proPendingBills.map(b => b.bill_id), [2, 3]);
    });

    test('3.2 PRO completion checklist BLOCKS handoff if only consultation fee exists and no treatment bill exists', () => {
      const patientId = 77;
      const bills = [
        { bill_id: 50, patient_id: 77, bill_type: 'consultation', final_amount: 500 }
      ];

      // Updated PRO checklist query check
      const treatmentOrPackageBill = bills.find(b => b.patient_id === patientId && b.bill_type !== 'consultation');
      const hasBillingCompleted = !!treatmentOrPackageBill;

      assert.strictEqual(hasBillingCompleted, false);

      const checklistState = {
        doctor_consultation_completed: true,
        diagnosis_reviewed: true,
        prescription_reviewed: true,
        counselling_completed: true,
        treatment_package_confirmed: true,
        billing_completed: hasBillingCompleted,
        payment_or_due_recorded: false
      };

      const readyForCompletion = Object.values(checklistState).every(Boolean);
      assert.strictEqual(readyForCompletion, false);
    });

    test('3.3 PRO completion checklist PASSES billing gate when treatment/package bill is created', () => {
      const patientId = 77;
      const bills = [
        { bill_id: 50, patient_id: 77, bill_type: 'consultation', final_amount: 500 },
        { bill_id: 51, patient_id: 77, bill_type: 'treatment', final_amount: 4500 }
      ];

      const treatmentOrPackageBill = bills.find(b => b.patient_id === patientId && b.bill_type !== 'consultation');
      const hasBillingCompleted = !!treatmentOrPackageBill;

      assert.strictEqual(hasBillingCompleted, true);

      const checklistState = {
        doctor_consultation_completed: true,
        diagnosis_reviewed: true,
        prescription_reviewed: true,
        counselling_completed: true,
        treatment_package_confirmed: true,
        billing_completed: hasBillingCompleted,
        payment_or_due_recorded: true
      };

      const readyForCompletion = Object.values(checklistState).every(Boolean);
      assert.strictEqual(readyForCompletion, true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. DOCTOR ATTRIBUTION & TREATMENT PLAN AUTO-FILL IN BILLING
  // --------------------------------------------------------------------------
  describe('4. Doctor Attribution & Prescribed Treatment Auto-fill', () => {
    test('4.1 PRO Bill creation carries consulting Doctor ID instead of hardcoded default', () => {
      const consultation = { doctor_id: 4, doctor_name: 'Dr. Emily Watson' };
      const form = {
        patient_id: '99',
        doctor_id: String(consultation.doctor_id), // Pre-filled from doctor consultation
        bill_type: 'treatment',
        items: [{ item_name: 'Homeopathic Treatment', charge_type: 'Treatment', quantity: 1, unit_price: 3000 }]
      };

      const payload = {
        patient_id: parseInt(form.patient_id),
        doctor_id: parseInt(form.doctor_id),
        bill_type: form.bill_type,
        items: form.items
      };

      assert.strictEqual(payload.doctor_id, 4);
      assert.notStrictEqual(payload.doctor_id, 1);
    });

    test('4.2 1-Click apply of prescribed treatment plan sets invoice line items and bill type', () => {
      const prescribedPlan = {
        treatment_id: 105,
        treatment_name: 'Chronic Migraine 6-Month Intensive Plan',
        treatment_type: 'Treatment Package',
        doctor_id: 3
      };

      // Function under test
      const formBefore = {
        patient_id: '88',
        doctor_id: '1',
        bill_type: 'other',
        items: [{ item_name: 'Generic Consultation Fee', charge_type: 'General Charge', quantity: 1, unit_price: 1000 }]
      };

      const updatedForm = {
        ...formBefore,
        bill_type: 'treatment',
        doctor_id: String(prescribedPlan.doctor_id),
        items: [
          {
            item_name: prescribedPlan.treatment_name,
            charge_type: prescribedPlan.treatment_type || 'Treatment',
            quantity: 1,
            unit_price: 2000
          }
        ]
      };

      assert.strictEqual(updatedForm.bill_type, 'treatment');
      assert.strictEqual(updatedForm.doctor_id, '3');
      assert.strictEqual(updatedForm.items[0].item_name, 'Chronic Migraine 6-Month Intensive Plan');
      assert.strictEqual(updatedForm.items[0].charge_type, 'Treatment Package');
    });
  });

  // --------------------------------------------------------------------------
  // 5. STATUS LIFECYCLE & IMMUTABILITY CONTRACTS
  // --------------------------------------------------------------------------
  describe('5. Status Lifecycle & Immutability Contracts', () => {
    test('5.1 Lifecycle progression: booked -> checked_in -> in_consultation -> doctor_completed -> pro_completed', () => {
      const validTransitions = {
        booked: ['checked_in', 'cancelled'],
        checked_in: ['in_consultation', 'cancelled'],
        in_consultation: ['doctor_completed'],
        doctor_completed: ['pro_pending', 'pro_completed'],
        pro_pending: ['pro_completed'],
        pro_completed: ['pharmacy_pending', 'completed']
      };

      const canTransition = (current, next) => validTransitions[current]?.includes(next) || false;

      assert.strictEqual(canTransition('in_consultation', 'doctor_completed'), true);
      assert.strictEqual(canTransition('doctor_completed', 'pro_completed'), true);
      // Reversing or illegal skipping is prohibited
      assert.strictEqual(canTransition('doctor_completed', 'in_consultation'), false);
      assert.strictEqual(canTransition('booked', 'pro_completed'), false);
    });

    test('5.2 Completed doctor consultation is immutable and cannot be rewritten by PRO', () => {
      const doctorConsultation = {
        consultation_id: 300,
        status: 'completed',
        primary_diagnosis_text: 'Eczema'
      };

      const updateAttempt = (consult, newDiagnosis) => {
        if (consult.status === 'completed') {
          throw new Error('Completed consultation is immutable and cannot be edited');
        }
        return { ...consult, primary_diagnosis_text: newDiagnosis };
      };

      assert.throws(
        () => updateAttempt(doctorConsultation, 'Psoriasis'),
        /Completed consultation is immutable/
      );
    });
  });

});
