const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function searchPatientInbound(req, res) {
  try {
    const { mobile_number } = req.body;
    if (!mobile_number) {
      return res.status(400).json(formatResponse(false, null, 'Mobile number is required'));
    }

    const patientRes = await db.query(
      `SELECT * FROM patients WHERE mobile_number = $1`,
      [mobile_number]
    );

    if (patientRes.rows.length > 0) {
      return res.json(formatResponse(true, {
        is_existing: true,
        patient_type: 'existing',
        patient: patientRes.rows[0]
      }, 'Existing patient record found'));
    } else {
      return res.json(formatResponse(true, {
        is_existing: false,
        patient_type: 'new',
        patient: null
      }, 'No existing patient found. Proceed to Lead creation.'));
    }
  } catch (err) {
    console.error('searchPatientInbound error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createLead(req, res) {
  try {
    const {
      lead_name, mobile_number, age, gender, village, mandal,
      source, campaign, lead_source, executive_id, assigned_receptionist_id
    } = req.body;

    if (!lead_name || !mobile_number || !lead_source) {
      return res.status(400).json(formatResponse(false, null, 'lead_name, mobile_number, and lead_source are required'));
    }

    const branchId = req.user.branch_id || 1;

    // Automatic check: does patient exist in patients table?
    const existingPatientRes = await db.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [mobile_number]);
    const patientId = existingPatientRes.rows.length > 0 ? existingPatientRes.rows[0].patient_id : null;

    // Find executive record if user is an executive
    let execId = executive_id || null;
    if (!execId && req.user.role === 'executive') {
      const execRes = await db.query(`SELECT executive_id FROM executives WHERE user_id = $1`, [req.user.user_id]);
      if (execRes.rows.length > 0) execId = execRes.rows[0].executive_id;
    }

    const result = await db.query(`
      INSERT INTO leads (
        patient_id, lead_name, mobile_number, age, gender, village, mandal,
        source, campaign, lead_created_by_user_id, executive_id, lead_source,
        status, assigned_receptionist_id, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', $13, $14)
      RETURNING *
    `, [
      patientId, lead_name, mobile_number, age || null, gender || null, village || null, mandal || null,
      source || 'Call Center', campaign || null, req.user.user_id, execId, lead_source,
      assigned_receptionist_id || null, branchId
    ]);

    const newLead = result.rows[0];

    // If executive generated lead, update executive_performance count
    if (execId) {
      const now = new Date();
      const curMonth = now.getMonth() + 1;
      const curYear = now.getFullYear();

      const execRes = await db.query(`SELECT per_lead_incentive FROM executives WHERE executive_id = $1`, [execId]);
      const perLeadIncentive = execRes.rows.length > 0 ? parseFloat(execRes.rows[0].per_lead_incentive) : 100;

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

    res.locals.auditEntry = { module: 'Call Center', action: 'Create Lead', recordId: newLead.lead_id, newValue: newLead };
    return res.status(201).json(formatResponse(true, newLead, 'Lead created and placed in Receptionist queue successfully'));
  } catch (err) {
    console.error('createLead error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

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

    // Create batch entry
    const batchRes = await client.query(`
      INSERT INTO outbound_import_batches (imported_by, file_name, total_records)
      VALUES ($1, $2, $3) RETURNING batch_id
    `, [req.user.user_id, file_name || 'outbound_import.xlsx', records.length]);

    const batchId = batchRes.rows[0].batch_id;
    let validCount = 0;
    let duplicateCount = 0;
    const insertedLeads = [];

    for (const rec of records) {
      const mobile = rec.mobile_number || rec.mobile;
      if (!mobile) continue;

      // Duplicate check in patients / leads / outbound_leads
      const dupCheck = await client.query(`
        SELECT mobile_number FROM patients WHERE mobile_number = $1
        UNION
        SELECT mobile_number FROM outbound_leads WHERE mobile_number = $1
      `, [mobile]);

      if (dupCheck.rows.length > 0) {
        duplicateCount++;
        continue;
      }

      const insertRes = await client.query(`
        INSERT INTO outbound_leads (
          batch_id, patient_name, mobile_number, age, gender, village, mandal,
          source, campaign, assigned_executive_id, status, remarks, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', $11, $12)
        RETURNING *
      `, [
        batchId, rec.patient_name || rec.name || 'Unknown', mobile, rec.age || null,
        rec.gender || null, rec.village || null, rec.mandal || null, rec.source || 'Outbound Excel',
        rec.campaign || 'Outbound Campaign', rec.assigned_executive_id || null, rec.remarks || null, branchId
      ]);

      validCount++;
      insertedLeads.push(insertRes.rows[0]);
    }

    // Update batch summary
    await client.query(`
      UPDATE outbound_import_batches
      SET valid_records = $1, duplicate_records = $2
      WHERE batch_id = $3
    `, [validCount, duplicateCount, batchId]);

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Call Center',
      action: 'Import Outbound Leads',
      recordId: batchId,
      remarks: `Imported ${validCount} valid leads, skipped ${duplicateCount} duplicates`
    };

    return res.status(201).json(formatResponse(true, {
      batch_id: batchId,
      total_records: records.length,
      valid_records: validCount,
      duplicate_records: duplicateCount,
      imported_leads: insertedLeads
    }, 'Outbound leads imported successfully with duplicate validation'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('importOutboundLeads error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getExecutiveIncentives(req, res) {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const curMonth = month ? parseInt(month) : now.getMonth() + 1;
    const curYear = year ? parseInt(year) : now.getFullYear();
    const branchId = req.user.branch_id || 1;

    const query = `
      SELECT e.executive_id, u.full_name as executive_name, u.employee_id,
             e.per_lead_incentive, e.incentive_trigger,
             COALESCE(ep.leads_generated, COUNT(l.lead_id)) as leads_generated,
             (COALESCE(ep.leads_generated, COUNT(l.lead_id)) * e.per_lead_incentive) as incentive_earned
      FROM executives e
      JOIN users u ON e.user_id = u.user_id
      LEFT JOIN leads l ON e.executive_id = l.executive_id AND EXTRACT(MONTH FROM l.created_at) = $2 AND EXTRACT(YEAR FROM l.created_at) = $3
      LEFT JOIN executive_performance ep ON e.executive_id = ep.executive_id AND ep.month = $2 AND ep.year = $3
      WHERE e.branch_id = $1
      GROUP BY e.executive_id, u.full_name, u.employee_id, e.per_lead_incentive, e.incentive_trigger, ep.leads_generated
    `;

    const result = await db.query(query, [branchId, curMonth, curYear]);
    const report = result.rows.map(r => ({
      executive_id: r.executive_id,
      executive_name: r.executive_name,
      employee_id: r.employee_id,
      per_lead_incentive: parseFloat(r.per_lead_incentive),
      incentive_trigger: r.incentive_trigger,
      leads_generated: parseInt(r.leads_generated),
      incentive_earned: parseFloat(r.incentive_earned)
    }));

    return res.json(formatResponse(true, report, 'Executive incentives report retrieved successfully'));
  } catch (err) {
    console.error('getExecutiveIncentives error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  searchPatientInbound,
  createLead,
  importOutboundLeads,
  getExecutiveIncentives
};
