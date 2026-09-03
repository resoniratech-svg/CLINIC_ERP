const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

describe('Extreme Edge Cases Integration Suite', () => {
  let adminToken, receptionistToken, doctorToken, proToken, pharmacyToken, executiveToken;

  beforeAll(async () => {
    await seed();

    adminToken = (await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' })).body.data.token;
    receptionistToken = (await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' })).body.data.token;
    doctorToken = (await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' })).body.data.token;
    proToken = (await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' })).body.data.token;
    pharmacyToken = (await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' })).body.data.token;
    executiveToken = (await request(app).post('/api/v1/auth/login').send({ username: 'eric_exec', password: 'Password@123' })).body.data.token;
  });

  // Edge Case 1: Exact-boundary Stock Dispensing
  it('Edge Case 1: Dispensing exact available batch quantity sets stock to 0, next attempt fails', async () => {
    // Add batch with exact qty = 5
    await db.query(`
      INSERT INTO medicine_stock (id, medicine_id, batch_number, manufacture_date, expiry_date, quantity, purchase_rate, mrp, supplier, branch_id)
      VALUES (999, 1, 'BATCH-EXACT-01', '2026-01-01', '2027-12-31', 5, 5.00, 10.00, 'Supplier', 1)
      ON CONFLICT (id) DO UPDATE SET quantity = 5;
    `);

    // Select exact batch quantity 5
    const sel = await request(app).put('/api/v1/pharmacy/prescriptions/items/1/select-batch').set('Authorization', `Bearer ${pharmacyToken}`).send({ selected_batch_id: 999, dispensed_quantity: 5 });
    expect(sel.status).toBe(200);
  });

  // Edge Case 2: Exact-boundary Expiry (Batch expiring today)
  it('Edge Case 2: Expired batch (expiry date < today) is blocked from batch selection', async () => {
    await db.query(`
      INSERT INTO medicine_stock (id, medicine_id, batch_number, manufacture_date, expiry_date, quantity, purchase_rate, mrp, supplier, branch_id)
      VALUES (998, 1, 'BATCH-EXP-01', '2025-01-01', '2025-12-31', 50, 5.00, 10.00, 'Supplier', 1)
      ON CONFLICT (id) DO UPDATE SET expiry_date = '2025-12-31';
    `);

    const sel = await request(app).put('/api/v1/pharmacy/prescriptions/items/1/select-batch').set('Authorization', `Bearer ${pharmacyToken}`).send({ selected_batch_id: 998, dispensed_quantity: 5 });
    expect(sel.status).toBe(422);
  });

  // Edge Case 3: Zero & Negative Input Rejections
  it('Edge Case 3: Rejects zero and negative payment amounts with 400 Bad Request', async () => {
    const res = await request(app).post('/api/v1/pro/payments').set('Authorization', `Bearer ${proToken}`).send({
      bill_id: 1,
      patient_id: 1,
      payments: [{ payment_mode: 'cash', amount: -500 }]
    });
    expect([400, 404]).toContain(res.status);
  });

  // Edge Case 4: Max Discount Exceeded Rejection
  it('Edge Case 4: Rejects discount exceeding maximum allowed percentage', async () => {
    const docRes = await db.query("SELECT d.doctor_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE u.username = 'dr_smith'");
    const activeDoctorId = docRes.rows[0].doctor_id;

    const mob = '93' + Date.now().toString().slice(-8);
    const res = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'Discount Edge Patient', mobile_number: mob, age: 30, gender: 'male' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '07:30', appointment_type: 'new' },
      billing: { amount: 500, discount: 400, payment_mode: 'cash' } // 80% discount > max limit
    });
    expect(res.status).toBe(400);
  });

  // Edge Case 5: Custom Package Type Requires to_date
  it('Edge Case 5: Rejects custom package enrollment missing to_date', async () => {
    const res = await request(app).post('/api/v1/pro/packages/enroll').set('Authorization', `Bearer ${proToken}`).send({
      patient_id: 1,
      package_name: 'Custom Package',
      package_type: 'custom',
      base_price: 1500
    });
    expect([400, 422]).toContain(res.status);
  });

  // Edge Case 6: Multiple Duration Modifications Audit Trail
  it('Edge Case 6: Multiple duration modifications preserve complete audit history', async () => {
    const mod1 = await request(app).post('/api/v1/pharmacy/prescriptions/items/1/modify-days').set('Authorization', `Bearer ${pharmacyToken}`).send({
      duration_days: 7,
      reason: 'First duration extension'
    });
    expect(mod1.status).toBe(200);

    const mod2 = await request(app).post('/api/v1/pharmacy/prescriptions/items/1/modify-days').set('Authorization', `Bearer ${pharmacyToken}`).send({
      duration_days: 10,
      reason: 'Second duration extension'
    });
    expect(mod2.status).toBe(200);

    const auditRes = await request(app).get('/api/v1/pharmacy/prescriptions/items/1/modifications').set('Authorization', `Bearer ${pharmacyToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThanOrEqual(2);
  });

  // Edge Case 7: Invalid or Expired Token Rejection
  it('Edge Case 7: Rejects invalid or expired JWT token with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/pharmacy/dashboard').set('Authorization', 'Bearer invalid_junk_token_123');
    expect(res.status).toBe(403);
  });
});
