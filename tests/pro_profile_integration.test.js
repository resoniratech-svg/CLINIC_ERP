const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('PRO Profile & Security Settings Integration Test Suite', () => {
  let proToken;
  let adminToken;
  let execToken;
  let proUserId;
  let originalMobile;
  let originalEmail;

  beforeAll(async () => {
    // 1. Authenticate PRO Manager
    const proLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pat_pro', password: 'Password@123' });
    proToken = proLogin.body?.data?.token;
    proUserId = proLogin.body?.data?.user?.user_id;

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

    // 4. Record original contact details for cleanup
    const uRes = await db.query(`SELECT mobile_number, email FROM users WHERE user_id = $1`, [proUserId]);
    originalMobile = uRes.rows[0]?.mobile_number;
    originalEmail = uRes.rows[0]?.email;
  });

  afterAll(async () => {
    // Restore original contact details
    if (proUserId) {
      await db.query(`UPDATE users SET mobile_number = $1, email = $2 WHERE user_id = $3`, [originalMobile, originalEmail, proUserId]);
    }
    await db.pool.end();
  });

  describe('1. RBAC & Authentication Checks', () => {
    it('should reject unauthenticated request to GET /profile with 401', async () => {
      const res = await request(app).get('/api/v1/pro/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated request to PUT /profile with 401', async () => {
      const res = await request(app).put('/api/v1/pro/profile').send({ mobile_number: '9999999999' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthorized role (executive) with 403', async () => {
      const res = await request(app)
        .get('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow PRO manager to access their profile (200)', async () => {
      const res = await request(app)
        .get('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. PRO Profile Retrieval Details (GET /pro/profile)', () => {
    it('should return complete user, employment, and branch details from PostgreSQL', async () => {
      const res = await request(app)
        .get('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data).toHaveProperty('user_id', proUserId);
      expect(data).toHaveProperty('employee_id');
      expect(data).toHaveProperty('full_name');
      expect(data).toHaveProperty('username');
      expect(data).toHaveProperty('role', 'pro_manager');
      expect(data).toHaveProperty('branch_id');
      expect(data).toHaveProperty('branch_name');
      expect(data).toHaveProperty('branch_code');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('date_of_joining');
      expect(data).toHaveProperty('permissions');
      expect(Array.isArray(data.permissions)).toBe(true);
      expect(data.permissions.length).toBeGreaterThan(0);
    });
  });

  describe('3. Contact Details Update (PUT /pro/profile)', () => {
    it('should successfully update mobile number and email in PostgreSQL', async () => {
      const testMobile = '9112233445';
      const testEmail = 'pat.pro.test@wecare.com';

      const res = await request(app)
        .put('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          mobile_number: testMobile,
          email: testEmail
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mobile_number).toBe(testMobile);
      expect(res.body.data.email).toBe(testEmail);

      // Verify row in PostgreSQL
      const dbCheck = await db.query(`SELECT mobile_number, email FROM users WHERE user_id = $1`, [proUserId]);
      expect(dbCheck.rows[0].mobile_number).toBe(testMobile);
      expect(dbCheck.rows[0].email).toBe(testEmail);
    });

    it('should reject update if both mobile and email are empty (400)', async () => {
      const res = await request(app)
        .put('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ mobile_number: '', email: '' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('At least one contact field');
    });

    it('should reject invalid mobile number format (400)', async () => {
      const res = await request(app)
        .put('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ mobile_number: '123' }); // Too short

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid mobile number format');
    });

    it('should reject invalid email format (400)', async () => {
      const res = await request(app)
        .put('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ email: 'not-a-valid-email' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid email format');
    });

    it('should reject duplicate mobile number registered to another user (409)', async () => {
      // Fetch another user with valid 10-digit mobile number
      const otherUser = await db.query(`SELECT mobile_number FROM users WHERE user_id != $1 AND LENGTH(mobile_number) >= 10 LIMIT 1`, [proUserId]);
      if (otherUser.rows.length > 0 && otherUser.rows[0].mobile_number) {
        const res = await request(app)
          .put('/api/v1/pro/profile')
          .set('Authorization', `Bearer ${proToken}`)
          .send({ mobile_number: otherUser.rows[0].mobile_number });

        expect(res.status).toBe(409);
        expect(res.body.message).toContain('already registered to another account');
      }
    });

    it('should successfully update only mobile number when email is omitted', async () => {
      const res = await request(app)
        .put('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ mobile_number: '9876543211' });

      expect(res.status).toBe(200);
      expect(res.body.data.mobile_number).toBe('9876543211');
    });

    it('should prevent tampering with role or employee_id through profile update', async () => {
      const res = await request(app)
        .put('/api/v1/pro/profile')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          role: 'super_admin',
          employee_id: 'HACKED001',
          mobile_number: '9112233445'
        });

      expect(res.status).toBe(200);

      // Verify role in PostgreSQL did NOT change to super_admin
      const dbCheck = await db.query(`SELECT role, employee_id FROM users WHERE user_id = $1`, [proUserId]);
      expect(dbCheck.rows[0].role).toBe('pro_manager');
      expect(dbCheck.rows[0].employee_id).not.toBe('HACKED001');
    });
  });

  describe('4. Password Update Flow (POST /auth/change-password)', () => {
    it('should reject password change with missing fields (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ old_password: 'Password@123' }); // missing new_password

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject password change when new password is shorter than 6 characters (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          old_password: 'Password@123',
          new_password: '12345'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least 6 characters');
    });

    it('should reject password change when new password is identical to current password (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          old_password: 'Password@123',
          new_password: 'Password@123'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('different from current password');
    });

    it('should reject password change with incorrect current password (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          old_password: 'WrongCurrentPassword999!',
          new_password: 'NewValidPassword@123'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Incorrect current password');
    });

    it('should successfully update password and verify authentication with new password', async () => {
      // 1. Change password
      const resChange = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          old_password: 'Password@123',
          new_password: 'TemporaryNewPassword@123'
        });

      expect(resChange.status).toBe(200);
      expect(resChange.body.success).toBe(true);

      // 2. Verify login with old password fails
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'pat_pro', password: 'Password@123' });
      expect(oldLogin.status).toBe(401);

      // 3. Verify login with new password succeeds
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'pat_pro', password: 'TemporaryNewPassword@123' });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.token).toBeDefined();

      const newTempToken = newLogin.body.data.token;

      // 4. Revert password back to original 'Password@123'
      const resRevert = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${newTempToken}`)
        .send({
          old_password: 'TemporaryNewPassword@123',
          new_password: 'Password@123'
        });
      expect(resRevert.status).toBe(200);

      // 5. Verify original login works again
      const restoredLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'pat_pro', password: 'Password@123' });
      expect(restoredLogin.status).toBe(200);
    });
  });
});
