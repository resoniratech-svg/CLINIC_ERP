const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

describe('Master End-to-End Patient Journey Integration Suite', () => {
  let adminToken, receptionistToken, doctorToken, proToken, pharmacyToken;
  let createdDoctorUserId, createdDoctorId;
  let testPatientId, testAppointmentId, testConsultationId, testPrescriptionId, item1Id, item2Id, clarificationId;
  const testMobile = '97' + Date.now().toString().slice(-8);

  beforeAll(async () => {
    await seed();

    // Clean test tables
    await db.query(`
      DELETE FROM medicine_returns;
      DELETE FROM stock_adjustments;
      DELETE FROM prescription_clarifications;
      DELETE FROM stock_import_batches;
      DELETE FROM stock_transactions;
      DELETE FROM prescription_modifications;
      DELETE FROM prescription_items;
      DELETE FROM prescriptions;
      DELETE FROM medicine_stock WHERE id != 1;
      DELETE FROM medicine_master WHERE id != 1;
      DELETE FROM treatment_plans;
      DELETE FROM consultations;
      DELETE FROM due_patients;
      DELETE FROM payments;
      DELETE FROM bill_items;
      DELETE FROM bills;
      DELETE FROM packages;
      DELETE FROM counselling_records;
      DELETE FROM feedback_complaints;
      DELETE FROM call_records;
      DELETE FROM acq_patients;
      DELETE FROM oc_nr_patients;
      DELETE FROM renewals;
      DELETE FROM referrals;
      DELETE FROM crm_followups;
      DELETE FROM leads;
      DELETE FROM appointments;
      DELETE FROM patients WHERE patient_id != 1;
    `);

    // Ensure low stock medicine and batch
    await db.query(`
      INSERT INTO medicine_master (id, medicine_name, generic_name, medicine_type, strength, unit, category, status)
      VALUES (2, 'Amoxicillin 500mg', 'Amoxicillin', 'capsule', '500 mg', 'capsules', 'Antibiotics', 'active')
      ON CONFLICT (id) DO NOTHING;
    `);
    await db.query(`
      INSERT INTO medicine_stock (id, medicine_id, batch_number, manufacture_date, expiry_date, quantity, purchase_rate, mrp, supplier, branch_id)
      VALUES (2, 2, 'BATCH-AMOX-01', '2026-01-01', '2027-12-31', 5, 8.00, 15.00, 'MedSupplier', 1)
      ON CONFLICT (id) DO NOTHING;
    `);
  });

  // Checkpoint 1: Super Admin Login & Setup
  it('Checkpoint 1: Super Admin logs in and creates Doctor, Receptionist, PRO, Pharmacy users', async () => {
    const adminRes = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // Create New Doctor via Super Admin
    const docEmpId = 'DOC_E2E_' + Date.now().toString().slice(-4);
    const docUsername = 'dr_journey_' + Date.now();
    const newDocRes = await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      role: 'doctor',
      employee_id: docEmpId,
      full_name: 'Dr. Master Journey',
      mobile_number: '98' + Date.now().toString().slice(-8),
      email: 'drjourney@hospital.com',
      gender: 'male',
      username: docUsername,
      password: 'Password@123',
      qualification: 'MBBS, MD',
      specialization: 'Cardiology',
      medical_registration_number: 'REG-' + Date.now(),
      new_consultation_fee: 600,
      renewal_consultation_fee: 350
    });
    expect(newDocRes.status).toBe(201);
    createdDoctorUserId = newDocRes.body.data.user_id;

    const dDbRes = await db.query('SELECT doctor_id FROM doctors WHERE user_id = $1', [createdDoctorUserId]);
    createdDoctorId = dDbRes.rows[0].doctor_id;

    // Doctor login
    const docLogin = await request(app).post('/api/v1/auth/login').send({ username: docUsername, password: 'Password@123' });
    doctorToken = docLogin.body.data.token;

    // Receptionist login
    const recLogin = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
    receptionistToken = recLogin.body.data.token;

    // PRO login
    const proLogin = await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' });
    proToken = proLogin.body.data.token;

    // Pharmacy login
    const phaLogin = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
    pharmacyToken = phaLogin.body.data.token;
  });

  // Checkpoint 2: Receptionist Workflow
  it('Checkpoint 2: Receptionist registers walk-in patient, books appointment, collects fee, checks in', async () => {
    // Mobile lookup
    const searchRes = await request(app).get(`/api/v1/receptionist/patients/search?mobile=${testMobile}`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(searchRes.body.data.exists).toBe(false);

    // Fee lookup
    const feeRes = await request(app).get(`/api/v1/receptionist/consultation-fee?doctor_id=${createdDoctorId}&appointment_type=new`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(feeRes.body.data.consultation_fee).toBe(600);

    // Register patient & book appointment
    const regRes = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: {
        full_name: 'Master Patient Journey',
        mobile_number: testMobile,
        age: 35,
        gender: 'male',
        address: 'Hyderabad'
      },
      appointment: {
        doctor_id: createdDoctorId,
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '06:30',
        appointment_type: 'new'
      },
      billing: {
        amount: 600,
        discount: 0,
        payment_mode: 'cash'
      }
    });
    expect(regRes.status).toBe(201);
    testPatientId = regRes.body.data.patient.patient_id;
    testAppointmentId = regRes.body.data.appointment.appointment_id;
    expect(regRes.body.data.patient.patient_type).toBe('new');

    // Check-in
    const checkinRes = await request(app).put(`/api/v1/receptionist/appointments/${testAppointmentId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });
    expect(checkinRes.status).toBe(200);
  });

  // Checkpoint 3: Doctor Consultation Workflow
  it('Checkpoint 3: Doctor starts consultation, records diagnosis/prescription, saves draft, completes', async () => {
    // See patient in Doctor queue
    const queueRes = await request(app).get('/api/v1/doctor/patient-queue').set('Authorization', `Bearer ${doctorToken}`);
    expect(queueRes.status).toBe(200);

    // Start consultation
    const startRes = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({
      appointment_id: testAppointmentId
    });
    expect(startRes.status).toBe(201);
    testConsultationId = startRes.body.data.consultation_id;

    // Save Draft
    const draftRes = await request(app).post('/api/v1/doctor/consultations/draft').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: testConsultationId,
      vitals: { height_cm: 175, weight_kg: 70, bp_systolic: 120, bp_diastolic: 80 },
      chief_complaint: 'Fever and Cough',
      primary_diagnosis_text: 'Upper Respiratory Infection'
    });
    expect(draftRes.status).toBe(200);

    // Complete Consultation with 2 Medicines (Paracetamol 10 pcs + Amoxicillin 10 pcs)
    const completeRes = await request(app).post('/api/v1/doctor/consultations/complete').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: testConsultationId,
      vitals: { height_cm: 175, weight_kg: 70, bp_systolic: 120, bp_diastolic: 80 },
      chief_complaint: 'Severe Fever and Cough',
      primary_diagnosis_text: 'Bacterial Chest Infection',
      pro_instructions: 'Package counselling required for antibiotic course',
      pro_required: true,
      prescription_items: [
        { medicine_id: 1, dosage: '500 mg', frequency: '2/day', route: 'oral', duration_days: 5, quantity: 10 },
        { medicine_id: 2, dosage: '500 mg', frequency: '2/day', route: 'oral', duration_days: 5, quantity: 10 }
      ],
      treatment_plan: { title: '7-Day Antibiotic Recovery Plan', description: 'Rest and medicine course', duration_days: 7 },
      followup_recommendation: { followup_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], notes: 'Review chest sounds' }
    });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.appointment_status).toBe('doctor_completed');

    // Get prescription details directly from DB
    const rxDb = await db.query(`SELECT id FROM prescriptions WHERE consultation_id = $1`, [testConsultationId]);
    testPrescriptionId = rxDb.rows[0].id;
    const itemsDb = await db.query(`SELECT id FROM prescription_items WHERE prescription_id = $1 ORDER BY id ASC`, [testPrescriptionId]);
    item1Id = itemsDb.rows[0].id;
    item2Id = itemsDb.rows[1].id;
  });

  // Checkpoint 4: PRO Manager Counselling & Partial Payment
  it('Checkpoint 4: PRO Manager counsels patient, hides doctor_notes, creates treatment bill, partial payment, completes PRO', async () => {
    // Check PRO queue
    const proQueue = await request(app).get('/api/v1/pro/queue').set('Authorization', `Bearer ${proToken}`);
    expect(proQueue.status).toBe(200);

    // Patient Overview (assert doctor_notes is hidden)
    const overviewRes = await request(app).get(`/api/v1/pro/patients/${testPatientId}/overview`).set('Authorization', `Bearer ${proToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.doctor_notes).toBeUndefined();

    // Counselling record
    await request(app).post('/api/v1/pro/counselling').set('Authorization', `Bearer ${proToken}`).send({
      patient_id: testPatientId,
      appointment_id: testAppointmentId,
      counselling_type: 'treatment',
      notes: 'Explained treatment package and medicine course',
      patient_understanding: 'excellent',
      patient_response: 'agreed'
    });

    // Package enrollment
    const pkgRes = await request(app).post('/api/v1/pro/packages/enroll').set('Authorization', `Bearer ${proToken}`).send({
      patient_id: testPatientId,
      package_name: 'Chest Recovery Care Package',
      package_type: 'monthly',
      from_date: new Date().toISOString().split('T')[0],
      package_amount: 2000
    });
    expect(pkgRes.status).toBe(201);

    // Create Treatment Bill
    const billRes = await request(app).post('/api/v1/pro/billing').set('Authorization', `Bearer ${proToken}`).send({
      patient_id: testPatientId,
      appointment_id: testAppointmentId,
      bill_type: 'treatment',
      items: [{ item_type: 'treatment', description: 'Chest Recovery Package', quantity: 1, unit_price: 2000 }],
      discount_amount: 200
    });
    expect(billRes.status).toBe(201);
    const billId = billRes.body.data.bill_id;

    // Partial Payment split across 2 methods (1000 cash, 500 UPI -> 300 due)
    const payRes = await request(app).post('/api/v1/pro/payments').set('Authorization', `Bearer ${proToken}`).send({
      bill_id: billId,
      patient_id: testPatientId,
      payments: [
        { payment_mode: 'cash', amount: 1000 },
        { payment_mode: 'upi', amount: 500 }
      ]
    });
    expect(payRes.status).toBe(201);
    expect(payRes.body.data.bill.status).toBe('partial');
    expect(payRes.body.data.bill.due_amount).toBe(300);

    // Create CRM follow-up task
    await request(app).post('/api/v1/pro/crm/followups').set('Authorization', `Bearer ${proToken}`).send({
      patient_id: testPatientId,
      assigned_to: 1345, // PRO user
      followup_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      notes: 'Check treatment progress'
    });

    // Complete PRO
    const completePro = await request(app).post(`/api/v1/pro/patients/${testPatientId}/complete-pro`).set('Authorization', `Bearer ${proToken}`).send({
      appointment_id: testAppointmentId
    });
    expect(completePro.status).toBe(200);
    expect(completePro.body.data.appointment.status).toBe('pro_completed');
  });

  // Checkpoint 5: Pharmacy Dispensing & Duration Modification
  it('Checkpoint 5: Pharmacy inspects queue, stock checks, dispenses available FEFO batch, modifies days, raises clarification', async () => {
    // Pharmacy Queue visibility
    const phaQueue = await request(app).get('/api/v1/pharmacy/queue').set('Authorization', `Bearer ${pharmacyToken}`);
    expect(phaQueue.status).toBe(200);

    // Stock check
    const stockCheck = await request(app).get(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/stock-check`).set('Authorization', `Bearer ${pharmacyToken}`);
    const itemsData = Array.isArray(stockCheck.body.data) ? stockCheck.body.data : stockCheck.body.data.items;
    expect(itemsData.find(i => i.medicine_id === 1).status).toMatch(/available/i);

    // Select batch for Item 1
    await request(app).put(`/api/v1/pharmacy/prescriptions/items/${item1Id}/select-batch`).set('Authorization', `Bearer ${pharmacyToken}`).send({ selected_batch_id: 1, dispensed_quantity: 10 });

    // Select available stock batch for Item 2 (only 5 available)
    await request(app).put(`/api/v1/pharmacy/prescriptions/items/${item2Id}/select-batch`).set('Authorization', `Bearer ${pharmacyToken}`).send({ selected_batch_id: 2, dispensed_quantity: 5 });
    await request(app).put(`/api/v1/pharmacy/prescriptions/items/${item2Id}/status`).set('Authorization', `Bearer ${pharmacyToken}`).send({ dispense_status: 'on_hold', hold_reason: 'Stock insufficient for remaining 5 caps' });

    // Modify Item 1 days (5 -> 7 days, qty recalculates 10 -> 14)
    const modRes = await request(app).post(`/api/v1/pharmacy/prescriptions/items/${item1Id}/modify-days`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      duration_days: 7,
      reason: 'Extended treatment duration'
    });
    expect(modRes.status).toBe(200);
    expect(modRes.body.data.updated_item.quantity).toBe(14);

    // Prohibit direct clinical modification
    const directEdit = await request(app).post(`/api/v1/pharmacy/prescriptions/items/${item1Id}/modify-medicine`).set('Authorization', `Bearer ${pharmacyToken}`).send({ new_medicine: 'Dolo 650' });
    expect(directEdit.status).toBe(403);

    // Raise Clarification Request for Item 2
    const clarRes = await request(app).post('/api/v1/pharmacy/clarifications').set('Authorization', `Bearer ${pharmacyToken}`).send({
      prescription_id: testPrescriptionId,
      prescription_item_id: item2Id,
      patient_id: testPatientId,
      issue_type: 'substitution_request',
      description: 'Amoxicillin 500mg only 5 available. Requesting substitution for remaining quantity.'
    });
    expect(clarRes.status).toBe(201);
    clarificationId = clarRes.body.data.id;
  });

  // Checkpoint 6: Doctor Responds to Clarification
  it('Checkpoint 6: Doctor responds to clarification authorizing drug substitution', async () => {
    const docResp = await request(app).post(`/api/v1/doctor/clarifications/${clarificationId}/respond`).set('Authorization', `Bearer ${doctorToken}`).send({
      doctor_response: 'Substitute remaining quantity with Paracetamol 500mg 1 tab twice daily.',
      remarks: 'Approved substitution'
    });
    expect(docResp.status).toBe(200);
    expect(docResp.body.data.status).toBe('responded');
  });

  // Checkpoint 7: Pharmacy Dispenses Remaining & Completes Prescription
  it('Checkpoint 7: Pharmacy dispenses remaining items and completes dispensing', async () => {
    // Complete Dispensing
    const completeDispense = await request(app).post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      items: [
        { prescription_item_id: item1Id, selected_batch_id: 1, dispense_quantity: 14 }
      ]
    });
    expect(completeDispense.status).toBe(200);

    // Close Clarification
    const closeClar = await request(app).put(`/api/v1/pharmacy/clarifications/${clarificationId}/close`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      resolution_notes: 'Substitution dispensed'
    });
    expect(closeClar.status).toBe(200);
  });

  // Checkpoint 8: CRM Task Completion
  it('Checkpoint 8: PRO completes CRM follow-up task', async () => {
    const tasksRes = await request(app).get('/api/v1/pro/crm/my-tasks').set('Authorization', `Bearer ${proToken}`);
    expect(tasksRes.status).toBe(200);

    if (tasksRes.body.data && tasksRes.body.data.length > 0) {
      const taskId = tasksRes.body.data[0].id;
      const completeTask = await request(app).put(`/api/v1/pro/crm/tasks/${taskId}/complete`).set('Authorization', `Bearer ${proToken}`).send({
        call_summary: 'Patient feeling better, medicine course started'
      });
      expect(completeTask.status).toBe(200);
    }
  });

  // Checkpoint 9: Super Admin Audit Log & Login Log Verification
  it('Checkpoint 9: Super Admin verifies audit logs and session login logs', async () => {
    const auditRes = await request(app).get('/api/v1/super-admin/audit-logs').set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.body.data)).toBe(true);

    const loginLogRes = await request(app).get('/api/v1/super-admin/login-logs').set('Authorization', `Bearer ${adminToken}`);
    expect(loginLogRes.status).toBe(200);
    expect(Array.isArray(loginLogRes.body.data)).toBe(true);
  });
});
