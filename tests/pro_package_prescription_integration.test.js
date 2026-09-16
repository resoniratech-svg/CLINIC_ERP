const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/db');

describe('PRO Package Enrollment & Prescription Integration Test Suite', () => {
  let proToken;
  let pharmacyToken;
  let testPatientId;
  let medicineAId;
  let medicineBId;

  beforeAll(async () => {
    // 1. Generate auth tokens
    proToken = jwt.sign(
      { user_id: 557, username: 'pat_pro', role: 'pro_manager', branch_id: 1 },
      process.env.JWT_SECRET || 'super_secret_jwt_key_123!'
    );

    pharmacyToken = jwt.sign(
      { user_id: 1345, username: 'peter_pharmacy', role: 'pharmacy', branch_id: 1 },
      process.env.JWT_SECRET || 'super_secret_jwt_key_123!'
    );

    // 3. Create test patient
    const testPhone = '99' + Math.floor(10000000 + Math.random() * 90000000);
    const ptRes = await db.query(`
      INSERT INTO patients (full_name, mobile_number, patient_type, branch_id)
      VALUES ('Package Rx Test Patient', $1, 'new', 1)
      RETURNING patient_id
    `, [testPhone]);
    testPatientId = ptRes.rows[0].patient_id;

    // 4. Ensure at least two active medicines in medicine_master
    const existingMeds = await db.query(`
      SELECT id FROM medicine_master WHERE status = 'active' LIMIT 2
    `);
    if (existingMeds.rows.length >= 2) {
      medicineAId = existingMeds.rows[0].id;
      medicineBId = existingMeds.rows[1].id;
    } else {
      const med1 = await db.query(`
        INSERT INTO medicine_master (medicine_name, generic_name, strength, medicine_type, status)
        VALUES ('Test Arnica ' || floor(random()*10000), 'Arnica Montana', '200CH', 'liquid', 'active')
        RETURNING id
      `);
      medicineAId = med1.rows[0].id;

      const med2 = await db.query(`
        INSERT INTO medicine_master (medicine_name, generic_name, strength, medicine_type, status)
        VALUES ('Test Rhus ' || floor(random()*10000), 'Rhus Tox', '30C', 'globules', 'active')
        RETURNING id
      `);
      medicineBId = med2.rows[0].id;
    }
  });

  afterAll(async () => {
    try {
      // Clean up prescription modifications, items, prescriptions, packages, and test patient
      await db.query(`DELETE FROM prescription_modifications WHERE modified_by = 1`);
      await db.query(`DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE patient_id = $1)`, [testPatientId]);
      await db.query(`DELETE FROM prescriptions WHERE patient_id = $1`, [testPatientId]);
      await db.query(`DELETE FROM packages WHERE patient_id = $1`, [testPatientId]);
      await db.query(`DELETE FROM patients WHERE patient_id = $1`, [testPatientId]);
      await db.pool.end();
    } catch (e) {}
  });

  // TEST 1: Enroll package without prescription (optional prescription)
  test('1. Enrolling package without prescription succeeds cleanly (optional prescription)', async () => {
    const res = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_name: 'Basic Wellness Package',
        package_type: 'monthly',
        from_date: '2026-10-01',
        package_amount: 3000,
        discount_amount: 500,
        remarks: 'No medicines required for this wellness package'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.package_id).toBeDefined();
    expect(res.body.data.prescription_id).toBeNull();
    expect(res.body.data.prescription).toBeNull();
    expect(res.body.data.final_amount).toBe('2500.00');

    // DB verification
    const dbPkg = await db.query('SELECT * FROM packages WHERE package_id = $1', [res.body.data.package_id]);
    expect(dbPkg.rows[0].prescription_id).toBeNull();
  });

  // TEST 2: Enroll package with one medicine
  test('2. Enrolling package with one medicine creates linked package, prescription, and items', async () => {
    const res = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_name: 'Homeo Arthritis Plan',
        package_type: 'monthly',
        from_date: '2026-10-01',
        package_amount: 5000,
        discount_amount: 0,
        remarks: 'Joint pain care',
        prescription_items: [
          {
            medicine_id: medicineAId,
            dosage: '4 drops',
            frequency: '2 times/day',
            duration_days: 30,
            quantity: 60,
            route: 'oral'
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const pkg = res.body.data;
    expect(pkg.package_id).toBeDefined();
    expect(pkg.prescription_id).toBeDefined();
    expect(pkg.prescription).toBeDefined();
    expect(pkg.prescription.items.length).toBe(1);
    expect(pkg.prescription.items[0].medicine_id).toBe(medicineAId);
    expect(pkg.prescription.items[0].dosage).toBe('4 drops');
    expect(pkg.prescription.items[0].frequency).toBe('2 times/day');
    expect(pkg.prescription.items[0].duration_days).toBe(30);
    expect(pkg.prescription.items[0].quantity).toBe(60);

    // Verify bidirectional database links
    const dbPresc = await db.query('SELECT * FROM prescriptions WHERE id = $1', [pkg.prescription_id]);
    expect(dbPresc.rows.length).toBe(1);
    expect(dbPresc.rows[0].package_id).toBe(pkg.package_id);
    expect(dbPresc.rows[0].patient_id).toBe(testPatientId);
    expect(dbPresc.rows[0].pharmacy_status).toBe('pending');

    const dbItems = await db.query('SELECT * FROM prescription_items WHERE prescription_id = $1', [pkg.prescription_id]);
    expect(dbItems.rows.length).toBe(1);
    expect(dbItems.rows[0].medicine_id).toBe(medicineAId);
  });

  // TEST 3: Enroll package with multiple medicines
  test('3. Enrolling package with multiple medicines correctly records all items and individual quantities', async () => {
    const res = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_name: 'Annual Homeopathy Care Plan',
        package_type: 'yearly',
        from_date: '2026-10-01',
        package_amount: 15000,
        discount_amount: 2000,
        remarks: 'Multi-medicine annual plan',
        prescription_items: [
          {
            medicine_id: medicineAId,
            dosage: '1 dose',
            frequency: '1 time/day',
            duration_days: 90,
            quantity: 90
          },
          {
            medicine_id: medicineBId,
            dosage: '2 pills',
            frequency: '3 times/day',
            duration_days: 30,
            quantity: 180
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const pkg = res.body.data;
    expect(pkg.prescription_id).toBeDefined();
    expect(pkg.prescription.items.length).toBe(2);

    const savedMedIds = pkg.prescription.items.map(i => i.medicine_id);
    expect(savedMedIds).toContain(medicineAId);
    expect(savedMedIds).toContain(medicineBId);

    // Verify DB item counts
    const dbItems = await db.query('SELECT * FROM prescription_items WHERE prescription_id = $1 ORDER BY id ASC', [pkg.prescription_id]);
    expect(dbItems.rows.length).toBe(2);
    expect(dbItems.rows[0].quantity).toBe(90);
    expect(dbItems.rows[1].quantity).toBe(180);
  });

  // TEST 4: Validation failures & transactional rollback
  test('4. Validation rejects invalid durations, non-positive quantities, non-existent medicines, and duplicates', async () => {
    // 4.1 Non-positive duration
    const res1 = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_name: 'Invalid Duration Test',
        package_type: 'monthly',
        from_date: '2026-10-01',
        package_amount: 2000,
        prescription_items: [
          { medicine_id: medicineAId, dosage: '1 tab', frequency: '1 time/day', duration_days: -5, quantity: 10 }
        ]
      });
    expect(res1.status).toBe(400);

    // 4.2 Non-positive quantity
    const res2 = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_name: 'Invalid Quantity Test',
        package_type: 'monthly',
        from_date: '2026-10-01',
        package_amount: 2000,
        prescription_items: [
          { medicine_id: medicineAId, dosage: '1 tab', frequency: '1 time/day', duration_days: 10, quantity: 0 }
        ]
      });
    expect(res2.status).toBe(400);

    // 4.3 Non-existent medicine ID
    const res3 = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_name: 'Missing Med Test',
        package_type: 'monthly',
        from_date: '2026-10-01',
        package_amount: 2000,
        prescription_items: [
          { medicine_id: 999999, dosage: '1 tab', frequency: '1 time/day', duration_days: 10, quantity: 10 }
        ]
      });
    expect(res3.status).toBe(400);

    // 4.4 Duplicate medicine
    const res4 = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: testPatientId,
        package_name: 'Duplicate Med Test',
        package_type: 'monthly',
        from_date: '2026-10-01',
        package_amount: 2000,
        prescription_items: [
          { medicine_id: medicineAId, dosage: '1 tab', frequency: '1 time/day', duration_days: 10, quantity: 10 },
          { medicine_id: medicineAId, dosage: '2 tabs', frequency: '2 times/day', duration_days: 10, quantity: 20 }
        ]
      });
    expect(res4.status).toBe(400);

    // Confirm no orphaned packages were created
    const badPkg = await db.query("SELECT * FROM packages WHERE package_name = 'Duplicate Med Test'");
    expect(badPkg.rows.length).toBe(0);
  });

  // TEST 5: GET /pro/packages returns enriched prescription details
  test('5. GET /pro/packages returns enriched prescription details and medicine line items', async () => {
    const res = await request(app)
      .get(`/api/v1/pro/packages?patient_id=${testPatientId}`)
      .set('Authorization', `Bearer ${proToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const enrolledWithPresc = res.body.data.find(p => p.package_name === 'Annual Homeopathy Care Plan');
    expect(enrolledWithPresc).toBeDefined();
    expect(enrolledWithPresc.prescription_id).toBeDefined();
    expect(enrolledWithPresc.items_count).toBe(2);
    expect(Array.isArray(enrolledWithPresc.prescription_medicines)).toBe(true);
    expect(enrolledWithPresc.prescription_medicines.length).toBe(2);
    expect(enrolledWithPresc.prescription_medicines[0].medicine_name).toBeDefined();
  });

  // TEST 6: Pharmacy Queue Integration
  test('6. Package prescriptions appear in Pharmacy Queue with pending status and package info', async () => {
    const res = await request(app)
      .get('/api/v1/pharmacy/queue')
      .set('Authorization', `Bearer ${pharmacyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const found = res.body.data.find(rx => rx.patient_id === testPatientId && rx.package_name === 'Annual Homeopathy Care Plan');
    expect(found).toBeDefined();
    expect(found.pharmacy_status).toBe('pending');
    expect(found.items_count).toBe(2);
  });

  // TEST 7: Pharmacy Processing
  test('7. Pharmacy staff can retrieve package prescription for processing without requiring prior consultation status', async () => {
    // Get the prescription ID of the package
    const pkgCheck = await db.query("SELECT prescription_id FROM packages WHERE package_name = 'Annual Homeopathy Care Plan' AND patient_id = $1", [testPatientId]);
    const rxId = pkgCheck.rows[0].prescription_id;

    const res = await request(app)
      .get(`/api/v1/pharmacy/prescriptions/${rxId}/process`)
      .set('Authorization', `Bearer ${pharmacyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.prescription).toBeDefined();
    expect(res.body.data.prescription.package_name).toBe('Annual Homeopathy Care Plan');
    expect(res.body.data.items.length).toBe(2);
  });

  // TEST 8: PRO Role Medicine Catalog Read-Only Access
  test('8. PRO role can search and read medicine catalog (GET /pharmacy/medicines) for package prescription', async () => {
    const res = await request(app)
      .get('/api/v1/pharmacy/medicines?status=active')
      .set('Authorization', `Bearer ${proToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    
    // Verify catalog fields required by MedicineSelector
    const med = res.body.data[0];
    expect(med.id).toBeDefined();
    expect(med.medicine_name).toBeDefined();
  });

  // TEST 9: PRO Role Is Restricted From Pharmacy Write / Admin Operations
  test('9. PRO role is strictly denied access to create/update medicines and pharmacy operations', async () => {
    // Attempt create medicine as PRO -> 403 Forbidden
    const createRes = await request(app)
      .post('/api/v1/pharmacy/medicines')
      .set('Authorization', `Bearer ${proToken}`)
      .send({ medicine_name: 'Unauthorized Med', strength: '1X' });
    expect(createRes.status).toBe(403);
    expect(createRes.body.message).toBe('Permission denied for this role');

    // Attempt update medicine as PRO -> 403 Forbidden
    const updateRes = await request(app)
      .put(`/api/v1/pharmacy/medicines/${medicineAId}`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({ medicine_name: 'Modified Med' });
    expect(updateRes.status).toBe(403);
    expect(updateRes.body.message).toBe('Permission denied for this role');

    // Attempt stock adjustment as PRO -> 403 Forbidden
    const stockRes = await request(app)
      .post('/api/v1/pharmacy/stock/adjustments')
      .set('Authorization', `Bearer ${proToken}`)
      .send({ medicine_id: medicineAId, quantity_change: 10 });
    expect(stockRes.status).toBe(403);
    expect(stockRes.body.message).toBe('Permission denied for this role');
  });
});
