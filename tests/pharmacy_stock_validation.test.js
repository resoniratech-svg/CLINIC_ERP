const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

describe('Pharmacy Stock Validation & FEFO Dispensing Suite (12 Core Test Cases)', () => {
  let pharmacyToken, doctorToken, proToken;
  let testMedicineId, testPrescriptionId, testItemId;

  beforeAll(async () => {
    await seed();

    // Login users
    const pharmLogin = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
    pharmacyToken = pharmLogin.body.data.token;

    const docLogin = await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' });
    doctorToken = docLogin.body.data.token;

    const proLogin = await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' });
    proToken = proLogin.body.data.token;
  });

  beforeEach(async () => {
    // Reset test data
    await db.query(`UPDATE packages SET prescription_id = NULL`);
    await db.query(`DELETE FROM medicine_returns`);
    await db.query(`DELETE FROM stock_adjustments`);
    await db.query(`DELETE FROM prescription_modifications`);
    await db.query(`DELETE FROM prescription_clarifications`);
    await db.query(`DELETE FROM stock_transactions WHERE batch_number LIKE 'TEST-%' OR batch_number LIKE 'BATCH-%'`);
    await db.query(`DELETE FROM prescription_items WHERE prescription_id > 1`);
    await db.query(`DELETE FROM prescriptions WHERE id > 1`);
    await db.query(`DELETE FROM medicine_stock WHERE batch_number LIKE 'TEST-%' OR batch_number LIKE 'BATCH-%'`);

    // Ensure test medicine exists
    const medRes = await db.query(`SELECT id FROM medicine_master WHERE id = 1`);
    testMedicineId = medRes.rows[0].id;

    // Create a pro_completed consultation & prescription
    const pRes = await db.query(`
      INSERT INTO prescriptions (patient_id, doctor_id, pharmacy_status, branch_id)
      VALUES (1, 1, 'pending', 1) RETURNING id
    `);
    testPrescriptionId = pRes.rows[0].id;

    const piRes = await db.query(`
      INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, dispense_status)
      VALUES ($1, $2, '500 mg', '1-0-1', 'oral', 15, 30, 'pending') RETURNING id
    `, [testPrescriptionId, testMedicineId]);
    testItemId = piRes.rows[0].id;
  });

  // 1. Available stock >= requested quantity -> dispense succeeds
  test('Case 1: Available stock >= requested quantity -> dispense succeeds', async () => {
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-SUFFICIENT-01', '2027-12-31', 50, 1) RETURNING id
    `, [testMedicineId]);
    const stockId = sRes.rows[0].id;

    const res = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pharmacy_status).toBe('dispensed');

    // Verify stock deducted
    const checkStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [stockId]);
    expect(checkStock.rows[0].quantity).toBe(20);
  });

  // 2. Available stock < requested quantity -> dispense rejected
  test('Case 2: Available stock < requested quantity -> dispense rejected', async () => {
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-INSUFFICIENT-01', '2027-12-31', 10, 1) RETURNING id
    `, [testMedicineId]);
    const stockId = sRes.rows[0].id;

    const res = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Insufficient or expired stock/i);

    // Verify stock remained unchanged
    const checkStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [stockId]);
    expect(checkStock.rows[0].quantity).toBe(10);
  });

  // 3. Expired batch -> dispense rejected
  test('Case 3: Expired batch -> dispense rejected', async () => {
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-EXPIRED-01', '2024-01-01', 100, 1) RETURNING id
    `, [testMedicineId]);
    const stockId = sRes.rows[0].id;

    const res = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Insufficient or expired stock/i);
  });

  // 4. Valid future-expiry batch (e.g. BATCH-EXACT-01, 31/12/2027) -> dispense succeeds
  test('Case 4: Valid future-expiry batch (BATCH-EXACT-01, 31/12/2027) with sufficient stock -> dispense succeeds', async () => {
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'BATCH-EXACT-01', '2027-12-31', 40, 1) RETURNING id
    `, [testMedicineId]);
    const stockId = sRes.rows[0].id;

    const res = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [stockId]);
    expect(checkStock.rows[0].quantity).toBe(10);
  });

  // 5. Different branch stock -> cannot be used
  test('Case 5: Different branch stock -> cannot be used', async () => {
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-BRANCH2-01', '2027-12-31', 100, 2) RETURNING id
    `, [testMedicineId]);
    const stockId = sRes.rows[0].id;

    const res = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/branch/i);
  });

  // 6. Wrong medicine batch -> cannot be used
  test('Case 6: Wrong medicine batch -> cannot be used', async () => {
    const otherMed = await db.query(`SELECT id FROM medicine_master WHERE id != $1 LIMIT 1`, [testMedicineId]);
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-WRONG-MED-01', '2027-12-31', 100, 1) RETURNING id
    `, [otherMed.rows[0].id]);
    const stockId = sRes.rows[0].id;

    const res = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/medicine/i);
  });

  // 7. Multiple batches -> FEFO allocation works correctly
  test('Case 7: Multiple batches -> FEFO allocation works correctly in expiry order', async () => {
    await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES
        ($1, 'BATCH-LATER', '2028-06-30', 50, 1),
        ($1, 'BATCH-SOONER', '2027-01-31', 50, 1)
    `, [testMedicineId]);

    const batchesRes = await request(app)
      .get(`/api/v1/pharmacy/medicines/${testMedicineId}/batches`)
      .set('Authorization', `Bearer ${pharmacyToken}`);

    expect(batchesRes.status).toBe(200);
    expect(batchesRes.body.data[0].batch_number).toBe('BATCH-SOONER');
  });

  // 8. Partial stock across multiple valid batches -> allocation works according to existing FEFO rules
  test('Case 8: Partial stock across multiple valid batches -> FEFO allocates across batches', async () => {
    await db.query(`DELETE FROM medicine_stock WHERE medicine_id = $1`, [testMedicineId]);
    const b1 = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'BATCH-PART-1', '2027-03-31', 10, 1) RETURNING id
    `, [testMedicineId]);
    const b2 = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'BATCH-PART-2', '2027-06-30', 25, 1) RETURNING id
    `, [testMedicineId]);

    // Omit stock_id so auto-allocation triggers across valid batches
    const res = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, dispense_quantity: 30 }]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // BATCH-PART-1 should have 0 remaining (10 deducted)
    const checkB1 = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [b1.rows[0].id]);
    expect(checkB1.rows[0].quantity).toBe(0);

    // BATCH-PART-2 should have 10 remaining (20 deducted)
    const checkB2 = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [b2.rows[0].id]);
    expect(checkB2.rows[0].quantity).toBe(5);
  });

  // 9. Stock is deducted exactly once after successful dispensing
  test('Case 9: Stock is deducted exactly once after successful dispensing', async () => {
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-EXACT-ONCE', '2027-12-31', 100, 1) RETURNING id
    `, [testMedicineId]);
    const stockId = sRes.rows[0].id;

    await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });

    const checkStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [stockId]);
    expect(checkStock.rows[0].quantity).toBe(70);

    // Check transactions ledger has exactly one entry
    const txns = await db.query(`SELECT * FROM stock_transactions WHERE batch_number = 'TEST-EXACT-ONCE'`);
    expect(txns.rows.length).toBe(1);
    expect(txns.rows[0].quantity).toBe(-30);
  });

  // 10. Double-clicking Dispense cannot deduct stock twice
  test('Case 10: Double-clicking Dispense cannot deduct stock twice', async () => {
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-DOUBLE-CLICK', '2027-12-31', 100, 1) RETURNING id
    `, [testMedicineId]);
    const stockId = sRes.rows[0].id;

    // First click
    const res1 = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });
    expect(res1.status).toBe(200);

    // Second click immediately after
    const res2 = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });
    expect(res2.status).toBe(400);
    expect(res2.body.message).toMatch(/already been dispensed/i);

    // Verify stock was deducted only once
    const checkStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [stockId]);
    expect(checkStock.rows[0].quantity).toBe(70);
  });

  // 11. Failed dispensing transaction must not partially deduct stock
  test('Case 11: Failed dispensing transaction must not partially deduct stock', async () => {
    // Create 2 items
    const pi2 = await db.query(`
      INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, dispense_status)
      VALUES ($1, $2, '500 mg', '1-0-1', 'oral', 15, 30, 'pending') RETURNING id
    `, [testPrescriptionId, testMedicineId]);
    const item2Id = pi2.rows[0].id;

    // Item 1 has sufficient stock
    const s1 = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-TX-ROLLBACK-1', '2027-12-31', 50, 1) RETURNING id
    `, [testMedicineId]);

    // Item 2 has insufficient stock (only 5 units)
    const s2 = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-TX-ROLLBACK-2', '2027-12-31', 5, 1) RETURNING id
    `, [testMedicineId]);

    const res = await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [
          { item_id: testItemId, stock_id: s1.rows[0].id, dispense_quantity: 30 },
          { item_id: item2Id, stock_id: s2.rows[0].id, dispense_quantity: 30 }
        ]
      });

    expect(res.status).toBe(422);

    // Verify s1 was NOT deducted (atomic rollback)
    const checkS1 = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [s1.rows[0].id]);
    expect(checkS1.rows[0].quantity).toBe(50);
  });

  // 12. Refreshing the prescription after dispensing shows the correct remaining stock/status
  test('Case 12: Refreshing the prescription after dispensing shows correct remaining stock and dispensed status', async () => {
    const sRes = await db.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, 'TEST-REFRESH-01', '2027-12-31', 100, 1) RETURNING id
    `, [testMedicineId]);
    const stockId = sRes.rows[0].id;

    await request(app)
      .post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({
        items: [{ item_id: testItemId, stock_id: stockId, dispense_quantity: 30 }]
      });

    // Refresh prescription via GET process
    const procRes = await request(app)
      .get(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/process`)
      .set('Authorization', `Bearer ${pharmacyToken}`);

    expect(procRes.status).toBe(200);
    expect(procRes.body.data.prescription.pharmacy_status).toBe('dispensed');
    expect(procRes.body.data.items[0].dispensed).toBe(true);
    expect(procRes.body.data.items[0].dispensed_quantity).toBe(30);

    // Refresh stock check
    const chkRes = await request(app)
      .get(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/stock-check`)
      .set('Authorization', `Bearer ${pharmacyToken}`);

    expect(chkRes.status).toBe(200);
    const itemChk = chkRes.body.data.find(c => c.item_id === testItemId);
    expect(itemChk.available_quantity).toBe(70);
  });
});
