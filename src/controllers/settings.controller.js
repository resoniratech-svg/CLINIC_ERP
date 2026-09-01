const db = require('../db');
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
    if (!setting_key) {
      return res.status(400).json(formatResponse(false, null, 'setting_key is required'));
    }

    const result = await db.query(`
      INSERT INTO hospital_settings (setting_key, setting_value)
      VALUES ($1, $2)
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = now()
      RETURNING *
    `, [setting_key, setting_value || '']);

    res.locals.auditEntry = { module: 'Hospital Settings', action: 'Update Setting', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Hospital setting updated successfully'));
  } catch (err) {
    console.error('updateHospitalSettings error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

const masterTableMap = {
  'villages': 'master_villages',
  'mandals': 'master_mandals',
  'lead-sources': 'master_lead_sources',
  'referral-sources': 'master_referral_sources',
  'departments': 'master_departments',
  'specializations': 'master_specializations',
  'charge-types': 'master_charge_types',
  'expense-categories': 'master_expense_categories'
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

module.exports = {
  getPermissionsMatrix,
  updatePermissionsMatrix,
  getHospitalSettings,
  updateHospitalSettings,
  getMasterData,
  addMasterData
};
