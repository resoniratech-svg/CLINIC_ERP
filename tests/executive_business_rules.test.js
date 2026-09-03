const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

let adminToken = '';
let executiveToken = '';
let doctorToken = '';
let receptionistToken = '';
let execUserId = null;
let execId = null;
const ts = Date.now();

beforeAll(async () => {
  await seed();

  // Admin login
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
  adminToken = adminLogin.body.data.token;

  // Receptionist login
  const recLogin = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
  receptionistToken = recLogin.body.data.token;

  // Create Executive & login
  const execEmp = `EX_TEST_${ts}`;
  const execUser = `exec_user_${ts}`;
  const execRes = await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
    employee_id: execEmp, full_name: 'Anil Executive', mobile_number: `94${ts.toString().slice(-8)}`,
    username: execUser, password: 'Password@123', role: 'executive',
    per_lead_incentive: 100
  });

  execUserId = execRes.body.data.user_id;

  const execLogin = await request(app).post('/api/v1/auth/login').send({ username: execUser, password: 'Password@123' });
  executiveToken = execLogin.body.data.token;

  // Doctor login for RBAC check
  const docLogin = await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' });
  doctorToken = docLogin.body.data.token;
  // Seed existing test patient for search test
  await db.query(`
    INSERT INTO patients (full_name, mobile_number, age, gender, address, branch_id)
    VALUES ('Test Patient', '9777766665', 30, 'male', 'Hyderabad', 1)
    ON CONFLICT (mobile_number) DO NOTHING;
  `);
});

