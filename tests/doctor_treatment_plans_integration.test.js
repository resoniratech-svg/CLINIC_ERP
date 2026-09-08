const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db');
const jwt = require('jsonwebtoken');

describe('Doctor Portal — Treatment Plans Module End-to-End Backend Audit & Test Suite', () => {
  let doctor1Token;
  let doctor2Token;
  let receptionistToken;
  let adminToken;
  let doctor1Id;
  let doctor2Id;
  let patient1Id;
  let patient2Id;
  let consultation1Id;
  let consultation2Id;
  let completedConsultationId;
  let treatmentPlan1Id;

  const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_123!';

  beforeAll(async () => {
    // 1. Identify / Create Doctors
    const doc1Res = await pool.query(`
      SELECT d.doctor_id, d.user_id, u.username
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      LIMIT 1
    `);
    expect(doc1Res.rows.length).toBeGreaterThan(0);
    doctor1Id = doc1Res.rows[0].doctor_id;
    doctor1Token = jwt.sign({ user_id: doc1Res.rows[0].user_id, role: 'doctor', branch_id: 1 }, jwtSecret);

    // Doctor 2
    let doc2Res = await pool.query(`
      SELECT d.doctor_id, d.user_id, u.username
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.doctor_id != $1
      LIMIT 1
    `, [doctor1Id]);

    if (doc2Res.rows.length === 0) {
      // Create second doctor if doesn't exist
      const userRes = await pool.query(`
        INSERT INTO users (username, password_hash, full_name, email, role, branch_id)
        VALUES ('doc_test_2', 'hash', 'Dr. Second Test', 'doc2@test.com', 'doctor', 1)
        RETURNING user_id
      `);
      const d2 = await pool.query(`
        INSERT INTO doctors (user_id, doctor_code, specialization, branch_id)
        VALUES ($1, 'DOC_TEST_002', 'General', 1)
        RETURNING doctor_id
      `, [userRes.rows[0].user_id]);
      doctor2Id = d2.rows[0].doctor_id;
      doctor2Token = jwt.sign({ user_id: userRes.rows[0].user_id, role: 'doctor', branch_id: 1 }, jwtSecret);
    } else {
      doctor2Id = doc2Res.rows[0].doctor_id;
      doctor2Token = jwt.sign({ user_id: doc2Res.rows[0].user_id, role: 'doctor', branch_id: 1 }, jwtSecret);
    }

    // Receptionist token
    receptionistToken = jwt.sign({ user_id: 999, role: 'receptionist', branch_id: 1 }, jwtSecret);
    // Super admin token
    adminToken = jwt.sign({ user_id: 1, role: 'super_admin', branch_id: 1 }, jwtSecret);

    // 2. Create Test Patients
    const p1 = await pool.query(`
      INSERT INTO patients (full_name, mobile_number, registration_id, branch_id)
      VALUES ('Audit Test Patient One', '9899111222', 'REG-TP-001', 1)
      RETURNING patient_id
    `);
    patient1Id = p1.rows[0].patient_id;

    const p2 = await pool.query(`
      INSERT INTO patients (full_name, mobile_number, registration_id, branch_id)
      VALUES ('Audit Test Patient Two', '9899333444', 'REG-TP-002', 1)
      RETURNING patient_id
    `);
    patient2Id = p2.rows[0].patient_id;

    // Create appointments for consultations
    const appt1 = await pool.query(`
      INSERT INTO appointments (patient_id, doctor_id, branch_id, appointment_date, appointment_time, status)
      VALUES ($1, $2, 1, CURRENT_DATE, '10:00:00', 'in_consultation')
      RETURNING appointment_id
    `, [patient1Id, doctor1Id]);

    const appt2 = await pool.query(`
      INSERT INTO appointments (patient_id, doctor_id, branch_id, appointment_date, appointment_time, status)
      VALUES ($1, $2, 1, CURRENT_DATE, '10:30:00', 'in_consultation')
      RETURNING appointment_id
    `, [patient2Id, doctor2Id]);

    const appt3 = await pool.query(`
      INSERT INTO appointments (patient_id, doctor_id, branch_id, appointment_date, appointment_time, status)
      VALUES ($1, $2, 1, CURRENT_DATE, '11:00:00', 'doctor_completed')
      RETURNING appointment_id
    `, [patient1Id, doctor1Id]);

    // Create Draft Consultation for Doctor 1
    const c1 = await pool.query(`
      INSERT INTO consultations (appointment_id, patient_id, doctor_id, branch_id, status)
      VALUES ($1, $2, $3, 1, 'draft')
      RETURNING consultation_id
    `, [appt1.rows[0].appointment_id, patient1Id, doctor1Id]);
    consultation1Id = c1.rows[0].consultation_id;

    // Create Draft Consultation for Doctor 2
    const c2 = await pool.query(`
      INSERT INTO consultations (appointment_id, patient_id, doctor_id, branch_id, status)
      VALUES ($1, $2, $3, 1, 'draft')
      RETURNING consultation_id
    `, [appt2.rows[0].appointment_id, patient2Id, doctor2Id]);
    consultation2Id = c2.rows[0].consultation_id;

    // Create Completed Consultation for Doctor 1
    const c3 = await pool.query(`
      INSERT INTO consultations (appointment_id, patient_id, doctor_id, branch_id, status, chief_complaint, primary_diagnosis_text)
      VALUES ($1, $2, $3, 1, 'completed', 'Completed Complaint', 'Completed Diagnosis')
      RETURNING consultation_id
    `, [appt3.rows[0].appointment_id, patient1Id, doctor1Id]);
    completedConsultationId = c3.rows[0].consultation_id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await pool.query(`DELETE FROM treatment_plans WHERE patient_id IN ($1, $2)`, [patient1Id, patient2Id]);
    await pool.query(`DELETE FROM consultations WHERE patient_id IN ($1, $2)`, [patient1Id, patient2Id]);
    await pool.query(`DELETE FROM appointments WHERE patient_id IN ($1, $2)`, [patient1Id, patient2Id]);
    await pool.query(`DELETE FROM patients WHERE patient_id IN ($1, $2)`, [patient1Id, patient2Id]);
  });

  // 1. Authentication & Authorization
  describe('1. Authentication & Authorization Enforcement', () => {
    test('1.1 Request without JWT returns 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/doctor/treatment-plans/mine');
      expect(res.status).toBe(401);
    });

    test('1.2 Request with invalid JWT returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine')
        .set('Authorization', 'Bearer invalid.token.payload');
      expect(res.status).toBe(403);
    });

    test('1.3 Request with expired JWT returns 403 Forbidden', async () => {
      const expiredToken = jwt.sign(
        { user_id: 321, role: 'doctor', exp: Math.floor(Date.now() / 1000) - 10 },
        jwtSecret
      );
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(403);
    });

    test('1.4 Receptionist role is forbidden (403) from accessing Doctor treatment plans', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine')
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(res.status).toBe(403);
    });

    test('1.5 Doctor role is authorized (200) to access Doctor treatment plans', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // 2. Creation & Validation
  describe('2. Treatment Plan Creation & Server-side Business Rules', () => {
    test('2.1 Missing required fields returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/treatment-plans')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultation_id: consultation1Id,
          // treatment_name missing
          treatment_type: 'Procedure',
          start_date: '2026-09-01',
          duration: 15,
          duration_unit: 'days'
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('2.2 Duration <= 0 or non-integer returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/treatment-plans')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultation_id: consultation1Id,
          treatment_name: 'Invalid Duration Plan',
          treatment_type: 'Procedure',
          start_date: '2026-09-01',
          duration: -5,
          duration_unit: 'days'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/positive integer/i);
    });

    test('2.3 Invalid start_date format returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/treatment-plans')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultation_id: consultation1Id,
          treatment_name: 'Invalid Date Plan',
          treatment_type: 'Procedure',
          start_date: 'not-a-valid-date',
          duration: 15,
          duration_unit: 'days'
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid start_date format/i);
    });

    test('2.4 Attempting to create treatment plan for completed consultation returns 422 (Rule 7 & 16)', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/treatment-plans')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultation_id: completedConsultationId,
          treatment_name: 'Late Treatment Addition',
          treatment_type: 'Procedure',
          start_date: '2026-09-01',
          duration: 10,
          duration_unit: 'days'
        });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/completed consultation/i);
    });

    test('2.5 Doctor 1 attempting to create treatment plan for Doctor 2 consultation returns 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/treatment-plans')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultation_id: consultation2Id, // belongs to Doctor 2
          treatment_name: 'Cross Doctor Plan',
          treatment_type: 'Procedure',
          start_date: '2026-09-01',
          duration: 10,
          duration_unit: 'days'
        });
      expect(res.status).toBe(403);
    });

    test('2.6 Valid creation computes end_date server-side and overrides client end_date (Rule 9)', async () => {
      const res = await request(app)
        .post('/api/v1/doctor/treatment-plans')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultation_id: consultation1Id,
          treatment_name: 'Acupuncture Regimen',
          treatment_type: 'Procedure',
          start_date: '2026-09-01',
          duration: 14,
          duration_unit: 'days',
          frequency: 'Daily morning',
          instructions: 'Drink warm water before session',
          treatment_notes: 'Initial clinical assessment',
          end_date: '2099-12-31' // should be computed server-side to 2026-09-15
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.treatment_name).toBe('Acupuncture Regimen');
      expect(res.body.data.start_date).toBe('2026-09-01');
      expect(res.body.data.end_date).toBe('2026-09-15');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.branch_id).toBe(1);

      treatmentPlan1Id = res.body.data.treatment_id;
    });

    test('2.7 Server-side end_date computation handles weeks and months accurately', async () => {
      // 2 weeks
      const resWeeks = await request(app)
        .post('/api/v1/doctor/treatment-plans')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultation_id: consultation1Id,
          treatment_name: 'Homeopathy Weekly Dosage',
          treatment_type: 'Homeopathy',
          start_date: '2026-09-01',
          duration: 2,
          duration_unit: 'weeks'
        });
      expect(resWeeks.status).toBe(201);
      expect(resWeeks.body.data.end_date).toBe('2026-09-15');

      // 1 month
      const resMonths = await request(app)
        .post('/api/v1/doctor/treatment-plans')
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          consultation_id: consultation1Id,
          treatment_name: 'Monthly Diet Therapy',
          treatment_type: 'Diet',
          start_date: '2026-09-01',
          duration: 1,
          duration_unit: 'months'
        });
      expect(resMonths.status).toBe(201);
      expect(resMonths.body.data.end_date).toBe('2026-10-01');
    });
  });

  // 3. Doctor Data Isolation & Retrieval
  describe('3. Doctor Data Isolation & Scoping', () => {
    test('3.1 Doctor 1 sees treatment plan created under Doctor 1', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      const plan = res.body.data.find(p => p.treatment_id === treatmentPlan1Id);
      expect(plan).toBeDefined();
      expect(plan.patient_name).toBe('Audit Test Patient One');
      expect(plan.registration_id).toBe('REG-TP-001');
    });

    test('3.2 Doctor 2 CANNOT see treatment plan created under Doctor 1', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine')
        .set('Authorization', `Bearer ${doctor2Token}`);
      expect(res.status).toBe(200);
      const plan = res.body.data.find(p => p.treatment_id === treatmentPlan1Id);
      expect(plan).toBeUndefined();
    });

    test('3.3 Doctor 2 accessing Doctor 1 treatment plan details returns 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/doctor/treatment-plans/${treatmentPlan1Id}`)
        .set('Authorization', `Bearer ${doctor2Token}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    test('3.4 Doctor 1 accessing own treatment plan details returns 200 with full joined details', async () => {
      const res = await request(app)
        .get(`/api/v1/doctor/treatment-plans/${treatmentPlan1Id}`)
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.treatment_id).toBe(treatmentPlan1Id);
      expect(res.body.data.treatment_name).toBe('Acupuncture Regimen');
      expect(res.body.data.patient_name).toBe('Audit Test Patient One');
      expect(res.body.data.registration_id).toBe('REG-TP-001');
      expect(res.body.data.doctor_name).toBeDefined();
    });

    test('3.5 Non-existent treatment plan ID returns 404', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/9999999')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(404);
    });
  });

  // 4. Server-Side Search & Filters
  describe('4. Server-Side Search & Status Filtering', () => {
    test('4.1 Search by exact treatment name returns matching plan', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine?search=Acupuncture Regimen')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some(p => p.treatment_id === treatmentPlan1Id)).toBe(true);
    });

    test('4.2 Search by partial treatment name is case-insensitive', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine?search=acupu')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some(p => p.treatment_id === treatmentPlan1Id)).toBe(true);
    });

    test('4.3 Search by patient name matches patient records', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine?search=Audit Test Patient One')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some(p => p.treatment_id === treatmentPlan1Id)).toBe(true);
    });

    test('4.4 Search by registration ID matches patient records', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine?search=REG-TP-001')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some(p => p.treatment_id === treatmentPlan1Id)).toBe(true);
    });

    test('4.5 Search with non-existent keyword returns empty array', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine?search=NONEXISTENT_KEYWORD_XYZ')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    test('4.6 Filter by status=active returns active plans', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine?status=active')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(p => {
        expect(p.status).toBe('active');
      });
    });

    test('4.7 Filter by status=completed returns only completed plans', async () => {
      const res = await request(app)
        .get('/api/v1/doctor/treatment-plans/mine?status=completed')
        .set('Authorization', `Bearer ${doctor1Token}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(p => {
        expect(p.status).toBe('completed');
      });
    });
  });

  // 5. Update & Status Lifecycle
  describe('5. Status Lifecycle Transitions & Updates', () => {
    test('5.1 Updating instructions and notes persists to database', async () => {
      const res = await request(app)
        .put(`/api/v1/doctor/treatment-plans/${treatmentPlan1Id}`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          instructions: 'Updated: perform 20 mins stretching prior to session',
          treatment_notes: 'Patient reports reduced knee stiffness'
        });
      expect(res.status).toBe(200);
      expect(res.body.data.instructions).toBe('Updated: perform 20 mins stretching prior to session');
      expect(res.body.data.treatment_notes).toBe('Patient reports reduced knee stiffness');

      // Verify in DB directly
      const dbCheck = await pool.query(`SELECT * FROM treatment_plans WHERE treatment_id = $1`, [treatmentPlan1Id]);
      expect(dbCheck.rows[0].instructions).toBe('Updated: perform 20 mins stretching prior to session');
    });

    test('5.2 Invalid status transition returns 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .put(`/api/v1/doctor/treatment-plans/${treatmentPlan1Id}`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({ status: 'on_hold' });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/Invalid status/i);
    });

    test('5.3 Doctor 2 attempting to update Doctor 1 treatment plan returns 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/doctor/treatment-plans/${treatmentPlan1Id}`)
        .set('Authorization', `Bearer ${doctor2Token}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(403);
    });

    test('5.4 Transitioning status from active to completed succeeds', async () => {
      const res = await request(app)
        .put(`/api/v1/doctor/treatment-plans/${treatmentPlan1Id}`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });

    test('5.5 Completed treatment plan status cannot be altered (terminal state)', async () => {
      const res = await request(app)
        .put(`/api/v1/doctor/treatment-plans/${treatmentPlan1Id}`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({ status: 'active' });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/Cannot change status of a completed treatment plan/i);
    });
  });
});
