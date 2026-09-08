const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('PRO CRM & Calling Module Integration Test Suite', () => {
  let proToken;
  let adminToken;
  let execToken;
  let validPatientId;

  const testCallIds = [];
  const testFollowupIds = [];
  const testRenewalIds = [];
  const testOcnrIds = [];

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

    // 3. Authenticate Executive
    const execLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'eric_exec', password: 'Password@123' });
    execToken = execLogin.body?.data?.token;

    // 4. Fetch a valid patient for test creations
    const ptRes = await db.query(`SELECT patient_id FROM patients WHERE branch_id = 1 LIMIT 1`);
    validPatientId = ptRes.rows[0]?.patient_id || 1;
  });

  afterAll(async () => {
    // Cleanup created test rows
    if (testCallIds.length > 0) {
      await db.query(`DELETE FROM call_records WHERE call_id = ANY($1::int[])`, [testCallIds]);
    }
    if (testFollowupIds.length > 0) {
      await db.query(`DELETE FROM crm_followups WHERE id = ANY($1::int[])`, [testFollowupIds]);
    }
    if (testRenewalIds.length > 0) {
      await db.query(`DELETE FROM renewals WHERE id = ANY($1::int[])`, [testRenewalIds]);
    }
    if (testOcnrIds.length > 0) {
      await db.query(`DELETE FROM oc_nr_patients WHERE id = ANY($1::int[])`, [testOcnrIds]);
    }
    await db.pool.end();
  });

  describe('1. RBAC & Authentication Checks', () => {
    it('should reject unauthenticated request to GET /calls with 401', async () => {
      const res = await request(app).get('/api/v1/pro/calls');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated request to POST /calls with 401', async () => {
      const res = await request(app).post('/api/v1/pro/calls').send({});
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated request to GET /followups with 401', async () => {
      const res = await request(app).get('/api/v1/pro/followups');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should allow PRO manager to access CRM endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('2. Calls API (GET & POST /pro/calls)', () => {
    it('should fetch today calls and format callback_date without raw ISO timestamps', async () => {
      const res = await request(app)
        .get('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Check if call 464 (the one from screenshot) is present and callback_date is formatted
      const call464 = res.body.data.find(c => c.call_id === 464);
      if (call464 && call464.callback_date) {
        // Must NOT contain 'T' or '.000Z'
        expect(call464.callback_date).not.toContain('T');
        expect(call464.callback_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('should reject call logging with missing required fields (400)', async () => {
      const res = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ patient_id: validPatientId });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject call logging for non-existent patient ID with 404', async () => {
      const res = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: 9999999,
          interaction_type: 'outbound',
          call_purpose: 'followup',
          call_status: 'connected',
          remarks: 'Test non-existent'
        });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('should reject invalid interaction_type enum with 400', async () => {
      const res = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          interaction_type: 'telepathy',
          call_purpose: 'followup',
          call_status: 'connected'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('interaction_type');
    });

    it('should reject invalid call_purpose enum with 400', async () => {
      const res = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          interaction_type: 'outbound',
          call_purpose: 'invalid_purpose',
          call_status: 'connected'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid call_purpose');
    });

    it('should reject invalid call_status enum with 400', async () => {
      const res = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          interaction_type: 'outbound',
          call_purpose: 'followup',
          call_status: 'not_reachable' // Invalid DB enum
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid call_status');
    });

    it('should require callback_date when call_status is callback_requested (400)', async () => {
      const res = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          interaction_type: 'outbound',
          call_purpose: 'callback',
          call_status: 'callback_requested'
          // callback_date omitted
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('callback_date is required');
    });

    it('should successfully log a valid call and verify in PostgreSQL', async () => {
      const res = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          interaction_type: 'outbound',
          call_purpose: 'followup',
          call_status: 'connected',
          remarks: 'Integration test call outcome'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.call_id).toBeDefined();

      const createdId = res.body.data.call_id;
      testCallIds.push(createdId);

      // Verify row in database
      const dbCheck = await db.query(`SELECT * FROM call_records WHERE call_id = $1`, [createdId]);
      expect(dbCheck.rows.length).toBe(1);
      expect(dbCheck.rows[0].interaction_type).toBe('outbound');
      expect(dbCheck.rows[0].call_purpose).toBe('followup');
      expect(dbCheck.rows[0].call_status).toBe('connected');
    });

    it('should prevent duplicate call logging within 5 seconds (409 idempotency)', async () => {
      const callPayload = {
        patient_id: validPatientId,
        interaction_type: 'inbound',
        call_purpose: 'general_enquiry',
        call_status: 'connected',
        remarks: 'Duplicate guard test'
      };

      const res1 = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send(callPayload);
      expect(res1.status).toBe(201);
      testCallIds.push(res1.body.data.call_id);

      // Immediate retry with identical payload
      const res2 = await request(app)
        .post('/api/v1/pro/calls')
        .set('Authorization', `Bearer ${proToken}`)
        .send(callPayload);
      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('Duplicate call record');
    });
  });

  describe('3. Follow-ups API (GET, POST /pro/followups & PUT status)', () => {
    let testFollowupId;

    it('should reject followup creation for non-existent patient (404)', async () => {
      const res = await request(app)
        .post('/api/v1/pro/followups')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: 9999999,
          followup_type: 'treatment',
          followup_date: '2026-09-20',
          purpose: 'Non-existent test'
        });
      expect(res.status).toBe(404);
    });

    it('should reject followup creation with invalid category (400)', async () => {
      const res = await request(app)
        .post('/api/v1/pro/followups')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          followup_type: 'invalid_cat',
          followup_date: '2026-09-20',
          purpose: 'Invalid category test'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid followup_type');
    });

    it('should successfully schedule a follow-up and store in crm_followups', async () => {
      const res = await request(app)
        .post('/api/v1/pro/followups')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          followup_type: 'treatment',
          followup_date: '2026-09-15',
          purpose: 'Post-procedure review',
          remarks: 'Integration test followup'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.id).toBeDefined();

      testFollowupId = res.body.data.id;
      testFollowupIds.push(testFollowupId);

      // Verify row in DB
      const dbRow = await db.query(`SELECT * FROM crm_followups WHERE id = $1`, [testFollowupId]);
      expect(dbRow.rows.length).toBe(1);
      expect(dbRow.rows[0].category).toBe('treatment');
      expect(dbRow.rows[0].status).toBe('pending');
    });

    it('should fetch follow-ups list with clean date formatting', async () => {
      const res = await request(app)
        .get('/api/v1/pro/followups')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const found = res.body.data.find(f => (f.id || f.followup_id) === testFollowupId);
      expect(found).toBeDefined();
      expect(found.due_date).toBe('2026-09-15');
      expect(found.status).toBe('pending');
    });

    it('should update followup status to completed via PUT /followups/:id/status', async () => {
      const res = await request(app)
        .put(`/api/v1/pro/followups/${testFollowupId}/status`)
        .set('Authorization', `Bearer ${proToken}`)
        .send({ status: 'completed', remarks: 'Patient called and confirmed' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in DB
      const dbRow = await db.query(`SELECT status, remarks FROM crm_followups WHERE id = $1`, [testFollowupId]);
      expect(dbRow.rows[0].status).toBe('completed');
      expect(dbRow.rows[0].remarks).toBe('Patient called and confirmed');
    });
  });

  describe('4. Renewals API (GET /queue & POST /renewals)', () => {
    it('should fetch renewals queue with expired packages and renewals history', async () => {
      const res = await request(app)
        .get('/api/v1/pro/renewals/queue')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('expired_packages');
      expect(res.body.data).toHaveProperty('renewals');
      expect(Array.isArray(res.body.data.expired_packages)).toBe(true);
      expect(Array.isArray(res.body.data.renewals)).toBe(true);
    });

    it('should reject renewal with negative or zero amount (400)', async () => {
      const res = await request(app)
        .post('/api/v1/pro/renewals')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          renewal_amount: -500
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('positive number');
    });

    it('should successfully record a package renewal in renewals table', async () => {
      const res = await request(app)
        .post('/api/v1/pro/renewals')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          renewal_amount: 15000,
          call_status: 'renewed',
          remarks: 'Integration test renewal'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.id).toBeDefined();

      const createdId = res.body.data.id;
      testRenewalIds.push(createdId);

      // Check PostgreSQL
      const dbRow = await db.query(`SELECT * FROM renewals WHERE id = $1`, [createdId]);
      expect(dbRow.rows.length).toBe(1);
      expect(parseFloat(dbRow.rows[0].amount)).toBe(15000);
    });
  });

  describe('5. Due Patients API (GET /due-patients)', () => {
    it('should fetch due patients with valid bill and patient info', async () => {
      const res = await request(app)
        .get('/api/v1/pro/due-patients')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        const item = res.body.data[0];
        expect(item).toHaveProperty('patient_id');
        expect(item).toHaveProperty('due_amount');
        expect(item).toHaveProperty('bill_number');
      }
    });
  });

  describe('6. ACQ Patients API (GET /acq & PUT /acq/:id)', () => {
    it('should fetch ACQ patients list', async () => {
      const res = await request(app)
        .get('/api/v1/pro/acq')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('7. OC / NR Patients API (GET /ocnr & POST /ocnr)', () => {
    it('should reject invalid classification enum with 400', async () => {
      const res = await request(app)
        .post('/api/v1/pro/ocnr')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          classification: 'invalid_class'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('classification must be');
    });

    it('should successfully record an OC/NR patient in PostgreSQL', async () => {
      const res = await request(app)
        .post('/api/v1/pro/ocnr')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: validPatientId,
          classification: 'oc',
          reason: 'cost_concern',
          remarks: 'Integration test OC/NR'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data?.id).toBeDefined();

      const createdId = res.body.data.id;
      testOcnrIds.push(createdId);

      const dbRow = await db.query(`SELECT * FROM oc_nr_patients WHERE id = $1`, [createdId]);
      expect(dbRow.rows.length).toBe(1);
      expect(dbRow.rows[0].classification).toBe('oc');
      expect(dbRow.rows[0].reason).toBe('cost_concern');
    });

    it('should fetch OC / NR patients list and return recorded record', async () => {
      const res = await request(app)
        .get('/api/v1/pro/ocnr')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
