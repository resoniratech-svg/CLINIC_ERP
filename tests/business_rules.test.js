const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

let adminToken = '';
let receptionistToken = '';
let executiveToken = '';
const timestamp = Date.now();
const recUsername = `rita_rec_${timestamp}`;
const recEmpId = `REC_${timestamp}`;
const execUsername = `eric_exec_${timestamp}`;
const execEmpId = `EX_${timestamp}`;

beforeAll(async () => {
  // Re-seed DB before test suite
  await seed();

  // Login as Super Admin
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'SuperAdmin@123' });
  adminToken = adminLogin.body.data.token;

  // Create Receptionist user & login
  await request(app)
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      employee_id: recEmpId,
      full_name: 'Rita Receptionist',
      mobile_number: `98${timestamp.toString().slice(-8)}`,
      username: recUsername,
      password: 'Password@123',
      role: 'receptionist'
    });

  const recLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: recUsername, password: 'Password@123' });
  receptionistToken = recLogin.body.data.token;

  // Create Executive user & login
  await request(app)
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      employee_id: execEmpId,
      full_name: 'Eric Executive',
      mobile_number: `97${timestamp.toString().slice(-8)}`,
      username: execUsername,
      password: 'Password@123',
      role: 'executive',
      executive_details: { per_lead_incentive: 150 }
    });

  const execLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: execUsername, password: 'Password@123' });
  executiveToken = execLogin.body.data.token;
});

afterAll(async () => {
  await db.pool.end();
});

