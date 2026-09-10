const db = require('../db');
const bcrypt = require('bcryptjs');
const { formatResponse } = require('../utils/helpers');

async function getUsers(req, res) {
  try {
    const { role, status, search } = req.query;
    let query = `
      SELECT u.user_id, u.employee_id, u.full_name, u.mobile_number, u.email, u.gender,
             u.username, u.department, u.designation, u.role, u.status, u.last_login_at, u.created_at,
             CASE
               WHEN u.role = 'receptionist' THEN (
                 SELECT row_to_json(rp) FROM (
                   SELECT registration, enquiry, appointment, checkin, consultation_fee_billing,
                          payment_collection, crm_calling, followup, renewal, due_management
                   FROM receptionist_permissions
                   WHERE user_id = u.user_id
                 ) rp
               )
               WHEN u.role = 'pro_manager' THEN (
                 SELECT row_to_json(pp) FROM (
                   SELECT counselling, billing, payment, due_collection, crm, followup,
                          renewals, complaints, feedback, reports, accountant
                   FROM pro_manager_permissions
                   WHERE user_id = u.user_id
                 ) pp
               )
               WHEN u.role = 'pharmacy' THEN (
                 SELECT row_to_json(php) FROM (
                   SELECT prescription_queue, dispensing, inventory, stock, batch, expiry,
                          returns, stock_adjustment, stock_transactions
                   FROM pharmacy_permissions
                   WHERE user_id = u.user_id
                 ) php
               )
               ELSE NULL
             END as permissions
      FROM users u
      WHERE u.branch_id = $1 AND u.status::text != 'deleted'
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
    return res.status(500).json(formatResponse(false, null, err.message || 'Internal server error'));
  }
}

async function getUserById(req, res) {
  try {
    const userId = parseInt(req.params.id);
    const userRes = await db.query(
      `SELECT user_id, employee_id, full_name, mobile_number, email, gender, date_of_joining,
              username, department, designation, reporting_manager_id, branch_id, role, status, must_change_password, last_login_at, created_at
       FROM users WHERE user_id = $1 AND status::text != 'deleted'`,
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
      const permRes = await db.query(`SELECT * FROM doctor_permissions WHERE user_id = $1`, [userId]);
      user.permissions = permRes.rows[0] || { coupon_management: false };
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
          payment_collection, crm_calling, followup, renewal, due_management, coupon_management
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        p.due_management !== undefined ? p.due_management : true,
        p.coupon_management !== undefined ? p.coupon_management : false
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

      const p = req.body.permissions || {};
      await client.query(`
        INSERT INTO doctor_permissions (user_id, coupon_management)
        VALUES ($1, $2)
      `, [userId, p.coupon_management !== undefined ? p.coupon_management : false]);
    } else if (cleanRole === 'pro_manager') {
      const p = req.body.permissions || {};
      await client.query(`
        INSERT INTO pro_manager_permissions (
          user_id, counselling, billing, payment, due_collection, crm, followup,
          renewals, complaints, feedback, reports, accountant, coupon_management
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        p.accountant !== undefined ? p.accountant : true,
        p.coupon_management !== undefined ? p.coupon_management : false
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

    // Update granular permissions if permissions were provided
    if (req.body.permissions) {
      const p = req.body.permissions;
      if (oldUser.role === 'receptionist') {
        await db.query(`
          INSERT INTO receptionist_permissions (
            user_id, registration, enquiry, appointment, checkin, consultation_fee_billing,
            payment_collection, crm_calling, followup, renewal, due_management, coupon_management, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
          ON CONFLICT (user_id) DO UPDATE SET
            registration = EXCLUDED.registration,
            enquiry = EXCLUDED.enquiry,
            appointment = EXCLUDED.appointment,
            checkin = EXCLUDED.checkin,
            consultation_fee_billing = EXCLUDED.consultation_fee_billing,
            payment_collection = EXCLUDED.payment_collection,
            crm_calling = EXCLUDED.crm_calling,
            followup = EXCLUDED.followup,
            renewal = EXCLUDED.renewal,
            due_management = EXCLUDED.due_management,
            coupon_management = EXCLUDED.coupon_management,
            updated_at = now()
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
          p.due_management !== undefined ? p.due_management : true,
          p.coupon_management !== undefined ? p.coupon_management : false
        ]);
      } else if (oldUser.role === 'pro_manager') {
        await db.query(`
          INSERT INTO pro_manager_permissions (
            user_id, counselling, billing, payment, due_collection, crm, followup,
            renewals, complaints, feedback, reports, accountant, coupon_management, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
          ON CONFLICT (user_id) DO UPDATE SET
            counselling = EXCLUDED.counselling,
            billing = EXCLUDED.billing,
            payment = EXCLUDED.payment,
            due_collection = EXCLUDED.due_collection,
            crm = EXCLUDED.crm,
            followup = EXCLUDED.followup,
            renewals = EXCLUDED.renewals,
            complaints = EXCLUDED.complaints,
            feedback = EXCLUDED.feedback,
            reports = EXCLUDED.reports,
            accountant = EXCLUDED.accountant,
            coupon_management = EXCLUDED.coupon_management,
            updated_at = now()
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
          p.accountant !== undefined ? p.accountant : true,
          p.coupon_management !== undefined ? p.coupon_management : false
        ]);
      } else if (oldUser.role === 'doctor') {
        await db.query(`
          INSERT INTO doctor_permissions (
            user_id, coupon_management, updated_at
          ) VALUES ($1, $2, now())
          ON CONFLICT (user_id) DO UPDATE SET
            coupon_management = EXCLUDED.coupon_management,
            updated_at = now()
        `, [
          userId,
          p.coupon_management !== undefined ? p.coupon_management : false
        ]);
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

async function deleteUser(req, res) {
  const client = await db.pool.connect();
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid user ID'));
    }

    // Safety 1: Prevent deleting root admin
    if (userId === 1) {
      return res.status(400).json(formatResponse(false, null, 'Primary Root Administrator account cannot be deleted'));
    }

    // Safety 2: Prevent deleting self
    if (req.user.user_id === userId) {
      return res.status(400).json(formatResponse(false, null, 'You cannot delete your own active account'));
    }

    const userRes = await db.query(`SELECT * FROM users WHERE user_id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User not found'));
    }
    const targetUser = userRes.rows[0];

    if (targetUser.username === 'admin') {
      return res.status(400).json(formatResponse(false, null, 'Primary Root Administrator account cannot be deleted'));
    }

    // ==========================================
    // 1. DOCTOR ROLE DELETION WORKFLOW
    // ==========================================
    if (targetUser.role === 'doctor') {
      const docRes = await db.query(`SELECT doctor_id, doctor_code, status FROM doctors WHERE user_id = $1`, [userId]);
      const doctor = docRes.rows[0];

      if (doctor) {
        const doctorId = doctor.doctor_id;

        // Step A: Check for ACTIVE blocking clinical / operational records
        // Any appointment not finished/cancelled
        const apptCheck = await db.query(`
          SELECT COUNT(*) FROM appointments
          WHERE doctor_id = $1
            AND status NOT IN ('completed', 'cancelled', 'no_show', 'doctor_completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed')
        `, [doctorId]);
        const activeApptCount = parseInt(apptCheck.rows[0]?.count || 0);

        // Active treatment plans
        let activeTreatmentsCount = 0;
        try {
          const tpCheck = await db.query(`
            SELECT COUNT(*) FROM treatment_plans WHERE doctor_id = $1 AND status = 'active'
          `, [doctorId]);
          activeTreatmentsCount = parseInt(tpCheck.rows[0]?.count || 0);
        } catch (e) {}

        // Pending renewals / followups
        let pendingRenewalsCount = 0;
        try {
          const renCheck = await db.query(`
            SELECT COUNT(*) FROM renewals WHERE doctor_id = $1 AND status = 'pending'
          `, [doctorId]);
          pendingRenewalsCount = parseInt(renCheck.rows[0]?.count || 0);
        } catch (e) {}

        // Active / pending packages
        let activePackagesCount = 0;
        try {
          const pkgCheck = await db.query(`
            SELECT COUNT(*) FROM packages WHERE doctor_id = $1 AND status IN ('pending', 'active')
          `, [doctorId]);
          activePackagesCount = parseInt(pkgCheck.rows[0]?.count || 0);
        } catch (e) {}

        // Pending doctor leaves
        let pendingLeavesCount = 0;
        try {
          const leaveCheck = await db.query(`
            SELECT COUNT(*) FROM doctor_leaves WHERE doctor_id = $1 AND status = 'pending'
          `, [doctorId]);
          pendingLeavesCount = parseInt(leaveCheck.rows[0]?.count || 0);
        } catch (e) {}

        // Draft consultations
        let draftConsultCount = 0;
        try {
          const draftCheck = await db.query(`
            SELECT COUNT(*) FROM consultations WHERE doctor_id = $1 AND status = 'draft'
          `, [doctorId]);
          draftConsultCount = parseInt(draftCheck.rows[0]?.count || 0);
        } catch (e) {}

        const activeBlockers = [];
        if (activeApptCount > 0) activeBlockers.push(`${activeApptCount} active/scheduled appointment(s)`);
        if (activeTreatmentsCount > 0) activeBlockers.push(`${activeTreatmentsCount} active treatment plan(s)`);
        if (pendingRenewalsCount > 0) activeBlockers.push(`${pendingRenewalsCount} pending renewal/followup(s)`);
        if (activePackagesCount > 0) activeBlockers.push(`${activePackagesCount} active package(s)`);
        if (draftConsultCount > 0) activeBlockers.push(`${draftConsultCount} draft consultation(s)`);
        if (pendingLeavesCount > 0) activeBlockers.push(`${pendingLeavesCount} pending leave request(s)`);

        if (activeBlockers.length > 0) {
          return res.status(400).json(formatResponse(
            false,
            null,
            `Cannot delete doctor "${targetUser.full_name}" because they have active linked connections in the database (${activeBlockers.join(', ')}). Please clear or transfer their records first before deleting.`
          ));
        }

        // Step B: Check if doctor has permanent historical records (completed appointments, consultations, prescriptions, bills, doctor transfers)
        const histCheck = await db.query(`
          SELECT
            (SELECT COUNT(*) FROM consultations WHERE doctor_id = $1) as consult_count,
            (SELECT COUNT(*) FROM prescriptions WHERE doctor_id = $1) as presc_count,
            (SELECT COUNT(*) FROM appointments WHERE doctor_id = $1) as appt_count,
            (SELECT COUNT(*) FROM bills WHERE doctor_id = $1 OR created_by = $2) as bill_count,
            (SELECT COUNT(*) FROM payments WHERE received_by = $2) as payment_count,
            (SELECT COUNT(*) FROM doctor_transfers WHERE from_doctor_id = $1 OR to_doctor_id = $1) as transfer_count
        `, [doctorId, userId]);
        const h = histCheck.rows[0];
        const hasHistory = (
          parseInt(h.consult_count || 0) > 0 ||
          parseInt(h.presc_count || 0) > 0 ||
          parseInt(h.appt_count || 0) > 0 ||
          parseInt(h.bill_count || 0) > 0 ||
          parseInt(h.payment_count || 0) > 0 ||
          parseInt(h.transfer_count || 0) > 0
        );

        await client.query('BEGIN');

        // Clean up auxiliary tables
        try {
          await client.query(`DELETE FROM doctor_targets WHERE doctor_id = $1`, [doctorId]);
        } catch (e) {}
        try {
          await client.query(`DELETE FROM consultation_fees WHERE doctor_id = $1`, [doctorId]);
        } catch (e) {}
        try {
          await client.query(`DELETE FROM doctor_leaves WHERE doctor_id = $1`, [doctorId]);
        } catch (e) {}

        if (hasHistory) {
          // Soft-delete / archive: maintain relational integrity & medical audit trail
          const docCodeSuffix = `_del_${doctorId}`;
          const userSuffix = `_del_${userId}`;
          const newDocCode = (doctor.doctor_code.length + docCodeSuffix.length <= 30)
            ? `${doctor.doctor_code}${docCodeSuffix}`
            : `${doctor.doctor_code.slice(0, 30 - docCodeSuffix.length)}${docCodeSuffix}`;
          const newEmpId = (targetUser.employee_id.length + userSuffix.length <= 30)
            ? `${targetUser.employee_id}${userSuffix}`
            : `${targetUser.employee_id.slice(0, 30 - userSuffix.length)}${userSuffix}`;
          const newUsername = (targetUser.username.length + userSuffix.length <= 50)
            ? `${targetUser.username}${userSuffix}`
            : `${targetUser.username.slice(0, 50 - userSuffix.length)}${userSuffix}`;

          await client.query(`
            UPDATE doctors
            SET status = 'deleted',
                doctor_code = $1,
                updated_at = now()
            WHERE doctor_id = $2
          `, [newDocCode, doctorId]);

          await client.query(`
            UPDATE users
            SET status = 'deleted',
                username = $1,
                employee_id = $2,
                updated_at = now()
            WHERE user_id = $3
          `, [newUsername, newEmpId, userId]);
        } else {
          // Hard delete
          try {
            await client.query(`DELETE FROM doctor_transfers WHERE from_doctor_id = $1 OR to_doctor_id = $1`, [doctorId]);
          } catch (e) {}
          await client.query(`DELETE FROM doctors WHERE doctor_id = $1`, [doctorId]);
          await client.query(`DELETE FROM password_reset_requests WHERE user_id = $1`, [userId]);
          await client.query(`DELETE FROM login_logs WHERE user_id = $1`, [userId]);
          await client.query(`DELETE FROM audit_logs WHERE user_id = $1`, [userId]);
          await client.query(`DELETE FROM users WHERE user_id = $1`, [userId]);
        }

        await client.query('COMMIT');

        res.locals.auditEntry = {
          module: 'User Management',
          action: 'Delete User',
          recordId: userId,
          oldValue: { username: targetUser.username, employee_id: targetUser.employee_id, full_name: targetUser.full_name, role: targetUser.role }
        };

        return res.json(formatResponse(true, null, `Doctor ${targetUser.full_name} (@${targetUser.username}) deleted successfully`));
      }
    }

    // ==========================================
    // 2. NON-DOCTOR ROLES DELETION WORKFLOW
    // ==========================================
    // Safely check feedback_complaints if table exists
    let feedbackCount = 0;
    try {
      const fcCheck = await db.query(
        `SELECT COUNT(*) FROM feedback_complaints WHERE assigned_to = $1 OR logged_by = $1`,
        [userId]
      );
      feedbackCount = parseInt(fcCheck.rows[0]?.count || 0);
    } catch (e) {
      feedbackCount = 0;
    }

    // Check if user has active or historical financial/operational records
    const checkRecords = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM bills WHERE created_by = $1) as bill_count,
        (SELECT COUNT(*) FROM payments WHERE received_by = $1) as payment_count,
        (SELECT COUNT(*) FROM appointments WHERE created_by = $1) as appt_count,
        (SELECT COUNT(*) FROM consultations WHERE vitals_recorded_by = $1) as consult_count,
        (SELECT COUNT(*) FROM leads WHERE assigned_receptionist_id = $1 OR lead_created_by_user_id = $1) as lead_count,
        (SELECT COUNT(*) FROM crm_followups WHERE assigned_to = $1) as followup_count
    `, [userId]);

    const stats = checkRecords.rows[0];
    const hasHistory = (
      parseInt(stats.bill_count || 0) > 0 ||
      parseInt(stats.payment_count || 0) > 0 ||
      parseInt(stats.appt_count || 0) > 0 ||
      parseInt(stats.consult_count || 0) > 0 ||
      parseInt(stats.lead_count || 0) > 0 ||
      parseInt(stats.followup_count || 0) > 0 ||
      feedbackCount > 0
    );

    if (hasHistory) {
      return res.status(400).json(formatResponse(
        false,
        null,
        `Cannot delete staff member "${targetUser.full_name}" because they have active linked connections (such as patient appointments, clinical consultations, prescriptions, billing/payments, or assigned leads). Please clear or transfer their connections first before deleting.`
      ));
    }

    await client.query('BEGIN');

    // Clean up auxiliary tables depending on role
    if (targetUser.role === 'receptionist') {
      await client.query(`DELETE FROM receptionist_permissions WHERE user_id = $1`, [userId]);
    } else if (targetUser.role === 'pro_manager') {
      await client.query(`DELETE FROM pro_manager_permissions WHERE user_id = $1`, [userId]);
    } else if (targetUser.role === 'pharmacy') {
      await client.query(`DELETE FROM pharmacy_permissions WHERE user_id = $1`, [userId]);
    } else if (targetUser.role === 'executive') {
      await client.query(`DELETE FROM executives WHERE user_id = $1`, [userId]);
    }

    await client.query(`DELETE FROM password_reset_requests WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM login_logs WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM audit_logs WHERE user_id = $1`, [userId]);

    // Finally delete user row
    await client.query(`DELETE FROM users WHERE user_id = $1`, [userId]);

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'User Management',
      action: 'Delete User',
      recordId: userId,
      oldValue: { username: targetUser.username, employee_id: targetUser.employee_id, full_name: targetUser.full_name, role: targetUser.role }
    };

    return res.json(formatResponse(true, null, `User ${targetUser.full_name} (@${targetUser.username}) deleted successfully`));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deleteUser error:', err);
    if (err.code === '23503') {
      return res.status(400).json(formatResponse(
        false,
        null,
        'Cannot delete this user because they have active linked connections in the database. Please clear or transfer their records first before deleting.'
      ));
    }
    return res.status(500).json(formatResponse(false, null, err.message || 'Internal server error'));
  } finally {
    client.release();
  }
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser
};
