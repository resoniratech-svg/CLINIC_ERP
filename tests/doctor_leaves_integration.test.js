const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db');
const jwt = require('jsonwebtoken');

describe('Doctor Portal — Leave Requests Module End-to-End Integration & Audit Test Suite', () => {
  let doctor1Token;
  let doctor2Token;
  let receptionistToken;
  let adminToken;
  let doctor1Id;
  let doctor2Id;
  let createdLeaveIds = [];

  const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_123!';

  beforeAll(async () => {
    // 1. Identify Doctor 1
    const doc1Res = await pool.query(`
      SELECT d.doctor_id, d.user_id, u.username
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      LIMIT 1
    `);
    expect(doc1Res.rows.length).toBeGreaterThan(0);
    doctor1Id = doc1Res.rows[0].doctor_id;
    doctor1Token = jwt.sign({ user_id: doc1Res.rows[0].user_id, role: 'doctor', branch_id: 1 }, jwtSecret);

    // 2. Identify / Create Doctor 2
    let doc2Res = await pool.query(`
      SELECT d.doctor_id, d.user_id, u.username
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.doctor_id != $1
      LIMIT 1
    `, [doctor1Id]);

    if (doc2Res.rows.length === 0) {
      const userRes = await pool.query(`
        INSERT INTO users (username, password_hash, full_name, email, role, branch_id)
        VALUES ('doc_leaves_test_2', 'hash', 'Dr. Leaves Test Two', 'docleaves2@test.com', 'doctor', 1)
        RETURNING user_id
      `);
      const d2 = await pool.query(`
        INSERT INTO doctors (user_id, doctor_code, specialization, branch_id)
        VALUES ($1, 'DOC_LEAVES_002', 'General', 1)
        RETURNING doctor_id
      `, [userRes.rows[0].user_id]);
      doctor2Id = d2.rows[0].doctor_id;
      doctor2Token = jwt.sign({ user_id: userRes.rows[0].user_id, role: 'doctor', branch_id: 1 }, jwtSecret);
    } else {
      doctor2Id = doc2Res.rows[0].doctor_id;
      doctor2Token = jwt.sign({ user_id: doc2Res.rows[0].user_id, role: 'doctor', branch_id: 1 }, jwtSecret);
    }

    // Tokens for other roles
    receptionistToken = jwt.sign({ user_id: 888, role: 'receptionist', branch_id: 1 }, jwtSecret);
    adminToken = jwt.sign({ user_id: 1, role: 'super_admin', branch_id: 1 }, jwtSecret);
  });

  afterAll(async () => {
    // Clean up created test leave records
    if (createdLeaveIds.length > 0) {
      await pool.query(`DELETE FROM doctor_leaves WHERE id = ANY($1::int[])`, [createdLeaveIds]);
    }
  });

  // =========================================================================
  // 1. AUTHENTICATION & AUTHORIZATION ENFORCEMENT
  // =========================================================================
  describe('1. Authentication & Authorization Enforcement', () => {
    test('1.1 GET /api/v1/doctor/leaves/mine without token returns 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/doctor/leaves/mine');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('1.2 POST /api/v1/doctor/leaves without token returns 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/doctor/leaves').send({
        from_date: '2026-11-01',
        to_date: '2026-11-03',
        reason: 'Personal'
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('1.3 GET /api/v1/doctor/leaves/mine with invalid token returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/leaves/mine')
        .set('Authorization', 'Bearer invalid_signature_token');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('1.4 Receptionist role is forbidden (403) from viewing doctor leaves', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/leaves/mine')
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('1.5 Receptionist role is forbidden (403) from applying for doctor leave', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          from_date: '2026-11-01',
          to_date: '2026-11-03',
          reason: 'Personal'
        });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('1.6 Doctor role is authorized (200) to view leave requests', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/leaves/mine')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // =========================================================================
  // 2. INPUT VALIDATION & DATE ORDER RULES
  // =========================================================================
  describe('2. Input Validation & Date Order Rules', () => {
    test('2.1 Missing from_date returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          to_date: '2026-11-05',
          reason: 'Medical Leave'
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('2.2 Missing to_date returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2026-11-01',
          reason: 'Medical Leave'
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('2.3 Missing reason returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2026-11-01',
          to_date: '2026-11-05'
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('2.4 Empty or whitespace-only reason returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2026-11-01',
          to_date: '2026-11-05',
          reason: '   '
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('2.5 Non-YYYY-MM-DD date format returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '01-11-2026',
          to_date: '05-11-2026',
          reason: 'Medical Leave'
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('2.6 to_date earlier than from_date returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2026-11-10',
          to_date: '2026-11-05',
          reason: 'Medical Leave'
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot be earlier than from_date/i);
    });

    test('2.7 Valid single-day leave (from_date === to_date) succeeds with 201 Created', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2026-12-01',
          to_date: '2026-12-01',
          reason: 'Personal Reasons',
          remarks: 'Covered by Dr. Connor'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.from_date).toBe('2026-12-01');
      expect(res.body.data.to_date).toBe('2026-12-01');
      expect(res.body.data.status).toBe('pending');
      createdLeaveIds.push(res.body.data.id);
    });

    test('2.8 Valid multi-day leave succeeds with 201 Created and exact dates', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2026-12-10',
          to_date: '2026-12-15',
          reason: 'Attending Medical Conference',
          remarks: 'Annual Homeopathy Summit'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.from_date).toBe('2026-12-10');
      expect(res.body.data.to_date).toBe('2026-12-15');
      expect(res.body.data.reason).toBe('Attending Medical Conference');
      expect(res.body.data.remarks).toBe('Annual Homeopathy Summit');
      createdLeaveIds.push(res.body.data.id);
    });
  });

  // =========================================================================
  // 3. OVERLAPPING & DUPLICATE LEAVE PREVENTION (409 CONFLICT)
  // =========================================================================
  describe('3. Overlapping & Duplicate Leave Prevention', () => {
    test('3.1 Applying for leave overlapping existing pending leave returns 409 Conflict', async () => {
      // Doctor 1 has leave from 2026-12-10 to 2026-12-15
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2026-12-12',
          to_date: '2026-12-18',
          reason: 'Medical Leave'
        });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/overlapping this date range/i);
    });

    test('3.2 Applying for exact same date range returns 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2026-12-10',
          to_date: '2026-12-15',
          reason: 'Planned Vacation'
        });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. DOCTOR DATA ISOLATION & SCOPING
  // =========================================================================
  describe('4. Doctor Data Isolation & Scoping', () => {
    let doc2LeaveId;

    beforeAll(async () => {
      // Create a leave specifically for Doctor 2
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor2Token}`)
        .send({
          from_date: '2026-12-20',
          to_date: '2026-12-22',
          reason: 'Family Emergency',
          remarks: 'Urgent family event'
        });
      expect(res.status).toBe(201);
      doc2LeaveId = res.body.data.id;
      createdLeaveIds.push(doc2LeaveId);
    });

    test('4.1 Doctor 2 sees Doctor 2 leave in /leaves/mine', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/leaves/mine')
        .set('Authorization', `Bearer ${doctor2Token}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map(l => l.id);
      expect(ids).toContain(doc2LeaveId);
      // All returned records must belong to Doctor 2
      res.body.data.forEach(l => {
        expect(l.doctor_id).toBe(doctor2Id);
      });
    });

    test('4.2 Doctor 1 CANNOT see Doctor 2 leave in /leaves/mine', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/leaves/mine')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map(l => l.id);
      expect(ids).not.toContain(doc2LeaveId);
      res.body.data.forEach(l => {
        expect(l.doctor_id).toBe(doctor1Id);
      });
    });

    test('4.3 Doctor 2 attempting to spoof Doctor 1 via query param is ignored', async () => {
      const res = await request(app)
        .get(`/api/v1/doctor/leaves/mine?doctor_id=${doctor1Id}`)
        .set('Authorization', `Bearer ${doctor2Token}`);
      expect(res.status).toBe(200);
      // Backend must strictly ignore query param and return only Doctor 2 leaves
      res.body.data.forEach(l => {
        expect(l.doctor_id).toBe(doctor2Id);
      });
    });

    test('4.4 Doctor 2 attempting to create leave on behalf of Doctor 1 is overridden to Doctor 2', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor2Token}`)
        .send({
          doctor_id: doctor1Id, // Spoofing attempt
          from_date: '2026-12-25',
          to_date: '2026-12-26',
          reason: 'Training/Conference'
        });
      expect(res.status).toBe(201);
      expect(res.body.data.doctor_id).toBe(doctor2Id); // Must be bound to doctor 2
      createdLeaveIds.push(res.body.data.id);
    });

    test('4.5 Super Admin can view all leaves or filter by doctor_id', async () => {
      const res = await request(app)
        .get(`/api/v1/doctor/leaves/mine?doctor_id=${doctor2Id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(l => {
        expect(l.doctor_id).toBe(doctor2Id);
      });
    });
  });

  // =========================================================================
  // 5. POSTGRESQL PERSISTENCE & TIMEZONE-EXACT DATE FIDELITY
  // =========================================================================
  describe('5. PostgreSQL Persistence & Timezone-Exact Date Fidelity', () => {
    test('5.1 Leave record exists in PostgreSQL with exact matching dates', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/leaves')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          from_date: '2027-01-15',
          to_date: '2027-01-18',
          reason: 'Planned Vacation',
          remarks: 'Covered by Dr. Connor'
        });
      expect(res.status).toBe(201);
      const leaveId = res.body.data.id;
      createdLeaveIds.push(leaveId);

      // Verify directly from PostgreSQL
      const dbRes = await pool.query(
        `SELECT id, doctor_id, to_char(from_date, 'YYYY-MM-DD') as from_date, to_char(to_date, 'YYYY-MM-DD') as to_date, reason, remarks, status FROM doctor_leaves WHERE id = $1`,
        [leaveId]
      );
      expect(dbRes.rows.length).toBe(1);
      const dbRow = dbRes.rows[0];
      expect(dbRow.from_date).toBe('2027-01-15');
      expect(dbRow.to_date).toBe('2027-01-18');
      expect(dbRow.reason).toBe('Planned Vacation');
      expect(dbRow.remarks).toBe('Covered by Dr. Connor');
      expect(dbRow.status).toBe('pending');

      // Fetch via GET API and assert exact string equivalence (zero day subtraction)
      const getRes = await request(app)
        .get('/api/v1/doctor/leaves/mine')
        .set('Authorization', `Bearer ${doctor1Token}`);
      const fetched = getRes.body.data.find(l => l.id === leaveId);
      expect(fetched).toBeDefined();
      expect(fetched.from_date).toBe('2027-01-15');
      expect(fetched.to_date).toBe('2027-01-18');
    });
  });
});
