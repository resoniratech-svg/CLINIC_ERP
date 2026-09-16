const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { formatResponse, parseUserAgent, generateTempPassword } = require('../utils/helpers');
const emailService = require('../services/email.service');

/**
 * Helper to record security audit logs without blocking on failure
 */
async function logAuditEvent({
  userId,
  role = 'super_admin',
  action,
  module = 'Security / Authentication',
  recordId = null,
  remarks = null,
  ip = null,
  device = null,
  browser = null,
  branchId = 1
}) {
  try {
    await db.query(`
      INSERT INTO audit_logs (user_id, role, action, module, record_id, remarks, ip_address, device, browser, branch_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [userId, role, action, module, recordId ? String(recordId) : null, remarks, ip, device, browser, branchId]);
  } catch (err) {
    console.warn('Non-fatal: failed to write audit log:', err.message);
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json(formatResponse(false, null, 'Username and password are required'));
    }

    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';
    const { browser, device } = parseUserAgent(ua);
    const trimmedId = username.toString().trim();
    const lowerId = trimmedId.toLowerCase();

    // Find user by username, mobile, employee_id, or normalized super_admin aliases
    const result = await db.query(
      `SELECT u.*, b.branch_name, b.branch_code
       FROM users u
       JOIN branches b ON u.branch_id = b.branch_id
       WHERE LOWER(TRIM(u.username)) = $1
          OR LOWER(TRIM(u.employee_id)) = $1
          OR TRIM(u.mobile_number) = $2
          OR LOWER(TRIM(COALESCE(u.email, ''))) = $1
          OR (LOWER(TRIM(u.role::text)) = 'super_admin' AND $1 IN ('admin', 'superadmin', 'super_admin', 'super-admin', 'super admin'))
       ORDER BY (CASE WHEN LOWER(TRIM(u.role::text)) = 'super_admin' THEN 0 ELSE 1 END), u.user_id ASC
       LIMIT 1`,
      [lowerId, trimmedId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json(formatResponse(false, null, 'Invalid credentials'));
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json(formatResponse(false, null, `Account is ${user.status}`));
    }

    let isTempPasswordLogin = false;
    let isPasswordValid = false;

    // 1. Check if input matches temporary password
    if (user.temporary_password_hash) {
      const tempMatch = await bcrypt.compare(password, user.temporary_password_hash);
      if (tempMatch) {
        // Enforce single-use: cannot be reused once temporary_password_used_at is stamped
        if (user.temporary_password_used_at) {
          return res.status(401).json(formatResponse(false, null, 'Temporary password has already been used. Please request a new password.'));
        }
        // Enforce expiration (e.g. 20 minutes)
        if (user.temporary_password_expires_at && new Date(user.temporary_password_expires_at) < new Date()) {
          await logAuditEvent({
            userId: user.user_id,
            role: user.role,
            action: 'SUPER_ADMIN_RECOVERY_EXPIRED',
            recordId: user.user_id,
            remarks: 'Attempted login with expired temporary password',
            ip, device, browser, branchId: user.branch_id
          });
          return res.status(401).json(formatResponse(false, null, 'Temporary password expired. Please request a new password.'));
        }
        isTempPasswordLogin = true;
        isPasswordValid = true;
      }
    }

    // 2. Check regular password hash
    if (!isPasswordValid) {
      isPasswordValid = await bcrypt.compare(password, user.password_hash);
    }

    if (!isPasswordValid) {
      // Record failed login log
      await db.query(`
        INSERT INTO login_logs (user_id, role, ip_address, device, browser, location, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'failed')
      `, [user.user_id, user.role, ip, device, browser, user.branch_name]);

      return res.status(401).json(formatResponse(false, null, 'Invalid credentials'));
    }

    // If temporary password login was used, stamp usage timestamp and force password change
    if (isTempPasswordLogin) {
      await db.query(`
        UPDATE users
        SET temporary_password_used_at = now(),
            must_change_password = true,
            password_reset_required = true,
            last_login_at = now()
        WHERE user_id = $1
      `, [user.user_id]);

      await db.query(`
        UPDATE super_admin_password_recovery
        SET temporary_password_used_at = now(),
            recovery_status = 'used',
            updated_at = now()
        WHERE user_id = $1 AND recovery_status = 'sent'
      `, [user.user_id]);

      await logAuditEvent({
        userId: user.user_id,
        role: user.role,
        action: 'SUPER_ADMIN_TEMP_PASSWORD_LOGIN',
        recordId: user.user_id,
        remarks: 'Temporary recovery password used for authentication. Password change required.',
        ip, device, browser, branchId: user.branch_id
      });
    } else {
      // Normal login: Update last_login_at
      await db.query(`UPDATE users SET last_login_at = now() WHERE user_id = $1`, [user.user_id]);
    }

    // Record login log
    const loginLogRes = await db.query(`
      INSERT INTO login_logs (user_id, role, ip_address, device, browser, location, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'success') RETURNING id
    `, [user.user_id, user.role, ip, device, browser, user.branch_name]);

    // Fetch granular permissions for role
    let userPermissions = null;
    if (user.role === 'receptionist') {
      const permRes = await db.query(
        `SELECT registration, enquiry, appointment, checkin, consultation_fee_billing,
                payment_collection, crm_calling, followup, renewal, due_management, coupon_management
         FROM receptionist_permissions WHERE user_id = $1`,
        [user.user_id]
      );
      if (permRes.rows.length > 0) {
        userPermissions = permRes.rows[0];
      } else {
        await db.query(
          `INSERT INTO receptionist_permissions (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
          [user.user_id]
        );
        userPermissions = {
          registration: true, enquiry: true, appointment: true, checkin: true,
          consultation_fee_billing: true, payment_collection: true, crm_calling: true,
          followup: true, renewal: true, due_management: true, coupon_management: false
        };
      }
    } else if (user.role === 'pro_manager') {
      const permRes = await db.query(
        `SELECT * FROM pro_manager_permissions WHERE user_id = $1`,
        [user.user_id]
      );
      if (permRes.rows.length > 0) {
        userPermissions = permRes.rows[0];
      } else {
        userPermissions = {
          counselling: true, billing: true, payment: true, due_collection: true,
          crm: true, followup: true, renewals: true, complaints: true,
          feedback: true, reports: true, accountant: true, coupon_management: false
        };
      }
    } else if (user.role === 'doctor') {
      const permRes = await db.query(
        `SELECT * FROM doctor_permissions WHERE user_id = $1`,
        [user.user_id]
      );
      if (permRes.rows.length > 0) {
        userPermissions = permRes.rows[0];
      } else {
        userPermissions = {
          coupon_management: false
        };
      }
    }

    const mustChange = isTempPasswordLogin || Boolean(user.must_change_password) || Boolean(user.password_reset_required);

    const payload = {
      user_id: user.user_id,
      employee_id: user.employee_id,
      full_name: user.full_name,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id,
      login_log_id: loginLogRes.rows[0].id,
      must_change_password: mustChange,
      ...(userPermissions && {
        permissions: userPermissions,
        receptionist_permissions: userPermissions,
        pro_manager_permissions: userPermissions,
        doctor_permissions: userPermissions
      })
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'super_secret_jwt_key_123!', {
      expiresIn: '24h'
    });

    return res.json(formatResponse(true, {
      token,
      user: {
        user_id: user.user_id,
        employee_id: user.employee_id,
        full_name: user.full_name,
        username: user.username,
        mobile_number: user.mobile_number || null,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branch_name || null,
        branch_code: user.branch_code || null,
        department: user.department || null,
        must_change_password: mustChange,
        requires_password_change: mustChange,
        ...(userPermissions && { permissions: userPermissions })
      }
    }, 'Login successful'));

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function logout(req, res) {
  try {
    const userId = req.user.user_id;
    const logId = req.user.login_log_id;

    if (logId) {
      await db.query(`
        UPDATE login_logs
        SET logout_time = now(),
            session_duration_seconds = EXTRACT(EPOCH FROM (now() - login_time))::INTEGER
        WHERE id = $1
      `, [logId]);
    } else {
      await db.query(`
        UPDATE login_logs
        SET logout_time = now(),
            session_duration_seconds = EXTRACT(EPOCH FROM (now() - login_time))::INTEGER
        WHERE user_id = $1 AND logout_time IS NULL
      `, [userId]);
    }

    return res.json(formatResponse(true, null, 'Logged out successfully'));
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function changePassword(req, res) {
  try {
    const old_password = req.body.old_password || req.body.current_password || req.body.currentPassword;
    const new_password = req.body.new_password || req.body.newPassword;
    const confirm_password = req.body.confirm_password || req.body.confirmPassword;

    if (!old_password || !new_password) {
      return res.status(400).json(formatResponse(false, null, 'Current password and new password are required'));
    }

    if (confirm_password && new_password !== confirm_password) {
      return res.status(400).json(formatResponse(false, null, 'New password and confirm password do not match'));
    }

    if (String(new_password).length < 6) {
      return res.status(400).json(formatResponse(false, null, 'New password must be at least 6 characters'));
    }

    if (old_password === new_password) {
      return res.status(400).json(formatResponse(false, null, 'New password must be different from current password'));
    }

    const userId = req.user && req.user.user_id;
    if (!userId) {
      return res.status(401).json(formatResponse(false, null, 'Authentication required'));
    }

    const userRes = await db.query(
      `SELECT u.* FROM users u WHERE u.user_id = $1`,
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User not found'));
    }
    const user = userRes.rows[0];

    if (!user.password_hash) {
      return res.status(400).json(formatResponse(false, null, 'No password set for this account. Please contact administrator'));
    }

    let isMatchNormal = false;
    try {
      isMatchNormal = await bcrypt.compare(old_password, user.password_hash);
    } catch (cmpErr) {
      console.error('Password hash comparison error:', cmpErr.message);
    }

    let isMatchTemp = false;
    if (user.temporary_password_hash && typeof user.temporary_password_hash === 'string') {
      try {
        isMatchTemp = await bcrypt.compare(old_password, user.temporary_password_hash);
      } catch (cmpErr) {
        console.error('Temporary password hash comparison error:', cmpErr.message);
      }
    }

    if (!isMatchNormal && !isMatchTemp) {
      return res.status(400).json(formatResponse(false, null, 'Incorrect current password'));
    }

    const newHash = await bcrypt.hash(new_password, 10);

    // Dynamically check which optional columns exist in users table to prevent SQL errors if migrations are in-flight
    const colCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('temporary_password_hash', 'must_change_password', 'password_reset_required', 'temporary_password_expires_at', 'temporary_password_used_at')
    `);
    const existingCols = new Set(colCheck.rows.map(r => r.column_name));

    let updateSql = `UPDATE users SET password_hash = $1, updated_at = now()`;
    if (existingCols.has('must_change_password')) {
      updateSql += `, must_change_password = false`;
    }
    if (existingCols.has('password_reset_required')) {
      updateSql += `, password_reset_required = false`;
    }
    if (existingCols.has('temporary_password_hash')) {
      updateSql += `, temporary_password_hash = NULL`;
    }
    if (existingCols.has('temporary_password_expires_at')) {
      updateSql += `, temporary_password_expires_at = NULL`;
    }
    if (existingCols.has('temporary_password_used_at')) {
      updateSql += `, temporary_password_used_at = NULL`;
    }
    updateSql += ` WHERE user_id = $2`;

    await db.query(updateSql, [newHash, userId]);

    if (user.role === 'super_admin') {
      try {
        await db.query(`
          UPDATE super_admin_password_recovery
          SET recovery_status = 'completed', completed_at = now(), updated_at = now()
          WHERE user_id = $1 AND recovery_status IN ('sent', 'used')
        `, [userId]);
      } catch (recErr) {
        // Table may not exist in legacy setups
      }

      try {
        await logAuditEvent({
          userId,
          role: user.role,
          action: 'SUPER_ADMIN_PASSWORD_CHANGED',
          recordId: userId,
          remarks: 'Super Admin password successfully changed. Temporary credentials cleared.',
          ip: req.ip || '127.0.0.1',
          branchId: user.branch_id
        });
      } catch (auditErr) {
        // Non-blocking audit logging
      }
    }

    return res.json(formatResponse(true, null, 'Password changed successfully'));
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function forgotPassword(req, res) {
  try {
    const rawIdentifier = (
      req.body.identifier ||
      req.body.username_or_employee_id ||
      req.body.username ||
      req.body.employee_id ||
      req.body.mobile_number ||
      ''
    ).toString().trim();

    if (!rawIdentifier) {
      return res.status(400).json(formatResponse(false, null, 'Employee ID, Username, or Mobile is required'));
    }

    const reason = (req.body.reason || 'Password Forgotten').toString().trim();
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';
    const { browser, device } = parseUserAgent(ua);
    const normId = rawIdentifier.toLowerCase();

    // Query user by username, employee_id, mobile, email, or normalized super_admin aliases
    const userRes = await db.query(`
      SELECT u.user_id, u.employee_id, u.username, u.mobile_number, u.email, u.full_name, u.role, u.status, u.branch_id
      FROM users u
      WHERE LOWER(TRIM(u.username)) = $1
         OR LOWER(TRIM(u.employee_id)) = $1
         OR TRIM(u.mobile_number) = $2
         OR LOWER(TRIM(COALESCE(u.email, ''))) = $1
         OR (CASE WHEN $2 ~ '^[0-9]+$' THEN u.user_id = $2::integer ELSE FALSE END)
         OR (LOWER(TRIM(u.role::text)) = 'super_admin' AND $1 IN ('admin', 'superadmin', 'super_admin', 'super-admin', 'super admin'))
      ORDER BY (CASE WHEN LOWER(TRIM(u.role::text)) = 'super_admin' THEN 0 ELSE 1 END), u.user_id ASC
      LIMIT 1
    `, [normId, rawIdentifier]);

    if (userRes.rows.length === 0) {
      // Prevent user enumeration: return generic response
      return res.json(formatResponse(
        true,
        { workflow: 'generic' },
        'If the supplied account is eligible for password recovery, the recovery instructions have been sent or submitted according to the account\'s recovery workflow.'
      ));
    }

    const user = userRes.rows[0];

    // NON-SUPER-ADMIN WORKFLOW: Receptionist, Doctor, Executive, PRO / Manager, Pharmacy
    if (user.role !== 'super_admin') {
      const existingReq = await db.query(`
        SELECT id FROM password_reset_requests WHERE user_id = $1 AND status = 'pending'
      `, [user.user_id]);

      if (existingReq.rows.length > 0) {
        return res.json(formatResponse(
          true,
          { workflow: 'authorization_queue', pending: true },
          'Password reset request already pending for Super Admin approval'
        ));
      }

      await db.query(`
        INSERT INTO password_reset_requests (user_id, status, requested_at)
        VALUES ($1, 'pending', now())
      `, [user.user_id]);

      return res.status(200).json(formatResponse(
        true,
        { workflow: 'authorization_queue' },
        'Password reset request submitted successfully. Please contact Super Admin for approval.'
      ));
    }

    // SUPER ADMIN WORKFLOW: SELF-EMAIL RECOVERY
    // 1. Rate Limiting & Cooldown Protection (5s debounce, >=15 attempts per hour)
    const cooldownCheck = await db.query(`
      SELECT id, created_at FROM super_admin_password_recovery
      WHERE (user_id = $1 OR ip_address = $2)
        AND created_at >= NOW() - INTERVAL '5 seconds'
      ORDER BY id DESC LIMIT 1
    `, [user.user_id, ip]);

    if (cooldownCheck.rows.length > 0) {
      await logAuditEvent({
        userId: user.user_id,
        role: user.role,
        action: 'SUPER_ADMIN_RECOVERY_RATE_LIMITED',
        recordId: user.user_id,
        remarks: `Rate limit hit: cooldown 5s from IP ${ip}`,
        ip, device, browser, branchId: user.branch_id
      });
      return res.status(429).json(formatResponse(
        false,
        null,
        'Too many recovery requests. Please wait a moment before trying again.'
      ));
    }

    const hourlyCheck = await db.query(`
      SELECT COUNT(*) as count FROM super_admin_password_recovery
      WHERE (user_id = $1 OR ip_address = $2)
        AND created_at >= NOW() - INTERVAL '1 hour'
    `, [user.user_id, ip]);

    if (parseInt(hourlyCheck.rows[0].count, 10) >= 15) {
      await logAuditEvent({
        userId: user.user_id,
        role: user.role,
        action: 'SUPER_ADMIN_RECOVERY_RATE_LIMITED',
        recordId: user.user_id,
        remarks: `Rate limit hit: >15 requests in 1 hour from IP ${ip}`,
        ip, device, browser, branchId: user.branch_id
      });
      return res.status(429).json(formatResponse(
        false,
        null,
        'Recovery request limit reached for this period. Please try again later.'
      ));
    }

    await logAuditEvent({
      userId: user.user_id,
      role: user.role,
      action: 'SUPER_ADMIN_PASSWORD_RESET_REQUESTED',
      recordId: user.user_id,
      remarks: `Self-email password recovery initiated for identifier: ${rawIdentifier}. Reason: ${reason}`,
      ip, device, browser, branchId: user.branch_id
    });

    // 2. Invalidate any previously issued active temporary recovery records
    await db.query(`
      UPDATE super_admin_password_recovery
      SET recovery_status = 'superseded', updated_at = now()
      WHERE user_id = $1 AND recovery_status = 'sent'
    `, [user.user_id]);

    // 3. Generate secure temporary password
    const tempPassword = generateTempPassword(12);
    const tempHash = await bcrypt.hash(tempPassword, 10);
    const expiryMinutes = 20;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const targetEmail = process.env.SUPER_ADMIN_RECOVERY_EMAIL || 'wecarehomeopathyknr@gmail.com';

    // 4. Update users table with temporary password state
    await db.query(`
      UPDATE users
      SET temporary_password_hash = $1,
          temporary_password_expires_at = $2,
          temporary_password_used_at = NULL,
          password_reset_required = true,
          must_change_password = true,
          updated_at = now()
      WHERE user_id = $3
    `, [tempHash, expiresAt, user.user_id]);

    // 5. Insert dedicated recovery record
    const identifierType = normId.startsWith('emp')
      ? 'employee_id'
      : /^\d+$/.test(rawIdentifier)
      ? 'mobile'
      : normId.includes('@')
      ? 'email'
      : 'username';

    // Dynamic schema column detection for backwards/forward compatibility with live DB
    const colCheck = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'super_admin_password_recovery' AND column_name IN ('expires_at', 'temporary_password_expires_at')
    `);
    const availableCols = colCheck.rows.map(r => r.column_name);

    let insertCols = ['user_id', 'role', 'identifier_type', 'submitted_identifier', 'reason', 'recovery_status', 'email_destination', 'temporary_password_created_at', 'ip_address', 'user_agent'];
    let insertVals = ['$1', "'super_admin'", '$2', '$3', '$4', "'pending'", '$5', 'now()', '$7', '$8'];
    let params = [user.user_id, identifierType, rawIdentifier, reason, targetEmail, expiresAt, ip, ua];

    if (availableCols.includes('temporary_password_expires_at')) {
      insertCols.push('temporary_password_expires_at');
      insertVals.push('$6');
    }
    if (availableCols.includes('expires_at')) {
      insertCols.push('expires_at');
      insertVals.push('$6');
    }

    const recoveryRes = await db.query(`
      INSERT INTO super_admin_password_recovery (${insertCols.join(', ')})
      VALUES (${insertVals.join(', ')})
      RETURNING id
    `, params);

    const recoveryId = recoveryRes.rows[0].id;

    // 6. Send recovery email via Nodemailer
    try {
      await emailService.sendSuperAdminRecoveryEmail({
        to: targetEmail,
        tempPassword,
        requestedAt: new Date(),
        expiryMinutes,
        ip
      });

      await db.query(`
        UPDATE super_admin_password_recovery
        SET recovery_status = 'sent', updated_at = now()
        WHERE id = $1
      `, [recoveryId]);

      await logAuditEvent({
        userId: user.user_id,
        role: user.role,
        action: 'SUPER_ADMIN_RECOVERY_EMAIL_SENT',
        recordId: recoveryId,
        remarks: `Recovery email sent successfully to ${targetEmail}`,
        ip, device, browser, branchId: user.branch_id
      });

      return res.json(formatResponse(
        true,
        {
          workflow: 'self_email',
          recovery_email: targetEmail
        },
        'Recovery instructions have been sent to the configured administrator recovery email.'
      ));
    } catch (mailErr) {
      console.error('Super Admin recovery email sending failed:', mailErr);

      // Rollback temporary credentials immediately so no undisclosed credential remains usable
      try {
        await db.query(`
          UPDATE users
          SET temporary_password_hash = NULL,
              temporary_password_expires_at = NULL,
              temporary_password_used_at = NULL,
              password_reset_required = false,
              must_change_password = false,
              updated_at = now()
          WHERE user_id = $1
        `, [user.user_id]);

        if (recoveryId) {
          await db.query(`
            UPDATE super_admin_password_recovery
            SET recovery_status = 'failed', failure_reason = $1, updated_at = now()
            WHERE id = $2
          `, [mailErr.message, recoveryId]);
        }

        await logAuditEvent({
          userId: user.user_id,
          role: user.role,
          action: 'SUPER_ADMIN_RECOVERY_EMAIL_FAILED',
          recordId: recoveryId,
          remarks: `Failed to deliver recovery email: ${mailErr.message}`,
          ip, device, browser, branchId: user.branch_id
        });
      } catch (cleanupErr) {
        console.warn('Defensive rollback notice:', cleanupErr.message);
      }

      return res.status(500).json(formatResponse(
        false,
        null,
        'Unable to complete password recovery at this time. Please check administrator SMTP email settings.'
      ));
    }
  } catch (err) {
    console.error('Forgot password fatal error:', err);
    return res.status(500).json(formatResponse(false, null, err.message || 'Internal server error'));
  }
}

module.exports = {
  login,
  logout,
  changePassword,
  forgotPassword,
  logAuditEvent
};
