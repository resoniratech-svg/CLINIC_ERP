const db = require('../db');
const { formatResponse } = require('../utils/helpers');

// Helper to compute cash ledger state for a given branch and date
async function calculateCashState(clientOrDb, branchId, targetDate) {
  // 1. Opening balance: closing balance of latest prior day
  const priorRes = await clientOrDb.query(`
    SELECT closing_balance FROM cash_ledger
    WHERE branch_id = $1 AND ledger_date < $2
    ORDER BY ledger_date DESC LIMIT 1
  `, [branchId, targetDate]);
  const opening = priorRes.rows.length > 0 ? parseFloat(priorRes.rows[0].closing_balance) : 0;

  // 2. Cash revenue today
  const revRes = await clientOrDb.query(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments
    WHERE branch_id = $1 AND DATE(payment_date) = $2 AND payment_method = 'cash' AND status = 'success'
  `, [branchId, targetDate]);
  const cashRev = parseFloat(revRes.rows[0].total);

  // 3. Cash expenditures today
  const expRes = await clientOrDb.query(`
    SELECT COALESCE(SUM(amount), 0) as total FROM expenditures
    WHERE branch_id = $1 AND expense_date = $2 AND payment_mode = 'cash'
  `, [branchId, targetDate]);
  const cashExp = parseFloat(expRes.rows[0].total);

  // 4. Completed cash deposits today
  const depRes = await clientOrDb.query(`
    SELECT COALESCE(SUM(deposited_amount), 0) as total FROM cash_deposits
    WHERE branch_id = $1 AND DATE(deposit_date) = $2
  `, [branchId, targetDate]);
  const cashDep = parseFloat(depRes.rows[0].total);

  const expectedCash = opening + cashRev - cashExp;
  const availableCash = expectedCash - cashDep;
  const closingBalance = expectedCash - cashDep;

  return {
    opening,
    cashRev,
    cashExp,
    cashDep,
    expectedCash,
    availableCash,
    closingBalance
  };
}

// 1. Get Cash Ledger
async function getCashLedger(req, res) {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id)
      ? parseInt(req.query.branch_id)
      : (req.user.branch_id || 1);

    const ledgerRes = await db.query(
      `SELECT * FROM cash_ledger WHERE branch_id = $1 AND ledger_date = $2`,
      [branchId, targetDate]
    );

    const state = await calculateCashState(db, branchId, targetDate);

    if (ledgerRes.rows.length === 0) {
      return res.json(formatResponse(true, {
        branch_id: branchId,
        ledger_date: targetDate,
        opening_balance: state.opening,
        cash_revenue: state.cashRev,
        cash_expenditure: state.cashExp,
        deposited_amount: state.cashDep,
        available_cash: state.availableCash,
        expected_cash: state.expectedCash,
        closing_balance: state.closingBalance
      }, 'Cash ledger computed successfully'));
    }

    const row = ledgerRes.rows[0];
    return res.json(formatResponse(true, {
      id: row.id,
      branch_id: row.branch_id,
      ledger_date: row.ledger_date,
      opening_balance: parseFloat(row.opening_balance),
      cash_revenue: parseFloat(row.cash_revenue),
      cash_expenditure: parseFloat(row.cash_expenditure),
      deposited_amount: parseFloat(row.deposited_amount),
      available_cash: state.availableCash,
      expected_cash: state.expectedCash,
      closing_balance: parseFloat(row.closing_balance)
    }, 'Cash ledger retrieved successfully'));

  } catch (err) {
    console.error('getCashLedger error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 2. Create Cash Expenditure
async function createExpenditure(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { expense_date, expense_category, description, amount, approved_by, remarks } = req.body;

    if (!expense_category || !expense_category.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'expense_category is required'));
    }

    if (amount === undefined || amount === null || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Expense amount must be a positive number greater than 0'));
    }

    const expAmt = parseFloat(amount);
    const expDate = expense_date || new Date().toISOString().split('T')[0];
    const branchId = (req.user.role === 'super_admin' && req.body.branch_id)
      ? parseInt(req.body.branch_id)
      : (req.user.branch_id || 1);
    const approvedById = approved_by ? parseInt(approved_by) : (req.user.role === 'super_admin' ? req.user.user_id : null);

    // Duplicate check within 5 seconds
    const dupCheck = await client.query(`
      SELECT id FROM expenditures
      WHERE branch_id = $1 AND entered_by = $2 AND expense_category = $3 AND amount = $4
        AND created_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [branchId, req.user.user_id, expense_category.trim(), expAmt]);

    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(formatResponse(false, null, 'Duplicate expenditure submission detected. Please wait a moment.'));
    }

    const expRes = await client.query(`
      INSERT INTO expenditures (
        expense_date, branch_id, expense_category, description, amount,
        payment_mode, approved_by, entered_by, remarks
      ) VALUES ($1, $2, $3, $4, $5, 'cash', $6, $7, $8)
      RETURNING *
    `, [expDate, branchId, expense_category.trim(), description ? description.trim() : '', expAmt, approvedById, req.user.user_id, remarks ? remarks.trim() : null]);

    const newExp = expRes.rows[0];

    // Recalculate full day state to keep cash_ledger perfectly synchronized
    const state = await calculateCashState(client, branchId, expDate);

    await client.query(`
      INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (branch_id, ledger_date)
      DO UPDATE SET
        opening_balance = $3,
        cash_revenue = $4,
        cash_expenditure = $5,
        deposited_amount = $6,
        closing_balance = $7
    `, [branchId, expDate, state.opening, state.cashRev, state.cashExp, state.cashDep, state.closingBalance]);

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

