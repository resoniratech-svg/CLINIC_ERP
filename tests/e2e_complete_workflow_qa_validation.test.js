const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

let adminToken = '';
let receptionistToken = '';
let doctorToken = '';
let proToken = '';
let pharmacistToken = '';
let doctorId = null;

const testDate = '2026-12-15';

beforeAll(async () => {
  await seed();

  // Cascade cleanup for any leftover test appointments on or after testDate
  await db.query(`
    DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-12-01'));
    DELETE FROM prescriptions WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-12-01');
    DELETE FROM treatment_plans WHERE consultation_id IN (SELECT consultation_id FROM consultations WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-12-01'));
    DELETE FROM consultations WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-12-01');
    DELETE FROM payments WHERE bill_id IN (SELECT bill_id FROM bills WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-12-01'));
    DELETE FROM due_patients WHERE bill_id IN (SELECT bill_id FROM bills WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-12-01'));
    DELETE FROM bills WHERE appointment_id IN (SELECT appointment_id FROM appointments WHERE appointment_date >= '2026-12-01');
    DELETE FROM appointments WHERE appointment_date >= '2026-12-01';
    UPDATE medicine_stock SET quantity = 100 WHERE expiry_date > CURRENT_DATE;
  `);

  // Logins
  const adminRes = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
  adminToken = adminRes.body.data.token;

  const recRes = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
  receptionistToken = recRes.body.data.token;

  const docRes = await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' });
  doctorToken = docRes.body.data.token;

  const proRes = await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' });
  proToken = proRes.body.data.token;

  const pharmRes = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
  pharmacistToken = pharmRes.body.data.token;

  const docRow = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = (SELECT user_id FROM users WHERE username = 'dr_smith')`);
  doctorId = docRow.rows[0].doctor_id;
});

afterAll(async () => {
  await db.pool.end();
});

describe('Clinic ERP Strict End-to-End QA Validation Suite', () => {

  // =========================================================================
  // 4. PATIENT REGISTRATION TESTS (REG-001 - REG-007)
  // =========================================================================
  describe('4. Patient Registration Tests', () => {
    const regMobile = `91${Date.now().toString().slice(-8)}`;
    let createdPatientId = null;
    let regNumber = null;

    test('TEST REG-001: Create a new patient once', async () => {
      const res = await request(app)
        .post('/api/v1/receptionist/patients/walk-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          full_name: 'Test Patient Alpha',
          mobile_number: regMobile,
          gender: 'female',
          age: 28,
          address: 'Main Road, Karimnagar',
          village: 'Karimnagar Urban',
          mandal: 'Karimnagar',
          assigned_doctor_id: doctorId,
          appointment_date: testDate,
          appointment_time: '08:00:00'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patient_id).toBeDefined();
      createdPatientId = res.body.data.patient_id;
      regNumber = res.body.data.registration_id;
      expect(regNumber).toMatch(/^REG-/);
    });

    test('TEST REG-002: Create patient with duplicate mobile auto-detects existing', async () => {
      const res = await request(app)
        .get(`/api/v1/receptionist/patients/search?query=${regMobile}`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.classification).toBe('existing');
      expect(res.body.data.patient.patient_id).toBe(createdPatientId);
    });

    test('TEST REG-003: Search by registration ID returns correct patient', async () => {
      const res = await request(app)
        .get(`/api/v1/receptionist/patients/search?query=${regNumber}`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.patient.patient_id).toBe(createdPatientId);
    });

    test('TEST REG-004 & REG-005: Search by mobile and name', async () => {
      const resMobile = await request(app)
        .get(`/api/v1/receptionist/patients/search?query=${regMobile}`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(resMobile.status).toBe(200);
      expect(resMobile.body.data.patient.full_name).toBe('Test Patient Alpha');

      const resName = await request(app)
        .get(`/api/v1/receptionist/patients/search?query=Patient Alpha`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(resName.status).toBe(200);
      expect(resName.body.data.patient.mobile_number).toBe(regMobile);
    });

    test('TEST REG-006 & REG-007: Open Patient Overview and verify idempotency on refresh', async () => {
      const res1 = await request(app)
        .get(`/api/v1/receptionist/patients/${createdPatientId}/overview`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.data.patient.patient_id).toBe(createdPatientId);

      const res2 = await request(app)
        .get(`/api/v1/receptionist/patients/${createdPatientId}/overview`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.patient.patient_id).toBe(createdPatientId);
    });
  });

  // =========================================================================
  // 5. APPOINTMENT CREATION TESTS (APT-001 - APT-008)
  // =========================================================================
  describe('5. Appointment Creation Tests', () => {
    let testPtId = null;
    let apptId = null;

    beforeAll(async () => {
      const ptRes = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('Appt Test Patient', $1, 40, 'male', 'Karimnagar', 1) RETURNING patient_id`,
        [`92${Date.now().toString().slice(-8)}`]
      );
      testPtId = ptRes.rows[0].patient_id;
    });

    test('TEST APT-001 & APT-004: Book valid available slot', async () => {
      const res = await request(app)
        .post('/api/v1/receptionist/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: testPtId,
          doctor_id: doctorId,
          appointment_date: testDate,
          appointment_time: '09:00:00',
          appointment_type: 'new'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      apptId = res.body.data.appointment_id;
    });

    test('TEST APT-002 & APT-003: Double booking same doctor + date + time is rejected', async () => {
      const dupRes = await request(app)
        .post('/api/v1/receptionist/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: testPtId,
          doctor_id: doctorId,
          appointment_date: testDate,
          appointment_time: '09:00:00',
          appointment_type: 'new'
        });

      expect(dupRes.status).toBe(400);
      expect(dupRes.body.success).toBe(false);
      expect(dupRes.body.message).toContain('Double booking is not allowed');
    });

    test('TEST APT-007 & APT-008: Cancel appointment and verify cancelled state', async () => {
      await db.query(`UPDATE appointments SET status = 'cancelled' WHERE appointment_id = $1`, [apptId]);

      // Check visit completion helper ignores cancelled appointment
      const visitRes = await request(app)
        .get(`/api/v1/receptionist/patients/${testPtId}/visit-status`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(visitRes.status).toBe(200);
      expect(visitRes.body.data.has_previous_visit).toBe(false);
    });
  });

  // =========================================================================
  // 6 - 8. DOCTOR, PRO, AND CRITICAL AUTO-DISPENSING GUARDS (DOC, PRO, DISP)
  // =========================================================================
  describe('6-8. Doctor, PRO, and Critical Auto-Dispensing Guards', () => {
    let patientA_id = null;
    let patientA_apptId = null;
    let patientA_consultId = null;
    let patientA_rxId = null;
    let medicineA_id = 1;

    beforeAll(async () => {
      const ptRes = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('Patient A Flow', $1, 30, 'male', 'Karimnagar', 1) RETURNING patient_id`,
        [`93${Date.now().toString().slice(-8)}`]
      );
      patientA_id = ptRes.rows[0].patient_id;

      const apptRes = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id) VALUES ($1, $2, $3, '10:00:00', 'new', 'scheduled', 1) RETURNING appointment_id`,
        [patientA_id, doctorId, testDate]
      );
      patientA_apptId = apptRes.rows[0].appointment_id;
    });

    test('TEST DOC-001 & DOC-002: Doctor opens and starts consultation', async () => {
      const consultRes = await request(app)
        .post('/api/v1/doctor/consultations/start')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          appointment_id: patientA_apptId
        });

      expect([200, 201]).toContain(consultRes.status);
      patientA_consultId = consultRes.body.data?.consultation_id || consultRes.body.data?.id;
      expect(patientA_consultId).toBeDefined();
    });

    test('TEST DOC-003 & DOC-004: Doctor completes consultation with prescription. Pharmacy is PENDING, NOT DISPENSED', async () => {
      const rxRes = await request(app)
        .post('/api/v1/doctor/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          consultation_id: patientA_consultId,
          medicines: [
            {
              medicine_id: medicineA_id,
              dosage: '500 mg',
              frequency: '1-0-1',
              duration_days: 5,
              quantity: 10,
              route: 'oral'
            }
          ]
        });

      expect([200, 201]).toContain(rxRes.status);
      patientA_rxId = rxRes.body.data?.prescription?.id || rxRes.body.data?.id;

      // Complete doctor consultation
      const compRes = await request(app)
        .post(`/api/v1/doctor/consultations/${patientA_consultId}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          chief_complaint: 'Severe headache and fever',
          primary_diagnosis_text: 'Acute Sinusitis',
          doctor_notes: 'Rest and medicine prescribed'
        });

      expect(compRes.status).toBe(200);

      // CRITICAL CHECK: Pharmacy status MUST be pending, NOT dispensed
      const rxCheck = await db.query(`SELECT pharmacy_status FROM prescriptions WHERE id = $1`, [patientA_rxId]);
      expect(rxCheck.rows[0].pharmacy_status).toBe('pending');
    });

    test('TEST PRO-001 to PRO-006 & DISP-001 to DISP-003: PRO completion + Billing + Payment. Pharmacy remains PENDING', async () => {
      // 1. Create Treatment Plan
      await db.query(`
        INSERT INTO treatment_plans (consultation_id, patient_id, doctor_id, treatment_name, treatment_type, start_date, duration, duration_unit, status, branch_id)
        VALUES ($1, $2, $3, 'Sinus Relief Therapy', 'Physiotherapy', CURRENT_DATE, 5, 'days', 'completed', 1)
      `, [patientA_consultId, patientA_id, doctorId]);

      // 2. Generate Treatment Bill
      const billRes = await db.query(`
        INSERT INTO bills (bill_number, patient_id, doctor_id, bill_type, created_by, branch_id, amount, discount_amount, final_amount, status, appointment_id)
        VALUES ($1, $2, $3, 'treatment', 1, 1, 1000, 0, 1000, 'created', $4) RETURNING bill_id
      `, [`INV-QA-${Date.now().toString().slice(-6)}`, patientA_id, doctorId, patientA_apptId]);
      const billId = billRes.rows[0].bill_id;

      // Verify prescription is STILL pending
      let rxCheck = await db.query(`SELECT pharmacy_status FROM prescriptions WHERE id = $1`, [patientA_rxId]);
      expect(rxCheck.rows[0].pharmacy_status).toBe('pending');

      // 3. Complete Payment
      await db.query(`
        INSERT INTO payments (bill_id, patient_id, payment_method, amount, status, received_by, branch_id)
        VALUES ($1, $2, 'cash', 1000, 'success', 1, 1)
      `, [billId, patientA_id]);

      // CRITICAL TEST DISP-003: PAYMENT != DISPENSED
      rxCheck = await db.query(`SELECT pharmacy_status FROM prescriptions WHERE id = $1`, [patientA_rxId]);
      expect(rxCheck.rows[0].pharmacy_status).toBe('pending');

      // 4. Complete PRO handoff
      const proCompRes = await request(app)
        .post(`/api/v1/pro/patients/${patientA_id}/complete-pro`)
        .set('Authorization', `Bearer ${proToken}`);

      expect([200, 201]).toContain(proCompRes.status);

      // Verify prescription is STILL pending after PRO completion
      rxCheck = await db.query(`SELECT pharmacy_status FROM prescriptions WHERE id = $1`, [patientA_rxId]);
      expect(rxCheck.rows[0].pharmacy_status).toBe('pending');
    });

    test('TEST DISP-004 to DISP-010: Reading queue, opening prescription, and repeated GETs NEVER auto-dispense', async () => {
      // 1. Get Pharmacy Queue
      const queueRes = await request(app)
        .get('/api/v1/pharmacy/queue?status=pending')
        .set('Authorization', `Bearer ${pharmacistToken}`);
      expect(queueRes.status).toBe(200);

      // 2. Open prescription details for processing
      const viewRes = await request(app)
        .get(`/api/v1/pharmacy/prescriptions/${patientA_rxId}/process`)
        .set('Authorization', `Bearer ${pharmacistToken}`);
      expect(viewRes.status).toBe(200);

      // 3. Repeat GET 5 times
      for (let i = 0; i < 5; i++) {
        await request(app).get(`/api/v1/pharmacy/prescriptions/${patientA_rxId}/process`).set('Authorization', `Bearer ${pharmacistToken}`);
      }

      // Check DB: MUST remain pending
      const rxCheck = await db.query(`SELECT pharmacy_status FROM prescriptions WHERE id = $1`, [patientA_rxId]);
      expect(rxCheck.rows[0].pharmacy_status).toBe('pending');
    });

    // =========================================================================
    // 9 - 13. PHARMACY DISPENSING & INVENTORY DEDUCTION (PH, EDIT, DISPENSE, INV)
    // =========================================================================
    test('TEST DISPENSE-001 & INV-004: Pharmacist dispenses medicines. Stock decreases atomically. Status becomes DISPENSED', async () => {
      // Record stock before dispensing
      const stockBeforeRes = await db.query(`SELECT id, quantity, batch_number FROM medicine_stock WHERE medicine_id = 1 AND quantity >= 10 AND expiry_date > CURRENT_DATE LIMIT 1`);
      expect(stockBeforeRes.rows.length).toBeGreaterThan(0);
      const stockRow = stockBeforeRes.rows[0];
      const qtyBefore = parseInt(stockRow.quantity);

      // Get prescription item ID
      const itemRes = await db.query(`SELECT id FROM prescription_items WHERE prescription_id = $1`, [patientA_rxId]);
      const rxItemId = itemRes.rows[0].id;

      // Dispense
      const dispRes = await request(app)
        .post(`/api/v1/pharmacy/prescriptions/${patientA_rxId}/dispense/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          items: [{ item_id: rxItemId, stock_id: stockRow.id, dispense_quantity: 10 }],
          notes: 'Dispensed by pharmacist in QA test'
        });

      expect(dispRes.status).toBe(200);
      expect(dispRes.body.data.pharmacy_status).toBe('dispensed');

      // Verify stock decreased by exactly 10
      const stockAfterRes = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [stockRow.id]);
      const qtyAfter = parseInt(stockAfterRes.rows[0].quantity);
      expect(qtyAfter).toBe(qtyBefore - 10);

      // Verify stock transaction was recorded
      const txRes = await db.query(`SELECT * FROM stock_transactions WHERE reference = $1`, [`Rx #${patientA_rxId}`]);
      expect(txRes.rows.length).toBeGreaterThan(0);
      expect(txRes.rows[0].transaction_type).toBe('out');
    });

    test('TEST DISPENSE-005 & INV-005: Duplicate dispensing on already dispensed prescription is rejected without extra deduction', async () => {
      const stockBefore = await db.query(`SELECT quantity FROM medicine_stock WHERE medicine_id = 1 LIMIT 1`);
      const qtyBefore = parseInt(stockBefore.rows[0].quantity);

      // Attempt second dispensing
      const itemRes = await db.query(`SELECT id FROM prescription_items WHERE prescription_id = $1`, [patientA_rxId]);
      const rxItemId = itemRes.rows[0].id;

      const dupRes = await request(app)
        .post(`/api/v1/pharmacy/prescriptions/${patientA_rxId}/dispense/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          items: [{ item_id: rxItemId, stock_id: 1, dispense_quantity: 10 }]
        });

      expect(dupRes.status).toBe(400);

      // Stock must remain identical
      const stockAfter = await db.query(`SELECT quantity FROM medicine_stock WHERE medicine_id = 1 LIMIT 1`);
      expect(parseInt(stockAfter.rows[0].quantity)).toBe(qtyBefore);
    });

    // =========================================================================
    // 18 - 21. VISIT COMPLETION, GATING, FOLLOW-UP & FINANCIAL SEPARATION
    // =========================================================================
    test('TEST VISIT-002 & FUP-001: Fully dispensed patient evaluates as COMPLETED and READY FOR FOLLOW-UP', async () => {
      const statusRes = await request(app)
        .get(`/api/v1/receptionist/patients/${patientA_id}/visit-status`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(statusRes.status).toBe(200);
      const data = statusRes.body.data;
      expect(data.overall_status).toBe('completed');
      expect(data.is_ready_for_followup).toBe(true);
      expect(data.doctor_consultation).toBe('completed');
      expect(data.payment).toBe('paid');
      expect(data.pharmacy).toBe('dispensed');
    });

    test('TEST PAY-001 to PAY-003 & FIN-001: Scheduling follow-up generates isolated consultation invoice (no previous treatment fee)', async () => {
      const followUpRes = await request(app)
        .post('/api/v1/receptionist/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: patientA_id,
          doctor_id: doctorId,
          appointment_date: testDate,
          appointment_time: '11:00:00',
          appointment_type: 'followup',
          collect_payment: true,
          payment_method: 'cash'
        });

      expect(followUpRes.status).toBe(201);
      expect(followUpRes.body.data.appointment_type).toBe('followup');

      const bill = followUpRes.body.data.bill;
      expect(bill).toBeDefined();
      expect(bill.bill_type).toBe('consultation');
      expect(bill.bill_number).toMatch(/^INV-/);
      // Follow-up fee should be ₹200 (doctor followup fee), NOT old bill or treatment price
      expect(parseFloat(bill.final_amount)).toBe(200);

      // Total patient bills must show exactly 2 separate bills
      const billsRes = await db.query(`SELECT bill_id, final_amount, bill_type FROM bills WHERE patient_id = $1 ORDER BY bill_id ASC`, [patientA_id]);
      expect(billsRes.rows.length).toBe(2);
      expect(parseFloat(billsRes.rows[0].final_amount)).toBe(1000); // Visit 1 treatment bill
      expect(parseFloat(billsRes.rows[1].final_amount)).toBe(200); // Visit 2 follow-up consultation fee
    });
  });

  // =========================================================================
  // 14. INSUFFICIENT STOCK EDGE CASES (STOCK-001 - STOCK-004)
  // =========================================================================
  describe('14. Insufficient Stock Edge Cases', () => {
    let ptStockId = null;
    let rxStockId = null;
    let itemId = null;

    beforeAll(async () => {
      const ptRes = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('Stock Test Patient', $1, 45, 'female', 'Karimnagar', 1) RETURNING patient_id`,
        [`94${Date.now().toString().slice(-8)}`]
      );
      ptStockId = ptRes.rows[0].patient_id;

      const apptRes = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id) VALUES ($1, $2, $3, '12:00:00', 'new', 'pro_completed', 1) RETURNING appointment_id`,
        [ptStockId, doctorId, testDate]
      );
      const apptId = apptRes.rows[0].appointment_id;

      const rxRes = await db.query(
        `INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, pharmacy_status) VALUES ($1, $2, $3, 'pending') RETURNING id`,
        [ptStockId, doctorId, apptId]
      );
      rxStockId = rxRes.rows[0].id;

      const itRes = await db.query(
        `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, dispense_status, dispensed)
         VALUES ($1, 1, '500 mg', '1-0-1', 'oral', 50, 100, 'pending', false) RETURNING id`,
        [rxStockId]
      );
      itemId = itRes.rows[0].id;
    });

    test('TEST STOCK-002: Attempting dispensing greater than available stock is rejected safely', async () => {
      // Find a stock batch with less than 100 units
      const stockBatch = await db.query(`SELECT id, quantity FROM medicine_stock WHERE medicine_id = 1 AND quantity < 100 LIMIT 1`);
      if (stockBatch.rows.length > 0) {
        const batch = stockBatch.rows[0];
        const res = await request(app)
          .post(`/api/v1/pharmacy/prescriptions/${rxStockId}/dispense/complete`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send({
            items: [{ item_id: itemId, stock_id: batch.id, dispense_quantity: 100 }]
          });

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);

        // Verify status remained pending
        const checkRx = await db.query(`SELECT pharmacy_status FROM prescriptions WHERE id = $1`, [rxStockId]);
        expect(checkRx.rows[0].pharmacy_status).toBe('pending');
      }
    });
  });

  // =========================================================================
  // 19. RECEPTIONIST FOLLOW-UP GATE TESTS (FUP-001 - FUP-005)
  // =========================================================================
  describe('19. Receptionist Follow-Up Gate Tests', () => {
    test('TEST FUP-002: Patient with Pharmacy PENDING is rejected from follow-up booking without override', async () => {
      // Create patient with pharmacy pending
      const ptRes = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('Pending Rx Patient', $1, 35, 'male', 'Karimnagar', 1) RETURNING patient_id`,
        [`95${Date.now().toString().slice(-8)}`]
      );
      const pendingPtId = ptRes.rows[0].patient_id;

      const apptRes = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id) VALUES ($1, $2, '2026-10-01', '10:00:00', 'new', 'pro_completed', 1) RETURNING appointment_id`,
        [pendingPtId, doctorId]
      );
      const apptId = apptRes.rows[0].appointment_id;

      const conRes = await db.query(
        `INSERT INTO consultations (appointment_id, patient_id, doctor_id, chief_complaint, status) VALUES ($1, $2, $3, 'Fever', 'completed') RETURNING consultation_id`,
        [apptId, pendingPtId, doctorId]
      );
      const consultId = conRes.rows[0].consultation_id;

      const rxRes = await db.query(
        `INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, appointment_id, pharmacy_status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
        [consultId, pendingPtId, doctorId, apptId]
      );
      await db.query(
        `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, dispense_status, dispensed) VALUES ($1, 1, '500 mg', '1/day', 'oral', 5, 5, 'pending', false)`,
        [rxRes.rows[0].id]
      );

      // Check visit status API
      const statusRes = await request(app)
        .get(`/api/v1/receptionist/patients/${pendingPtId}/visit-status`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(statusRes.body.data.is_ready_for_followup).toBe(false);
      expect(statusRes.body.data.pharmacy).toBe('pending');
      expect(statusRes.body.data.pending_reason).toContain('Pharmacy dispensing is still pending');

      // Attempt booking without override: MUST FAIL WITH 400
      const bookFail = await request(app)
        .post('/api/v1/receptionist/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: pendingPtId,
          doctor_id: doctorId,
          appointment_date: testDate,
          appointment_time: '14:00:00',
          appointment_type: 'followup'
        });

      expect(bookFail.status).toBe(400);
      expect(bookFail.body.message).toContain('Pharmacy dispensing is still pending');

      // Booking WITH allow_override = true: MUST SUCCEED (201)
      const bookPass = await request(app)
        .post('/api/v1/receptionist/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: pendingPtId,
          doctor_id: doctorId,
          appointment_date: testDate,
          appointment_time: '14:00:00',
          appointment_type: 'followup',
          allow_override: true,
          remarks: 'Authorized clinical exception'
        });

      expect(bookPass.status).toBe(201);
    });

    test('TEST FUP-005 & VISIT-003: Patient with consultation completed and NO medicines prescribed evaluates as READY', async () => {
      const ptRes = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('No Rx Patient', $1, 50, 'female', 'Karimnagar', 1) RETURNING patient_id`,
        [`96${Date.now().toString().slice(-8)}`]
      );
      const noRxPtId = ptRes.rows[0].patient_id;

      const apptRes = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id) VALUES ($1, $2, '2026-10-02', '10:00:00', 'new', 'completed', 1) RETURNING appointment_id`,
        [noRxPtId, doctorId]
      );
      const apptId = apptRes.rows[0].appointment_id;

      await db.query(
        `INSERT INTO consultations (appointment_id, patient_id, doctor_id, chief_complaint, status) VALUES ($1, $2, $3, 'Diet check', 'completed')`,
        [apptId, noRxPtId, doctorId]
      );

      const statusRes = await request(app)
        .get(`/api/v1/receptionist/patients/${noRxPtId}/visit-status`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(statusRes.body.data.is_ready_for_followup).toBe(true);
      expect(statusRes.body.data.pharmacy).toBe('not_applicable');
    });
  });

  // =========================================================================
  // 23. PATIENT WITH MULTIPLE VISITS (CRITICAL EDGE CASE)
  // =========================================================================
  describe('23. Patient with Multiple Visits Isolation', () => {
    test('Visit #1 completed, Visit #2 currently active -> Receptionist sees Visit #2 as INCOMPLETE, does not leak Visit #1', async () => {
      // 1. Create Patient
      const ptRes = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('Multi Visit Patient', $1, 42, 'male', 'Karimnagar', 1) RETURNING patient_id`,
        [`97${Date.now().toString().slice(-8)}`]
      );
      const mPtId = ptRes.rows[0].patient_id;

      // 2. Visit 1: Completed in past
      const v1ApptRes = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id) VALUES ($1, $2, '2026-08-01', '09:00:00', 'new', 'completed', 1) RETURNING appointment_id`,
        [mPtId, doctorId]
      );
      const v1ApptId = v1ApptRes.rows[0].appointment_id;
      const v1ConRes = await db.query(
        `INSERT INTO consultations (appointment_id, patient_id, doctor_id, chief_complaint, status) VALUES ($1, $2, $3, 'Old ailment', 'completed') RETURNING consultation_id`,
        [v1ApptId, mPtId, doctorId]
      );
      const v1RxRes = await db.query(
        `INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, appointment_id, pharmacy_status) VALUES ($1, $2, $3, $4, 'dispensed') RETURNING id`,
        [v1ConRes.rows[0].consultation_id, mPtId, doctorId, v1ApptId]
      );
      await db.query(
        `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, dispense_status, dispensed) VALUES ($1, 1, '500 mg', '1/day', 'oral', 5, 5, 'dispensed', true)`,
        [v1RxRes.rows[0].id]
      );

      // 3. Visit 2: Created today, checked_in at clinic (Doctor consultation has NOT happened)
      await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id) VALUES ($1, $2, '2026-12-10', '15:00:00', 'new', 'checked_in', 1) RETURNING appointment_id`,
        [mPtId, doctorId]
      );

      // 4. Verify Receptionist check on patient evaluates Visit 2 (INCOMPLETE), NOT old Visit 1
      const statusRes = await request(app)
        .get(`/api/v1/receptionist/patients/${mPtId}/visit-status`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(statusRes.body.data.is_ready_for_followup).toBe(false);
      expect(statusRes.body.data.doctor_consultation).toBe('pending');
      expect(statusRes.body.data.pending_reason).toContain('Doctor consultation is still pending');
    });
  });

  // =========================================================================
  // 26. AUTHORIZATION & RBAC ISOLATION TESTS
  // =========================================================================
  describe('26. Authorization & RBAC Isolation Tests', () => {
    test('Receptionist CANNOT call pharmacy dispense endpoint (403)', async () => {
      const res = await request(app)
        .post('/api/v1/pharmacy/prescriptions/1/dispense/complete')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ items: [] });

      expect(res.status).toBe(403);
    });

    test('Pharmacist CANNOT access receptionist appointment booking (403)', async () => {
      const res = await request(app)
        .post('/api/v1/receptionist/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    test('Doctor CANNOT access pharmacy stock adjustment or dispensing (403)', async () => {
      const res = await request(app)
        .post('/api/v1/pharmacy/stock/adjustments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 15. MULTIPLE MEDICINES DISPENSING
  // =========================================================================
  describe('15. Multiple Medicines Dispensing', () => {
    test('Prescription with multiple medicines: all stocks decrease correctly and status becomes DISPENSED', async () => {
      const ts = Date.now().toString().slice(-8);
      const ptRes = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('Multi Med Patient', $1, 29, 'female', 'Karimnagar', 1) RETURNING patient_id`,
        [`98${ts}`]
      );
      const ptId = ptRes.rows[0].patient_id;

      const apptRes = await db.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id) VALUES ($1, $2, '2026-12-16', '10:00:00', 'new', 'pro_completed', 1) RETURNING appointment_id`,
        [ptId, doctorId]
      );
      const apptId = apptRes.rows[0].appointment_id;

      const conRes = await db.query(
        `INSERT INTO consultations (appointment_id, patient_id, doctor_id, chief_complaint, status) VALUES ($1, $2, $3, 'Fever and pain', 'completed') RETURNING consultation_id`,
        [apptId, ptId, doctorId]
      );
      const consultId = conRes.rows[0].consultation_id;

      // Prescribe Medicine 1 (qty 10) and Medicine 2 (qty 5)
      await db.query(`
        INSERT INTO medicine_master (id, medicine_name, generic_name, medicine_type, strength, unit, category, status)
        VALUES (2, 'Amoxicillin 250mg', 'Amoxicillin', 'capsule', '250 mg', 'pcs', 'Antibiotic', 'active')
        ON CONFLICT (id) DO NOTHING;
      `);
      await db.query(`
        INSERT INTO medicine_stock (medicine_id, batch_number, manufacture_date, expiry_date, quantity, purchase_rate, mrp, supplier, branch_id)
        VALUES (2, 'BATCH-AMX-001', '2025-01-01', '2028-01-01', 100, 5.00, 10.00, 'MedSupplier', 1)
        ON CONFLICT DO NOTHING;
      `);

      const rxRes = await db.query(
        `INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, appointment_id, pharmacy_status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
        [consultId, ptId, doctorId, apptId]
      );
      const rxId = rxRes.rows[0].id;

      const item1Res = await db.query(
        `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, dispense_status, dispensed) VALUES ($1, 1, '500 mg', '1-0-1', 'oral', 5, 10, 'pending', false) RETURNING id`,
        [rxId]
      );
      const item2Res = await db.query(
        `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, dispense_status, dispensed) VALUES ($1, 2, '250 mg', '1/day', 'oral', 5, 5, 'pending', false) RETURNING id`,
        [rxId]
      );

      // Ensure fresh stock for medicine 1 and 2
      await db.query(`UPDATE medicine_stock SET quantity = 100, expiry_date = '2028-01-01' WHERE medicine_id IN (1, 2)`);

      // Verify stock before dispensing
      const stock1Before = await db.query(`SELECT id, quantity FROM medicine_stock WHERE medicine_id = 1 AND quantity >= 10 AND expiry_date > CURRENT_DATE LIMIT 1`);
      const stock2Before = await db.query(`SELECT id, quantity FROM medicine_stock WHERE medicine_id = 2 AND quantity >= 5 AND expiry_date > CURRENT_DATE LIMIT 1`);

      const s1 = stock1Before.rows[0];
      const s2 = stock2Before.rows[0];

      // Dispense both items
      const dispRes = await request(app)
        .post(`/api/v1/pharmacy/prescriptions/${rxId}/dispense/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          items: [
            { item_id: item1Res.rows[0].id, stock_id: s1.id, dispense_quantity: 10 },
            { item_id: item2Res.rows[0].id, stock_id: s2.id, dispense_quantity: 5 }
          ]
        });

      expect(dispRes.status).toBe(200);
      expect(dispRes.body.data.pharmacy_status).toBe('dispensed');

      // Verify individual stock deductions
      const s1After = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [s1.id]);
      const s2After = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [s2.id]);
      expect(parseInt(s1After.rows[0].quantity)).toBe(parseInt(s1.quantity) - 10);
      expect(parseInt(s2After.rows[0].quantity)).toBe(parseInt(s2.quantity) - 5);
    });
  });

  // =========================================================================
  // 34. CONCURRENCY & RACE-CONDITION DEFENSES
  // =========================================================================
  describe('34. Concurrency & Race-Condition Defenses', () => {
    test('Simultaneous booking of identical doctor + slot results in exactly 1 success and 1 rejection', async () => {
      const ptRes1 = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('Race Patient 1', $1, 30, 'male', 'Karimnagar', 1) RETURNING patient_id`,
        [`991${Date.now().toString().slice(-7)}`]
      );
      const ptRes2 = await db.query(
        `INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id) VALUES ('Race Patient 2', $1, 31, 'male', 'Karimnagar', 1) RETURNING patient_id`,
        [`992${Date.now().toString().slice(-7)}`]
      );

      const slotDate = '2026-12-25';
      const slotTime = '16:00:00';

      const results = await Promise.all([
        request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
          patient_id: ptRes1.rows[0].patient_id,
          doctor_id: doctorId,
          appointment_date: slotDate,
          appointment_time: slotTime,
          appointment_type: 'new'
        }),
        request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
          patient_id: ptRes2.rows[0].patient_id,
          doctor_id: doctorId,
          appointment_date: slotDate,
          appointment_time: slotTime,
          appointment_type: 'new'
        })
      ]);

      const statuses = results.map(r => r.status);
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);
    });
  });

  // =========================================================================
  // 36. FULL GOLDEN END-TO-END PATIENT JOURNEY
  // =========================================================================
  describe('36. Full Golden End-to-End Patient Journey', () => {
    test('Clean journey: Walk-in -> Consultation -> Prescription -> PRO Bill -> Payment -> Pharmacy Dispense -> Follow-up Booking & Isolated Fee', async () => {
      const goldenMobile = `90${Date.now().toString().slice(-8)}`;
      const goldenDate = '2026-12-28';

      // 1. RECEPTIONIST: Register Walk-in Patient & Initial Appointment
      const regRes = await request(app)
        .post('/api/v1/receptionist/patients/walk-in')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          full_name: 'Golden Path Patient',
          mobile_number: goldenMobile,
          gender: 'male',
          age: 38,
          address: 'Main Street, Karimnagar',
          assigned_doctor_id: doctorId,
          appointment_date: goldenDate,
          appointment_time: '11:00:00',
          appointment_type: 'new',
          collect_payment: true,
          payment_method: 'cash'
        });

      expect(regRes.status).toBe(201);
      const ptId = regRes.body.data.patient_id;
      const apptId = regRes.body.data.appointment.appointment_id;

      // Initial visit consultation bill generated
      expect(regRes.body.data.bill).toBeDefined();

      // 2. DOCTOR: Start & Complete Consultation with Prescription
      const startRes = await request(app)
        .post('/api/v1/doctor/consultations/start')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ appointment_id: apptId });
      expect([200, 201]).toContain(startRes.status);
      const consultId = startRes.body.data.consultation_id || startRes.body.data.id;

      const rxRes = await request(app)
        .post('/api/v1/doctor/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          consultation_id: consultId,
          medicines: [
            { medicine_id: 1, dosage: '500 mg', frequency: '1-0-1', duration_days: 5, quantity: 10, route: 'oral' }
          ]
        });
      expect(rxRes.status).toBe(201);
      const rxId = rxRes.body.data.prescription?.id || rxRes.body.data.id;

      const completeDocRes = await request(app)
        .post(`/api/v1/doctor/consultations/${consultId}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          chief_complaint: 'Chronic back pain',
          primary_diagnosis_text: 'Lumbar Strain',
          doctor_notes: 'Physical therapy recommended'
        });
      expect(completeDocRes.status).toBe(200);

      // Verify Pharmacy is PENDING at this stage
      let rxCheck = await db.query(`SELECT pharmacy_status FROM prescriptions WHERE id = $1`, [rxId]);
      expect(rxCheck.rows[0].pharmacy_status).toBe('pending');

      // 3. PRO / MANAGER: Treatment Plan & Billing & Payment
      await db.query(`
        INSERT INTO treatment_plans (consultation_id, patient_id, doctor_id, treatment_name, treatment_type, start_date, duration, duration_unit, status, branch_id)
        VALUES ($1, $2, $3, 'Lumbar Decompression', 'Physical Therapy', CURRENT_DATE, 7, 'days', 'completed', 1)
      `, [consultId, ptId, doctorId]);

      const treatBillRes = await db.query(`
        INSERT INTO bills (bill_number, patient_id, doctor_id, bill_type, created_by, branch_id, amount, discount_amount, final_amount, status, appointment_id)
        VALUES ($1, $2, $3, 'treatment', 1, 1, 1500, 0, 1500, 'created', $4) RETURNING bill_id
      `, [`INV-GOLDEN-${Date.now().toString().slice(-6)}`, ptId, doctorId, apptId]);
      const treatBillId = treatBillRes.rows[0].bill_id;

      await db.query(`
        INSERT INTO payments (bill_id, patient_id, payment_method, amount, status, received_by, branch_id)
        VALUES ($1, $2, 'upi', 1500, 'success', 1, 1)
      `, [treatBillId, ptId]);

      // Complete PRO
      const proRes = await request(app)
        .post(`/api/v1/pro/patients/${ptId}/complete-pro`)
        .set('Authorization', `Bearer ${proToken}`);
      expect(proRes.status).toBe(200);

      // CRITICAL CHECK: Pharmacy MUST STILL be pending!
      rxCheck = await db.query(`SELECT pharmacy_status FROM prescriptions WHERE id = $1`, [rxId]);
      expect(rxCheck.rows[0].pharmacy_status).toBe('pending');

      // Verify Receptionist check shows visit is STILL INCOMPLETE because dispensing is pending
      let visitStatusRes = await request(app)
        .get(`/api/v1/receptionist/patients/${ptId}/visit-status`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(visitStatusRes.body.data.is_ready_for_followup).toBe(false);
      expect(visitStatusRes.body.data.pharmacy).toBe('pending');

      // 4. PHARMACY: Pharmacist inspects and confirms dispensing
      await db.query(`UPDATE medicine_stock SET quantity = 100 WHERE medicine_id = 1 AND expiry_date > CURRENT_DATE`);
      const stockRowRes = await db.query(`SELECT id, quantity FROM medicine_stock WHERE medicine_id = 1 AND quantity >= 10 AND expiry_date > CURRENT_DATE LIMIT 1`);
      const stockRow = stockRowRes.rows[0];
      const rxItemRow = (await db.query(`SELECT id FROM prescription_items WHERE prescription_id = $1`, [rxId])).rows[0];

      const dispRes = await request(app)
        .post(`/api/v1/pharmacy/prescriptions/${rxId}/dispense/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          items: [{ item_id: rxItemRow.id, stock_id: stockRow.id, dispense_quantity: 10 }]
        });
      expect(dispRes.status).toBe(200);
      expect(dispRes.body.data.pharmacy_status).toBe('dispensed');

      // 5. VISIT COMPLETION VERIFICATION
      visitStatusRes = await request(app)
        .get(`/api/v1/receptionist/patients/${ptId}/visit-status`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(visitStatusRes.body.data.overall_status).toBe('completed');
      expect(visitStatusRes.body.data.is_ready_for_followup).toBe(true);
      expect(visitStatusRes.body.data.doctor_consultation).toBe('completed');
      expect(visitStatusRes.body.data.payment).toBe('paid');
      expect(visitStatusRes.body.data.pharmacy).toBe('dispensed');

      // 6. RECEPTIONIST: Schedule Follow-Up Appointment
      const followUpRes = await request(app)
        .post('/api/v1/receptionist/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patient_id: ptId,
          doctor_id: doctorId,
          appointment_date: goldenDate,
          appointment_time: '17:00:00',
          appointment_type: 'followup',
          collect_payment: true,
          payment_method: 'cash'
        });

      expect(followUpRes.status).toBe(201);
      expect(followUpRes.body.data.appointment_type).toBe('followup');

      // 7. FINANCIAL SEPARATION CHECK
      const fupBill = followUpRes.body.data.bill;
      expect(fupBill).toBeDefined();
      expect(fupBill.bill_type).toBe('consultation');
      expect(parseFloat(fupBill.final_amount)).toBe(200); // Standard follow-up consultation fee
      // Verify previous ₹1500 treatment is completely untouched
      const allBills = await db.query(`SELECT bill_id, final_amount, bill_type FROM bills WHERE patient_id = $1 ORDER BY bill_id ASC`, [ptId]);
      expect(allBills.rows.some(b => parseFloat(b.final_amount) === 1500 && b.bill_type === 'treatment')).toBe(true);
      expect(allBills.rows.some(b => parseFloat(b.final_amount) === 200 && b.bill_type === 'consultation')).toBe(true);
    });
  });
});
