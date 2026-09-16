const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/db');

describe('PRO Package Billing Integration Test Suite', () => {
  let proToken;
  let proTokenBranch2;
  let testPatientId;
  let anotherPatientId;
  let enrolledPackageId;
  let enrolledRxPackageId;
  let medicineAId;

  beforeAll(async () => {
    // 1. Auth tokens
    proToken = jwt.sign(
      { user_id: 557, username: 'pat_pro', role: 'pro_manager', branch_id: 1 },
      process.env.JWT_SECRET || 'super_secret_jwt_key_123!'
    );

    proTokenBranch2 = jwt.sign(
      { user_id: 558, username: 'pat_pro_b2', role: 'pro_manager', branch_id: 2 },
      process.env.JWT_SECRET || 'super_secret_jwt_key_123!'
    );

    // 2. Test patients
    const testPhone1 = '99' + Math.floor(10000000 + Math.random() * 90000000);
    const pt1 = await db.query(`
      INSERT INTO patients (full_name, mobile_number, patient_type, branch_id)
      VALUES ('Billing Test Patient One', $1, 'new', 1)
      RETURNING patient_id
    `, [testPhone1]);
    testPatientId = pt1.rows[0].patient_id;

    const testPhone2 = '99' + Math.floor(10000000 + Math.random() * 90000000);
    const pt2 = await db.query(`
      INSERT INTO patients (full_name, mobile_number, patient_type, branch_id)
      VALUES ('Billing Test Patient Two', $1, 'new', 1)
      RETURNING patient_id
    `, [testPhone2]);
    anotherPatientId = pt2.rows[0].patient_id;

    // 3. Ensure active medicine exists for prescription test
    const medQuery = await db.query(`SELECT id FROM medicine_master WHERE status = 'active' LIMIT 1`);
    if (medQuery.rows.length > 0) {
      medicineAId = medQuery.rows[0].id;
    } else {
      const insMed = await db.query(`
        INSERT INTO medicine_master (medicine_name, generic_name, strength, medicine_type, status)
        VALUES ('Test Arnica ' || floor(random()*10000), 'Arnica Montana', '200CH', 'liquid', 'active')
        RETURNING id
      `);
      medicineAId = insMed.rows[0].id;
    }

    // 4. Enroll test package 1 without prescription
    const pkg1 = await db.query(`
      INSERT INTO packages (patient_id, package_name, package_type, from_date, to_date, duration_days, package_amount, discount_amount, final_amount, status, created_by, branch_id)
      VALUES ($1, 'Monthly Homeopathy Care Plan', 'monthly', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 30, 15000.00, 1000.00, 14000.00, 'active', 557, 1)
      RETURNING package_id
    `, [testPatientId]);
    enrolledPackageId = pkg1.rows[0].package_id;

    // 5. Enroll test package 2 with prescription
    const rxRes = await db.query(`
      INSERT INTO prescriptions (patient_id, branch_id, created_by, pharmacy_status)
      VALUES ($1, 1, 557, 'pending')
      RETURNING id
    `, [testPatientId]);
    const rxId = rxRes.rows[0].id;

    await db.query(`
      INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, quantity, dispense_status)
      VALUES ($1, $2, '2 drops', 'twice_daily', 30, 1, 'pending')
    `, [rxId, medicineAId]);

    const pkg2 = await db.query(`
      INSERT INTO packages (patient_id, package_name, package_type, from_date, to_date, duration_days, package_amount, discount_amount, final_amount, status, created_by, branch_id, prescription_id)
      VALUES ($1, 'Quarterly Wellness Plan', 'quarterly', CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', 90, 30000.00, 2000.00, 28000.00, 'active', 557, 1, $2)
      RETURNING package_id
    `, [testPatientId, rxId]);
    enrolledRxPackageId = pkg2.rows[0].package_id;

    await db.query(`UPDATE prescriptions SET package_id = $1 WHERE id = $2`, [enrolledRxPackageId, rxId]);
  });

  afterAll(async () => {
    try {
      await db.query(`DELETE FROM payments WHERE patient_id IN ($1, $2)`, [testPatientId, anotherPatientId]);
      await db.query(`DELETE FROM due_patients WHERE patient_id IN ($1, $2)`, [testPatientId, anotherPatientId]);
      await db.query(`DELETE FROM bill_items WHERE bill_id IN (SELECT bill_id FROM bills WHERE patient_id IN ($1, $2))`, [testPatientId, anotherPatientId]);
      await db.query(`DELETE FROM bills WHERE patient_id IN ($1, $2)`, [testPatientId, anotherPatientId]);
      await db.query(`DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE patient_id IN ($1, $2))`, [testPatientId, anotherPatientId]);
      await db.query(`DELETE FROM prescriptions WHERE patient_id IN ($1, $2)`, [testPatientId, anotherPatientId]);
      await db.query(`DELETE FROM packages WHERE patient_id IN ($1, $2)`, [testPatientId, anotherPatientId]);
      await db.query(`DELETE FROM patients WHERE patient_id IN ($1, $2)`, [testPatientId, anotherPatientId]);
      await db.pool.end();
    } catch (e) {}
  });

  // TEST 1: Initial unbilled state
  test('1. Newly enrolled package has unbilled status and zero paid amount', async () => {
    const res = await request(app)
      .get(`/api/v1/pro/packages?patient_id=${testPatientId}`)
      .set('Authorization', `Bearer ${proToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const pkg = res.body.data.find(p => p.package_id === enrolledPackageId);
    expect(pkg).toBeDefined();
    expect(pkg.billing_status).toBe('unbilled');
    expect(pkg.invoice_id).toBeNull();
    expect(pkg.paid_amount).toBe(0);
    expect(pkg.balance_due).toBe(14000);
  });

  // TEST 2: Authoritative Server-Side Calculation & Invoice Generation
  let createdBillId;
  let createdBillNumber;

  test('2. Creates package invoice with server-side authoritative pricing and package line item', async () => {
    // Deliberately send mismatched / manipulated client amounts to test server authority
    const res = await request(app)
      .post('/api/v1/pro/billing')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_id: enrolledPackageId,
        bill_type: 'package',
        amount: 999999, // Should be overridden by server
        discount_amount: 8888, // Should be overridden by server
        items: [{ item_name: 'Fake Item', amount: 50 }]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    createdBillId = res.body.data.bill_id;
    createdBillNumber = res.body.data.bill_number;

    // Verify authoritative values derived from package (15,000 subtotal, 1,000 discount, 14,000 final)
    expect(parseFloat(res.body.data.amount)).toBe(15000);
    expect(parseFloat(res.body.data.discount_amount)).toBe(1000);
    expect(parseFloat(res.body.data.final_amount)).toBe(14000);
    expect(res.body.data.package_id).toBe(enrolledPackageId);
    expect(res.body.data.bill_type).toBe('package');

    // Verify bill items in database
    const itemsRes = await db.query(`SELECT * FROM bill_items WHERE bill_id = $1`, [createdBillId]);
    expect(itemsRes.rows.length).toBe(1);
    expect(itemsRes.rows[0].charge_type).toBe('Package');
    expect(itemsRes.rows[0].description).toBe('Monthly Homeopathy Care Plan');
    expect(parseFloat(itemsRes.rows[0].amount)).toBe(15000);
  });

  // TEST 3: Duplicate Invoice Guard
  test('3. Prevents creating duplicate invoice for already-invoiced package', async () => {
    const res = await request(app)
      .post('/api/v1/pro/billing')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_id: enrolledPackageId,
        bill_type: 'package'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invoice already exists for this package');
    expect(res.body.data?.existing_bill).toBeDefined();
    expect(res.body.data?.existing_bill?.bill_number).toBe(createdBillNumber);
  });

  // TEST 4: Security - Patient Mismatch Rejection
  test('4. Rejects package billing if package does not belong to selected patient', async () => {
    const res = await request(app)
      .post('/api/v1/pro/billing')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: anotherPatientId, // Mismatched patient!
        package_id: enrolledPackageId,
        bill_type: 'package'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('cannot be billed to Patient');
  });

  // TEST 5: Security - Multi-Branch Isolation
  test('5. Rejects package billing if package belongs to a different branch', async () => {
    const res = await request(app)
      .post('/api/v1/pro/billing')
      .set('Authorization', `Bearer ${proTokenBranch2}`) // Branch 2 user!
      .send({
        patient_id: testPatientId,
        package_id: enrolledPackageId, // Branch 1 package!
        bill_type: 'package'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Unauthorized: Package belongs to a different clinic branch');
  });

  // TEST 6: Invoiced Status on Packages Page
  test('6. Invoiced package reflects billing_status: invoiced with invoice details', async () => {
    const res = await request(app)
      .get(`/api/v1/pro/packages?patient_id=${testPatientId}`)
      .set('Authorization', `Bearer ${proToken}`);

    expect(res.status).toBe(200);
    const pkg = res.body.data.find(p => p.package_id === enrolledPackageId);
    expect(pkg).toBeDefined();
    expect(pkg.billing_status).toBe('invoiced');
    expect(pkg.invoice_id).toBe(createdBillId);
    expect(pkg.invoice_number).toBe(createdBillNumber);
    expect(pkg.paid_amount).toBe(0);
    expect(pkg.balance_due).toBe(14000);
  });

  // TEST 7: Partial Payment Flow
  test('7. Recording partial payment updates package billing_status to partially_paid', async () => {
    const res = await request(app)
      .post('/api/v1/pro/payments')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        bill_id: createdBillId,
        amount: 5000,
        payment_method: 'cash',
        remarks: 'First installment'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paid_total).toBe(5000);
    expect(res.body.data.remaining_due).toBe(9000);
    expect(res.body.data.updated_bill_status).toBe('partial');

    // Verify package reflects partially_paid
    const pkgRes = await request(app)
      .get(`/api/v1/pro/packages?patient_id=${testPatientId}`)
      .set('Authorization', `Bearer ${proToken}`);

    const pkg = pkgRes.body.data.find(p => p.package_id === enrolledPackageId);
    expect(pkg.billing_status).toBe('partially_paid');
    expect(pkg.paid_amount).toBe(5000);
    expect(pkg.balance_due).toBe(9000);
  });

  // TEST 8: Full Payment Completion Flow
  test('8. Recording remaining payment updates package billing_status to paid with 0 balance', async () => {
    const res = await request(app)
      .post('/api/v1/pro/payments')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        bill_id: createdBillId,
        amount: 9000,
        payment_method: 'upi',
        remarks: 'Final settlement'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paid_total).toBe(14000);
    expect(res.body.data.remaining_due).toBe(0);
    expect(res.body.data.updated_bill_status).toBe('paid');

    // Verify package reflects fully paid
    const pkgRes = await request(app)
      .get(`/api/v1/pro/packages?patient_id=${testPatientId}`)
      .set('Authorization', `Bearer ${proToken}`);

    const pkg = pkgRes.body.data.find(p => p.package_id === enrolledPackageId);
    expect(pkg.billing_status).toBe('paid');
    expect(pkg.paid_amount).toBe(14000);
    expect(pkg.balance_due).toBe(0);
  });

  // TEST 9: Prescription Medicines Not Double-Billed
  test('9. Package with prescription is billed as single package charge without medicine line item duplication', async () => {
    const res = await request(app)
      .post('/api/v1/pro/billing')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_id: enrolledRxPackageId,
        bill_type: 'package'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const rxBillId = res.body.data.bill_id;
    expect(parseFloat(res.body.data.amount)).toBe(30000);
    expect(parseFloat(res.body.data.discount_amount)).toBe(2000);
    expect(parseFloat(res.body.data.final_amount)).toBe(28000);

    // Verify that prescription medicines were NOT added as extra bill items
    const itemsRes = await db.query(`SELECT * FROM bill_items WHERE bill_id = $1`, [rxBillId]);
    expect(itemsRes.rows.length).toBe(1);
    expect(itemsRes.rows[0].charge_type).toBe('Package');
    expect(itemsRes.rows[0].description).toBe('Quarterly Wellness Plan');
    expect(parseFloat(itemsRes.rows[0].amount)).toBe(30000);
  });

  // TEST 10: Bills Listings Include Package Information
  test('10. Bills listings include package_name and package_type', async () => {
    const res = await request(app)
      .get('/api/v1/pro/bills/paid')
      .set('Authorization', `Bearer ${proToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const foundPaid = res.body.data.find(b => b.bill_id === createdBillId);
    expect(foundPaid).toBeDefined();
    expect(foundPaid.package_name).toBe('Monthly Homeopathy Care Plan');
    expect(foundPaid.package_type).toBe('monthly');
  });
});