// 3. Super Admin Direct Deposit ONLY
async function createCashDeposit(req, res) {
  // PRO cannot perform direct deposits
  if (req.user.role !== 'super_admin') {
    return res.status(403).json(formatResponse(
      false,
      null,
      'PRO users cannot perform direct bank deposits. Please submit a deposit request for Super Admin approval.'
    ));
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { deposit_date, deposited_amount, deposit_reference, bank_name, remarks } = req.body;

    if (deposited_amount === undefined || deposited_amount === null || isNaN(parseFloat(deposited_amount)) || parseFloat(deposited_amount) <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Deposited amount must be a positive number greater than 0'));
    }

    const depAmt = parseFloat(deposited_amount);
    const depDate = deposit_date || new Date().toISOString().split('T')[0];
    const branchId = req.body.branch_id ? parseInt(req.body.branch_id) : (req.user.branch_id || 1);

    const state = await calculateCashState(client, branchId, depDate);

    if (depAmt > state.availableCash) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(
        false,
        null,
        `Deposited amount (₹${depAmt}) cannot exceed available cash in drawer (₹${state.availableCash})`
      ));
    }

    const newTotalDeposited = state.cashDep + depAmt;
    const newClosingBalance = state.expectedCash - newTotalDeposited;

    const combinedRef = [bank_name, deposit_reference, remarks].filter(Boolean).join(' - ') || deposit_reference || null;

    const depositRes = await client.query(`
      INSERT INTO cash_deposits (
        branch_id, deposit_date, opening_balance, cash_revenue, cash_expenditure,
        available_cash, deposited_amount, deposit_reference, deposited_by, closing_balance,
        deposit_type, approved_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SUPER_ADMIN', $11)
      RETURNING *
    `, [
      branchId, depDate, state.opening, state.cashRev, state.cashExp, state.availableCash, depAmt,
      combinedRef, req.user.user_id, newClosingBalance, req.user.user_id
    ]);

    const newDeposit = depositRes.rows[0];

    // Update cash ledger
    await client.query(`
      INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (branch_id, ledger_date)
      DO UPDATE SET
        opening_balance = $3,
        cash_revenue = $4,
        cash_expenditure = $5,
        deposited_amount = $6,
        closing_balance = $7
    `, [branchId, depDate, state.opening, state.cashRev, state.cashExp, newTotalDeposited, newClosingBalance]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Cash Management', action: 'Create Super Admin Direct Deposit', recordId: newDeposit.id, newValue: newDeposit };
    return res.status(201).json(formatResponse(true, newDeposit, 'Super Admin cash deposit recorded and ledger updated successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createCashDeposit error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// 4. Create PRO Deposit Request
async function createDepositRequest(req, res) {
  const idempotencyKey = req.body?.idempotency_key || null;
  try {
    // Only PRO and Super Admin can request
    const allowedRoles = ['pro_manager', 'super_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(formatResponse(false, null, 'You are not authorized to create deposit requests.'));
    }

    const amountRaw = req.body.requested_amount !== undefined ? req.body.requested_amount : req.body.amount || req.body.deposit_amount;
    if (amountRaw === undefined || amountRaw === null || amountRaw === '' || isNaN(parseFloat(amountRaw))) {
      return res.status(400).json(formatResponse(false, null, 'Deposit amount is required and must be a valid number.'));
    }

    const requestedAmount = parseFloat(amountRaw);
    if (requestedAmount <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Deposit amount must be a positive number greater than 0.'));
    }

    const branchId = (req.user.role === 'super_admin' && req.body.branch_id)
      ? parseInt(req.body.branch_id)
      : (req.user.branch_id || 1);

    const requestDate = req.body.request_date || new Date().toISOString().split('T')[0];
    const challanRef = req.body.challan_reference || req.body.deposit_reference || null;
    const remarks = req.body.remarks || null;

    // Idempotency: duplicate key check
    if (idempotencyKey) {
      const existingKey = await db.query(
        `SELECT * FROM cash_deposit_requests WHERE idempotency_key = $1 LIMIT 1`,
        [idempotencyKey]
      );
      if (existingKey.rows.length > 0) {
        return res.status(200).json(formatResponse(
          true,
          existingKey.rows[0],
          'Existing deposit request returned for idempotency key'
        ));
      }
    }

    // Rate-limiting / double-click protection (5 seconds)
    const dupCheck = await db.query(`
      SELECT id FROM cash_deposit_requests
      WHERE branch_id = $1 AND requested_by = $2 AND requested_amount = $3
        AND status = 'pending' AND created_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [branchId, req.user.user_id, requestedAmount]);

    if (dupCheck.rows.length > 0) {
      return res.status(409).json(formatResponse(
        false,
        null,
        'Duplicate deposit request detected. Please wait a moment before submitting again.'
      ));
    }

    // Server-side available cash recalculation
    const state = await calculateCashState(db, branchId, requestDate);

    if (requestedAmount > state.availableCash) {
      return res.status(400).json(formatResponse(
        false,
        null,
        `Deposit amount (₹${requestedAmount}) exceeds currently available cash in drawer (₹${state.availableCash}).`
      ));
    }

    const insertRes = await db.query(`
      INSERT INTO cash_deposit_requests (
        branch_id, requested_by, requested_role, requested_amount,
        request_date, status, challan_reference, remarks, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
      RETURNING *
    `, [
      branchId,
      req.user.user_id,
      req.user.role,
      requestedAmount,
      requestDate,
      challanRef ? challanRef.trim() : null,
      remarks ? remarks.trim() : null,
      idempotencyKey
    ]);

    const newReq = insertRes.rows[0];

    res.locals.auditEntry = {
      module: 'Cash Management',
      action: 'Create Deposit Request',
      recordId: newReq.id,
      newValue: newReq
    };

    return res.status(201).json(formatResponse(
      true,
      newReq,
      'Deposit request submitted successfully — awaiting Super Admin approval.'
    ));
  } catch (err) {
    if (err.code === '23505' && idempotencyKey) {
      try {
        const existing = await db.query(
          `SELECT * FROM cash_deposit_requests WHERE idempotency_key = $1 LIMIT 1`,
          [idempotencyKey]
        );
        if (existing.rows.length > 0) {
          return res.status(200).json(formatResponse(
            true,
            existing.rows[0],
            'Existing deposit request returned for idempotency key'
          ));
        }
      } catch (findErr) {
        console.error('Error fetching existing record after unique conflict:', findErr);
      }
    }
    console.error('createDepositRequest error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 5. Get Deposit Requests (list with filters)
async function getDepositRequests(req, res) {
  try {
    const { status, branch_id, pro_id, date_from, date_to } = req.query;

    let query = `
      SELECT
        cdr.id,
        cdr.branch_id,
        cdr.requested_by,
        cdr.requested_role,
        cdr.requested_amount,
        TO_CHAR(cdr.request_date, 'YYYY-MM-DD') AS request_date,
        cdr.status,
        cdr.approved_by,
        cdr.approved_at,
        cdr.rejected_by,
        cdr.rejected_at,
        cdr.rejection_reason,
        cdr.completed_by,
        cdr.completed_at,
        cdr.challan_reference,
        cdr.remarks,
        cdr.created_at,
        cdr.updated_at,
        u.full_name AS requester_name,
        u.employee_id AS requester_employee_id,
        u.username AS requester_username,
        b.branch_name,
        b.branch_code,
        appr.full_name AS approver_name,
        rej.full_name AS rejector_name,
        comp.full_name AS completer_name
      FROM cash_deposit_requests cdr
      JOIN users u ON cdr.requested_by = u.user_id
      JOIN branches b ON cdr.branch_id = b.branch_id
      LEFT JOIN users appr ON cdr.approved_by = appr.user_id
      LEFT JOIN users rej ON cdr.rejected_by = rej.user_id
      LEFT JOIN users comp ON cdr.completed_by = comp.user_id
      WHERE 1=1
    `;

    const params = [];
    let pIdx = 1;

    // RBAC: If PRO, restrict to own branch and requests
    if (req.user.role === 'pro_manager') {
      query += ` AND cdr.requested_by = $${pIdx++}`;
      params.push(req.user.user_id);

      if (req.user.branch_id) {
        query += ` AND cdr.branch_id = $${pIdx++}`;
        params.push(req.user.branch_id);
      }
    } else if (req.user.role === 'super_admin') {
      if (branch_id && branch_id !== 'all') {
        query += ` AND cdr.branch_id = $${pIdx++}`;
        params.push(parseInt(branch_id));
      }
      if (pro_id && pro_id !== 'all') {
        query += ` AND cdr.requested_by = $${pIdx++}`;
        params.push(parseInt(pro_id));
      }
    } else {
      return res.status(403).json(formatResponse(false, null, 'Unauthorized access to deposit requests.'));
    }

    if (status && status !== 'all') {
      query += ` AND cdr.status = $${pIdx++}`;
      params.push(status.toLowerCase());
    }

    if (date_from) {
      query += ` AND cdr.request_date >= $${pIdx++}`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND cdr.request_date <= $${pIdx++}`;
      params.push(date_to);
    }

    query += ` ORDER BY cdr.created_at DESC`;

    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows, 'Deposit requests retrieved successfully.'));
  } catch (err) {
    console.error('getDepositRequests error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 6. Get Pending Deposit Requests Count and Summary for Super Admin notification & login
async function getPendingDepositRequestsCount(req, res) {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json(formatResponse(false, null, 'Only Super Admin can access pending requests summary.'));
    }

    const branchFilter = req.query.branch_id && req.query.branch_id !== 'all' ? parseInt(req.query.branch_id) : null;

    let query = `
      SELECT
        cdr.id,
        cdr.branch_id,
        cdr.requested_by,
        cdr.requested_amount,
        TO_CHAR(cdr.request_date, 'YYYY-MM-DD') AS request_date,
        cdr.challan_reference,
        cdr.remarks,
        cdr.created_at,
        u.full_name AS requester_name,
        u.employee_id AS requester_employee_id,
        b.branch_name,
        b.branch_code
      FROM cash_deposit_requests cdr
      JOIN users u ON cdr.requested_by = u.user_id
      JOIN branches b ON cdr.branch_id = b.branch_id
      WHERE cdr.status = 'pending'
    `;

    const params = [];
    if (branchFilter) {
      query += ` AND cdr.branch_id = $1`;
      params.push(branchFilter);
    }

    query += ` ORDER BY cdr.created_at DESC`;

    const result = await db.query(query, params);

    return res.json(formatResponse(true, {
      count: result.rows.length,
      pending_requests: result.rows
    }, 'Pending deposit requests summary retrieved successfully.'));
  } catch (err) {
    console.error('getPendingDepositRequestsCount error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 7. Get Single Deposit Request by ID
async function getDepositRequestById(req, res) {
  try {
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid request ID.'));
    }

    const query = `
      SELECT
        cdr.*,
        u.full_name AS requester_name,
        u.employee_id AS requester_employee_id,
        u.username AS requester_username,
        b.branch_name,
        b.branch_code,
        appr.full_name AS approver_name,
        rej.full_name AS rejector_name,
        comp.full_name AS completer_name
      FROM cash_deposit_requests cdr
      JOIN users u ON cdr.requested_by = u.user_id
      JOIN branches b ON cdr.branch_id = b.branch_id
      LEFT JOIN users appr ON cdr.approved_by = appr.user_id
      LEFT JOIN users rej ON cdr.rejected_by = rej.user_id
      LEFT JOIN users comp ON cdr.completed_by = comp.user_id
      WHERE cdr.id = $1
    `;

    const result = await db.query(query, [requestId]);
    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Deposit request not found.'));
    }

    const reqData = result.rows[0];

    // PRO can only view own request
    if (req.user.role === 'pro_manager' && reqData.requested_by !== req.user.user_id) {
      return res.status(403).json(formatResponse(false, null, 'Unauthorized to view this deposit request.'));
    }

    // Compute live available cash for context
    const state = await calculateCashState(db, reqData.branch_id, reqData.request_date);

    return res.json(formatResponse(true, {
      ...reqData,
      current_available_cash: state.availableCash,
      current_expected_cash: state.expectedCash
    }, 'Deposit request retrieved successfully.'));
  } catch (err) {
    console.error('getDepositRequestById error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 8. Super Admin Approve Request
async function approveDepositRequest(req, res) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json(formatResponse(false, null, 'Only Super Admin can approve deposit requests.'));
  }

  const requestId = parseInt(req.params.id);
  if (isNaN(requestId)) {
    return res.status(400).json(formatResponse(false, null, 'Invalid request ID.'));
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Row-level lock to prevent concurrent approvals
    const reqRes = await client.query(
      `SELECT * FROM cash_deposit_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Deposit request not found.'));
    }

    const depReq = reqRes.rows[0];

    if (depReq.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(
        false,
        null,
        `Cannot approve deposit request. Current status is already '${depReq.status}'.`
      ));
    }

    // Re-check available cash at approval time
    const state = await calculateCashState(client, depReq.branch_id, depReq.request_date);
    const reqAmt = parseFloat(depReq.requested_amount);

    if (reqAmt > state.availableCash) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(
        false,
        null,
        `Available cash in drawer (₹${state.availableCash}) is insufficient for requested amount (₹${reqAmt}). Cannot approve.`
      ));
    }

    const updateRes = await client.query(`
      UPDATE cash_deposit_requests
      SET status = 'approved',
          approved_by = $2,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [requestId, req.user.user_id]);

    const approvedReq = updateRes.rows[0];

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Cash Management',
      action: 'Approve Deposit Request',
      recordId: approvedReq.id,
      newValue: approvedReq
    };

    return res.json(formatResponse(true, approvedReq, 'Deposit request approved successfully.'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approveDepositRequest error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// 9. Super Admin Reject Request
async function rejectDepositRequest(req, res) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json(formatResponse(false, null, 'Only Super Admin can reject deposit requests.'));
  }

  const requestId = parseInt(req.params.id);
  if (isNaN(requestId)) {
    return res.status(400).json(formatResponse(false, null, 'Invalid request ID.'));
  }

  const { rejection_reason } = req.body;
  if (!rejection_reason || !rejection_reason.trim()) {
    return res.status(400).json(formatResponse(false, null, 'Rejection reason is required.'));
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Row-level lock
    const reqRes = await client.query(
      `SELECT * FROM cash_deposit_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Deposit request not found.'));
    }

    const depReq = reqRes.rows[0];

    if (depReq.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(
        false,
        null,
        `Cannot reject deposit request. Current status is '${depReq.status}'. Only pending requests can be rejected.`
      ));
    }

    const updateRes = await client.query(`
      UPDATE cash_deposit_requests
      SET status = 'rejected',
          rejected_by = $2,
          rejected_at = NOW(),
          rejection_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [requestId, req.user.user_id, rejection_reason.trim()]);

    const rejectedReq = updateRes.rows[0];

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Cash Management',
      action: 'Reject Deposit Request',
      recordId: rejectedReq.id,
      newValue: rejectedReq
    };

    return res.json(formatResponse(true, rejectedReq, 'Deposit request rejected successfully.'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('rejectDepositRequest error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// 10. PRO Complete Approved Request
async function completeDepositRequest(req, res) {
  const requestId = parseInt(req.params.id);
  if (isNaN(requestId)) {
    return res.status(400).json(formatResponse(false, null, 'Invalid request ID.'));
  }

  const { challan_reference, remarks } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock deposit request row
    const reqRes = await client.query(
      `SELECT * FROM cash_deposit_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Deposit request not found.'));
    }

    const depReq = reqRes.rows[0];

    // 2. Status verification
    if (depReq.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(409).json(formatResponse(false, null, 'This deposit has already been completed.'));
    }

    if (depReq.status === 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Deposit request is awaiting Super Admin approval.'));
    }

    if (depReq.status === 'rejected') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Deposit request was rejected: ${depReq.rejection_reason || 'No reason provided'}.`));
    }

    if (depReq.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Deposit request was cancelled.'));
    }

    if (depReq.status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Deposit request status '${depReq.status}' is not eligible for completion.`));
    }

    // 3. User verification: PRO cannot complete another PRO's request
    if (req.user.role === 'pro_manager' && depReq.requested_by !== req.user.user_id) {
      await client.query('ROLLBACK');
      return res.status(403).json(formatResponse(false, null, 'You cannot complete another PRO’s deposit request.'));
    }

    // 4. Branch verification
    if (req.user.role !== 'super_admin' && req.user.branch_id && req.user.branch_id !== depReq.branch_id) {
      await client.query('ROLLBACK');
      return res.status(403).json(formatResponse(false, null, 'Branch mismatch for deposit request completion.'));
    }

    const depAmt = parseFloat(depReq.requested_amount);
    const depDate = depReq.request_date || new Date().toISOString().split('T')[0];
    const finalChallan = challan_reference ? challan_reference.trim() : depReq.challan_reference;
    const finalRemarks = remarks ? remarks.trim() : depReq.remarks;

    // 5. Re-verify available cash before writing to cash_deposits
    const state = await calculateCashState(client, depReq.branch_id, depDate);
    if (depAmt > state.availableCash) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(
        false,
        null,
        `Cannot complete deposit: deposit amount (₹${depAmt}) exceeds current available cash in drawer (₹${state.availableCash}).`
      ));
    }

    const newTotalDeposited = state.cashDep + depAmt;
    const newClosingBalance = state.expectedCash - newTotalDeposited;

    // 6. Record in cash_deposits with deposit_type = 'PRO'
    const depositInsertRes = await client.query(`
      INSERT INTO cash_deposits (
        branch_id, deposit_date, opening_balance, cash_revenue, cash_expenditure,
        available_cash, deposited_amount, deposit_reference, deposited_by, closing_balance,
        deposit_type, deposit_request_id, approved_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PRO', $11, $12)
      RETURNING *
    `, [
      depReq.branch_id,
      depDate,
      state.opening,
      state.cashRev,
      state.cashExp,
      state.availableCash,
      depAmt,
      finalChallan,
      req.user.user_id,
      newClosingBalance,
      depReq.id,
      depReq.approved_by
    ]);

    const newDeposit = depositInsertRes.rows[0];

    // 7. Update deposit request to 'completed'
    const updateReqRes = await client.query(`
      UPDATE cash_deposit_requests
      SET status = 'completed',
          completed_by = $2,
          completed_at = NOW(),
          challan_reference = COALESCE($3, challan_reference),
          remarks = COALESCE($4, remarks),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [requestId, req.user.user_id, finalChallan, finalRemarks]);

    const completedReq = updateReqRes.rows[0];

    // 8. Update cash_ledger atomically
    await client.query(`
      INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (branch_id, ledger_date)
      DO UPDATE SET
        opening_balance = $3,
        cash_revenue = $4,
        cash_expenditure = $5,
        deposited_amount = $6,
        closing_balance = $7
    `, [depReq.branch_id, depDate, state.opening, state.cashRev, state.cashExp, newTotalDeposited, newClosingBalance]);

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Cash Management',
      action: 'Complete Bank Deposit',
      recordId: completedReq.id,
      newValue: { request: completedReq, deposit: newDeposit }
    };

    return res.status(200).json(formatResponse(true, {
      request: completedReq,
      deposit: newDeposit
    }, 'Bank cash deposit completed and ledger updated successfully.'));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json(formatResponse(false, null, 'This deposit request has already been completed.'));
    }
    console.error('completeDepositRequest error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// 11. Get Deposit History (Unified for Super Admin & PRO with distinguishing types and full filters)
async function getDepositHistory(req, res) {
  try {
    const { date_from, date_to, deposit_type, status, pro_id, branch_id } = req.query;

    let query = `
      SELECT
        cd.id AS deposit_id,
        cd.branch_id,
        TO_CHAR(cd.deposit_date, 'YYYY-MM-DD') AS deposit_date,
        cd.deposited_amount AS amount,
        cd.deposit_reference AS challan_reference,
        cd.deposit_type,
        cd.deposit_request_id,
        cd.created_at,
        'completed' AS status,
        b.branch_name,
        b.branch_code,
        u_dep.full_name AS completed_by_name,
        u_dep.employee_id AS completed_by_employee_id,
        u_appr.full_name AS approved_by_name,
        cdr.requested_by,
        u_req.full_name AS requested_by_name,
        u_req.employee_id AS requested_by_employee_id,
        cdr.approved_at,
        cdr.completed_at
      FROM cash_deposits cd
      JOIN branches b ON cd.branch_id = b.branch_id
      LEFT JOIN users u_dep ON cd.deposited_by = u_dep.user_id
      LEFT JOIN users u_appr ON cd.approved_by = u_appr.user_id
      LEFT JOIN cash_deposit_requests cdr ON cd.deposit_request_id = cdr.id
      LEFT JOIN users u_req ON cdr.requested_by = u_req.user_id
      WHERE 1=1
    `;

    const params = [];
    let pIdx = 1;

    // RBAC: If PRO, restrict to own deposits and branch
    if (req.user.role === 'pro_manager') {
      query += ` AND (cd.deposited_by = $${pIdx} OR cdr.requested_by = $${pIdx})`;
      params.push(req.user.user_id);
      pIdx++;

      if (req.user.branch_id) {
        query += ` AND cd.branch_id = $${pIdx++}`;
        params.push(req.user.branch_id);
      }
    } else if (req.user.role === 'super_admin') {
      if (branch_id && branch_id !== 'all') {
        query += ` AND cd.branch_id = $${pIdx++}`;
        params.push(parseInt(branch_id));
      }
      if (pro_id && pro_id !== 'all') {
        query += ` AND (cdr.requested_by = $${pIdx} OR cd.deposited_by = $${pIdx})`;
        params.push(parseInt(pro_id));
        pIdx++;
      }
    } else {
      return res.status(403).json(formatResponse(false, null, 'Unauthorized access to deposit history.'));
    }

    if (date_from) {
      query += ` AND cd.deposit_date >= $${pIdx++}`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND cd.deposit_date <= $${pIdx++}`;
      params.push(date_to);
    }

    if (deposit_type && deposit_type !== 'all' && deposit_type !== 'ALL') {
      query += ` AND UPPER(cd.deposit_type) = $${pIdx++}`;
      params.push(deposit_type.toUpperCase());
    }

    query += ` ORDER BY cd.created_at DESC`;

    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows, 'Deposit history retrieved successfully.'));
  } catch (err) {
    console.error('getDepositHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 12. Get Expenditures History (Unified for Super Admin & PRO with full filters)
async function getExpendituresHistory(req, res) {
  try {
    const { date_from, date_to, category, pro_id, branch_id } = req.query;

    let query = `
      SELECT
        e.id AS expense_id,
        TO_CHAR(e.expense_date, 'YYYY-MM-DD') AS expense_date,
        e.branch_id,
        e.expense_category AS category,
        e.description,
        e.amount,
        e.payment_mode,
        e.remarks,
        e.created_at,
        b.branch_name,
        b.branch_code,
        u.user_id AS entered_by_id,
        u.full_name AS entered_by_name,
        u.employee_id AS entered_by_employee_id,
        u.role AS entered_by_role,
        appr.full_name AS approved_by_name
      FROM expenditures e
      JOIN branches b ON e.branch_id = b.branch_id
      JOIN users u ON e.entered_by = u.user_id
      LEFT JOIN users appr ON e.approved_by = appr.user_id
      WHERE 1=1
    `;

    const params = [];
    let pIdx = 1;

    if (req.user.role === 'pro_manager') {
      query += ` AND e.entered_by = $${pIdx++}`;
      params.push(req.user.user_id);

      if (req.user.branch_id) {
        query += ` AND e.branch_id = $${pIdx++}`;
        params.push(req.user.branch_id);
      }
    } else if (req.user.role === 'super_admin') {
      if (branch_id && branch_id !== 'all') {
        query += ` AND e.branch_id = $${pIdx++}`;
        params.push(parseInt(branch_id));
      }
      if (pro_id && pro_id !== 'all') {
        query += ` AND e.entered_by = $${pIdx++}`;
        params.push(parseInt(pro_id));
      }
    } else {
      return res.status(403).json(formatResponse(false, null, 'Unauthorized access to expenditures.'));
    }

    if (date_from) {
      query += ` AND e.expense_date >= $${pIdx++}`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND e.expense_date <= $${pIdx++}`;
      params.push(date_to);
    }

    if (category && category !== 'all' && category !== 'ALL') {
      query += ` AND e.expense_category = $${pIdx++}`;
      params.push(category);
    }

    query += ` ORDER BY e.created_at DESC`;

    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows, 'Expenditures retrieved successfully.'));
  } catch (err) {
    console.error('getExpendituresHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  calculateCashState,
  getCashLedger,
  createExpenditure,
  createCashDeposit,
  createDepositRequest,
  getDepositRequests,
  getPendingDepositRequestsCount,
  getDepositRequestById,
  approveDepositRequest,
  rejectDepositRequest,
  completeDepositRequest,
  getDepositHistory,
  getExpendituresHistory
};
