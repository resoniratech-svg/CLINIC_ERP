const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

describe('Comprehensive E2E Confirmation & Routing Audit Suite', () => {
  let adminToken = '';
  let receptionistToken = '';
  let doctor1Token = '';
  let doctor2Token = '';
  let inactiveDoctorToken = '';
  let pharmacyToken = '';

  let doc1Id = null;
  let doc2Id = null;
  let inactiveDocId = null;
  let branch2DocId = null;

  const ts = Date.now();

  beforeAll(async () => {
    // 1. Seed base tables & ensure schemas
    await seed();

    // 2. Admin Login
    const adminLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = adminLogin.body?.data?.token;

    // 3. Receptionist Login
    const recLogin = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
    receptionistToken = recLogin.body?.data?.token;

    // 4. Pharmacy Login
    const pharmLogin = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
    pharmacyToken = pharmLogin.body?.data?.token;

    // 5. Create Doctor 1 (Branch 1, Active)
    const doc1User = `doc_audit1_${ts}`;
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      employee_id: `AUD_D1_${ts}`, full_name: 'Dr. Audit Senior Alpha', mobile_number: `91${ts.toString().slice(-8)}`,
      username: doc1User, password: 'Password@123', role: 'doctor', branch_id: 1,
      doctor_details: { specialization: 'General Physician', new_consultation_fee: 500, start_time: '09:00:00', end_time: '18:00:00', working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
    });
    const doc1Login = await request(app).post('/api/v1/auth/login').send({ username: doc1User, password: 'Password@123' });
    doctor1Token = doc1Login.body?.data?.token;
    const d1Q = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [doc1Login.body.data.user.user_id]);
    doc1Id = d1Q.rows[0].doctor_id;

    // 6. Create Doctor 2 (Branch 1, Active)
    const doc2User = `doc_audit2_${ts}`;
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      employee_id: `AUD_D2_${ts}`, full_name: 'Dr. Audit Senior Beta', mobile_number: `92${ts.toString().slice(-8)}`,
      username: doc2User, password: 'Password@123', role: 'doctor', branch_id: 1,
      doctor_details: { specialization: 'Homeopathy Specialist', new_consultation_fee: 500, start_time: '09:00:00', end_time: '18:00:00', working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
    });
    const doc2Login = await request(app).post('/api/v1/auth/login').send({ username: doc2User, password: 'Password@123' });
    doctor2Token = doc2Login.body?.data?.token;
    const d2Q = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [doc2Login.body.data.user.user_id]);
    doc2Id = d2Q.rows[0].doctor_id;

    // 7. Create Inactive Doctor
    const inactDocUser = `doc_inact_${ts}`;
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      employee_id: `AUD_INA_${ts}`, full_name: 'Dr. Inactive Gamma', mobile_number: `93${ts.toString().slice(-8)}`,
      username: inactDocUser, password: 'Password@123', role: 'doctor', branch_id: 1,
      doctor_details: { specialization: 'Dermatologist', new_consultation_fee: 500, start_time: '09:00:00', end_time: '18:00:00', working_days: ['Monday'] }
    });
    const inactQ = await db.query(`SELECT d.doctor_id, d.user_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE u.username = $1`, [inactDocUser]);
    inactiveDocId = inactQ.rows[0].doctor_id;
    // Mark inactive in doctors and users
    await db.query(`UPDATE doctors SET status = 'inactive' WHERE doctor_id = $1`, [inactiveDocId]);
    await db.query(`UPDATE users SET status = 'inactive' WHERE user_id = $1`, [inactQ.rows[0].user_id]);

    // 8. Create Branch 2 and Doctor in Branch 2
    await db.query(`
      INSERT INTO branches (branch_id, branch_name, branch_code, address, phone_number, status)
      VALUES (2, 'Warangal Branch', 'WGL002', 'Warangal, Telangana', '9876543222', 'active')
      ON CONFLICT (branch_id) DO NOTHING;
    `);
    const docB2User = `doc_b2_${ts}`;
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      employee_id: `AUD_B2_${ts}`, full_name: 'Dr. Branch Two Delta', mobile_number: `94${ts.toString().slice(-8)}`,
      username: docB2User, password: 'Password@123', role: 'doctor', branch_id: 2,
      doctor_details: { specialization: 'Pediatrics', new_consultation_fee: 500, start_time: '09:00:00', end_time: '18:00:00', working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
    });
    const b2Q = await db.query(`SELECT d.doctor_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE u.username = $1`, [docB2User]);
    branch2DocId = b2Q.rows[0].doctor_id;
  });

  // ============================================================
  // 1. NAVIGATION & ROUTING AUDIT
  // ============================================================
  describe('1. Navigation & Routing Audit', () => {
    test('Receptionist API endpoints respond successfully with authorized token', async () => {
      const endpoints = [
        ['GET', '/api/v1/receptionist/dashboard'],
        ['GET', '/api/v1/receptionist/patients/search'],
        ['GET', '/api/v1/receptionist/appointments'],
        ['GET', '/api/v1/receptionist/checkin/waiting'],
        ['GET', '/api/v1/receptionist/active-doctors'],
        ['GET', '/api/v1/receptionist/leads'],
        ['GET', '/api/v1/receptionist/crm/calls'],
        ['GET', '/api/v1/receptionist/my-tasks']
      ];

      for (const [method, path] of endpoints) {
        const res = await request(app)[method.toLowerCase()](path).set('Authorization', `Bearer ${receptionistToken}`);
        expect([200, 304]).toContain(res.status);
        expect(res.body.success).toBe(true);
      }
    });

    test('Doctor API endpoints respond successfully with authorized token', async () => {
      const endpoints = [
        ['GET', '/api/v1/doctor/dashboard'],
        ['GET', '/api/v1/doctor/appointments/today'],
        ['GET', '/api/v1/doctor/queue'],
        ['GET', '/api/v1/doctor/patients'],
        ['GET', '/api/v1/doctor/consultations'],
        ['GET', '/api/v1/doctor/prescriptions/mine'],
        ['GET', '/api/v1/doctor/leaves/mine'],
        ['GET', '/api/v1/doctor/active-doctors']
      ];

      for (const [method, path] of endpoints) {
        const res = await request(app)[method.toLowerCase()](path).set('Authorization', `Bearer ${doctor1Token}`);
        expect([200, 304]).toContain(res.status);
        expect(res.body.success).toBe(true);
      }
    });

    test('Super Admin endpoints respond successfully without regression', async () => {
      const endpoints = [
        ['GET', '/api/v1/dashboard'],
        ['GET', '/api/v1/users'],
        ['GET', '/api/v1/doctors'],
        ['GET', '/api/v1/reports/revenue'],
        ['GET', '/api/v1/logs/audit']
      ];

      for (const [method, path] of endpoints) {
        const res = await request(app)[method.toLowerCase()](path).set('Authorization', `Bearer ${adminToken}`);
        expect([200, 304]).toContain(res.status);
        expect(res.body.success).toBe(true);
      }
    });
  });

  // ============================================================
  // 2. PATIENT EDIT DROPDOWN, VILLAGE/MANDAL & VALIDATION AUDIT
  // ============================================================
  describe('2. Patient Edit Dropdown, Village/Mandal & Validation Audit', () => {
    let patientId = null;
    let originalRegId = null;
    const mob = `95${ts.toString().slice(-8)}`;

    beforeAll(async () => {
      const reg = await request(app).post('/api/v1/receptionist/patients/register')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          full_name: 'Audit Patient Original',
          mobile_number: mob,
          age: 29,
          gender: 'male',
          address: 'Karimnagar Main Road',
          ailment_reason: 'Fever and Cough',
          village_mandal: 'Karimnagar, Karimnagar',
          assigned_doctor_id: doc1Id,
          appointment_date: '2026-10-15',
          appointment_time: '10:00:00',
          payment_amount: 0
        });
      patientId = reg.body.data.patient_id;
      originalRegId = reg.body.data.registration_id;
    });

    test('Village & Mandal master data relationships are valid', async () => {
      const mandals = await db.query(`SELECT id, name FROM master_mandals LIMIT 5`);
      expect(mandals.rows.length).toBeGreaterThan(0);

      const villages = await db.query(`
        SELECT v.id, v.name as village_name, m.name as mandal_name
        FROM master_villages v
        JOIN master_mandals m ON v.mandal_id = m.id
        LIMIT 5
      `);
      expect(villages.rows.length).toBeGreaterThan(0);
      expect(villages.rows[0].village_name).toBeDefined();
      expect(villages.rows[0].mandal_name).toBeDefined();
    });

    test('Patient Edit preserves immutable patient_id and registration_id', async () => {
      const res = await request(app)
        .put(`/api/v1/receptionist/patients/${patientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          full_name: 'Audit Patient Renamed',
          patient_id: 999999, // Should be ignored
          registration_id: 'HACKED-REG-999', // Should be ignored
          age: 30
        });

      expect(res.status).toBe(200);
      expect(res.body.data.patient_id).toBe(patientId);
      expect(res.body.data.registration_id).toBe(originalRegId);
      expect(res.body.data.full_name).toBe('Audit Patient Renamed');
    });

    test('Name validation: empty or whitespace-only is rejected', async () => {
      const res1 = await request(app)
        .put(`/api/v1/receptionist/patients/${patientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ full_name: '' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .put(`/api/v1/receptionist/patients/${patientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ full_name: '   ' });
      expect(res2.status).toBe(400);
    });

    test('Mobile validation: 9 digits, 11 digits, or non-numeric rejected; 10 digits accepted', async () => {
      // 9 digits
      const res9 = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ mobile_number: '987654321' });
      expect(res9.status).toBe(400);

      // 11 digits
      const res11 = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ mobile_number: '98765432100' });
      expect(res11.status).toBe(400);

      // letters
      const resLetters = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ mobile_number: '98765ABCD0' });
      expect(resLetters.status).toBe(400);

      // Valid 10 digits update
      const validMob = `96${ts.toString().slice(-8)}`;
      const resValid = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ mobile_number: validMob });
      expect(resValid.status).toBe(200);
      expect(resValid.body.data.mobile_number).toBe(validMob);
    });

    test('Age validation: negative, 121, or non-numeric rejected; 0 to 120 accepted', async () => {
      const resNeg = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ age: -1 });
      expect(resNeg.status).toBe(400);

      const res121 = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ age: 121 });
      expect(res121.status).toBe(400);

      const resStr = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ age: 'invalid' });
      expect(resStr.status).toBe(400);

      const res0 = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ age: 0 });
      expect(res0.status).toBe(200);

      const res120 = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ age: 120 });
      expect(res120.status).toBe(200);
    });

    test('Gender validation: only male, female, other accepted', async () => {
      const resInv = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ gender: 'alien' });
      expect(resInv.status).toBe(400);

      for (const g of ['male', 'female', 'other']) {
        const res = await request(app).put(`/api/v1/receptionist/patients/${patientId}`).set('Authorization', `Bearer ${receptionistToken}`).send({ gender: g });
        expect(res.status).toBe(200);
        expect(res.body.data.gender).toBe(g);
      }
    });

    test('Doctor portal can edit allowed patient details', async () => {
      const res = await request(app)
        .put(`/api/v1/doctor/patients/${patientId}`)
        .set('Authorization', `Bearer ${doctor1Token}`)
        .send({
          full_name: 'Audit Patient Clinical Check',
          ailment_reason: 'Recurrent Allergic Rhinitis'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.full_name).toBe('Audit Patient Clinical Check');
      expect(res.body.data.ailment_reason).toBe('Recurrent Allergic Rhinitis');
    });
  });

  // ============================================================
  // 3. APPOINTMENT RESCHEDULE & DOCTOR REASSIGNMENT AUDIT
  // ============================================================
  describe('3. Appointment Reschedule & Doctor Reassignment Audit', () => {
    let patientId = null;
    let apptId = null;
    let billId = null;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const futureDate1 = tomorrow.toISOString().split('T')[0];

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 4);
    const futureDate2 = dayAfter.toISOString().split('T')[0];

    beforeAll(async () => {
      const mobA = `97${ts.toString().slice(-8)}`;
      const reg = await request(app).post('/api/v1/receptionist/patients/register')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          full_name: 'Flow Test Patient',
          mobile_number: mobA,
          age: 35,
          gender: 'female',
          village_mandal: 'Karimnagar, Karimnagar',
          assigned_doctor_id: doc1Id,
          appointment_date: futureDate1,
          appointment_time: '10:00:00',
          payment_amount: 500
        });

      patientId = reg.body.data.patient_id;
      apptId = reg.body.data.appointment.appointment_id;
      billId = reg.body.data.bill.bill_id;
    });

    test('Doctor dropdown contains ONLY active branch-authorized doctors', async () => {
      const res = await request(app).get('/api/v1/receptionist/active-doctors').set('Authorization', `Bearer ${receptionistToken}`);
      expect(res.status).toBe(200);
      const docs = res.body.data;
      const docIds = docs.map(d => d.doctor_id);

      expect(docIds).toContain(doc1Id);
      expect(docIds).toContain(doc2Id);
      expect(docIds).not.toContain(inactiveDocId); // Inactive doctor excluded
      expect(docIds).not.toContain(branch2DocId); // Different branch excluded
    });

    test('Past date booking or rescheduling is rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc1Id,
          appointment_date: '2020-01-01',
          appointment_time: '10:00:00',
          reason: 'Attempt past date'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/past/i);
    });

    test('Reschedule flow: same doctor moves from Slot 1 to Slot 2', async () => {
      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc1Id,
          appointment_date: futureDate1,
          appointment_time: '11:00:00',
          reason: 'Patient requested later time slot'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.new_doctor_id).toBe(doc1Id);

      const apptQ = await db.query(`SELECT appointment_time FROM appointments WHERE appointment_id = $1`, [apptId]);
      expect(apptQ.rows[0].appointment_time.slice(0, 5)).toBe('11:00');
    });

    test('Doctor Reassignment flow: Doctor 1 -> Doctor 2 transfers consultation bill', async () => {
      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc2Id,
          appointment_date: futureDate2,
          appointment_time: '14:30:00',
          reason: 'Reassigned for specialized homeopathy care'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.bill_transferred).toBe(true);
      expect(res.body.data.old_doctor_id).toBe(doc1Id);
      expect(res.body.data.new_doctor_id).toBe(doc2Id);

      // Financial Invariants Verification
      const billQ = await db.query(`SELECT * FROM bills WHERE bill_id = $1`, [billId]);
      expect(billQ.rows[0].doctor_id).toBe(doc2Id); // Transferred to Doc 2
      expect(parseFloat(billQ.rows[0].final_amount)).toBe(500);

      const billsCount = await db.query(`SELECT COUNT(*) as c FROM bills WHERE patient_id = $1`, [patientId]);
      expect(parseInt(billsCount.rows[0].c)).toBe(1); // EXACTLY 1 BILL

      const payments = await db.query(`SELECT * FROM payments WHERE patient_id = $1`, [patientId]);
      expect(payments.rows.length).toBe(1); // EXACTLY 1 PAYMENT
      expect(parseFloat(payments.rows[0].amount)).toBe(500); // Amount identical
    });

    test('Doctor revenue attribution reflects the reassignment in reports', async () => {
      // Doctor 2 targets/revenue attribution
      const doc2TargetRes = await request(app).get('/api/v1/doctor/targets/mine').set('Authorization', `Bearer ${doctor2Token}`);
      expect(doc2TargetRes.status).toBe(200);
      expect(doc2TargetRes.body.data.revenue_target.achieved).toBeGreaterThanOrEqual(500);

      // Doctor 1 has 0 revenue for this reassigned consultation
      const doc1TargetRes = await request(app).get('/api/v1/doctor/targets/mine').set('Authorization', `Bearer ${doctor1Token}`);
      expect(doc1TargetRes.status).toBe(200);
      expect(doc1TargetRes.body.data.revenue_target.achieved).toBe(0);

      // Clinic total revenue remains balanced
      const rep = await request(app).get('/api/v1/reports/revenue').set('Authorization', `Bearer ${adminToken}`);
      expect(rep.status).toBe(200);
      expect(rep.body.data.grand_total).toBeGreaterThanOrEqual(500);
    });

    test('Attempting to reassign to inactive doctor is rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: inactiveDocId,
          appointment_date: futureDate2,
          appointment_time: '16:00:00',
          reason: 'Attempt inactive doctor'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/active/i);
    });

    test('Attempting cross-branch doctor assignment is rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: branch2DocId,
          appointment_date: futureDate2,
          appointment_time: '16:00:00',
          reason: 'Attempt cross branch doctor'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/branch/i);
    });

    test('Attempting to reassign to a doctor on approved leave is rejected', async () => {
      // Put Doc 2 on approved leave on futureDate1
      await db.query(`
        INSERT INTO doctor_leaves (doctor_id, from_date, to_date, reason, status)
        VALUES ($1, $2, $2, 'Medical Leave', 'approved')
        ON CONFLICT DO NOTHING
      `, [doc2Id, futureDate1]);

      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc2Id,
          appointment_date: futureDate1,
          appointment_time: '10:00:00',
          reason: 'Attempt booking on leave'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/leave/i);
    });

    test('Double booking prevention: cannot book occupied slot', async () => {
      // apptId is on futureDate2 at 14:30:00 with doc2Id
      // Create another patient
      const mobB = `98${ts.toString().slice(-8)}`;
      const reg2 = await request(app).post('/api/v1/receptionist/patients/register')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          full_name: 'Double Book Candidate',
          mobile_number: mobB,
          age: 22,
          gender: 'male',
          village_mandal: 'Karimnagar, Karimnagar',
          assigned_doctor_id: doc1Id,
          appointment_date: futureDate1,
          appointment_time: '15:00:00'
        });
      const appt2Id = reg2.body.data.appointment.appointment_id;

      // Try moving appt2 to futureDate2 at 14:30:00 with doc2Id
      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${appt2Id}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc2Id,
          appointment_date: futureDate2,
          appointment_time: '14:30:00',
          reason: 'Attempt double booking'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already booked/i);
    });

    test('Immutability: cannot reassign completed consultations', async () => {
      await db.query(`UPDATE appointments SET status = 'completed' WHERE appointment_id = $1`, [apptId]);

      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc1Id,
          appointment_date: futureDate2,
          appointment_time: '17:00:00',
          reason: 'Attempt reassign completed'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/completed/i);
    });

    test('Immutability: cannot reassign cancelled appointments', async () => {
      await db.query(`UPDATE appointments SET status = 'cancelled' WHERE appointment_id = $1`, [apptId]);

      const res = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc1Id,
          appointment_date: futureDate2,
          appointment_time: '17:00:00',
          reason: 'Attempt reassign cancelled'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cancelled/i);
    });

    test('Audit logs contain complete trace of reassignments', async () => {
      const logs = await db.query(`
        SELECT * FROM audit_logs 
        WHERE module = 'Appointments' AND record_id = $1 
        ORDER BY id DESC
      `, [String(apptId)]);

      expect(logs.rows.length).toBeGreaterThan(0);
      expect(logs.rows[0].action).toBe('Reassign Doctor');
      expect(logs.rows[0].user_id).toBeDefined();
    });
  });

  // ============================================================
  // 4. UNPAID AND PARTIAL PAYMENT REASSIGNMENT AUDIT
  // ============================================================
  describe('4. Unpaid and Partial Payment Reassignment Audit', () => {
    test('Unpaid appointment reassigns cleanly: bill doctor transfers, due remains unchanged', async () => {
      const mobUnpaid = `99${ts.toString().slice(-8)}`;
      const targetDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];

      // Register without payment
      const reg = await request(app).post('/api/v1/receptionist/patients/register')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          full_name: 'Unpaid Patient',
          mobile_number: mobUnpaid,
          age: 45,
          gender: 'male',
          village_mandal: 'Karimnagar, Karimnagar',
          assigned_doctor_id: doc1Id,
          appointment_date: targetDate,
          appointment_time: '09:00:00',
          payment_amount: 0 // Unpaid
        });

      const apptId = reg.body.data.appointment.appointment_id;
      const billId = reg.body.data.bill.bill_id;

      // Reassign to Doc 2
      const reassign = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc2Id,
          appointment_date: targetDate,
          appointment_time: '11:30:00',
          reason: 'Unpaid consultation reassigned'
        });

      expect(reassign.status).toBe(200);

      // Verify bill doctor updated
      const bill = await db.query(`SELECT * FROM bills WHERE bill_id = $1`, [billId]);
      expect(bill.rows[0].doctor_id).toBe(doc2Id);
      expect(parseFloat(bill.rows[0].final_amount)).toBe(500);

      // Verify NO payments were created
      const payments = await db.query(`SELECT * FROM payments WHERE bill_id = $1`, [billId]);
      expect(payments.rows.length).toBe(0);
    });

    test('Partial payment reassigns cleanly: partial amount remains intact', async () => {
      const mobPartial = `90${ts.toString().slice(-8)}`;
      const targetDate = new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0];

      // Register with ₹300 partial payment
      const reg = await request(app).post('/api/v1/receptionist/patients/register')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          full_name: 'Partial Patient',
          mobile_number: mobPartial,
          age: 48,
          gender: 'female',
          village_mandal: 'Karimnagar, Karimnagar',
          assigned_doctor_id: doc1Id,
          appointment_date: targetDate,
          appointment_time: '09:30:00',
          payment_amount: 300 // Partial
        });

      const apptId = reg.body.data.appointment.appointment_id;
      const billId = reg.body.data.bill.bill_id;

      // Reassign to Doc 2
      const reassign = await request(app)
        .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          doctor_id: doc2Id,
          appointment_date: targetDate,
          appointment_time: '12:00:00',
          reason: 'Partial payment consultation reassigned'
        });

      expect(reassign.status).toBe(200);

      // Verify bill doctor updated
      const bill = await db.query(`SELECT * FROM bills WHERE bill_id = $1`, [billId]);
      expect(bill.rows[0].doctor_id).toBe(doc2Id);
      expect(parseFloat(bill.rows[0].final_amount)).toBe(500);

      // Verify existing single partial payment remains ₹300
      const payments = await db.query(`SELECT * FROM payments WHERE bill_id = $1`, [billId]);
      expect(payments.rows.length).toBe(1);
      expect(parseFloat(payments.rows[0].amount)).toBe(300);
    });
  });

  afterAll(async () => {
    await db.pool.end();
  });
});
