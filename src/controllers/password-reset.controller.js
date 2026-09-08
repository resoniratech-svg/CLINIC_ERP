const db = require('../db');
const bcrypt = require('bcryptjs');
const { formatResponse, generateTempPassword } = require('../utils/helpers');

async function getPasswordResetRequests(req, res) {
  try {
    const { status, role, search, date } = req.query;
    let query = `
      SELECT pr.id, pr.user_id, pr.requested_at, pr.status, pr.approved_at,
             u.full_name, u.employee_id, u.username, u.role
      FROM password_reset_requests pr
      JOIN users u ON pr.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status.trim()) {
      params.push(status.trim().toLowerCase());
      query += ` AND LOWER(pr.status::text) = $${params.length}`;
    }

    if (role && role.trim()) {
      params.push(role.trim().toLowerCase());
      query += ` AND LOWER(u.role::text) = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.employee_id ILIKE $${params.length})`;
    }

    if (date && date.trim()) {
      let normalizedDate = date.trim();
      if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(normalizedDate)) {
        const parts = normalizedDate.split(/[\/-]/);
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        normalizedDate = `${year}-${month}-${day}`;
      }
      params.push(normalizedDate);
      query += ` AND TO_CHAR(pr.requested_at, 'YYYY-MM-DD') = $${params.length}`;
    }

    query += ` ORDER BY pr.id DESC`;

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Password reset requests retrieved successfully'));
  } catch (err) {
    console.error('getPasswordResetRequests error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function approvePasswordReset(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const requestId = parseInt(req.params.id);

    const reqRes = await client.query(
      `SELECT pr.*, u.username FROM password_reset_requests pr JOIN users u ON pr.user_id = u.user_id WHERE pr.id = $1`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Reset request not found'));
    }

    const resetReq = reqRes.rows[0];

    if (resetReq.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Request is already ${resetReq.status}`));
    }

    const tempPassword = generateTempPassword(10);
    const tempHash = await bcrypt.hash(tempPassword, 10);

    // Update user password and set must_change_password flag
    await client.query(`
      UPDATE users
      SET password_hash = $1, must_change_password = true, updated_at = now()
      WHERE user_id = $2
    `, [tempHash, resetReq.user_id]);

    // Update reset request
    await client.query(`
      UPDATE password_reset_requests
      SET status = 'approved', approved_by = $1, temp_password_hash = $2, approved_at = now()
      WHERE id = $3
    `, [req.user.user_id, tempHash, requestId]);

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Password Reset',
      action: 'Approve Password Reset',
      recordId: requestId,
      remarks: `Temporary password generated for user_id ${resetReq.user_id}`
    };

    return res.json(formatResponse(true, {
      request_id: requestId,
      user_id: resetReq.user_id,
      username: resetReq.username,
      temporary_password: tempPassword
    }, 'Password reset approved. Provide this temporary password to the user.'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approvePasswordReset error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function rejectPasswordReset(req, res) {
  try {
    const requestId = parseInt(req.params.id);

    const reqRes = await db.query(`SELECT * FROM password_reset_requests WHERE id = $1`, [requestId]);
    if (reqRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Reset request not found'));
    }

    await db.query(`
      UPDATE password_reset_requests SET status = 'rejected', approved_by = $1, approved_at = now() WHERE id = $2
    `, [req.user.user_id, requestId]);

    res.locals.auditEntry = { module: 'Password Reset', action: 'Reject Password Reset', recordId: requestId };
    return res.json(formatResponse(true, null, 'Password reset request rejected'));
  } catch (err) {
    console.error('rejectPasswordReset error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function requestPasswordReset(req, res) {
  try {
    const { username, mobile_number } = req.body;
    const identifier = username || mobile_number;
    if (!identifier) {
      return res.status(400).json(formatResponse(false, null, 'username or mobile_number is required'));
    }

    const userRes = await db.query(
      `SELECT user_id, username, role FROM users WHERE username = $1 OR mobile_number = $1`,
      [identifier]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User not found'));
    }

    const user = userRes.rows[0];

    const result = await db.query(`
      INSERT INTO password_reset_requests (user_id, status, requested_at)
      VALUES ($1, 'pending', now())
      RETURNING *
    `, [user.user_id]);

    return res.status(201).json(formatResponse(true, result.rows[0], 'Password reset request created successfully and forwarded to Super Admin.'));
  } catch (err) {
    console.error('requestPasswordReset error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getPasswordResetRequests,
  approvePasswordReset,
  rejectPasswordReset,
  requestPasswordReset
};
