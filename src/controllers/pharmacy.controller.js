const db = require('../db');
const { formatResponse } = require('../utils/helpers');
const xlsx = require('xlsx');

// -------------------------------------------------------------
// Prohibited Action Blockers
// -------------------------------------------------------------
async function blockClinicalModification(req, res) {
  return res.status(403).json(formatResponse(false, null, 'Forbidden: Clinical prescription modifications (medicine, dosage, frequency) are restricted to Doctor approval'));
}

async function blockProhibitedAction(req, res) {
  return res.status(403).json(formatResponse(false, null, 'Forbidden: Pharmacy role is restricted from performing registration, billing, payment, or doctor consultations'));
}

// -------------------------------------------------------------
// 1. Dashboard
// -------------------------------------------------------------
async function getDashboard(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const today = new Date().toISOString().split('T')[0];

    // Read alert threshold setting
    const settingRes = await db.query(`SELECT setting_value FROM hospital_settings WHERE setting_key = 'pharmacy_expiry_alert_days'`);
    const alertDays = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].setting_value) : 30;

    const pendingRxRes = await db.query(`
      SELECT COUNT(DISTINCT a.appointment_id) FROM prescriptions p
      JOIN appointments a ON p.appointment_id = a.appointment_id
      WHERE a.status = 'pro_completed' AND (p.pharmacy_status = 'pending' OR p.pharmacy_status IS NULL)
    `);
    const pendingRx = parseInt(pendingRxRes.rows[0].count);

    const processingRes = await db.query(`
      SELECT COUNT(DISTINCT a.appointment_id) FROM prescriptions p
      JOIN appointments a ON p.appointment_id = a.appointment_id
      WHERE a.status = 'pro_completed' AND p.pharmacy_status = 'processing'
    `);
    const processing = parseInt(processingRes.rows[0].count);

    const dispensedTodayRes = await db.query(`
      SELECT COUNT(DISTINCT prescription_id) FROM prescription_items
      WHERE dispensed = true AND DATE(dispensed_at) = $1
    `, [today]);
    const dispensedToday = parseInt(dispensedTodayRes.rows[0].count);

    const lowStockRes = await db.query(`
      SELECT COUNT(DISTINCT mm.id)
      FROM medicine_master mm
      LEFT JOIN (
        SELECT medicine_id, COALESCE(SUM(quantity), 0) as total_qty
        FROM medicine_stock
        WHERE branch_id = $1 AND expiry_date >= CURRENT_DATE
        GROUP BY medicine_id
      ) s ON mm.id = s.medicine_id
      WHERE COALESCE(s.total_qty, 0) <= mm.reorder_level AND mm.status = 'active'
    `, [branchId]);
    const lowStock = parseInt(lowStockRes.rows[0].count);

    const expiringRes = await db.query(`
      SELECT COUNT(*) FROM medicine_stock
      WHERE branch_id = $1 AND quantity > 0
        AND expiry_date >= CURRENT_DATE
        AND expiry_date <= (CURRENT_DATE + ($2 || ' days')::INTERVAL)
    `, [branchId, alertDays]);
    const expiring = parseInt(expiringRes.rows[0].count);

    const outOfStockRes = await db.query(`
      SELECT COUNT(DISTINCT mm.id)
      FROM medicine_master mm
      LEFT JOIN (
        SELECT medicine_id, COALESCE(SUM(quantity), 0) as total_qty
        FROM medicine_stock
        WHERE branch_id = $1 AND expiry_date >= CURRENT_DATE
        GROUP BY medicine_id
      ) s ON mm.id = s.medicine_id
      WHERE COALESCE(s.total_qty, 0) = 0 AND mm.status = 'active'
    `, [branchId]);
    const outOfStock = parseInt(outOfStockRes.rows[0].count);

    const expiredRes = await db.query(`
      SELECT COUNT(*) FROM medicine_stock
      WHERE branch_id = $1 AND quantity > 0 AND expiry_date < CURRENT_DATE
    `, [branchId]);
    const expired = parseInt(expiredRes.rows[0].count);

    const returnsRes = await db.query(`
      SELECT COUNT(*) FROM medicine_returns WHERE branch_id = $1 AND DATE(created_at) = $2
    `, [branchId, today]);
    const returnsToday = parseInt(returnsRes.rows[0].count);

    const totalStockQtyRes = await db.query(`
      SELECT COALESCE(SUM(quantity), 0) as total_qty FROM medicine_stock WHERE branch_id = $1 AND expiry_date >= CURRENT_DATE
    `, [branchId]);
    const totalStockQuantity = parseInt(totalStockQtyRes.rows[0].total_qty);

    return res.json(formatResponse(true, {
      pending_rx: pendingRx,
      processing,
      dispensed_today: dispensedToday,
      low_stock: lowStock,
      expiring,
      out_of_stock: outOfStock,
      expired,
      returns_today: returnsToday,
      total_stock_quantity: totalStockQuantity
    }, 'Pharmacy dashboard metrics retrieved successfully'));
  } catch (err) {
    console.error('getDashboard error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 2. Prescription Queue & Process Prescription
// -------------------------------------------------------------
async function getPrescriptionQueue(req, res) {
  try {
    const { status, search, date } = req.query;
    let query = `
      WITH ranked_rx AS (
        SELECT p.*,
               ROW_NUMBER() OVER (
                 PARTITION BY p.appointment_id
                 ORDER BY
                   CASE
                     WHEN p.pharmacy_status = 'dispensed' THEN 1
                     WHEN p.pharmacy_status = 'partially_dispensed' THEN 2
                     WHEN p.pharmacy_status = 'processing' THEN 3
                     WHEN p.pharmacy_status = 'on_hold' THEN 4
                     ELSE 5
                   END ASC,
                   p.id DESC
               ) as rn
        FROM prescriptions p
        WHERE p.appointment_id IS NOT NULL
      )
      SELECT p.id as prescription_id, p.patient_id, p.doctor_id, p.created_at as prescription_date,
             COALESCE(p.pharmacy_status, 'pending'::pharmacy_status_enum) as pharmacy_status,
             pt.full_name as patient_name, pt.mobile_number,
             pt.patient_id as registration_id,
             u.full_name as doctor_name,
             a.appointment_id as token_no,
             a.status as appointment_status,
             a.status as pro_status,
             CASE
               WHEN b.status = 'refunded' THEN 'refunded'
               WHEN b.status = 'cancelled' THEN 'cancelled'
               WHEN b.bill_id IS NULL THEN 'unbilled'
               WHEN b.paid_amount >= b.final_amount AND b.final_amount > 0 THEN 'paid'
               WHEN b.paid_amount > 0 THEN 'partially_paid'
               WHEN b.status = 'created' THEN 'paid'
               ELSE 'pending'
             END as payment_status,
             (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id = p.id) as items_count,
             (SELECT COUNT(*) FROM prescription_clarifications pc WHERE pc.prescription_id = p.id AND pc.status = 'open') as open_clarifications_count
      FROM ranked_rx p
      JOIN appointments a ON p.appointment_id = a.appointment_id
      JOIN patients pt ON p.patient_id = pt.patient_id
      JOIN doctors d ON p.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT b_sub.bill_id, b_sub.status, b_sub.final_amount,
               COALESCE(SUM(py_sub.amount) FILTER (WHERE py_sub.status = 'success'), 0) as paid_amount
        FROM bills b_sub
        LEFT JOIN payments py_sub ON b_sub.bill_id = py_sub.bill_id
        WHERE b_sub.patient_id = p.patient_id AND b_sub.bill_type = 'treatment'
        GROUP BY b_sub.bill_id, b_sub.status, b_sub.final_amount
        ORDER BY b_sub.bill_id DESC
        LIMIT 1
      ) b ON true
      WHERE a.status = 'pro_completed' AND p.rn = 1
    `;
    const params = [];

    if (status) {
      if (status === 'processing') {
        query += ` AND p.pharmacy_status IN ('processing', 'partially_dispensed', 'on_hold')`;
      } else {
        params.push(status);
        query += ` AND p.pharmacy_status = $${params.length}`;
      }
    }

    if (date) {
      params.push(date);
      query += ` AND DATE(p.created_at) = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (pt.full_name ILIKE $${params.length} OR pt.mobile_number ILIKE $${params.length} OR CAST(p.id AS TEXT) ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR CAST(a.appointment_id AS TEXT) ILIKE $${params.length})`;
    }

    query += ` GROUP BY p.id, p.patient_id, p.doctor_id, p.created_at, p.pharmacy_status, pt.patient_id, pt.full_name, pt.mobile_number, u.full_name, a.appointment_id, b.bill_id, b.status, b.final_amount, b.paid_amount ORDER BY p.id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Pharmacy prescription queue retrieved successfully'));
  } catch (err) {
    console.error('getPrescriptionQueue error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function processPrescription(req, res) {
  try {
    const rxId = parseInt(req.params.id);

    const rxRes = await db.query(`
      SELECT p.id as prescription_id, p.patient_id, p.doctor_id, p.appointment_id, p.created_at,
             COALESCE(p.pharmacy_status, 'pending'::pharmacy_status_enum) as pharmacy_status,
             pt.full_name as patient_name, pt.mobile_number, pt.age, pt.gender,
             u.full_name as doctor_name,
             a.appointment_date, a.status as appointment_status,
             b.status as bill_status, b.final_amount
      FROM prescriptions p
      JOIN appointments a ON p.appointment_id = a.appointment_id
      JOIN patients pt ON p.patient_id = pt.patient_id
      JOIN doctors d ON p.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN bills b ON p.patient_id = b.patient_id AND b.bill_type = 'treatment'
      WHERE p.id = $1
    `, [rxId]);

    if (rxRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Prescription not found'));
    }

    const rx = rxRes.rows[0];

    // Gating check: PRO completion required
    if (rx.appointment_status !== 'pro_completed') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Prescription cannot be processed prior to PRO completed status'));
    }

    // Update status to processing if currently pending
    if (rx.pharmacy_status === 'pending') {
      await db.query(`UPDATE prescriptions SET pharmacy_status = 'processing' WHERE id = $1`, [rxId]);
      rx.pharmacy_status = 'processing';
    }

    // Get items
    const itemsRes = await db.query(`
      SELECT pi.*, mm.medicine_name, mm.generic_name, mm.strength as potency, mm.unit
      FROM prescription_items pi
      JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE pi.prescription_id = $1
      ORDER BY pi.id ASC
    `, [rxId]);

    return res.json(formatResponse(true, {
      prescription: rx,
      items: itemsRes.rows,
      pro_status: 'completed',
      payment_status: rx.bill_status === 'created' ? 'paid' : (rx.bill_status || 'paid')
    }, 'Prescription processed details retrieved successfully'));
  } catch (err) {
    console.error('processPrescription error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 3. Modify Days & Prescription Audit
// -------------------------------------------------------------
async function modifyPrescriptionItemDays(req, res) {
  const client = await db.pool.connect();
  try {
    const itemId = parseInt(req.params.item_id);
    const modified_days = req.body.modified_days || req.body.duration_days;
    const { reason } = req.body;

    if (!modified_days || !reason) {
      return res.status(400).json(formatResponse(false, null, 'modified_days (or duration_days) and reason are required'));
    }

    await client.query('BEGIN');

    const itemRes = await client.query(`SELECT * FROM prescription_items WHERE id = $1`, [itemId]);
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription item not found'));
    }

    const item = itemRes.rows[0];
    const origDays = item.duration_days || Math.max(1, Math.round(item.quantity / 2));
    const newDays = parseInt(modified_days);

    // Calculate daily multiplier from frequency (e.g. "2/day" or "1-0-1" -> 2)
    let dailyFreq = 2;
    if (item.frequency) {
      const match = item.frequency.match(/\d+/g);
      if (match) {
        dailyFreq = match.reduce((sum, n) => sum + parseInt(n), 0) || 2;
      }
    }

    const newQty = dailyFreq * newDays;

    // Record audit in prescription_modifications table
    const modRes = await client.query(`
      INSERT INTO prescription_modifications (
        prescription_item_id, field_changed, original_value, modified_value,
        modified_by, modifier_role, reason, status, branch_id
      ) VALUES ($1, 'duration', $2, $3, $4, 'pharmacy', $5, 'applied', 1)
      RETURNING *
    `, [itemId, String(origDays), String(newDays), req.user.user_id, reason]);

    // Update prescription_items duration_days and recalculated quantity
    const updatedItemRes = await client.query(`
      UPDATE prescription_items
      SET duration_days = $1, quantity = $2
      WHERE id = $3 RETURNING *
    `, [newDays, newQty, itemId]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Prescription', action: 'Modify Duration Days', recordId: itemId, newValue: { original_days: origDays, modified_days: newDays, new_quantity: newQty } };
    return res.json(formatResponse(true, {
      modification: modRes.rows[0],
      updated_item: updatedItemRes.rows[0]
    }, 'Prescription item duration modified and quantity recalculated successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('modifyPrescriptionItemDays error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getItemModifications(req, res) {
  try {
    const itemId = parseInt(req.params.item_id);
    const result = await db.query(`
      SELECT pm.*, u.full_name as modified_by_name
      FROM prescription_modifications pm
      JOIN users u ON pm.modified_by = u.user_id
      WHERE pm.prescription_item_id = $1
      ORDER BY pm.id DESC
    `, [itemId]);
    return res.json(formatResponse(true, result.rows, 'Prescription item modifications audit trail retrieved successfully'));
  } catch (err) {
    console.error('getItemModifications error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 4. Stock Check & FEFO Batch Selection
// -------------------------------------------------------------
async function checkPrescriptionStock(req, res) {
  try {
    const rxId = parseInt(req.params.id);
    const branchId = req.user.branch_id || 1;

    const itemsRes = await db.query(`
      SELECT pi.*, mm.medicine_name, mm.generic_name, mm.strength as potency
      FROM prescription_items pi
      JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE pi.prescription_id = $1
    `, [rxId]);

    const results = [];
    for (const item of itemsRes.rows) {
      // Sum non-expired, positive stock quantity
      const stockSumRes = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) as avail_qty
        FROM medicine_stock
        WHERE medicine_id = $1 AND branch_id = $2 AND expiry_date >= CURRENT_DATE AND quantity > 0
      `, [item.medicine_id, branchId]);

      const availQty = parseInt(stockSumRes.rows[0].avail_qty);
      const reqQty = item.quantity;
      let status = 'available';
      if (availQty === 0) status = 'out_of_stock';
      else if (availQty < reqQty) status = 'partially_available';

      results.push({
        item_id: item.id,
        medicine_id: item.medicine_id,
        medicine_name: item.medicine_name,
        potency: item.potency,
        required_quantity: reqQty,
        available_quantity: availQty,
        status
      });
    }

    return res.json(formatResponse(true, results, 'Stock check completed successfully'));
  } catch (err) {
    console.error('checkPrescriptionStock error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getMedicineBatches(req, res) {
  try {
    const medicineId = parseInt(req.params.id);
    const branchId = req.user.branch_id || 1;

    // FEFO: Order by expiry_date ASC
    const result = await db.query(`
      SELECT ms.*, mm.medicine_name, mm.strength as potency
      FROM medicine_stock ms
      JOIN medicine_master mm ON ms.medicine_id = mm.id
      WHERE ms.medicine_id = $1 AND ms.branch_id = $2 AND ms.quantity > 0 AND ms.expiry_date >= CURRENT_DATE
      ORDER BY ms.expiry_date ASC
    `, [medicineId, branchId]);

    return res.json(formatResponse(true, result.rows, 'Medicine stock batches retrieved in FEFO order'));
  } catch (err) {
    console.error('getMedicineBatches error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function selectBatch(req, res) {
  try {
    const itemId = parseInt(req.params.item_id);
    const stock_id = req.body.stock_id || req.body.selected_batch_id || req.body.batch_id;
    const dispensed_quantity = req.body.dispensed_quantity || req.body.dispense_quantity;

    if (!stock_id) {
      return res.status(400).json(formatResponse(false, null, 'stock_id (or selected_batch_id) is required'));
    }

    const stockRes = await db.query(`SELECT * FROM medicine_stock WHERE id = $1`, [stock_id]);
    if (stockRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Stock batch not found'));
    }

    const stock = stockRes.rows[0];
    const today = new Date().toISOString().split('T')[0];

    // Reject expired or 0-qty batch
    if (stock.quantity <= 0 || new Date(stock.expiry_date) < new Date(today)) {
      return res.status(422).json(formatResponse(false, null, 'Cannot select expired or zero-quantity stock batch for dispensing'));
    }

    const result = await db.query(`
      UPDATE prescription_items
      SET selected_batch_id = $1, dispense_status = 'available', dispensed_quantity = COALESCE($2, quantity)
      WHERE id = $3 RETURNING *
    `, [stock.id, dispensed_quantity || null, itemId]);

    return res.json(formatResponse(true, result.rows[0], 'Batch selected successfully'));
  } catch (err) {
    console.error('selectBatch error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 5. Dispensing Workflow
// -------------------------------------------------------------
async function saveDispenseDraft(req, res) {
  try {
    const rxId = parseInt(req.params.id);
    const { items } = req.body; // array of { item_id, stock_id, dispense_quantity }

    if (items && Array.isArray(items)) {
      for (const it of items) {
        if (it.stock_id) {
          await db.query(`
            UPDATE prescription_items
            SET selected_batch_id = $1, dispensed_quantity = $2
            WHERE id = $3 AND prescription_id = $4
          `, [it.stock_id, it.dispense_quantity || 0, it.item_id, rxId]);
        }
      }
    }

    return res.json(formatResponse(true, { prescription_id: rxId }, 'Dispensing draft saved successfully without deducting stock'));
  } catch (err) {
    console.error('saveDispenseDraft error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function completeDispensing(req, res) {
  const client = await db.pool.connect();
  try {
    const rxId = parseInt(req.params.id);
    const { items } = req.body; // array of { item_id, stock_id, dispense_quantity }
    const branchId = req.user.branch_id || 1;

    await client.query('BEGIN');

    const rxRes = await client.query(`SELECT * FROM prescriptions WHERE id = $1`, [rxId]);
    if (rxRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription not found'));
    }

    const allRxItems = await client.query(`SELECT * FROM prescription_items WHERE prescription_id = $1`, [rxId]);
    if (allRxItems.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'No items found on prescription'));
    }

    const itemsToProcess = items || allRxItems.rows.map(i => ({ item_id: i.id, stock_id: i.selected_batch_id, dispense_quantity: i.quantity }));

    let dispensedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const it of itemsToProcess) {
      const itemRowRes = await client.query(`SELECT * FROM prescription_items WHERE id = $1`, [it.item_id]);
      if (itemRowRes.rows.length === 0) continue;
      const itemRow = itemRowRes.rows[0];

      const stockId = it.stock_id || itemRow.selected_batch_id;
      const dQty = parseInt(it.dispense_quantity || itemRow.quantity);

      if (!stockId) {
        // Auto-select FEFO batch if stock_id not explicitly set
        const autoStock = await client.query(`
          SELECT * FROM medicine_stock
          WHERE medicine_id = $1 AND branch_id = $2 AND expiry_date >= CURRENT_DATE AND quantity >= $3
          ORDER BY expiry_date ASC LIMIT 1 FOR UPDATE
        `, [itemRow.medicine_id, branchId, dQty]);

        if (autoStock.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(422).json(formatResponse(false, null, `Insufficient or expired stock for medicine ID ${itemRow.medicine_id}`));
        }
        it.stock_id = autoStock.rows[0].id;
      }

      // Lock stock row FOR UPDATE
      const stockLockRes = await client.query(`
        SELECT * FROM medicine_stock WHERE id = $1 FOR UPDATE
      `, [it.stock_id || stockId]);

      if (stockLockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(422).json(formatResponse(false, null, `Stock batch ID ${it.stock_id || stockId} not found`));
      }

      const stockRow = stockLockRes.rows[0];

      // Validate quantity & expiry
      if (stockRow.quantity < dQty || new Date(stockRow.expiry_date) < new Date(today)) {
        await client.query('ROLLBACK');
        return res.status(422).json(formatResponse(false, null, `Insufficient or expired stock for batch ${stockRow.batch_number}`));
      }

      // Decrement stock
      await client.query(`
        UPDATE medicine_stock
        SET quantity = quantity - $1, updated_at = now()
        WHERE id = $2
      `, [dQty, stockRow.id]);

      // Record stock transaction (out)
      await client.query(`
        INSERT INTO stock_transactions (
          medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
        ) VALUES ($1, 'out', $2, $3, $4, $5, $6)
      `, [itemRow.medicine_id, -dQty, stockRow.batch_number, `Rx #${rxId}`, req.user.user_id, branchId]);

      // Mark item dispensed
      const finalStatus = dQty >= itemRow.quantity ? 'dispensed' : 'partially_dispensed';
      await client.query(`
        UPDATE prescription_items
        SET dispensed = true, dispensed_quantity = $1, dispense_status = $2, dispensed_at = now(), dispensed_by = $3
        WHERE id = $4
      `, [dQty, finalStatus, req.user.user_id, itemRow.id]);

      dispensedCount++;
    }

    // Determine overall prescription pharmacy status
    const postItemsRes = await client.query(`SELECT * FROM prescription_items WHERE prescription_id = $1`, [rxId]);
    const totalItems = postItemsRes.rows.length;
    const fullyDispensed = postItemsRes.rows.filter(i => i.dispense_status === 'dispensed').length;

    let overallStatus = 'partially_dispensed';
    if (fullyDispensed === totalItems) overallStatus = 'dispensed';

    await client.query(`UPDATE prescriptions SET pharmacy_status = $1 WHERE id = $2`, [overallStatus, rxId]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Dispensing', action: 'Complete Dispensing', recordId: rxId, newValue: { status: overallStatus, items_dispensed: dispensedCount } };
    return res.json(formatResponse(true, {
      prescription_id: rxId,
      pharmacy_status: overallStatus,
      dispensed_items_count: dispensedCount
    }, 'Prescription dispensing completed successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('completeDispensing error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function updateItemDispenseStatus(req, res) {
  try {
    const itemId = parseInt(req.params.item_id);
    const { dispense_status, hold_reason } = req.body;

    if (!dispense_status) {
      return res.status(400).json(formatResponse(false, null, 'dispense_status is required'));
    }

    const result = await db.query(`
      UPDATE prescription_items
      SET dispense_status = $1, hold_reason = $2
      WHERE id = $3 RETURNING *
    `, [dispense_status, hold_reason || null, itemId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Prescription item not found'));
    }

    return res.json(formatResponse(true, result.rows[0], 'Prescription item dispense status updated successfully'));
  } catch (err) {
    console.error('updateItemDispenseStatus error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 6. Prescription Clarification Workflow
// -------------------------------------------------------------
async function createClarification(req, res) {
  const client = await db.pool.connect();
  try {
    const { prescription_id, prescription_item_id, issue_type, description, priority, remarks } = req.body;
    if (!prescription_id || !issue_type || !description || !description.trim()) {
      return res.status(400).json(formatResponse(false, null, 'prescription_id, issue_type, and description are required'));
    }

    const validIssueTypes = [
      'medicine_unavailable', 'dosage_clarification', 'quantity_clarification',
      'prescription_error', 'duration_clarification', 'substitution_request', 'other'
    ];
    let mappedIssueType = issue_type;
    if (issue_type === 'dosage' || issue_type === 'potency') mappedIssueType = 'dosage_clarification';
    else if (issue_type === 'stock_unavailable') mappedIssueType = 'medicine_unavailable';
    else if (issue_type === 'interaction') mappedIssueType = 'other';
    else if (issue_type === 'substitution') mappedIssueType = 'substitution_request';

    if (!validIssueTypes.includes(mappedIssueType)) {
      return res.status(400).json(formatResponse(false, null, `Invalid issue_type. Must be one of: ${validIssueTypes.join(', ')}`));
    }

    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    let mappedPriority = (priority || 'normal').toLowerCase();
    if (mappedPriority === 'medium') mappedPriority = 'normal';
    if (!validPriorities.includes(mappedPriority)) {
      return res.status(400).json(formatResponse(false, null, `Invalid priority. Must be one of: ${validPriorities.join(', ')}`));
    }

    const branchId = req.user.branch_id || 1;

    await client.query('BEGIN');

    const rxRes = await client.query(`
      SELECT p.id, p.patient_id 
      FROM prescriptions p 
      WHERE p.id = $1
    `, [prescription_id]);

    if (rxRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription not found'));
    }

    const patientId = rxRes.rows[0].patient_id;

    if (prescription_item_id) {
      const itemCheck = await client.query(`
        SELECT id, medicine_id FROM prescription_items 
        WHERE id = $1 AND prescription_id = $2
      `, [prescription_item_id, prescription_id]);

      if (itemCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(formatResponse(false, null, 'Prescription item not found on this prescription'));
      }
    }

    const result = await client.query(`
      INSERT INTO prescription_clarifications (
        prescription_id, prescription_item_id, patient_id, raised_by,
        issue_type, description, priority, remarks, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5::clarification_issue_type, $6, $7::clarification_priority, $8, 'open', $9)
      RETURNING *
    `, [prescription_id, prescription_item_id || null, patientId, req.user.user_id, mappedIssueType, description.trim(), mappedPriority, remarks ? remarks.trim() : null, branchId]);

    if (prescription_item_id) {
      await client.query(`
        UPDATE prescription_items SET dispense_status = 'clarification_requested' WHERE id = $1
      `, [prescription_item_id]);
    }

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'Pharmacy Clarification', action: 'Create Clarification', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Prescription clarification request submitted to Doctor successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createClarification error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getClarifications(req, res) {
  try {
    const { status, priority, search } = req.query;
    const branchId = req.user.branch_id || 1;

    let query = `
      SELECT 
        pc.*, 
        pc.doctor_response as response,
        p.full_name as patient_name, 
        p.mobile_number,
        u.full_name as raised_by_name, 
        du.full_name as responded_by_name,
        doc_u.full_name as doctor_name,
        pr.appointment_id,
        pi.dosage as item_dosage,
        pi.quantity as item_quantity,
        pi.dispense_status as item_dispense_status,
        mm.medicine_name,
        mm.strength as medicine_strength
      FROM prescription_clarifications pc
      JOIN patients p ON pc.patient_id = p.patient_id
      JOIN users u ON pc.raised_by = u.user_id
      LEFT JOIN users du ON pc.responded_by = du.user_id
      LEFT JOIN prescriptions pr ON pc.prescription_id = pr.id
      LEFT JOIN doctors d ON pr.doctor_id = d.doctor_id
      LEFT JOIN users doc_u ON d.user_id = doc_u.user_id
      LEFT JOIN prescription_items pi ON pc.prescription_item_id = pi.id
      LEFT JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE pc.branch_id = $1
    `;
    const params = [branchId];

    if (status) {
      let mappedStatus = status.toLowerCase();
      if (mappedStatus === 'pending') mappedStatus = 'open';
      params.push(mappedStatus);
      query += ` AND pc.status = $${params.length}::clarification_status`;
    }

    if (priority) {
      let mappedPriority = priority.toLowerCase();
      if (mappedPriority === 'medium') mappedPriority = 'normal';
      params.push(mappedPriority);
      query += ` AND pc.priority = $${params.length}::clarification_priority`;
    }

    if (search && search.trim()) {
      const s = search.trim();
      params.push(`%${s}%`);
      const sIndex = params.length;
      if (!isNaN(s) && Number.isInteger(Number(s))) {
        params.push(parseInt(s));
        const numIndex = params.length;
        query += ` AND (p.full_name ILIKE $${sIndex} OR p.mobile_number ILIKE $${sIndex} OR doc_u.full_name ILIKE $${sIndex} OR mm.medicine_name ILIKE $${sIndex} OR pc.prescription_id = $${numIndex} OR pc.id = $${numIndex})`;
      } else {
        query += ` AND (p.full_name ILIKE $${sIndex} OR p.mobile_number ILIKE $${sIndex} OR doc_u.full_name ILIKE $${sIndex} OR mm.medicine_name ILIKE $${sIndex})`;
      }
    }

    query += ` ORDER BY pc.id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Prescription clarifications list retrieved successfully'));
  } catch (err) {
    console.error('getClarifications error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function closeClarification(req, res) {
  const client = await db.pool.connect();
  try {
    const cId = parseInt(req.params.id || req.body.clarification_id);
    const { remarks, resolution_notes } = req.body;
    const finalRemarks = remarks || resolution_notes || null;

    if (isNaN(cId)) {
      return res.status(400).json(formatResponse(false, null, 'Valid clarification ID is required'));
    }

    await client.query('BEGIN');

    const cCheck = await client.query(`SELECT * FROM prescription_clarifications WHERE id = $1`, [cId]);
    if (cCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Clarification request not found'));
    }

    const clar = cCheck.rows[0];

    const result = await client.query(`
      UPDATE prescription_clarifications
      SET status = 'closed', remarks = COALESCE($1, remarks)
      WHERE id = $2 RETURNING *
    `, [finalRemarks ? finalRemarks.trim() : null, cId]);

    // If linked to an item that was clarification_requested, unblock it for dispensing
    if (clar.prescription_item_id) {
      await client.query(`
        UPDATE prescription_items
        SET dispense_status = 'pending'
        WHERE id = $1 AND dispense_status = 'clarification_requested'
      `, [clar.prescription_item_id]);
    }

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'Pharmacy Clarification', action: 'Close Clarification', recordId: cId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Clarification request closed successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('closeClarification error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------
// 7. Inventory & Medicine Master
// -------------------------------------------------------------

// Helper to generate padded sequential medicine serial number (collision-proof)
async function generateMedicineSerial(client = null) {
  const runner = client || db;
  const countRes = await runner.query(`SELECT COUNT(*) as count FROM medicine_master`);
  let nextNum = parseInt(countRes.rows[0]?.count || 0) + 1;
  let candidate = `MED-${String(nextNum).padStart(5, '0')}`;

  let check = await runner.query(`SELECT 1 FROM medicine_master WHERE serial_number = $1`, [candidate]);
  while (check.rows.length > 0) {
    nextNum++;
    candidate = `MED-${String(nextNum).padStart(5, '0')}`;
    check = await runner.query(`SELECT 1 FROM medicine_master WHERE serial_number = $1`, [candidate]);
  }
  return candidate;
}

async function getNextMedicineSerial(req, res) {
  try {
    const nextSerial = await generateMedicineSerial();
    return res.json(formatResponse(true, { serial_number: nextSerial }, 'Next medicine serial number retrieved successfully'));
  } catch (err) {
    console.error('getNextMedicineSerial error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getMedicines(req, res) {
  try {
    const { search, category, status } = req.query;
    let query = `SELECT * FROM medicine_master WHERE 1=1`;
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (medicine_name ILIKE $${params.length} OR generic_name ILIKE $${params.length} OR serial_number ILIKE $${params.length} OR strength ILIKE $${params.length})`;
    }

    query += ` ORDER BY id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Medicine master list retrieved successfully'));
  } catch (err) {
    console.error('getMedicines error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createMedicine(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      medicine_name, 
      strength, 
      potency, 
      quantity,
      generic_name, 
      medicine_type, 
      unit, 
      category, 
      manufacturer, 
      reorder_level 
    } = req.body;

    if (!medicine_name || !medicine_name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Medicine Name is required'));
    }

    const medStrength = (strength || potency || '').trim();
    if (!medStrength) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Potency / Strength is required'));
    }

    let numQty = null;
    if (quantity !== undefined && quantity !== null && quantity !== '') {
      numQty = parseInt(quantity, 10);
      if (isNaN(numQty) || numQty < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Quantity must be a valid non-negative number (0 or greater)'));
      }
    }

    // Duplicate check: prevent duplicate medicine name + potency
    const dupCheck = await client.query(
      `SELECT id, serial_number, medicine_name, strength 
       FROM medicine_master 
       WHERE LOWER(TRIM(medicine_name)) = LOWER(TRIM($1)) 
         AND LOWER(TRIM(strength)) = LOWER(TRIM($2)) 
         AND status != 'deleted'`,
      [medicine_name.trim(), medStrength]
    );
    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(formatResponse(
        false,
        null,
        `Medicine "${medicine_name.trim()}" (${medStrength}) already exists in formulary with Serial Number ${dupCheck.rows[0].serial_number || `#${dupCheck.rows[0].id}`}.`
      ));
    }

    // Generate atomic sequential serial number
    const serialNumber = await generateMedicineSerial(client);

    const result = await client.query(`
      INSERT INTO medicine_master (
        serial_number, medicine_name, generic_name, medicine_type, strength, unit, category, manufacturer, reorder_level, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *
    `, [
      serialNumber,
      medicine_name.trim(),
      generic_name ? generic_name.trim() : null,
      medicine_type || 'dilution',
      medStrength,
      unit || 'pcs',
      category || 'General',
      manufacturer || null,
      reorder_level ? parseInt(reorder_level, 10) : 10
    ]);

    const createdMed = result.rows[0];

    // If optional quantity is provided and > 0, record initial stock
    if (numQty !== null && numQty > 0) {
      const branchId = req.user.branch_id || 1;
      const batchNum = `INIT-${createdMed.id}`;

      const stockRes = await client.query(`
        INSERT INTO medicine_stock (
          medicine_id, batch_number, expiry_date, quantity, branch_id, received_date
        ) VALUES ($1, $2, CURRENT_DATE + INTERVAL '2 years', $3, $4, CURRENT_DATE)
        ON CONFLICT (medicine_id, batch_number) 
        DO UPDATE SET quantity = medicine_stock.quantity + $3, updated_at = now()
        RETURNING *
      `, [createdMed.id, batchNum, numQty, branchId]);

      await client.query(`
        INSERT INTO stock_transactions (
          medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
        ) VALUES ($1, 'in', $2, $3, 'Initial stock on formulary creation', $4, $5)
      `, [createdMed.id, numQty, batchNum, req.user.user_id, branchId]);

      createdMed.initial_stock = stockRes.rows[0];
      createdMed.quantity = numQty;
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { 
      module: 'Pharmacy Master', 
      action: 'Create Medicine Master Item', 
      recordId: createdMed.id, 
      newValue: createdMed 
    };
    return res.status(201).json(formatResponse(true, createdMed, 'Medicine added to pharmacy formulary successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createMedicine error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function updateMedicine(req, res) {
  try {
    const medId = parseInt(req.params.id);
    const { medicine_name, generic_name, medicine_type, strength, unit, category, manufacturer, reorder_level, status } = req.body;

    const result = await db.query(`
      UPDATE medicine_master
      SET medicine_name = COALESCE($1, medicine_name),
          generic_name = COALESCE($2, generic_name),
          medicine_type = COALESCE($3, medicine_type),
          strength = COALESCE($4, strength),
          unit = COALESCE($5, unit),
          category = COALESCE($6, category),
          manufacturer = COALESCE($7, manufacturer),
          reorder_level = COALESCE($8, reorder_level),
          status = COALESCE($9, status)
      WHERE id = $10 RETURNING *
    `, [medicine_name, generic_name, medicine_type, strength, unit, category, manufacturer, reorder_level, status, medId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Medicine not found'));
    }

    res.locals.auditEntry = { module: 'Pharmacy Master', action: 'Update Medicine Master Item', recordId: medId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Medicine updated successfully'));
  } catch (err) {
    console.error('updateMedicine error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getMedicineStockDetail(req, res) {
  try {
    const medId = parseInt(req.params.id);
    const branchId = req.user.branch_id || 1;

    const medRes = await db.query(`SELECT * FROM medicine_master WHERE id = $1`, [medId]);
    if (medRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Medicine not found'));
    }

    const stockRes = await db.query(`
      SELECT * FROM medicine_stock WHERE medicine_id = $1 AND branch_id = $2 ORDER BY expiry_date ASC
    `, [medId, branchId]);

    return res.json(formatResponse(true, {
      medicine: medRes.rows[0],
      batches: stockRes.rows
    }, 'Medicine stock detail retrieved successfully'));
  } catch (err) {
    console.error('getMedicineStockDetail error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 7b. Pharmacy Master - Medicine Formulary Excel Import (Super Admin)
// -------------------------------------------------------------

const MEDICINE_IMPORT_ALIASES = {
  serial: [
    'sl.no', 'sl no', 's.no', 's no', 'sl number', 'sl. number',
    'serial number', 'serial no', 'serial.no', 'serial', 'number', 'id'
  ],
  medicine_name: [
    'm name', 'mname', 'medicine', 'medicine name', 'medicines',
    'medicine_name', 'drug', 'drug name', 'drugname', 'name'
  ],
  potency: [
    'potency', 'dosage', 'dose', 'strength',
    'potency / strength', 'potency/strength', 'potency strength'
  ],
  quantity: [
    'quantity', 'qty', 'q.t.y', 'qnty', 'quant', 'stock quantity'
  ]
};

function normalizeHeaderString(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[._\/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveMedicineImportHeaders(rawHeaders) {
  const aliasLookup = {};
  for (const [canonicalField, aliasList] of Object.entries(MEDICINE_IMPORT_ALIASES)) {
    for (const alias of aliasList) {
      aliasLookup[normalizeHeaderString(alias)] = canonicalField;
      aliasLookup[alias.toLowerCase().replace(/[^a-z0-9]/g, '')] = canonicalField;
    }
  }

  const detectedColumns = {}; // canonicalField -> array of raw header strings
  const headerToField = {};

  for (const raw of rawHeaders) {
    if (!raw) continue;
    const norm = normalizeHeaderString(raw);
    const compact = String(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
    const canonical = aliasLookup[norm] || aliasLookup[compact];

    if (canonical) {
      if (!detectedColumns[canonical]) {
        detectedColumns[canonical] = [];
      }
      detectedColumns[canonical].push(raw);
      headerToField[raw] = canonical;
    }
  }

  // Ambiguity check: Reject if multiple columns map to the same logical field
  for (const [field, headers] of Object.entries(detectedColumns)) {
    if (headers.length > 1) {
      const fieldDisplay =
        field === 'medicine_name' ? 'Medicine Name' :
        field === 'potency' ? 'Potency' :
        field === 'serial' ? 'Serial Number / Sl.No' : 'Quantity';
      return {
        error: `Ambiguous headers: Multiple columns (${headers.map(h => `"${h}"`).join(', ')}) matched the logical field "${fieldDisplay}". Please ensure only one column is provided for each field.`
      };
    }
  }

  // Required columns check: Medicine Name and Potency
  if (!detectedColumns.medicine_name || !detectedColumns.potency) {
    return {
      error: 'Required columns not found. Please provide Medicine Name and Potency.'
    };
  }

  return {
    success: true,
    detectedColumns: {
      serial: detectedColumns.serial ? detectedColumns.serial[0] : null,
      medicine_name: detectedColumns.medicine_name[0],
      potency: detectedColumns.potency[0],
      quantity: detectedColumns.quantity ? detectedColumns.quantity[0] : null
    },
    headerToField
  };
}

function parseMedicineWorkbook(fileBuffer) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    const err = new Error('Uploaded Excel file contains no worksheets.');
    err.status = 400;
    throw err;
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawSheetData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rawSheetData || rawSheetData.length === 0) {
    const err = new Error('Excel sheet is empty.');
    err.status = 400;
    throw err;
  }

  let headerRowIndex = -1;
  for (let r = 0; r < rawSheetData.length; r++) {
    const row = rawSheetData[r];
    if (row && row.some(cell => String(cell).trim() !== '')) {
      headerRowIndex = r;
      break;
    }
  }
  if (headerRowIndex === -1) {
    const err = new Error('Excel sheet contains no header row.');
    err.status = 400;
    throw err;
  }

  const rawHeaders = rawSheetData[headerRowIndex].map(h => String(h || '').trim()).filter(Boolean);
  const headerResolution = resolveMedicineImportHeaders(rawHeaders);
  if (headerResolution.error) {
    const err = new Error(headerResolution.error);
    err.status = 400;
    throw err;
  }

  const headerNames = rawSheetData[headerRowIndex];
  const { serial: serialCol, medicine_name: medCol, potency: potCol, quantity: qtyCol } = headerResolution.detectedColumns;

  const serialIdx = serialCol ? headerNames.indexOf(serialCol) : -1;
  const medIdx = headerNames.indexOf(medCol);
  const potIdx = headerNames.indexOf(potCol);
  const qtyIdx = qtyCol ? headerNames.indexOf(qtyCol) : -1;

  const dataRows = [];
  for (let r = headerRowIndex + 1; r < rawSheetData.length; r++) {
    const row = rawSheetData[r];
    if (!row || !row.some(cell => String(cell ?? '').trim() !== '')) {
      continue;
    }
    dataRows.push({
      rowNum: r + 1,
      sourceSerial: serialIdx >= 0 ? String(row[serialIdx] ?? '').trim() : '',
      medicineName: medIdx >= 0 ? String(row[medIdx] ?? '').trim() : '',
      potency: potIdx >= 0 ? String(row[potIdx] ?? '').trim() : '',
      quantityStr: qtyIdx >= 0 ? String(row[qtyIdx] ?? '').trim() : ''
    });
  }

  return {
    headerResolution,
    dataRows
  };
}

async function previewMedicineImport(req, res) {
  try {
    let parseResult;
    let fileName = 'medicine_import.xlsx';

    let file = req.file;
    if (!file && req.files && req.files.length > 0) {
      file = req.files.find((f) => f.fieldname === 'file') || req.files[0];
    }

    if (file && (file.buffer || file.path)) {
      fileName = file.originalname || 'medicine_import.xlsx';
      const buffer = file.buffer || (file.path ? require('fs').readFileSync(file.path) : null);
      if (!buffer) {
        return res.status(400).json(formatResponse(false, null, 'Uploaded file buffer could not be read'));
      }
      try {
        parseResult = parseMedicineWorkbook(buffer);
      } catch (err) {
        return res.status(err.status || 400).json(formatResponse(false, null, err.message));
      }
    } else {
      return res.status(400).json(formatResponse(false, null, 'Please upload an Excel (.xlsx/.xls) file'));
    }

    const { headerResolution, dataRows } = parseResult;
    const totalRows = dataRows.length;
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    const rowIssues = [];
    const validItems = [];

    // Load existing active medicines from DB
    const dbMedsRes = await db.query(
      `SELECT LOWER(TRIM(medicine_name)) as name, LOWER(TRIM(strength)) as strength, serial_number
       FROM medicine_master 
       WHERE status != 'deleted'`
    );
    const existingDbMap = new Map();
    for (const m of dbMedsRes.rows) {
      existingDbMap.set(`${m.name}|${m.strength}`, m.serial_number);
    }

    const inMemoryTracker = new Map();

    for (const item of dataRows) {
      const { rowNum, sourceSerial, medicineName, potency, quantityStr } = item;

      // 1. Missing Medicine Name
      if (!medicineName) {
        invalidRows++;
        rowIssues.push({
          row: rowNum,
          source_serial: sourceSerial || null,
          medicine_name: medicineName,
          potency: potency,
          quantity: quantityStr,
          status: 'invalid',
          reason: 'Medicine Name is missing'
        });
        continue;
      }

      // 2. Missing Potency
      if (!potency) {
        invalidRows++;
        rowIssues.push({
          row: rowNum,
          source_serial: sourceSerial || null,
          medicine_name: medicineName,
          potency: potency,
          quantity: quantityStr,
          status: 'invalid',
          reason: 'Potency is missing'
        });
        continue;
      }

      // 3. Validate Quantity if present
      let parsedQty = null;
      if (quantityStr !== '') {
        const num = Number(quantityStr);
        if (isNaN(num) || !Number.isInteger(num) || num < 0) {
          invalidRows++;
          rowIssues.push({
            row: rowNum,
            source_serial: sourceSerial || null,
            medicine_name: medicineName,
            potency: potency,
            quantity: quantityStr,
            status: 'invalid',
            reason: num < 0
              ? 'Quantity cannot be negative'
              : `Invalid quantity "${quantityStr}". Quantity must be a valid whole number`
          });
          continue;
        }
        parsedQty = num;
      }

      // 4. Duplicate check against existing DB
      const medKey = `${medicineName.toLowerCase()}|${potency.toLowerCase()}`;
      if (existingDbMap.has(medKey)) {
        duplicateRows++;
        rowIssues.push({
          row: rowNum,
          source_serial: sourceSerial || null,
          medicine_name: medicineName,
          potency: potency,
          quantity: parsedQty,
          status: 'duplicate',
          reason: `Medicine already exists in formulary (${existingDbMap.get(medKey) || 'active'})`
        });
        continue;
      }

      // 5. In-file duplicate check
      if (inMemoryTracker.has(medKey)) {
        duplicateRows++;
        rowIssues.push({
          row: rowNum,
          source_serial: sourceSerial || null,
          medicine_name: medicineName,
          potency: potency,
          quantity: parsedQty,
          status: 'duplicate',
          reason: `Duplicate row in uploaded file (matches row ${inMemoryTracker.get(medKey)})`
        });
        continue;
      }
      inMemoryTracker.set(medKey, rowNum);

      // Passed all checks
      validRows++;
      validItems.push({
        row: rowNum,
        source_serial: sourceSerial || null,
        medicine_name: medicineName,
        strength: potency,
        quantity: parsedQty
      });
    }

    return res.json(formatResponse(true, {
      file_name: fileName,
      total_rows: totalRows,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      duplicate_rows: duplicateRows,
      detected_columns: {
        serial: headerResolution.detectedColumns.serial || null,
        medicine_name: headerResolution.detectedColumns.medicine_name,
        potency: headerResolution.detectedColumns.potency,
        quantity: headerResolution.detectedColumns.quantity || null
      },
      row_issues: rowIssues,
      valid_items: validItems
    }, 'Formulary Excel import validated successfully'));
  } catch (err) {
    console.error('previewMedicineImport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function confirmMedicineImport(req, res) {
  const client = await db.pool.connect();
  try {
    let itemsToImport = [];
    let fileName = req.body.file_name || 'excel_import.xlsx';
    let rowIssues = [];
    let initialDuplicateCount = 0;
    let initialInvalidCount = 0;

    let file = req.file;
    if (!file && req.files && req.files.length > 0) {
      file = req.files.find((f) => f.fieldname === 'file') || req.files[0];
    }

    if (file && (file.buffer || file.path)) {
      fileName = file.originalname || 'excel_import.xlsx';
      const buffer = file.buffer || (file.path ? require('fs').readFileSync(file.path) : null);
      if (!buffer) {
        return res.status(400).json(formatResponse(false, null, 'Uploaded file buffer could not be read'));
      }
      const parseResult = parseMedicineWorkbook(buffer);
      const { dataRows } = parseResult;

      // Validate data rows
      const dbMeds = await client.query(
        `SELECT LOWER(TRIM(medicine_name)) as name, LOWER(TRIM(strength)) as strength, serial_number
         FROM medicine_master WHERE status != 'deleted'`
      );
      const existingDb = new Map();
      for (const m of dbMeds.rows) {
        existingDb.set(`${m.name}|${m.strength}`, m.serial_number);
      }
      const inMem = new Map();

      for (const itm of dataRows) {
        const { rowNum, sourceSerial, medicineName, potency, quantityStr } = itm;
        if (!medicineName) {
          initialInvalidCount++;
          rowIssues.push({ row: rowNum, reason: 'Medicine Name is missing' });
          continue;
        }
        if (!potency) {
          initialInvalidCount++;
          rowIssues.push({ row: rowNum, reason: 'Potency is missing' });
          continue;
        }
        let pQty = null;
        if (quantityStr !== '') {
          const num = Number(quantityStr);
          if (isNaN(num) || !Number.isInteger(num) || num < 0) {
            initialInvalidCount++;
            rowIssues.push({ row: rowNum, reason: num < 0 ? 'Quantity cannot be negative' : 'Invalid quantity' });
            continue;
          }
          pQty = num;
        }
        const k = `${medicineName.toLowerCase()}|${potency.toLowerCase()}`;
        if (existingDb.has(k)) {
          initialDuplicateCount++;
          rowIssues.push({ row: rowNum, reason: `Medicine already exists (${existingDb.get(k)})` });
          continue;
        }
        if (inMem.has(k)) {
          initialDuplicateCount++;
          rowIssues.push({ row: rowNum, reason: `Duplicate row in file (matches row ${inMem.get(k)})` });
          continue;
        }
        inMem.set(k, rowNum);
        itemsToImport.push({
          row: rowNum,
          source_serial: sourceSerial || null,
          medicine_name: medicineName,
          strength: potency,
          quantity: pQty
        });
      }
    } else if (Array.isArray(req.body.items)) {
      itemsToImport = req.body.items;
      rowIssues = Array.isArray(req.body.row_issues) ? req.body.row_issues : [];
      initialDuplicateCount = parseInt(req.body.duplicate_rows || 0);
      initialInvalidCount = parseInt(req.body.invalid_rows || 0);
    } else {
      return res.status(400).json(formatResponse(false, null, 'No items or file payload provided for import'));
    }

    if (itemsToImport.length === 0) {
      return res.status(400).json(formatResponse(false, null, 'No valid items to import'));
    }

    await client.query('BEGIN');

    // Fetch existing medicines in DB inside transaction to avoid concurrency conflicts
    const currentDbRes = await client.query(
      `SELECT LOWER(TRIM(medicine_name)) as name, LOWER(TRIM(strength)) as strength, serial_number
       FROM medicine_master
       WHERE status != 'deleted'`
    );
    const activeDbSet = new Map();
    for (const m of currentDbRes.rows) {
      activeDbSet.set(`${m.name}|${m.strength}`, m.serial_number);
    }

    const branchId = req.user.branch_id || 1;
    let successfullyImported = 0;
    let skippedDuplicates = initialDuplicateCount;
    let invalidCount = initialInvalidCount;
    const importedMedicines = [];
    const details = [...rowIssues];

    for (const item of itemsToImport) {
      const medName = String(item.medicine_name || '').trim();
      const potency = String(item.strength || item.potency || '').trim();
      const qty = item.quantity !== undefined && item.quantity !== null && item.quantity !== ''
        ? parseInt(item.quantity, 10)
        : null;

      if (!medName || !potency) {
        invalidCount++;
        details.push({
          row: item.row,
          medicine_name: medName,
          potency: potency,
          status: 'invalid',
          reason: 'Missing medicine name or potency'
        });
        continue;
      }

      if (qty !== null && (isNaN(qty) || qty < 0)) {
        invalidCount++;
        details.push({
          row: item.row,
          medicine_name: medName,
          potency: potency,
          status: 'invalid',
          reason: 'Invalid quantity'
        });
        continue;
      }

      const key = `${medName.toLowerCase()}|${potency.toLowerCase()}`;
      if (activeDbSet.has(key)) {
        skippedDuplicates++;
        details.push({
          row: item.row,
          medicine_name: medName,
          potency: potency,
          status: 'skipped',
          reason: `Medicine already exists in formulary (${activeDbSet.get(key) || 'active'})`
        });
        continue;
      }

      // Generate unique serial number using the application's existing generator
      const serialNumber = await generateMedicineSerial(client);

      const insRes = await client.query(`
        INSERT INTO medicine_master (
          serial_number, medicine_name, generic_name, medicine_type, strength, unit, category, manufacturer, reorder_level, status
        ) VALUES ($1, $2, null, 'dilution', $3, 'pcs', 'General', null, 10, 'active')
        RETURNING *
      `, [serialNumber, medName, potency]);

      const createdMed = insRes.rows[0];
      activeDbSet.set(key, serialNumber);

      // Create opening stock if qty > 0
      if (qty !== null && qty > 0) {
        const batchNum = `INIT-${createdMed.id}`;
        await client.query(`
          INSERT INTO medicine_stock (
            medicine_id, batch_number, expiry_date, quantity, branch_id, received_date
          ) VALUES ($1, $2, CURRENT_DATE + INTERVAL '2 years', $3, $4, CURRENT_DATE)
          ON CONFLICT (medicine_id, batch_number)
          DO UPDATE SET quantity = medicine_stock.quantity + $3, updated_at = now()
        `, [createdMed.id, batchNum, qty, branchId]);

        await client.query(`
          INSERT INTO stock_transactions (
            medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
          ) VALUES ($1, 'in', $2, $3, 'Initial stock on formulary import', $4, $5)
        `, [createdMed.id, qty, batchNum, req.user.user_id, branchId]);

        createdMed.quantity = qty;
      }

      successfullyImported++;
      importedMedicines.push(createdMed);
      details.push({
        row: item.row,
        source_serial: item.source_serial || null,
        medicine_name: medName,
        potency: potency,
        serial_number: serialNumber,
        quantity: qty,
        status: 'imported'
      });
    }

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Pharmacy Master',
      action: 'Import Medicine Formularies',
      recordId: null,
      newValue: {
        file_name: fileName,
        imported: successfullyImported,
        skipped: skippedDuplicates,
        invalid: invalidCount
      }
    };

    return res.status(201).json(formatResponse(true, {
      total_processed: itemsToImport.length + initialDuplicateCount + initialInvalidCount,
      successfully_imported: successfullyImported,
      skipped_duplicates: skippedDuplicates,
      invalid_rows: invalidCount,
      imported_medicines: importedMedicines,
      details
    }, 'Medicine formulary import completed successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('confirmMedicineImport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------
// 8. Manual Stock Entry & Excel Stock Import
// -------------------------------------------------------------
async function getStock(req, res) {
  try {
    const { low_stock, expiring, search } = req.query;
    const branchId = req.user.branch_id || 1;

    let query = `
      SELECT ms.*, mm.medicine_name, mm.generic_name, mm.strength, mm.unit, mm.reorder_level, mm.category
      FROM medicine_stock ms
      JOIN medicine_master mm ON ms.medicine_id = mm.id
      WHERE ms.branch_id = $1
    `;
    const params = [branchId];

    if (low_stock === 'true') {
      query += ` AND ms.quantity <= mm.reorder_level`;
    }

    if (expiring === 'true') {
      query += ` AND ms.expiry_date <= (CURRENT_DATE + INTERVAL '30 days') AND ms.quantity > 0`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (mm.medicine_name ILIKE $${params.length} OR mm.generic_name ILIKE $${params.length} OR ms.batch_number ILIKE $${params.length})`;
    }

    query += ` ORDER BY ms.expiry_date ASC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Medicine stock levels retrieved successfully'));
  } catch (err) {
    console.error('getStock error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function addStock(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { medicine_id, batch_number, manufacture_date, expiry_date, quantity, purchase_rate, mrp, supplier, invoice_number, remarks } = req.body;

    if (!medicine_id || !batch_number || !expiry_date || quantity === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'medicine_id, batch_number, expiry_date, and quantity are required'));
    }

    const mDate = manufacture_date ? new Date(manufacture_date) : null;
    const eDate = new Date(expiry_date);

    if (mDate && eDate <= mDate) {
      await client.query('ROLLBACK');
      return res.status(422).json(formatResponse(false, null, 'Validation failed: Expiry date must be after manufacture date'));
    }

    const branchId = req.user.branch_id || 1;
    const qty = parseInt(quantity);

    // Check existing stock by (medicine_id, batch_number)
    const existingRes = await client.query(`
      SELECT * FROM medicine_stock WHERE medicine_id = $1 AND batch_number = $2 AND branch_id = $3
    `, [medicine_id, batch_number, branchId]);

    let stockItem;
    if (existingRes.rows.length > 0) {
      const updateRes = await client.query(`
        UPDATE medicine_stock
        SET quantity = quantity + $1, updated_at = now()
        WHERE id = $2 RETURNING *
      `, [qty, existingRes.rows[0].id]);
      stockItem = updateRes.rows[0];
    } else {
      const insRes = await client.query(`
        INSERT INTO medicine_stock (
          medicine_id, batch_number, manufacture_date, expiry_date, quantity,
          purchase_rate, mrp, supplier, invoice_number, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        medicine_id, batch_number, manufacture_date || null, expiry_date, qty,
        purchase_rate || null, mrp || null, supplier || null, invoice_number || null, branchId
      ]);
      stockItem = insRes.rows[0];
    }

    // Record stock transaction
    await client.query(`
      INSERT INTO stock_transactions (
        medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
      ) VALUES ($1, 'in', $2, $3, $4, $5, $6)
    `, [medicine_id, qty, batch_number, remarks || 'Manual Add Stock', req.user.user_id, branchId]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Stock', action: 'Add Stock', recordId: stockItem.id, newValue: stockItem };
    return res.status(201).json(formatResponse(true, stockItem, 'Medicine stock added and transaction logged successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('addStock error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function previewStockImport(req, res) {
  try {
    let rows = [];
    let fileName = 'excel_import.xlsx';

    if (req.file) {
      fileName = req.file.originalname;
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (req.body.rows && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
      fileName = req.body.file_name || 'json_import.json';
    } else {
      return res.status(400).json(formatResponse(false, null, 'No file or rows payload provided for stock import'));
    }

    let totalRows = rows.length;
    let validRows = 0;
    let invalidRows = 0;
    let newMedicines = 0;
    let existingStock = 0;
    const failedReport = [];
    const batchTracker = new Set();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const medName = r['Medicine Name'] || r['medicine_name'] || r['Drug Name'];
      const potency = r['Potency'] || r['strength'] || r['Potency / Strength'] || 'Default';
      const batchNo = r['Batch Number'] || r['batch_number'] || r['Batch'];
      const mDateStr = r['Manufacture Date'] || r['manufacture_date'];
      const eDateStr = r['Expiry Date'] || r['expiry_date'];
      const qty = parseInt(r['Quantity'] || r['quantity'] || 0);

      // Row Validation Rules
      if (!medName || String(medName).trim() === '') {
        failedReport.push({ row: rowNum, reason: 'Missing medicine/drug name' });
        invalidRows++;
        continue;
      }
      if (!batchNo || String(batchNo).trim() === '') {
        failedReport.push({ row: rowNum, reason: 'Missing batch number' });
        invalidRows++;
        continue;
      }
      if (!qty || isNaN(qty) || qty <= 0) {
        failedReport.push({ row: rowNum, reason: 'Invalid or non-positive quantity' });
        invalidRows++;
        continue;
      }
      if (!eDateStr) {
        failedReport.push({ row: rowNum, reason: 'Missing expiry date' });
        invalidRows++;
        continue;
      }

      const eDate = new Date(eDateStr);
      const mDate = mDateStr ? new Date(mDateStr) : null;
      if (isNaN(eDate.getTime())) {
        failedReport.push({ row: rowNum, reason: 'Invalid expiry date format' });
        invalidRows++;
        continue;
      }
      if (mDate && !isNaN(mDate.getTime()) && eDate <= mDate) {
        failedReport.push({ row: rowNum, reason: 'Expiry date must be after manufacture date' });
        invalidRows++;
        continue;
      }

      const batchKey = `${medName}_${potency}_${batchNo}`.toLowerCase();
      if (batchTracker.has(batchKey)) {
        failedReport.push({ row: rowNum, reason: `Duplicate batch ${batchNo} for ${medName} within same file` });
        invalidRows++;
        continue;
      }
      batchTracker.add(batchKey);

      // Check existing drug master
      const drugRes = await db.query(`
        SELECT id FROM medicine_master WHERE LOWER(medicine_name) = LOWER($1)
      `, [medName]);

      if (drugRes.rows.length === 0) {
        newMedicines++;
      } else {
        const stockRes = await db.query(`
          SELECT id FROM medicine_stock WHERE medicine_id = $1 AND batch_number = $2
        `, [drugRes.rows[0].id, batchNo]);
        if (stockRes.rows.length > 0) {
          existingStock++;
        }
      }

      validRows++;
    }

    return res.json(formatResponse(true, {
      file_name: fileName,
      total_rows: totalRows,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      new_medicines_count: newMedicines,
      existing_stock_updates_count: existingStock,
      failed_rows_report: failedReport
    }, 'Stock import preview generated successfully'));
  } catch (err) {
    console.error('previewStockImport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function confirmStockImport(req, res) {
  const client = await db.pool.connect();
  try {
    const { file_name, rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json(formatResponse(false, null, 'rows payload array is required for import confirmation'));
    }

    await client.query('BEGIN');
    const branchId = req.user.branch_id || 1;

    let totalRows = rows.length;
    let validRows = 0;
    let invalidRows = 0;
    let newMedicines = 0;
    let existingStock = 0;
    const failedReport = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const medName = r['Medicine Name'] || r['medicine_name'] || r['Drug Name'];
      const potency = r['Potency'] || r['strength'] || r['Potency / Strength'] || 'Default';
      const batchNo = r['Batch Number'] || r['batch_number'] || r['Batch'];
      const mDateStr = r['Manufacture Date'] || r['manufacture_date'];
      const eDateStr = r['Expiry Date'] || r['expiry_date'];
      const qty = parseInt(r['Quantity'] || r['quantity'] || 0);

      if (!medName || !batchNo || !qty || qty <= 0 || !eDateStr) {
        failedReport.push({ row: rowNum, reason: 'Invalid or missing fields' });
        invalidRows++;
        continue;
      }

      // Check/Create Medicine Master
      let medRes = await client.query(`
        SELECT id FROM medicine_master WHERE LOWER(medicine_name) = LOWER($1)
      `, [medName]);

      let medId;
      if (medRes.rows.length === 0) {
        const newMedRes = await client.query(`
          INSERT INTO medicine_master (medicine_name, strength, unit, category, status)
          VALUES ($1, $2, $3, $4, 'active') RETURNING id
        `, [medName, potency, r['Unit'] || 'pcs', r['Category'] || 'General']);
        medId = newMedRes.rows[0].id;
        newMedicines++;
      } else {
        medId = medRes.rows[0].id;
      }

      // Check/Create Stock Batch
      const stockRes = await client.query(`
        SELECT id FROM medicine_stock WHERE medicine_id = $1 AND batch_number = $2 AND branch_id = $3
      `, [medId, batchNo, branchId]);

      const purchaseRate = parseFloat(r['Purchase Price'] || r['Purchase Rate'] || r['purchase_rate'] || r['purchase_price'] || 0) || null;
      const mrp = parseFloat(r['MRP'] || r['mrp'] || 0) || null;
      const supplier = r['Supplier'] || r['supplier'] || null;
      const invoiceNumber = r['Invoice Number'] || r['invoice_number'] || null;

      if (stockRes.rows.length > 0) {
        await client.query(`
          UPDATE medicine_stock
          SET quantity = quantity + $1,
              purchase_rate = COALESCE($2, purchase_rate),
              mrp = COALESCE($3, mrp),
              supplier = COALESCE($4, supplier),
              invoice_number = COALESCE($5, invoice_number),
              updated_at = now()
          WHERE id = $6
        `, [qty, purchaseRate, mrp, supplier, invoiceNumber, stockRes.rows[0].id]);
        existingStock++;
      } else {
        await client.query(`
          INSERT INTO medicine_stock (
            medicine_id, batch_number, manufacture_date, expiry_date, quantity,
            purchase_rate, mrp, supplier, invoice_number, branch_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [medId, batchNo, mDateStr || null, eDateStr, qty, purchaseRate, mrp, supplier, invoiceNumber, branchId]);
      }

      // Record transaction
      await client.query(`
        INSERT INTO stock_transactions (
          medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
        ) VALUES ($1, 'in', $2, $3, $4, $5, $6)
      `, [medId, qty, batchNo, `Excel Import: ${file_name || 'Stock'}`, req.user.user_id, branchId]);

      validRows++;
    }

    // Insert stock_import_batches record
    const batchRes = await client.query(`
      INSERT INTO stock_import_batches (
        imported_by, file_name, total_rows, valid_rows, invalid_rows,
        new_medicines_created, existing_stock_updated, failed_rows_report, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      req.user.user_id, file_name || 'excel_import.xlsx', totalRows, validRows, invalidRows,
      newMedicines, existingStock, JSON.stringify(failedReport), branchId
    ]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Import', action: 'Confirm Stock Import', recordId: batchRes.rows[0].batch_id, newValue: batchRes.rows[0] };
    return res.status(201).json(formatResponse(true, batchRes.rows[0], 'Excel stock import completed successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('confirmStockImport error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getImportHistory(req, res) {
  try {
    const result = await db.query(`
      SELECT ib.*, u.full_name as imported_by_name
      FROM stock_import_batches ib
      JOIN users u ON ib.imported_by = u.user_id
      ORDER BY ib.batch_id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Stock import history retrieved successfully'));
  } catch (err) {
    console.error('getImportHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getImportBatchDetail(req, res) {
  try {
    const batchId = parseInt(req.params.batch_id);
    const result = await db.query(`SELECT * FROM stock_import_batches WHERE batch_id = $1`, [batchId]);
    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Import batch record not found'));
    }
    return res.json(formatResponse(true, result.rows[0], 'Import batch detail retrieved successfully'));
  } catch (err) {
    console.error('getImportBatchDetail error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 9. Stock Alerts
// -------------------------------------------------------------
async function getLowStock(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const result = await db.query(`
      SELECT mm.id as medicine_id, mm.medicine_name, mm.generic_name, mm.strength as potency,
             mm.reorder_level, COALESCE(SUM(ms.quantity), 0) as available_quantity
      FROM medicine_master mm
      LEFT JOIN medicine_stock ms ON mm.id = ms.medicine_id AND ms.branch_id = $1 AND ms.expiry_date >= CURRENT_DATE
      WHERE mm.status = 'active'
      GROUP BY mm.id
      HAVING COALESCE(SUM(ms.quantity), 0) <= mm.reorder_level
      ORDER BY available_quantity ASC
    `, [branchId]);
    return res.json(formatResponse(true, result.rows, 'Low stock medicines retrieved successfully'));
  } catch (err) {
    console.error('getLowStock error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getExpiringStock(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const daysParam = req.query.days ? parseInt(req.query.days) : 30;

    const result = await db.query(`
      SELECT ms.*, mm.medicine_name, mm.generic_name, mm.strength as potency, mm.reorder_level
      FROM medicine_stock ms
      JOIN medicine_master mm ON ms.medicine_id = mm.id
      WHERE ms.branch_id = $1 AND ms.quantity > 0
        AND ms.expiry_date >= CURRENT_DATE
        AND ms.expiry_date <= (CURRENT_DATE + ($2 || ' days')::INTERVAL)
      ORDER BY ms.expiry_date ASC
    `, [branchId, daysParam]);
    return res.json(formatResponse(true, result.rows, 'Expiring stock batches retrieved successfully'));
  } catch (err) {
    console.error('getExpiringStock error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getExpiredStock(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const result = await db.query(`
      SELECT ms.*, mm.medicine_name, mm.generic_name, mm.strength as potency, mm.reorder_level
      FROM medicine_stock ms
      JOIN medicine_master mm ON ms.medicine_id = mm.id
      WHERE ms.branch_id = $1 AND ms.quantity > 0 AND ms.expiry_date < CURRENT_DATE
      ORDER BY ms.expiry_date ASC
    `, [branchId]);
    return res.json(formatResponse(true, result.rows, 'Expired stock batches retrieved successfully'));
  } catch (err) {
    console.error('getExpiredStock error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getOutOfStock(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const result = await db.query(`
      SELECT mm.id as medicine_id, mm.medicine_name, mm.generic_name, mm.strength as potency, mm.reorder_level
      FROM medicine_master mm
      LEFT JOIN medicine_stock ms ON mm.id = ms.medicine_id AND ms.branch_id = $1 AND ms.expiry_date >= CURRENT_DATE
      WHERE mm.status = 'active'
      GROUP BY mm.id
      HAVING COALESCE(SUM(ms.quantity), 0) = 0
      ORDER BY mm.medicine_name ASC
    `, [branchId]);
    return res.json(formatResponse(true, result.rows, 'Out of stock medicines retrieved successfully'));
  } catch (err) {
    console.error('getOutOfStock error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 10. Stock Transactions
// -------------------------------------------------------------
async function getStockTransactions(req, res) {
  try {
    const { medicine_id, batch_number, type, date, search } = req.query;
    const branchId = req.user.branch_id || 1;

    // Validate type parameter against known enum values to avoid PostgreSQL cast exception
    const validTypes = ['in', 'out', 'adjustment', 'return'];
    if (type && !validTypes.includes(type.toLowerCase())) {
      return res.json(formatResponse(true, [], 'Stock transactions log retrieved successfully'));
    }

    let query = `
      SELECT st.*, mm.medicine_name, mm.strength as potency, u.full_name as performed_by_name
      FROM stock_transactions st
      LEFT JOIN medicine_master mm ON st.medicine_id = mm.id
      LEFT JOIN users u ON st.performed_by = u.user_id
      WHERE st.branch_id = $1
    `;
    const params = [branchId];

    if (medicine_id) {
      params.push(medicine_id);
      query += ` AND st.medicine_id = $${params.length}`;
    }

    const searchTerm = search || batch_number;
    if (searchTerm && searchTerm.trim() !== '') {
      params.push(`%${searchTerm.trim()}%`);
      query += ` AND (st.batch_number ILIKE $${params.length} OR mm.medicine_name ILIKE $${params.length} OR st.reference ILIKE $${params.length})`;
    }

    if (type) {
      params.push(type.toLowerCase());
      query += ` AND st.transaction_type = $${params.length}::stock_txn_type`;
    }

    if (date) {
      params.push(date);
      query += ` AND DATE(st.created_at) = $${params.length}`;
    }

    query += ` ORDER BY st.id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Stock transactions log retrieved successfully'));
  } catch (err) {
    console.error('getStockTransactions error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 11. Stock Adjustments
// -------------------------------------------------------------
async function createStockAdjustment(req, res) {
  const client = await db.pool.connect();
  try {
    const { medicine_id, stock_id, physical_quantity, reason, remarks } = req.body;
    if (!medicine_id || !stock_id || physical_quantity === undefined || physical_quantity === null || !reason) {
      return res.status(400).json(formatResponse(false, null, 'medicine_id, stock_id, physical_quantity, and reason are required'));
    }

    const physQty = parseInt(physical_quantity, 10);
    if (isNaN(physQty) || physQty < 0) {
      return res.status(400).json(formatResponse(false, null, 'physical_quantity must be a non-negative integer'));
    }

    await client.query('BEGIN');
    const branchId = req.user.branch_id || 1;

    const stockRes = await client.query(`SELECT * FROM medicine_stock WHERE id = $1 FOR UPDATE`, [stock_id]);
    if (stockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Stock record not found'));
    }

    const stock = stockRes.rows[0];
    if (Number(stock.medicine_id) !== Number(medicine_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Stock batch does not match selected medicine'));
    }

    const sysQty = stock.quantity;
    const diff = physQty - sysQty;

    // Read threshold setting (default 10)
    const thresholdRes = await client.query(`SELECT setting_value FROM hospital_settings WHERE setting_key = 'pharmacy_adjustment_approval_threshold'`);
    const threshold = thresholdRes.rows.length > 0 ? parseInt(thresholdRes.rows[0].setting_value, 10) : 10;

    const requiresApproval = Math.abs(diff) > threshold;
    const approvalStatus = requiresApproval ? 'pending' : 'approved';

    const adjRes = await client.query(`
      INSERT INTO stock_adjustments (
        medicine_id, stock_id, system_quantity, physical_quantity, difference,
        reason, remarks, requires_approval, approval_status, performed_by, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      medicine_id, stock_id, sysQty, physQty, diff,
      reason, remarks || null, requiresApproval, approvalStatus, req.user.user_id, branchId
    ]);

    if (!requiresApproval) {
      // Auto-apply stock quantity update immediately
      await client.query(`
        UPDATE medicine_stock SET quantity = $1, updated_at = now() WHERE id = $2
      `, [physQty, stock_id]);

      // Record transaction
      await client.query(`
        INSERT INTO stock_transactions (
          medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
        ) VALUES ($1, 'adjustment', $2, $3, $4, $5, $6)
      `, [medicine_id, diff, stock.batch_number, `Adjustment: ${reason}`, req.user.user_id, branchId]);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Adjustment', action: 'Create Stock Adjustment', recordId: adjRes.rows[0].id, newValue: adjRes.rows[0] };
    return res.status(201).json(formatResponse(true, adjRes.rows[0], requiresApproval ? 'Stock adjustment requested and pending Super Admin approval' : 'Stock adjustment applied successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createStockAdjustment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getStockAdjustments(req, res) {
  try {
    const { status, search, date } = req.query;
    const branchId = req.user?.branch_id || 1;
    let query = `
      SELECT sa.*, 
             mm.medicine_name, 
             mm.strength as potency, 
             ms.batch_number, 
             u.full_name as performed_by_name,
             u2.full_name as approved_by_name
      FROM stock_adjustments sa
      LEFT JOIN medicine_master mm ON sa.medicine_id = mm.id
      LEFT JOIN medicine_stock ms ON sa.stock_id = ms.id
      LEFT JOIN users u ON sa.performed_by = u.user_id
      LEFT JOIN users u2 ON sa.approved_by = u2.user_id
      WHERE sa.branch_id = $1
    `;
    const params = [branchId];

    if (status) {
      params.push(status);
      query += ` AND sa.approval_status = $${params.length}::reset_status`;
    }

    if (date) {
      params.push(date);
      query += ` AND DATE(sa.created_at) = $${params.length}`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      const isNum = !isNaN(Number(search.trim()));
      params.push(term);
      const termIdx = params.length;

      if (isNum) {
        params.push(Number(search.trim()));
        const numIdx = params.length;
        query += ` AND (
          mm.medicine_name ILIKE $${termIdx} OR
          ms.batch_number ILIKE $${termIdx} OR
          sa.reason ILIKE $${termIdx} OR
          u.full_name ILIKE $${termIdx} OR
          sa.id = $${numIdx}
        )`;
      } else {
        query += ` AND (
          mm.medicine_name ILIKE $${termIdx} OR
          ms.batch_number ILIKE $${termIdx} OR
          sa.reason ILIKE $${termIdx} OR
          u.full_name ILIKE $${termIdx}
        )`;
      }
    }

    query += ` ORDER BY sa.id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Stock adjustments retrieved successfully'));
  } catch (err) {
    console.error('getStockAdjustments error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function approveStockAdjustment(req, res) {
  const client = await db.pool.connect();
  try {
    const adjId = parseInt(req.params.id, 10);
    await client.query('BEGIN');

    const adjRes = await client.query(`SELECT * FROM stock_adjustments WHERE id = $1 FOR UPDATE`, [adjId]);
    if (adjRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Stock adjustment request not found'));
    }

    const adj = adjRes.rows[0];
    if (adj.approval_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Adjustment is already ${adj.approval_status}`));
    }

    // Apply stock quantity update
    await client.query(`
      UPDATE medicine_stock SET quantity = $1, updated_at = now() WHERE id = $2
    `, [adj.physical_quantity, adj.stock_id]);

    // Update adjustment status
    const updatedRes = await client.query(`
      UPDATE stock_adjustments
      SET approval_status = 'approved', approved_by = $1
      WHERE id = $2 RETURNING *
    `, [req.user.user_id, adjId]);

    // Get batch number
    const stockRes = await client.query(`SELECT batch_number FROM medicine_stock WHERE id = $1`, [adj.stock_id]);
    const batchNo = stockRes.rows.length > 0 ? stockRes.rows[0].batch_number : null;

    // Log transaction
    await client.query(`
      INSERT INTO stock_transactions (
        medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
      ) VALUES ($1, 'adjustment', $2, $3, $4, $5, $6)
    `, [adj.medicine_id, adj.difference, batchNo, `Approved Adjustment #${adjId}`, req.user.user_id, adj.branch_id]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Adjustment', action: 'Approve Stock Adjustment', recordId: adjId, newValue: updatedRes.rows[0] };
    return res.json(formatResponse(true, updatedRes.rows[0], 'Stock adjustment approved and stock updated successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approveStockAdjustment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function rejectStockAdjustment(req, res) {
  const client = await db.pool.connect();
  try {
    const adjId = parseInt(req.params.id, 10);
    await client.query('BEGIN');

    const adjRes = await client.query(`SELECT * FROM stock_adjustments WHERE id = $1 FOR UPDATE`, [adjId]);
    if (adjRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Stock adjustment request not found'));
    }

    const adj = adjRes.rows[0];
    if (adj.approval_status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Adjustment is already ${adj.approval_status}`));
    }

    // Update adjustment status to rejected without modifying stock
    const updatedRes = await client.query(`
      UPDATE stock_adjustments
      SET approval_status = 'rejected', approved_by = $1
      WHERE id = $2 RETURNING *
    `, [req.user.user_id, adjId]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Adjustment', action: 'Reject Stock Adjustment', recordId: adjId, newValue: updatedRes.rows[0] };
    return res.json(formatResponse(true, updatedRes.rows[0], 'Stock adjustment rejected'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('rejectStockAdjustment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------
// 12. Medicine Returns
// -------------------------------------------------------------
async function createMedicineReturn(req, res) {
  const client = await db.pool.connect();
  try {
    const { patient_id, prescription_id, medicine_id, stock_id, return_quantity, return_reason, condition, remarks } = req.body;
    if (!patient_id || !medicine_id || !stock_id || return_quantity === undefined || return_quantity === null || !return_reason || !condition) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, medicine_id, stock_id, return_quantity, return_reason, and condition are required'));
    }

    const rQty = parseInt(return_quantity, 10);
    if (isNaN(rQty) || rQty <= 0) {
      return res.status(400).json(formatResponse(false, null, 'return_quantity must be a positive integer'));
    }

    const validConditions = ['good', 'damaged', 'expired', 'opened'];
    if (!validConditions.includes(condition)) {
      return res.status(400).json(formatResponse(false, null, `condition must be one of: ${validConditions.join(', ')}`));
    }

    await client.query('BEGIN');
    const branchId = req.user.branch_id || 1;

    // Validate patient
    const patientCheck = await client.query(`SELECT patient_id FROM patients WHERE patient_id = $1`, [patient_id]);
    if (patientCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Patient not found'));
    }

    // Validate stock and medicine association
    const stockRes = await client.query(`SELECT id, medicine_id, batch_number FROM medicine_stock WHERE id = $1`, [stock_id]);
    if (stockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Stock batch not found'));
    }

    if (Number(stockRes.rows[0].medicine_id) !== Number(medicine_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Stock batch does not match selected medicine'));
    }
    const batchNo = stockRes.rows[0].batch_number;

    // Policy check: restocked true ONLY if condition === 'good'
    const isRestocked = condition === 'good';

    const returnRes = await client.query(`
      INSERT INTO medicine_returns (
        patient_id, prescription_id, medicine_id, stock_id, return_quantity,
        return_reason, condition, restocked, remarks, processed_by, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      patient_id, prescription_id || null, medicine_id, stock_id, rQty,
      return_reason, condition, isRestocked, remarks || null, req.user.user_id, branchId
    ]);

    if (isRestocked) {
      await client.query(`
        UPDATE medicine_stock SET quantity = quantity + $1, updated_at = now() WHERE id = $2
      `, [rQty, stock_id]);

      await client.query(`
        INSERT INTO stock_transactions (
          medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
        ) VALUES ($1, 'return', $2, $3, $4, $5, $6)
      `, [medicine_id, rQty, batchNo, `Return: ${return_reason}`, req.user.user_id, branchId]);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Returns', action: 'Create Return', recordId: returnRes.rows[0].id, newValue: returnRes.rows[0] };
    return res.status(201).json(formatResponse(true, returnRes.rows[0], 'Medicine return logged successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createMedicineReturn error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getMedicineReturns(req, res) {
  try {
    const { patient_id, search, date, condition } = req.query;
    const branchId = req.user?.branch_id || 1;
    let query = `
      SELECT mr.*, 
             p.full_name as patient_name, 
             mm.medicine_name, 
             mm.strength as medicine_strength,
             ms.batch_number, 
             u.full_name as processed_by_name
      FROM medicine_returns mr
      LEFT JOIN patients p ON mr.patient_id = p.patient_id
      LEFT JOIN medicine_master mm ON mr.medicine_id = mm.id
      LEFT JOIN medicine_stock ms ON mr.stock_id = ms.id
      LEFT JOIN users u ON mr.processed_by = u.user_id
      WHERE mr.branch_id = $1
    `;
    const params = [branchId];

    if (patient_id) {
      params.push(patient_id);
      query += ` AND mr.patient_id = $${params.length}`;
    }

    if (condition) {
      params.push(condition);
      query += ` AND mr.condition = $${params.length}`;
    }

    if (date) {
      params.push(date);
      query += ` AND DATE(mr.created_at) = $${params.length}`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      const isNum = !isNaN(Number(search.trim()));
      params.push(term);
      const termIdx = params.length;

      if (isNum) {
        params.push(Number(search.trim()));
        const numIdx = params.length;
        query += ` AND (
          p.full_name ILIKE $${termIdx} OR
          mm.medicine_name ILIKE $${termIdx} OR
          ms.batch_number ILIKE $${termIdx} OR
          mr.return_reason ILIKE $${termIdx} OR
          mr.id = $${numIdx} OR
          mr.patient_id = $${numIdx}
        )`;
      } else {
        query += ` AND (
          p.full_name ILIKE $${termIdx} OR
          mm.medicine_name ILIKE $${termIdx} OR
          ms.batch_number ILIKE $${termIdx} OR
          mr.return_reason ILIKE $${termIdx}
        )`;
      }
    }

    query += ` ORDER BY mr.id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Medicine returns log retrieved successfully'));
  } catch (err) {
    console.error('getMedicineReturns error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 13. Dispensing History & Patient Search
// -------------------------------------------------------------
async function getDispensingHistory(req, res) {
  try {
    const { prescription_id, patient_id, registration_id, patient_name, mobile, doctor_id, date, status, search } = req.query;

    let query = `
      SELECT p.id as prescription_id, p.patient_id, p.doctor_id, p.created_at as prescription_date,
             COALESCE(p.pharmacy_status, 'pending'::pharmacy_status_enum) as status,
             pt.full_name as patient_name, pt.mobile_number, pt.patient_id as registration_id,
             u.full_name as doctor_name,
             COALESCE(
               (
                 SELECT json_agg(json_build_object(
                   'item_id', pi.id,
                   'medicine_name', mm.medicine_name,
                   'potency', mm.strength,
                   'dosage', pi.dosage,
                   'quantity', pi.quantity,
                   'dispensed', pi.dispensed,
                   'dispensed_quantity', pi.dispensed_quantity,
                   'dispense_status', pi.dispense_status,
                   'batch_number', ms.batch_number
                 ))
                 FROM prescription_items pi
                 JOIN medicine_master mm ON pi.medicine_id = mm.id
                 LEFT JOIN medicine_stock ms ON pi.selected_batch_id = ms.id
                 WHERE pi.prescription_id = p.id
               ),
               '[]'::json
             ) as items
      FROM prescriptions p
      JOIN patients pt ON p.patient_id = pt.patient_id
      JOIN doctors d ON p.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (prescription_id) {
      params.push(prescription_id);
      query += ` AND p.id = $${params.length}`;
    }
    if (patient_id) {
      params.push(patient_id);
      query += ` AND p.patient_id = $${params.length}`;
    }
    if (registration_id) {
      params.push(registration_id);
      query += ` AND pt.patient_id = $${params.length}`;
    }
    if (patient_name) {
      params.push(`%${patient_name}%`);
      query += ` AND pt.full_name ILIKE $${params.length}`;
    }
    if (mobile) {
      params.push(`%${mobile}%`);
      query += ` AND pt.mobile_number ILIKE $${params.length}`;
    }
    if (doctor_id) {
      params.push(doctor_id);
      query += ` AND p.doctor_id = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND DATE(p.created_at) = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND p.pharmacy_status = $${params.length}::pharmacy_status_enum`;
    }
    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (pt.full_name ILIKE $${params.length} OR pt.mobile_number ILIKE $${params.length} OR CAST(p.id AS TEXT) ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
    }

    query += ` ORDER BY p.id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Dispensing history retrieved successfully'));
  } catch (err) {
    console.error('getDispensingHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function searchPatients(req, res) {
  try {
    const { patient_id, registration_id, name, mobile, prescription_id, search, q } = req.query;

    let query = `
      SELECT DISTINCT pt.patient_id, COALESCE(pt.registration_id, CAST(pt.patient_id AS TEXT)) as registration_id,
             pt.full_name, pt.mobile_number, pt.age, pt.gender, pt.address, pt.village, pt.mandal, pt.patient_type
      FROM patients pt
      LEFT JOIN prescriptions p ON pt.patient_id = p.patient_id
      WHERE 1=1
    `;
    const params = [];

    if (patient_id) {
      params.push(patient_id);
      query += ` AND pt.patient_id = $${params.length}`;
    }
    if (registration_id) {
      params.push(registration_id);
      query += ` AND pt.patient_id = $${params.length}`;
    }
    if (name) {
      params.push(`%${name}%`);
      query += ` AND pt.full_name ILIKE $${params.length}`;
    }
    if (mobile) {
      params.push(`%${mobile}%`);
      query += ` AND pt.mobile_number ILIKE $${params.length}`;
    }
    if (prescription_id) {
      params.push(prescription_id);
      query += ` AND p.id = $${params.length}`;
    }
    const generalSearch = search || q;
    if (generalSearch && generalSearch.trim() !== '') {
      params.push(`%${generalSearch.trim()}%`);
      query += ` AND (pt.full_name ILIKE $${params.length} OR pt.mobile_number ILIKE $${params.length} OR CAST(pt.patient_id AS TEXT) ILIKE $${params.length})`;
    }

    query += ` LIMIT 50`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Pharmacy patient search results retrieved successfully (excluding doctor notes)'));
  } catch (err) {
    console.error('searchPatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 14. Pharmacy Profile
// -------------------------------------------------------------
async function getProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const result = await db.query(`
      SELECT u.user_id, u.employee_id, u.full_name, u.username, u.mobile_number, u.email,
             u.role, u.status, u.branch_id, b.branch_name, b.branch_code,
             u.department, u.designation, u.created_at, u.last_login_at
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      WHERE u.user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User profile not found'));
    }

    return res.json(formatResponse(true, result.rows[0], 'Pharmacy profile retrieved successfully'));
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.user_id;
    let { full_name, mobile_number, email } = req.body;

    if (full_name !== undefined) {
      full_name = String(full_name).trim();
      if (!full_name) {
        return res.status(400).json(formatResponse(false, null, 'Full name cannot be empty'));
      }
    }

    if (mobile_number !== undefined && mobile_number !== null) {
      mobile_number = String(mobile_number).trim();
      if (mobile_number && !/^\d{10,15}$/.test(mobile_number)) {
        return res.status(400).json(formatResponse(false, null, 'Invalid mobile number format. Must be 10 to 15 digits'));
      }
    }

    if (email !== undefined && email !== null) {
      email = String(email).trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json(formatResponse(false, null, 'Invalid email format'));
      }
    }

    const result = await db.query(`
      UPDATE users
      SET full_name = COALESCE($1, full_name),
          mobile_number = COALESCE($2, mobile_number),
          email = COALESCE($3, email),
          updated_at = now()
      WHERE user_id = $4
      RETURNING user_id, employee_id, full_name, username, mobile_number, email, role, status, branch_id, department, designation
    `, [full_name !== undefined ? full_name : null, mobile_number !== undefined ? mobile_number : null, email !== undefined ? email : null, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'User profile not found'));
    }

    const branchRes = await db.query(`
      SELECT branch_name, branch_code FROM branches WHERE branch_id = $1
    `, [result.rows[0].branch_id]);

    const enriched = {
      ...result.rows[0],
      branch_name: branchRes.rows[0]?.branch_name || null,
      branch_code: branchRes.rows[0]?.branch_code || null,
    };

    res.locals.auditEntry = { module: 'Pharmacy Profile', action: 'Update Profile', recordId: userId, newValue: enriched };
    return res.json(formatResponse(true, enriched, 'Pharmacy profile updated successfully'));
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// Legacy Functions (Re-exported)
// -------------------------------------------------------------
async function createPrescription(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_id, doctor_id, appointment_id, items } = req.body;

    if (!patient_id || !doctor_id || !items || !Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_id, doctor_id, and prescription items array are required'));
    }

    const rxRes = await client.query(`
      INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, pharmacy_status)
      VALUES ($1, $2, $3, 'pending') RETURNING *
    `, [patient_id, doctor_id, appointment_id || null]);

    const rx = rxRes.rows[0];
    const createdItems = [];

    for (const item of items) {
      const itemRes = await client.query(`
        INSERT INTO prescription_items (
          prescription_id, medicine_id, dosage, frequency, duration_days, quantity, dispense_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *
      `, [rx.id, item.medicine_id, item.dosage || '1-0-1', item.frequency || '2/day', item.duration_days || 5, item.quantity || 10]);
      createdItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');
    return res.status(201).json(formatResponse(true, { prescription: rx, items: createdItems }, 'Prescription created successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createPrescription error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function dispensePrescription(req, res) {
  return completeDispensing(req, res);
}

module.exports = {
  blockClinicalModification,
  blockProhibitedAction,
  getDashboard,
  getPrescriptionQueue,
  processPrescription,
  modifyPrescriptionItemDays,
  getItemModifications,
  checkPrescriptionStock,
  getMedicineBatches,
  selectBatch,
  saveDispenseDraft,
  completeDispensing,
  updateItemDispenseStatus,
  createClarification,
  getClarifications,
  closeClarification,
  getMedicines,
  getNextMedicineSerial,
  createMedicine,
  updateMedicine,
  getMedicineStockDetail,
  previewMedicineImport,
  confirmMedicineImport,
  getStock,
  addStock,
  previewStockImport,
  confirmStockImport,
  getImportHistory,
  getImportBatchDetail,
  getLowStock,
  getExpiringStock,
  getExpiredStock,
  getOutOfStock,
  getStockTransactions,
  createStockAdjustment,
  getStockAdjustments,
  approveStockAdjustment,
  rejectStockAdjustment,
  createMedicineReturn,
  getMedicineReturns,
  getDispensingHistory,
  searchPatients,
  getProfile,
  updateProfile,
  createPrescription,
  dispensePrescription
};
