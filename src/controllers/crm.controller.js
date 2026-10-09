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

async function getAcqPatients(req, res) {
  try {
    let query = `
      SELECT a.id, a.id as acq_id, a.patient_id, a.monthly_plan_amount,
             to_char(a.start_date, 'YYYY-MM-DD') as start_date,
             to_char(a.end_date, 'YYYY-MM-DD') as end_date,
             a.frequency, a.status,
             to_char(a.renewal_date, 'YYYY-MM-DD') as renewal_date,
             a.created_at, a.package_id,
             p.full_name as patient_name,
             p.mobile_number,
             p.registration_id
      FROM acq_patients a
      JOIN patients p ON a.patient_id = p.patient_id
    `;
    const params = [];
    if (req.user.role !== 'super_admin' || req.query.branch_id) {
      params.push(req.query.branch_id ? parseInt(req.query.branch_id) : (req.user.branch_id || 1));
      query += ` WHERE p.branch_id = $1`;
    }
    query += ` ORDER BY a.id DESC`;

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'ACQ patients retrieved successfully'));
  } catch (err) {
    console.error('getAcqPatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createAcqPatient(req, res) {
  try {
    const { patient_id, monthly_plan_amount, start_date, end_date, frequency, renewal_date, plan_name } = req.body;
    if (!patient_id || monthly_plan_amount === undefined || !start_date) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, monthly_plan_amount, and start_date are required'));
    }

    const pId = parseInt(patient_id);
    if (isNaN(pId) || pId <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Valid numeric patient_id is required'));
    }

    const numAmount = parseFloat(monthly_plan_amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json(formatResponse(false, null, 'monthly_plan_amount must be a non-negative number'));
    }

    const ptCheck = await db.query(`SELECT patient_id, branch_id, full_name FROM patients WHERE patient_id = $1`, [pId]);
    if (ptCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Patient ID ${pId} not found`));
    }

    const branchId = req.user.branch_id || ptCheck.rows[0].branch_id || 1;

    // Idempotency: duplicate ACQ creation within 5 seconds
    const dupCheck = await db.query(`
      SELECT id FROM acq_patients
      WHERE patient_id = $1 AND start_date = $2 AND monthly_plan_amount = $3
        AND created_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [pId, start_date, numAmount]);

    if (dupCheck.rows.length > 0) {
      return res.status(409).json(formatResponse(false, null, 'Duplicate ACQ subscription creation detected. Please wait a moment.'));
    }

    // Insert ACQ plan record
    const result = await db.query(`
      INSERT INTO acq_patients (patient_id, monthly_plan_amount, start_date, end_date, frequency, status, renewal_date)
      VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING *
    `, [pId, numAmount, start_date, end_date || null, frequency || 'monthly', renewal_date || null]);

    const acqRecord = result.rows[0];

    // Determine assigned staff user for the CRM follow-up task (Rule 16: receptionist or pro_manager)
    let assignedUserId = req.user.user_id;
    if (req.user.role === 'executive') {
      const staffRes = await db.query(
        `SELECT user_id FROM users WHERE branch_id = $1 AND role IN ('receptionist', 'pro_manager') AND is_active = true LIMIT 1`,
        [branchId]
      );
      if (staffRes.rows.length > 0) {
        assignedUserId = staffRes.rows[0].user_id;
      }
    }

    // Automated CRM Follow-up task under category 'acq' (ACQ Monthly Care)
    const followupDueDate = renewal_date || new Date(new Date(start_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const followupRemarks = `ACQ Monthly Care: Renewal & Medicine Refill (₹${numAmount}/mo) for ${ptCheck.rows[0].full_name || 'Patient #' + pId}`;

    await db.query(`
      INSERT INTO crm_followups (
        patient_id, category, due_date, assigned_to, status, remarks, branch_id
      ) VALUES ($1, 'acq', $2, $3, 'pending', $4, $5)
    `, [pId, followupDueDate, assignedUserId, followupRemarks, branchId]);

    res.locals.auditEntry = { module: 'CRM Management', action: 'Create ACQ Patient Plan', recordId: acqRecord.id, newValue: acqRecord };
    return res.status(201).json(formatResponse(true, acqRecord, 'ACQ patient plan created successfully and scheduled in CRM'));
  } catch (err) {
    console.error('createAcqPatient error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getOcNrPatients(req, res) {
  try {
    let query = `
      SELECT o.id, o.id as oc_nr_id, o.patient_id, o.classification, o.reason,
             to_char(o.marked_at, 'YYYY-MM-DD HH24:MI:SS') as marked_at,
             p.full_name as patient_name,
             p.mobile_number,
             p.registration_id
      FROM oc_nr_patients o
      JOIN patients p ON o.patient_id = p.patient_id
    `;
    const params = [];
    if (req.user.role !== 'super_admin' || req.query.branch_id) {
      params.push(req.query.branch_id ? parseInt(req.query.branch_id) : (req.user.branch_id || 1));
      query += ` WHERE p.branch_id = $1`;
    }
    query += ` ORDER BY o.id DESC`;

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'OC/NR patients list retrieved successfully'));
  } catch (err) {
    console.error('getOcNrPatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function markOcNrPatient(req, res) {
  try {
    const { patient_id, classification, reason } = req.body;
    if (!patient_id || !classification) {
      return res.status(400).json(formatResponse(false, null, 'patient_id and classification (oc/nr) are required'));
    }

    const pId = parseInt(patient_id);
    if (isNaN(pId) || pId <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Valid numeric patient_id is required'));
    }

    const normClass = String(classification).trim().toLowerCase();
    if (!['oc', 'nr'].includes(normClass)) {
      return res.status(400).json(formatResponse(false, null, "classification must be either 'oc' or 'nr'"));
    }

    const ptCheck = await db.query(`SELECT patient_id, branch_id, full_name FROM patients WHERE patient_id = $1`, [pId]);
    if (ptCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Patient ID ${pId} not found`));
    }

    const branchId = req.user.branch_id || ptCheck.rows[0].branch_id || 1;
    const cleanReason = (reason || '').trim();

    // Idempotency: duplicate OC/NR within 5 seconds
    const dupCheck = await db.query(`
      SELECT id FROM oc_nr_patients
      WHERE patient_id = $1 AND classification = $2
        AND marked_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [pId, normClass]);

    if (dupCheck.rows.length > 0) {
      return res.status(409).json(formatResponse(false, null, 'Duplicate OC/NR recording detected. Please wait a moment.'));
    }

    const result = await db.query(`
      INSERT INTO oc_nr_patients (patient_id, classification, reason, marked_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *, id as oc_nr_id, to_char(marked_at, 'YYYY-MM-DD HH24:MI:SS') as marked_at
    `, [pId, normClass, cleanReason || null]);

    const ocnrRecord = result.rows[0];

    // Determine assigned staff user for the 14-day reactivation task (Rule 16: receptionist or pro_manager)
    let assignedUserId = req.user.user_id;
    if (req.user.role === 'executive') {
      const staffRes = await db.query(
        `SELECT user_id FROM users WHERE branch_id = $1 AND role IN ('receptionist', 'pro_manager') AND is_active = true LIMIT 1`,
        [branchId]
      );
      if (staffRes.rows.length > 0) {
        assignedUserId = staffRes.rows[0].user_id;
      }
    }

    // Automatically trigger 14-day reactivation CRM task
    const reactivationDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const reactivationRemarks = `Automated 14-day reactivation task for ${normClass.toUpperCase()} dropout (${cleanReason || 'No reason provided'}) - ${ptCheck.rows[0].full_name || 'Patient #' + pId}`;

    await db.query(`
      INSERT INTO crm_followups (
        patient_id, category, due_date, assigned_to, status, remarks, branch_id
      ) VALUES ($1, 'ocnr', $2, $3, 'pending', $4, $5)
    `, [pId, reactivationDueDate, assignedUserId, reactivationRemarks, branchId]);

    res.locals.auditEntry = { module: 'CRM Management', action: 'Mark OC/NR Patient', recordId: ocnrRecord.id, newValue: ocnrRecord };
    return res.status(201).json(formatResponse(true, ocnrRecord, `Patient marked as ${normClass.toUpperCase()} successfully and 14-day reactivation task scheduled`));
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
  getAcqPatients,
  createAcqPatient,
  getOcNrPatients,
  markOcNrPatient,
  createReferral
};
