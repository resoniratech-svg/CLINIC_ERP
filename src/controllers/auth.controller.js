const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { formatResponse, parseUserAgent } = require('../utils/helpers');

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json(formatResponse(false, null, 'Username and password are required'));
    }

    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || '';
    const { browser, device } = parseUserAgent(ua);

    // Find user
    const result = await db.query(
      `SELECT u.*, b.branch_name FROM users u JOIN branches b ON u.branch_id = b.branch_id WHERE username = $1 OR mobile_number = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json(formatResponse(false, null, 'Invalid credentials'));
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json(formatResponse(false, null, `Account is ${user.status}`));
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      // Record failed login log
      await db.query(`
        INSERT INTO login_logs (user_id, role, ip_address, device, browser, location, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'failed')
      `, [user.user_id, user.role, ip, device, browser, user.branch_name]);

      return res.status(401).json(formatResponse(false, null, 'Invalid credentials'));
    }

    // Update last_login_at
    await db.query(`UPDATE users SET last_login_at = now() WHERE user_id = $1`, [user.user_id]);

    // Record login log
    const loginLogRes = await db.query(`
      INSERT INTO login_logs (user_id, role, ip_address, device, browser, location, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'success') RETURNING id
    `, [user.user_id, user.role, ip, device, browser, user.branch_name]);

    const payload = {
      user_id: user.user_id,
      employee_id: user.employee_id,
      full_name: user.full_name,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id,
      login_log_id: loginLogRes.rows[0].id
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
        role: user.role,
        branch_id: user.branch_id,
        must_change_password: user.must_change_password
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
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json(formatResponse(false, null, 'Old password and new password are required'));
    }

    const userId = req.user.user_id;
    const userRes = await db.query(`SELECT password_hash FROM users WHERE user_id = $1`, [userId]);
    const user = userRes.rows[0];

    const isMatch = await bcrypt.compare(old_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json(formatResponse(false, null, 'Incorrect current password'));
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query(`
      UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE user_id = $2
    `, [newHash, userId]);

    return res.json(formatResponse(true, null, 'Password changed successfully'));
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function forgotPassword(req, res) {
  try {
    const { username_or_employee_id } = req.body;
    if (!username_or_employee_id) {
      return res.status(400).json(formatResponse(false, null, 'Username or Employee ID is required'));
    }

    const userRes = await db.query(`
      SELECT user_id FROM users WHERE username = $1 OR employee_id = $1 OR mobile_number = $1
    `, [username_or_employee_id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User not found'));
    }

    const userId = userRes.rows[0].user_id;

    // Check if pending request exists
    const existingReq = await db.query(`
      SELECT id FROM password_reset_requests WHERE user_id = $1 AND status = 'pending'
    `, [userId]);

    if (existingReq.rows.length > 0) {
      return res.json(formatResponse(true, null, 'Password reset request already pending for Super Admin approval'));
    }

    await db.query(`
      INSERT INTO password_reset_requests (user_id, status) VALUES ($1, 'pending')
    `, [userId]);

    return res.json(formatResponse(true, null, 'Password reset request submitted successfully. Please contact Super Admin for approval.'));
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  login,
  logout,
  changePassword,
  forgotPassword
};
