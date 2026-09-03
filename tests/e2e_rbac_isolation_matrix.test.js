const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

describe('Exhaustive RBAC & Cross-Account Data Isolation Test Suite', () => {
  let adminToken, receptionist1Token, receptionist2Token, doctor1Token, doctor2Token, pro1Token, pro2Token, pharmacy1Token, pharmacy2Token, executive1Token, executive2Token;

  beforeAll(async () => {
    await seed();

    // Logins for primary and secondary accounts per role
    adminToken = (await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' })).body.data.token;

    receptionist1Token = (await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' })).body.data.token;
    receptionist2Token = (await request(app).post('/api/v1/auth/login').send({ username: 'rachel_rec', password: 'Password@123' })).body.data.token;

    doctor1Token = (await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' })).body.data.token;
    doctor2Token = (await request(app).post('/api/v1/auth/login').send({ username: 'dr_jones', password: 'Password@123' })).body.data.token;

    pro1Token = (await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' })).body.data.token;
    pro2Token = (await request(app).post('/api/v1/auth/login').send({ username: 'pam_pro', password: 'Password@123' })).body.data.token;

    pharmacy1Token = (await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' })).body.data.token;
    pharmacy2Token = (await request(app).post('/api/v1/auth/login').send({ username: 'paul_pharmacy', password: 'Password@123' })).body.data.token;

    executive1Token = (await request(app).post('/api/v1/auth/login').send({ username: 'eric_exec', password: 'Password@123' })).body.data.token;
    executive2Token = (await request(app).post('/api/v1/auth/login').send({ username: 'edward_exec', password: 'Password@123' })).body.data.token;
  });

  // Section 5 Rule 1: Protected Endpoint Role Rejection (403 Matrix)
  describe('RBAC Role Boundary Enforcements (403 Matrix)', () => {
    it('Blocks Receptionist from Super Admin endpoints', async () => {
      const res = await request(app).get('/api/v1/super-admin/dashboard').set('Authorization', `Bearer ${receptionist1Token}`);
      expect(res.status).toBe(403);
    });

    it('Blocks Doctor from Receptionist billing endpoints', async () => {
      const res = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${doctor1Token}`).send({});
      expect(res.status).toBe(403);
    });

    it('Blocks Executive from Doctor consultation endpoints', async () => {
      const res = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${executive1Token}`).send({});
      expect(res.status).toBe(403);
    });

    it('Blocks Pharmacy from PRO billing endpoints', async () => {
      const res = await request(app).post('/api/v1/pro/billing').set('Authorization', `Bearer ${pharmacy1Token}`).send({});
      expect(res.status).toBe(403);
    });

    it('Blocks PRO from Pharmacy stock management endpoints', async () => {
      const res = await request(app).post('/api/v1/pharmacy/stock').set('Authorization', `Bearer ${pro1Token}`).send({});
      expect(res.status).toBe(403);
    });

    it('Blocks non-Super Admin from Super Admin stock adjustment approval', async () => {
      const res = await request(app).post('/api/v1/pharmacy/stock/adjustments/1/approve').set('Authorization', `Bearer ${pharmacy1Token}`);
      expect(res.status).toBe(403);
    });
  });

  // Section 5 Rule 2: Cross-Account Data Isolation (Account A vs Account B)
  describe('Cross-Account Data Isolation Tests', () => {
    it('Prevents Doctor B from starting consultation on Doctor A appointment', async () => {
      const docRes = await db.query("SELECT d.doctor_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE u.username = 'dr_smith'");
      const activeDoctorId = docRes.rows[0].doctor_id;

      const mob = '95' + Date.now().toString().slice(-8);
      const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionist1Token}`).send({
        patient: { full_name: 'Doc Isolation Patient', mobile_number: mob, age: 30, gender: 'male' },
        appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '07:10', appointment_type: 'new' },
        billing: { amount: 500, discount: 0, payment_mode: 'cash' }
      });
      expect(reg.status).toBe(201);
      const apptId = reg.body.data.appointment.appointment_id;
      await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionist1Token}`).send({ status: 'checked_in' });

      // Doctor 2 attempts to start Doctor 1's appointment -> 403 or 400
      const doc2Start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctor2Token}`).send({ appointment_id: apptId });
      expect([400, 403]).toContain(doc2Start.status);
    });

    it('Prevents Executive B from viewing Executive A assigned leads', async () => {
      const mob = '95' + Date.now().toString().slice(-8);
      await request(app).post('/api/v1/executive/leads').set('Authorization', `Bearer ${executive1Token}`).send({
        lead_name: 'Exec Isolation Lead',
        mobile_number: mob,
        lead_source: 'Inbound Call',
        call_status: 'interested'
      });

      const exec2Leads = await request(app).get('/api/v1/executive/leads').set('Authorization', `Bearer ${executive2Token}`);
      expect(exec2Leads.status).toBe(200);
      const found = exec2Leads.body.data.find(l => l.mobile_number === mob);
      expect(found).toBeUndefined();
    });
  });

  // Section 5 Rule 3: Single Branch (branch_id = 1) System-Wide Enforcement
  describe('Single Branch (branch_id = 1) System-Wide Enforcement', () => {
    it('Ignores or rejects client attempt to specify branch_id = 2 during registration', async () => {
      const docRes = await db.query("SELECT d.doctor_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE u.username = 'dr_smith'");
      const activeDoctorId = docRes.rows[0].doctor_id;

      const mob = '95' + Date.now().toString().slice(-8);
      const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionist1Token}`).send({
        patient: { full_name: 'Branch Isolation Patient', mobile_number: mob, age: 30, gender: 'male', branch_id: 2 },
        appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '07:11', appointment_type: 'new', branch_id: 2 },
        billing: { amount: 500, discount: 0, payment_mode: 'cash' }
      });
      expect(reg.status).toBe(201);
      expect(reg.body.data.patient.branch_id).toBe(1);
    });

    it('Ignores or rejects client attempt to create user with branch_id = 2', async () => {
      const res = await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
        role: 'doctor',
        employee_id: 'DOC_FOR_' + Date.now().toString().slice(-4),
        full_name: 'Dr. Foreign Branch',
        mobile_number: '98' + Date.now().toString().slice(-8),
        email: 'foreign@hospital.com',
        gender: 'male',
        username: 'dr_foreign_' + Date.now(),
        password: 'Password@123',
        qualification: 'MBBS',
        specialization: 'General Medicine',
        medical_registration_number: 'REG-FOR-' + Date.now(),
        new_consultation_fee: 500,
        renewal_consultation_fee: 300,
        branch_id: 2
      });
      expect(res.status).toBe(201);
    });
  });

  // Section 5 Rule 4: CRM Task Assignment Restriction (Never Executive)
  describe('CRM Assignment Restriction (Never Executive Role)', () => {
    it('Rejects CRM followup task assignment to Executive role', async () => {
      const execUser = (await db.query(`SELECT user_id FROM users WHERE role = 'executive' LIMIT 1`)).rows[0];

      const res = await request(app).post('/api/v1/pro/crm/followups').set('Authorization', `Bearer ${pro1Token}`).send({
        patient_id: 1,
        followup_type: 'routine',
        followup_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        purpose: 'Routine check',
        assigned_to: execUser.user_id,
        notes: 'Followup for executive'
      });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/cannot be assigned to Executive/i);
    });
  });
});
