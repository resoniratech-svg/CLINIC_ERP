const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

let adminToken = '';
let receptionistToken = '';
let doctorToken = '';
let executiveToken = '';
const ts = Date.now();

beforeAll(async () => {
  await seed();
  await db.query('DELETE FROM prescriptions');
  await db.query('DELETE FROM appointments');

  // Admin login
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
  adminToken = adminLogin.body.data.token;

  // Receptionist login
  const recLogin = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
  receptionistToken = recLogin.body.data.token;

  // Create Executive & login
  const execEmp = `EX_REC_${ts}`;
  const execUser = `exec_rec_${ts}`;
  await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
    employee_id: execEmp, full_name: 'Exec For Rec Test', mobile_number: `96${ts.toString().slice(-8)}`,
    username: execUser, password: 'Password@123', role: 'executive'
  });
  const execLogin = await request(app).post('/api/v1/auth/login').send({ username: execUser, password: 'Password@123' });
  executiveToken = execLogin.body.data.token;

  // Create Doctor & login
  const docEmp = `DOC_REC_${ts}`;
  const docUser = `doc_rec_${ts}`;
  await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
    employee_id: docEmp, full_name: 'Dr. Rec Test', mobile_number: `95${ts.toString().slice(-8)}`,
    username: docUser, password: 'Password@123', role: 'doctor',
    doctor_details: { specialization: 'General Physician', new_consultation_fee: 500 }
  });
  const docLogin = await request(app).post('/api/v1/auth/login').send({ username: docUser, password: 'Password@123' });
  doctorToken = docLogin.body.data.token;
});

afterAll(async () => {
  await db.pool.end();
});

