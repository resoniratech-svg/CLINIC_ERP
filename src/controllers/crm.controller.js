const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getFollowups(req, res) {
  try {
    const { category, status, assigned_to } = req.query;
    let query = `
      SELECT cf.*, p.full_name as patient_name, p.mobile_number, u.full_name as assigned_user_name, u.role as assigned_role
      FROM crm_followups cf
      JOIN patients p ON cf.patient_id = p.patient_id
      JOIN users u ON cf.assigned_to = u.user_id
      WHERE cf.branch_id = $1
    `;
    const params = [req.user.branch_id || 1];

    if (category) {
      params.push(category);
      query += ` AND cf.category = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND cf.status = $${params.length}`;
    }

    if (assigned_to) {
      params.push(assigned_to);
      query += ` AND cf.assigned_to = $${params.length}`;
    }

    query += ` ORDER BY cf.id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'CRM followups retrieved successfully'));
  } catch (err) {
    console.error('getFollowups error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createFollowup(req, res) {
  try {
    const { patient_id, category, assigned_to, due_date, remarks } = req.body;
    if (!patient_id || !category || !assigned_to) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, category, and assigned_to are required'));
    }

    // Business Rule 12: Followups can only be assigned to Receptionist or PRO/Manager, NEVER Executive!
    const userRes = await db.query(`SELECT role FROM users WHERE user_id = $1`, [assigned_to]);
    if (userRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Assigned user not found'));
    }

    const assignedRole = userRes.rows[0].role;
    if (!['receptionist', 'pro_manager', 'super_admin'].includes(assignedRole)) {
      return res.status(400).json(formatResponse(
        false,
        null,
        `CRM follow-ups can only be assigned to Receptionist or PRO/Manager. Assigned user has role '${assignedRole}'.`
      ));
    }

    const branchId = req.user.branch_id || 1;

    const result = await db.query(`
      INSERT INTO crm_followups (patient_id, category, assigned_to, status, due_date, remarks, branch_id)
      VALUES ($1, $2, $3, 'pending', $4, $5, $6)
      RETURNING *
    `, [patient_id, category, assigned_to, due_date || new Date(), remarks || null, branchId]);

    res.locals.auditEntry = { module: 'CRM Management', action: 'Create CRM Followup', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'CRM followup created successfully'));
  } catch (err) {
    console.error('createFollowup error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createAcqPatient(req, res) {
  try {
    const { patient_id, monthly_plan_amount, start_date, end_date, frequency, renewal_date } = req.body;
    if (!patient_id || monthly_plan_amount === undefined || !start_date) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, monthly_plan_amount, and start_date are required'));
    }

    const result = await db.query(`
      INSERT INTO acq_patients (patient_id, monthly_plan_amount, start_date, end_date, frequency, status, renewal_date)
      VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING *
    `, [patient_id, monthly_plan_amount, start_date, end_date || null, frequency || 'monthly', renewal_date || null]);

    res.locals.auditEntry = { module: 'CRM Management', action: 'Create ACQ Patient Plan', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'ACQ patient plan created successfully'));
  } catch (err) {
    console.error('createAcqPatient error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function markOcNrPatient(req, res) {
  try {
    const { patient_id, classification, reason } = req.body;
    if (!patient_id || !classification || !['oc', 'nr'].includes(classification)) {
      return res.status(400).json(formatResponse(false, null, 'patient_id and classification (oc/nr) are required'));
    }

    const result = await db.query(`
      INSERT INTO oc_nr_patients (patient_id, classification, reason)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [patient_id, classification, reason || null]);

    res.locals.auditEntry = { module: 'CRM Management', action: 'Mark OC/NR Patient', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], `Patient marked as ${classification.toUpperCase()} successfully`));
  } catch (err) {
    console.error('markOcNrPatient error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createReferral(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const {
      patient_id, patient_name, mobile_number, patient_mobile_number,
      gender, age, area, remarks, referral_type, referred_by,
      employee_mobile_number, referred_by_mobile
    } = req.body;

    const refType = (referral_type || 'employee').toLowerCase();
    if (!['employee', 'patient'].includes(refType)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'referral_type must be either employee or patient'));
    }

    const branchId = req.user.branch_id || 1;
    let targetPatientId = patient_id ? parseInt(patient_id) : null;
    const patientMobile = mobile_number || patient_mobile_number;

    // 1. Resolve or create patient
    if (!targetPatientId && patientMobile) {
      const ptRes = await client.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [patientMobile]);
      if (ptRes.rows.length > 0) {
        targetPatientId = ptRes.rows[0].patient_id;
      } else {
        // Create new patient record
        const newPtRes = await client.query(`
          INSERT INTO patients (full_name, mobile_number, age, gender, address, patient_type, branch_id)
          VALUES ($1, $2, $3, $4, $5, 'new', $6) RETURNING patient_id
        `, [
          patient_name || 'Referred Patient',
          patientMobile,
          age ? parseInt(age) : null,
          gender || null,
          area || null,
          branchId
        ]);
        targetPatientId = newPtRes.rows[0].patient_id;
      }
    }

    if (!targetPatientId) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_id or patient mobile_number is required'));
    }

    // 2. Resolve referred_by employee user_id from employee mobile number or user_id
    let referredByUserId = null;
    const empMobile = employee_mobile_number || referred_by_mobile;

    if (referred_by && !isNaN(parseInt(referred_by))) {
      referredByUserId = parseInt(referred_by);
    } else if (empMobile) {
      const empRes = await client.query(`
        SELECT user_id FROM users WHERE mobile_number = $1 OR employee_id = $1
      `, [empMobile.toString().trim()]);
      if (empRes.rows.length > 0) {
        referredByUserId = empRes.rows[0].user_id;
      }
    }

    // Fallback to current authenticated user if not found and type is employee
    if (!referredByUserId && refType === 'employee') {
      referredByUserId = req.user.user_id;
    }

    // 3. Insert into referrals table
    const refRes = await client.query(`
      INSERT INTO referrals (patient_id, referral_type, referred_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [targetPatientId, refType, referredByUserId]);

    const newReferral = refRes.rows[0];

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'CRM Management', action: 'Create Referral', recordId: newReferral.id, newValue: newReferral };
    return res.status(201).json(formatResponse(true, {
      referral_id: newReferral.id,
      patient_id: targetPatientId,
      referral_type: refType,
      referred_by_user_id: referredByUserId,
      remarks: remarks || null
    }, `${refType.toUpperCase()} referral created successfully (routes to Unit Target)`));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createReferral error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

module.exports = {
  getFollowups,
  createFollowup,
  createAcqPatient,
  markOcNrPatient,
  createReferral
};
