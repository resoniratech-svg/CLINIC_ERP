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
      SELECT COUNT(*) FROM prescriptions p
      JOIN appointments a ON p.appointment_id = a.appointment_id
      WHERE a.status = 'pro_completed' AND (p.pharmacy_status = 'pending' OR p.pharmacy_status IS NULL)
    `);
    const pendingRx = parseInt(pendingRxRes.rows[0].count);

    const processingRes = await db.query(`
      SELECT COUNT(*) FROM prescriptions p
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
    const { status } = req.query;
    let query = `
      SELECT p.id as prescription_id, p.patient_id, p.doctor_id, p.created_at as prescription_date,
             COALESCE(p.pharmacy_status, 'pending'::pharmacy_status_enum) as pharmacy_status,
             pt.full_name as patient_name, pt.mobile_number,
             pt.patient_id as registration_id,
             u.full_name as doctor_name,
             a.appointment_id as token_no,
             a.status as appointment_status,
             'pro_completed' as pro_status,
             b.status as payment_status
      FROM prescriptions p
      JOIN appointments a ON p.appointment_id = a.appointment_id
      JOIN patients pt ON p.patient_id = pt.patient_id
      JOIN doctors d ON p.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      LEFT JOIN bills b ON p.patient_id = b.patient_id AND b.bill_type = 'treatment'
      WHERE a.status = 'pro_completed'
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND p.pharmacy_status = $${params.length}`;
    }

    query += ` ORDER BY p.id DESC`;
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
    if (!prescription_id || !issue_type || !description) {
      return res.status(400).json(formatResponse(false, null, 'prescription_id, issue_type, and description are required'));
    }

    await client.query('BEGIN');

    const rxRes = await client.query(`SELECT patient_id FROM prescriptions WHERE id = $1`, [prescription_id]);
    if (rxRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription not found'));
    }

    const patientId = rxRes.rows[0].patient_id;

    const result = await client.query(`
      INSERT INTO prescription_clarifications (
        prescription_id, prescription_item_id, patient_id, raised_by,
        issue_type, description, priority, remarks, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', 1)
      RETURNING *
    `, [prescription_id, prescription_item_id || null, patientId, req.user.user_id, issue_type, description, priority || 'normal', remarks || null]);

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
    const { status, priority } = req.query;
    let query = `
      SELECT pc.*, p.full_name as patient_name, u.full_name as raised_by_name, du.full_name as responded_by_name
      FROM prescription_clarifications pc
      JOIN patients p ON pc.patient_id = p.patient_id
      JOIN users u ON pc.raised_by = u.user_id
      LEFT JOIN users du ON pc.responded_by = du.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND pc.status = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      query += ` AND pc.priority = $${params.length}`;
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
  try {
    const cId = parseInt(req.params.id || req.body.clarification_id);
    const { remarks } = req.body;

    const result = await db.query(`
      UPDATE prescription_clarifications
      SET status = 'closed', remarks = COALESCE($1, remarks)
      WHERE id = $2 RETURNING *
    `, [remarks || null, cId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Clarification request not found'));
    }

    return res.json(formatResponse(true, result.rows[0], 'Clarification request closed successfully'));
  } catch (err) {
    console.error('closeClarification error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// -------------------------------------------------------------
// 7. Inventory & Medicine Master
// -------------------------------------------------------------
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
      query += ` AND (medicine_name ILIKE $${params.length} OR generic_name ILIKE $${params.length})`;
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
  try {
    const { medicine_name, generic_name, medicine_type, strength, unit, category, manufacturer, reorder_level } = req.body;
    if (!medicine_name) {
      return res.status(400).json(formatResponse(false, null, 'medicine_name is required'));
    }

    const result = await db.query(`
      INSERT INTO medicine_master (
        medicine_name, generic_name, medicine_type, strength, unit, category, manufacturer, reorder_level, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
      RETURNING *
    `, [
      medicine_name, generic_name || null, medicine_type || null, strength || null,
      unit || 'pcs', category || 'General', manufacturer || null, reorder_level || 10
    ]);

    res.locals.auditEntry = { module: 'Pharmacy Master', action: 'Create Medicine Master Item', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Medicine master item created successfully'));
  } catch (err) {
    console.error('createMedicine error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
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
// 8. Manual Stock Entry & Excel Stock Import
// -------------------------------------------------------------
async function getStock(req, res) {
  try {
    const { low_stock, expiring } = req.query;
    const branchId = req.user.branch_id || 1;

    let query = `
      SELECT ms.*, mm.medicine_name, mm.generic_name, mm.unit, mm.reorder_level, mm.category
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

      if (stockRes.rows.length > 0) {
        await client.query(`
          UPDATE medicine_stock SET quantity = quantity + $1, updated_at = now() WHERE id = $2
        `, [qty, stockRes.rows[0].id]);
        existingStock++;
      } else {
        await client.query(`
          INSERT INTO medicine_stock (
            medicine_id, batch_number, manufacture_date, expiry_date, quantity, branch_id
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [medId, batchNo, mDateStr || null, eDateStr, qty, branchId]);
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
      SELECT ms.*, mm.medicine_name, mm.generic_name, mm.strength as potency
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
      SELECT ms.*, mm.medicine_name, mm.generic_name, mm.strength as potency
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
    const { medicine_id, batch_number, type, date } = req.query;
    const branchId = req.user.branch_id || 1;

    let query = `
      SELECT st.*, mm.medicine_name, mm.strength as potency, u.full_name as performed_by_name
      FROM stock_transactions st
      JOIN medicine_master mm ON st.medicine_id = mm.id
      JOIN users u ON st.performed_by = u.user_id
      WHERE st.branch_id = $1
    `;
    const params = [branchId];

    if (medicine_id) {
      params.push(medicine_id);
      query += ` AND st.medicine_id = $${params.length}`;
    }
    if (batch_number) {
      params.push(batch_number);
      query += ` AND st.batch_number = $${params.length}`;
    }
    if (type) {
      params.push(type);
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
    if (!medicine_id || !stock_id || physical_quantity === undefined || !reason) {
      return res.status(400).json(formatResponse(false, null, 'medicine_id, stock_id, physical_quantity, and reason are required'));
    }

    await client.query('BEGIN');
    const branchId = req.user.branch_id || 1;

    const stockRes = await client.query(`SELECT * FROM medicine_stock WHERE id = $1 FOR UPDATE`, [stock_id]);
    if (stockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Stock record not found'));
    }

    const stock = stockRes.rows[0];
    const sysQty = stock.quantity;
    const physQty = parseInt(physical_quantity);
    const diff = physQty - sysQty;

    // Read threshold setting (default 10)
    const thresholdRes = await client.query(`SELECT setting_value FROM hospital_settings WHERE setting_key = 'pharmacy_adjustment_approval_threshold'`);
    const threshold = thresholdRes.rows.length > 0 ? parseInt(thresholdRes.rows[0].setting_value) : 10;

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
    const { status } = req.query;
    let query = `
      SELECT sa.*, mm.medicine_name, mm.strength as potency, ms.batch_number, u.full_name as performed_by_name
      FROM stock_adjustments sa
      JOIN medicine_master mm ON sa.medicine_id = mm.id
      JOIN medicine_stock ms ON sa.stock_id = ms.id
      JOIN users u ON sa.performed_by = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND sa.approval_status = $${params.length}::reset_status`;
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
    const adjId = parseInt(req.params.id);
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

// -------------------------------------------------------------
// 12. Medicine Returns
// -------------------------------------------------------------
async function createMedicineReturn(req, res) {
  const client = await db.pool.connect();
  try {
    const { patient_id, prescription_id, medicine_id, stock_id, return_quantity, return_reason, condition, remarks } = req.body;
    if (!patient_id || !medicine_id || !stock_id || !return_quantity || !return_reason || !condition) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, medicine_id, stock_id, return_quantity, return_reason, and condition are required'));
    }

    await client.query('BEGIN');
    const branchId = req.user.branch_id || 1;
    const rQty = parseInt(return_quantity);

    // Policy check: restocked true ONLY if condition === 'good'
    const isRestocked = condition === 'good';

    const stockRes = await client.query(`SELECT batch_number FROM medicine_stock WHERE id = $1`, [stock_id]);
    const batchNo = stockRes.rows.length > 0 ? stockRes.rows[0].batch_number : null;

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
    const { patient_id } = req.query;
    let query = `
      SELECT mr.*, p.full_name as patient_name, mm.medicine_name, ms.batch_number, u.full_name as processed_by_name
      FROM medicine_returns mr
      JOIN patients p ON mr.patient_id = p.patient_id
      JOIN medicine_master mm ON mr.medicine_id = mm.id
      JOIN medicine_stock ms ON mr.stock_id = ms.id
      JOIN users u ON mr.processed_by = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (patient_id) {
      params.push(patient_id);
      query += ` AND mr.patient_id = $${params.length}`;
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
    const { prescription_id, patient_id, registration_id, patient_name, mobile, doctor_id, date, status } = req.query;

    let query = `
      SELECT p.id as prescription_id, p.patient_id, p.doctor_id, p.created_at as prescription_date,
             COALESCE(p.pharmacy_status, 'pending'::pharmacy_status_enum) as status,
             pt.full_name as patient_name, pt.mobile_number, pt.patient_id as registration_id,
             u.full_name as doctor_name
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
    const { patient_id, registration_id, name, mobile, prescription_id } = req.query;

    let query = `
      SELECT DISTINCT pt.patient_id, pt.patient_id as registration_id, pt.full_name, pt.mobile_number, pt.age, pt.gender
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
      SELECT u.user_id, u.employee_id, u.full_name, u.mobile_number, u.email,
             u.role, u.status, u.branch_id, b.branch_name
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
    const { full_name, mobile_number, email } = req.body;

    const result = await db.query(`
      UPDATE users
      SET full_name = COALESCE($1, full_name),
          mobile_number = COALESCE($2, mobile_number),
          email = COALESCE($3, email),
          updated_at = now()
      WHERE user_id = $4
      RETURNING user_id, employee_id, full_name, mobile_number, email, role, status
    `, [full_name, mobile_number, email, userId]);

    res.locals.auditEntry = { module: 'Pharmacy Profile', action: 'Update Profile', recordId: userId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Pharmacy profile updated successfully'));
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
  createMedicine,
  updateMedicine,
  getMedicineStockDetail,
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
  createMedicineReturn,
  getMedicineReturns,
  getDispensingHistory,
  searchPatients,
  getProfile,
  updateProfile,
  createPrescription,
  dispensePrescription
};
