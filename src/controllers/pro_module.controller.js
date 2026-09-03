const db = require('../db');
const { formatResponse } = require('../utils/helpers');

// Helper: Format Date cleanly to YYYY-MM-DD without UTC timezone shift
function formatDateString(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.split('T')[0];
  const dateObj = new Date(d);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Resolve targetDoctorId or default
async function resolveDoctorId(userId) {
  const res = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [userId]);
  if (res.rows.length > 0) {
    return res.rows[0].doctor_id;
  }
  return null;
}

// 1. Dashboard
async function getDashboard(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // PRO Pending (doctor completed)
    const pendingRes = await db.query(`SELECT COUNT(*) as cnt FROM appointments WHERE status = 'doctor_completed'`);
    // In Progress (pro pending)
    const inProgRes = await db.query(`SELECT COUNT(*) as cnt FROM appointments WHERE status = 'pro_pending'`);
    // Completed Today
    const completedRes = await db.query(`SELECT COUNT(*) as cnt FROM appointments WHERE status = 'pro_completed' AND DATE(updated_at) = $1`, [today]);

    // Pending Bills
    const billsRes = await db.query(`SELECT COUNT(*) as cnt FROM bills WHERE status != 'refunded' AND (final_amount > COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = bills.bill_id), 0))`);
    // Today's Cash
    const cashRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_method = 'cash' AND DATE(payment_date) = $1`, [today]);
    // Today's Revenue (Grand Total)
    const revRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(payment_date) = $1`, [today]);

    // Due Amount
    const dueRes = await db.query(`SELECT COALESCE(SUM(due_amount), 0) as total FROM due_patients WHERE status IN ('due', 'pending', 'partially_paid')`);
    // Callbacks
    const callbackRes = await db.query(`SELECT COUNT(*) as cnt FROM call_records WHERE call_status = 'callback_requested' AND task_status = 'pending'`);
    // Follow-ups
    const followupRes = await db.query(`SELECT COUNT(*) as cnt FROM crm_followups WHERE status = 'pending'`);

    // Target Summary
    const targetsRes = await db.query(`
      SELECT COALESCE(SUM(revenue_target), 0) as total_rev_target,
             COALESCE(SUM(unit_target), 0) as total_unit_target
      FROM doctor_targets
      WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) AND year = EXTRACT(YEAR FROM CURRENT_DATE)
    `);

    const paidRevRes = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as paid_rev
      FROM payments
      WHERE EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM payment_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);

    const summary = {
      pro_pending: parseInt(pendingRes.rows[0].cnt),
      in_progress: parseInt(inProgRes.rows[0].cnt),
      completed_today: parseInt(completedRes.rows[0].cnt),
      pending_bills: parseInt(billsRes.rows[0].cnt),
      todays_cash: parseFloat(cashRes.rows[0].total),
      todays_revenue: parseFloat(revRes.rows[0].total),
      due_amount: parseFloat(dueRes.rows[0].total),
      callbacks: parseInt(callbackRes.rows[0].cnt),
      followups: parseInt(followupRes.rows[0].cnt),
      targets: {
        revenue_target: parseFloat(targetsRes.rows[0].total_rev_target),
        revenue_achieved: parseFloat(paidRevRes.rows[0].paid_rev),
        unit_target: parseFloat(targetsRes.rows[0].total_unit_target),
        unit_achieved: 0
      }
    };

    return res.json(formatResponse(true, summary, 'PRO Dashboard data retrieved successfully'));
  } catch (err) {
    console.error('getDashboard error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 2. Patient Queue
async function getPatientQueue(req, res) {
  try {
    const statusFilter = req.query.status;
    let query = `
      SELECT a.appointment_id, a.appointment_id as token_number, a.patient_id, p.registration_id, p.full_name as patient_name,
             p.age, p.gender, d.doctor_id, u.full_name as doctor_name, a.appointment_type,
             a.status as consultation_status,
             CASE 
               WHEN a.status = 'doctor_completed' THEN 'PRO Pending'
               WHEN a.status = 'pro_pending' THEN 'In Progress'
               ELSE 'Completed'
             END as pro_status,
             a.created_at as waiting_since
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE a.status IN ('doctor_completed', 'pro_pending')
    `;
    const params = [];
    if (statusFilter === 'pending') {
      query += ` AND a.status = 'doctor_completed'`;
    } else if (statusFilter === 'in_progress') {
      query += ` AND a.status = 'pro_pending'`;
    }
    query += ` ORDER BY a.appointment_id DESC`;

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'PRO patient queue retrieved successfully'));
  } catch (err) {
    console.error('getPatientQueue error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3. Patient 360° Overview (Crucial Rule: doctor_notes MASKED from PRO)
async function getPatientOverview(req, res) {
  try {
    const patientId = parseInt(req.params.id);

    const ptRes = await db.query(`SELECT * FROM patients WHERE patient_id = $1`, [patientId]);
    if (ptRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Patient not found'));
    }
    const patient = ptRes.rows[0];

    // Latest Consultation Data (STRIP doctor_notes!)
    const consultRes = await db.query(`
      SELECT c.consultation_id, c.appointment_id, c.doctor_id, u.full_name as doctor_name,
             c.chief_complaint, c.symptoms, c.general_examination, c.physical_examination,
             c.primary_diagnosis_text, c.secondary_diagnosis_text, c.diagnosis_description,
             c.investigations, c.followup_recommended, c.followup_recommended_date,
             c.followup_instructions, c.pro_required, c.pro_reason, c.pro_instructions,
             c.status as consultation_status, c.created_at
      FROM consultations c
      LEFT JOIN doctors d ON c.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE c.patient_id = $1
      ORDER BY c.consultation_id DESC LIMIT 1
    `, [patientId]);

    const consultation = consultRes.rows[0] || null;

    // Latest Prescription
    const prescRes = await db.query(`
      SELECT p.id as prescription_id, p.created_at,
             json_agg(pi.*) as items
      FROM prescriptions p
      LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
      WHERE p.patient_id = $1
      GROUP BY p.id
      ORDER BY p.id DESC LIMIT 1
    `, [patientId]);

    // Financials
    const billsRes = await db.query(`SELECT * FROM bills WHERE patient_id = $1 ORDER BY bill_id DESC`, [patientId]);
    const paymentsRes = await db.query(`SELECT * FROM payments WHERE patient_id = $1 ORDER BY payment_id DESC`, [patientId]);
    const duesRes = await db.query(`SELECT id as due_id, patient_id, bill_id, due_amount, status FROM due_patients WHERE patient_id = $1 ORDER BY id DESC`, [patientId]);

    // CRM
    const callsRes = await db.query(`SELECT * FROM call_records WHERE patient_id = $1 ORDER BY call_id DESC`, [patientId]);
    const followupsRes = await db.query(`SELECT * FROM crm_followups WHERE patient_id = $1 ORDER BY id DESC`, [patientId]);
    const renewalsRes = await db.query(`SELECT * FROM renewals WHERE patient_id = $1 ORDER BY id DESC`, [patientId]);
    const packagesRes = await db.query(`SELECT * FROM packages WHERE patient_id = $1 ORDER BY package_id DESC`, [patientId]);

    const overview = {
      patient,
      consultation, // Note: doctor_notes is NOT included here!
      prescription: prescRes.rows[0] || null,
      financials: {
        bills: billsRes.rows,
        payments: paymentsRes.rows,
        dues: duesRes.rows
      },
      crm: {
        calls: callsRes.rows,
        followups: followupsRes.rows,
        renewals: renewalsRes.rows,
        packages: packagesRes.rows
      }
    };

    return res.json(formatResponse(true, overview, 'Patient 360 overview retrieved successfully'));
  } catch (err) {
    console.error('getPatientOverview error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 4. Counselling Module
async function createCounselling(req, res) {
  try {
    const { patient_id, doctor_id, counselling_type, notes, patient_understanding, patient_response, remarks } = req.body;
    if (!patient_id || !counselling_type || !notes || !patient_understanding) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, counselling_type, notes, and patient_understanding are required'));
    }

    const counselledBy = req.user.user_id;
    const result = await db.query(`
      INSERT INTO counselling_records (
        patient_id, doctor_id, counselled_by, counselling_type, notes, patient_understanding, patient_response, remarks, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      RETURNING *
    `, [patient_id, doctor_id || null, counselledBy, counselling_type, notes, patient_understanding, patient_response || null, remarks || null]);

    res.locals.auditEntry = { module: 'PRO Counselling', action: 'Create Counselling Record', recordId: result.rows[0].counselling_id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Counselling record created successfully'));
  } catch (err) {
    console.error('createCounselling error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getCounsellingHistory(req, res) {
  try {
    const patientId = req.query.patient_id ? parseInt(req.query.patient_id) : null;
    let query = `
      SELECT c.*, p.full_name as patient_name, u.full_name as counselled_by_name
      FROM counselling_records c
      JOIN patients p ON c.patient_id = p.patient_id
      JOIN users u ON c.counselled_by = u.user_id
    `;
    const params = [];
    if (patientId) {
      query += ` WHERE c.patient_id = $1`;
      params.push(patientId);
    }
    query += ` ORDER BY c.counselling_id DESC`;

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Counselling records retrieved successfully'));
  } catch (err) {
    console.error('getCounsellingHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 5. Packages / Plans
async function createPackage(req, res) {
  try {
    const { patient_id, doctor_id, package_name, package_type, from_date, to_date, package_amount, discount_amount, payment_status, remarks } = req.body;
    if (!patient_id || !package_name || !package_type || !from_date || package_amount === undefined) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, package_name, package_type, from_date, and package_amount are required'));
    }

    const pkgAmt = parseFloat(package_amount);
    const discAmt = parseFloat(discount_amount || 0);
    const finalAmt = pkgAmt - discAmt; // Server-computed!

    let computedToDate = to_date;
    let durationDays = null;
    const parts = from_date.split('-');
    const fromDt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

    if (package_type === 'monthly') {
      durationDays = 30;
      fromDt.setDate(fromDt.getDate() + 30);
      computedToDate = formatDateString(fromDt);
    } else if (package_type === 'quarterly') {
      durationDays = 90;
      fromDt.setDate(fromDt.getDate() + 90);
      computedToDate = formatDateString(fromDt);
    } else if (package_type === 'half_yearly') {
      durationDays = 180;
      fromDt.setDate(fromDt.getDate() + 180);
      computedToDate = formatDateString(fromDt);
    } else if (package_type === 'yearly') {
      durationDays = 365;
      fromDt.setDate(fromDt.getDate() + 365);
      computedToDate = formatDateString(fromDt);
    } else if (package_type === 'custom') {
      if (!to_date) {
        return res.status(400).json(formatResponse(false, null, 'to_date is required for custom package_type'));
      }
      computedToDate = to_date;
      const toParts = to_date.split('-');
      const toDt = new Date(parseInt(toParts[0]), parseInt(toParts[1]) - 1, parseInt(toParts[2]));
      durationDays = Math.ceil((toDt - fromDt) / (1000 * 60 * 60 * 24));
    }

    const createdBy = req.user.user_id;
    const result = await db.query(`
      INSERT INTO packages (
        patient_id, doctor_id, package_name, package_type, from_date, to_date, duration_days,
        package_amount, discount_amount, final_amount, payment_status, status, remarks, created_by, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13, 1)
      RETURNING *
    `, [patient_id, doctor_id || null, package_name, package_type, from_date, computedToDate, durationDays, pkgAmt, discAmt, finalAmt, payment_status || 'pending', remarks || null, createdBy]);

    const pkg = result.rows[0];
    pkg.from_date = formatDateString(pkg.from_date);
    pkg.to_date = formatDateString(pkg.to_date);

    res.locals.auditEntry = { module: 'PRO Packages', action: 'Create Package', recordId: pkg.package_id, newValue: pkg };
    return res.status(201).json(formatResponse(true, pkg, 'Package created successfully'));
  } catch (err) {
    console.error('createPackage error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getPackages(req, res) {
  try {
    const patientId = req.query.patient_id ? parseInt(req.query.patient_id) : null;
    const status = req.query.status;

    // Dynamic expired update check
    await db.query(`
      UPDATE packages
      SET status = 'expired'
      WHERE status = 'active' AND to_date < CURRENT_DATE
    `);

    let query = `
      SELECT p.*, pt.full_name as patient_name
      FROM packages p
      JOIN patients pt ON p.patient_id = pt.patient_id
    `;
    const params = [];
    const conditions = [];

    if (patientId) {
      conditions.push(`p.patient_id = $${params.length + 1}`);
      params.push(patientId);
    }
    if (status) {
      conditions.push(`p.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    query += ` ORDER BY p.package_id DESC`;

    const result = await db.query(query, params);
    const formatted = result.rows.map(r => ({
      ...r,
      from_date: formatDateString(r.from_date),
      to_date: formatDateString(r.to_date)
    }));

    return res.json(formatResponse(true, formatted, 'Packages retrieved successfully'));
  } catch (err) {
    console.error('getPackages error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updatePackageStatus(req, res) {
  try {
    const packageId = parseInt(req.params.id);
    const { status } = req.body;
    if (!['pending','active','completed','expired','cancelled','on_hold'].includes(status)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid package status'));
    }

    const result = await db.query(`
      UPDATE packages SET status = $1, updated_at = now() WHERE package_id = $2 RETURNING *
    `, [status, packageId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Package not found'));
    }

    res.locals.auditEntry = { module: 'PRO Packages', action: 'Update Package Status', recordId: packageId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Package status updated successfully'));
  } catch (err) {
    console.error('updatePackageStatus error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 6. Prescription Review & Modification Audit Flow
async function getPrescriptionDetails(req, res) {
  try {
    const prescriptionId = parseInt(req.params.id);
    const prescRes = await db.query(`SELECT * FROM prescriptions WHERE id = $1`, [prescriptionId]);
    if (prescRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Prescription not found'));
    }

    const itemsRes = await db.query(`
      SELECT pi.*, mm.medicine_name, mm.generic_name
      FROM prescription_items pi
      LEFT JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE pi.prescription_id = $1
    `, [prescriptionId]);

    return res.json(formatResponse(true, { prescription: prescRes.rows[0], items: itemsRes.rows }, 'Prescription details retrieved successfully'));
  } catch (err) {
    console.error('getPrescriptionDetails error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function modifyPrescriptionItem(req, res) {
  const client = await db.pool.connect();
  try {
    const itemId = parseInt(req.params.item_id);
    const { field_changed, modified_value, reason } = req.body;
    if (!field_changed || !modified_value || !reason) {
      return res.status(400).json(formatResponse(false, null, 'field_changed, modified_value, and reason are required'));
    }

    await client.query('BEGIN');
    const itemRes = await client.query(`SELECT * FROM prescription_items WHERE id = $1`, [itemId]);
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription item not found'));
    }

    const item = itemRes.rows[0];
    const origVal = item[field_changed] !== undefined ? String(item[field_changed]) : (item.quantity !== undefined ? String(item.quantity) : '');
    const userId = req.user.user_id;
    const role = req.user.role;

    const isOperational = ['duration', 'quantity'].includes(field_changed);
    const modStatus = isOperational ? 'applied' : 'pending_doctor_confirmation';

    if (isOperational) {
      if (field_changed === 'duration' || field_changed === 'quantity') {
        await client.query(`UPDATE prescription_items SET quantity = $1 WHERE id = $2`, [parseInt(modified_value) || 5, itemId]);
      }
    }

    const modRes = await client.query(`
      INSERT INTO prescription_modifications (
        prescription_item_id, field_changed, original_value, modified_value,
        modified_by, modifier_role, reason, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      RETURNING *
    `, [itemId, field_changed, origVal, String(modified_value), userId, role, reason, modStatus]);

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'PRO Prescription Modification', action: 'Modify Item', recordId: modRes.rows[0].id, newValue: modRes.rows[0] };
    return res.status(201).json(formatResponse(true, modRes.rows[0], isOperational ? 'Prescription item modified and applied successfully' : 'Prescription modification submitted for Doctor confirmation'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('modifyPrescriptionItem error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getPrescriptionItemModifications(req, res) {
  try {
    const itemId = parseInt(req.params.item_id);
    const result = await db.query(`
      SELECT pm.*, u.full_name as modified_by_name, doc_u.full_name as doctor_decision_by_name
      FROM prescription_modifications pm
      JOIN users u ON pm.modified_by = u.user_id
      LEFT JOIN users doc_u ON pm.doctor_decision_by = doc_u.user_id
      WHERE pm.prescription_item_id = $1
      ORDER BY pm.id DESC
    `, [itemId]);

    return res.json(formatResponse(true, result.rows, 'Prescription modifications audit trail retrieved successfully'));
  } catch (err) {
    console.error('getPrescriptionItemModifications error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 7. Billing
async function createBill(req, res) {
  const client = await db.pool.connect();
  try {
    const { patient_id, doctor_id, appointment_id, bill_type, items, discount_amount, package_id } = req.body;

    if (!patient_id || !bill_type || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, bill_type, and items array are required'));
    }

    // RULE 2: Block consultation bill type for PRO
    if (bill_type === 'consultation') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Consultation fee billing is handled by Receptionist only'));
    }

    await client.query('BEGIN');

    let subtotal = 0;
    for (const item of items) {
      const lineTotal = parseFloat(item.unit_price || item.amount || 0) * parseInt(item.quantity || 1);
      subtotal += lineTotal;
    }

    const discAmt = parseFloat(discount_amount || 0);
    const totalAmount = subtotal - discAmt; // Server-computed!

    const billNo = 'BILL-PRO-' + Date.now();
    const createdBy = req.user.user_id;

    const docIdToUse = doctor_id ? parseInt(doctor_id) : 1;
    const billRes = await client.query(`
      INSERT INTO bills (
        bill_number, patient_id, doctor_id, bill_type, amount, discount_amount,
        final_amount, created_by, branch_id, package_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, 'created'::bill_status)
      RETURNING *
    `, [billNo, patient_id, docIdToUse, bill_type, subtotal, discAmt, totalAmount, createdBy, package_id || null]);

    const bill = billRes.rows[0];
    bill.subtotal = subtotal;
    bill.total_amount = totalAmount;
    bill.paid_amount = 0;
    bill.payment_status = 'pending';

    for (const item of items) {
      const lineTotal = parseFloat(item.unit_price || item.amount || 0) * parseInt(item.quantity || 1);
      const chargeType = item.charge_type || item.item_name || 'Service';
      const desc = item.description || item.item_name || 'Service Item';
      await client.query(`
        INSERT INTO bill_items (
          bill_id, charge_type, description, amount
        ) VALUES ($1, $2, $3, $4)
      `, [bill.bill_id, chargeType, desc, lineTotal]);
    }

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'PRO Billing', action: 'Create Bill', recordId: bill.bill_id, newValue: bill };
    return res.status(201).json(formatResponse(true, bill, 'Bill created successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createBill error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getPendingBills(req, res) {
  try {
    const result = await db.query(`
      SELECT b.*, b.amount as subtotal, b.final_amount as total_amount, p.full_name as patient_name,
             COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0) as paid_amount
      FROM bills b
      JOIN patients p ON b.patient_id = p.patient_id
      WHERE b.status != 'refunded' AND b.final_amount > COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0)
      ORDER BY b.bill_id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Pending bills retrieved successfully'));
  } catch (err) {
    console.error('getPendingBills error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getPaidBills(req, res) {
  try {
    const result = await db.query(`
      SELECT b.*, b.amount as subtotal, b.final_amount as total_amount, p.full_name as patient_name,
             COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0) as paid_amount
      FROM bills b
      JOIN patients p ON b.patient_id = p.patient_id
      WHERE b.final_amount <= COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0)
      ORDER BY b.bill_id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Paid bills retrieved successfully'));
  } catch (err) {
    console.error('getPaidBills error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getPartialDueBills(req, res) {
  try {
    const result = await db.query(`
      SELECT b.*, b.amount as subtotal, b.final_amount as total_amount, p.full_name as patient_name,
             COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0) as paid_amount
      FROM bills b
      JOIN patients p ON b.patient_id = p.patient_id
      WHERE COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0) > 0
        AND b.final_amount > COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0)
      ORDER BY b.bill_id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Partial due bills retrieved successfully'));
  } catch (err) {
    console.error('getPartialDueBills error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getBillingHistory(req, res) {
  try {
    const result = await db.query(`
      SELECT b.*, b.amount as subtotal, b.final_amount as total_amount, p.full_name as patient_name,
             COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0) as paid_amount
      FROM bills b
      JOIN patients p ON b.patient_id = p.patient_id
      ORDER BY b.bill_id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Billing history retrieved successfully'));
  } catch (err) {
    console.error('getBillingHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 8. Payments & Realized Revenue Doctor Target Attribution
async function recordPayment(req, res) {
  const client = await db.pool.connect();
  try {
    const { bill_id, payments, amount, payment_method, remarks } = req.body;
    if (!bill_id) {
      return res.status(400).json(formatResponse(false, null, 'bill_id is required'));
    }

    let payList = [];
    if (payments && Array.isArray(payments) && payments.length > 0) {
      payList = payments;
    } else if (amount && payment_method) {
      payList = [{ amount, payment_method, remarks }];
    } else {
      return res.status(400).json(formatResponse(false, null, 'Either payments array or amount and payment_method are required'));
    }

    await client.query('BEGIN');

    const billRes = await client.query(`SELECT * FROM bills WHERE bill_id = $1`, [bill_id]);
    if (billRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Bill not found'));
    }
    const bill = billRes.rows[0];

    // Compute existing paid amount
    const prevPayRes = await client.query(`SELECT COALESCE(SUM(amount), 0) as prev_paid FROM payments WHERE bill_id = $1`, [bill_id]);
    const prevPaid = parseFloat(prevPayRes.rows[0].prev_paid);

    let totalNewPayment = 0;
    const recordedPayments = [];
    const receivedBy = req.user.user_id;

    for (const p of payList) {
      const pAmt = parseFloat(p.amount);
      const pMethod = p.payment_method || p.payment_mode || 'cash';
      totalNewPayment += pAmt;

      const pRes = await client.query(`
        INSERT INTO payments (
          patient_id, bill_id, amount, payment_method, payment_date,
          received_by, branch_id
        ) VALUES ($1, $2, $3, $4, now(), $5, 1)
        RETURNING *
      `, [bill.patient_id, bill_id, pAmt, pMethod, receivedBy]);
      recordedPayments.push(pRes.rows[0]);
    }

    const newPaidTotal = prevPaid + totalNewPayment;
    const billTotal = parseFloat(bill.final_amount);
    let newStatus = 'pending';
    if (newPaidTotal >= billTotal) {
      newStatus = 'paid';
    } else if (newPaidTotal > 0) {
      newStatus = 'partial';
    }

    // Manage Due Patients row
    const shortfall = billTotal - newPaidTotal;
    if (shortfall > 0) {
      const dueCheck = await client.query(`SELECT * FROM due_patients WHERE bill_id = $1`, [bill_id]);
      if (dueCheck.rows.length > 0) {
        await client.query(`
          UPDATE due_patients SET due_amount = $1, status = $2 WHERE bill_id = $3
        `, [shortfall, newStatus === 'partial' ? 'partially_paid' : 'due', bill_id]);
      } else {
        await client.query(`
          INSERT INTO due_patients (
            patient_id, bill_id, due_amount, status, branch_id
          ) VALUES ($1, $2, $3, $4, 1)
        `, [bill.patient_id, bill_id, shortfall, newStatus === 'partial' ? 'partially_paid' : 'due']);
      }
    } else {
      await client.query(`
        UPDATE due_patients SET due_amount = 0, status = 'paid' WHERE bill_id = $1
      `, [bill_id]);
    }

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'PRO Payment', action: 'Record Payment', recordId: recordedPayments[0].payment_id, newValue: recordedPayments };
    return res.status(201).json(formatResponse(true, {
      payments: recordedPayments,
      updated_bill_status: newStatus,
      paid_total: newPaidTotal,
      remaining_due: shortfall > 0 ? shortfall : 0,
      bill: { status: newStatus, due_amount: shortfall > 0 ? shortfall : 0 }
    }, 'Payment recorded successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('recordPayment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function refundPayment(req, res) {
  const client = await db.pool.connect();
  try {
    const paymentId = parseInt(req.params.id);
    await client.query('BEGIN');

    const payRes = await client.query(`SELECT * FROM payments WHERE payment_id = $1`, [paymentId]);
    if (payRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Payment record not found'));
    }
    const payment = payRes.rows[0];
    const refundAmt = parseFloat(payment.amount);

    // Update bill status
    await client.query(`
      UPDATE bills
      SET status = 'refunded'::bill_status,
          updated_at = now()
      WHERE bill_id = $1
    `, [payment.bill_id]);

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'PRO Payment', action: 'Refund Payment', recordId: paymentId, newValue: { refunded_amount: refundAmt } };
    return res.json(formatResponse(true, { payment_id: paymentId, refunded_amount: refundAmt }, 'Payment refunded successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('refundPayment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getTodayPayments(req, res) {
  try {
    const result = await db.query(`
      SELECT p.*, pt.full_name as patient_name, b.bill_number
      FROM payments p
      JOIN patients pt ON p.patient_id = pt.patient_id
      LEFT JOIN bills b ON p.bill_id = b.bill_id
      WHERE DATE(p.payment_date) = CURRENT_DATE
      ORDER BY p.payment_id DESC
    `);
    return res.json(formatResponse(true, result.rows, "Today's payments retrieved successfully"));
  } catch (err) {
    console.error('getTodayPayments error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getDueCollections(req, res) {
  try {
    const result = await db.query(`
      SELECT d.*, p.full_name as patient_name, b.bill_number
      FROM due_patients d
      JOIN patients p ON d.patient_id = p.patient_id
      JOIN bills b ON d.bill_id = b.bill_id
      WHERE d.due_amount > 0
      ORDER BY d.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Due collections list retrieved successfully'));
  } catch (err) {
    console.error('getDueCollections error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getPaymentHistory(req, res) {
  try {
    const result = await db.query(`
      SELECT p.*, pt.full_name as patient_name, b.bill_number
      FROM payments p
      JOIN patients pt ON p.patient_id = pt.patient_id
      LEFT JOIN bills b ON p.bill_id = b.bill_id
      ORDER BY p.payment_id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Payment history retrieved successfully'));
  } catch (err) {
    console.error('getPaymentHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 9. CRM / Calling & Renewals & Dues & ACQ & OC/NR
async function createCall(req, res) {
  try {
    const { patient_id, interaction_type, call_purpose, call_status, callback_date, callback_time, remarks } = req.body;
    if (!patient_id || !interaction_type || !call_purpose || !call_status) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, interaction_type, call_purpose, and call_status are required'));
    }

    const handledBy = req.user.user_id;
    const isCallback = call_status === 'callback_requested';
    const taskStatus = isCallback ? 'pending' : 'completed';

    let mappedPurpose = String(call_purpose).toLowerCase().replace(/\s+/g, '_');
    if (mappedPurpose.includes('due') || mappedPurpose.includes('payment')) mappedPurpose = 'due_payment';
    else if (mappedPurpose.includes('follow')) mappedPurpose = 'followup';
    else if (mappedPurpose.includes('renew')) mappedPurpose = 'renewal';

    const validPurposes = ['followup','renewal','due_payment','acq','ocnr','appointment','general_enquiry','callback','patient_feedback','other'];
    if (!validPurposes.includes(mappedPurpose)) mappedPurpose = 'other';

    const result = await db.query(`
      INSERT INTO call_records (
        patient_id, interaction_type, call_purpose, call_status,
        callback_date, callback_time, task_status, handled_by, branch_id, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
      RETURNING *
    `, [patient_id, interaction_type || 'outbound', mappedPurpose, call_status, callback_date || null, callback_time || null, taskStatus, handledBy, remarks || null]);

    res.locals.auditEntry = { module: 'PRO Calling', action: 'Record Call', recordId: result.rows[0].call_id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Call record created successfully'));
  } catch (err) {
    console.error('createCall error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getTodayCalls(req, res) {
  try {
    const result = await db.query(`
      SELECT c.*, p.full_name as patient_name
      FROM call_records c
      JOIN patients p ON c.patient_id = p.patient_id
      WHERE DATE(c.created_at) = CURRENT_DATE
      ORDER BY c.call_id DESC
    `);
    return res.json(formatResponse(true, result.rows, "Today's calls retrieved successfully"));
  } catch (err) {
    console.error('getTodayCalls error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createFollowup(req, res) {
  try {
    const { patient_id, followup_type, followup_date, followup_time, purpose, assigned_to, remarks } = req.body;
    if (!patient_id || !followup_type || !followup_date || !purpose) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, followup_type, followup_date, and purpose are required'));
    }

    const assignedUserId = assigned_to || req.user.user_id;

    // RULE 16: Block assignment to executive role
    const userCheck = await db.query(`SELECT role FROM users WHERE user_id = $1`, [assignedUserId]);
    if (userCheck.rows.length > 0 && userCheck.rows[0].role === 'executive') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: CRM follow-up tasks cannot be assigned to Executive role'));
    }

    const result = await db.query(`
      INSERT INTO crm_followups (
        patient_id, category, due_date, assigned_to, status, remarks, branch_id
      ) VALUES ($1, $2, $3, $4, 'pending', $5, 1)
      RETURNING *, id as followup_id
    `, [patient_id, followup_type, followup_date, assignedUserId, remarks || purpose]);

    res.locals.auditEntry = { module: 'PRO CRM', action: 'Create Follow-up', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Follow-up created successfully'));
  } catch (err) {
    console.error('createFollowup error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getFollowups(req, res) {
  try {
    const result = await db.query(`
      SELECT f.*, f.id as followup_id, p.full_name as patient_name, u.full_name as assigned_to_name
      FROM crm_followups f
      JOIN patients p ON f.patient_id = p.patient_id
      LEFT JOIN users u ON f.assigned_to = u.user_id
      ORDER BY f.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Follow-up tasks retrieved successfully'));
  } catch (err) {
    console.error('getFollowups error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getRenewalsQueue(req, res) {
  try {
    // Dynamic scan of expired active packages to include in queue
    const expPkgs = await db.query(`
      SELECT pkg.*, pt.full_name as patient_name
      FROM packages pkg
      JOIN patients pt ON pkg.patient_id = pt.patient_id
      WHERE pkg.to_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY pkg.package_id DESC
    `);
    const renewalsRes = await db.query(`
      SELECT r.*, pt.full_name as patient_name
      FROM renewals r
      JOIN patients pt ON r.patient_id = pt.patient_id
      ORDER BY r.id DESC
    `);

    return res.json(formatResponse(true, { expired_packages: expPkgs.rows, renewals: renewalsRes.rows }, 'Renewal queue retrieved successfully'));
  } catch (err) {
    console.error('getRenewalsQueue error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createRenewal(req, res) {
  try {
    const { patient_id, package_id, doctor_id, renewal_type, renewal_amount, call_status, remarks } = req.body;
    if (!patient_id || renewal_amount === undefined) {
      return res.status(400).json(formatResponse(false, null, 'patient_id and renewal_amount are required'));
    }

    const today = new Date().toISOString().split('T')[0];
    const docIdToUse = doctor_id ? parseInt(doctor_id) : 1;

    let validPkgId = null;
    if (package_id) {
      const pkgCheck = await db.query(`SELECT package_id FROM packages WHERE package_id = $1`, [package_id]);
      if (pkgCheck.rows.length === 0) {
        return res.status(404).json(formatResponse(false, null, `Package ID ${package_id} not found`));
      }
      validPkgId = parseInt(package_id);
    }

    const result = await db.query(`
      INSERT INTO renewals (
        patient_id, doctor_id, renewal_date, amount, status, package_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [patient_id, docIdToUse, today, parseFloat(renewal_amount), call_status || 'renewed', validPkgId]);

    res.locals.auditEntry = { module: 'PRO Renewals', action: 'Create Renewal', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Renewal recorded successfully'));
  } catch (err) {
    console.error('createRenewal error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getDuePatients(req, res) {
  try {
    const result = await db.query(`
      SELECT d.*, p.full_name as patient_name, b.bill_number
      FROM due_patients d
      JOIN patients p ON d.patient_id = p.patient_id
      JOIN bills b ON d.bill_id = b.bill_id
      ORDER BY d.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Due patients list retrieved successfully'));
  } catch (err) {
    console.error('getDuePatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getACQPatients(req, res) {
  try {
    const result = await db.query(`
      SELECT a.*, a.id as acq_id, p.full_name as patient_name
      FROM acq_patients a
      JOIN patients p ON a.patient_id = p.patient_id
      ORDER BY a.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'ACQ patients retrieved successfully'));
  } catch (err) {
    console.error('getACQPatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateACQPatient(req, res) {
  try {
    const acqId = parseInt(req.params.id);
    const { status, renewal_date } = req.body;
    const result = await db.query(`
      UPDATE acq_patients
      SET status = COALESCE($1, status),
          renewal_date = COALESCE($2, renewal_date)
      WHERE id = $3
      RETURNING *, id as acq_id
    `, [status, renewal_date, acqId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'ACQ patient record not found'));
    }

    res.locals.auditEntry = { module: 'PRO ACQ', action: 'Update ACQ Record', recordId: acqId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'ACQ patient record updated successfully'));
  } catch (err) {
    console.error('updateACQPatient error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getOCNRPatients(req, res) {
  try {
    const result = await db.query(`
      SELECT o.*, o.id as oc_nr_id, p.full_name as patient_name
      FROM oc_nr_patients o
      JOIN patients p ON o.patient_id = p.patient_id
      ORDER BY o.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'OC/NR patients list retrieved successfully'));
  } catch (err) {
    console.error('getOCNRPatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createOCNRPatient(req, res) {
  try {
    const { patient_id, classification, reason_not_continuing, reason, remarks } = req.body;
    if (!patient_id) {
      return res.status(400).json(formatResponse(false, null, 'patient_id is required'));
    }

    const reasonText = reason || reason_not_continuing || remarks || null;
    let cls = String(classification || 'oc').toLowerCase();
    if (cls !== 'oc' && cls !== 'nr') cls = 'oc';

    const result = await db.query(`
      INSERT INTO oc_nr_patients (
        patient_id, classification, reason, marked_at
      ) VALUES ($1, $2, $3, now())
      RETURNING *, id as oc_nr_id
    `, [patient_id, cls, reasonText]);

    res.locals.auditEntry = { module: 'PRO OC/NR', action: 'Record OC/NR Patient', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'OC/NR patient recorded successfully'));
  } catch (err) {
    console.error('createOCNRPatient error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 10. My Tasks
async function getMyTasks(req, res) {
  try {
    const userId = req.user.user_id;
    const result = await db.query(`
      SELECT c.*, p.full_name as patient_name, p.mobile_number
      FROM call_records c
      JOIN patients p ON c.patient_id = p.patient_id
      WHERE c.handled_by = $1 AND c.task_status = 'pending'
      ORDER BY c.callback_date ASC, c.callback_time ASC
    `, [userId]);

    return res.json(formatResponse(true, result.rows, 'My tasks retrieved successfully'));
  } catch (err) {
    console.error('getMyTasks error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function completeTask(req, res) {
  try {
    const callId = parseInt(req.params.call_id);
    const { remarks } = req.body;
    const result = await db.query(`
      UPDATE call_records
      SET task_status = 'completed', remarks = COALESCE($1, remarks), updated_at = now()
      WHERE call_id = $2 RETURNING *
    `, [remarks, callId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Task call record not found'));
    }

    res.locals.auditEntry = { module: 'PRO Tasks', action: 'Complete Task', recordId: callId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Task marked as completed successfully'));
  } catch (err) {
    console.error('completeTask error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function rescheduleTask(req, res) {
  try {
    const callId = parseInt(req.params.call_id);
    const { callback_date, callback_time, remarks } = req.body;
    if (!callback_date) {
      return res.status(400).json(formatResponse(false, null, 'callback_date is required'));
    }

    const result = await db.query(`
      UPDATE call_records
      SET callback_date = $1, callback_time = $2, remarks = COALESCE($3, remarks), updated_at = now()
      WHERE call_id = $4 RETURNING *
    `, [callback_date, callback_time || '10:00:00', remarks, callId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Task call record not found'));
    }

    res.locals.auditEntry = { module: 'PRO Tasks', action: 'Reschedule Task', recordId: callId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Task rescheduled successfully'));
  } catch (err) {
    console.error('rescheduleTask error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 11. Accountant / Cash Management
async function getOpeningBalance(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];

    // Compute opening balance from previous day's closing balance
    const prevRes = await db.query(`
      SELECT closing_balance FROM cash_ledger WHERE ledger_date < $1 ORDER BY ledger_date DESC LIMIT 1
    `, [dateParam]);

    const openingCash = prevRes.rows.length > 0 ? parseFloat(prevRes.rows[0].closing_balance) : 0.00;

    return res.json(formatResponse(true, { date: dateParam, opening_cash: openingCash }, 'Opening cash balance retrieved successfully'));
  } catch (err) {
    console.error('getOpeningBalance error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getCashRevenue(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];
    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as cash_revenue
      FROM payments
      WHERE payment_method = 'cash' AND DATE(payment_date) = $1
    `, [dateParam]);

    return res.json(formatResponse(true, { date: dateParam, cash_revenue: parseFloat(result.rows[0].cash_revenue) }, 'Cash revenue retrieved successfully'));
  } catch (err) {
    console.error('getCashRevenue error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createExpenditure(req, res) {
  try {
    const { category, description, amount, remarks } = req.body;
    if (!category || !description || !amount) {
      return res.status(400).json(formatResponse(false, null, 'category, description, and amount are required'));
    }

    const expAmt = parseFloat(amount);
    const enteredBy = req.user.user_id;
    const today = new Date().toISOString().split('T')[0];

    const result = await db.query(`
      INSERT INTO expenditures (
        expense_date, expense_category, description, amount, payment_mode, entered_by, branch_id, remarks
      ) VALUES ($1, $2, $3, $4, 'cash', $5, 1, $6)
      RETURNING *
    `, [today, category, description, expAmt, enteredBy, remarks || null]);

    res.locals.auditEntry = { module: 'PRO Accountant', action: 'Create Cash Expenditure', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Cash expenditure recorded successfully'));
  } catch (err) {
    console.error('createExpenditure error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getClosingBalance(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];

    // Opening
    const prevRes = await db.query(`SELECT closing_balance FROM cash_ledger WHERE ledger_date < $1 ORDER BY ledger_date DESC LIMIT 1`, [dateParam]);
    const openingCash = prevRes.rows.length > 0 ? parseFloat(prevRes.rows[0].closing_balance) : 0.00;

    // Cash Revenue
    const revRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_rev FROM payments WHERE payment_method = 'cash' AND DATE(payment_date) = $1`, [dateParam]);
    const cashRev = parseFloat(revRes.rows[0].cash_rev);

    // Cash Expenditure
    const expRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_exp FROM expenditures WHERE payment_mode = 'cash' AND expense_date = $1`, [dateParam]);
    const cashExp = parseFloat(expRes.rows[0].cash_exp);

    const closingCash = openingCash + cashRev - cashExp;

    return res.json(formatResponse(true, {
      date: dateParam,
      opening_cash: openingCash,
      cash_revenue: cashRev,
      cash_expenditure: cashExp,
      closing_cash: closingCash
    }, 'Closing cash balance computed successfully'));
  } catch (err) {
    console.error('getClosingBalance error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function depositCash(req, res) {
  try {
    const { deposit_amount, deposit_reference, remarks } = req.body;
    if (!deposit_amount) {
      return res.status(400).json(formatResponse(false, null, 'deposit_amount is required'));
    }

    const depAmt = parseFloat(deposit_amount);
    const depositedBy = req.user.user_id;
    const today = new Date().toISOString().split('T')[0];

    // Compute Opening Cash
    const prevRes = await db.query(`SELECT closing_balance FROM cash_ledger WHERE ledger_date < $1 ORDER BY ledger_date DESC LIMIT 1`, [today]);
    const openingCash = prevRes.rows.length > 0 ? parseFloat(prevRes.rows[0].closing_balance) : 0.00;

    // Compute Cash Revenue
    const revRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_rev FROM payments WHERE payment_method = 'cash' AND DATE(payment_date) = $1`, [today]);
    const cashRev = parseFloat(revRes.rows[0].cash_rev);

    // Compute Cash Expenditure
    const expRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_exp FROM expenditures WHERE payment_mode = 'cash' AND expense_date = $1`, [today]);
    const cashExp = parseFloat(expRes.rows[0].cash_exp);

    const availableCash = openingCash + cashRev - cashExp;
    const closingCash = availableCash - depAmt;

    const result = await db.query(`
      INSERT INTO cash_deposits (
        deposit_date, opening_balance, cash_revenue, cash_expenditure, available_cash,
        deposited_amount, deposit_reference, deposited_by, closing_balance, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
      RETURNING *, id as deposit_id
    `, [today, openingCash, cashRev, cashExp, availableCash, depAmt, deposit_reference || null, depositedBy, closingCash]);

    res.locals.auditEntry = { module: 'PRO Accountant', action: 'Deposit Cash', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Cash deposit recorded successfully'));
  } catch (err) {
    console.error('depositCash error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getDailyCashSummary(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];

    // Opening
    const prevRes = await db.query(`SELECT closing_balance FROM cash_ledger WHERE ledger_date < $1 ORDER BY ledger_date DESC LIMIT 1`, [dateParam]);
    const openingCash = prevRes.rows.length > 0 ? parseFloat(prevRes.rows[0].closing_balance) : 0.00;

    // Cash Revenue
    const revRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_rev FROM payments WHERE payment_method = 'cash' AND DATE(payment_date) = $1`, [dateParam]);
    const cashRev = parseFloat(revRes.rows[0].cash_rev);

    // Cash Expenditure
    const expRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_exp FROM expenditures WHERE payment_mode = 'cash' AND expense_date = $1`, [dateParam]);
    const cashExp = parseFloat(expRes.rows[0].cash_exp);

    const expectedCash = openingCash + cashRev - cashExp;

    // Cash Deposited
    const depRes = await db.query(`SELECT COALESCE(SUM(deposited_amount), 0) as total_dep FROM cash_deposits WHERE DATE(deposit_date) = $1`, [dateParam]);
    const cashDeposited = parseFloat(depRes.rows[0].total_dep);
    const closingCash = expectedCash - cashDeposited;

    // Method Breakdown
    const methodRes = await db.query(`
      SELECT payment_method, COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE DATE(payment_date) = $1
      GROUP BY payment_method
    `, [dateParam]);

    const breakdown = { cash: 0, card: 0, upi: 0, razorpay: 0, bajaj_pay: 0 };
    let grandTotal = 0;

    for (const r of methodRes.rows) {
      const val = parseFloat(r.total);
      grandTotal += val;
      if (breakdown[r.payment_method] !== undefined) {
        breakdown[r.payment_method] = val;
      }
    }

    const summary = {
      date: dateParam,
      opening_cash: openingCash,
      cash_revenue: cashRev,
      cash_expenditure: cashExp,
      expected_cash: expectedCash,
      cash_deposited: cashDeposited,
      closing_cash: closingCash,
      payment_method_breakdown: breakdown,
      grand_total: grandTotal
    };

    return res.json(formatResponse(true, summary, 'Daily cash summary retrieved successfully'));
  } catch (err) {
    console.error('getDailyCashSummary error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getGrandTotal(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];
    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as grand_total
      FROM payments
      WHERE DATE(payment_date) = $1
    `, [dateParam]);

    return res.json(formatResponse(true, { date: dateParam, grand_total: parseFloat(result.rows[0].grand_total) }, 'Grand total retrieved successfully'));
  } catch (err) {
    console.error('getGrandTotal error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 12. Feedback & Complaints
async function createFeedback(req, res) {
  try {
    const { patient_id, category_type, description, rating, remarks } = req.body;
    if (!patient_id || !category_type || !description) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, category_type, and description are required'));
    }

    const loggedBy = req.user.user_id;
    const result = await db.query(`
      INSERT INTO feedback_complaints (
        patient_id, kind, category_type, description, rating, remarks, logged_by, branch_id
      ) VALUES ($1, 'feedback', $2, $3, $4, $5, $6, 1)
      RETURNING *
    `, [patient_id, category_type, description, rating || null, remarks || null, loggedBy]);

    res.locals.auditEntry = { module: 'PRO Feedback', action: 'Record Feedback', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Patient feedback recorded successfully'));
  } catch (err) {
    console.error('createFeedback error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getFeedback(req, res) {
  try {
    const result = await db.query(`
      SELECT fc.*, p.full_name as patient_name
      FROM feedback_complaints fc
      JOIN patients p ON fc.patient_id = p.patient_id
      WHERE fc.kind = 'feedback'
      ORDER BY fc.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Feedback list retrieved successfully'));
  } catch (err) {
    console.error('getFeedback error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createComplaint(req, res) {
  try {
    const { patient_id, category_type, description, priority, assigned_to, remarks } = req.body;
    if (!patient_id || !category_type || !description) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, category_type, and description are required'));
    }

    const loggedBy = req.user.user_id;
    const result = await db.query(`
      INSERT INTO feedback_complaints (
        patient_id, kind, category_type, description, priority, assigned_to, status, remarks, logged_by, branch_id
      ) VALUES ($1, 'complaint', $2, $3, $4, $5, 'open', $6, $7, 1)
      RETURNING *
    `, [patient_id, category_type, description, priority || 'normal', assigned_to || null, remarks || null, loggedBy]);

    res.locals.auditEntry = { module: 'PRO Complaints', action: 'Record Complaint', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Complaint recorded successfully'));
  } catch (err) {
    console.error('createComplaint error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateComplaint(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { status, action_taken, resolution, remarks } = req.body;

    const result = await db.query(`
      UPDATE feedback_complaints
      SET status = COALESCE($1, status),
          action_taken = COALESCE($2, action_taken),
          resolution = COALESCE($3, resolution),
          remarks = COALESCE($4, remarks),
          updated_at = now()
      WHERE id = $5 AND kind = 'complaint'
      RETURNING *
    `, [status, action_taken, resolution, remarks, id]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Complaint record not found'));
    }

    res.locals.auditEntry = { module: 'PRO Complaints', action: 'Update Complaint', recordId: id, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Complaint updated successfully'));
  } catch (err) {
    console.error('updateComplaint error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getComplaints(req, res) {
  try {
    const result = await db.query(`
      SELECT fc.*, p.full_name as patient_name, u.full_name as assigned_to_name
      FROM feedback_complaints fc
      JOIN patients p ON fc.patient_id = p.patient_id
      LEFT JOIN users u ON fc.assigned_to = u.user_id
      WHERE fc.kind = 'complaint'
      ORDER BY fc.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Complaints list retrieved successfully'));
  } catch (err) {
    console.error('getComplaints error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 13. PRO Completion & Pharmacy Handoff Checklist
async function getPROChecklist(req, res) {
  try {
    const patientId = parseInt(req.params.id);

    // Doctor consultation completed check
    const consultRes = await db.query(`SELECT status FROM consultations WHERE patient_id = $1 ORDER BY consultation_id DESC LIMIT 1`, [patientId]);
    const doctorConsultationCompleted = consultRes.rows.length > 0 && ['completed', 'doctor_completed', 'pro_pending', 'pro_completed'].includes(consultRes.rows[0].status);

    // Counselling check
    const counselRes = await db.query(`SELECT counselling_id FROM counselling_records WHERE patient_id = $1`, [patientId]);
    const counsellingCompleted = counselRes.rows.length > 0;

    // Billing check
    const billsRes = await db.query(`SELECT bill_id FROM bills WHERE patient_id = $1`, [patientId]);
    const billingCompleted = billsRes.rows.length > 0;

    // Payment / Due check
    const payRes = await db.query(`SELECT payment_id FROM payments WHERE patient_id = $1`, [patientId]);
    const dueRes = await db.query(`SELECT id FROM due_patients WHERE patient_id = $1`, [patientId]);
    const paymentOrDueRecorded = payRes.rows.length > 0 || dueRes.rows.length > 0;

    const checklist = {
      doctor_consultation_completed: doctorConsultationCompleted,
      diagnosis_reviewed: doctorConsultationCompleted,
      prescription_reviewed: doctorConsultationCompleted,
      counselling_completed: counsellingCompleted,
      treatment_package_confirmed: counsellingCompleted,
      billing_completed: billingCompleted,
      payment_or_due_recorded: paymentOrDueRecorded
    };

    const allSatisfied = Object.values(checklist).every(val => val === true);

    return res.json(formatResponse(true, { patient_id: patientId, checklist, ready_for_pro_completion: allSatisfied }, 'PRO completion checklist retrieved successfully'));
  } catch (err) {
    console.error('getPROChecklist error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function completePRO(req, res) {
  try {
    const patientId = parseInt(req.params.id);

    // Validate checklist
    const counselRes = await db.query(`SELECT counselling_id FROM counselling_records WHERE patient_id = $1`, [patientId]);
    const billsRes = await db.query(`SELECT bill_id FROM bills WHERE patient_id = $1`, [patientId]);

    const missingItems = [];
    if (counselRes.rows.length === 0) missingItems.push('Counselling session record');
    if (billsRes.rows.length === 0) missingItems.push('Treatment/Package billing invoice');

    if (missingItems.length > 0) {
      return res.status(422).json(formatResponse(false, { missing_items: missingItems }, 'PRO completion checklist incomplete. Please complete missing items before handoff to Pharmacy.'));
    }

    // Transition appointment status to pro_completed
    const apptRes = await db.query(`
      UPDATE appointments
      SET status = 'pro_completed', updated_at = now()
      WHERE patient_id = $1 AND status IN ('doctor_completed', 'pro_pending')
      RETURNING *
    `, [patientId]);

    const updatedAppt = apptRes.rows[0] || null;

    res.locals.auditEntry = { module: 'PRO Completion', action: 'Complete PRO Handoff', recordId: patientId, newValue: updatedAppt };
    return res.json(formatResponse(true, { patient_id: patientId, appointment: updatedAppt, pharmacy_queue_status: 'unlocked' }, 'PRO completion verified successfully. Prescription released to Pharmacy queue.'));
  } catch (err) {
    console.error('completePRO error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getDashboard,
  getPatientQueue,
  getPatientOverview,
  createCounselling,
  getCounsellingHistory,
  createPackage,
  getPackages,
  updatePackageStatus,
  getPrescriptionDetails,
  modifyPrescriptionItem,
  getPrescriptionItemModifications,
  createBill,
  getPendingBills,
  getPaidBills,
  getPartialDueBills,
  getBillingHistory,
  recordPayment,
  refundPayment,
  getTodayPayments,
  getDueCollections,
  getPaymentHistory,
  createCall,
  getTodayCalls,
  createFollowup,
  getFollowups,
  getRenewalsQueue,
  createRenewal,
  getDuePatients,
  getACQPatients,
  updateACQPatient,
  getOCNRPatients,
  createOCNRPatient,
  getMyTasks,
  completeTask,
  rescheduleTask,
  getOpeningBalance,
  getCashRevenue,
  createExpenditure,
  getClosingBalance,
  depositCash,
  getDailyCashSummary,
  getGrandTotal,
  createFeedback,
  getFeedback,
  createComplaint,
  updateComplaint,
  getComplaints,
  getPROChecklist,
  completePRO
};
