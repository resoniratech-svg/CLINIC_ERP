const db = require('../db');
const bcrypt = require('bcryptjs');
const { formatResponse } = require('../utils/helpers');

async function getUsers(req, res) {
  try {
    const { role, status, search } = req.query;
    let query = `
      SELECT u.user_id, u.employee_id, u.full_name, u.mobile_number, u.email, u.gender,
             u.username, u.department, u.designation, u.role, u.status, u.last_login_at, u.created_at
      FROM users u
      WHERE u.branch_id = $1
    `;
    const params = [req.user.branch_id || 1];

    if (role) {
      params.push(role.trim());
      query += ` AND u.role = $${params.length}`;
    }

    if (status) {
      params.push(status.trim());
      query += ` AND u.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.employee_id ILIKE $${params.length} OR u.mobile_number ILIKE $${params.length})`;
    }

    query += ` ORDER BY u.user_id DESC`;

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Users retrieved successfully'));
  } catch (err) {
    console.error('getUsers error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getUserById(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const userRes = await db.query(
      `SELECT user_id, employee_id, full_name, mobile_number, email, gender, date_of_joining,
              username, department, designation, reporting_manager_id, branch_id, role, status, must_change_password, last_login_at, created_at
       FROM users WHERE user_id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User not found'));
    }

    const user = userRes.rows[0];

    // Fetch role specific details
    if (user.role === 'receptionist') {
      const permRes = await db.query(`SELECT * FROM receptionist_permissions WHERE user_id = $1`, [userId]);
      user.permissions = permRes.rows[0] || null;
    } else if (user.role === 'doctor') {
      const docRes = await db.query(`SELECT * FROM doctors WHERE user_id = $1`, [userId]);
      user.doctor_details = docRes.rows[0] || null;
    } else if (user.role === 'pro_manager') {
      const permRes = await db.query(`SELECT * FROM pro_manager_permissions WHERE user_id = $1`, [userId]);
      user.permissions = permRes.rows[0] || null;
    } else if (user.role === 'executive') {
      const execRes = await db.query(`SELECT * FROM executives WHERE user_id = $1`, [userId]);
      user.executive_details = execRes.rows[0] || null;
    } else if (user.role === 'pharmacy') {
      const permRes = await db.query(`SELECT * FROM pharmacy_permissions WHERE user_id = $1`, [userId]);
      user.permissions = permRes.rows[0] || null;
    }

    return res.json(formatResponse(true, user, 'User details retrieved successfully'));
  } catch (err) {
    console.error('getUserById error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createUser(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const {
      employee_id, full_name, mobile_number, email, gender, date_of_joining,
      username, password, department, designation, reporting_manager_id, role, status
    } = req.body;

    if (!employee_id || !full_name || !mobile_number || !username || !password || !role) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Employee ID, Full Name, Mobile, Username, Password, and Role are required'));
    }

    const passHash = await bcrypt.hash(password, 10);
    const branchId = req.user.branch_id || 1;
    const cleanRole = role.trim();

    const userRes = await client.query(`
      INSERT INTO users (
        employee_id, full_name, mobile_number, email, gender, date_of_joining,
        username, password_hash, department, designation, reporting_manager_id,
        branch_id, role, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING user_id, employee_id, full_name, username, role, status
    `, [
      employee_id, full_name, mobile_number, email || null, gender || null, date_of_joining || null,
      username, passHash, department || null, designation || null, reporting_manager_id || null,
      branchId, cleanRole, status || 'active'
    ]);

    const newUser = userRes.rows[0];
    const userId = newUser.user_id;

    // Handle role specific creation
    if (cleanRole === 'receptionist') {
      const p = req.body.permissions || {};
      await client.query(`
        INSERT INTO receptionist_permissions (
          user_id, registration, enquiry, appointment, checkin, consultation_fee_billing,
          payment_collection, crm_calling, followup, renewal, due_management
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        userId,
        p.registration !== undefined ? p.registration : true,
        p.enquiry !== undefined ? p.enquiry : true,
        p.appointment !== undefined ? p.appointment : true,
        p.checkin !== undefined ? p.checkin : true,
        p.consultation_fee_billing !== undefined ? p.consultation_fee_billing : true,
        p.payment_collection !== undefined ? p.payment_collection : true,
        p.crm_calling !== undefined ? p.crm_calling : true,
        p.followup !== undefined ? p.followup : true,
        p.renewal !== undefined ? p.renewal : true,
        p.due_management !== undefined ? p.due_management : true
      ]);
    } else if (cleanRole === 'doctor') {
      const d = req.body.doctor_details || req.body;
      const docCode = d.doctor_code || `DOC-${employee_id}`;
      await client.query(`
        INSERT INTO doctors (
          user_id, doctor_code, qualification, specialization, medical_registration_number,
          experience_years, working_days, start_time, end_time, slot_duration_minutes,
          new_consultation_fee, renewal_consultation_fee, followup_consultation_fee, branch_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        userId, docCode, d.qualification || null, d.specialization || null, d.medical_registration_number || null,
        d.experience_years || 0, d.working_days || 'Mon,Tue,Wed,Thu,Fri', d.start_time || '09:00', d.end_time || '17:00',
        d.slot_duration_minutes || 15, d.new_consultation_fee || 500, d.renewal_consultation_fee || 300,
        d.followup_consultation_fee || 200, branchId, status || 'active'
      ]);
    } else if (cleanRole === 'pro_manager') {
      const p = req.body.permissions || {};
      await client.query(`
        INSERT INTO pro_manager_permissions (
          user_id, counselling, billing, payment, due_collection, crm, followup,
          renewals, complaints, feedback, reports, accountant
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        userId,
        p.counselling !== undefined ? p.counselling : true,
        p.billing !== undefined ? p.billing : true,
        p.payment !== undefined ? p.payment : true,
        p.due_collection !== undefined ? p.due_collection : true,
        p.crm !== undefined ? p.crm : true,
        p.followup !== undefined ? p.followup : true,
        p.renewals !== undefined ? p.renewals : true,
        p.complaints !== undefined ? p.complaints : true,
        p.feedback !== undefined ? p.feedback : true,
        p.reports !== undefined ? p.reports : true,
        p.accountant !== undefined ? p.accountant : true
      ]);
    } else if (cleanRole === 'executive') {
      const e = req.body.executive_details || req.body;
      await client.query(`
        INSERT INTO executives (
          user_id, per_lead_incentive, incentive_type, incentive_amount, incentive_trigger,
          effective_date, branch_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        userId, e.per_lead_incentive || 100, e.incentive_type || 'per_lead', e.incentive_amount || 100,
        e.incentive_trigger || 'created', e.effective_date || new Date(), branchId, status || 'active'
      ]);
    } else if (cleanRole === 'pharmacy') {
      const p = req.body.permissions || {};
      await client.query(`
        INSERT INTO pharmacy_permissions (
          user_id, prescription_queue, dispensing, inventory, stock, batch, expiry,
          returns, stock_adjustment, stock_transactions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        userId,
        p.prescription_queue !== undefined ? p.prescription_queue : true,
        p.dispensing !== undefined ? p.dispensing : true,
        p.inventory !== undefined ? p.inventory : true,
        p.stock !== undefined ? p.stock : true,
        p.batch !== undefined ? p.batch : true,
        p.expiry !== undefined ? p.expiry : true,
        p.returns !== undefined ? p.returns : true,
        p.stock_adjustment !== undefined ? p.stock_adjustment : true,
        p.stock_transactions !== undefined ? p.stock_transactions : true
      ]);
    }

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'User Management', action: 'Create User', recordId: userId, newValue: newUser };
    return res.status(201).json(formatResponse(true, newUser, 'User created successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createUser error:', err);
    if (err.code === '23505') {
      return res.status(400).json(formatResponse(false, null, 'Username, Employee ID, or Mobile number already exists'));
    }
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function updateUser(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const { full_name, mobile_number, email, gender, department, designation, reporting_manager_id, status } = req.body;

    const oldUserRes = await db.query(`SELECT * FROM users WHERE user_id = $1`, [userId]);
    if (oldUserRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User not found'));
    }
    const oldUser = oldUserRes.rows[0];

    await db.query(`
      UPDATE users SET
        full_name = COALESCE($1, full_name),
        mobile_number = COALESCE($2, mobile_number),
        email = COALESCE($3, email),
        gender = COALESCE($4, gender),
        department = COALESCE($5, department),
        designation = COALESCE($6, designation),
        reporting_manager_id = COALESCE($7, reporting_manager_id),
        status = COALESCE($8, status),
        updated_at = now()
      WHERE user_id = $9
    `, [full_name, mobile_number, email, gender, department, designation, reporting_manager_id, status, userId]);

    if (status) {
      if (oldUser.role === 'doctor') {
        await db.query(`UPDATE doctors SET status = $1 WHERE user_id = $2`, [status, userId]);
      } else if (oldUser.role === 'executive') {
        await db.query(`UPDATE executives SET status = $1 WHERE user_id = $2`, [status, userId]);
      }
    }

    res.locals.auditEntry = { module: 'User Management', action: 'Update User', recordId: userId, oldValue: oldUser, newValue: req.body };
    return res.json(formatResponse(true, null, 'User updated successfully'));
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateUserStatus(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid status. Must be active, inactive, or suspended'));
    }

    const oldUserRes = await db.query(`SELECT * FROM users WHERE user_id = $1`, [userId]);
    if (oldUserRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User not found'));
    }
    const oldUser = oldUserRes.rows[0];

    await db.query(`UPDATE users SET status = $1, updated_at = now() WHERE user_id = $2`, [status, userId]);

    if (oldUser.role === 'doctor') {
      await db.query(`UPDATE doctors SET status = $1 WHERE user_id = $2`, [status, userId]);
    } else if (oldUser.role === 'executive') {
      await db.query(`UPDATE executives SET status = $1 WHERE user_id = $2`, [status, userId]);
    }

    res.locals.auditEntry = { module: 'User Management', action: 'Update User Status', recordId: userId, oldValue: { status: oldUser.status }, newValue: { status } };
    return res.json(formatResponse(true, null, `User status updated to ${status}`));
  } catch (err) {
    console.error('updateUserStatus error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus
};
