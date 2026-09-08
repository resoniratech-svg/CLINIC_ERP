const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('Pharmacy User Profile & Security Settings Integration Test Suite', () => {
  let pharmacyToken;
  let adminToken;
  let doctorToken;
  let receptionistToken;
  let pharmacyUserId;
  let originalProfile;

  beforeAll(async () => {
    // 1. Authenticate Pharmacy User
    const phaLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'peter_pharmacy', password: 'Password@123' });
    expect(phaLogin.status).toBe(200);
    pharmacyToken = phaLogin.body.data.token;
    pharmacyUserId = phaLogin.body.data.user.user_id;

    // 2. Authenticate Super Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = adminLogin.body.data.token;

    // 3. Authenticate Doctor
    const docLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'dr_smith', password: 'Password@123' });
    doctorToken = docLogin.body.data.token;

    // 4. Authenticate Receptionist
    const recLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rita_rec', password: 'Password@123' });
    receptionistToken = recLogin.body.data.token;

    // 5. Snapshot original profile state from DB
    const uRes = await db.query(`
      SELECT full_name, mobile_number, email, role, branch_id, status, employee_id
      FROM users WHERE user_id = $1
    `, [pharmacyUserId]);
    originalProfile = uRes.rows[0];
  });

  afterAll(async () => {
    // Restore original profile state
    if (pharmacyUserId && originalProfile) {
      await db.query(`
        UPDATE users
        SET full_name = $1, mobile_number = $2, email = $3, role = $4, branch_id = $5, status = $6, employee_id = $7
        WHERE user_id = $8
      `, [
        originalProfile.full_name,
        originalProfile.mobile_number,
        originalProfile.email,
        originalProfile.role,
        originalProfile.branch_id,
        originalProfile.status,
        originalProfile.employee_id,
        pharmacyUserId
      ]);
    }
    await db.pool.end();
  });

  describe('1. RBAC & Route Access Control', () => {
    it('should reject unauthenticated GET /pharmacy/profile with 401', async () => {
      const res = await request(app).get('/api/v1/pharmacy/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated PUT /pharmacy/profile with 401', async () => {
      const res = await request(app).put('/api/v1/pharmacy/profile').send({ full_name: 'Test' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthorized role (doctor) with 403', async () => {
      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthorized role (receptionist) with 403', async () => {
      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should permit pharmacy role to access GET /pharmacy/profile', async () => {
      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${pharmacyToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should permit super_admin role to access GET /pharmacy/profile', async () => {
      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Dynamic Profile Query & Attribute Resolution', () => {
    it('should return complete user, employee, and branch metadata from PostgreSQL', async () => {
      const res = await request(app)
        .get('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${pharmacyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data.user_id).toBe(pharmacyUserId);
      expect(data.username).toBe('peter_pharmacy');
      expect(data.role).toBe('pharmacy');
      expect(data.status).toBe('active');
      expect(data.employee_id).toBe('PHA001');
      expect(data.branch_id).toBe(1);
      expect(data.branch_name).toBeTruthy();
      expect(typeof data.full_name).toBe('string');
      expect(typeof data.mobile_number).toBe('string');
      expect(typeof data.email).toBe('string');
    });
  });

  describe('3. Contact Details Update & Data Validation', () => {
    it('should reject empty or whitespace full_name with 400', async () => {
      const res = await request(app)
        .put('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ full_name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Full name cannot be empty/i);
    });

    it('should reject invalid mobile number format with 400', async () => {
      const res = await request(app)
        .put('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ mobile_number: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid mobile number/i);
    });

    it('should reject invalid email format with 400', async () => {
      const res = await request(app)
        .put('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ email: 'bad-email-format' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid email/i);
    });

    it('should successfully update contact details and reflect in PostgreSQL', async () => {
      const res = await request(app)
        .put('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          full_name: 'Peter Pharmacy Senior Lead',
          mobile_number: '9888877771',
          email: 'peter.senior@clinic.org'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.full_name).toBe('Peter Pharmacy Senior Lead');
      expect(res.body.data.mobile_number).toBe('9888877771');
      expect(res.body.data.email).toBe('peter.senior@clinic.org');
      expect(res.body.data.branch_name).toBeTruthy();

      // Check database directly
      const dbRow = await db.query(`SELECT full_name, mobile_number, email FROM users WHERE user_id = $1`, [pharmacyUserId]);
      expect(dbRow.rows[0].full_name).toBe('Peter Pharmacy Senior Lead');
      expect(dbRow.rows[0].mobile_number).toBe('9888877771');
      expect(dbRow.rows[0].email).toBe('peter.senior@clinic.org');
    });

    it('should prevent tampering with role, branch_id, status, or employee_id', async () => {
      const res = await request(app)
        .put('/api/v1/pharmacy/profile')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          full_name: 'Peter Pharmacy Secure',
          role: 'super_admin',
          branch_id: 999,
          employee_id: 'HACK999',
          status: 'suspended'
        });

      expect(res.status).toBe(200);

      // Verify immutable attributes in DB
      const dbRow = await db.query(`
        SELECT role, branch_id, employee_id, status FROM users WHERE user_id = $1
      `, [pharmacyUserId]);
      expect(dbRow.rows[0].role).toBe('pharmacy');
      expect(dbRow.rows[0].branch_id).toBe(1);
      expect(dbRow.rows[0].employee_id).toBe('PHA001');
      expect(dbRow.rows[0].status).toBe('active');
    });
  });

  describe('4. Password Change Security Flow', () => {
    it('should reject missing old or new password with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ old_password: 'Password@123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject incorrect current password with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ old_password: 'WrongPassword!', new_password: 'NewValidPassword@123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Incorrect current password/i);
    });

    it('should reject new password shorter than 6 characters with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ old_password: 'Password@123', new_password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/at least 6 characters/i);
    });

    it('should reject new password if identical to current password with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ old_password: 'Password@123', new_password: 'Password@123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/must be different/i);
    });

    it('should successfully change password, verify authentication with new password, and revert', async () => {
      // Step 1: Change to new password
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ old_password: 'Password@123', new_password: 'NewSecuredPassword@123' });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Step 2: Login with old password fails
      const failedOldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'peter_pharmacy', password: 'Password@123' });
      expect(failedOldLogin.status).toBe(401);

      // Step 3: Login with new password succeeds
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'peter_pharmacy', password: 'NewSecuredPassword@123' });
      expect(newLogin.status).toBe(200);
      const newActiveToken = newLogin.body.data.token;

      // Step 4: Revert back to original password
      const revertRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${newActiveToken}`)
        .send({ old_password: 'NewSecuredPassword@123', new_password: 'Password@123' });
      expect(revertRes.status).toBe(200);

      // Step 5: Verify original password works again
      const restoreCheck = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'peter_pharmacy', password: 'Password@123' });
      expect(restoreCheck.status).toBe(200);
    });
  });
});
