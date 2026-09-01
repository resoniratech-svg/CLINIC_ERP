const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getCashLedger(req, res) {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const branchId = req.user.branch_id || 1;

    const ledgerRes = await db.query(
      `SELECT * FROM cash_ledger WHERE branch_id = $1 AND ledger_date = $2`,
      [branchId, targetDate]
    );

    if (ledgerRes.rows.length === 0) {
      // Fetch latest prior closing balance as opening balance
      const priorRes = await db.query(`
        SELECT closing_balance FROM cash_ledger WHERE branch_id = $1 AND ledger_date < $2 ORDER BY ledger_date DESC LIMIT 1
      `, [branchId, targetDate]);
      const opening = priorRes.rows.length > 0 ? parseFloat(priorRes.rows[0].closing_balance) : 0;

      // Fetch cash revenue today
      const revRes = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total FROM payments
        WHERE branch_id = $1 AND DATE(payment_date) = $2 AND payment_method = 'cash' AND status = 'success'
      `, [branchId, targetDate]);
      const cashRev = parseFloat(revRes.rows[0].total);

      // Fetch cash expenditures today
      const expRes = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total FROM expenditures
        WHERE branch_id = $1 AND expense_date = $2 AND payment_mode = 'cash'
      `, [branchId, targetDate]);
      const cashExp = parseFloat(expRes.rows[0].total);

      // Fetch cash deposits today
      const depRes = await db.query(`
        SELECT COALESCE(SUM(deposited_amount), 0) as total FROM cash_deposits
        WHERE branch_id = $1 AND deposit_date = $2
      `, [branchId, targetDate]);
      const cashDep = parseFloat(depRes.rows[0].total);

      const closing = opening + cashRev - cashExp - cashDep;

      return res.json(formatResponse(true, {
        branch_id: branchId,
        ledger_date: targetDate,
        opening_balance: opening,
        cash_revenue: cashRev,
        cash_expenditure: cashExp,
        deposited_amount: cashDep,
        available_cash: opening + cashRev - cashExp,
        closing_balance: closing
      }, 'Cash ledger computed successfully'));
    }

    const row = ledgerRes.rows[0];
    const opening = parseFloat(row.opening_balance);
    const cashRev = parseFloat(row.cash_revenue);
    const cashExp = parseFloat(row.cash_expenditure);
    const cashDep = parseFloat(row.deposited_amount);
    const closing = opening + cashRev - cashExp - cashDep;

    return res.json(formatResponse(true, {
      id: row.id,
      branch_id: row.branch_id,
      ledger_date: row.ledger_date,
      opening_balance: opening,
      cash_revenue: cashRev,
      cash_expenditure: cashExp,
      deposited_amount: cashDep,
      available_cash: opening + cashRev - cashExp,
      closing_balance: closing
    }, 'Cash ledger retrieved successfully'));

  } catch (err) {
    console.error('getCashLedger error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createExpenditure(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { expense_date, expense_category, description, amount, approved_by, remarks } = req.body;

    if (!expense_category || amount === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'expense_category and amount are required'));
    }

    const expAmt = parseFloat(amount);
    const expDate = expense_date || new Date().toISOString().split('T')[0];
    const branchId = req.user.branch_id || 1;
    const approvedById = approved_by ? parseInt(approved_by) : null;

    const expRes = await client.query(`
      INSERT INTO expenditures (
        expense_date, branch_id, expense_category, description, amount,
        payment_mode, approved_by, entered_by, remarks
      ) VALUES ($1, $2, $3, $4, $5, 'cash', $6, $7, $8)
      RETURNING *
    `, [expDate, branchId, expense_category, description || '', expAmt, approvedById, req.user.user_id, remarks || null]);

    const newExp = expRes.rows[0];

    // Update cash ledger (using 0 - $3 to avoid unary minus type disambiguation issue in postgres)
    await client.query(`
      INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
      VALUES ($1, $2, 0, 0, $3, 0, 0 - $3::numeric)
      ON CONFLICT (branch_id, ledger_date)
      DO UPDATE SET
        cash_expenditure = cash_ledger.cash_expenditure + $3,
        closing_balance = cash_ledger.opening_balance + cash_ledger.cash_revenue - (cash_ledger.cash_expenditure + $3) - cash_ledger.deposited_amount
    `, [branchId, expDate, expAmt]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Cash Management', action: 'Create Cash Expenditure', recordId: newExp.id, newValue: newExp };
    return res.status(201).json(formatResponse(true, newExp, 'Cash expenditure recorded successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createExpenditure error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function createCashDeposit(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { deposit_date, deposited_amount, deposit_reference } = req.body;

    if (deposited_amount === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'deposited_amount is required'));
    }

    const depAmt = parseFloat(deposited_amount);
    const depDate = deposit_date || new Date().toISOString().split('T')[0];
    const branchId = req.user.branch_id || 1;

    // Fetch current ledger state for calculation
    const ledgerRes = await client.query(
      `SELECT * FROM cash_ledger WHERE branch_id = $1 AND ledger_date = $2`,
      [branchId, depDate]
    );

    let opening = 0;
    let cashRev = 0;
    let cashExp = 0;
    let prevDeposited = 0;

    if (ledgerRes.rows.length > 0) {
      opening = parseFloat(ledgerRes.rows[0].opening_balance);
      cashRev = parseFloat(ledgerRes.rows[0].cash_revenue);
      cashExp = parseFloat(ledgerRes.rows[0].cash_expenditure);
      prevDeposited = parseFloat(ledgerRes.rows[0].deposited_amount);
    } else {
      const priorRes = await client.query(`
        SELECT closing_balance FROM cash_ledger WHERE branch_id = $1 AND ledger_date < $2 ORDER BY ledger_date DESC LIMIT 1
      `, [branchId, depDate]);
      if (priorRes.rows.length > 0) opening = parseFloat(priorRes.rows[0].closing_balance);
    }

    const availableCash = opening + cashRev - cashExp - prevDeposited;
    if (depAmt > availableCash) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Deposited amount (${depAmt}) cannot exceed available cash (${availableCash})`));
    }

    const totalDeposited = prevDeposited + depAmt;
    const closingBalance = opening + cashRev - cashExp - totalDeposited;

    const depositRes = await client.query(`
      INSERT INTO cash_deposits (
        branch_id, deposit_date, opening_balance, cash_revenue, cash_expenditure,
        available_cash, deposited_amount, deposit_reference, deposited_by, closing_balance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      branchId, depDate, opening, cashRev, cashExp, availableCash, depAmt,
      deposit_reference || null, req.user.user_id, closingBalance
    ]);

    const newDeposit = depositRes.rows[0];

    // Update cash ledger
    await client.query(`
      INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (branch_id, ledger_date)
      DO UPDATE SET
        deposited_amount = $6,
        closing_balance = $7
    `, [branchId, depDate, opening, cashRev, cashExp, totalDeposited, closingBalance]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Cash Management', action: 'Create Cash Deposit', recordId: newDeposit.id, newValue: newDeposit };
    return res.status(201).json(formatResponse(true, newDeposit, 'Cash deposit recorded and ledger updated successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createCashDeposit error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

module.exports = {
  getCashLedger,
  createExpenditure,
  createCashDeposit
};