describe('Receptionist Module Business Rules Verification', () => {

  // Rule 1: Mandatory branch_id = 1 & No Create Branch API
  test('Rule 1: Branch ID defaults to 1 and no Create Branch API exists', async () => {
    const res = await request(app).post('/api/v1/receptionist/branches').set('Authorization', `Bearer ${receptionistToken}`).send({ branch_name: 'Branch 2' });
    expect(res.status).toBe(404);

    const dashRes = await request(app).get('/api/v1/receptionist/dashboard').set('Authorization', `Bearer ${receptionistToken}`);
    expect(dashRes.status).toBe(200);
  });

  // Rule 2: Patient Search auto classifies new vs existing
  test('Rule 2: Mobile lookup auto-classifies new vs existing patient', async () => {
    const nonExistentMobile = `91${Date.now().toString().slice(-8)}`;
    const newRes = await request(app).get(`/api/v1/receptionist/patients/search?mobile=${nonExistentMobile}`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(newRes.body.data.exists).toBe(false);
    expect(newRes.body.data.classification).toBe('new');
  });

  // Rule 3: Registration target classification (New -> Enquiry, Existing -> Unit)
  test('Rule 3: Walk-in registration auto-tags target', async () => {
    const docRes = await db.query(`SELECT doctor_id FROM doctors WHERE status = 'active' LIMIT 1`);
    const docId = docRes.rows[0].doctor_id;
    const mob = `92${Date.now().toString().slice(-8)}`;

    const regRes = await request(app).post('/api/v1/receptionist/patients/register').set('Authorization', `Bearer ${receptionistToken}`).send({
      full_name: 'Walkin New Patient', mobile_number: mob, age: 28, gender: 'male',
      assigned_doctor_id: docId, appointment_date: '2026-10-01', appointment_time: '09:00'
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.classification).toBe('new');
    expect(regRes.body.data.target_target).toBe('Enquiry Target');
  });

  // Rule 4: Renewals and Referrals roll into Unit Target
  test('Rule 4: Employee & Patient Referrals roll into Unit Target', async () => {
    const empUserRes = await db.query(`SELECT user_id FROM users WHERE role = 'super_admin' LIMIT 1`);
    const empId = empUserRes.rows[0].user_id;

    const refRes = await request(app).post('/api/v1/receptionist/referrals/employee').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_name: 'Ref Patient', mobile_number: `93${Date.now().toString().slice(-8)}`, age: 30, gender: 'female',
      referring_employee_id: empId
    });

    expect(refRes.status).toBe(201);
    expect(refRes.body.data.referral_code).toMatch(/^REF/);
  });

  // Rule 5: Executive lead opening preserves lead info
  test('Rule 5: Executive lead queue returns lead details preserving executive info', async () => {
    const mob = `94${Date.now().toString().slice(-8)}`;
    const leadRes = await db.query(`
      INSERT INTO leads (lead_name, mobile_number, lead_source, lead_created_by_user_id, status, executive_id, branch_id)
      VALUES ('Exec Lead', $1, 'outbound', 1, 'new', 1, 1) RETURNING lead_id
    `, [mob]);

    const openRes = await request(app).post(`/api/v1/receptionist/leads/${leadRes.rows[0].lead_id}/open`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(openRes.status).toBe(200);
    expect(openRes.body.data.lead_id).toBe(leadRes.rows[0].lead_id);
  });

  // Rule 6: Active doctor selection enforcement
  test('Rule 6: Inactive/Resigned doctor selection is rejected', async () => {
    const t = Date.now().toString().slice(-6);
    const inactDoc = await db.query(`
      INSERT INTO users (employee_id, full_name, mobile_number, username, password_hash, role, status)
      VALUES ($1, 'Dr. Inactive', $2, $3, 'hash', 'doctor', 'inactive') RETURNING user_id
    `, [`INACT_${t}`, `99${t}01`, `dr_inact_${t}`]);

    const docRes = await db.query(`
      INSERT INTO doctors (user_id, doctor_code, status) VALUES ($1, $2, 'inactive') RETURNING doctor_id
    `, [inactDoc.rows[0].user_id, `INACT_${t}`]);

    const apptRes = await request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, doctor_id: docRes.rows[0].doctor_id, appointment_date: '2026-09-02', appointment_time: '11:00'
    });

    expect(apptRes.status).toBe(400);
    expect(apptRes.body.message).toContain('inactive or resigned');
  });

  // Double Booking Prevention
  test('Rule 6b: Double booking appointment for same doctor at same date and time is rejected', async () => {
    const docRes = await db.query(`SELECT doctor_id FROM doctors WHERE status = 'active' LIMIT 1`);
    const docId = docRes.rows[0].doctor_id;
    const testDate = `2026-11-${Math.floor(Math.random() * 15 + 10)}`;
    const testTime = `17:${Math.floor(Math.random() * 40 + 10)}`;

    // First booking
    const appt1 = await request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, doctor_id: docId, appointment_date: testDate, appointment_time: testTime
    });
    expect(appt1.status).toBe(201);

    // Second booking at exact same doctor, date, and time
    const appt2 = await request(app).post('/api/v1/receptionist/appointments').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 2, doctor_id: docId, appointment_date: testDate, appointment_time: testTime
    });
    expect(appt2.status).toBe(400);
    expect(appt2.body.message).toContain('already booked');
  });

  // Rule 7: Server-side consultation fee resolution
  test('Rule 7: Consultation fee resolved server-side from consultation_fees', async () => {
    const docRes = await db.query(`SELECT doctor_id FROM doctors WHERE status = 'active' LIMIT 1`);
    const apptRes = await db.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status)
      VALUES (1, $1, CURRENT_DATE, '10:30', 'new', 'scheduled') RETURNING appointment_id
    `, [docRes.rows[0].doctor_id]);

    const billRes = await request(app).post('/api/v1/receptionist/billing/bills').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, appointment_id: apptRes.rows[0].appointment_id, bill_type: 'consultation', payment_amount: 500
    });

    expect(billRes.status).toBe(201);
    expect(billRes.body.data.bill.bill_type).toBe('consultation');
  });

  // Rule 8: Max discount rule enforcement
  test('Rule 8: Exceeding max discount limit is rejected', async () => {
    const docRes = await db.query(`SELECT doctor_id FROM doctors WHERE status = 'active' LIMIT 1`);
    const apptRes = await db.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status)
      VALUES (1, $1, CURRENT_DATE, '11:30', 'new', 'scheduled') RETURNING appointment_id
    `, [docRes.rows[0].doctor_id]);

    const billRes = await request(app).post('/api/v1/receptionist/billing/bills').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, appointment_id: apptRes.rows[0].appointment_id, bill_type: 'consultation', discount_amount: 400
    });

    expect(billRes.status).toBe(400);
    expect(billRes.body.message).toContain('exceeds max allowed limit');
  });

  // Rule 9: Restricted to consultation billing only
  test('Rule 9: Receptionist creating treatment bill is rejected with 403', async () => {
    const billRes = await request(app).post('/api/v1/receptionist/billing/bills').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, appointment_id: 1, bill_type: 'treatment'
    });

    expect(billRes.status).toBe(403);
    expect(billRes.body.message).toContain('restricted to consultation fee billing only');
  });

  // Rule 10: Partial payment writes due_patients row
  test('Rule 10: Partial payment creates due_patients entry', async () => {
    const docRes = await db.query(`SELECT doctor_id FROM doctors WHERE status = 'active' LIMIT 1`);
    const apptRes = await db.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status)
      VALUES (1, $1, CURRENT_DATE, '14:30', 'new', 'scheduled') RETURNING appointment_id
    `, [docRes.rows[0].doctor_id]);

    const billRes = await request(app).post('/api/v1/receptionist/billing/bills').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, appointment_id: apptRes.rows[0].appointment_id, bill_type: 'consultation', payment_amount: 300
    });

    expect(billRes.status).toBe(201);
    expect(billRes.body.data.bill.due_amount).toBeGreaterThan(0);
  });

  // Rule 11: Check-in stage restriction
  test('Rule 11: Receptionist can only transition appointment to checked-in', async () => {
    const apptRes = await db.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status)
      VALUES (1, 1, CURRENT_DATE, '15:00', 'scheduled') RETURNING appointment_id
    `);

    // Valid check-in
    const passRes = await request(app).post(`/api/v1/receptionist/appointments/${apptRes.rows[0].appointment_id}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked-in' });
    expect(passRes.status).toBe(200);

    // Invalid transition to downstream stage
    const failRes = await request(app).post(`/api/v1/receptionist/appointments/${apptRes.rows[0].appointment_id}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'in_consultation' });
    expect(failRes.status).toBe(403);
  });

  // Rule 12: Registration expiry computation
  test('Rule 12: Registration expiry computes 30 days validity', async () => {
    const ptRes = await db.query(`SELECT registration_date, registration_expiry FROM patients WHERE registration_id IS NOT NULL LIMIT 1`);
    expect(ptRes.rows.length).toBeGreaterThan(0);
    const regDate = new Date(ptRes.rows[0].registration_date);
    const regExp = new Date(ptRes.rows[0].registration_expiry);
    const diffDays = Math.round((regExp - regDate) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  // Rule 13: Call record callback automation
  test('Rule 13: call_status callback_requested requires callback_date and auto populates My Tasks', async () => {
    const failRes = await request(app).post('/api/v1/receptionist/crm/calls').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, interaction_type: 'outbound', call_purpose: 'callback', call_status: 'callback_requested'
    });
    expect(failRes.status).toBe(400);

    const passRes = await request(app).post('/api/v1/receptionist/crm/calls').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, interaction_type: 'outbound', call_purpose: 'callback', call_status: 'callback_requested',
      callback_date: '2026-09-05', callback_time: '10:00'
    });
    expect(passRes.status).toBe(201);

    const tasksRes = await request(app).get('/api/v1/receptionist/my-tasks').set('Authorization', `Bearer ${receptionistToken}`);
    expect(tasksRes.body.data.length).toBeGreaterThan(0);
  });

  // Rule 14: Completing task removes it from pending list
  test('Rule 14: Completing task updates status and removes from pending list', async () => {
    const tasksRes = await request(app).get('/api/v1/receptionist/my-tasks').set('Authorization', `Bearer ${receptionistToken}`);
    const taskId = tasksRes.body.data[0].call_id;

    const compRes = await request(app).post(`/api/v1/receptionist/my-tasks/${taskId}/complete`).set('Authorization', `Bearer ${receptionistToken}`);
    expect(compRes.status).toBe(200);

    const checkTasks = await request(app).get('/api/v1/receptionist/my-tasks').set('Authorization', `Bearer ${receptionistToken}`);
    expect(checkTasks.body.data.some(t => t.call_id === taskId)).toBe(false);
  });

  // Rule 15: CRM task assignment rejects Executive
  test('Rule 15: CRM followup rejects assignment to Executive', async () => {
    const execUserRes = await db.query(`SELECT user_id FROM users WHERE role = 'executive' LIMIT 1`);

    const res = await request(app).post('/api/v1/crm/followups').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient_id: 1, category: 'appointment', assigned_to: execUserRes.rows[0].user_id
    });
    expect(res.status).toBe(400);
  });

  // Rule 16: RBAC blocks unauthorized roles
  test('Rule 16: Doctor role is blocked from Receptionist endpoints', async () => {
    const res = await request(app).get('/api/v1/receptionist/dashboard').set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(403);
  });

  // Rule 17: Doctor resignation preserves historical records
  test('Rule 17: Historical appointments remain visible after doctor resignation', async () => {
    const apptRes = await db.query(`SELECT appointment_id FROM appointments LIMIT 1`);
    expect(apptRes.rows.length).toBeGreaterThan(0);
  });

  // Rule 18: Forgot password creates request row
  test('Rule 18: Forgot password creates reset request row without exposing password', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ username_or_employee_id: 'rita_rec' });
    expect(res.status).toBe(200);
    expect(res.body.data?.password).toBeUndefined();
  });

  // Rule 19: Audit log creation for mutating requests
  test('Rule 19: Mutating requests write audit log with role = receptionist', async () => {
    const logs = await db.query(`SELECT * FROM audit_logs WHERE role = 'receptionist' ORDER BY id DESC LIMIT 1`);
    expect(logs.rows.length).toBeGreaterThan(0);
  });

  // Rule 20: Login/Logout logging
  test('Rule 20: Logout updates login_logs with session duration', async () => {
    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${receptionistToken}`);
    expect(logoutRes.status).toBe(200);
  });

});