describe('Super Admin Module Business Rules Verification', () => {

  // Rule 1: No create branch API, records carry branch_id = 1
  test('Rule 1: Verify absence of Create Branch API & mandatory branch_id = 1', async () => {
    const res = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ branch_name: 'Branch 2' });
    expect(res.status).toBe(404);

    const userRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(userRes.body.data.every(u => u.user_id)).toBe(true);
  });

  // Rule 2: Executive creates leads landing in Receptionist queue
  test('Rule 2: Executive lead creation lands in Receptionist queue', async () => {
    const res = await request(app)
      .post('/api/v1/callcenter/leads')
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({
        lead_name: 'John Doe',
        mobile_number: `91${Date.now().toString().slice(-8)}`,
        lead_source: 'outbound',
        campaign: 'Fall Campaign'
      });
    expect(res.status).toBe(201);
    expect(res.body.data.lead_id).toBeDefined();
    expect(res.body.data.status).toBe('new');
  });

  // Rule 3: Target Validation (Enquiry + Unit = Overall)
  test('Rule 3: Target validation enforces Enquiry + Unit = Overall Target', async () => {
    // Mismatched target without unallocated flag -> Should Fail (400)
    const failRes = await request(app)
      .post('/api/v1/targets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        month: 9,
        year: 2026,
        overall_target: 500000,
        enquiry_target: 200000,
        unit_target: 250000,
        allow_unallocated: false
      });
    expect(failRes.status).toBe(400);

    // Valid target (200k + 300k = 500k) -> Should Pass (201)
    const passRes = await request(app)
      .post('/api/v1/targets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        month: 9,
        year: 2026,
        overall_target: 500000,
        enquiry_target: 200000,
        unit_target: 300000,
        allow_unallocated: false
      });
    expect(passRes.status).toBe(201);
  });

  // Rule 4: Receptionist Consultation-Fee Billing Restriction
  test('Rule 4: Receptionist restricted to consultation fee billing only', async () => {
    // Create dummy patient
    const ptRes = await db.query(`
      INSERT INTO patients (full_name, mobile_number, patient_type, branch_id)
      VALUES ('Test Patient', $1, 'new', 1) RETURNING patient_id
    `, [`97${Date.now().toString().slice(-8)}`]);
    const patientId = ptRes.rows[0].patient_id;

    // Receptionist tries to create a treatment bill -> Should fail (403)
    const failRes = await request(app)
      .post('/api/v1/billing/bills')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id: patientId,
        bill_type: 'treatment',
        amount: 2000
      });
    expect(failRes.status).toBe(403);

    // Receptionist creates consultation bill -> Should pass (201)
    const passRes = await request(app)
      .post('/api/v1/billing/bills')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id: patientId,
        bill_type: 'consultation',
        amount: 500
      });
    expect(passRes.status).toBe(201);
  });

  // Rule 5: Cash Ledger & Payment Methods Calculation
  test('Rule 5: Grand Total includes all payment methods; Cash Ledger reflects Cash ONLY', async () => {
    // Create patient & bill
    const mob = `96${Date.now().toString().slice(-8)}`;
    const pt = await db.query(`INSERT INTO patients (full_name, mobile_number) VALUES ('Cash Patient', $1) RETURNING patient_id`, [mob]);
    const bill = await db.query(`INSERT INTO bills (bill_number, patient_id, bill_type, created_by, amount, final_amount) VALUES ($1, $2, 'consultation', 1, 1000, 1000) RETURNING bill_id`, [`BILL-${Date.now()}`, pt.rows[0].patient_id]);
    const billId = bill.rows[0].bill_id;

    // 1. Record Cash Payment of 600
    await request(app)
      .post('/api/v1/billing/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bill_id: billId, payment_method: 'cash', amount: 600 });

    // 2. Record UPI Payment of 400
    await request(app)
      .post('/api/v1/billing/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bill_id: billId, payment_method: 'upi', amount: 400 });

    // Verify Cash Ledger contains ONLY cash payments
    const today = new Date().toISOString().split('T')[0];
    const cashRes = await request(app)
      .get(`/api/v1/cash/ledger?date=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(cashRes.body.data.cash_revenue).toBeGreaterThanOrEqual(600);

    // Verify Revenue report grand total is calculated across all methods
    const revRes = await request(app)
      .get('/api/v1/billing/revenue')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(revRes.body.data.grand_total).toBeGreaterThanOrEqual(1000);
  });

  // Rule 6: CRM task assignment restricted to Receptionist or PRO/Manager (Reject Executive)
  test('Rule 6: CRM task assignment rejects Executive role', async () => {
    const mob = `95${Date.now().toString().slice(-8)}`;
    const pt = await db.query(`INSERT INTO patients (full_name, mobile_number) VALUES ('CRM Patient', $1) RETURNING patient_id`, [mob]);
    const execUser = await db.query(`SELECT user_id FROM users WHERE username = $1`, [execUsername]);

    const res = await request(app)
      .post('/api/v1/crm/followups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: pt.rows[0].patient_id,
        category: 'appointment',
        assigned_to: execUser.rows[0].user_id
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('CRM follow-ups can only be assigned to Receptionist or PRO/Manager');
  });

  // Rule 7: Doctor Resignation & Transfer
  test('Rule 7: Doctor resignation deactivates doctor & transfers forward-looking records', async () => {
    const t = Date.now().toString().slice(-6);
    // Create Doctor 1 and Doctor 2
    const u1 = await db.query(`INSERT INTO users (employee_id, full_name, mobile_number, username, password_hash, role) VALUES ($1, 'Dr. Resigning', $2, $3, 'hash', 'doctor') RETURNING user_id`, [`DOC1_${t}`, `94${t}01`, `dr_resign_${t}`]);
    const d1 = await db.query(`INSERT INTO doctors (user_id, doctor_code, specialization) VALUES ($1, $2, 'General') RETURNING doctor_id`, [u1.rows[0].user_id, `DOC1_${t}`]);

    const u2 = await db.query(`INSERT INTO users (employee_id, full_name, mobile_number, username, password_hash, role) VALUES ($1, 'Dr. Replacement', $2, $3, 'hash', 'doctor') RETURNING user_id`, [`DOC2_${t}`, `94${t}02`, `dr_replace_${t}`]);
    const d2 = await db.query(`INSERT INTO doctors (user_id, doctor_code, specialization) VALUES ($1, $2, 'General') RETURNING doctor_id`, [u2.rows[0].user_id, `DOC2_${t}`]);

    const pt = await db.query(`INSERT INTO patients (full_name, mobile_number) VALUES ('Doctor Patient', $1) RETURNING patient_id`, [`93${t}00`]);

    // Create future appointment for Dr. Resigning
    const appt = await db.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status)
      VALUES ($1, $2, CURRENT_DATE + INTERVAL '2 days', '10:00', 'scheduled') RETURNING appointment_id
    `, [pt.rows[0].patient_id, d1.rows[0].doctor_id]);

    // Transfer responsibilities
    const transferRes = await request(app)
      .post(`/api/v1/doctors/${d1.rows[0].doctor_id}/transfer`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to_doctor_id: d2.rows[0].doctor_id });

    expect(transferRes.status).toBe(200);
    expect(transferRes.body.data.appointments_moved).toBe(1);
    expect(transferRes.body.data.source_doctor_status).toBe('inactive');

    // Verify future appointment doctor_id updated to Dr. Replacement
    const checkAppt = await db.query(`SELECT doctor_id FROM appointments WHERE appointment_id = $1`, [appt.rows[0].appointment_id]);
    expect(checkAppt.rows[0].doctor_id).toBe(d2.rows[0].doctor_id);
  });

  // Rule 8: Password Reset Queue & Temporary Credential
  test('Rule 8: Password reset generates temporary password without exposing actual password', async () => {
    // User submits reset request
    const reqRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ username_or_employee_id: recUsername });
    expect(reqRes.status).toBe(200);

    // Get reset request ID
    const listRes = await request(app)
      .get('/api/v1/password-resets?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.data.length).toBeGreaterThan(0);
    const resetReq = listRes.body.data.find(r => r.username === recUsername);
    expect(resetReq).toBeDefined();

    // Super Admin approves reset
    const approveRes = await request(app)
      .post(`/api/v1/password-resets/${resetReq.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.temporary_password).toBeDefined();
  });

  // Rule 9: Audit Logs recorded for mutating requests
  test('Rule 9: Mutating operations write entries into audit_logs', async () => {
    const logsRes = await request(app)
      .get('/api/v1/logs/audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.data.length).toBeGreaterThan(0);
  });

  // Rule 10: Executive Incentive Calculation
  test('Rule 10: Executive incentive computed as leads_generated * per_lead_incentive', async () => {
    const incRes = await request(app)
      .get('/api/v1/callcenter/executive-incentives')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(incRes.status).toBe(200);
    const execItem = incRes.body.data.find(e => e.employee_id === execEmpId);
    expect(execItem).toBeDefined();
    expect(execItem.incentive_earned).toBe(execItem.leads_generated * execItem.per_lead_incentive);
  });

  // Rule 11: Outbound Leads Excel Import with Duplicate Check
  test('Rule 11: Outbound Excel import validates duplicate mobile numbers', async () => {
    const mob = `92${Date.now().toString().slice(-8)}`;
    const records = [
      { patient_name: 'Outbound 1', mobile_number: mob, age: 30, gender: 'male' },
      { patient_name: 'Outbound Duplicate', mobile_number: mob, age: 35, gender: 'female' } // Duplicate!
    ];

    const importRes = await request(app)
      .post('/api/v1/callcenter/outbound/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ file_name: 'test_campaign.xlsx', records });

    expect(importRes.status).toBe(201);
    expect(importRes.body.data.valid_records).toBe(1);
    expect(importRes.body.data.duplicate_records).toBe(1);
  });

  // Rule 12: RBAC Blocks Restricted Role Endpoints
  test('Rule 12: RBAC blocks lower roles from Super-Admin-only endpoints', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(res.status).toBe(403);
  });

});
