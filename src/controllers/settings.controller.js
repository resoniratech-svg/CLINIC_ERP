const db = require('../db');
const jwt = require('jsonwebtoken');
const { formatResponse } = require('../utils/helpers');

async function getPermissionsMatrix(req, res) {
  try {
    const result = await db.query(`SELECT * FROM role_permissions_matrix ORDER BY role, module`);
    return res.json(formatResponse(true, result.rows, 'Roles & Permissions matrix retrieved successfully'));
  } catch (err) {
    console.error('getPermissionsMatrix error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updatePermissionsMatrix(req, res) {
  try {
    const { role, module, access_level } = req.body;
    if (!role || !module || !access_level) {
      return res.status(400).json(formatResponse(false, null, 'role, module, and access_level are required'));
    }

    const result = await db.query(`
      INSERT INTO role_permissions_matrix (role, module, access_level)
      VALUES ($1, $2, $3)
      ON CONFLICT (role, module) DO UPDATE SET access_level = $3
      RETURNING *
    `, [role, module, access_level]);

    res.locals.auditEntry = { module: 'Roles & Permissions', action: 'Update Permission Matrix', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Permissions matrix updated successfully'));
  } catch (err) {
    console.error('updatePermissionsMatrix error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getHospitalSettings(req, res) {
  try {
    const result = await db.query(`SELECT * FROM hospital_settings`);
    const settingsMap = {};
    result.rows.forEach(r => { settingsMap[r.setting_key] = r.setting_value; });
    return res.json(formatResponse(true, settingsMap, 'Hospital settings retrieved successfully'));
  } catch (err) {
    console.error('getHospitalSettings error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateHospitalSettings(req, res) {
  try {
    const { setting_key, setting_value } = req.body;
    if (setting_key) {
      const result = await db.query(`
        INSERT INTO hospital_settings (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = now()
        RETURNING *
      `, [setting_key, setting_value || '']);

      res.locals.auditEntry = { module: 'Hospital Settings', action: 'Update Setting', recordId: result.rows[0].id, newValue: result.rows[0] };
      return res.json(formatResponse(true, result.rows[0], 'Hospital setting updated successfully'));
    }

    if (setting_value !== undefined && !setting_key) {
      return res.status(400).json(formatResponse(false, null, 'setting_key is required'));
    }

    if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      const updatedRows = [];
      for (const [key, value] of Object.entries(req.body)) {
        if (key && typeof value !== 'undefined') {
          const result = await db.query(`
            INSERT INTO hospital_settings (setting_key, setting_value)
            VALUES ($1, $2)
            ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = now()
            RETURNING *
          `, [key, String(value)]);
          updatedRows.push(result.rows[0]);
        }
      }

      res.locals.auditEntry = { module: 'Hospital Settings', action: 'Bulk Update Settings', recordId: 1, newValue: req.body };
      return res.json(formatResponse(true, updatedRows, 'Hospital settings updated successfully'));
    }

    return res.status(400).json(formatResponse(false, null, 'setting_key or settings dictionary is required'));
  } catch (err) {
    console.error('updateHospitalSettings error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

const masterTableMap = {
  'villages': 'master_villages',
  'mandals': 'master_mandals',
  'lead-sources': 'master_lead_sources',
  'lead_sources': 'master_lead_sources',
  'referral-sources': 'master_referral_sources',
  'referral_sources': 'master_referral_sources',
  'departments': 'master_departments',
  'specializations': 'master_specializations',
  'charge-types': 'master_charge_types',
  'charge_types': 'master_charge_types',
  'expense-categories': 'master_expense_categories',
  'expense_categories': 'master_expense_categories'
};

async function getMasterData(req, res) {
  try {
    const type = req.params.type;
    const tableName = masterTableMap[type];
    if (!tableName) {
      return res.status(404).json(formatResponse(false, null, `Master data type '${type}' not found`));
    }

    const result = await db.query(`SELECT * FROM ${tableName} ORDER BY id ASC`);
    return res.json(formatResponse(true, result.rows, `Master ${type} retrieved successfully`));
  } catch (err) {
    console.error('getMasterData error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function addMasterData(req, res) {
  try {
    const type = req.params.type;
    const tableName = masterTableMap[type];
    if (!tableName) {
      return res.status(404).json(formatResponse(false, null, `Master data type '${type}' not found`));
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json(formatResponse(false, null, 'name is required'));
    }

    const result = await db.query(`
      INSERT INTO ${tableName} (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *
    `, [name]);

    const created = result.rows[0] || { name };
    res.locals.auditEntry = { module: 'Master Data', action: `Add Master ${type}`, newValue: created };
    return res.status(201).json(formatResponse(true, created, `Master ${type} entry added successfully`));
  } catch (err) {
    console.error('addMasterData error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getProfile(req, res) {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json(formatResponse(false, null, 'Authentication required'));
    }

    const userRes = await db.query(`
      SELECT u.user_id, u.employee_id, u.full_name, u.mobile_number, u.email, u.gender,
             u.username, u.department, u.designation, u.branch_id, u.role, u.status,
             u.last_login_at, u.created_at, u.updated_at,
             b.branch_name, b.branch_code
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      WHERE u.user_id = $1 AND u.status != 'deleted'
    `, [userId]);

    if (userRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User profile not found'));
    }

    return res.json(formatResponse(true, userRes.rows[0], 'Profile retrieved successfully'));
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json(formatResponse(false, null, 'Authentication required'));
    }

    // 1. Fetch current user from DB
    const oldUserRes = await db.query(`
      SELECT u.*, b.branch_name, b.branch_code
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      WHERE u.user_id = $1 AND u.status != 'deleted'
    `, [userId]);

    if (oldUserRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User profile not found'));
    }
    const oldUser = oldUserRes.rows[0];

    const {
      full_name,
      fullName,
      username,
      mobile_number,
      mobileNumber,
      phone,
      branch_id,
      branchId,
      department
    } = req.body;

    // 2. Validate Full Name (required)
    const rawFullName = full_name !== undefined ? full_name : (fullName !== undefined ? fullName : oldUser.full_name);
    const cleanFullName = rawFullName !== null && rawFullName !== undefined ? String(rawFullName).trim() : '';
    if (!cleanFullName) {
      return res.status(400).json(formatResponse(false, null, 'Full Name is required'));
    }

    // 3. Validate Username (required, format, unique)
    const rawUsername = username !== undefined ? username : oldUser.username;
    let cleanUsername = rawUsername !== null && rawUsername !== undefined ? String(rawUsername).trim() : '';
    // Strip leading @ if entered by user (e.g. "@admin" -> "admin")
    cleanUsername = cleanUsername.replace(/^@+/, '').trim();

    if (!cleanUsername) {
      return res.status(400).json(formatResponse(false, null, 'Username is required'));
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json(formatResponse(false, null, 'Username must be at least 3 characters long'));
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      return res.status(400).json(formatResponse(false, null, 'Username can only contain alphanumeric characters, underscores, hyphens, and dots'));
    }

    // Check username uniqueness against other users
    const dupUserCheck = await db.query(
      `SELECT user_id FROM users WHERE LOWER(username) = LOWER($1) AND user_id != $2 AND status != 'deleted'`,
      [cleanUsername, userId]
    );
    if (dupUserCheck.rows.length > 0) {
      return res.status(400).json(formatResponse(false, null, `Username "${cleanUsername}" already exists. Please choose a different username.`));
    }

    // 4. Validate Mobile Number (optional / if provided)
    const rawMobile = mobile_number !== undefined ? mobile_number : (mobileNumber !== undefined ? mobileNumber : (phone !== undefined ? phone : oldUser.mobile_number));
    let cleanMobile = rawMobile !== null && rawMobile !== undefined ? String(rawMobile).trim() : '';
    if (cleanMobile) {
      const numericMobile = cleanMobile.replace(/[\s\-()+]/g, '');
      if (numericMobile.length < 7 || numericMobile.length > 15 || !/^\d+$/.test(numericMobile)) {
        return res.status(400).json(formatResponse(false, null, 'Invalid mobile number format. Must be between 7 and 15 digits'));
      }
    }

    // 5. Validate Assigned Branch (required if provided, must exist & be active)
    const rawBranchId = branch_id !== undefined ? branch_id : (branchId !== undefined ? branchId : oldUser.branch_id);
    let targetBranchId = parseInt(rawBranchId, 10);
    if (isNaN(targetBranchId) || targetBranchId <= 0) {
      targetBranchId = oldUser.branch_id;
    }

    const branchCheck = await db.query(
      `SELECT branch_id, branch_name, branch_code FROM branches WHERE branch_id = $1 AND status = 'active'`,
      [targetBranchId]
    );
    if (branchCheck.rows.length === 0) {
      return res.status(400).json(formatResponse(false, null, 'Selected branch is invalid or inactive. Please choose a valid active branch.'));
    }
    const activeBranch = branchCheck.rows[0];

    // 6. Department (optional string)
    const rawDept = department !== undefined ? department : oldUser.department;
    const cleanDept = rawDept !== null && rawDept !== undefined ? String(rawDept).trim() : null;

    // 7. Update User Record (strictly protecting role, employee_id, and status)
    const updateRes = await db.query(`
      UPDATE users
      SET full_name = $1,
          username = $2,
          mobile_number = $3,
          department = $4,
          branch_id = $5,
          updated_at = now()
      WHERE user_id = $6
      RETURNING user_id, employee_id, full_name, username, mobile_number, email, gender, department, designation, branch_id, role, status, last_login_at, created_at, updated_at
    `, [
      cleanFullName,
      cleanUsername,
      cleanMobile || oldUser.mobile_number,
      cleanDept,
      targetBranchId,
      userId
    ]);

    const updatedUser = {
      ...updateRes.rows[0],
      branch_name: activeBranch.branch_name,
      branch_code: activeBranch.branch_code
    };

    // 8. Generate refreshed JWT token with updated full_name, username, and branch_id
    const tokenPayload = {
      user_id: updatedUser.user_id,
      employee_id: updatedUser.employee_id,
      full_name: updatedUser.full_name,
      username: updatedUser.username,
      role: updatedUser.role,
      branch_id: updatedUser.branch_id,
      branch_name: updatedUser.branch_name,
      branch_code: updatedUser.branch_code
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'super_secret_jwt_key_123!', {
      expiresIn: '24h'
    });

    // 9. Audit Logging
    res.locals.auditEntry = {
      module: 'Settings',
      action: 'Update Super Admin Profile',
      recordId: userId,
      oldValue: {
        full_name: oldUser.full_name,
        username: oldUser.username,
        mobile_number: oldUser.mobile_number,
        department: oldUser.department,
        branch_id: oldUser.branch_id
      },
      newValue: {
        full_name: updatedUser.full_name,
        username: updatedUser.username,
        mobile_number: updatedUser.mobile_number,
        department: updatedUser.department,
        branch_id: updatedUser.branch_id
      }
    };

    return res.json(formatResponse(true, {
      user: updatedUser,
      token
    }, 'Profile updated successfully'));
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getBranches(req, res) {
  try {
    const result = await db.query(`
      SELECT branch_id, branch_name, branch_code, address, phone_number, status
      FROM branches
      WHERE status = 'active'
      ORDER BY branch_id ASC
    `);
    return res.json(formatResponse(true, result.rows, 'Active branches retrieved successfully'));
  } catch (err) {
    console.error('getBranches error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getPermissionsMatrix,
  updatePermissionsMatrix,
  getHospitalSettings,
  updateHospitalSettings,
  getMasterData,
  addMasterData,
  getProfile,
  updateProfile,
  getBranches
};
