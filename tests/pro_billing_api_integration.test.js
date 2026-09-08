const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('PRO / Manager Billing API Integration Test Suite', () => {
  let proToken;
  let adminToken;
  let execToken;
  let testPatientId;
  let testPackageId;

  beforeAll(async () => {
    // 1. Authenticate PRO Manager
    const proLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pat_pro', password: 'Password@123' });
    proToken = proLogin.body?.data?.token;

    // 2. Authenticate Super Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = adminLogin.body?.data?.token;

    // 3. Authenticate Executive (for unauthorized role test)
    const execLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'eric_exec', password: 'Password@123' });
    execToken = execLogin.body?.data?.token;

    // 4. Create or pick a real test patient
    const ptRes = await db.query(`
      INSERT INTO patients (full_name, mobile_number, patient_type, branch_id)
      VALUES ('PRO Integration Test Patient', '9988776655', 'new', 1)
      RETURNING patient_id
    `);
    testPatientId = ptRes.rows[0].patient_id;

    // 5. Create a real package for this patient
    const pkgRes = await db.query(`
      INSERT INTO packages (
        patient_id, package_name, package_type, from_date, to_date, duration_days,
        package_amount, discount_amount, final_amount, payment_status, status, created_by, branch_id
      ) VALUES ($1, 'Comprehensive Spinal Care', 'monthly', CURRENT_DATE, CURRENT_DATE + 30, 30, 5000, 500, 4500, 'pending', 'active', 1, 1)
      RETURNING package_id
    `, [testPatientId]);
    testPackageId = pkgRes.rows[0].package_id;
  });

  afterAll(async () => {
    // Clean up created test records
    if (testPatientId) {
      await db.query(`DELETE FROM bill_items WHERE bill_id IN (SELECT bill_id FROM bills WHERE patient_id = $1)`, [testPatientId]);
      await db.query(`DELETE FROM bills WHERE patient_id = $1`, [testPatientId]);
      await db.query(`DELETE FROM packages WHERE patient_id = $1`, [testPatientId]);
      await db.query(`DELETE FROM patients WHERE patient_id = $1`, [testPatientId]);
    }
  });

  // HAPPY PATH TESTS
  describe('Happy Path Bill Creation', () => {
    test('1. Successful bill creation with single line item', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          doctor_id: 1,
          bill_type: 'treatment',
          items: [
            { item_name: 'Single Physiotherapy Session', charge_type: 'Treatment', quantity: 1, unit_price: 1500 }
          ],
          discount_amount: 0
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bill_number).toMatch(/^BILL-PRO-/);
      expect(parseFloat(res.body.data.subtotal)).toBe(1500);
      expect(parseFloat(res.body.data.discount_amount)).toBe(0);
      expect(parseFloat(res.body.data.final_amount)).toBe(1500);
      expect(res.body.data.status).toBe('created');
    });

    test('2. Successful bill creation with multiple line items', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          doctor_id: 1,
          bill_type: 'treatment',
          items: [
            { item_name: 'Electrotherapy', charge_type: 'Procedure', quantity: 2, unit_price: 800 },
            { item_name: 'Herbal Compress', charge_type: 'Medicine', quantity: 1, unit_price: 1400 }
          ],
          discount_amount: 300
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(parseFloat(res.body.data.subtotal)).toBe(3000); // 2*800 + 1*1400
      expect(parseFloat(res.body.data.discount_amount)).toBe(300);
      expect(parseFloat(res.body.data.final_amount)).toBe(2700); // 3000 - 300

      // Verify bill items in database
      const itemsCheck = await db.query(`SELECT * FROM bill_items WHERE bill_id = $1`, [res.body.data.bill_id]);
      expect(itemsCheck.rows.length).toBe(2);
    });

    test('3. Successful bill creation with linked Package ID', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'package',
          package_id: testPackageId,
          items: [
            { item_name: 'Spinal Care Package Enrollment', charge_type: 'Package', quantity: 1, unit_price: 4500 }
          ],
          discount_amount: 0
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.package_id).toBe(testPackageId);
      expect(parseFloat(res.body.data.final_amount)).toBe(4500);
    });

    test('4. Correct server-side calculation verification in database', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'other',
          items: [
            { item_name: 'Diagnostic Blood Test', charge_type: 'Investigation', quantity: 3, unit_price: 700 }
          ],
          discount_amount: 100
        });

      expect(res.status).toBe(201);
      const billId = res.body.data.bill_id;

      // Verify directly from PostgreSQL
      const dbBill = await db.query(`SELECT * FROM bills WHERE bill_id = $1`, [billId]);
      expect(dbBill.rows.length).toBe(1);
      expect(parseFloat(dbBill.rows[0].amount)).toBe(2100); // 3 * 700
      expect(parseFloat(dbBill.rows[0].discount_amount)).toBe(100);
      expect(parseFloat(dbBill.rows[0].final_amount)).toBe(2000);
    });
  });

  // EDGE CASE & VALIDATION TESTS
  describe('Edge Case Validations', () => {
    test('5. Attempting bill_type = consultation is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'consultation',
          items: [{ item_name: 'Doctor Consultation', charge_type: 'Consultation', quantity: 1, unit_price: 500 }]
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Consultation fee billing is handled by Receptionist only');
    });

    test('6. Missing patient_id returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          bill_type: 'treatment',
          items: [{ item_name: 'Therapy', charge_type: 'Treatment', quantity: 1, unit_price: 1000 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('patient_id, bill_type, and items array are required');
    });

    test('7. Empty items array returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: []
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('items array are required');
    });

    test('8. Missing authorization token returns 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [{ item_name: 'Therapy', charge_type: 'Treatment', quantity: 1, unit_price: 1000 }]
        });

      expect(res.status).toBe(401);
    });

    test('9. Unauthorized role (executive) returns 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${execToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [{ item_name: 'Therapy', charge_type: 'Treatment', quantity: 1, unit_price: 1000 }]
        });

      expect(res.status).toBe(403);
    });
  });

  // RETRIEVAL & PATIENT LOOKUP ENDPOINTS
  describe('Bills Retrieval & Patient / Package Lookups', () => {
    test('10. GET /api/v1/pro/bills/pending returns created bills', async () => {
      const res = await request(app)
        .get('/api/v1/pro/bills/pending')
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('11. GET /api/v1/pro/bills/history returns complete bills ledger', async () => {
      const res = await request(app)
        .get('/api/v1/pro/bills/history')
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('12. Patient verification: GET /api/v1/pro/patients/:id/overview returns patient info for valid ID', async () => {
      const res = await request(app)
        .get(`/api/v1/pro/patients/${testPatientId}/overview`)
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patient.patient_id).toBe(testPatientId);
      expect(res.body.data.patient.full_name).toBe('PRO Integration Test Patient');
    });

    test('13. Patient verification: GET /api/v1/pro/patients/:id/overview returns 404 for non-existent ID', async () => {
      const res = await request(app)
        .get('/api/v1/pro/patients/999999/overview')
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Patient not found');
    });

    test('14. Package lookup: GET /api/v1/pro/packages?patient_id=:id returns linked packages', async () => {
      const res = await request(app)
        .get(`/api/v1/pro/packages?patient_id=${testPatientId}`)
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some(p => p.package_id === testPackageId)).toBe(true);
    });
  });
});
