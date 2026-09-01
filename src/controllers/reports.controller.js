const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getPatientReport(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const newPatientsRes = await db.query(`SELECT COUNT(*) FROM patients WHERE branch_id = $1 AND patient_type = 'new'`, [branchId]);
    const existingPatientsRes = await db.query(`SELECT COUNT(*) FROM patients WHERE branch_id = $1 AND patient_type = 'existing'`, [branchId]);
    const appointmentsRes = await db.query(`SELECT COUNT(*) FROM appointments WHERE branch_id = $1`, [branchId]);
    const renewalsRes = await db.query(`SELECT COUNT(*) FROM renewals`);
    const referralsRes = await db.query(`SELECT COUNT(*) FROM referrals`);
    const duesRes = await db.query(`SELECT COUNT(*), COALESCE(SUM(due_amount), 0) as total FROM due_patients WHERE branch_id = $1 AND status = 'pending'`, [branchId]);

    return res.json(formatResponse(true, {
      new_patients: parseInt(newPatientsRes.rows[0].count),
      existing_patients: parseInt(existingPatientsRes.rows[0].count),
      total_appointments: parseInt(appointmentsRes.rows[0].count),
      total_renewals: parseInt(renewalsRes.rows[0].count),
      total_referrals: parseInt(referralsRes.rows[0].count),
      pending_due_patients: parseInt(duesRes.rows[0].count),
      pending_due_amount: parseFloat(duesRes.rows[0].total)
    }, 'Patient report retrieved successfully'));
  } catch (err) {
    console.error('getPatientReport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getRevenueReport(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const revRes = await db.query(`
      SELECT payment_method, COALESCE(SUM(amount), 0) as total
      FROM payments WHERE branch_id = $1 AND status = 'success'
      GROUP BY payment_method
    `, [branchId]);

    const breakdown = { cash: 0, card: 0, upi: 0, razorpay: 0, bajaj_pay: 0 };
    revRes.rows.forEach(r => {
      if (breakdown[r.payment_method] !== undefined) {
        breakdown[r.payment_method] = parseFloat(r.total);
      }
    });

    const grandTotal = Object.values(breakdown).reduce((acc, v) => acc + v, 0);

    const dueRes = await db.query(`SELECT COALESCE(SUM(due_amount), 0) as total FROM due_patients WHERE branch_id = $1 AND status = 'pending'`, [branchId]);
    const outstandingDue = parseFloat(dueRes.rows[0].total);

    return res.json(formatResponse(true, {
      payment_method_breakdown: breakdown,
      grand_total: grandTotal,
      outstanding_due: outstandingDue
    }, 'Revenue report retrieved successfully'));
  } catch (err) {
    console.error('getRevenueReport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getTargetReport(req, res) {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const curMonth = month ? parseInt(month) : now.getMonth() + 1;
    const curYear = year ? parseInt(year) : now.getFullYear();
    const branchId = req.user.branch_id || 1;

    const targetRes = await db.query(`SELECT * FROM targets WHERE branch_id = $1 AND month = $2 AND year = $3`, [branchId, curMonth, curYear]);
    const target = targetRes.rows[0] || { overall_target: 0, enquiry_target: 0, unit_target: 0 };

    const revRes = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments
      WHERE branch_id = $1 AND EXTRACT(MONTH FROM payment_date) = $2 AND EXTRACT(YEAR FROM payment_date) = $3 AND status = 'success'
    `, [branchId, curMonth, curYear]);
    const achieved = parseFloat(revRes.rows[0].total);

    const overall = parseFloat(target.overall_target);

    return res.json(formatResponse(true, {
      month: curMonth,
      year: curYear,
      overall_target: overall,
      enquiry_target: parseFloat(target.enquiry_target),
      unit_target: parseFloat(target.unit_target),
      overall_achieved: achieved,
      remaining: Math.max(0, overall - achieved),
      achievement_pct: overall > 0 ? parseFloat(((achieved / overall) * 100).toFixed(2)) : 0
    }, 'Target report retrieved successfully'));
  } catch (err) {
    console.error('getTargetReport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getExecutiveReport(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const totalLeadsRes = await db.query(`SELECT COUNT(*) FROM leads WHERE branch_id = $1`, [branchId]);
    const inboundRes = await db.query(`SELECT COUNT(*) FROM leads WHERE branch_id = $1 AND lead_source = 'inbound'`, [branchId]);
    const outboundRes = await db.query(`SELECT COUNT(*) FROM leads WHERE branch_id = $1 AND lead_source = 'outbound'`, [branchId]);
    const convertedRes = await db.query(`SELECT COUNT(*) FROM leads WHERE branch_id = $1 AND status = 'converted'`, [branchId]);

    const execPerformanceRes = await db.query(`
      SELECT e.executive_id, u.full_name as executive_name, e.per_lead_incentive,
             COALESCE(COUNT(l.lead_id), 0) as leads_count,
             (COALESCE(COUNT(l.lead_id), 0) * e.per_lead_incentive) as incentive
      FROM executives e
      JOIN users u ON e.user_id = u.user_id
      LEFT JOIN leads l ON e.executive_id = l.executive_id
      WHERE e.branch_id = $1
      GROUP BY e.executive_id, u.full_name, e.per_lead_incentive
    `, [branchId]);

    return res.json(formatResponse(true, {
      total_leads: parseInt(totalLeadsRes.rows[0].count),
      inbound_leads: parseInt(inboundRes.rows[0].count),
      outbound_leads: parseInt(outboundRes.rows[0].count),
      converted_leads: parseInt(convertedRes.rows[0].count),
      executive_performance: execPerformanceRes.rows
    }, 'Executive report retrieved successfully'));
  } catch (err) {
    console.error('getExecutiveReport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getPharmacyReport(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const totalMedicinesRes = await db.query(`SELECT COUNT(*) FROM medicine_master`);
    const totalStockRes = await db.query(`SELECT COALESCE(SUM(quantity), 0) as total FROM medicine_stock WHERE branch_id = $1`, [branchId]);

    const lowStockRes = await db.query(`
      SELECT COUNT(*) FROM medicine_stock ms
      JOIN medicine_master mm ON ms.medicine_id = mm.id
      WHERE ms.branch_id = $1 AND ms.quantity <= mm.reorder_level
    `, [branchId]);

    const expiringRes = await db.query(`
      SELECT COUNT(*) FROM medicine_stock
      WHERE branch_id = $1 AND expiry_date <= (CURRENT_DATE + INTERVAL '30 days') AND quantity > 0
    `, [branchId]);

    const outOfStockRes = await db.query(`
      SELECT COUNT(*) FROM medicine_stock WHERE branch_id = $1 AND quantity = 0
    `, [branchId]);

    return res.json(formatResponse(true, {
      total_medicine_masters: parseInt(totalMedicinesRes.rows[0].count),
      total_stock_quantity: parseInt(totalStockRes.rows[0].total),
      low_stock_items_count: parseInt(lowStockRes.rows[0].count),
      expiring_batches_count: parseInt(expiringRes.rows[0].count),
      out_of_stock_count: parseInt(outOfStockRes.rows[0].count)
    }, 'Pharmacy report retrieved successfully'));
  } catch (err) {
    console.error('getPharmacyReport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getCrmReport(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const followupsRes = await db.query(`SELECT status, COUNT(*) FROM crm_followups WHERE branch_id = $1 GROUP BY status`, [branchId]);
    const acqRes = await db.query(`SELECT COUNT(*) FROM acq_patients WHERE status = 'active'`);
    const ocnrRes = await db.query(`SELECT classification, COUNT(*) FROM oc_nr_patients GROUP BY classification`);

    return res.json(formatResponse(true, {
      followups_by_status: followupsRes.rows,
      active_acq_patients: parseInt(acqRes.rows[0].count),
      oc_nr_classification: ocnrRes.rows
    }, 'CRM report retrieved successfully'));
  } catch (err) {
    console.error('getCrmReport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getPatientReport,
  getRevenueReport,
  getTargetReport,
  getExecutiveReport,
  getPharmacyReport,
  getCrmReport
};
