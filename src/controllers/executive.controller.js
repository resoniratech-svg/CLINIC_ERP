const db = require('../db');
const { formatResponse } = require('../utils/helpers');

// Helper to resolve executive_id for current user
async function resolveExecutiveId(userId, branchId) {
  if (!userId) return null;
  try {
    const res = await db.query(
      `SELECT executive_id, per_lead_incentive FROM executives WHERE user_id = $1`,
      [userId]
    );
    if (res.rows.length > 0) {
      return res.rows[0];
    }

    // Check if user actually exists before auto-provisioning
    const userCheck = await db.query(
      `SELECT user_id, role, branch_id FROM users WHERE user_id = $1`,
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return null;
    }

    const effectiveBranchId = branchId || userCheck.rows[0].branch_id || 1;

    // Auto-provision executive record if user exists
    const newExec = await db.query(
      `INSERT INTO executives (user_id, per_lead_incentive, branch_id, status)
       VALUES ($1, 100.00, $2, 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = 'active'
       RETURNING executive_id, per_lead_incentive`,
      [userId, effectiveBranchId]
    );
    return newExec.rows[0] || null;
  } catch (err) {
    console.error(`resolveExecutiveId error for userId ${userId}:`, err.message);
    return null;
  }
}

// 2. Executive Dashboard
async function getDashboard(req, res) {
  try {
    const userId = req.user.user_id;
    const branchId = req.user.branch_id || 1;
    const today = new Date().toISOString().split('T')[0];

    const execInfo = await resolveExecutiveId(userId, branchId);
    const execId = execInfo ? execInfo.executive_id : null;

    // Calls today counts
    const callsRes = await db.query(`
      SELECT 
        COUNT(*) as calls_today,
        COUNT(CASE WHEN call_status IN ('connected', 'interested', 'not_interested', 'callback_requested', 'appointment_booked') THEN 1 END) as connected,
        COUNT(CASE WHEN interaction_type = 'inbound' THEN 1 END) as inbound,
        COUNT(CASE WHEN interaction_type = 'outbound' THEN 1 END) as outbound,
        COUNT(CASE WHEN call_status = 'callback_requested' AND task_status = 'pending' THEN 1 END) as callbacks,
        COUNT(CASE WHEN call_status = 'interested' THEN 1 END) as interested,
        COUNT(CASE WHEN call_status = 'not_interested' THEN 1 END) as not_interested
      FROM call_records
      WHERE handled_by = $1 AND DATE(created_at) = $2
    `, [userId, today]);

    // Leads created today
    const leadsRes = await db.query(`
      SELECT COUNT(*) as leads_created FROM leads
      WHERE lead_created_by_user_id = $1 AND DATE(created_at) = $2
    `, [userId, today]);

    // Appointments converted from executive leads
    const apptsRes = await db.query(`
      SELECT COUNT(*) as appointments_converted
      FROM appointments a
      JOIN leads l ON a.patient_id = l.patient_id
      WHERE l.lead_created_by_user_id = $1
    `, [userId]);

    // Incentive calculation for current month
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    const perfRes = await db.query(`
      SELECT leads_generated, incentive_earned FROM executive_performance
      WHERE executive_id = $1 AND month = $2 AND year = $3
    `, [execId, curMonth, curYear]);

    const monthLeadsCount = await db.query(`
      SELECT COUNT(*) as month_leads FROM leads
      WHERE executive_id = $1 AND EXTRACT(MONTH FROM created_at) = $2 AND EXTRACT(YEAR FROM created_at) = $3
    `, [execId, curMonth, curYear]);

    const perLeadIncentive = execInfo ? parseFloat(execInfo.per_lead_incentive || 100) : 100;
    const leadsGeneratedMonth = perfRes.rows.length > 0 ? parseInt(perfRes.rows[0].leads_generated) : parseInt(monthLeadsCount.rows[0].month_leads || 0);
    const incentiveEarned = leadsGeneratedMonth * perLeadIncentive;

    const stats = callsRes.rows[0];
    const dashboardData = {
      calls_today: parseInt(stats.calls_today || 0),
      connected: parseInt(stats.connected || 0),
      leads_created: parseInt(leadsRes.rows[0].leads_created || 0),
      inbound: parseInt(stats.inbound || 0),
      outbound: parseInt(stats.outbound || 0),
      callbacks: parseInt(stats.callbacks || 0),
      interested: parseInt(stats.interested || 0),
      not_interested: parseInt(stats.not_interested || 0),
      appointments_converted: parseInt(apptsRes.rows[0].appointments_converted || 0),
      incentive: {
        month: curMonth,
        year: curYear,
        per_lead_incentive: perLeadIncentive,
        leads_generated: leadsGeneratedMonth,
        current_incentive: incentiveEarned
      }
    };

    return res.json(formatResponse(true, dashboardData, 'Executive dashboard metrics retrieved successfully'));
  } catch (err) {
    console.error('getExecutiveDashboard error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 4 & 5. Inbound Patient Search (Existing vs New)
async function searchPatientInbound(req, res) {
  try {
    const mobile = req.query.mobile || req.body.mobile_number || req.body.mobile;
    if (!mobile) {
      return res.status(400).json(formatResponse(false, null, 'Mobile number parameter (mobile) is required'));
    }

    const patientRes = await db.query(
      `SELECT patient_id, full_name, mobile_number, registration_id, patient_type, created_at FROM patients WHERE mobile_number = $1`,
      [mobile]
    );

    if (patientRes.rows.length > 0) {
      const patient = patientRes.rows[0];

      // Fetch non-clinical patient overview (Visits, Appointments, Lead status, Call history)
      const apptsRes = await db.query(
        `SELECT appointment_id, appointment_date, appointment_time, status FROM appointments WHERE patient_id = $1 ORDER BY appointment_date DESC LIMIT 5`,
        [patient.patient_id]
      );
      const leadsRes = await db.query(
        `SELECT lead_id, lead_name, status, created_at FROM leads WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [patient.patient_id]
      );
      const callsRes = await db.query(
        `SELECT call_id, interaction_type, call_purpose, call_status, created_at FROM call_records WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [patient.patient_id]
      );

      return res.json(formatResponse(true, {
        is_existing: true,
        patient_type: 'existing',
        patient: {
          ...patient,
          previous_appointments: apptsRes.rows,
          previous_leads: leadsRes.rows,
          call_history: callsRes.rows
        }
      }, 'Existing patient record found. Non-clinical overview retrieved.'));
    } else {
      return res.json(formatResponse(true, {
        is_existing: false,
        patient_type: 'new',
        patient: null
      }, 'No existing patient found with this mobile number. Proceed to New Lead creation.'));
    }
  } catch (err) {
    console.error('searchPatientInbound error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 6 & 12. Create Lead (Inbound / Outbound)
async function createLead(req, res) {
  try {
    const {
      lead_name, mobile_number, age, gender, village, mandal,
      source, campaign, lead_source, preferred_doctor_id, preferred_date, preferred_time, remarks,
      requirement, problem, ailment_reason
    } = req.body;

    if (!lead_name || !mobile_number) {
      return res.status(400).json(formatResponse(false, null, 'lead_name and mobile_number are required'));
    }

    const branchId = req.user.branch_id || 1;
    const execInfo = await resolveExecutiveId(req.user.user_id, branchId);
    const execId = execInfo ? execInfo.executive_id : null;
    const sourceTag = (lead_source || 'inbound').toLowerCase() === 'outbound' ? 'outbound' : 'inbound';
    const finalRequirement = requirement ? requirement.trim() : (problem ? problem.trim() : (ailment_reason ? ailment_reason.trim() : null));
    const finalRemarks = remarks ? remarks.trim() : null;

    // Link to patient if existing
    const patRes = await db.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [mobile_number]);
    const patientId = patRes.rows.length > 0 ? patRes.rows[0].patient_id : null;

    const result = await db.query(`
      INSERT INTO leads (
        patient_id, lead_name, mobile_number, age, gender, village, mandal,
        source, campaign, lead_created_by_user_id, executive_id, lead_source,
        status, branch_id, requirement, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', $13, $14, $15)
      RETURNING *
    `, [
      patientId, lead_name, mobile_number, age || null, gender || null, village || null, mandal || null,
      source || (sourceTag === 'outbound' ? 'Outbound Excel' : 'Inbound Call'), campaign || null,
      req.user.user_id, execId, sourceTag, branchId, finalRequirement, finalRemarks
    ]);

    const newLead = result.rows[0];

    // Log call record for lead creation
    await db.query(`
      INSERT INTO call_records (
        patient_id, lead_id, interaction_type, call_purpose, call_status,
        handled_by, branch_id, remarks
      ) VALUES ($1, $2, $3, 'followup', 'interested', $4, $5, $6)
    `, [patientId, newLead.lead_id, sourceTag, req.user.user_id, branchId, remarks || 'Lead created']);

    // Update Executive Performance & Incentive
    if (execId) {
      const now = new Date();
      const curMonth = now.getMonth() + 1;
      const curYear = now.getFullYear();
      const perLeadIncentive = execInfo ? parseFloat(execInfo.per_lead_incentive || 100) : 100;

      await db.query(`
        INSERT INTO executive_performance (executive_id, month, year, leads_generated, incentive_earned)
        VALUES ($1, $2, $3, 1, $4)
        ON CONFLICT (executive_id, month, year)
        DO UPDATE SET
          leads_generated = executive_performance.leads_generated + 1,
          incentive_earned = (executive_performance.leads_generated + 1) * $4,
          updated_at = now()
      `, [execId, curMonth, curYear, perLeadIncentive]);
    }

    res.locals.auditEntry = { module: 'Executive / Call Center', action: 'Create Lead', recordId: newLead.lead_id, newValue: newLead };
    return res.status(201).json(formatResponse(true, {
      lead: newLead,
      handoff_target: 'Receptionist Lead Queue'
    }, 'Lead generated successfully and routed to Receptionist Lead Queue'));

  } catch (err) {
    console.error('createLead error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 8 & 9. Outbound Excel Import
async function importOutboundLeads(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { file_name, records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'An array of records is required for outbound import'));
    }

    const branchId = req.user.branch_id || 1;

    // Create import batch
    const batchRes = await client.query(`
      INSERT INTO outbound_import_batches (imported_by, file_name, total_records)
      VALUES ($1, $2, $3) RETURNING batch_id
    `, [req.user.user_id, file_name || 'outbound_data.xlsx', records.length]);

    const batchId = batchRes.rows[0].batch_id;
    let validCount = 0;
    let duplicateCount = 0;
    const importedLeads = [];

    for (const rec of records) {
      const mobile = rec.mobile_number || rec.mobile;
      if (!mobile) continue;

      // Validate duplicates against patients and existing outbound leads
      const dupCheck = await client.query(`
        SELECT mobile_number FROM patients WHERE mobile_number = $1
        UNION
        SELECT mobile_number FROM outbound_leads WHERE mobile_number = $1
      `, [mobile]);

      if (dupCheck.rows.length > 0) {
        duplicateCount++;
        continue;
      }

      let assignedExecId = rec.assigned_executive_id || null;
      if (!assignedExecId && req.user.role === 'executive') {
        const execInfo = await resolveExecutiveId(req.user.user_id, branchId);
        assignedExecId = execInfo ? execInfo.executive_id : null;
      }

      const serialNo = rec.serial_no || rec.serial_number || rec.sl_no || null;
      const problemText = rec.problem || rec.reason || rec.requirement || rec.ailment || null;

      let cleanGender = null;
      if (rec.gender) {
        const g = rec.gender.toString().toLowerCase().trim();
        if (g === 'm' || g === 'male') cleanGender = 'male';
        else if (g === 'f' || g === 'female') cleanGender = 'female';
        else if (g === 'other') cleanGender = 'other';
        else cleanGender = null;
      }

      const insRes = await client.query(`
        INSERT INTO outbound_leads (
          batch_id, serial_no, patient_name, mobile_number, problem, age, gender, village, mandal,
          source, campaign, assigned_executive_id, status, remarks, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', $13, $14)
        RETURNING *
      `, [
        batchId, serialNo, rec.patient_name || rec.name || 'Unknown', mobile, problemText, rec.age || null,
        cleanGender, rec.village || null, rec.mandal || null, rec.source || 'Outbound Excel',
        rec.campaign || 'Outbound Campaign', assignedExecId, rec.remarks || null, branchId
      ]);

      validCount++;
      importedLeads.push(insRes.rows[0]);
    }

    await client.query(`
      UPDATE outbound_import_batches SET valid_records = $1, duplicate_records = $2 WHERE batch_id = $3
    `, [validCount, duplicateCount, batchId]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Executive Outbound', action: 'Import Excel Leads', recordId: batchId, remarks: `Imported ${validCount} valid, skipped ${duplicateCount} duplicates` };
    return res.status(201).json(formatResponse(true, {
      batch_id: batchId,
      total_records: records.length,
      valid_records: validCount,
      duplicate_records: duplicateCount,
      imported_leads: importedLeads
    }, 'Outbound data imported successfully with duplicate validation'));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('importOutboundLeads error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// 10. Executive Outbound Calling Queue
async function getOutboundQueue(req, res) {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const userRole = req.user?.role;
    const branchId = req.query?.branch_id
      ? parseInt(req.query.branch_id)
      : (req.user?.branch_id ? parseInt(req.user.branch_id) : 1);

    const execInfo = userId ? await resolveExecutiveId(userId, branchId) : null;
    const execId = execInfo ? execInfo.executive_id : null;

    let query = `
      SELECT ol.*, u.full_name as executive_name
      FROM outbound_leads ol
      LEFT JOIN executives e ON ol.assigned_executive_id = e.executive_id
      LEFT JOIN users u ON e.user_id = u.user_id
      WHERE ol.branch_id = $1
        AND ol.status::text IN ('new', 'call_back', 'contacted', 'assigned')
    `;
    const params = [branchId];

    // For executive role, show tasks assigned to this executive OR unassigned tasks
    if (userRole !== 'super_admin' && userRole !== 'admin' && userRole !== 'pro_manager') {
      if (execId) {
        query += ` AND (ol.assigned_executive_id = $2 OR ol.assigned_executive_id IS NULL)`;
        params.push(execId);
      } else {
        query += ` AND ol.assigned_executive_id IS NULL`;
      }
    } else if (req.query?.executive_id) {
      // Optional executive filter for admin
      query += ` AND ol.assigned_executive_id = $${params.length + 1}`;
      params.push(parseInt(req.query.executive_id));
    }

    // Optional status filter
    if (req.query?.status && req.query.status !== 'all') {
      query += ` AND ol.status::text = $${params.length + 1}`;
      params.push(req.query.status.toLowerCase().trim());
    }

    query += ` ORDER BY ol.id ASC`;

    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows || [], 'Executive outbound calling queue retrieved successfully'));
  } catch (err) {
    console.error('getOutboundQueue error:', err);
    // Graceful recovery: return empty queue with 200 rather than crashing UI
    return res.status(200).json(formatResponse(true, [], 'Outbound calling queue retrieved successfully'));
  }
}

// 11. Record Call Outcome & Lead Creation
async function recordCallOutcome(req, res) {
  try {
    const {
      outbound_lead_id, patient_id, lead_id, interaction_type, call_purpose,
      call_status, callback_date, callback_time, remarks, patient_name, mobile_number, age, gender, campaign
    } = req.body;

    if (!call_status) {
      return res.status(400).json(formatResponse(false, null, 'call_status is required'));
    }

    const branchId = req.user.branch_id || 1;
    const execInfo = await resolveExecutiveId(req.user.user_id, branchId);
    const execId = execInfo ? execInfo.executive_id : null;
    const callType = (interaction_type || 'outbound').toLowerCase() === 'inbound' ? 'inbound' : 'outbound';

    // Normalize call status
    let normStatus = call_status.toString().toLowerCase().trim().replace('-', '_');
    if (normStatus === 'call_back_requested') normStatus = 'callback_requested';

    let createdLead = null;

    // If interested -> Automatically create Lead for Receptionist Queue
    if (normStatus === 'interested' || normStatus === 'lead_created') {
      const mob = mobile_number || '9000000000';
      const name = patient_name || 'Interested Patient';

      let callLeadRequirement = req.body.requirement || req.body.problem || req.body.ailment_reason || null;
      if (!callLeadRequirement && outbound_lead_id) {
        const olRes = await db.query(`SELECT problem FROM outbound_leads WHERE id = $1`, [parseInt(outbound_lead_id)]);
        if (olRes.rows.length > 0 && olRes.rows[0].problem) {
          callLeadRequirement = olRes.rows[0].problem;
        }
      }

      const leadRes = await db.query(`
        INSERT INTO leads (
          patient_id, lead_name, mobile_number, age, gender, source, campaign,
          lead_created_by_user_id, executive_id, lead_source, status, branch_id,
          requirement, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', $11, $12, $13)
        RETURNING *
      `, [
        patient_id ? parseInt(patient_id) : null, name, mob, age || null, gender || null,
        callType === 'inbound' ? 'Inbound Call' : 'Outbound Call', campaign || 'Call Campaign',
        req.user.user_id, execId, callType, branchId,
        callLeadRequirement, remarks || null
      ]);

      createdLead = leadRes.rows[0];

      // Update executive performance
      if (execId) {
        const now = new Date();
        const curMonth = now.getMonth() + 1;
        const curYear = now.getFullYear();
        const perLeadIncentive = execInfo ? parseFloat(execInfo.per_lead_incentive || 100) : 100;

        await db.query(`
          INSERT INTO executive_performance (executive_id, month, year, leads_generated, incentive_earned)
          VALUES ($1, $2, $3, 1, $4)
          ON CONFLICT (executive_id, month, year)
          DO UPDATE SET
            leads_generated = executive_performance.leads_generated + 1,
            incentive_earned = (executive_performance.leads_generated + 1) * $4,
            updated_at = now()
        `, [execId, curMonth, curYear, perLeadIncentive]);
      }
    }

    let targetPatientId = patient_id ? parseInt(patient_id) : (createdLead ? createdLead.patient_id : null);
    let targetLeadId = lead_id ? parseInt(lead_id) : (createdLead ? createdLead.lead_id : null);

    if (!targetPatientId && !targetLeadId) {
      if (mobile_number) {
        const patCheck = await db.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [mobile_number]);
        if (patCheck.rows.length > 0) {
          targetPatientId = patCheck.rows[0].patient_id;
        } else {
          const leadCheck = await db.query(`SELECT lead_id FROM leads WHERE mobile_number = $1`, [mobile_number]);
          if (leadCheck.rows.length > 0) {
            targetLeadId = leadCheck.rows[0].lead_id;
          }
        }
      }

      if (!targetPatientId && !targetLeadId) {
        let autoRequirement = req.body.requirement || req.body.problem || null;
        if (!autoRequirement && outbound_lead_id) {
          const olCheck = await db.query(`SELECT problem FROM outbound_leads WHERE id = $1`, [parseInt(outbound_lead_id)]);
          if (olCheck.rows.length > 0) autoRequirement = olCheck.rows[0].problem;
        }

        const autoLead = await db.query(`
          INSERT INTO leads (lead_name, mobile_number, source, lead_created_by_user_id, executive_id, lead_source, status, branch_id, requirement, remarks)
          VALUES ($1, $2, $3, $4, $5, $6, 'contacted', $7, $8, $9) RETURNING lead_id
        `, [patient_name || 'Call Lead', mobile_number || '9000000000', callType === 'inbound' ? 'Inbound Call' : 'Outbound Call', req.user.user_id, execId, callType, branchId, autoRequirement, remarks || null]);
        targetLeadId = autoLead.rows[0].lead_id;
      }
    }

    // Insert call record
    const callRes = await db.query(`
      INSERT INTO call_records (
        patient_id, lead_id, interaction_type, call_purpose, call_status,
        callback_date, callback_time, task_status, handled_by, branch_id, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      targetPatientId,
      targetLeadId,
      callType, call_purpose || 'followup', normStatus,
      callback_date || null, callback_time || null,
      normStatus === 'callback_requested' ? 'pending' : 'completed',
      req.user.user_id, branchId, remarks || null
    ]);

    // Update outbound_leads item status if outbound_lead_id provided
    if (outbound_lead_id) {
      const targetLeadStatus = normStatus === 'interested' ? 'interested' : (normStatus === 'callback_requested' ? 'call_back' : 'contacted');
      await db.query(`
        UPDATE outbound_leads SET status = $1, remarks = $2 WHERE id = $3
      `, [targetLeadStatus, remarks || null, parseInt(outbound_lead_id)]);
    }

    res.locals.auditEntry = { module: 'Executive Calls', action: 'Record Call Outcome', recordId: callRes.rows[0].call_id, newValue: callRes.rows[0] };
    return res.status(201).json(formatResponse(true, {
      call_record: callRes.rows[0],
      created_lead: createdLead,
      handoff: createdLead ? 'Sent to Receptionist Lead Queue' : 'Call outcome saved'
    }, 'Call outcome recorded successfully'));

  } catch (err) {
    console.error('recordCallOutcome error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 15. Callbacks
async function getCallbacks(req, res) {
  try {
    const userId = req.user.user_id;
    const branchId = req.user.branch_id || 1;

    const result = await db.query(`
      SELECT cr.*, p.full_name as patient_name, p.mobile_number as patient_mobile,
             l.lead_name, l.mobile_number as lead_mobile
      FROM call_records cr
      LEFT JOIN patients p ON cr.patient_id = p.patient_id
      LEFT JOIN leads l ON cr.lead_id = l.lead_id
      WHERE cr.handled_by = $1 AND cr.branch_id = $2
        AND cr.call_status = 'callback_requested' AND cr.task_status = 'pending'
      ORDER BY cr.callback_date ASC, cr.callback_time ASC
    `, [userId, branchId]);

    return res.json(formatResponse(true, result.rows, 'Executive callback tasks retrieved successfully'));
  } catch (err) {
    console.error('getCallbacks error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 14 & 16. Leads List & Details
async function getLeads(req, res) {
  try {
    const userId = req.user.user_id;
    const branchId = req.user.branch_id || 1;
    const { status, search } = req.query;

    const execInfo = await resolveExecutiveId(userId, branchId);
    const execId = execInfo ? execInfo.executive_id : null;

    let query = `
      SELECT l.*, u.full_name as executive_name, u.employee_id as executive_employee_id,
             p.full_name as patient_name
      FROM leads l
      LEFT JOIN executives e ON l.executive_id = e.executive_id
      LEFT JOIN users u ON e.user_id = u.user_id
      LEFT JOIN patients p ON l.patient_id = p.patient_id
      WHERE l.branch_id = $1 AND (l.executive_id = $2 OR l.lead_created_by_user_id = $3)
    `;
    const params = [branchId, execId, userId];

    if (status) {
      params.push(status);
      query += ` AND l.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (l.lead_name ILIKE $${params.length} OR l.mobile_number ILIKE $${params.length})`;
    }

    query += ` ORDER BY l.lead_id DESC`;
    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows, 'Executive leads retrieved successfully'));
  } catch (err) {
    console.error('getLeads error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getLeadDetails(req, res) {
  try {
    const leadId = parseInt(req.params.id);
    const branchId = req.user.branch_id || 1;

    const leadRes = await db.query(`
      SELECT l.*, u.full_name as executive_name, u.employee_id as executive_employee_id
      FROM leads l
      LEFT JOIN executives e ON l.executive_id = e.executive_id
      LEFT JOIN users u ON e.user_id = u.user_id
      WHERE l.lead_id = $1 AND l.branch_id = $2
    `, [leadId, branchId]);

    if (leadRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Lead not found'));
    }

    const lead = leadRes.rows[0];
    const callsRes = await db.query(`
      SELECT * FROM call_records WHERE lead_id = $1 ORDER BY created_at DESC
    `, [leadId]);

    return res.json(formatResponse(true, {
      lead,
      call_history: callsRes.rows
    }, 'Lead details retrieved successfully'));
  } catch (err) {
    console.error('getLeadDetails error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 17. Call History
async function getCallHistory(req, res) {
  try {
    const userId = req.user.user_id;
    const branchId = req.user.branch_id || 1;

    const result = await db.query(`
      SELECT cr.*, p.full_name as patient_name, l.lead_name, u.full_name as handled_by_name
      FROM call_records cr
      LEFT JOIN patients p ON cr.patient_id = p.patient_id
      LEFT JOIN leads l ON cr.lead_id = l.lead_id
      LEFT JOIN users u ON cr.handled_by = u.user_id
      WHERE cr.branch_id = $1 AND cr.handled_by = $2
      ORDER BY cr.call_id DESC LIMIT 50
    `, [branchId, userId]);

    return res.json(formatResponse(true, result.rows, 'Executive call history retrieved successfully'));
  } catch (err) {
    console.error('getCallHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 18 & 19. Executive Incentive Report
async function getIncentives(req, res) {
  try {
    const userId = req.user.user_id;
    const branchId = req.user.branch_id || 1;
    const { month, year } = req.query;

    const now = new Date();
    const curMonth = month ? parseInt(month) : now.getMonth() + 1;
    const curYear = year ? parseInt(year) : now.getFullYear();

    const execInfo = await resolveExecutiveId(userId, branchId);
    const execId = execInfo ? execInfo.executive_id : null;
    const perLeadIncentive = execInfo ? parseFloat(execInfo.per_lead_incentive || 100) : 100;

    const perfRes = await db.query(`
      SELECT leads_generated, incentive_earned FROM executive_performance
      WHERE executive_id = $1 AND month = $2 AND year = $3
    `, [execId, curMonth, curYear]);

    const callsRes = await db.query(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN call_status IN ('connected', 'interested', 'not_interested', 'callback_requested', 'appointment_booked') THEN 1 END) as connected_calls
      FROM call_records
      WHERE handled_by = $1 AND EXTRACT(MONTH FROM created_at) = $2 AND EXTRACT(YEAR FROM created_at) = $3
    `, [userId, curMonth, curYear]);

    const leadsCount = perfRes.rows.length > 0 ? parseInt(perfRes.rows[0].leads_generated) : 0;
    const totalIncentive = leadsCount * perLeadIncentive;

    return res.json(formatResponse(true, {
      month: curMonth,
      year: curYear,
      total_calls: parseInt(callsRes.rows[0].total_calls || 0),
      connected_calls: parseInt(callsRes.rows[0].connected_calls || 0),
      leads_generated: leadsCount,
      per_lead_incentive: perLeadIncentive,
      total_incentive_earned: totalIncentive
    }, 'Executive incentive report retrieved successfully'));
  } catch (err) {
    console.error('getIncentives error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 20. Super Admin Executive Performance Report
async function getExecutivePerformanceReport(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const { month, year } = req.query;

    const now = new Date();
    const curMonth = month ? parseInt(month) : now.getMonth() + 1;
    const curYear = year ? parseInt(year) : now.getFullYear();

    const result = await db.query(`
      SELECT 
        e.executive_id, u.full_name as executive_name, u.employee_id,
        e.per_lead_incentive,
        COUNT(DISTINCT cr.call_id) as total_calls,
        COUNT(DISTINCT CASE WHEN cr.call_status IN ('connected', 'interested', 'not_interested', 'callback_requested', 'appointment_booked') THEN cr.call_id END) as connected_calls,
        COALESCE(ep.leads_generated, COUNT(DISTINCT l.lead_id)) as leads_generated,
        (COALESCE(ep.leads_generated, COUNT(DISTINCT l.lead_id)) * e.per_lead_incentive) as incentive_earned
      FROM executives e
      JOIN users u ON e.user_id = u.user_id
      LEFT JOIN call_records cr ON cr.handled_by = u.user_id AND EXTRACT(MONTH FROM cr.created_at) = $2 AND EXTRACT(YEAR FROM cr.created_at) = $3
      LEFT JOIN leads l ON l.executive_id = e.executive_id AND EXTRACT(MONTH FROM l.created_at) = $2 AND EXTRACT(YEAR FROM l.created_at) = $3
      LEFT JOIN executive_performance ep ON ep.executive_id = e.executive_id AND ep.month = $2 AND ep.year = $3
      WHERE e.branch_id = $1
      GROUP BY e.executive_id, u.full_name, u.employee_id, e.per_lead_incentive, ep.leads_generated
      ORDER BY leads_generated DESC
    `, [branchId, curMonth, curYear]);

    const report = result.rows.map(r => ({
      executive_id: r.executive_id,
      executive_name: r.executive_name,
      employee_id: r.employee_id,
      per_lead_incentive: parseFloat(r.per_lead_incentive),
      total_calls: parseInt(r.total_calls || 0),
      connected_calls: parseInt(r.connected_calls || 0),
      leads_generated: parseInt(r.leads_generated || 0),
      incentive_earned: parseFloat(r.incentive_earned || 0)
    }));

    return res.json(formatResponse(true, report, 'Executive performance report retrieved successfully'));
  } catch (err) {
    console.error('getExecutivePerformanceReport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 21. Update Lead Record
async function updateLead(req, res) {
  try {
    const { id } = req.params;
    const {
      lead_name, mobile_number, age, gender, village, mandal,
      campaign, source, status, remarks, requirement, problem, ailment_reason
    } = req.body;

    const leadId = parseInt(id);
    if (!leadId) {
      return res.status(400).json(formatResponse(false, null, 'Invalid lead ID'));
    }

    const leadCheck = await db.query(`SELECT * FROM leads WHERE lead_id = $1`, [leadId]);
    if (leadCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Lead record not found'));
    }

    const current = leadCheck.rows[0];
    const newName = lead_name !== undefined && lead_name !== null ? lead_name.trim() : current.lead_name;
    const newMobile = mobile_number !== undefined && mobile_number !== null ? mobile_number.replace(/\D/g, '') : current.mobile_number;
    const newAge = age !== undefined ? (age ? parseInt(age) : null) : current.age;
    const newGender = gender !== undefined ? gender : current.gender;
    const newVillage = village !== undefined ? (village ? village.trim() : null) : current.village;
    const newMandal = mandal !== undefined ? (mandal ? mandal.trim() : null) : current.mandal;
    const newCampaign = campaign !== undefined ? (campaign ? campaign.trim() : null) : current.campaign;
    const newSource = source !== undefined ? (source ? source.trim() : null) : current.source;
    const newStatus = status !== undefined ? status : current.status;
    const reqVal = requirement !== undefined ? requirement : (problem !== undefined ? problem : ailment_reason);
    const newRequirement = reqVal !== undefined ? (reqVal ? reqVal.trim() : null) : current.requirement;
    const newRemarks = remarks !== undefined ? (remarks ? remarks.trim() : null) : current.remarks;

    const updateRes = await db.query(`
      UPDATE leads
      SET lead_name = $1,
          mobile_number = $2,
          age = $3,
          gender = $4,
          village = $5,
          mandal = $6,
          campaign = $7,
          source = $8,
          status = $9,
          requirement = $10,
          remarks = $11,
          updated_at = now()
      WHERE lead_id = $12
      RETURNING *
    `, [newName, newMobile, newAge, newGender, newVillage, newMandal, newCampaign, newSource, newStatus, newRequirement, newRemarks, leadId]);

    const updatedLead = updateRes.rows[0];

    if (remarks) {
      await db.query(`
        UPDATE call_records
        SET remarks = $1
        WHERE lead_id = $2
      `, [remarks, leadId]);
    }

    res.locals.auditEntry = { module: 'Executive / Call Center', action: 'Update Lead', recordId: leadId, newValue: updatedLead };
    return res.json(formatResponse(true, updatedLead, 'Lead record updated successfully'));
  } catch (err) {
    console.error('updateLead error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 22. Update Outbound Lead Record
async function updateOutboundLead(req, res) {
  try {
    const { id } = req.params;
    const {
      patient_name, mobile_number, age, gender, village, mandal,
      problem, campaign, status, remarks
    } = req.body;

    const leadId = parseInt(id);
    if (!leadId) {
      return res.status(400).json(formatResponse(false, null, 'Invalid outbound lead ID'));
    }

    const leadCheck = await db.query(`SELECT * FROM outbound_leads WHERE id = $1`, [leadId]);
    if (leadCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Outbound lead not found'));
    }

    const current = leadCheck.rows[0];
    const newName = patient_name !== undefined && patient_name !== null ? patient_name.trim() : current.patient_name;
    const newMobile = mobile_number !== undefined && mobile_number !== null ? mobile_number.replace(/\D/g, '') : current.mobile_number;
    let newGender = current.gender;
    if (gender !== undefined && gender !== null) {
      const g = gender.toString().toLowerCase().trim();
      if (g === 'm' || g === 'male') newGender = 'male';
      else if (g === 'f' || g === 'female') newGender = 'female';
      else if (g === 'other') newGender = 'other';
    }

    const newVillage = village !== undefined ? (village ? village.trim() : null) : current.village;
    const newMandal = mandal !== undefined ? (mandal ? mandal.trim() : null) : current.mandal;
    const newProblem = problem !== undefined ? (problem ? problem.trim() : null) : current.problem;
    const newCampaign = campaign !== undefined ? (campaign ? campaign.trim() : null) : current.campaign;

    let newStatus = current.status;
    if (status !== undefined && status !== null) {
      const s = status.toString().toLowerCase().trim().replace('-', '_');
      const validStatuses = ['new', 'interested', 'not_interested', 'converted', 'rejected', 'contacted', 'call_back', 'assigned', 'closed'];
      if (validStatuses.includes(s)) {
        newStatus = s;
      }
    }

    const newRemarks = remarks !== undefined ? (remarks ? remarks.trim() : null) : current.remarks;

    const updateRes = await db.query(`
      UPDATE outbound_leads
      SET patient_name = $1,
          mobile_number = $2,
          age = $3,
          gender = $4,
          village = $5,
          mandal = $6,
          problem = $7,
          campaign = $8,
          status = $9,
          remarks = $10
      WHERE id = $11
      RETURNING *
    `, [newName, newMobile, newAge, newGender, newVillage, newMandal, newProblem, newCampaign, newStatus, newRemarks, leadId]);

    const updated = updateRes.rows[0];
    res.locals.auditEntry = { module: 'Executive Outbound', action: 'Update Outbound Lead', recordId: leadId, newValue: updated };
    return res.json(formatResponse(true, updated, 'Outbound lead updated successfully'));
  } catch (err) {
    console.error('updateOutboundLead error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 23. Update Call Outcome Record
async function updateCallRecord(req, res) {
  try {
    const { id } = req.params;
    const {
      call_status, call_purpose, callback_date, callback_time, remarks
    } = req.body;

    const callId = parseInt(id);
    if (!callId) {
      return res.status(400).json(formatResponse(false, null, 'Invalid call record ID'));
    }

    const callCheck = await db.query(`SELECT * FROM call_records WHERE call_id = $1`, [callId]);
    if (callCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Call record not found'));
    }

    const currentCall = callCheck.rows[0];
    let normStatus = call_status ? call_status.toString().toLowerCase().trim().replace('-', '_') : currentCall.call_status;
    if (normStatus === 'call_back_requested') normStatus = 'callback_requested';

    const newPurpose = call_purpose !== undefined ? call_purpose : currentCall.call_purpose;
    const newCbDate = callback_date !== undefined ? callback_date : currentCall.callback_date;
    const newCbTime = callback_time !== undefined ? callback_time : currentCall.callback_time;
    const newRemarks = remarks !== undefined ? remarks : currentCall.remarks;

    const updateRes = await db.query(`
      UPDATE call_records
      SET call_status = $1,
          call_purpose = $2,
          callback_date = $3,
          callback_time = $4,
          remarks = $5
      WHERE call_id = $6
      RETURNING *
    `, [normStatus, newPurpose, newCbDate, newCbTime, newRemarks, callId]);

    const updatedCall = updateRes.rows[0];

    // Synchronize linked lead if exists
    if (currentCall.lead_id) {
      let leadStatus = 'new';
      if (normStatus === 'interested' || normStatus === 'lead_created') {
        leadStatus = 'interested';
      } else if (normStatus === 'not_interested') {
        leadStatus = 'not_interested';
      } else if (normStatus === 'callback_requested') {
        leadStatus = 'new';
      }

      await db.query(`
        UPDATE leads
        SET status = $1,
            updated_at = now()
        WHERE lead_id = $2
      `, [leadStatus, currentCall.lead_id]);
    }

    res.locals.auditEntry = { module: 'Executive / Call Center', action: 'Update Call Record', recordId: callId, newValue: updatedCall };
    return res.json(formatResponse(true, updatedCall, 'Call record updated successfully'));
  } catch (err) {
    console.error('updateCallRecord error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getDashboard,
  searchPatientInbound,
  createLead,
  updateLead,
  updateOutboundLead,
  importOutboundLeads,
  getOutboundQueue,
  recordCallOutcome,
  updateCallRecord,
  getCallbacks,
  getLeads,
  getLeadDetails,
  getCallHistory,
  getIncentives,
  getExecutivePerformanceReport
};
