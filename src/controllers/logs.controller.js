const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getAuditLogs(req, res) {
  try {
    const { user_id, role, module, start_date, end_date, page = 1, limit = 50 } = req.query;
    const branchId = (req.user && req.user.branch_id) ? req.user.branch_id : 1;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT a.*, u.username, u.full_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE a.branch_id = $1
    `;
    const params = [branchId];

    if (user_id) {
      params.push(user_id);
      query += ` AND a.user_id = $${params.length}`;
    }
    if (role) {
      params.push(role);
      query += ` AND a.role = $${params.length}`;
    }
    if (module) {
      params.push(module);
      query += ` AND a.module ILIKE $${params.length}`;
    }
    if (start_date && end_date) {
      params.push(start_date, end_date);
      query += ` AND DATE(a.created_at) BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    query += ` ORDER BY a.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Audit logs retrieved successfully'));
  } catch (err) {
    console.error('getAuditLogs error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getLoginLogs(req, res) {
  try {
    const { user_id, role, status, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT l.*, u.username, u.full_name, u.employee_id
      FROM login_logs l
      JOIN users u ON l.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      params.push(user_id);
      query += ` AND l.user_id = $${params.length}`;
    }
    if (role) {
      params.push(role);
      query += ` AND l.role = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND l.status = $${params.length}`;
    }
    if (start_date && end_date) {
      params.push(start_date, end_date);
      query += ` AND DATE(l.login_time) BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    query += ` ORDER BY l.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Login logs retrieved successfully'));
  } catch (err) {
    console.error('getLoginLogs error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getAuditLogs,
  getLoginLogs
};
