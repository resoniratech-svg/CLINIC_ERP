const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getDashboard(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const today = new Date().toISOString().split('T')[0];

    // Patient & Activity stats today
    const newPatientsRes = await db.query(
      `SELECT COUNT(*) FROM patients WHERE branch_id = $1 AND DATE(created_at) = $2 AND patient_type = 'new'`,
      [branchId, today]
    );

    const enquiriesRes = await db.query(
      `SELECT COUNT(*) FROM leads WHERE branch_id = $1 AND DATE(created_at) = $2`,
      [branchId, today]
    );

    const appointmentsRes = await db.query(
      `SELECT COUNT(*) FROM appointments WHERE branch_id = $1 AND appointment_date = $2`,
      [branchId, today]
    );

    const walkinsRes = await db.query(
      `SELECT COUNT(*) FROM appointments WHERE branch_id = $1 AND appointment_date = $2 AND appointment_type = 'new'`,
      [branchId, today]
    );

    const conversionsRes = await db.query(
      `SELECT COUNT(*) FROM leads WHERE branch_id = $1 AND status = 'converted' AND DATE(updated_at) = $2`,
      [branchId, today]
    );

    const followupsRes = await db.query(
      `SELECT COUNT(*) FROM crm_followups WHERE branch_id = $1 AND due_date = $2`,
      [branchId, today]
    );

    const renewalsRes = await db.query(
      `SELECT COUNT(*) FROM renewals WHERE renewal_date = $1`,
      [today]
    );

    const acqRes = await db.query(
      `SELECT COUNT(*) FROM acq_patients WHERE status = 'active'`
    );

    const duesCountRes = await db.query(
      `SELECT COUNT(*) FROM due_patients WHERE branch_id = $1 AND status = 'pending'`,
      [branchId]
    );

    const duesAmountRes = await db.query(
      `SELECT COALESCE(SUM(due_amount), 0) as total_due FROM due_patients WHERE branch_id = $1 AND status = 'pending'`,
      [branchId]
    );

    // Revenue breakdown today
    const revenueRes = await db.query(`
      SELECT payment_method, COALESCE(SUM(amount), 0) as total
      SELECT payment_method, COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE branch_id = $1 AND DATE(payment_date) = $2 AND status = 'success'
      GROUP BY payment_method
    `.replace('SELECT payment_method, COALESCE(SUM(amount), 0) as total\n', ''), [branchId, today]);

    const revenueMap = { cash: 0, card: 0, upi: 0, razorpay: 0, bajaj_pay: 0 };
    revenueRes.rows.forEach(r => {
      if (revenueMap[r.payment_method] !== undefined) {
        revenueMap[r.payment_method] = parseFloat(r.total);
      }
    });

    const grandTotal = Object.values(revenueMap).reduce((acc, v) => acc + v, 0);

    // Cash Ledger today
    const cashLedgerRes = await db.query(
      `SELECT * FROM cash_ledger WHERE branch_id = $1 AND ledger_date = $2`,
      [branchId, today]
    );
    const cashLedger = cashLedgerRes.rows[0] || {
      opening_balance: 0,
      cash_revenue: revenueMap.cash,
      cash_expenditure: 0,
      deposited_amount: 0,
      closing_balance: revenueMap.cash
    };

    // Current month target
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    const targetRes = await db.query(
      `SELECT * FROM targets WHERE branch_id = $1 AND month = $2 AND year = $3`,
      [branchId, curMonth, curYear]
    );

    // Achieved calculation for month
    const monthRevenueRes = await db.query(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      WHERE p.branch_id = $1 AND EXTRACT(MONTH FROM p.payment_date) = $2 AND EXTRACT(YEAR FROM p.payment_date) = $3 AND p.status = 'success'
    `, [branchId, curMonth, curYear]);
    const totalAchieved = parseFloat(monthRevenueRes.rows[0].total);

    const monthEnquiryRevRes = await db.query(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN bills b ON p.bill_id = b.bill_id
      JOIN patients pt ON b.patient_id = pt.patient_id
      WHERE p.branch_id = $1 AND EXTRACT(MONTH FROM p.payment_date) = $2 AND EXTRACT(YEAR FROM p.payment_date) = $3 AND pt.patient_type = 'new' AND p.status = 'success'
    `, [branchId, curMonth, curYear]);
    const enquiryAchieved = parseFloat(monthEnquiryRevRes.rows[0].total);
    const unitAchieved = Math.max(0, totalAchieved - enquiryAchieved);

    const targetData = targetRes.rows[0] || {
      overall_target: 0,
      enquiry_target: 0,
      unit_target: 0
    };

    const overallTarget = parseFloat(targetData.overall_target);
    const enquiryTarget = parseFloat(targetData.enquiry_target);
    const unitTarget = parseFloat(targetData.unit_target);

    // Alerts
    const alerts = [];
    
    // Password reset pending
    const resetReqRes = await db.query(`SELECT COUNT(*) FROM password_reset_requests WHERE status = 'pending'`);
    if (parseInt(resetReqRes.rows[0].count) > 0) {
      alerts.push({ type: 'password_reset', message: `${resetReqRes.rows[0].count} password reset request(s) pending approval` });
    }

    // Low stock alerts
    const lowStockRes = await db.query(`
      SELECT COUNT(*) FROM medicine_stock ms
      JOIN medicine_master mm ON ms.medicine_id = mm.id
      WHERE ms.branch_id = $1 AND ms.quantity <= mm.reorder_level
    `, [branchId]);
    if (parseInt(lowStockRes.rows[0].count) > 0) {
      alerts.push({ type: 'low_stock', message: `${lowStockRes.rows[0].count} medicine item(s) below reorder level` });
    }

    // Expiring medicines (within 30 days)
    const expiringRes = await db.query(`
      SELECT COUNT(*) FROM medicine_stock
      WHERE branch_id = $1 AND expiry_date <= (CURRENT_DATE + INTERVAL '30 days') AND quantity > 0
    `, [branchId]);
    if (parseInt(expiringRes.rows[0].count) > 0) {
      alerts.push({ type: 'expiring_medicine', message: `${expiringRes.rows[0].count} medicine batch(es) expiring within 30 days` });
    }

    // Target status alert
    if (overallTarget > 0 && totalAchieved < (overallTarget * 0.5)) {
      alerts.push({ type: 'target_behind', message: `Monthly revenue achievement (${Math.round((totalAchieved / overallTarget) * 100)}%) is currently below target.` });
    }

    return res.json(formatResponse(true, {
      today_overview: {
        new_patients: parseInt(newPatientsRes.rows[0].count),
        new_enquiries: parseInt(enquiriesRes.rows[0].count),
        appointments: parseInt(appointmentsRes.rows[0].count),
        walk_ins: parseInt(walkinsRes.rows[0].count),
        conversions: parseInt(conversionsRes.rows[0].count),
        followups_due: parseInt(followupsRes.rows[0].count),
        renewals: parseInt(renewalsRes.rows[0].count),
        acq_patients: parseInt(acqRes.rows[0].count),
        due_patients_count: parseInt(duesCountRes.rows[0].count),
        due_patients_amount: parseFloat(duesAmountRes.rows[0].total_due)
      },
      revenue_today: {
        cash: revenueMap.cash,
        card: revenueMap.card,
        upi: revenueMap.upi,
        razorpay: revenueMap.razorpay,
        bajaj_pay: revenueMap.bajaj_pay,
        grand_total: grandTotal
      },
      cash_position: {
        opening_balance: parseFloat(cashLedger.opening_balance),
        cash_revenue: parseFloat(cashLedger.cash_revenue),
        cash_expenditure: parseFloat(cashLedger.cash_expenditure),
        available_cash: parseFloat(cashLedger.opening_balance) + parseFloat(cashLedger.cash_revenue) - parseFloat(cashLedger.cash_expenditure),
        deposited_amount: parseFloat(cashLedger.deposited_amount),
        closing_balance: parseFloat(cashLedger.closing_balance)
      },
      monthly_target: {
        month: curMonth,
        year: curYear,
        overall_target: overallTarget,
        overall_achieved: totalAchieved,
        overall_remaining: Math.max(0, overallTarget - totalAchieved),
        overall_achievement_pct: overallTarget > 0 ? parseFloat(((totalAchieved / overallTarget) * 100).toFixed(2)) : 0,
        enquiry_target: enquiryTarget,
        enquiry_achieved: enquiryAchieved,
        unit_target: unitTarget,
        unit_achieved: unitAchieved
      },
      alerts
    }, 'Dashboard stats retrieved successfully'));

  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = { getDashboard };
