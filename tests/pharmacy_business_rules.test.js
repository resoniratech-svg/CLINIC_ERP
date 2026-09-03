const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

describe('Pharmacy Module End-to-End Business Rules Verification', () => {
  let adminToken, doctorToken, proToken, pharmacyToken, receptionistToken;
  let testPatientId, testAppointmentId, testDoctorId, testPrescriptionId, testItemId, testMedicineId, testStockId;

  beforeAll(async () => {
    await seed();

    // Clean up test tables
    await db.query(`
      DELETE FROM medicine_returns;
      DELETE FROM stock_adjustments;
      DELETE FROM prescription_clarifications;
      DELETE FROM stock_import_batches;
      DELETE FROM stock_transactions;
      DELETE FROM prescription_modifications;
      DELETE FROM prescription_items;
      DELETE FROM prescriptions;
      DELETE FROM medicine_stock;
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

    // Logins
    const adminRes = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = adminRes.body.data.token;

    const docRes = await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' });
    doctorToken = docRes.body.data.token;

    const proRes = await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' });
    proToken = proRes.body.data.token;

    const phaRes = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
    pharmacyToken = phaRes.body.data.token;

    const recRes = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
    receptionistToken = recRes.body.data.token;

    // Get doctor_id
    const docQuery = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [docRes.body.data.user.user_id]);
    testDoctorId = docQuery.rows[0].doctor_id;

    // Create test patient
    const pRes = await db.query(`
      INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id)
      VALUES ('Pharmacy Test Patient', '9777766661', 35, 'male', 'Hyderabad', 1)
      RETURNING patient_id
    `);
    testPatientId = pRes.rows[0].patient_id;

    // Create test medicine
    const medRes = await request(app).post('/api/v1/pharmacy/medicines').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', medicine_type: 'capsule', strength: '500 mg', unit: 'capsules', category: 'Antibiotic', reorder_level: 10
    });
    testMedicineId = medRes.body.data.id;

    // Add initial valid stock
    const stockRes = await request(app).post('/api/v1/pharmacy/stock').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_id: testMedicineId, batch_number: 'BATCH-VALID-01', manufacture_date: '2026-01-01', expiry_date: '2027-12-31', quantity: 100
    });
    testStockId = stockRes.body.data.id;
  });

  afterAll(async () => {
    await db.pool.end();
  });

  test('Rule 1: Every new table carries branch_id = 1 and branch-creation is absent', async () => {
    const adjRes = await request(app).post('/api/v1/pharmacy/stock/adjustments').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_id: testMedicineId, stock_id: testStockId, physical_quantity: 95, reason: 'stock_count_correction'
    });
    expect(adjRes.status).toBe(201);
    expect(adjRes.body.data.branch_id).toBe(1);

    const retRes = await request(app).post('/api/v1/pharmacy/returns').set('Authorization', `Bearer ${pharmacyToken}`).send({
      patient_id: testPatientId, medicine_id: testMedicineId, stock_id: testStockId, return_quantity: 2, return_reason: 'Unused', condition: 'good'
    });
    expect(retRes.status).toBe(201);
    expect(retRes.body.data.branch_id).toBe(1);
  });

  test('Rule 2: Prescriptions not pro_completed do not appear in queue or process endpoint', async () => {
    // Book appointment & start consultation
    const apptRes = await request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: testPatientId, doctor_id: testDoctorId, appointment_type: 'new', appointment_date: '2026-09-03', appointment_time: '10:00'
    });
    testAppointmentId = apptRes.body.data.appointment_id;

    await request(app).post('/api/v1/receptionist/checkin').set('Authorization', `Bearer ${receptionistToken}`).send({ appointment_id: testAppointmentId });

    // Doctor consultation & prescription
    const startRes = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: testAppointmentId });
    const consultId = startRes.body.data.consultation_id;
    
    // Save chief complaint & primary diagnosis
    await request(app).put(`/api/v1/doctor/consultations/${consultId}`).set('Authorization', `Bearer ${doctorToken}`).send({
      chief_complaint: 'High fever and cold',
      primary_diagnosis_text: 'Acute Viral Infection'
    });

    const rxRes = await request(app).post('/api/v1/doctor/prescriptions').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: consultId,
      medicines: [{ medicine_id: testMedicineId, dosage: '500 mg', frequency: '2/day', duration_days: 5, quantity: 10 }]
    });
    testPrescriptionId = rxRes.body.data.prescription.id;
    testItemId = rxRes.body.data.items[0].id;

    await request(app).post(`/api/v1/doctor/consultations/${consultId}/complete`).set('Authorization', `Bearer ${doctorToken}`).send({});

    // Attempt Pharmacy Queue at doctor_completed status (PRO not completed yet)
    const queueRes = await request(app).get('/api/v1/pharmacy/queue').set('Authorization', `Bearer ${pharmacyToken}`);
    expect(queueRes.status).toBe(200);
    const inQueue = queueRes.body.data.find(q => q.prescription_id === testPrescriptionId);
    expect(inQueue).toBeUndefined();

    // Attempt Process Prescription at doctor_completed status
    const processRes = await request(app).get(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/process`).set('Authorization', `Bearer ${pharmacyToken}`);
    expect(processRes.status).toBe(403);
    expect(processRes.body.message).toMatch(/prior to PRO completed status/i);

    // Now complete PRO stage
    await request(app).post('/api/v1/pro/counselling').set('Authorization', `Bearer ${proToken}`).send({
      patient_id: testPatientId, counselling_type: 'treatment', notes: 'Explained treatment', patient_understanding: 'good'
    });
    const billRes = await request(app).post('/api/v1/pro/bills').set('Authorization', `Bearer ${proToken}`).send({
      patient_id: testPatientId, bill_type: 'treatment', items: [{ charge_type: 'Treatment', amount: 1000 }]
    });
    await request(app).post('/api/v1/pro/payments').set('Authorization', `Bearer ${proToken}`).send({
      bill_id: billRes.body.data.bill_id, patient_id: testPatientId, payment_method: 'cash', amount: 1000
    });
    const proCompRes = await request(app).post(`/api/v1/pro/patients/${testPatientId}/complete-pro`).set('Authorization', `Bearer ${proToken}`).send({});

    // Verify now visible in queue & processable
    const queueRes2 = await request(app).get('/api/v1/pharmacy/queue').set('Authorization', `Bearer ${pharmacyToken}`);
    expect(queueRes2.status).toBe(200);
    const inQueue2 = queueRes2.body.data.find(q => q.prescription_id === testPrescriptionId);
    expect(inQueue2).toBeDefined();

    const processRes2 = await request(app).get(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/process`).set('Authorization', `Bearer ${pharmacyToken}`);
    expect(processRes2.status).toBe(200);
    expect(processRes2.body.data.prescription.pharmacy_status).toBe('processing');
  });

  test('Rule 3: Pharmacy prohibited actions return 403', async () => {
    const regRes = await request(app).post('/api/v1/pharmacy/patients/register').set('Authorization', `Bearer ${pharmacyToken}`).send({});
    expect(regRes.status).toBe(403);

    const consultRes = await request(app).post('/api/v1/pharmacy/consultations').set('Authorization', `Bearer ${pharmacyToken}`).send({});
    expect(consultRes.status).toBe(403);

    const billRes = await request(app).post('/api/v1/pharmacy/billing').set('Authorization', `Bearer ${pharmacyToken}`).send({});
    expect(billRes.status).toBe(403);

    const payRes = await request(app).post('/api/v1/pharmacy/payments').set('Authorization', `Bearer ${pharmacyToken}`).send({});
    expect(payRes.status).toBe(403);
  });

  test('Rule 4: Modify duration_days recalculates quantity server-side from frequency × days', async () => {
    const modRes = await request(app).post(`/api/v1/pharmacy/prescriptions/items/${testItemId}/modify-days`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      modified_days: 7, reason: 'Patient requested extended course'
    });
    expect(modRes.status).toBe(200);
    expect(modRes.body.data.updated_item.duration_days).toBe(7);
    expect(modRes.body.data.updated_item.quantity).toBe(14); // 2/day * 7 = 14

    // Audit trail verification
    const auditRes = await request(app).get(`/api/v1/pharmacy/prescriptions/items/${testItemId}/modifications`).set('Authorization', `Bearer ${pharmacyToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
    expect(auditRes.body.data[0].modifier_role).toBe('pharmacy');
  });

  test('Rule 5: Attempted clinical modification by Pharmacy returns 403', async () => {
    const medMod = await request(app).post(`/api/v1/pharmacy/prescriptions/items/${testItemId}/modify-medicine`).set('Authorization', `Bearer ${pharmacyToken}`).send({});
    expect(medMod.status).toBe(403);

    const dosMod = await request(app).post(`/api/v1/pharmacy/prescriptions/items/${testItemId}/modify-dosage`).set('Authorization', `Bearer ${pharmacyToken}`).send({});
    expect(dosMod.status).toBe(403);

    const freqMod = await request(app).post(`/api/v1/pharmacy/prescriptions/items/${testItemId}/modify-frequency`).set('Authorization', `Bearer ${pharmacyToken}`).send({});
    expect(freqMod.status).toBe(403);
  });

  test('Rule 6: Stock check excludes expired batches and computes availability correctly', async () => {
    // Add an expired batch for test medicine
    await request(app).post('/api/v1/pharmacy/stock').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_id: testMedicineId, batch_number: 'BATCH-EXPIRED-99', manufacture_date: '2024-01-01', expiry_date: '2025-01-01', quantity: 50
    });

    const checkRes = await request(app).get(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/stock-check`).set('Authorization', `Bearer ${pharmacyToken}`);
    expect(checkRes.status).toBe(200);
    const itemCheck = checkRes.body.data.find(c => c.item_id === testItemId);
    expect(itemCheck).toBeDefined();
    expect(itemCheck.available_quantity).toBeGreaterThanOrEqual(95); // Excludes the 50 expired items
    expect(itemCheck.status).toBe('available');
  });

  test('Rule 7: Batch selection rejects expired or zero-quantity batch with 422', async () => {
    // Create zero-qty batch
    const zStock = await request(app).post('/api/v1/pharmacy/stock').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_id: testMedicineId, batch_number: 'BATCH-ZERO-00', manufacture_date: '2026-01-01', expiry_date: '2027-12-31', quantity: 0
    });

    const selRes = await request(app).put(`/api/v1/pharmacy/prescriptions/items/${testItemId}/select-batch`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      stock_id: zStock.body.data.id
    });
    expect(selRes.status).toBe(422);
    expect(selRes.body.message).toMatch(/expired or zero-quantity/i);
  });

  test('Rule 8: FEFO batch ordering returns earliest-expiring usable batch first', async () => {
    await request(app).post('/api/v1/pharmacy/stock').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_id: testMedicineId, batch_number: 'BATCH-SOONER-02', manufacture_date: '2026-01-01', expiry_date: '2026-11-30', quantity: 20
    });

    const batchesRes = await request(app).get(`/api/v1/pharmacy/medicines/${testMedicineId}/batches`).set('Authorization', `Bearer ${pharmacyToken}`);
    expect(batchesRes.status).toBe(200);
    expect(batchesRes.body.data[0].batch_number).toBe('BATCH-SOONER-02'); // Nov 2026 comes before Dec 2027
  });

  test('Rule 9: Save draft dispense does not deduct stock', async () => {
    const initialStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [testStockId]);
    const initQty = initialStock.rows[0].quantity;

    const draftRes = await request(app).post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/draft`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      items: [{ item_id: testItemId, stock_id: testStockId, dispense_quantity: 14 }]
    });
    expect(draftRes.status).toBe(200);

    const postStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [testStockId]);
    expect(postStock.rows[0].quantity).toBe(initQty); // Unchanged
  });

  test('Rule 10: Complete dispensing deducts stock, logs transaction, and updates item & Rx status', async () => {
    const completeRes = await request(app).post(`/api/v1/pharmacy/prescriptions/${testPrescriptionId}/dispense/complete`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      items: [{ item_id: testItemId, stock_id: testStockId, dispense_quantity: 14 }]
    });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.pharmacy_status).toBe('dispensed');

    // Verify stock transaction
    const txnRes = await request(app).get('/api/v1/pharmacy/stock/transactions').set('Authorization', `Bearer ${pharmacyToken}`).query({ medicine_id: testMedicineId });
    expect(txnRes.status).toBe(200);
    const outTxn = txnRes.body.data.find(t => t.transaction_type === 'out');
    expect(outTxn).toBeDefined();
  });

  test('Rule 11: Concurrency protection — simultaneous complete dispense against limited stock', async () => {
    // Create new drug with exact stock 10
    const mRes = await request(app).post('/api/v1/pharmacy/medicines').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_name: 'Concurrent Drug 100mg', strength: '100 mg', unit: 'tabs', reorder_level: 5
    });
    const mId = mRes.body.data.id;

    const sRes = await request(app).post('/api/v1/pharmacy/stock').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_id: mId, batch_number: 'CONC-BATCH-01', expiry_date: '2027-12-31', quantity: 10
    });
    const sId = sRes.body.data.id;

    // Create 2 prescriptions requesting 8 each (total 16 > 10)
    const apptRes = await request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: testPatientId, doctor_id: testDoctorId, appointment_type: 'new', appointment_date: '2026-09-03', appointment_time: '11:45'
    });
    const aId = apptRes.body.data.appointment_id;

    await request(app).post('/api/v1/receptionist/checkin').set('Authorization', `Bearer ${receptionistToken}`).send({ appointment_id: aId });
    const c1 = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: aId });
    
    const rx1 = await request(app).post('/api/v1/doctor/prescriptions').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: c1.body.data.consultation_id,
      medicines: [{ medicine_id: mId, dosage: '100 mg', quantity: 8 }]
    });

    const c2Appt = await request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: testPatientId, doctor_id: testDoctorId, appointment_type: 'new', appointment_date: '2026-09-03', appointment_time: '11:50'
    });
    const aId2 = c2Appt.body.data.appointment_id;
    await request(app).post('/api/v1/receptionist/checkin').set('Authorization', `Bearer ${receptionistToken}`).send({ appointment_id: aId2 });
    const c2 = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: aId2 });
    const rx2 = await request(app).post('/api/v1/doctor/prescriptions').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: c2.body.data.consultation_id,
      medicines: [{ medicine_id: mId, dosage: '100 mg', quantity: 8 }]
    });

    await request(app).post(`/api/v1/doctor/consultations/${aId}/complete`).set('Authorization', `Bearer ${doctorToken}`).send({});
    await request(app).post(`/api/v1/pro/patients/${testPatientId}/complete-pro`).set('Authorization', `Bearer ${proToken}`).send({});

    // Concurrent complete requests
    const [res1, res2] = await Promise.all([
      request(app).post(`/api/v1/pharmacy/prescriptions/${rx1.body.data.prescription.id}/dispense/complete`).set('Authorization', `Bearer ${pharmacyToken}`).send({
        items: [{ item_id: rx1.body.data.items[0].id, stock_id: sId, dispense_quantity: 8 }]
      }),
      request(app).post(`/api/v1/pharmacy/prescriptions/${rx2.body.data.prescription.id}/dispense/complete`).set('Authorization', `Bearer ${pharmacyToken}`).send({
        items: [{ item_id: rx2.body.data.items[0].id, stock_id: sId, dispense_quantity: 8 }]
      })
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(422); // Exactly one succeeded, one failed due to row lock and stock check
  });

  test('Rule 12: Prescription status becomes dispensed when all items done, partially_dispensed when partial', async () => {
    // Create rx with 2 items
    const apptRes = await request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: testPatientId, doctor_id: testDoctorId, appointment_type: 'new', appointment_date: '2026-09-03', appointment_time: '12:00'
    });
    const aId = apptRes.body.data.appointment_id;

    await request(app).post('/api/v1/receptionist/checkin').set('Authorization', `Bearer ${receptionistToken}`).send({ appointment_id: aId });
    const cRes = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: aId });
    
    const rxRes = await request(app).post('/api/v1/doctor/prescriptions').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: cRes.body.data.consultation_id,
      medicines: [
        { medicine_id: testMedicineId, dosage: '500 mg', quantity: 5 },
        { medicine_id: testMedicineId, dosage: '500 mg', quantity: 5 }
      ]
    });
    const rxId = rxRes.body.data.prescription.id;
    const item1 = rxRes.body.data.items[0].id;

    await request(app).post(`/api/v1/doctor/consultations/${aId}/complete`).set('Authorization', `Bearer ${doctorToken}`).send({});
    await request(app).post(`/api/v1/pro/patients/${testPatientId}/complete-pro`).set('Authorization', `Bearer ${proToken}`).send({});

    // Dispense item 1 only
    const partialRes = await request(app).post(`/api/v1/pharmacy/prescriptions/${rxId}/dispense/complete`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      items: [{ item_id: item1, stock_id: testStockId, dispense_quantity: 5 }]
    });
    expect(partialRes.status).toBe(200);
    expect(partialRes.body.data.pharmacy_status).toBe('partially_dispensed');
  });

  test('Rule 13: Hold/unavailable status on item preserves original prescribed fields', async () => {
    const itemRes = await request(app).put(`/api/v1/pharmacy/prescriptions/items/${testItemId}/status`).set('Authorization', `Bearer ${pharmacyToken}`).send({
      dispense_status: 'on_hold', hold_reason: 'Waiting for stock arrival'
    });
    expect(itemRes.status).toBe(200);
    expect(itemRes.body.data.dispense_status).toBe('on_hold');
    expect(itemRes.body.data.medicine_id).toBe(testMedicineId); // Original preserved
  });

  test('Rule 14 & 15: Excel stock import preview, validation, and confirmation matching logic', async () => {
    const previewRes = await request(app).post('/api/v1/pharmacy/stock/import/preview').set('Authorization', `Bearer ${pharmacyToken}`).send({
      rows: [
        { 'Medicine Name': 'Amoxicillin 500mg', 'Potency': '500 mg', 'Batch Number': 'BATCH-VALID-01', 'Manufacture Date': '2026-01-01', 'Expiry Date': '2027-12-31', 'Quantity': 50 },
        { 'Medicine Name': 'New Excel Drug 250mg', 'Potency': '250 mg', 'Batch Number': 'NEW-BATCH-01', 'Manufacture Date': '2026-01-01', 'Expiry Date': '2027-12-31', 'Quantity': 30 },
        { 'Medicine Name': '', 'Batch Number': 'INVALID-01', 'Expiry Date': '2027-12-31', 'Quantity': 10 }, // Invalid: missing name
        { 'Medicine Name': 'Invalid Date Drug', 'Batch Number': 'INVALID-02', 'Manufacture Date': '2027-01-01', 'Expiry Date': '2026-01-01', 'Quantity': 10 } // Invalid: expiry before mfg
      ]
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.total_rows).toBe(4);
    expect(previewRes.body.data.valid_rows).toBe(2);
    expect(previewRes.body.data.invalid_rows).toBe(2);
    expect(previewRes.body.data.failed_rows_report.length).toBe(2);

    // Confirm import
    const confirmRes = await request(app).post('/api/v1/pharmacy/stock/import/confirm').set('Authorization', `Bearer ${pharmacyToken}`).send({
      file_name: 'test_stock.xlsx',
      rows: [
        { 'Medicine Name': 'Amoxicillin 500mg', 'Potency': '500 mg', 'Batch Number': 'BATCH-VALID-01', 'Manufacture Date': '2026-01-01', 'Expiry Date': '2027-12-31', 'Quantity': 50 },
        { 'Medicine Name': 'New Excel Drug 250mg', 'Potency': '250 mg', 'Batch Number': 'NEW-BATCH-01', 'Manufacture Date': '2026-01-01', 'Expiry Date': '2027-12-31', 'Quantity': 30 }
      ]
    });
    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.data.new_medicines_created).toBe(1);
    expect(confirmRes.body.data.existing_stock_updated).toBe(1);
  });

  test('Rule 16: Stock adjustment threshold approval workflow', async () => {
    const curStockRes = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [testStockId]);
    const curQty = curStockRes.rows[0].quantity;
    const smallPhysQty = curQty + 4; // diff +4 <= 10 -> Auto-applies

    const smallAdj = await request(app).post('/api/v1/pharmacy/stock/adjustments').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_id: testMedicineId, stock_id: testStockId, physical_quantity: smallPhysQty, reason: 'stock_count_correction'
    });
    expect(smallAdj.status).toBe(201);
    expect(smallAdj.body.data.requires_approval).toBe(false);
    expect(smallAdj.body.data.approval_status).toBe('approved');

    // Large adjustment > 10 (threshold) -> Pending Super Admin approval
    const largeAdj = await request(app).post('/api/v1/pharmacy/stock/adjustments').set('Authorization', `Bearer ${pharmacyToken}`).send({
      medicine_id: testMedicineId, stock_id: testStockId, physical_quantity: 50, reason: 'damage'
    });
    expect(largeAdj.status).toBe(201);
    expect(largeAdj.body.data.requires_approval).toBe(true);
    expect(largeAdj.body.data.approval_status).toBe('pending');

    // Super Admin approves
    const approveRes = await request(app).post(`/api/v1/pharmacy/stock/adjustments/${largeAdj.body.data.id}/approve`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.approval_status).toBe('approved');
  });

  test('Rule 17: Medicine returns restocking logic (good vs damaged)', async () => {
    const initStockRes = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [testStockId]);
    const initQty = initStockRes.rows[0].quantity;

    // Good condition return -> Restocked
    const goodRet = await request(app).post('/api/v1/pharmacy/returns').set('Authorization', `Bearer ${pharmacyToken}`).send({
      patient_id: testPatientId, medicine_id: testMedicineId, stock_id: testStockId, return_quantity: 5, return_reason: 'Patient changed mind', condition: 'good'
    });
    expect(goodRet.status).toBe(201);
    expect(goodRet.body.data.restocked).toBe(true);

    const postGoodStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [testStockId]);
    expect(postGoodStock.rows[0].quantity).toBe(initQty + 5);

    // Damaged condition return -> Not restocked
    const damRet = await request(app).post('/api/v1/pharmacy/returns').set('Authorization', `Bearer ${pharmacyToken}`).send({
      patient_id: testPatientId, medicine_id: testMedicineId, stock_id: testStockId, return_quantity: 3, return_reason: 'Broken bottle', condition: 'damaged'
    });
    expect(damRet.status).toBe(201);
    expect(damRet.body.data.restocked).toBe(false);

    const postDamStock = await db.query(`SELECT quantity FROM medicine_stock WHERE id = $1`, [testStockId]);
    expect(postDamStock.rows[0].quantity).toBe(initQty + 5); // Unchanged
  });

  test('Rule 18: RBAC isolation for Pharmacy and non-Pharmacy endpoints', async () => {
    // Non-pharmacy roles blocked from Pharmacy endpoints
    const docCall = await request(app).get('/api/v1/pharmacy/dashboard').set('Authorization', `Bearer ${doctorToken}`);
    expect(docCall.status).toBe(403);

    const recCall = await request(app).get('/api/v1/pharmacy/stock').set('Authorization', `Bearer ${receptionistToken}`);
    expect(recCall.status).toBe(403);

    // Pharmacy blocked from Doctor consultation completion
    const phaDoctorCall = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${pharmacyToken}`).send({});
    expect(phaDoctorCall.status).toBe(403);
  });

  test('Rule 19: Audit logging for mutating Pharmacy actions', async () => {
    const auditRes = await request(app).get('/api/v1/logs/audit').set('Authorization', `Bearer ${adminToken}`).query({ module: 'Pharmacy Stock' });
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
    expect(auditRes.body.data[0].role).toBe('pharmacy');
  });

  test('Rule 20: Login/logout logging with computed session duration', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
    const tempToken = loginRes.body.data.token;

    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${tempToken}`).send({});
    expect(logoutRes.status).toBe(200);

    const loginLogsRes = await request(app).get('/api/v1/logs/login').set('Authorization', `Bearer ${adminToken}`);
    expect(loginLogsRes.status).toBe(200);
    const phaLog = loginLogsRes.body.data.find(l => l.role === 'pharmacy' && l.logout_time !== null);
    expect(phaLog).toBeDefined();
    expect(phaLog.session_duration_seconds).toBeGreaterThanOrEqual(0);
  });
});