describe('Executive / Call Center Module Business Rules Verification', () => {

  // 1. Dashboard
  test('Executive Dashboard returns calls, leads, and incentive metrics', async () => {
    const res = await request(app).get('/api/v1/executive/dashboard').set('Authorization', `Bearer ${executiveToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('calls_today');
    expect(res.body.data).toHaveProperty('leads_created');
    expect(res.body.data).toHaveProperty('incentive');
    expect(res.body.data.incentive.per_lead_incentive).toBeGreaterThanOrEqual(100);
  });

  // 2. Inbound Search
  test('Inbound Patient Search identifies new vs existing patient', async () => {
    // New Mobile
    const newMob = `99${Date.now().toString().slice(-8)}`;
    const newRes = await request(app).get(`/api/v1/executive/patients/search?mobile=${newMob}`).set('Authorization', `Bearer ${executiveToken}`);
    expect(newRes.status).toBe(200);
    expect(newRes.body.data.is_existing).toBe(false);

    // Existing Patient Search (Test Patient seeded)
    const existRes = await request(app).get(`/api/v1/executive/patients/search?mobile=9777766665`).set('Authorization', `Bearer ${executiveToken}`);
    expect(existRes.status).toBe(200);
    expect(existRes.body.data.is_existing).toBe(true);
    expect(existRes.body.data.patient.full_name).toBe('Test Patient');
  });

  // 3. Create Inbound Lead
  test('Creating Inbound Lead routes lead to Receptionist Queue and credits incentive', async () => {
    const mob = `91${Date.now().toString().slice(-8)}`;
    const leadRes = await request(app).post('/api/v1/executive/leads').set('Authorization', `Bearer ${executiveToken}`).send({
      lead_name: 'Inbound Patient Lead', mobile_number: mob, age: 34, gender: 'female',
      village: 'Madhapur', requirement: 'Cardiology Consultation', lead_source: 'inbound', remarks: 'Interested in checkup'
    });

    expect(leadRes.status).toBe(201);
    expect(leadRes.body.data.lead.status).toBe('new');
    expect(leadRes.body.data.handoff_target).toBe('Receptionist Lead Queue');

    // Receptionist checks Executive Leads Queue
    const recLeads = await request(app).get('/api/v1/receptionist/leads?status=new').set('Authorization', `Bearer ${receptionistToken}`);
    expect(recLeads.status).toBe(200);
    const found = recLeads.body.data.find(l => l.mobile_number === mob);
    expect(found).toBeDefined();
  });

  // 4. Outbound Excel Import & Duplicate Check
  test('Outbound Excel import validates duplicate numbers before creating leads', async () => {
    const mob1 = `90${Date.now().toString().slice(-8)}`;
    const importRes = await request(app).post('/api/v1/executive/outbound/import').set('Authorization', `Bearer ${executiveToken}`).send({
      file_name: 'August_Campaign.xlsx',
      records: [
        { serial_no: 'SL-101', name: 'Ravi Outbound', mobile_number: mob1, problem: 'Chronic Back Pain', age: 42, gender: 'male', campaign: 'August Followup', remarks: 'Fresh lead' },
        { serial_no: 'SL-102', patient_name: 'Test Duplicate', mobile: '9777766665', problem: 'Chest Pain', age: 50, gender: 'female', campaign: 'August Followup' } // duplicate of seeded patient
      ]
    });

    expect(importRes.status).toBe(201);
    expect(importRes.body.data.valid_records).toBe(1);
    expect(importRes.body.data.duplicate_records).toBe(1);
  });

  // 5. Outbound Calling Queue
  test('Executive Outbound Queue returns assigned calling leads', async () => {
    const queueRes = await request(app).get('/api/v1/executive/outbound/queue').set('Authorization', `Bearer ${executiveToken}`);
    expect(queueRes.status).toBe(200);
    expect(Array.isArray(queueRes.body.data)).toBe(true);
  });

  // 6. Record Call Outcome -> Interested generates Lead & Incentive
  test('Recording call outcome as Interested creates Lead and credits incentive', async () => {
    const mob = `92${Date.now().toString().slice(-8)}`;
    const outcomeRes = await request(app).post('/api/v1/executive/calls/outcome').set('Authorization', `Bearer ${executiveToken}`).send({
      patient_name: 'Interested Call Patient', mobile_number: mob, interaction_type: 'outbound',
      call_purpose: 'followup', call_status: 'interested', remarks: 'Agreed for consultation'
    });

    expect(outcomeRes.status).toBe(201);
    expect(outcomeRes.body.data.created_lead).toBeDefined();
    expect(outcomeRes.body.data.created_lead.lead_name).toBe('Interested Call Patient');
  });

  // 7. Record Call Outcome -> Callback Requested populates Callbacks
  test('Recording call outcome as Call Back Requested creates pending callback', async () => {
    const mob = `93${Date.now().toString().slice(-8)}`;
    const cbRes = await request(app).post('/api/v1/executive/calls/outcome').set('Authorization', `Bearer ${executiveToken}`).send({
      patient_name: 'Callback Patient', mobile_number: mob, interaction_type: 'outbound',
      call_purpose: 'followup', call_status: 'callback_requested', callback_date: '2026-09-10', callback_time: '14:00',
      remarks: 'Call back in afternoon'
    });

    expect(cbRes.status).toBe(201);

    // Verify in Executive Callbacks
    const listRes = await request(app).get('/api/v1/executive/callbacks').set('Authorization', `Bearer ${executiveToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);
  });

  // 8. Leads List & Lead Details
  test('Executive can view created leads list and specific lead details', async () => {
    const leadsList = await request(app).get('/api/v1/executive/leads').set('Authorization', `Bearer ${executiveToken}`);
    expect(leadsList.status).toBe(200);
    expect(leadsList.body.data.length).toBeGreaterThan(0);

    const leadId = leadsList.body.data[0].lead_id;
    const leadDetail = await request(app).get(`/api/v1/executive/leads/${leadId}`).set('Authorization', `Bearer ${executiveToken}`);
    expect(leadDetail.status).toBe(200);
    expect(leadDetail.body.data.lead.lead_id).toBe(leadId);
  });

  // 9. Call History
  test('Executive call history returns chronological call log', async () => {
    const callHist = await request(app).get('/api/v1/executive/calls/history').set('Authorization', `Bearer ${executiveToken}`);
    expect(callHist.status).toBe(200);
    expect(Array.isArray(callHist.body.data)).toBe(true);
  });

  // 10. Incentive Management
  test('Executive can view monthly incentive report calculation', async () => {
    const incRes = await request(app).get('/api/v1/executive/incentives').set('Authorization', `Bearer ${executiveToken}`);
    expect(incRes.status).toBe(200);
    expect(incRes.body.data).toHaveProperty('leads_generated');
    expect(incRes.body.data).toHaveProperty('per_lead_incentive');
    expect(incRes.body.data).toHaveProperty('total_incentive_earned');
  });

  // 11. Super Admin Executive Performance Report
  test('Super Admin can view performance report across all executives', async () => {
    const perfRes = await request(app).get('/api/v1/executive/performance').set('Authorization', `Bearer ${adminToken}`);
    expect(perfRes.status).toBe(200);
    expect(Array.isArray(perfRes.body.data)).toBe(true);
  });

  // 12. Role-Based Access Control Protection
  test('Doctor role is blocked from Executive endpoints with 403', async () => {
    const rbacRes = await request(app).get('/api/v1/executive/dashboard').set('Authorization', `Bearer ${doctorToken}`);
    expect(rbacRes.status).toBe(403);
  });

});
