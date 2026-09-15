const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

let receptionistToken = '';
let doctorToken = '';
let pharmacistToken = '';
let doctorId = null;
let raviPatientId = null;
let raviApptId = null;
let raviRxId = null;
let raviItemId = null;

beforeAll(async () => {
  await seed();
  await db.query(`
    DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-11-01'));
    DELETE FROM prescriptions WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-11-01');
    DELETE FROM consultations WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-11-01');
    DELETE FROM payments WHERE bill_id IN (SELECT bill_id FROM bills WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-11-01'));
    DELETE FROM due_patients WHERE bill_id IN (SELECT bill_id FROM bills WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-11-01'));
    DELETE FROM bills WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-11-01');
    DELETE FROM appointments WHERE appointment_date >= '2026-11-01';
  `);

  // Receptionist login
  const recLogin = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
  receptionistToken = recLogin.body.data.token;

  // Doctor login
  const docLogin = await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' });
  doctorToken = docLogin.body.data.token;

  // Pharmacist login
  const pharmLogin = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
  pharmacistToken = pharmLogin.body.data.token;

  // Doctor ID
  const docRes = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = (SELECT user_id FROM users WHERE username = 'dr_smith')`);
  doctorId = docRes.rows[0].doctor_id;

  // Create Patient RAVI for explicit test isolation
  const ts = Date.now().toString().slice(-8);
  const ptRes = await db.query(`
    INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id)
    VALUES ('Ravi Kumar', $1, 35, 'male', 'Karimnagar', 1)
    RETURNING patient_id
  `, [`97${ts}`]);
  raviPatientId = ptRes.rows[0].patient_id;

  // Create Previous Completed Appointment for Ravi
  const apptRes = await db.query(`
    INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id)
    VALUES ($1, $2, '2026-09-10', '10:00:00', 'new', 'pro_completed', 1)
    RETURNING appointment_id
  `, [raviPatientId, doctorId]);
  raviApptId = apptRes.rows[0].appointment_id;

  // Create Consultation
  const conRes = await db.query(`
    INSERT INTO consultations (appointment_id, patient_id, doctor_id, chief_complaint, primary_diagnosis_text, status, branch_id)
    VALUES ($1, $2, $3, 'Fever and Cough', 'Upper Respiratory Infection', 'completed', 1)
    RETURNING consultation_id
  `, [raviApptId, raviPatientId, doctorId]);
  const raviConsultId = conRes.rows[0].consultation_id;

  // Create Fully Paid Bill for Ravi
  const billRes = await db.query(`
    INSERT INTO bills (bill_number, patient_id, doctor_id, bill_type, created_by, branch_id, amount, discount_amount, final_amount, status, appointment_id)
    VALUES ($4, $1, $2, 'consultation', 1, 1, 500, 0, 500, 'created', $3)
    RETURNING bill_id
  `, [raviPatientId, doctorId, raviApptId, `INV-RAVI-${ts}`]);
  const raviBillId = billRes.rows[0].bill_id;

  await db.query(`
    INSERT INTO payments (bill_id, patient_id, payment_method, amount, status, received_by, branch_id)
    VALUES ($1, $2, 'cash', 500, 'success', 1, 1)
  `, [raviBillId, raviPatientId]);

  // Create Prescription with PENDING pharmacy status and un-dispensed items
  const rxRes = await db.query(`
    INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, appointment_id, pharmacy_status)
    VALUES ($1, $2, $3, $4, 'pending')
    RETURNING id
  `, [raviConsultId, raviPatientId, doctorId, raviApptId]);
  raviRxId = rxRes.rows[0].id;

  const itemRes = await db.query(`
    INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, dispense_status, dispensed, selected_batch_id)
    VALUES ($1, 1, '500 mg', '2/day', 'oral', 5, 10, 'pending', false, 1)
    RETURNING id
  `, [raviRxId]);
  raviItemId = itemRes.rows[0].id;
});

afterAll(async () => {
  await db.pool.end();
});

describe('Receptionist Follow-Up Appointment Workflow & Visit Gating', () => {

  test('Scenario A: Patient RAVI with Pharmacy PENDING is gated as INCOMPLETE', async () => {
    // 1. Visit status API call
    const statusRes = await request(app)
      .get(`/api/v1/receptionist/patients/${raviPatientId}/visit-status`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.success).toBe(true);
    const data = statusRes.body.data;
    expect(data.has_previous_visit).toBe(true);
    expect(data.overall_status).toBe('incomplete');
    expect(data.is_ready_for_followup).toBe(false);
    expect(data.pharmacy).toBe('pending');
    expect(data.pending_reason).toBe('Previous visit is not completed. Pharmacy dispensing is still pending.');

    // 2. Patient Overview API includes previous_visit_status
    const overviewRes = await request(app)
      .get(`/api/v1/receptionist/patients/${raviPatientId}/overview`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.previous_visit_status).toBeDefined();
    expect(overviewRes.body.data.previous_visit_status.is_ready_for_followup).toBe(false);
    expect(overviewRes.body.data.previous_visit_status.overall_status).toBe('incomplete');

    // 3. Attempting to schedule follow-up without override must be REJECTED (HTTP 400)
    const bookFailRes = await request(app)
      .post('/api/v1/receptionist/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id: raviPatientId,
        doctor_id: doctorId,
        appointment_date: '2026-11-20',
        appointment_time: '14:00:00',
        appointment_type: 'followup',
        remarks: 'Attempting follow-up while rx is pending'
      });

    expect(bookFailRes.status).toBe(400);
    expect(bookFailRes.body.success).toBe(false);
    expect(bookFailRes.body.message).toContain('Pharmacy dispensing is still pending');

    // 4. Scheduling follow-up WITH allow_override = true succeeds
    const bookOverrideRes = await request(app)
      .post('/api/v1/receptionist/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id: raviPatientId,
        doctor_id: doctorId,
        appointment_date: '2026-11-20',
        appointment_time: '14:00:00',
        appointment_type: 'followup',
        allow_override: true,
        collect_payment: true,
        remarks: 'Emergency authorized follow-up'
      });

    expect(bookOverrideRes.status).toBe(201);
    expect(bookOverrideRes.body.success).toBe(true);
    expect(bookOverrideRes.body.data.appointment_type).toBe('followup');
    expect(bookOverrideRes.body.data.bill).toBeDefined();
  });

  test('Scenario B: Patient after explicit pharmacy dispensing is COMPLETED and ready for normal follow-up', async () => {
    // 1. Dispense medicines for prescription
    const dispenseRes = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${raviRxId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        items: [{ item_id: raviItemId, stock_id: 1, dispense_quantity: 10 }],
        notes: 'Pharmacist dispensed all medicines'
      });

    expect(dispenseRes.status).toBe(200);

    // 2. Now check patient visit status
    const statusRes = await request(app)
      .get(`/api/v1/receptionist/patients/${raviPatientId}/visit-status`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(statusRes.status).toBe(200);
    const data = statusRes.body.data;
    expect(data.overall_status).toBe('completed');
    expect(data.is_ready_for_followup).toBe(true);
    expect(data.pharmacy).toBe('dispensed');
    expect(data.pending_reason).toBeNull();

    // 3. Scheduling a normal follow-up appointment succeeds without any override
    const bookRes = await request(app)
      .post('/api/v1/receptionist/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id: raviPatientId,
        doctor_id: doctorId,
        appointment_date: '2026-11-21',
        appointment_time: '10:00:00',
        appointment_type: 'followup',
        collect_payment: true
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.success).toBe(true);
    expect(bookRes.body.data.appointment_type).toBe('followup');
    expect(bookRes.body.data.bill).toBeDefined();
    expect(bookRes.body.data.bill.bill_type).toBe('consultation');
    expect(bookRes.body.data.payment).toBeDefined();
  });

  test('Scenario C: Patient with consultation completed and NO medicines prescribed evaluates as ready', async () => {
    // Insert patient directly
    const regPtRes = await db.query(`
      INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id)
      VALUES ('No Medicine Patient', $1, 32, 'male', 'Karimnagar', 1)
      RETURNING patient_id
    `, [`96${Date.now().toString().slice(-8)}`]);
    const newPtId = regPtRes.rows[0].patient_id;

    const initialApptRes = await db.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id)
      VALUES ($1, $2, '2026-11-22', '11:00:00', 'new', 'completed', 1)
      RETURNING appointment_id
    `, [newPtId, doctorId]);
    const initialApptId = initialApptRes.rows[0].appointment_id;

    // Doctor completes consultation without prescribing medicines
    await db.query(
      `INSERT INTO consultations (appointment_id, patient_id, doctor_id, chief_complaint, primary_diagnosis_text, status) VALUES ($1, $2, $3, 'Dietary consultation', 'General Wellness', 'completed')`,
      [initialApptId, newPtId, doctorId]
    );

    // Visit status check
    const statusRes = await request(app)
      .get(`/api/v1/receptionist/patients/${newPtId}/visit-status`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.overall_status).toBe('completed');
    expect(statusRes.body.data.pharmacy).toBe('not_applicable');
    expect(statusRes.body.data.is_ready_for_followup).toBe(true);
  });

  test('Scenario D: Financial Separation - Follow-up fee creates isolated consultation invoice', async () => {
    // Check doctor followup fee
    const feeRes = await request(app)
      .get(`/api/v1/receptionist/consultation-fee?doctor_id=${doctorId}&appointment_type=followup`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(feeRes.status).toBe(200);
    expect(feeRes.body.data.consultation_fee).toBeDefined();

    // Book follow-up for Ravi
    const bookRes = await request(app)
      .post('/api/v1/receptionist/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id: raviPatientId,
        doctor_id: doctorId,
        appointment_date: '2026-11-23',
        appointment_time: '15:00:00',
        appointment_type: 'followup',
        collect_payment: true,
        payment_method: 'upi'
      });

    expect(bookRes.status).toBe(201);
    const bill = bookRes.body.data.bill;
    expect(bill.bill_number).toMatch(/^INV-/);
    expect(bill.bill_type).toBe('consultation');
    // Verify it is an isolated consultation invoice, NOT previous visit treatment
    expect(parseFloat(bill.final_amount)).toBeLessThan(1000);
  });

  test('Scenario E: Double booking protection', async () => {
    // Attempting to book the exact same slot again must be rejected
    const dupRes = await request(app)
      .post('/api/v1/receptionist/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id: raviPatientId,
        doctor_id: doctorId,
        appointment_date: '2026-11-23',
        appointment_time: '15:00:00',
        appointment_type: 'followup'
      });

    expect(dupRes.status).toBe(400);
    expect(dupRes.body.message).toContain('Double booking is not allowed');
  });

  test('Scenario F: Appointments list returns payment_status, pharmacy_status, and previous_visit_status', async () => {
    const listRes = await request(app)
      .get('/api/v1/receptionist/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);
    const first = listRes.body.data[0];
    expect(first).toHaveProperty('payment_status');
    expect(first).toHaveProperty('pharmacy_status');
    expect(first).toHaveProperty('previous_visit_status');
  });

});
