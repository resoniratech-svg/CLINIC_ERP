const db = require('../db');
const bcrypt = require('bcryptjs');
const { formatResponse, generateTempPassword } = require('../utils/helpers');

async function getPasswordResetRequests(req, res) {
  try {
    const { status } = req.query;
    let query = `
      SELECT pr.id, pr.user_id, pr.requested_at, pr.status, pr.approved_at,
             u.full_name, u.employee_id, u.username, u.role
      FROM password_reset_requests pr
      JOIN users u ON pr.user_id = u.user_id
    `;
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE pr.status = $1`;
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

module.exports = {
  getPasswordResetRequests,
  approvePasswordReset,
  rejectPasswordReset
};
