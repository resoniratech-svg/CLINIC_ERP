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

// 2b. Search Patients for PRO (Branch isolated, doctor_notes masked)
async function searchPatients(req, res) {
  try {
    const { search, q, name, patient_id, mobile, limit } = req.query;
    const branchId = req.user.branch_id || 1;

    const searchTerm = (search || q || name || '').trim();
    const specificPatientId = patient_id ? parseInt(patient_id) : null;

    let query = `
      SELECT p.patient_id, p.registration_id, p.full_name as patient_name, p.full_name,
             p.mobile_number, p.age, p.gender, p.village, p.patient_type
      FROM patients p
      WHERE p.branch_id = $1
    `;
    const params = [branchId];

    if (specificPatientId && !isNaN(specificPatientId)) {
      params.push(specificPatientId);
      query += ` AND p.patient_id = $${params.length}`;
    } else if (mobile && mobile.trim()) {
      params.push(`%${mobile.trim()}%`);
      query += ` AND p.mobile_number ILIKE $${params.length}`;
    } else if (searchTerm) {
      const num = parseInt(searchTerm);
      if (!isNaN(num) && String(num) === searchTerm) {
        params.push(num);
        params.push(`%${searchTerm}%`);
        query += ` AND (p.patient_id = $${params.length - 1} OR p.mobile_number ILIKE $${params.length} OR p.full_name ILIKE $${params.length})`;
      } else {
        params.push(`%${searchTerm}%`);
        query += ` AND (p.full_name ILIKE $${params.length} OR p.mobile_number ILIKE $${params.length} OR p.registration_id ILIKE $${params.length})`;
      }
    }

    query += ` ORDER BY p.patient_id DESC LIMIT $${params.length + 1}`;
    params.push(limit ? parseInt(limit) : 50);

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Patients retrieved successfully'));
  } catch (err) {
    console.error('searchPatients error:', err);
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

    // Active or Most Relevant Appointment for Workflow Stage Tracking
    const apptRes = await db.query(`
      SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, a.appointment_time,
             a.appointment_type, a.status as appointment_status, a.created_at,
             u.full_name as doctor_name, d.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE a.patient_id = $1
      ORDER BY 
        CASE 
          WHEN a.status IN ('doctor_completed', 'pro_pending') THEN 1
          WHEN a.status = 'pro_completed' THEN 2
          WHEN a.status = 'completed' THEN 3
          ELSE 4
        END ASC,
        a.appointment_id DESC LIMIT 1
    `, [patientId]);

    const activeAppt = apptRes.rows[0] || null;
    const activeApptId = activeAppt ? activeAppt.appointment_id : null;

    // Relevant Consultation Data (STRIP doctor_notes!)
    const consultRes = await db.query(`
      SELECT c.consultation_id, c.appointment_id, c.doctor_id, u.full_name as doctor_name,
             d.specialization as doctor_specialization,
             c.chief_complaint, c.symptoms, c.general_examination, c.physical_examination,
             c.primary_diagnosis_text, c.secondary_diagnosis_text, c.diagnosis_description,
             c.investigations, c.followup_recommended, c.followup_recommended_date,
             c.followup_instructions, c.pro_required, c.pro_reason, c.pro_instructions,
             c.status as consultation_status, c.created_at
      FROM consultations c
      LEFT JOIN doctors d ON c.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE c.patient_id = $1
      ORDER BY 
        CASE 
          WHEN $2::int IS NOT NULL AND c.appointment_id = $2::int THEN 1
          WHEN c.status = 'completed' THEN 2
          ELSE 3
        END ASC,
        c.consultation_id DESC LIMIT 1
    `, [patientId, activeApptId]);

    const consultation = consultRes.rows[0] || null;

    // Latest or Linked Prescription
    const prescRes = await db.query(`
      SELECT p.id as prescription_id, p.created_at, p.pharmacy_status, p.appointment_id, p.consultation_id,
             json_agg(pi.*) as items
      FROM prescriptions p
      LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
      WHERE p.patient_id = $1
      GROUP BY p.id
      ORDER BY 
        CASE 
          WHEN $2::int IS NOT NULL AND p.appointment_id = $2::int THEN 1
          ELSE 2
        END ASC,
        p.id DESC LIMIT 1
    `, [patientId, activeApptId]);

    // Financials
    const billsRes = await db.query(`
      SELECT b.*,
             COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id AND status = 'success'), 0) as paid_amount,
             CASE
               WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id AND status = 'success'), 0) >= b.final_amount THEN 'paid'
               WHEN COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id AND status = 'success'), 0) > 0 THEN 'partial'
               ELSE 'unpaid'
             END as payment_status,
             u.full_name as created_by_name,
             u.role as created_by_role
      FROM bills b
      LEFT JOIN users u ON b.created_by = u.user_id
      WHERE b.patient_id = $1
      ORDER BY b.bill_id DESC
    `, [patientId]);
    const paymentsRes = await db.query(`SELECT * FROM payments WHERE patient_id = $1 ORDER BY payment_id DESC`, [patientId]);
    const duesRes = await db.query(`SELECT id as due_id, patient_id, bill_id, due_amount, status FROM due_patients WHERE patient_id = $1 ORDER BY id DESC`, [patientId]);

    // CRM
    const callsRes = await db.query(`SELECT * FROM call_records WHERE patient_id = $1 ORDER BY call_id DESC`, [patientId]);
    const followupsRes = await db.query(`SELECT * FROM crm_followups WHERE patient_id = $1 ORDER BY id DESC`, [patientId]);
    const renewalsRes = await db.query(`SELECT * FROM renewals WHERE patient_id = $1 ORDER BY id DESC`, [patientId]);
    const packagesRes = await db.query(`SELECT * FROM packages WHERE patient_id = $1 ORDER BY package_id DESC`, [patientId]);
    // Treatment Plans prescribed by Doctor
    const tpRes = await db.query(`SELECT * FROM treatment_plans WHERE patient_id = $1 ORDER BY treatment_id DESC`, [patientId]);

    // Full Historical Timeline Collections
    const allApptsRes = await db.query(`
      SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, a.appointment_time,
             a.appointment_type, a.status, a.created_at,
             u.full_name as doctor_name, d.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE a.patient_id = $1
      ORDER BY a.appointment_id DESC
    `, [patientId]);

    const allConsultsRes = await db.query(`
      SELECT c.consultation_id, c.appointment_id, c.doctor_id, u.full_name as doctor_name,
             d.specialization as doctor_specialization,
             c.chief_complaint, c.symptoms, c.primary_diagnosis_text, c.secondary_diagnosis_text,
             c.diagnosis_description, c.investigations, c.followup_recommended,
             c.followup_recommended_date, c.followup_instructions, c.pro_required,
             c.pro_reason, c.status, c.created_at
      FROM consultations c
      LEFT JOIN doctors d ON c.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE c.patient_id = $1
      ORDER BY c.consultation_id DESC
    `, [patientId]);

    const allPrescRes = await db.query(`
      SELECT p.id as prescription_id, p.appointment_id, p.consultation_id, p.created_at,
             p.pharmacy_status, u.full_name as doctor_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', pi.id,
                   'medicine_id', pi.medicine_id,
                   'medicine_name', mm.medicine_name,
                   'dosage', pi.dosage,
                   'frequency', pi.frequency,
                   'duration_days', pi.duration_days,
                   'quantity', pi.quantity,
                   'dispense_status', pi.dispense_status,
                   'dispensed_quantity', pi.dispensed_quantity
                 )
               ) FILTER (WHERE pi.id IS NOT NULL), '[]'::json
             ) as items
      FROM prescriptions p
      LEFT JOIN doctors d ON p.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
      LEFT JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE p.patient_id = $1
      GROUP BY p.id, u.full_name
      ORDER BY p.id DESC
    `, [patientId]);

    const overview = {
      patient,
      appointment: activeAppt,
      consultation, // Note: doctor_notes is NOT included here!
      prescription: prescRes.rows[0] || null,
      treatment_plans: tpRes.rows,
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
      },
      history: {
        appointments: allApptsRes.rows,
        consultations: allConsultsRes.rows,
        prescriptions: allPrescRes.rows,
        treatment_plans: tpRes.rows,
        packages: packagesRes.rows,
        bills: billsRes.rows,
        payments: paymentsRes.rows,
        dues: duesRes.rows
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
    if (!prescriptionId) {
      return res.status(400).json(formatResponse(false, null, 'Valid prescription ID is required'));
    }

    const prescRes = await db.query(`
      SELECT pr.*, p.full_name as patient_name, p.mobile_number as patient_mobile,
             COALESCE(u.full_name, 'Doctor') as doctor_name, d.specialization as doctor_specialization
      FROM prescriptions pr
      LEFT JOIN patients p ON pr.patient_id = p.patient_id
      LEFT JOIN doctors d ON pr.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE pr.id = $1
    `, [prescriptionId]);

    if (prescRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Prescription not found'));
    }

    const itemsRes = await db.query(`
      SELECT pi.*, mm.medicine_name, mm.generic_name, mm.strength, mm.medicine_type as dosage_form, mm.medicine_type, mm.category
      FROM prescription_items pi
      LEFT JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE pi.prescription_id = $1
      ORDER BY pi.id ASC
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
    if (!itemId) {
      return res.status(400).json(formatResponse(false, null, 'Invalid prescription item ID'));
    }

    const { field_changed, modified_value, reason } = req.body;
    if (!field_changed || modified_value === undefined || modified_value === null || !reason) {
      return res.status(400).json(formatResponse(false, null, 'field_changed, modified_value, and reason are required'));
    }

    await client.query('BEGIN');
    const itemRes = await client.query(`SELECT * FROM prescription_items WHERE id = $1`, [itemId]);
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription item not found'));
    }

    const item = itemRes.rows[0];

    // Check parent prescription status
    const prescRes = await client.query(`SELECT * FROM prescriptions WHERE id = $1`, [item.prescription_id]);
    if (prescRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Parent prescription not found'));
    }

    const rx = prescRes.rows[0];
    const currentStatus = (rx.pharmacy_status || '').toLowerCase();
    if (['dispensed', 'completed', 'cancelled'].includes(currentStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Prescription is already ${currentStatus} and cannot be modified`));
    }

    const origVal = (field_changed === 'duration' || field_changed === 'duration_days')
      ? String(item.duration_days || 5)
      : (item[field_changed] !== undefined ? String(item[field_changed]) : String(item.quantity || 1));

    const userId = req.user.user_id;
    const role = req.user.role;

    const isOperational = ['duration', 'duration_days', 'quantity'].includes(field_changed);
    const modStatus = isOperational ? 'applied' : 'pending_doctor_confirmation';
    let newQty = item.quantity;
    let newDays = item.duration_days || 5;

    if (isOperational) {
      if (field_changed === 'duration' || field_changed === 'duration_days') {
        newDays = parseInt(modified_value);
        if (isNaN(newDays) || newDays <= 0 || newDays > 365) {
          await client.query('ROLLBACK');
          return res.status(400).json(formatResponse(false, null, 'Supply duration must be a valid number of days between 1 and 365'));
        }

        // Calculate daily multiplier from frequency (e.g. "1 time/day" -> 1, "2 times/day" -> 2, "1-0-1" -> 2)
        let dailyFreq = 1;
        if (item.frequency) {
          const match = item.frequency.match(/\d+/g);
          if (match) {
            dailyFreq = match.reduce((sum, n) => sum + parseInt(n), 0) || 1;
          }
        }
        newQty = dailyFreq * newDays;

        await client.query(`
          UPDATE prescription_items
          SET duration_days = $1, quantity = $2
          WHERE id = $3
        `, [newDays, newQty, itemId]);
      } else if (field_changed === 'quantity') {
        newQty = parseInt(modified_value);
        if (isNaN(newQty) || newQty <= 0 || newQty > 1000) {
          await client.query('ROLLBACK');
          return res.status(400).json(formatResponse(false, null, 'Supply quantity must be a positive number'));
        }
        await client.query(`UPDATE prescription_items SET quantity = $1 WHERE id = $2`, [newQty, itemId]);
      }
    }

    const modRes = await client.query(`
      INSERT INTO prescription_modifications (
        prescription_item_id, field_changed, original_value, modified_value,
        modified_by, modifier_role, reason, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [itemId, field_changed, origVal, String(modified_value), userId, role, reason, modStatus, rx.branch_id || 1]);

    const updatedItemRes = await client.query(`
      SELECT pi.*, mm.medicine_name, mm.generic_name, mm.strength, mm.medicine_type as dosage_form, mm.medicine_type
      FROM prescription_items pi
      LEFT JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE pi.id = $1
    `, [itemId]);

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'PRO Prescription Modification', action: 'Modify Item', recordId: modRes.rows[0].id, newValue: modRes.rows[0] };
    return res.status(201).json(formatResponse(true, {
      ...modRes.rows[0],
      modification: modRes.rows[0],
      updated_item: updatedItemRes.rows[0],
      calculated_quantity: newQty,
      duration_days: newDays
    }, isOperational ? 'Prescription item modified and operational supply updated successfully' : 'Prescription modification submitted for Doctor confirmation'));
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
    const { patient_id, doctor_id, appointment_id, bill_type, items, discount_amount, package_id, coupon_code, coupon_id } = req.body;

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

    let discAmt = parseFloat(discount_amount || 0);
    let resolvedCoupon = null;

    // Atomic Coupon Validation & Lock
    if (coupon_code || coupon_id) {
      const cRes = await client.query(`
        SELECT * FROM coupons 
        WHERE (id = $1 OR LOWER(coupon_code) = LOWER($2))
        FOR UPDATE
      `, [coupon_id ? parseInt(coupon_id, 10) : -1, coupon_code ? String(coupon_code).trim() : '']);

      if (cRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(formatResponse(false, null, 'Referral coupon not found'));
      }

      resolvedCoupon = cRes.rows[0];

      // Verify coupon belongs to this patient (Patient A is referring_patient_id)
      if (parseInt(resolvedCoupon.referring_patient_id, 10) !== parseInt(patient_id, 10)) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(
          false, 
          null, 
          `This referral coupon belongs to Patient #${resolvedCoupon.referring_patient_id} and cannot be used for Patient #${patient_id}`
        ));
      }

      if (resolvedCoupon.status === 'redeemed') {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'This referral coupon has already been redeemed and cannot be reused'));
      }

      if (resolvedCoupon.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, `Cannot redeem coupon with status "${resolvedCoupon.status}"`));
      }

      const vFromStr = resolvedCoupon.valid_from instanceof Date ? resolvedCoupon.valid_from.toISOString().split('T')[0] : String(resolvedCoupon.valid_from).split('T')[0];
      const vUntilStr = resolvedCoupon.valid_until instanceof Date ? resolvedCoupon.valid_until.toISOString().split('T')[0] : String(resolvedCoupon.valid_until).split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      if (vFromStr > today) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, `This coupon is not valid until ${vFromStr}`));
      }

      if (vUntilStr < today) {
        await client.query(`UPDATE coupons SET status = 'expired' WHERE id = $1`, [resolvedCoupon.id]);
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, `This coupon expired on ${vUntilStr}`));
      }

      // Calculate discount server-side
      const discountVal = parseFloat(resolvedCoupon.discount_value);
      let calculatedDiscount = 0;
      if (resolvedCoupon.discount_type === 'percentage') {
        calculatedDiscount = (subtotal * discountVal) / 100;
        if (resolvedCoupon.max_discount_limit && parseFloat(resolvedCoupon.max_discount_limit) > 0) {
          calculatedDiscount = Math.min(calculatedDiscount, parseFloat(resolvedCoupon.max_discount_limit));
        }
      } else {
        calculatedDiscount = discountVal;
      }

      // Cap discount at subtotal
      discAmt = Math.round(Math.min(calculatedDiscount, subtotal) * 100) / 100;
    }

    const totalAmount = Math.max(0, Math.round((subtotal - discAmt) * 100) / 100);

    const billNo = 'BILL-PRO-' + Date.now();
    const createdBy = req.user.user_id;

    const docIdToUse = doctor_id ? parseInt(doctor_id) : 1;
    const billRes = await client.query(`
      INSERT INTO bills (
        bill_number, patient_id, doctor_id, bill_type, amount, discount_amount,
        final_amount, created_by, branch_id, package_id, status, coupon_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, 'created'::bill_status, $10)
      RETURNING *
    `, [billNo, patient_id, docIdToUse, bill_type, subtotal, discAmt, totalAmount, createdBy, package_id || null, resolvedCoupon ? resolvedCoupon.id : null]);

    const bill = billRes.rows[0];
    bill.subtotal = subtotal;
    bill.total_amount = totalAmount;
    bill.paid_amount = 0;
    bill.payment_status = 'pending';
    if (resolvedCoupon) {
      bill.coupon_code = resolvedCoupon.coupon_code;
      bill.coupon_id = resolvedCoupon.id;
      bill.discount_amount = discAmt;
    }

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

    // Atomic Coupon Redemption
    if (resolvedCoupon) {
      await client.query(`
        UPDATE coupons 
        SET status = 'redeemed', updated_by = $1, updated_at = now() 
        WHERE id = $2
      `, [createdBy, resolvedCoupon.id]);

      await client.query(`
        INSERT INTO coupon_redemptions (
          coupon_id, patient_id, bill_id, bill_amount, discount_amount, final_payable, redeemed_by, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        resolvedCoupon.id,
        patient_id,
        bill.bill_id,
        subtotal,
        discAmt,
        totalAmount,
        createdBy,
        `Redeemed in PRO Billing (Bill: ${billNo})`
      ]);
    }

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'PRO Billing', action: 'Create Bill', recordId: bill.bill_id, newValue: bill };
    return res.status(201).json(formatResponse(true, bill, resolvedCoupon ? `Bill created and coupon ${resolvedCoupon.coupon_code} redeemed successfully` : 'Bill created successfully'));
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
      WHERE b.status != 'refunded' AND b.bill_type != 'consultation' AND b.final_amount > COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0)
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
      WHERE b.bill_type != 'consultation'
        AND COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id), 0) > 0
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

    // Business Rule: PRO must never collect or record consultation payments (Receptionist responsibility)
    if (bill.bill_type === 'consultation') {
      await client.query('ROLLBACK');
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Consultation fee payment is handled by Receptionist only'));
    }

    // Compute existing paid amount
    const prevPayRes = await client.query(`SELECT COALESCE(SUM(amount), 0) as prev_paid FROM payments WHERE bill_id = $1`, [bill_id]);
    const prevPaid = parseFloat(prevPayRes.rows[0].prev_paid);

    let totalNewPayment = 0;
    const recordedPayments = [];
    const receivedBy = req.user.user_id;

    const branchId = req.user.branch_id || bill.branch_id || 1;
    let totalCashPayment = 0;

    for (const p of payList) {
      const pAmt = parseFloat(p.amount);
      const pMethod = p.payment_method || p.payment_mode || 'cash';
      totalNewPayment += pAmt;
      if (pMethod === 'cash') totalCashPayment += pAmt;

      const pRes = await client.query(`
        INSERT INTO payments (
          patient_id, bill_id, amount, payment_method, payment_date,
          received_by, branch_id
        ) VALUES ($1, $2, $3, $4, now(), $5, $6)
        RETURNING *
      `, [bill.patient_id, bill_id, pAmt, pMethod, receivedBy, branchId]);
      recordedPayments.push(pRes.rows[0]);
    }

    if (totalCashPayment > 0) {
      await client.query(`
        INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
        VALUES ($1, CURRENT_DATE, 0, $2, 0, 0, $2)
        ON CONFLICT (branch_id, ledger_date)
        DO UPDATE SET
          cash_revenue = cash_ledger.cash_revenue + $2,
          closing_balance = cash_ledger.opening_balance + (cash_ledger.cash_revenue + $2) - cash_ledger.cash_expenditure - cash_ledger.deposited_amount
      `, [branchId, totalCashPayment]);
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
          ) VALUES ($1, $2, $3, $4, $5)
        `, [bill.patient_id, bill_id, shortfall, newStatus === 'partial' ? 'partially_paid' : 'due', branchId]);
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

    const pId = parseInt(patient_id);
    if (isNaN(pId) || pId <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Valid numeric patient_id is required'));
    }

    // Verify patient exists
    const ptCheck = await db.query(`SELECT patient_id, branch_id FROM patients WHERE patient_id = $1`, [pId]);
    if (ptCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Patient ID ${pId} not found`));
    }

    const handledBy = req.user.user_id;
    const branchId = req.user.branch_id || ptCheck.rows[0].branch_id || 1;

    const validInteractions = ['inbound', 'outbound'];
    if (!validInteractions.includes(interaction_type)) {
      return res.status(400).json(formatResponse(false, null, "interaction_type must be either 'inbound' or 'outbound'"));
    }

    const validStatuses = ['connected', 'not_connected', 'busy', 'switched_off', 'interested', 'not_interested', 'callback_requested', 'appointment_booked', 'followup_required', 'completed', 'closed'];
    if (!validStatuses.includes(call_status)) {
      return res.status(400).json(formatResponse(false, null, `Invalid call_status: ${call_status}`));
    }

    const isCallback = call_status === 'callback_requested';
    if (isCallback && !callback_date) {
      return res.status(400).json(formatResponse(false, null, 'callback_date is required when call status is callback_requested'));
    }

    const taskStatus = isCallback ? 'pending' : 'completed';

    let mappedPurpose = String(call_purpose).toLowerCase().replace(/\s+/g, '_');
    if (mappedPurpose.includes('due') || mappedPurpose.includes('payment')) mappedPurpose = 'due_payment';
    else if (mappedPurpose.includes('follow')) mappedPurpose = 'followup';
    else if (mappedPurpose.includes('renew')) mappedPurpose = 'renewal';

    const validPurposes = ['followup','renewal','due_payment','acq','ocnr','appointment','general_enquiry','callback','patient_feedback','other'];
    if (!validPurposes.includes(mappedPurpose)) {
      return res.status(400).json(formatResponse(false, null, `Invalid call_purpose: ${call_purpose}`));
    }

    // Idempotency check: duplicate call submission within 5 seconds
    const dupCheck = await db.query(`
      SELECT call_id FROM call_records
      WHERE patient_id = $1 AND handled_by = $2 AND interaction_type = $3 AND call_status = $4
        AND created_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [pId, handledBy, interaction_type, call_status]);

    if (dupCheck.rows.length > 0) {
      return res.status(409).json(formatResponse(false, null, 'Duplicate call record submission detected. Please wait a moment.'));
    }

    const result = await db.query(`
      INSERT INTO call_records (
        patient_id, interaction_type, call_purpose, call_status,
        callback_date, callback_time, task_status, handled_by, branch_id, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *, to_char(callback_date, 'YYYY-MM-DD') as callback_date
    `, [pId, interaction_type, mappedPurpose, call_status, callback_date || null, callback_time || null, taskStatus, handledBy, branchId, remarks || null]);

    res.locals.auditEntry = { module: 'PRO Calling', action: 'Record Call', recordId: result.rows[0].call_id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Call record created successfully'));
  } catch (err) {
    console.error('createCall error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getTodayCalls(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    const result = await db.query(`
      SELECT c.call_id, c.patient_id, c.lead_id, c.interaction_type, c.call_purpose, c.call_status,
             to_char(c.callback_date, 'YYYY-MM-DD') as callback_date,
             c.callback_time, c.task_status, c.handled_by, c.branch_id, c.remarks,
             c.created_at, c.updated_at,
             COALESCE(p.full_name, 'Patient #' || c.patient_id) as patient_name
      FROM call_records c
      LEFT JOIN patients p ON c.patient_id = p.patient_id
      WHERE c.branch_id = $1 AND DATE(c.created_at) = $2
      ORDER BY c.call_id DESC
    `, [branchId, dateParam]);

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

    const pId = parseInt(patient_id);
    if (isNaN(pId) || pId <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Valid numeric patient_id is required'));
    }

    const ptCheck = await db.query(`SELECT patient_id, branch_id FROM patients WHERE patient_id = $1`, [pId]);
    if (ptCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Patient ID ${pId} not found`));
    }

    const branchId = req.user.branch_id || ptCheck.rows[0].branch_id || 1;
    const assignedUserId = assigned_to ? parseInt(assigned_to) : req.user.user_id;

    // RULE 16: Block assignment to executive role
    const userCheck = await db.query(`SELECT role FROM users WHERE user_id = $1`, [assignedUserId]);
    if (userCheck.rows.length > 0 && userCheck.rows[0].role === 'executive') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: CRM follow-up tasks cannot be assigned to Executive role'));
    }

    const validCategories = ['treatment', 'appointment', 'renewal', 'due', 'acq', 'ocnr', 'general'];
    if (!validCategories.includes(followup_type)) {
      return res.status(400).json(formatResponse(false, null, `Invalid followup_type: ${followup_type}. Must be one of: ${validCategories.join(', ')}`));
    }
    const cat = followup_type;

    // Idempotency check: duplicate followup within 5 seconds
    const dupCheck = await db.query(`
      SELECT id FROM crm_followups
      WHERE patient_id = $1 AND category = $2 AND due_date = $3 AND assigned_to = $4
        AND created_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [pId, cat, followup_date, assignedUserId]);

    if (dupCheck.rows.length > 0) {
      return res.status(409).json(formatResponse(false, null, 'Duplicate follow-up task creation detected. Please wait a moment.'));
    }

    const result = await db.query(`
      INSERT INTO crm_followups (
        patient_id, category, due_date, assigned_to, status, remarks, branch_id
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6)
      RETURNING *, id as followup_id, to_char(due_date, 'YYYY-MM-DD') as due_date
    `, [pId, cat, followup_date, assignedUserId, remarks || purpose, branchId]);

    res.locals.auditEntry = { module: 'PRO CRM', action: 'Create Follow-up', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Follow-up created successfully'));
  } catch (err) {
    console.error('createFollowup error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getFollowups(req, res) {
  try {
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);
    const statusFilter = req.query.status;

    let query = `
      SELECT f.id, f.id as followup_id, f.patient_id, f.category, f.assigned_to, f.status,
             to_char(f.due_date, 'YYYY-MM-DD') as due_date,
             f.remarks, f.branch_id, f.created_at, f.updated_at,
             p.full_name as patient_name, u.full_name as assigned_to_name
      FROM crm_followups f
      JOIN patients p ON f.patient_id = p.patient_id
      LEFT JOIN users u ON f.assigned_to = u.user_id
      WHERE f.branch_id = $1
    `;
    const params = [branchId];

    if (statusFilter && statusFilter !== 'all') {
      params.push(statusFilter);
      query += ` AND f.status = $${params.length}`;
    }

    query += ` ORDER BY f.id DESC`;

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Follow-up tasks retrieved successfully'));
  } catch (err) {
    console.error('getFollowups error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateFollowupStatus(req, res) {
  try {
    const followupId = parseInt(req.params.id);
    const { status, remarks } = req.body;
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    const validStatuses = ['pending', 'completed', 'cancelled'];
    const newStatus = status && validStatuses.includes(status) ? status : 'completed';

    const result = await db.query(`
      UPDATE crm_followups
      SET status = $1, remarks = COALESCE($2, remarks), updated_at = now()
      WHERE id = $3 AND branch_id = $4
      RETURNING *, id as followup_id, to_char(due_date, 'YYYY-MM-DD') as due_date
    `, [newStatus, remarks || null, followupId, branchId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Follow-up task not found'));
    }

    res.locals.auditEntry = { module: 'PRO CRM', action: 'Update Follow-up Status', recordId: followupId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Follow-up status updated successfully'));
  } catch (err) {
    console.error('updateFollowupStatus error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getRenewalsQueue(req, res) {
  try {
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    // Dynamic scan of expired active packages to include in queue
    const expPkgs = await db.query(`
      SELECT pkg.package_id, pkg.patient_id, pkg.package_name, pkg.package_type,
             to_char(pkg.from_date, 'YYYY-MM-DD') as from_date,
             to_char(pkg.to_date, 'YYYY-MM-DD') as to_date,
             pkg.duration_days, pkg.package_amount, pkg.discount_amount, pkg.final_amount,
             pkg.payment_status, pkg.status, pt.full_name as patient_name
      FROM packages pkg
      JOIN patients pt ON pkg.patient_id = pt.patient_id
      WHERE pkg.branch_id = $1 AND pkg.to_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY pkg.package_id DESC
    `, [branchId]);

    const renewalsRes = await db.query(`
      SELECT r.id, r.id as renewal_id, r.patient_id, r.doctor_id,
             to_char(r.renewal_date, 'YYYY-MM-DD') as renewal_date,
             r.amount, r.status, r.package_id, r.created_at,
             pt.full_name as patient_name,
             u.full_name as doctor_name
      FROM renewals r
      JOIN patients pt ON r.patient_id = pt.patient_id
      LEFT JOIN users u ON r.doctor_id = u.user_id
      WHERE pt.branch_id = $1
      ORDER BY r.id DESC
    `, [branchId]);

    return res.json(formatResponse(true, { expired_packages: expPkgs.rows, renewals: renewalsRes.rows }, 'Renewal queue retrieved successfully'));
  } catch (err) {
    console.error('getRenewalsQueue error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createRenewal(req, res) {
  try {
    const { patient_id, package_id, doctor_id, renewal_type, renewal_amount, call_status, remarks } = req.body;
    if (!patient_id || renewal_amount === undefined || renewal_amount === null) {
      return res.status(400).json(formatResponse(false, null, 'patient_id and renewal_amount are required'));
    }

    const pId = parseInt(patient_id);
    if (isNaN(pId) || pId <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Valid numeric patient_id is required'));
    }

    const ptCheck = await db.query(`SELECT patient_id, branch_id FROM patients WHERE patient_id = $1`, [pId]);
    if (ptCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Patient ID ${pId} not found`));
    }

    const renAmt = parseFloat(renewal_amount);
    if (isNaN(renAmt) || renAmt <= 0) {
      return res.status(400).json(formatResponse(false, null, 'renewal_amount must be a positive number greater than 0'));
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

    // Idempotency check: duplicate renewal within 5 seconds
    const dupCheck = await db.query(`
      SELECT id FROM renewals
      WHERE patient_id = $1 AND amount = $2 AND renewal_date = $3
        AND created_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [pId, renAmt, today]);

    if (dupCheck.rows.length > 0) {
      return res.status(409).json(formatResponse(false, null, 'Duplicate renewal recording detected. Please wait a moment.'));
    }

    const result = await db.query(`
      INSERT INTO renewals (
        patient_id, doctor_id, renewal_date, amount, status, package_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *, to_char(renewal_date, 'YYYY-MM-DD') as renewal_date
    `, [pId, docIdToUse, today, renAmt, call_status || 'renewed', validPkgId]);

    res.locals.auditEntry = { module: 'PRO Renewals', action: 'Create Renewal', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Renewal recorded successfully'));
  } catch (err) {
    console.error('createRenewal error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getDuePatients(req, res) {
  try {
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    const result = await db.query(`
      SELECT d.id, d.patient_id, d.bill_id, d.due_amount,
             to_char(d.due_date, 'YYYY-MM-DD') as due_date,
             d.status, d.branch_id, d.created_at,
             p.full_name as patient_name, b.bill_number
      FROM due_patients d
      JOIN patients p ON d.patient_id = p.patient_id
      JOIN bills b ON d.bill_id = b.bill_id
      WHERE d.branch_id = $1
      ORDER BY d.id DESC
    `, [branchId]);

    return res.json(formatResponse(true, result.rows, 'Due patients list retrieved successfully'));
  } catch (err) {
    console.error('getDuePatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getACQPatients(req, res) {
  try {
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    const result = await db.query(`
      SELECT a.id, a.id as acq_id, a.patient_id, a.monthly_plan_amount,
             to_char(a.start_date, 'YYYY-MM-DD') as start_date,
             to_char(a.end_date, 'YYYY-MM-DD') as end_date,
             a.frequency, a.status,
             to_char(a.renewal_date, 'YYYY-MM-DD') as renewal_date,
             a.created_at, a.package_id,
             p.full_name as patient_name
      FROM acq_patients a
      JOIN patients p ON a.patient_id = p.patient_id
      WHERE p.branch_id = $1
      ORDER BY a.id DESC
    `, [branchId]);

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
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    const result = await db.query(`
      UPDATE acq_patients
      SET status = COALESCE($1, status),
          renewal_date = COALESCE($2, renewal_date)
      WHERE id = $3 AND patient_id IN (SELECT patient_id FROM patients WHERE branch_id = $4)
      RETURNING *, id as acq_id, to_char(renewal_date, 'YYYY-MM-DD') as renewal_date
    `, [status, renewal_date, acqId, branchId]);

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
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    const result = await db.query(`
      SELECT o.id, o.id as oc_nr_id, o.patient_id, o.classification, o.reason,
             to_char(o.marked_at, 'YYYY-MM-DD HH24:MI:SS') as marked_at,
             p.full_name as patient_name
      FROM oc_nr_patients o
      JOIN patients p ON o.patient_id = p.patient_id
      WHERE p.branch_id = $1
      ORDER BY o.id DESC
    `, [branchId]);

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

    const pId = parseInt(patient_id);
    if (isNaN(pId) || pId <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Valid numeric patient_id is required'));
    }

    const ptCheck = await db.query(`SELECT patient_id, branch_id FROM patients WHERE patient_id = $1`, [pId]);
    if (ptCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Patient ID ${pId} not found`));
    }

    const reasonText = reason || reason_not_continuing || remarks || null;
    let cls = String(classification || 'oc').toLowerCase();
    if (cls !== 'oc' && cls !== 'nr') {
      return res.status(400).json(formatResponse(false, null, "classification must be either 'oc' or 'nr'"));
    }

    // Idempotency check: duplicate OC/NR within 5 seconds
    const dupCheck = await db.query(`
      SELECT id FROM oc_nr_patients
      WHERE patient_id = $1 AND classification = $2
        AND marked_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [pId, cls]);

    if (dupCheck.rows.length > 0) {
      return res.status(409).json(formatResponse(false, null, 'Duplicate OC/NR recording detected. Please wait a moment.'));
    }

    const result = await db.query(`
      INSERT INTO oc_nr_patients (
        patient_id, classification, reason, marked_at
      ) VALUES ($1, $2, $3, now())
      RETURNING *, id as oc_nr_id, to_char(marked_at, 'YYYY-MM-DD HH24:MI:SS') as marked_at
    `, [pId, cls, reasonText]);

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
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    // Compute opening balance from previous day's closing balance for this branch
    const prevRes = await db.query(`
      SELECT closing_balance FROM cash_ledger WHERE branch_id = $1 AND ledger_date < $2 ORDER BY ledger_date DESC LIMIT 1
    `, [branchId, dateParam]);

    const openingCash = prevRes.rows.length > 0 ? parseFloat(prevRes.rows[0].closing_balance) : 0.00;

    return res.json(formatResponse(true, { date: dateParam, opening_cash: openingCash, branch_id: branchId }, 'Opening cash balance retrieved successfully'));
  } catch (err) {
    console.error('getOpeningBalance error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getCashRevenue(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as cash_revenue
      FROM payments
      WHERE payment_method = 'cash' AND DATE(payment_date) = $1 AND branch_id = $2
    `, [dateParam, branchId]);

    return res.json(formatResponse(true, { date: dateParam, cash_revenue: parseFloat(result.rows[0].cash_revenue), branch_id: branchId }, 'Cash revenue retrieved successfully'));
  } catch (err) {
    console.error('getCashRevenue error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function createExpenditure(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { category, description, amount, remarks } = req.body;
    if (!category || !category.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Expense category is required'));
    }
    if (!description || !description.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Expense description is required'));
    }
    if (amount === undefined || amount === null || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Expense amount must be a positive number greater than 0'));
    }

    const expAmt = parseFloat(amount);
    const enteredBy = req.user.user_id;
    const branchId = req.user.branch_id || 1;
    const today = new Date().toISOString().split('T')[0];

    // Idempotency check: duplicate submission within 5 seconds
    const dupCheck = await client.query(`
      SELECT id FROM expenditures
      WHERE branch_id = $1 AND entered_by = $2 AND expense_category = $3 AND amount = $4
        AND created_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [branchId, enteredBy, category.trim(), expAmt]);

    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(formatResponse(false, null, 'Duplicate expenditure submission detected. Please wait a moment.'));
    }

    const result = await client.query(`
      INSERT INTO expenditures (
        expense_date, expense_category, description, amount, payment_mode, entered_by, branch_id, remarks
      ) VALUES ($1, $2, $3, $4, 'cash', $5, $6, $7)
      RETURNING *
    `, [today, category.trim(), description.trim(), expAmt, enteredBy, branchId, remarks || null]);

    // Update cash ledger
    await client.query(`
      INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
      VALUES ($1, $2, 0, 0, $3, 0, 0 - $3::numeric)
      ON CONFLICT (branch_id, ledger_date)
      DO UPDATE SET
        cash_expenditure = cash_ledger.cash_expenditure + $3,
        closing_balance = cash_ledger.opening_balance + cash_ledger.cash_revenue - (cash_ledger.cash_expenditure + $3) - cash_ledger.deposited_amount
    `, [branchId, today, expAmt]);

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'PRO Accountant', action: 'Create Cash Expenditure', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Cash expenditure recorded successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createExpenditure error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getClosingBalance(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    // Opening
    const prevRes = await db.query(`SELECT closing_balance FROM cash_ledger WHERE branch_id = $1 AND ledger_date < $2 ORDER BY ledger_date DESC LIMIT 1`, [branchId, dateParam]);
    const openingCash = prevRes.rows.length > 0 ? parseFloat(prevRes.rows[0].closing_balance) : 0.00;

    // Cash Revenue
    const revRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_rev FROM payments WHERE payment_method = 'cash' AND DATE(payment_date) = $1 AND branch_id = $2`, [dateParam, branchId]);
    const cashRev = parseFloat(revRes.rows[0].cash_rev);

    // Cash Expenditure
    const expRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_exp FROM expenditures WHERE payment_mode = 'cash' AND expense_date = $1 AND branch_id = $2`, [dateParam, branchId]);
    const cashExp = parseFloat(expRes.rows[0].cash_exp);

    const closingCash = openingCash + cashRev - cashExp;

    return res.json(formatResponse(true, {
      date: dateParam,
      branch_id: branchId,
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
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { deposit_amount, deposit_reference, remarks } = req.body;
    if (deposit_amount === undefined || deposit_amount === null || isNaN(parseFloat(deposit_amount)) || parseFloat(deposit_amount) <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Deposit amount must be a positive number greater than 0'));
    }

    const depAmt = parseFloat(deposit_amount);
    const depositedBy = req.user.user_id;
    const branchId = req.user.branch_id || 1;
    const today = new Date().toISOString().split('T')[0];

    // Compute Opening Cash
    const prevRes = await client.query(`SELECT closing_balance FROM cash_ledger WHERE branch_id = $1 AND ledger_date < $2 ORDER BY ledger_date DESC LIMIT 1`, [branchId, today]);
    const openingCash = prevRes.rows.length > 0 ? parseFloat(prevRes.rows[0].closing_balance) : 0.00;

    // Compute Cash Revenue
    const revRes = await client.query(`SELECT COALESCE(SUM(amount), 0) as cash_rev FROM payments WHERE payment_method = 'cash' AND DATE(payment_date) = $1 AND branch_id = $2`, [today, branchId]);
    const cashRev = parseFloat(revRes.rows[0].cash_rev);

    // Compute Cash Expenditure
    const expRes = await client.query(`SELECT COALESCE(SUM(amount), 0) as cash_exp FROM expenditures WHERE payment_mode = 'cash' AND expense_date = $1 AND branch_id = $2`, [today, branchId]);
    const cashExp = parseFloat(expRes.rows[0].cash_exp);

    // Previous deposits today
    const depRes = await client.query(`SELECT COALESCE(SUM(deposited_amount), 0) as total_dep FROM cash_deposits WHERE DATE(deposit_date) = $1 AND branch_id = $2`, [today, branchId]);
    const prevDeposited = parseFloat(depRes.rows[0].total_dep);

    const availableCash = openingCash + cashRev - cashExp - prevDeposited;

    if (depAmt > availableCash) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Deposit amount (${depAmt}) cannot exceed available cash in drawer (${availableCash})`));
    }

    // Idempotency check: duplicate submission within 5 seconds
    const dupCheck = await client.query(`
      SELECT id FROM cash_deposits
      WHERE branch_id = $1 AND deposited_by = $2 AND deposited_amount = $3
        AND created_at >= NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `, [branchId, depositedBy, depAmt]);

    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(formatResponse(false, null, 'Duplicate cash deposit submission detected. Please wait a moment.'));
    }

    const totalDeposited = prevDeposited + depAmt;
    const closingCash = openingCash + cashRev - cashExp - totalDeposited;

    const result = await client.query(`
      INSERT INTO cash_deposits (
        deposit_date, opening_balance, cash_revenue, cash_expenditure, available_cash,
        deposited_amount, deposit_reference, deposited_by, closing_balance, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *, id as deposit_id
    `, [today, openingCash, cashRev, cashExp, availableCash, depAmt, deposit_reference || null, depositedBy, closingCash, branchId]);

    // Update cash ledger
    await client.query(`
      INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (branch_id, ledger_date)
      DO UPDATE SET
        deposited_amount = $6,
        closing_balance = $7
    `, [branchId, today, openingCash, cashRev, cashExp, totalDeposited, closingCash]);

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'PRO Accountant', action: 'Deposit Cash', recordId: result.rows[0].id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Cash deposit recorded successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('depositCash error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getDailyCashSummary(req, res) {
  try {
    const dateParam = req.query.date || new Date().toISOString().split('T')[0];
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    // Opening
    const prevRes = await db.query(`SELECT closing_balance FROM cash_ledger WHERE branch_id = $1 AND ledger_date < $2 ORDER BY ledger_date DESC LIMIT 1`, [branchId, dateParam]);
    const openingCash = prevRes.rows.length > 0 ? parseFloat(prevRes.rows[0].closing_balance) : 0.00;

    // Cash Revenue
    const revRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_rev FROM payments WHERE payment_method = 'cash' AND DATE(payment_date) = $1 AND branch_id = $2`, [dateParam, branchId]);
    const cashRev = parseFloat(revRes.rows[0].cash_rev);

    // Cash Expenditure
    const expRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as cash_exp FROM expenditures WHERE payment_mode = 'cash' AND expense_date = $1 AND branch_id = $2`, [dateParam, branchId]);
    const cashExp = parseFloat(expRes.rows[0].cash_exp);

    const expectedCash = openingCash + cashRev - cashExp;

    // Cash Deposited
    const depRes = await db.query(`SELECT COALESCE(SUM(deposited_amount), 0) as total_dep FROM cash_deposits WHERE DATE(deposit_date) = $1 AND branch_id = $2`, [dateParam, branchId]);
    const cashDeposited = parseFloat(depRes.rows[0].total_dep);
    const closingCash = expectedCash - cashDeposited;

    // Method Breakdown
    const methodRes = await db.query(`
      SELECT payment_method, COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE DATE(payment_date) = $1 AND branch_id = $2
      GROUP BY payment_method
    `, [dateParam, branchId]);

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
      branch_id: branchId,
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
    const branchId = (req.user.role === 'super_admin' && req.query.branch_id) ? parseInt(req.query.branch_id) : (req.user.branch_id || 1);

    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as grand_total
      FROM payments
      WHERE DATE(payment_date) = $1 AND branch_id = $2
    `, [dateParam, branchId]);

    return res.json(formatResponse(true, { date: dateParam, grand_total: parseFloat(result.rows[0].grand_total), branch_id: branchId }, 'Grand total retrieved successfully'));
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
    if (!patientId || isNaN(patientId)) {
      return res.status(400).json(formatResponse(false, null, 'Valid patient ID is required'));
    }

    // 1. Doctor consultation completed check
    const consultRes = await db.query(`
      SELECT c.consultation_id, c.appointment_id, c.status, c.primary_diagnosis_text,
             c.chief_complaint, u.full_name as doctor_name
      FROM consultations c
      LEFT JOIN doctors d ON c.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE c.patient_id = $1 AND c.status = 'completed'
      ORDER BY c.consultation_id DESC LIMIT 1
    `, [patientId]);

    const apptCheckRes = await db.query(`
      SELECT a.appointment_id, a.status, u.full_name as doctor_name
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE a.patient_id = $1 AND a.status IN ('doctor_completed', 'pro_pending', 'pro_completed', 'completed')
      ORDER BY a.appointment_id DESC LIMIT 1
    `, [patientId]);

    const completedConsult = consultRes.rows[0] || null;
    const completedAppt = apptCheckRes.rows[0] || null;
    const doctorConsultationCompleted = !!(completedConsult || completedAppt);

    // 2. Clinical Diagnosis Reviewed check
    const diagRes = await db.query(`
      SELECT c.primary_diagnosis_text, c.secondary_diagnosis_text, c.primary_diagnosis_id
      FROM consultations c
      WHERE c.patient_id = $1 AND (c.primary_diagnosis_text IS NOT NULL OR c.primary_diagnosis_id IS NOT NULL OR c.secondary_diagnosis_text IS NOT NULL)
      ORDER BY c.consultation_id DESC LIMIT 1
    `, [patientId]);
    const diagnosisReviewed = diagRes.rows.length > 0;
    const diagnosisText = diagRes.rows[0]?.primary_diagnosis_text || diagRes.rows[0]?.secondary_diagnosis_text || null;

    // 3. Prescription Item Details Reviewed check
    const prescRes = await db.query(`
      SELECT p.id, COUNT(pi.id) as item_count
      FROM prescriptions p
      JOIN prescription_items pi ON p.id = pi.prescription_id
      WHERE p.patient_id = $1
      GROUP BY p.id
      ORDER BY p.id DESC LIMIT 1
    `, [patientId]);
    const prescriptionReviewed = prescRes.rows.length > 0;
    const prescriptionItemCount = prescRes.rows.length > 0 ? parseInt(prescRes.rows[0].item_count) : 0;

    // 4. Treatment / Package Details Confirmed check
    const tpRes = await db.query(`SELECT treatment_id, treatment_name FROM treatment_plans WHERE patient_id = $1 ORDER BY treatment_id DESC LIMIT 1`, [patientId]);
    const pkgRes = await db.query(`SELECT package_id, package_name FROM packages WHERE patient_id = $1 ORDER BY package_id DESC LIMIT 1`, [patientId]);
    const treatBillRes = await db.query(`SELECT bill_id, bill_number FROM bills WHERE patient_id = $1 AND bill_type IN ('treatment', 'package') ORDER BY bill_id DESC LIMIT 1`, [patientId]);
    const treatmentPackageConfirmed = tpRes.rows.length > 0 || pkgRes.rows.length > 0 || treatBillRes.rows.length > 0;

    // 5. Treatment / Package Invoice Generated check (non-consultation bill)
    const billsRes = await db.query(`
      SELECT bill_id, bill_number, amount, final_amount, status, bill_type
      FROM bills
      WHERE patient_id = $1 AND bill_type != 'consultation'
      ORDER BY bill_id DESC LIMIT 1
    `, [patientId]);
    const billingCompleted = billsRes.rows.length > 0;
    const latestBill = billsRes.rows[0] || null;

    // 6. Payment or Outstanding Due Recorded check
    const payRes = await db.query(`
      SELECT payment_id, amount, payment_method, payment_date
      FROM payments
      WHERE patient_id = $1 AND status = 'success'
      ORDER BY payment_id DESC LIMIT 1
    `, [patientId]);
    const dueRes = await db.query(`
      SELECT id, due_amount, status
      FROM due_patients
      WHERE patient_id = $1
      ORDER BY id DESC LIMIT 1
    `, [patientId]);
    const paymentOrDueRecorded = payRes.rows.length > 0 || dueRes.rows.length > 0;

    const checklist = {
      doctor_consultation_completed: doctorConsultationCompleted,
      diagnosis_reviewed: diagnosisReviewed,
      prescription_reviewed: prescriptionReviewed,
      treatment_package_confirmed: treatmentPackageConfirmed,
      billing_completed: billingCompleted,
      payment_or_due_recorded: paymentOrDueRecorded
    };

    const metadata = {
      doctor_name: completedConsult?.doctor_name || completedAppt?.doctor_name || null,
      diagnosis: diagnosisText,
      prescription_id: prescRes.rows[0]?.id || null,
      prescription_items_count: prescriptionItemCount,
      treatment_name: tpRes.rows[0]?.treatment_name || pkgRes.rows[0]?.package_name || null,
      bill_id: latestBill?.bill_id || null,
      bill_number: latestBill?.bill_number || null,
      bill_final_amount: latestBill ? parseFloat(latestBill.final_amount) : 0,
      payment_amount: payRes.rows[0] ? parseFloat(payRes.rows[0].amount) : 0,
      due_amount: dueRes.rows[0] ? parseFloat(dueRes.rows[0].due_amount) : 0
    };

    const allSatisfied = Object.values(checklist).every(val => val === true);

    return res.json(formatResponse(true, {
      patient_id: patientId,
      checklist,
      metadata,
      ready_for_pro_completion: allSatisfied
    }, 'PRO completion checklist retrieved successfully'));
  } catch (err) {
    console.error('getPROChecklist error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function completePRO(req, res) {
  try {
    const patientId = parseInt(req.params.id);
    if (!patientId || isNaN(patientId)) {
      return res.status(400).json(formatResponse(false, null, 'Valid patient ID is required'));
    }

    // Validate checklist (treatment/package billing required)
    const billsRes = await db.query(`SELECT bill_id FROM bills WHERE patient_id = $1 AND bill_type != 'consultation'`, [patientId]);
    const missingItems = [];
    if (billsRes.rows.length === 0) missingItems.push('Treatment/Package billing invoice');

    const payRes = await db.query(`SELECT payment_id FROM payments WHERE patient_id = $1 AND status = 'success'`, [patientId]);
    const dueRes = await db.query(`SELECT id FROM due_patients WHERE patient_id = $1`, [patientId]);
    if (payRes.rows.length === 0 && dueRes.rows.length === 0) {
      missingItems.push('Payment collection or recorded outstanding due balance');
    }

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

    let updatedAppt = apptRes.rows[0] || null;
    if (!updatedAppt) {
      const existingAppt = await db.query(`
        SELECT * FROM appointments
        WHERE patient_id = $1 AND status = 'pro_completed'
        ORDER BY appointment_id DESC LIMIT 1
      `, [patientId]);
      updatedAppt = existingAppt.rows[0] || null;
    }

    res.locals.auditEntry = { module: 'PRO Completion', action: 'Complete PRO Handoff', recordId: patientId, newValue: updatedAppt };
    return res.json(formatResponse(true, {
      patient_id: patientId,
      appointment: updatedAppt,
      pharmacy_queue_status: 'unlocked'
    }, 'PRO completion verified successfully. Prescription released to Pharmacy queue.'));
  } catch (err) {
    console.error('completePRO error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 13b. Dedicated Patient Operational History
async function getPatientHistory(req, res) {
  try {
    const patientId = parseInt(req.params.id);
    if (!patientId || isNaN(patientId)) {
      return res.status(400).json(formatResponse(false, null, 'Valid patient ID is required'));
    }

    const ptRes = await db.query(`SELECT * FROM patients WHERE patient_id = $1`, [patientId]);
    if (ptRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Patient not found'));
    }
    const patient = ptRes.rows[0];

    // All Appointments
    const apptsRes = await db.query(`
      SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date, a.appointment_time,
             a.appointment_type, a.status, a.created_at,
             u.full_name as doctor_name, d.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE a.patient_id = $1
      ORDER BY a.appointment_id DESC
    `, [patientId]);

    // All Consultations (confidentiality protected: doctor_notes stripped)
    const consultsRes = await db.query(`
      SELECT c.consultation_id, c.appointment_id, c.doctor_id, u.full_name as doctor_name,
             d.specialization as doctor_specialization,
             c.chief_complaint, c.symptoms, c.primary_diagnosis_text, c.secondary_diagnosis_text,
             c.diagnosis_description, c.investigations, c.followup_recommended,
             c.followup_recommended_date, c.followup_instructions, c.pro_required,
             c.pro_reason, c.status, c.created_at
      FROM consultations c
      LEFT JOIN doctors d ON c.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE c.patient_id = $1
      ORDER BY c.consultation_id DESC
    `, [patientId]);

    // All Prescriptions with Items & Dispensing Status
    const prescRes = await db.query(`
      SELECT p.id as prescription_id, p.appointment_id, p.consultation_id, p.created_at,
             p.pharmacy_status, u.full_name as doctor_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', pi.id,
                   'medicine_id', pi.medicine_id,
                   'medicine_name', mm.medicine_name,
                   'dosage', pi.dosage,
                   'frequency', pi.frequency,
                   'duration_days', pi.duration_days,
                   'quantity', pi.quantity,
                   'dispense_status', pi.dispense_status,
                   'dispensed_quantity', pi.dispensed_quantity
                 )
               ) FILTER (WHERE pi.id IS NOT NULL), '[]'::json
             ) as items
      FROM prescriptions p
      LEFT JOIN doctors d ON p.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
      LEFT JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE p.patient_id = $1
      GROUP BY p.id, u.full_name
      ORDER BY p.id DESC
    `, [patientId]);

    // Treatment Plans
    const tpRes = await db.query(`
      SELECT tp.*, u.full_name as doctor_name
      FROM treatment_plans tp
      LEFT JOIN doctors d ON tp.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE tp.patient_id = $1
      ORDER BY tp.treatment_id DESC
    `, [patientId]);

    // Packages
    const pkgRes = await db.query(`SELECT * FROM packages WHERE patient_id = $1 ORDER BY package_id DESC`, [patientId]);

    // Bills with payments & dues
    const billsRes = await db.query(`
      SELECT b.*,
             COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id AND status = 'success'), 0) as paid_amount,
             COALESCE((SELECT due_amount FROM due_patients WHERE bill_id = b.bill_id AND status = 'pending' LIMIT 1), 0) as due_amount,
             u.full_name as created_by_name
      FROM bills b
      LEFT JOIN users u ON b.created_by = u.user_id
      WHERE b.patient_id = $1
      ORDER BY b.bill_id DESC
    `, [patientId]);

    // Payments
    const payRes = await db.query(`
      SELECT p.*, u.full_name as received_by_name
      FROM payments p
      LEFT JOIN users u ON p.received_by = u.user_id
      WHERE p.patient_id = $1
      ORDER BY p.payment_id DESC
    `, [patientId]);

    // Dues
    const duesRes = await db.query(`SELECT * FROM due_patients WHERE patient_id = $1 ORDER BY id DESC`, [patientId]);

    return res.json(formatResponse(true, {
      patient,
      appointments: apptsRes.rows,
      consultations: consultsRes.rows,
      prescriptions: prescRes.rows,
      treatment_plans: tpRes.rows,
      packages: pkgRes.rows,
      bills: billsRes.rows,
      payments: payRes.rows,
      dues: duesRes.rows
    }, 'Patient operational history retrieved successfully'));
  } catch (err) {
    console.error('getPatientHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 13c. Authoritative Bill / Invoice Details
async function getBillDetails(req, res) {
  try {
    const billId = parseInt(req.params.id);
    if (!billId || isNaN(billId)) {
      return res.status(400).json(formatResponse(false, null, 'Valid bill ID is required'));
    }

    const billRes = await db.query(`
      SELECT b.*,
             p.full_name as patient_name, p.registration_id, p.mobile_number, p.age, p.gender,
             COALESCE(p.village, p.mandal, 'Karimnagar') as patient_location,
             COALESCE(doc_u.full_name, 'Doctor') as doctor_name,
             d.specialization as doctor_specialization,
             COALESCE(rec_u.full_name, 'PRO Desk') as created_by_name,
             rec_u.employee_id as created_by_employee_id
      FROM bills b
      JOIN patients p ON b.patient_id = p.patient_id
      LEFT JOIN doctors d ON b.doctor_id = d.doctor_id
      LEFT JOIN users doc_u ON d.user_id = doc_u.user_id
      LEFT JOIN users rec_u ON b.created_by = rec_u.user_id
      WHERE b.bill_id = $1
    `, [billId]);

    if (billRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Bill not found'));
    }

    const bill = billRes.rows[0];

    // Fetch line items from bill_items
    const itemsRes = await db.query(`
      SELECT id, charge_type, description, amount
      FROM bill_items
      WHERE bill_id = $1
      ORDER BY id ASC
    `, [billId]);

    // Fetch payments
    const paymentsRes = await db.query(`
      SELECT payment_id, payment_method, amount, payment_date, status, received_by
      FROM payments
      WHERE bill_id = $1 AND status = 'success'
      ORDER BY payment_id ASC
    `, [billId]);

    // Fetch dues
    const dueRes = await db.query(`
      SELECT id as due_id, due_amount, due_date, status
      FROM due_patients
      WHERE bill_id = $1
      ORDER BY id DESC LIMIT 1
    `, [billId]);

    const totalPaid = paymentsRes.rows.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const finalAmount = parseFloat(bill.final_amount || 0);
    const remainingDue = dueRes.rows.length > 0 ? parseFloat(dueRes.rows[0].due_amount) : Math.max(0, finalAmount - totalPaid);

    const invoiceData = {
      ...bill,
      items: itemsRes.rows.length > 0 ? itemsRes.rows : [
        { id: 1, charge_type: bill.bill_type === 'treatment' ? 'Treatment' : 'Package', description: `${bill.bill_type.toUpperCase()} Charges`, amount: bill.amount }
      ],
      payments: paymentsRes.rows,
      paid_amount: totalPaid,
      due_amount: remainingDue,
      payment_status: remainingDue <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'
    };

    return res.json(formatResponse(true, invoiceData, 'Bill details retrieved successfully'));
  } catch (err) {
    console.error('getBillDetails error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 13d. PRO Operational Reports
async function getOperationalReports(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const { from_date, to_date, bill_type, payment_method } = req.query;

    let billDateCond = '';
    const billParams = [branchId];
    if (from_date) {
      billParams.push(from_date);
      billDateCond += ` AND DATE(b.created_at) >= $${billParams.length}`;
    }
    if (to_date) {
      billParams.push(to_date);
      billDateCond += ` AND DATE(b.created_at) <= $${billParams.length}`;
    }
    if (bill_type && bill_type !== 'all') {
      billParams.push(bill_type);
      billDateCond += ` AND b.bill_type = $${billParams.length}`;
    }

    // Bills Summary
    const billsRes = await db.query(`
      SELECT b.bill_id, b.bill_number, b.patient_id, b.bill_type, b.final_amount, b.created_at,
             p.full_name as patient_name, p.registration_id,
             COALESCE(doc_u.full_name, 'Doctor') as doctor_name,
             COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id AND status = 'success'), 0) as paid_amount
      FROM bills b
      JOIN patients p ON b.patient_id = p.patient_id
      LEFT JOIN doctors d ON b.doctor_id = d.doctor_id
      LEFT JOIN users doc_u ON d.user_id = doc_u.user_id
      WHERE b.branch_id = $1 ${billDateCond}
      ORDER BY b.bill_id DESC
      LIMIT 100
    `, billParams);

    // Authoritative totals from Postgres
    const totalBilledRes = await db.query(`
      SELECT COALESCE(SUM(b.final_amount), 0) as total_billed, COUNT(*) as bills_count
      FROM bills b
      WHERE b.branch_id = $1 ${billDateCond}
    `, billParams);

    // Payments Summary
    let payDateCond = '';
    const payParams = [branchId];
    if (from_date) {
      payParams.push(from_date);
      payDateCond += ` AND DATE(py.payment_date) >= $${payParams.length}`;
    }
    if (to_date) {
      payParams.push(to_date);
      payDateCond += ` AND DATE(py.payment_date) <= $${payParams.length}`;
    }
    if (payment_method && payment_method !== 'all') {
      payParams.push(payment_method);
      payDateCond += ` AND py.payment_method = $${payParams.length}`;
    }

    const totalCollectedRes = await db.query(`
      SELECT COALESCE(SUM(py.amount), 0) as total_collected, COUNT(*) as payments_count
      FROM payments py
      WHERE py.branch_id = $1 AND py.status = 'success' ${payDateCond}
    `, payParams);

    // Method breakdown
    const methodBreakdownRes = await db.query(`
      SELECT py.payment_method, COALESCE(SUM(py.amount), 0) as amount, COUNT(*) as count
      FROM payments py
      WHERE py.branch_id = $1 AND py.status = 'success' ${payDateCond}
      GROUP BY py.payment_method
    `, payParams);

    // Category breakdown
    const categoryBreakdownRes = await db.query(`
      SELECT b.bill_type, COALESCE(SUM(b.final_amount), 0) as amount, COUNT(*) as count
      FROM bills b
      WHERE b.branch_id = $1 ${billDateCond}
      GROUP BY b.bill_type
    `, billParams);

    // Total Due
    const totalDueRes = await db.query(`
      SELECT COALESCE(SUM(due_amount), 0) as total_due, COUNT(*) as due_count
      FROM due_patients
      WHERE branch_id = $1 AND status = 'pending'
    `, [branchId]);

    // Volume stats
    const proCompletedRes = await db.query(`
      SELECT COUNT(*) as count FROM appointments WHERE branch_id = $1 AND status = 'pro_completed'
    `, [branchId]);

    const report = {
      summary: {
        total_billed: parseFloat(totalBilledRes.rows[0].total_billed),
        bills_count: parseInt(totalBilledRes.rows[0].bills_count),
        total_collected: parseFloat(totalCollectedRes.rows[0].total_collected),
        payments_count: parseInt(totalCollectedRes.rows[0].payments_count),
        total_due: parseFloat(totalDueRes.rows[0].total_due),
        due_count: parseInt(totalDueRes.rows[0].due_count),
        pro_completed_count: parseInt(proCompletedRes.rows[0].count)
      },
      category_breakdown: categoryBreakdownRes.rows.map(r => ({
        category: r.bill_type,
        amount: parseFloat(r.amount),
        count: parseInt(r.count)
      })),
      payment_methods: methodBreakdownRes.rows.map(r => ({
        method: r.payment_method,
        amount: parseFloat(r.amount),
        count: parseInt(r.count)
      })),
      bills: billsRes.rows
    };

    return res.json(formatResponse(true, report, 'PRO operational report retrieved successfully'));
  } catch (err) {
    console.error('getOperationalReports error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 14. PRO Profile
async function getProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const result = await db.query(`
      SELECT u.user_id, u.employee_id, u.full_name, u.username, u.mobile_number, u.email,
             u.gender, to_char(u.date_of_joining, 'YYYY-MM-DD') as date_of_joining,
             u.department, u.designation, u.role, u.status, u.branch_id,
             b.branch_name, b.branch_code
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      WHERE u.user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'PRO user profile not found'));
    }

    const profileData = result.rows[0];

    // Fetch dynamic permissions from pro_manager_permissions table
    const permRes = await db.query(`
      SELECT * FROM pro_manager_permissions WHERE user_id = $1
    `, [userId]);

    let permissions = [];
    if (permRes.rows.length > 0) {
      const p = permRes.rows[0];
      if (p.counselling) permissions.push('Prescription & Treatment Review');
      if (p.renewals) permissions.push('Treatment Package Enrollments');
      if (p.billing) permissions.push('Patient Billing & Invoicing (Non-consultation)');
      if (p.payment) permissions.push('Payment Collection & Attribution');
      if (p.accountant) permissions.push('Cash Drawer Reconciliation & Bank Deposits');
      if (p.crm || p.followup) permissions.push('CRM Patient Calling & Follow-up Scheduling');
      if (p.billing) permissions.push('Prescription Modifications (Days / Quantity)');
      if (p.billing && p.payment) permissions.push('PRO Completion & Pharmacy Queue Release');
      profileData.module_permissions = p;
    } else {
      // Role default permissions if no individual override exists
      permissions = [
        'Prescription & Treatment Review',
        'Treatment Package Enrollments',
        'Patient Billing & Invoicing (Non-consultation)',
        'Payment Collection & Attribution',
        'Cash Drawer Reconciliation & Bank Deposits',
        'CRM Patient Calling & Follow-up Scheduling',
        'Prescription Modifications (Days / Quantity)',
        'PRO Completion & Pharmacy Queue Release'
      ];
      profileData.module_permissions = null;
    }

    profileData.permissions = permissions;

    return res.json(formatResponse(true, profileData, 'PRO profile retrieved successfully'));
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const { mobile_number, email } = req.body;

    const hasMobile = mobile_number !== undefined && mobile_number !== null && String(mobile_number).trim() !== '';
    const hasEmail = email !== undefined && email !== null && String(email).trim() !== '';

    if (!hasMobile && !hasEmail) {
      return res.status(400).json(formatResponse(false, null, 'At least one contact field (mobile number or email) must be provided'));
    }

    let cleanMobile = null;
    if (hasMobile) {
      cleanMobile = String(mobile_number).trim();
      if (!/^\d{10,15}$/.test(cleanMobile)) {
        return res.status(400).json(formatResponse(false, null, 'Invalid mobile number format. Must be between 10 and 15 digits'));
      }
      const dupMobile = await db.query('SELECT user_id FROM users WHERE mobile_number = $1 AND user_id != $2', [cleanMobile, userId]);
      if (dupMobile.rows.length > 0) {
        return res.status(409).json(formatResponse(false, null, 'Mobile number is already registered to another account'));
      }
    }

    let cleanEmail = null;
    if (hasEmail) {
      cleanEmail = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json(formatResponse(false, null, 'Invalid email format'));
      }
      const dupEmail = await db.query('SELECT user_id FROM users WHERE LOWER(email) = $1 AND user_id != $2', [cleanEmail, userId]);
      if (dupEmail.rows.length > 0) {
        return res.status(409).json(formatResponse(false, null, 'Email address is already registered to another account'));
      }
    }

    // PRO can update personal contact details (mobile_number, email). Professional fields are admin-managed.
    const result = await db.query(`
      UPDATE users
      SET mobile_number = COALESCE($1, mobile_number),
          email = COALESCE($2, email),
          updated_at = now()
      WHERE user_id = $3
      RETURNING user_id, employee_id, full_name, username, mobile_number, email, role, status
    `, [cleanMobile, cleanEmail, userId]);

    res.locals.auditEntry = { module: 'PRO Profile', action: 'Update Contact Details', recordId: userId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'PRO contact details updated successfully'));
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getDashboard,
  getPatientQueue,
  searchPatients,
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
  updateFollowupStatus,
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
  completePRO,
  getPatientHistory,
  getBillDetails,
  getOperationalReports,
  getProfile,
  updateProfile
};
