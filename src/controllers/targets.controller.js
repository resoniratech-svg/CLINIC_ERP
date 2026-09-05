const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getTargets(req, res) {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const branchId = req.user.branch_id || 1;

    const targetRes = await db.query(
      `SELECT * FROM targets WHERE branch_id = $1 AND month = $2 AND year = $3`,
      [branchId, targetMonth, targetYear]
    );

    const target = targetRes.rows[0] || {
      month: targetMonth,
      year: targetYear,
      overall_target: 0,
      enquiry_target: 0,
      unit_target: 0,
      allow_unallocated: false
    };

    // Calculate achieved
    const monthRevRes = await db.query(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      WHERE p.branch_id = $1 AND EXTRACT(MONTH FROM p.payment_date) = $2 AND EXTRACT(YEAR FROM p.payment_date) = $3 AND p.status = 'success'
    `, [branchId, targetMonth, targetYear]);
    const overallAchieved = parseFloat(monthRevRes.rows[0].total);

    const enquiryRevRes = await db.query(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN bills b ON p.bill_id = b.bill_id
      JOIN patients pt ON b.patient_id = pt.patient_id
      WHERE p.branch_id = $1 AND EXTRACT(MONTH FROM p.payment_date) = $2 AND EXTRACT(YEAR FROM p.payment_date) = $3 AND pt.patient_type = 'new' AND p.status = 'success'
    `, [branchId, targetMonth, targetYear]);
    const enquiryAchieved = parseFloat(enquiryRevRes.rows[0].total);
    const unitAchieved = Math.max(0, overallAchieved - enquiryAchieved);

    const overallTarget = parseFloat(target.overall_target);
    const enquiryTarget = parseFloat(target.enquiry_target);
    const unitTarget = parseFloat(target.unit_target);

    return res.json(formatResponse(true, {
      month: targetMonth,
      year: targetYear,
      overall: {
        target: overallTarget,
        achieved: overallAchieved,
        remaining: Math.max(0, overallTarget - overallAchieved),
        achievement_pct: overallTarget > 0 ? parseFloat(((overallAchieved / overallTarget) * 100).toFixed(2)) : 0
      },
      enquiry: {
        target: enquiryTarget,
        achieved: enquiryAchieved,
        remaining: Math.max(0, enquiryTarget - enquiryAchieved),
        achievement_pct: enquiryTarget > 0 ? parseFloat(((enquiryAchieved / enquiryTarget) * 100).toFixed(2)) : 0
      },
      unit: {
        target: unitTarget,
        achieved: unitAchieved,
        remaining: Math.max(0, unitTarget - unitAchieved),
        achievement_pct: unitTarget > 0 ? parseFloat(((unitAchieved / unitTarget) * 100).toFixed(2)) : 0
      }
    }, 'Targets retrieved successfully'));
  } catch (err) {
    console.error('getTargets error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function setTarget(req, res) {
  try {
    const { month, year, overall_target, enquiry_target, unit_target, allow_unallocated } = req.body;

    if (!month || !year || overall_target === undefined || enquiry_target === undefined || unit_target === undefined) {
      return res.status(400).json(formatResponse(false, null, 'Month, year, overall_target, enquiry_target, and unit_target are required'));
    }

    const overall = parseFloat(overall_target);
    const enquiry = parseFloat(enquiry_target);
    const unit = parseFloat(unit_target);
    const allowUnallocated = !!allow_unallocated;

    // Validation: Enquiry Target + Unit Target = Overall Target
    if (!allowUnallocated && (enquiry + unit !== overall)) {
      return res.status(400).json(formatResponse(
        false,
        null,
        `Target validation failed: Enquiry Target (${enquiry}) + Unit Target (${unit}) = ${enquiry + unit}, which does not match Overall Target (${overall}). Set allow_unallocated = true to allow mismatch.`
      ));
    }

    const branchId = req.user.branch_id || 1;

    const result = await db.query(`
      INSERT INTO targets (month, year, overall_target, enquiry_target, unit_target, allow_unallocated, branch_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (month, year, branch_id)
      DO UPDATE SET overall_target = $3, enquiry_target = $4, unit_target = $5, allow_unallocated = $6, updated_at = now()
      RETURNING *
    `, [month, year, overall, enquiry, unit, allowUnallocated, branchId, req.user.user_id]);

    res.locals.auditEntry = { module: 'Target Management', action: 'Set Monthly Target', recordId: result.rows[0].target_id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Monthly target set successfully'));
  } catch (err) {
    console.error('setTarget error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function setDoctorTarget(req, res) {
  try {
    const { doctor_id, month, year, enquiry_target, unit_target, referral_target, revenue_target } = req.body;
    if (!doctor_id || !month || !year) {
      return res.status(400).json(formatResponse(false, null, 'doctor_id, month, and year are required'));
    }

    const docId = parseInt(doctor_id);
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);

    if (isNaN(docId) || isNaN(targetMonth) || isNaN(targetYear)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid doctor_id, month, or year'));
    }

    if (targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json(formatResponse(false, null, 'Month must be between 1 and 12'));
    }

    const docCheck = await db.query(`SELECT doctor_id, user_id, status FROM doctors WHERE doctor_id = $1`, [docId]);
    if (docCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Doctor not found'));
    }

    const numEnquiry = Math.max(0, parseFloat(enquiry_target || 0));
    const numUnit = Math.max(0, parseFloat(unit_target || 0));
    const numReferral = Math.max(0, parseInt(referral_target || 0));
    const numRevenue = parseFloat(revenue_target) > 0 ? parseFloat(revenue_target) : (numEnquiry + numUnit);

    // Fetch existing target for audit diff
    const oldTargetRes = await db.query(
      `SELECT * FROM doctor_targets WHERE doctor_id = $1 AND month = $2 AND year = $3`,
      [docId, targetMonth, targetYear]
    );
    const oldTarget = oldTargetRes.rows[0] || null;

    const result = await db.query(`
      INSERT INTO doctor_targets (doctor_id, month, year, enquiry_target, unit_target, referral_target, revenue_target)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (doctor_id, month, year)
      DO UPDATE SET enquiry_target = $4, unit_target = $5, referral_target = $6, revenue_target = $7, updated_at = now()
      RETURNING *
    `, [
      docId, targetMonth, targetYear,
      numEnquiry, numUnit, numReferral, numRevenue
    ]);

    res.locals.auditEntry = {
      module: 'Target Management',
      action: oldTarget ? 'Update Doctor Target' : 'Set Doctor Target',
      recordId: result.rows[0].id,
      oldValue: oldTarget,
      newValue: result.rows[0]
    };

    return res.status(201).json(formatResponse(true, result.rows[0], 'Doctor target saved successfully'));
  } catch (err) {
    console.error('setDoctorTarget error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getDoctorPerformance(req, res) {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const branchId = req.user.branch_id || 1;

    const query = `
      SELECT d.doctor_id, d.doctor_code, u.employee_id, u.full_name as doctor_name,
             d.qualification, d.specialization, d.status as doctor_status,
             br.branch_name, br.branch_code,
             COALESCE(dt.enquiry_target, 0) as enquiry_target,
             COALESCE(dt.unit_target, 0) as unit_target,
             COALESCE(dt.referral_target, 0) as referral_target,
             COALESCE(dt.revenue_target, 0) as revenue_target,
             COALESCE(SUM(p.amount), 0) as achieved_revenue
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN branches br ON d.branch_id = br.branch_id
      LEFT JOIN doctor_targets dt ON d.doctor_id = dt.doctor_id AND dt.month = $2 AND dt.year = $3
      LEFT JOIN bills b ON d.doctor_id = b.doctor_id
      LEFT JOIN payments p ON b.bill_id = p.bill_id AND p.status = 'success' AND EXTRACT(MONTH FROM p.payment_date) = $2 AND EXTRACT(YEAR FROM p.payment_date) = $3
      WHERE d.branch_id = $1
      GROUP BY d.doctor_id, d.doctor_code, u.employee_id, u.full_name, d.qualification, d.specialization, d.status, br.branch_name, br.branch_code, dt.enquiry_target, dt.unit_target, dt.referral_target, dt.revenue_target
      ORDER BY d.doctor_id ASC
    `;

    const result = await db.query(query, [branchId, targetMonth, targetYear]);
    const performanceList = result.rows.map(r => {
      const target = parseFloat(r.revenue_target) || (parseFloat(r.enquiry_target) + parseFloat(r.unit_target));
      const achieved = parseFloat(r.achieved_revenue);
      return {
        doctor_id: r.doctor_id,
        doctor_code: r.doctor_code || `DOC-${r.employee_id || r.doctor_id}`,
        employee_id: r.employee_id,
        doctor_name: r.doctor_name,
        qualification: r.qualification || 'Homeopathy Specialist',
        specialization: r.specialization,
        doctor_status: r.doctor_status,
        branch_name: r.branch_name || 'Karimnagar Main Branch',
        branch_code: r.branch_code || 'KRM001',
        month: targetMonth,
        year: targetYear,
        enquiry_target: parseFloat(r.enquiry_target),
        unit_target: parseFloat(r.unit_target),
        referral_target: parseInt(r.referral_target),
        revenue_target: target,
        achieved_revenue: achieved,
        achievement_pct: target > 0 ? parseFloat(((achieved / target) * 100).toFixed(2)) : 0
      };
    });

    return res.json(formatResponse(true, performanceList, 'Doctor performance report retrieved successfully'));
  } catch (err) {
    console.error('getDoctorPerformance error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getTargets,
  setTarget,
  setDoctorTarget,
  getDoctorPerformance
};
