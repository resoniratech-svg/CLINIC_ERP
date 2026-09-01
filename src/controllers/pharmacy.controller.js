const db = require('../db');
const { formatResponse } = require('../utils/helpers');

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
    const { medicine_id, batch_number, expiry_date, quantity, transaction_type, reference } = req.body;

    if (!medicine_id || !batch_number || !expiry_date || quantity === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'medicine_id, batch_number, expiry_date, and quantity are required'));
    }

    const branchId = req.user.branch_id || 1;
    const qty = parseInt(quantity);
    const txnType = transaction_type || 'in'; // in, out, adjustment, return

    // Update stock quantity
    const stockRes = await client.query(`
      INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `, [medicine_id, batch_number, expiry_date, qty, branchId]);

    let stockItem;
    if (stockRes.rows.length === 0) {
      const existingRes = await client.query(`
        SELECT id FROM medicine_stock WHERE medicine_id = $1 AND batch_number = $2 AND branch_id = $3
      `, [medicine_id, batch_number, branchId]);

      if (existingRes.rows.length > 0) {
        const updateQty = txnType === 'out' ? -qty : qty;
        const updateRes = await client.query(`
          UPDATE medicine_stock SET quantity = quantity + $1, updated_at = now()
          WHERE id = $2 RETURNING *
        `, [updateQty, existingRes.rows[0].id]);
        stockItem = updateRes.rows[0];
      } else {
        const insRes = await client.query(`
          INSERT INTO medicine_stock (medicine_id, batch_number, expiry_date, quantity, branch_id)
          VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [medicine_id, batch_number, expiry_date, qty, branchId]);
        stockItem = insRes.rows[0];
      }
    } else {
      stockItem = stockRes.rows[0];
    }

    // Insert stock transaction record
    await client.query(`
      INSERT INTO stock_transactions (
        medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [medicine_id, txnType, qty, batch_number, reference || 'Stock Entry', req.user.user_id, branchId]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Management', action: 'Add/Adjust Stock', recordId: stockItem.id, newValue: stockItem };
    return res.status(201).json(formatResponse(true, stockItem, 'Medicine stock updated and transaction logged successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('addStock error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

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
      INSERT INTO prescriptions (patient_id, doctor_id, appointment_id)
      VALUES ($1, $2, $3) RETURNING *
    `, [patient_id, doctor_id, appointment_id || null]);

    const rx = rxRes.rows[0];
    const createdItems = [];

    for (const item of items) {
      const itemRes = await client.query(`
        INSERT INTO prescription_items (prescription_id, medicine_id, dosage, quantity)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [rx.id, item.medicine_id, item.dosage || '1-0-1', item.quantity || 1]);
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
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { prescription_id, items } = req.body; // array of { item_id, batch_number, quantity }

    if (!prescription_id) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'prescription_id is required'));
    }

    // Check valid prescription exists
    const rxRes = await client.query(`SELECT * FROM prescriptions WHERE id = $1`, [prescription_id]);
    if (rxRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription not found. Dispensing requires a valid prescription.'));
    }

    const branchId = req.user.branch_id || 1;
    const dispensedItems = [];

    const rxItemsRes = await client.query(`SELECT * FROM prescription_items WHERE prescription_id = $1`, [prescription_id]);
    const rxItems = rxItemsRes.rows;

    for (const rxItem of rxItems) {
      if (rxItem.dispensed) continue;

      // Find stock item
      const stockRes = await client.query(`
        SELECT * FROM medicine_stock
        WHERE medicine_id = $1 AND branch_id = $2 AND quantity >= $3
        ORDER BY expiry_date ASC LIMIT 1
      `, [rxItem.medicine_id, branchId, rxItem.quantity]);

      if (stockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, `Insufficient stock for medicine ID ${rxItem.medicine_id}`));
      }

      const stock = stockRes.rows[0];

      // Decrement stock
      await client.query(`
        UPDATE medicine_stock SET quantity = quantity - $1, updated_at = now() WHERE id = $2
      `, [rxItem.quantity, stock.id]);

      // Record transaction
      await client.query(`
        INSERT INTO stock_transactions (
          medicine_id, transaction_type, quantity, batch_number, reference, performed_by, branch_id
        ) VALUES ($1, 'out', $2, $3, $4, $5, $6)
      `, [rxItem.medicine_id, rxItem.quantity, stock.batch_number, `Dispense Rx #${prescription_id}`, req.user.user_id, branchId]);

      // Mark item dispensed
      await client.query(`
        UPDATE prescription_items
        SET dispensed = true, dispensed_at = now(), dispensed_by = $1
        WHERE id = $2
      `, [req.user.user_id, rxItem.id]);

      dispensedItems.push(rxItem.id);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Pharmacy Dispensing', action: 'Dispense Prescription', recordId: prescription_id, remarks: `Dispensed ${dispensedItems.length} item(s)` };
    return res.json(formatResponse(true, { prescription_id, dispensed_items_count: dispensedItems.length }, 'Prescription items dispensed and stock decremented successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('dispensePrescription error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

module.exports = {
  getMedicines,
  createMedicine,
  getStock,
  addStock,
  createPrescription,
  dispensePrescription
};
