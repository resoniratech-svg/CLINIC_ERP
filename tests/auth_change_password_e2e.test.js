const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const bcrypt = require('bcryptjs');

describe('Auth Change-Password End-to-End Suite', () => {
  let pharmacyUser = null;
  let pharmacyToken = null;
  let doctorUser = null;
  let doctorToken = null;
  let receptionistUser = null;
  let receptionistToken = null;

  const initialPassword = 'Password@123';
  const testBranchId = 1;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Create a dedicated Pharmacy test user
    const phaUsername = `test_pharmacy_${timestamp}`;
    const phaPassHash = await bcrypt.hash(initialPassword, 10);
    const phaRes = await db.query(`
      INSERT INTO users (
        employee_id, full_name, mobile_number, email, username, password_hash, role, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pharmacy', 'active', $7)
      RETURNING *
    `, [`PH_${timestamp}`, 'Test Pharmacist', `911${String(timestamp).slice(-7)}`, `pha_${timestamp}@hospital.com`, phaUsername, phaPassHash, testBranchId]);
    pharmacyUser = phaRes.rows[0];

    // 2. Create a Doctor test user
    const docUsername = `test_doc_${timestamp}`;
    const docPassHash = await bcrypt.hash(initialPassword, 10);
    const docRes = await db.query(`
      INSERT INTO users (
        employee_id, full_name, mobile_number, email, username, password_hash, role, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'doctor', 'active', $7)
      RETURNING *
    `, [`DOC_${timestamp}`, 'Test Doctor', `912${String(timestamp).slice(-7)}`, `doc_${timestamp}@hospital.com`, docUsername, docPassHash, testBranchId]);
    doctorUser = docRes.rows[0];

    // 3. Create a Receptionist test user
    const recUsername = `test_rec_${timestamp}`;
    const recPassHash = await bcrypt.hash(initialPassword, 10);
    const recRes = await db.query(`
      INSERT INTO users (
        employee_id, full_name, mobile_number, email, username, password_hash, role, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'receptionist', 'active', $7)
      RETURNING *
    `, [`REC_${timestamp}`, 'Test Receptionist', `913${String(timestamp).slice(-7)}`, `rec_${timestamp}@hospital.com`, recUsername, recPassHash, testBranchId]);
    receptionistUser = recRes.rows[0];

    // Authenticate Pharmacy user
    const phaLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: phaUsername, password: initialPassword });
    expect(phaLogin.status).toBe(200);
    pharmacyToken = phaLogin.body.data.token;

    // Authenticate Doctor user
    const docLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: docUsername, password: initialPassword });
    expect(docLogin.status).toBe(200);
    doctorToken = docLogin.body.data.token;

    // Authenticate Receptionist user
    const recLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: recUsername, password: initialPassword });
    expect(recLogin.status).toBe(200);
    receptionistToken = recLogin.body.data.token;
  });

  afterAll(async () => {
    const userIds = [pharmacyUser?.user_id, doctorUser?.user_id, receptionistUser?.user_id].filter(Boolean);
    if (userIds.length > 0) {
      await db.query(`DELETE FROM receptionist_permissions WHERE user_id = ANY($1::int[])`, [userIds]);
      await db.query(`DELETE FROM pharmacy_permissions WHERE user_id = ANY($1::int[])`, [userIds]);
      await db.query(`DELETE FROM doctor_permissions WHERE user_id = ANY($1::int[])`, [userIds]);
      await db.query(`DELETE FROM audit_logs WHERE user_id = ANY($1::int[])`, [userIds]);
      await db.query(`DELETE FROM login_logs WHERE user_id = ANY($1::int[])`, [userIds]);
      await db.query(`DELETE FROM users WHERE user_id = ANY($1::int[])`, [userIds]);
    }
  });

  describe('Pharmacy User Password Change Flow', () => {
    const newPassword = 'NewPharmPassword@2026';

    it('TEST 4: should reject incorrect current password with 400 (NOT 500)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          old_password: 'WrongCurrentPassword123',
          new_password: newPassword,
          confirm_password: newPassword
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Incorrect current password/i);
    });

    it('TEST 5: should reject mismatching new password and confirmation with 400 (NOT 500)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          old_password: initialPassword,
          new_password: newPassword,
          confirm_password: 'DifferentPassword@999'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/do not match/i);
    });

    it('TEST 6: should reject new password identical to old password with 400 (NOT 500)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          old_password: initialPassword,
          new_password: initialPassword,
          confirm_password: initialPassword
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/must be different/i);
    });

    it('TEST 7: should reject new password shorter than 6 characters with 400 (NOT 500)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          old_password: initialPassword,
          new_password: '12345',
          confirm_password: '12345'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/at least 6 characters/i);
    });

    it('TEST 1: should successfully change password with valid current, new, and confirm passwords (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          current_password: initialPassword,
          new_password: newPassword,
          confirm_password: newPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Password changed successfully/i);
    });

    it('TEST 3: should reject login with the OLD password (401)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: pharmacyUser.username,
          password: initialPassword
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });

    it('TEST 2: should successfully login with the NEW password (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: pharmacyUser.username,
          password: newPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('pharmacy');
    });

    it('TEST 10: should verify in database that new password is a valid bcrypt hash and flags are cleared', async () => {
      const checkRes = await db.query(
        `SELECT password_hash, must_change_password, temporary_password_hash FROM users WHERE user_id = $1`,
        [pharmacyUser.user_id]
      );
      const userRow = checkRes.rows[0];

      // Must NOT be stored in plaintext
      expect(userRow.password_hash).not.toBe(newPassword);
      expect(userRow.password_hash).toMatch(/^\$2[aby]\$\d+\$/);

      // Verify bcrypt comparison succeeds
      const isValid = await bcrypt.compare(newPassword, userRow.password_hash);
      expect(isValid).toBe(true);

      // Temporary credentials & must_change flags must be cleared
      expect(userRow.must_change_password).toBe(false);
      if (userRow.temporary_password_hash !== undefined) {
        expect(userRow.temporary_password_hash).toBeNull();
      }
    });
  });

  describe('Shared Architecture Across Other Roles', () => {
    it('TEST 8: Doctor role can change password smoothly', async () => {
      const docNewPass = 'DocNewPass@789';
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          old_password: initialPassword,
          new_password: docNewPass
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Login with new password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: doctorUser.username,
          password: docNewPass
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.role).toBe('doctor');
    });

    it('TEST 9: Receptionist role can change password smoothly', async () => {
      const recNewPass = 'RecNewPass@456';
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          old_password: initialPassword,
          new_password: recNewPass
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Login with new password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: receptionistUser.username,
          password: recNewPass
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.role).toBe('receptionist');
    });

    it('Missing auth token returns 401 Access token required', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          old_password: initialPassword,
          new_password: 'SomeNewPassword@123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
