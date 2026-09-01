const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getConsultationFees(req, res) {
  try {
    const { doctor_id } = req.query;
    let query = `
      SELECT cf.*, d.doctor_code, u.full_name as doctor_name
      FROM consultation_fees cf
      JOIN doctors d ON cf.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE cf.branch_id = $1
    `;
    const params = [req.user.branch_id || 1];

    if (doctor_id) {
      params.push(doctor_id);
      query += ` AND cf.doctor_id = $${params.length}`;
    }

    query += ` ORDER BY cf.id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Consultation fees retrieved successfully'));
  } catch (err) {
    console.error('getConsultationFees error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function setConsultationFee(req, res) {
  try {
    const { doctor_id, appointment_type, fee_amount, effective_date, status } = req.body;

    if (!doctor_id || !appointment_type || fee_amount === undefined) {
      return res.status(400).json(formatResponse(false, null, 'doctor_id, appointment_type, and fee_amount are required'));
    }

    const branchId = req.user.branch_id || 1;

    const result = await db.query(`
      INSERT INTO consultation_fees (doctor_id, branch_id, appointment_type, fee_amount, effective_date, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      doctor_id, branchId, appointment_type, fee_amount,
      effective_date || new Date(), status || 'active'
    ]);

    // Update fee on doctor master table
    if (appointment_type === 'new') {
      await db.query(`UPDATE doctors SET new_consultation_fee = $1 WHERE doctor_id = $2`, [fee_amount, doctor_id]);
    } else if (appointment_type === 'renewal') {
      await db.query(`UPDATE doctors SET renewal_consultation_fee = $1 WHERE doctor_id = $2`, [fee_amount, doctor_id]);
    } else if (appointment_type === 'followup') {
      await db.query(`UPDATE doctors SET followup_consultation_fee = $1 WHERE doctor_id = $2`, [fee_amount, doctor_id]);
    }

    res.locals.auditEntry = { module: 'Billing Configuration', action: 'Set Consultation Fee', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Consultation fee configured successfully'));
  } catch (err) {
    console.error('setConsultationFee error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getBillingRules(req, res) {
  try {
    const rulesRes = await db.query(`SELECT * FROM billing_configuration`);
    const discountRulesRes = await db.query(`SELECT * FROM master_discount_rules`);
    const paymentMethodsRes = await db.query(`SELECT * FROM payment_methods_config`);

    return res.json(formatResponse(true, {
      billing_config: rulesRes.rows,
      discount_rules: discountRulesRes.rows,
      payment_methods: paymentMethodsRes.rows
    }, 'Billing rules retrieved successfully'));
  } catch (err) {
    console.error('getBillingRules error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createBill(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { patient_id, doctor_id, bill_type, items, amount, discount_amount, discount_approved_by } = req.body;

    if (!patient_id || !bill_type || amount === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_id, bill_type, and amount are required'));
    }

    const userRole = req.user.role;

    // Role-based billing restriction: Receptionist can ONLY create consultation fee bills
    if (userRole === 'receptionist' && bill_type !== 'consultation') {
      await client.query('ROLLBACK');
      return res.status(403).json(formatResponse(false, null, 'Receptionists are restricted to consultation fee billing only. Treatment and other billing must be handled by PRO/Manager.'));
    }

    // Validate discount limit
    const discount = parseFloat(discount_amount || 0);
    const totalAmount = parseFloat(amount);
    if (discount > 0) {
      const maxDiscountPct = 20.00; // default 20% limit
      const maxDiscountAmt = (totalAmount * maxDiscountPct) / 100;
      if (discount > maxDiscountAmt && userRole !== 'super_admin' && !discount_approved_by) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, `Discount amount (${discount}) exceeds maximum permitted discount of ${maxDiscountPct}% (${maxDiscountAmt}) without explicit approval.`));
      }
    }

    const finalAmount = totalAmount - discount;
    const branchId = req.user.branch_id || 1;
    const billNumber = `BILL-${Date.now()}`;

    const billRes = await client.query(`
      INSERT INTO bills (
        bill_number, patient_id, doctor_id, bill_type, created_by, amount,
        discount_amount, discount_approved_by, final_amount, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'created', $10)
      RETURNING *
    `, [
      billNumber, patient_id, doctor_id || null, bill_type, req.user.user_id,
      totalAmount, discount, discount_approved_by || null, finalAmount, branchId
    ]);

    const newBill = billRes.rows[0];

    // Insert bill items
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await client.query(`
          INSERT INTO bill_items (bill_id, charge_type, description, amount)
          VALUES ($1, $2, $3, $4)
        `, [newBill.bill_id, item.charge_type || 'General Charge', item.description || '', item.amount || 0]);
      }
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Billing & Finance', action: 'Create Bill', recordId: newBill.bill_id, newValue: newBill };
    return res.status(201).json(formatResponse(true, newBill, 'Bill created successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createBill error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function recordPayment(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { bill_id, payment_method, amount } = req.body;

    if (!bill_id || !payment_method || amount === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'bill_id, payment_method, and amount are required'));
    }

    const validMethods = ['cash', 'card', 'upi', 'razorpay', 'bajaj_pay'];
    if (!validMethods.includes(payment_method)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Invalid payment method. Allowed methods: ${validMethods.join(', ')}`));
    }

    // Check payment method active status
    const methodCheck = await client.query(`SELECT is_active FROM payment_methods_config WHERE method_name = $1`, [payment_method]);
    if (methodCheck.rows.length > 0 && !methodCheck.rows[0].is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Payment method '${payment_method}' is currently deactivated by Super Admin.`));
    }

    const billRes = await client.query(`SELECT * FROM bills WHERE bill_id = $1`, [bill_id]);
    if (billRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Bill not found'));
    }

    const bill = billRes.rows[0];
    const payAmt = parseFloat(amount);
    const branchId = req.user.branch_id || 1;

    const paymentRes = await client.query(`
      INSERT INTO payments (bill_id, patient_id, payment_method, amount, received_by, status, branch_id)
      VALUES ($1, $2, $3, $4, $5, 'success', $6)
      RETURNING *
    `, [bill_id, bill.patient_id, payment_method, payAmt, req.user.user_id, branchId]);

    const payment = paymentRes.rows[0];

    // If payment method is CASH, update cash_ledger for today!
    if (payment_method === 'cash') {
      const today = new Date().toISOString().split('T')[0];
      await client.query(`
        INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
        VALUES ($1, $2, 0, $3, 0, 0, $3)
        ON CONFLICT (branch_id, ledger_date)
        DO UPDATE SET
          cash_revenue = cash_ledger.cash_revenue + $3,
          closing_balance = cash_ledger.opening_balance + (cash_ledger.cash_revenue + $3) - cash_ledger.cash_expenditure - cash_ledger.deposited_amount
      `, [branchId, today, payAmt]);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Billing & Finance', action: 'Record Payment', recordId: payment.payment_id, newValue: payment };
    return res.status(201).json(formatResponse(true, payment, 'Payment recorded successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('recordPayment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getRevenueReport(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const branchId = req.user.branch_id || 1;

    let dateFilter = `AND DATE(p.payment_date) = CURRENT_DATE`;
    const params = [branchId];

    if (start_date && end_date) {
      params.push(start_date, end_date);
      dateFilter = `AND DATE(p.payment_date) BETWEEN $2 AND $3`;
    }

    const query = `
      SELECT p.payment_method, COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      WHERE p.branch_id = $1 ${dateFilter} AND p.status = 'success'
      GROUP BY p.payment_method
    `;

    const result = await db.query(query, params);
    const revenueMap = { cash: 0, card: 0, upi: 0, razorpay: 0, bajaj_pay: 0 };
    result.rows.forEach(r => {
      if (revenueMap[r.payment_method] !== undefined) {
        revenueMap[r.payment_method] = parseFloat(r.total);
      }
    });

    const grandTotal = Object.values(revenueMap).reduce((acc, v) => acc + v, 0);

    return res.json(formatResponse(true, {
      breakdown: revenueMap,
      grand_total: grandTotal
    }, 'Revenue report retrieved successfully'));
  } catch (err) {
    console.error('getRevenueReport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getConsultationFees,
  setConsultationFee,
  getBillingRules,
  createBill,
  recordPayment,
  getRevenueReport
};
