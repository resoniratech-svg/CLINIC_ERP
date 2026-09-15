const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const db = require('../src/db');
const emailService = require('../src/services/email.service');

describe('Super Admin Self-Email Password Recovery Suite', () => {
  let superAdminUser;
  let doctorUser;
  let receptionistUser;
  let originalSendEmail;
  let lastSentMail = null;

  beforeAll(async () => {
    // Intercept emailService to capture sent emails in tests
    originalSendEmail = emailService.sendSuperAdminRecoveryEmail;

    // Fetch test users
    const saRes = await db.query(`SELECT * FROM users WHERE role = 'super_admin' ORDER BY user_id ASC LIMIT 1`);
    superAdminUser = saRes.rows[0];

    const docRes = await db.query(`SELECT * FROM users WHERE role = 'doctor' ORDER BY user_id ASC LIMIT 1`);
    doctorUser = docRes.rows[0];

    const recRes = await db.query(`SELECT * FROM users WHERE role = 'receptionist' ORDER BY user_id ASC LIMIT 1`);
    receptionistUser = recRes.rows[0];
  });

  beforeEach(async () => {
    lastSentMail = null;
    emailService.sendSuperAdminRecoveryEmail = async (opts) => {
      lastSentMail = opts;
      return { messageId: 'test-mail-id-123', accepted: [opts.to] };
    };

    // Clean up recovery table for clean tests
    await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);
    await db.query(`
      UPDATE users
      SET temporary_password_hash = NULL,
          temporary_password_expires_at = NULL,
          temporary_password_used_at = NULL,
          password_reset_required = false,
          must_change_password = false
      WHERE user_id = $1
    `, [superAdminUser.user_id]);
  });

  afterAll(async () => {
    emailService.sendSuperAdminRecoveryEmail = originalSendEmail;
    // Reset admin password to default test password 'SuperAdmin@123'
    const resetHash = await bcrypt.hash('SuperAdmin@123', 10);
    await db.query(`
      UPDATE users
      SET password_hash = $1,
          temporary_password_hash = NULL,
          temporary_password_expires_at = NULL,
          temporary_password_used_at = NULL,
          password_reset_required = false,
          must_change_password = false
      WHERE user_id = $1
    `, [superAdminUser.user_id]);
  });

  describe('1. Role Detection & Workflow Routing', () => {
    test('Non-Super-Admin (Doctor) submits forgot password -> routed to Authorization Queue', async () => {
      // Clean previous requests
      await db.query(`DELETE FROM password_reset_requests WHERE user_id = $1`, [doctorUser.user_id]);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: doctorUser.username, reason: 'Doctor forgot password' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workflow).toBe('authorization_queue');

      // Verify row in password_reset_requests
      const qRes = await db.query(
        `SELECT * FROM password_reset_requests WHERE user_id = $1 AND status = 'pending'`,
        [doctorUser.user_id]
      );
      expect(qRes.rows.length).toBeGreaterThan(0);

      // Verify NO email was dispatched
      expect(lastSentMail).toBeNull();
    });

    test('Non-Super-Admin (Receptionist) submits forgot password -> routed to Authorization Queue', async () => {
      await db.query(`DELETE FROM password_reset_requests WHERE user_id = $1`, [receptionistUser.user_id]);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: receptionistUser.employee_id, reason: 'Forgot code' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workflow).toBe('authorization_queue');
      expect(lastSentMail).toBeNull();
    });

    test('Non-existent account returns generic success without enumeration leak', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: 'non_existent_ghost_user_99999' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workflow).toBe('generic');
      expect(res.body.message).toContain('If the supplied account is eligible');
      expect(lastSentMail).toBeNull();
    });

    test('Super Admin submits forgot password -> triggers Self-Email recovery', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username, reason: 'Lost keycard' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workflow).toBe('self_email');
      expect(res.body.data.recovery_email).toBe('wecarehomeopathyknr@gmail.com');

      // Email MUST have been triggered
      expect(lastSentMail).not.toBeNull();
      expect(lastSentMail.to).toBe('wecarehomeopathyknr@gmail.com');
      expect(typeof lastSentMail.tempPassword).toBe('string');
      expect(lastSentMail.tempPassword.length).toBeGreaterThanOrEqual(10);

      // Must NOT be in password_reset_requests
      const prr = await db.query(
        `SELECT * FROM password_reset_requests WHERE user_id = $1 AND status = 'pending'`,
        [superAdminUser.user_id]
      );
      expect(prr.rows.length).toBe(0);

      // Must be in super_admin_password_recovery
      const sar = await db.query(
        `SELECT * FROM super_admin_password_recovery WHERE user_id = $1`,
        [superAdminUser.user_id]
      );
      expect(sar.rows.length).toBe(1);
      expect(sar.rows[0].recovery_status).toBe('sent');
      expect(sar.rows[0].email_destination).toBe('wecarehomeopathyknr@gmail.com');
    });

    test('Super Admin normalization: works with whitespace, uppercase, and aliases', async () => {
      // Clear cooldown
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: '   ADMIN   ' });

      expect(res.status).toBe(200);
      expect(res.body.data.workflow).toBe('self_email');
      expect(lastSentMail).not.toBeNull();
    });
  });

  describe('2. Temporary Password Security & Lifetime', () => {
    test('Temporary password is NOT stored in plaintext in the database', async () => {
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });

      expect(lastSentMail).not.toBeNull();
      const generatedTempPassword = lastSentMail.tempPassword;

      const userRow = (await db.query(`SELECT * FROM users WHERE user_id = $1`, [superAdminUser.user_id])).rows[0];
      expect(userRow.temporary_password_hash).not.toBeNull();
      expect(userRow.temporary_password_hash).not.toBe(generatedTempPassword);
      // Verify bcrypt hash validity
      const isValidBcrypt = await bcrypt.compare(generatedTempPassword, userRow.temporary_password_hash);
      expect(isValidBcrypt).toBe(true);

      const recRow = (await db.query(`SELECT * FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id])).rows[0];
      expect(JSON.stringify(recRow)).not.toContain(generatedTempPassword);
    });

    test('Expired temporary password is rejected on login', async () => {
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });

      const tempPass = lastSentMail.tempPassword;

      // Force temporary password to have expired 10 minutes ago
      await db.query(`
        UPDATE users
        SET temporary_password_expires_at = NOW() - INTERVAL '10 minutes'
        WHERE user_id = $1
      `, [superAdminUser.user_id]);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: superAdminUser.username, password: tempPass });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body.message).toContain('Temporary password expired');
    });

    test('Valid temporary password login forces password change and marks single-use', async () => {
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });

      const tempPass = lastSentMail.tempPassword;

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: superAdminUser.username, password: tempPass });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.must_change_password).toBe(true);
      expect(loginRes.body.data.user.requires_password_change).toBe(true);

      // Verify single-use: temporary_password_used_at is stamped
      const userCheck = (await db.query(`SELECT temporary_password_used_at FROM users WHERE user_id = $1`, [superAdminUser.user_id])).rows[0];
      expect(userCheck.temporary_password_used_at).not.toBeNull();

      // Second login attempt with same temporary password MUST fail
      const secondLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: superAdminUser.username, password: tempPass });

      expect(secondLogin.status).toBe(401);
      expect(secondLogin.body.message).toContain('already been used');
    });
  });

  describe('3. Password Change & Invalidation', () => {
    test('Super Admin changes password using temporary password -> temporary password completely cleared', async () => {
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });

      const tempPass = lastSentMail.tempPassword;

      // Log in with temporary password to get token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: superAdminUser.username, password: tempPass });

      const token = loginRes.body.data.token;
      expect(token).toBeDefined();

      const newPermanentPass = 'NewAdminPass@2026!';

      // Change password using temporary password as old_password
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          old_password: tempPass,
          new_password: newPermanentPass
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Verify DB state: temporary credentials cleared
      const updatedUser = (await db.query(`SELECT * FROM users WHERE user_id = $1`, [superAdminUser.user_id])).rows[0];
      expect(updatedUser.temporary_password_hash).toBeNull();
      expect(updatedUser.temporary_password_expires_at).toBeNull();
      expect(updatedUser.temporary_password_used_at).toBeNull();
      expect(updatedUser.must_change_password).toBe(false);
      expect(updatedUser.password_reset_required).toBe(false);

      // Verify recovery table marked completed
      const rec = (await db.query(`SELECT * FROM super_admin_password_recovery WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [superAdminUser.user_id])).rows[0];
      expect(rec.recovery_status).toBe('completed');
      expect(rec.completed_at).not.toBeNull();

      // Old temporary password never works again
      const deadTempLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: superAdminUser.username, password: tempPass });
      expect(deadTempLogin.status).toBe(401);

      // New permanent password works normally
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: superAdminUser.username, password: newPermanentPass });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.user.must_change_password).toBe(false);
    });
  });

  describe('4. Multiple Requests & Invalidation', () => {
    test('New recovery request supersedes and invalidates previously active temporary password', async () => {
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      // Request 1
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });
      const passA = lastSentMail.tempPassword;

      // Clear cooldown so second request is accepted
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      // Request 2
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });
      const passB = lastSentMail.tempPassword;

      expect(passA).not.toBe(passB);

      // Attempt login with passA -> MUST fail
      const loginA = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: superAdminUser.username, password: passA });
      expect(loginA.status).toBe(401);

      // Attempt login with passB -> MUST succeed
      const loginB = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: superAdminUser.username, password: passB });
      expect(loginB.status).toBe(200);
      expect(loginB.body.data.user.must_change_password).toBe(true);
    });
  });

  describe('5. Rate Limiting & Cooldown Protection', () => {
    test('Rapid consecutive requests are throttled with 429 cooldown', async () => {
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      // Request 1
      const res1 = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });
      expect(res1.status).toBe(200);

      // Immediate Request 2 (within 60s) -> MUST return 429
      const res2 = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });
      expect(res2.status).toBe(429);
      expect(res2.body.message).toContain('Too many recovery requests');
    });
  });

  describe('6. Email Delivery Failure & Rollback', () => {
    test('If email sending throws error, temporary password is rolled back and not active', async () => {
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);

      // Simulate email transport crash
      emailService.sendSuperAdminRecoveryEmail = async () => {
        throw new Error('SMTP connection timed out');
      };

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('Unable to complete password recovery');

      // Verify users table rolled back
      const userCheck = (await db.query(`SELECT * FROM users WHERE user_id = $1`, [superAdminUser.user_id])).rows[0];
      expect(userCheck.temporary_password_hash).toBeNull();
      expect(userCheck.password_reset_required).toBe(false);

      // Verify recovery table marked failed
      const recCheck = (await db.query(`SELECT * FROM super_admin_password_recovery WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [superAdminUser.user_id])).rows[0];
      expect(recCheck.recovery_status).toBe('failed');
      expect(recCheck.failure_reason).toContain('SMTP connection timed out');
    });
  });

  describe('7. Security Audit Logging', () => {
    test('Audit logs capture recovery events without exposing credentials', async () => {
      await db.query(`DELETE FROM super_admin_password_recovery WHERE user_id = $1`, [superAdminUser.user_id]);
      emailService.sendSuperAdminRecoveryEmail = async (opts) => {
        lastSentMail = opts;
        return { messageId: 'audit-test' };
      };

      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: superAdminUser.username });

      const auditLogs = await db.query(`
        SELECT * FROM audit_logs
        WHERE user_id = $1 AND action IN ('SUPER_ADMIN_PASSWORD_RESET_REQUESTED', 'SUPER_ADMIN_RECOVERY_EMAIL_SENT')
        ORDER BY id DESC LIMIT 5
      `, [superAdminUser.user_id]);

      expect(auditLogs.rows.length).toBeGreaterThanOrEqual(2);

      // Verify no passwords in remarks
      for (const log of auditLogs.rows) {
        expect(log.remarks).not.toContain(lastSentMail.tempPassword);
      }
    });
  });
});
