const db = require('../db');
const { formatResponse } = require('../utils/helpers');

// Helper to generate padded sequential code
async function generateId(prefix, tableName) {
  const res = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  const nextNum = parseInt(res.rows[0].count) + 1;
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

// 3.2 Dashboard
async function getDashboard(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const today = new Date().toISOString().split('T')[0];

    const newPatients = await db.query(`
      SELECT COUNT(*) FROM patients WHERE branch_id = $1 AND DATE(created_at) = $2
    `, [branchId, today]);

    const appointments = await db.query(`
      SELECT COUNT(*) FROM appointments WHERE branch_id = $1 AND appointment_date = $2
    `, [branchId, today]);

    const waitingPatients = await db.query(`
      SELECT COUNT(*) FROM appointments WHERE branch_id = $1 AND appointment_date = $2 AND status = 'checked_in'
    `, [branchId, today]);

    const enquiries = await db.query(`
      SELECT COUNT(*) FROM leads WHERE branch_id = $1 AND DATE(created_at) = $2
    `, [branchId, today]);

    const pendingLeads = await db.query(`
      SELECT COUNT(*) FROM leads WHERE branch_id = $1 AND status = 'new'
    `, [branchId]);

    const callbacksToday = await db.query(`
      SELECT COUNT(*) FROM call_records WHERE branch_id = $1 AND callback_date = $2 AND call_status = 'callback_requested'
    `, [branchId, today]);

    const renewals = await db.query(`
      SELECT COUNT(*) FROM renewals WHERE renewal_date = $1
    `, [today]);

    const duePatients = await db.query(`
      SELECT COUNT(*) FROM due_patients WHERE branch_id = $1 AND status = 'pending'
    `, [branchId]);

    const followupsToday = await db.query(`
      SELECT COUNT(*) FROM crm_followups WHERE branch_id = $1 AND due_date = $2 AND status = 'pending'
    `, [branchId, today]);

    const revenue = await db.query(`
      SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p
      JOIN bills b ON p.bill_id = b.bill_id
      WHERE p.branch_id = $1 AND DATE(p.payment_date) = $2 AND b.bill_type = 'consultation' AND p.status = 'success'
    `, [branchId, today]);

    const pendingTasks = await db.query(`
      SELECT COUNT(*) FROM call_records
      WHERE branch_id = $1 AND handled_by = $2 AND call_status = 'callback_requested' AND task_status = 'pending'
    `, [branchId, req.user.user_id]);

    return res.json(formatResponse(true, {
      new_patients_today: parseInt(newPatients.rows[0].count),
      appointments_today: parseInt(appointments.rows[0].count),
      waiting_patients: parseInt(waitingPatients.rows[0].count),
      enquiries_today: parseInt(enquiries.rows[0].count),
      pending_leads: parseInt(pendingLeads.rows[0].count),
      callbacks_today: parseInt(callbacksToday.rows[0].count),
      renewals_today: parseInt(renewals.rows[0].count),
      due_patients_count: parseInt(duePatients.rows[0].count),
      followups_today: parseInt(followupsToday.rows[0].count),
      consultation_revenue_today: parseFloat(revenue.rows[0].total),
      pending_tasks_count: parseInt(pendingTasks.rows[0].count)
    }, 'Receptionist dashboard summary retrieved successfully'));
  } catch (err) {
    console.error('getDashboard error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.3 Patient Search
async function searchPatients(req, res) {
  try {
    const { mobile, name, registration_id, registered_id, patient_id, prescription_date, search } = req.query;
    const branchId = req.user.branch_id || 1;

    const regId = registration_id || registered_id;

    let query = `SELECT DISTINCT p.* FROM patients p`;
    const params = [];
    const conditions = [];

    params.push(branchId);
    conditions.push(`p.branch_id = $${params.length}`);

    if (prescription_date) {
      query += ` JOIN prescriptions pr ON p.patient_id = pr.patient_id`;
      params.push(prescription_date);
      conditions.push(`DATE(pr.created_at) = $${params.length}`);
    }

    if (mobile) {
      params.push(`%${mobile.trim()}%`);
      conditions.push(`p.mobile_number ILIKE $${params.length}`);
    } else if (name) {
      params.push(`%${name.trim()}%`);
      conditions.push(`p.full_name ILIKE $${params.length}`);
    } else if (regId) {
      params.push(regId.trim());
      conditions.push(`p.registration_id = $${params.length}`);
    } else if (patient_id) {
      params.push(parseInt(patient_id));
      conditions.push(`p.patient_id = $${params.length}`);
    } else if (search) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(p.full_name ILIKE $${params.length} OR p.mobile_number ILIKE $${params.length} OR p.registration_id ILIKE $${params.length})`);
    } else if (!prescription_date) {
      return res.status(400).json(formatResponse(false, null, 'At least one search parameter (mobile, name, registration_id, prescription_date, search) is required'));
    }

    query += ` WHERE ` + conditions.join(' AND ') + ` ORDER BY p.patient_id DESC`;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.json(formatResponse(true, { exists: false, classification: 'new', count: 0, patient: null, patients: [] }, 'Patient not found. Classified as NEW patient'));
    }

    const today = new Date().toISOString().split('T')[0];
    const patients = result.rows.map(patient => {
      const regExpiry = patient.registration_expiry ? new Date(patient.registration_expiry).toISOString().split('T')[0] : null;
      const regStatus = regExpiry && regExpiry >= today ? 'active' : 'expired';
      return {
        ...patient,
        registration_status: regStatus
      };
    });

    return res.json(formatResponse(true, {
      exists: true,
      classification: 'existing',
      registration_status: patients[0].registration_status,
      count: patients.length,
      patient: patients[0],
      patients
    }, `${patients.length} patient(s) found. Classified as EXISTING patient`));

  } catch (err) {
    console.error('searchPatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}


// 3.4 Patient Overview
async function getPatientOverview(req, res) {
  try {
    const patientId = parseInt(req.params.id);
    const branchId = req.user.branch_id || 1;

    const patientRes = await db.query(`SELECT * FROM patients WHERE patient_id = $1 AND branch_id = $2`, [patientId, branchId]);
    if (patientRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Patient not found'));
    }
    const patient = patientRes.rows[0];

    const today = new Date().toISOString().split('T')[0];
    const regExpiry = patient.registration_expiry ? new Date(patient.registration_expiry).toISOString().split('T')[0] : null;
    const regStatus = regExpiry && regExpiry >= today ? 'active' : 'expired';

    // Upcoming Appointment
    const apptRes = await db.query(`
      SELECT a.*, u.full_name as doctor_name, d.specialization
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE a.patient_id = $1 AND a.appointment_date >= $2 AND a.status IN ('scheduled', 'checked_in')
      ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT 1
    `, [patientId, today]);

    // Outstanding Due
    const dueRes = await db.query(`
      SELECT COALESCE(SUM(due_amount), 0) as total_due FROM due_patients WHERE patient_id = $1 AND status = 'pending'
    `, [patientId]);

    // Previous Consultations / Prescriptions
    const visitsRes = await db.query(`
      SELECT a.appointment_id, a.appointment_date, a.status, u.full_name as doctor_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE a.patient_id = $1 ORDER BY a.appointment_date DESC LIMIT 5
    `, [patientId]);

    const prescRes = await db.query(`
      SELECT pr.id as prescription_id, pr.created_at, u.full_name as doctor_name
      FROM prescriptions pr
      JOIN doctors d ON pr.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE pr.patient_id = $1 ORDER BY pr.created_at DESC LIMIT 5
    `, [patientId]);

    // CRM Calls & Callbacks
    const crmRes = await db.query(`
      SELECT * FROM call_records WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5
    `, [patientId]);

    const callbackRes = await db.query(`
      SELECT * FROM call_records WHERE patient_id = $1 AND call_status = 'callback_requested' AND task_status = 'pending' ORDER BY callback_date ASC LIMIT 1
    `, [patientId]);

    return res.json(formatResponse(true, {
      patient,
      registration_status: regStatus,
      upcoming_appointment: apptRes.rows[0] || null,
      due_amount: parseFloat(dueRes.rows[0].total_due),
      previous_visits: visitsRes.rows,
      previous_prescriptions: prescRes.rows,
      crm_history: crmRes.rows,
      upcoming_callback: callbackRes.rows[0] || null
    }, 'Patient overview retrieved successfully'));

  } catch (err) {
    console.error('getPatientOverview error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.5 New Patient Registration
async function registerPatient(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const {
      mobile_number, full_name, age, gender, village_mandal, village, mandal, address, ailment_reason,
      lead_source, lead_source_id, lead_id, assigned_doctor_id, appointment_date, appointment_time,
      appointment_type, discount_amount, payment_method, payment_amount, remarks
    } = req.body;

    if (!mobile_number || !full_name || !assigned_doctor_id || !appointment_date || !appointment_time) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'mobile_number, full_name, assigned_doctor_id, appointment_date, and appointment_time are required'));
    }

    const branchId = req.user.branch_id || 1;
    const cleanMobile = mobile_number.toString().trim();

    // Check if patient exists -> Auto classification
    let targetPatientId = null;
    let classification = 'new';
    const existingPt = await client.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [cleanMobile]);

    if (existingPt.rows.length > 0) {
      targetPatientId = existingPt.rows[0].patient_id;
      classification = 'existing';
    } else {
      // Calculate registration expiry (default 30 days)
      const settingRes = await client.query(`SELECT setting_value FROM hospital_settings WHERE setting_key = 'registration_validity_days'`);
      const validityDays = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].setting_value) : 30;

      const regId = await generateId('REG-', 'patients');
      const regDate = new Date();
      const regExpiry = new Date();
      regExpiry.setDate(regExpiry.getDate() + validityDays);

      const newPtRes = await client.query(`
        INSERT INTO patients (
          full_name, mobile_number, age, gender, village, mandal, address, ailment_reason,
          registration_id, registration_date, registration_expiry, patient_type, branch_id, registered_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'new', $12, $13)
        RETURNING *
      `, [
        full_name, cleanMobile, age ? parseInt(age) : null, gender || null,
        village || village_mandal || null, mandal || null, address || village_mandal || null,
        ailment_reason || null, regId, regDate, regExpiry, branchId, req.user.user_id
      ]);
      targetPatientId = newPtRes.rows[0].patient_id;
    }

    // Verify Active Doctor
    const docRes = await client.query(`
      SELECT d.doctor_id, d.status, d.new_consultation_fee, d.renewal_consultation_fee, d.followup_consultation_fee
      FROM doctors d WHERE d.doctor_id = $1
    `, [assigned_doctor_id]);

    if (docRes.rows.length === 0 || docRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Selected doctor is inactive or resigned. Please select an active doctor'));
    }

    const doctor = docRes.rows[0];
    const apptType = (appointment_type || 'new').toLowerCase();

    // Server-side Consultation Fee resolution
    let baseFee = parseFloat(doctor.new_consultation_fee || 500);
    if (apptType === 'renewal') baseFee = parseFloat(doctor.renewal_consultation_fee || 300);
    if (apptType === 'followup') baseFee = parseFloat(doctor.followup_consultation_fee || 200);

    // Handle Discount Validation
    const discount = discount_amount ? parseFloat(discount_amount) : 0;
    if (discount > 0) {
      // Permission check from receptionist_permissions
      const permRes = await client.query(`SELECT consultation_fee_billing FROM receptionist_permissions WHERE user_id = $1`, [req.user.user_id]);
      if (permRes.rows.length > 0 && !permRes.rows[0].consultation_fee_billing) {
        await client.query('ROLLBACK');
        return res.status(403).json(formatResponse(false, null, 'Receptionist does not have permission to apply discounts'));
      }

      // Check max discount rule
      const ruleRes = await client.query(`SELECT max_discount_pct FROM master_discount_rules LIMIT 1`);
      const maxPct = ruleRes.rows.length > 0 ? parseFloat(ruleRes.rows[0].max_discount_pct) : 20.0;
      const maxAllowedDisc = (baseFee * maxPct) / 100.0;
      if (discount > maxAllowedDisc) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, `Discount amount (${discount}) exceeds max allowed limit (${maxAllowedDisc} / ${maxPct}%)`));
      }
    }

    const finalFee = Math.max(0, baseFee - discount);
    const paidAmt = payment_amount !== undefined ? parseFloat(payment_amount) : finalFee;
    const dueAmt = Math.max(0, finalFee - paidAmt);

    // Check Doctor Slot Availability (Prevent Double Booking)
    const slotCheck = await client.query(`
      SELECT appointment_id FROM appointments
      WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time::time = $3::time AND status NOT IN ('cancelled')
    `, [parseInt(assigned_doctor_id), appointment_date, appointment_time]);

    if (slotCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Selected doctor is already booked at ${appointment_time} on ${appointment_date}. Double booking is not allowed. Please choose another time slot.`));
    }

    // Create Appointment (Status = 'scheduled')
    const apptRes = await client.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, created_by, branch_id)
      VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7)
      RETURNING *
    `, [targetPatientId, assigned_doctor_id, appointment_date, appointment_time, apptType, req.user.user_id, branchId]);

    const newAppt = apptRes.rows[0];

    // Create Bill (Bill Type = 'consultation', status = 'created')
    const billNum = await generateId('INV-', 'bills');
    const billRes = await client.query(`
      INSERT INTO bills (
        bill_number, patient_id, doctor_id, bill_type, created_by, branch_id,
        amount, discount_amount, final_amount, status
      ) VALUES ($1, $2, $3, 'consultation', $4, $5, $6, $7, $8, 'created')
      RETURNING *
    `, [billNum, targetPatientId, assigned_doctor_id, req.user.user_id, branchId, baseFee, discount, finalFee]);

    const newBill = billRes.rows[0];
    newBill.due_amount = dueAmt;
    newBill.paid_amount = paidAmt;

    // Record Payment
    let newPayment = null;
    if (paidAmt > 0) {
      const payMeth = payment_method || 'cash';
      const payRes = await client.query(`
        INSERT INTO payments (
          bill_id, patient_id, payment_method, amount, status, received_by, branch_id
        ) VALUES ($1, $2, $3, $4, 'success', $5, $6)
        RETURNING *
      `, [newBill.bill_id, targetPatientId, payMeth, paidAmt, req.user.user_id, branchId]);
      newPayment = payRes.rows[0];
    }

    // Write to due_patients if partial or pending
    if (dueAmt > 0) {
      await client.query(`
        INSERT INTO due_patients (patient_id, bill_id, due_amount, status, branch_id)
        VALUES ($1, $2, $3, 'pending', $4)
      `, [targetPatientId, newBill.bill_id, dueAmt, branchId]);
    }

    // If Executive Lead provided, update lead status
    if (lead_id) {
      await client.query(`
        UPDATE leads SET status = 'converted', patient_id = $1, updated_at = now() WHERE lead_id = $2
      `, [targetPatientId, parseInt(lead_id)]);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Patient Registration', action: 'Register Patient', recordId: targetPatientId, newValue: newBill };
    return res.status(201).json(formatResponse(true, {
      classification,
      target_target: classification === 'new' ? 'Enquiry Target' : 'Unit Target',
      patient_id: targetPatientId,
      appointment: newAppt,
      bill: newBill,
      payment: newPayment
    }, `Patient registered successfully (${classification === 'new' ? 'Enquiry Target' : 'Unit Target'})`));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('registerPatient error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// 3.6 Enquiries
async function createEnquiry(req, res) {
  try {
    const { name, mobile, age, gender, village_mandal, reason_requirement, lead_source_id, preferred_doctor_id, preferred_date, preferred_time, remarks } = req.body;
    if (!name || !mobile) {
      return res.status(400).json(formatResponse(false, null, 'name and mobile are required for enquiry'));
    }

    const branchId = req.user.branch_id || 1;
    const leadRes = await db.query(`
      INSERT INTO leads (lead_name, mobile_number, lead_source, lead_created_by_user_id, status, branch_id)
      VALUES ($1, $2, 'inbound', $3, 'new', $4)
      RETURNING *
    `, [name, mobile.toString().trim(), req.user.user_id, branchId]);

    res.locals.auditEntry = { module: 'Enquiry Management', action: 'Create Enquiry', recordId: leadRes.rows[0].lead_id, newValue: leadRes.rows[0] };
    return res.status(201).json(formatResponse(true, leadRes.rows[0], 'Enquiry recorded successfully (routes to Enquiry Target)'));
  } catch (err) {
    console.error('createEnquiry error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getEnquiries(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const result = await db.query(`
      SELECT * FROM leads WHERE branch_id = $1 ORDER BY lead_id DESC
    `, [branchId]);
    return res.json(formatResponse(true, result.rows, 'Enquiries retrieved successfully'));
  } catch (err) {
    console.error('getEnquiries error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.7 Referrals
async function createEmployeeReferral(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_name, mobile_number, age, gender, village_mandal, reason, referring_employee_id, remarks } = req.body;

    if (!patient_name || !mobile_number || !referring_employee_id) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_name, mobile_number, and referring_employee_id are required'));
    }

    const branchId = req.user.branch_id || 1;

    // Check referring employee user
    const empRes = await client.query(`SELECT user_id, employee_id, department FROM users WHERE user_id = $1`, [parseInt(referring_employee_id)]);
    if (empRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Referring employee not found'));
    }
    const emp = empRes.rows[0];

    // Find or create patient
    let ptId = null;
    const ptCheck = await client.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [mobile_number.toString().trim()]);
    if (ptCheck.rows.length > 0) {
      ptId = ptCheck.rows[0].patient_id;
    } else {
      const newPt = await client.query(`
        INSERT INTO patients (full_name, mobile_number, age, gender, village, ailment_reason, patient_type, branch_id, registered_by)
        VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, $8) RETURNING patient_id
      `, [patient_name, mobile_number.toString().trim(), age ? parseInt(age) : null, gender || null, village_mandal || null, reason || null, branchId, req.user.user_id]);
      ptId = newPt.rows[0].patient_id;
    }

    const refCode = await generateId('REF-', 'referrals');

    const refRes = await client.query(`
      INSERT INTO referrals (patient_id, referral_type, referred_by, referral_code, referring_employee_id, department, remarks)
      VALUES ($1, 'employee', $2, $3, $4, $5, $6)
      RETURNING *
    `, [ptId, emp.user_id, refCode, emp.user_id, emp.department || 'General', remarks || null]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Referrals', action: 'Create Employee Referral', recordId: refRes.rows[0].id, newValue: refRes.rows[0] };
    return res.status(201).json(formatResponse(true, refRes.rows[0], 'Employee referral recorded successfully (routes to Unit Target)'));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createEmployeeReferral error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function createPatientReferral(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_name, mobile_number, age, gender, village_mandal, reason, referring_patient_id, remarks } = req.body;

    if (!patient_name || !mobile_number || !referring_patient_id) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_name, mobile_number, and referring_patient_id are required'));
    }

    const branchId = req.user.branch_id || 1;

    // Check referring patient
    const ptRefRes = await client.query(`SELECT patient_id FROM patients WHERE patient_id = $1`, [parseInt(referring_patient_id)]);
    if (ptRefRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Referring patient not found'));
    }

    // Find or create patient
    let ptId = null;
    const ptCheck = await client.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [mobile_number.toString().trim()]);
    if (ptCheck.rows.length > 0) {
      ptId = ptCheck.rows[0].patient_id;
    } else {
      const newPt = await client.query(`
        INSERT INTO patients (full_name, mobile_number, age, gender, village, ailment_reason, patient_type, branch_id, registered_by)
        VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, $8) RETURNING patient_id
      `, [patient_name, mobile_number.toString().trim(), age ? parseInt(age) : null, gender || null, village_mandal || null, reason || null, branchId, req.user.user_id]);
      ptId = newPt.rows[0].patient_id;
    }

    const refCode = await generateId('REF-', 'referrals');

    const refRes = await client.query(`
      INSERT INTO referrals (patient_id, referral_type, referral_code, referring_patient_id, remarks)
      VALUES ($1, 'patient', $2, $3, $4)
      RETURNING *
    `, [ptId, refCode, parseInt(referring_patient_id), remarks || null]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Referrals', action: 'Create Patient Referral', recordId: refRes.rows[0].id, newValue: refRes.rows[0] };
    return res.status(201).json(formatResponse(true, refRes.rows[0], 'Patient referral recorded successfully (routes to Unit Target)'));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createPatientReferral error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getPatientReferrals(req, res) {
  try {
    const result = await db.query(`
      SELECT r.*, p.full_name as patient_name, p.mobile_number, rp.full_name as referring_patient_name
      FROM referrals r
      JOIN patients p ON r.patient_id = p.patient_id
      LEFT JOIN patients rp ON r.referring_patient_id = rp.patient_id
      WHERE r.referral_type = 'patient'
      ORDER BY r.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Patient referrals retrieved successfully'));
  } catch (err) {
    console.error('getPatientReferrals error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getEmployeeReferrals(req, res) {
  try {
    const result = await db.query(`
      SELECT r.*, p.full_name as patient_name, p.mobile_number, u.full_name as referring_employee_name, u.employee_id
      FROM referrals r
      JOIN patients p ON r.patient_id = p.patient_id
      LEFT JOIN users u ON r.referring_employee_id = u.user_id
      WHERE r.referral_type = 'employee'
      ORDER BY r.id DESC
    `);
    return res.json(formatResponse(true, result.rows, 'Employee referrals retrieved successfully'));
  } catch (err) {
    console.error('getEmployeeReferrals error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.8 Executive Lead Queue
async function getExecutiveLeads(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const { status } = req.query;
    const targetStatus = status || 'new';

    const result = await db.query(`
      SELECT l.*, u.full_name as executive_name, u.employee_id as executive_employee_id
      FROM leads l
      LEFT JOIN users u ON l.executive_id = u.user_id
      WHERE l.branch_id = $1 AND l.status = $2
      ORDER BY l.lead_id DESC
    `, [branchId, targetStatus]);

    return res.json(formatResponse(true, result.rows, 'Executive lead queue retrieved successfully'));
  } catch (err) {
    console.error('getExecutiveLeads error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function openExecutiveLead(req, res) {
  try {
    const leadId = parseInt(req.params.id);
    const branchId = req.user.branch_id || 1;

    const leadRes = await db.query(`
      SELECT l.*, u.full_name as executive_name, u.employee_id as executive_employee_id
      FROM leads l
      LEFT JOIN users u ON l.executive_id = u.user_id
      WHERE l.lead_id = $1 AND l.branch_id = $2
    `, [leadId, branchId]);

    if (leadRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Lead not found'));
    }

    return res.json(formatResponse(true, leadRes.rows[0], 'Executive lead details retrieved for doctor assignment'));
  } catch (err) {
    console.error('openExecutiveLead error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.9 Doctor Assignment
async function getActiveDoctors(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const result = await db.query(`
      SELECT d.doctor_id, d.doctor_code, u.full_name as doctor_name, d.specialization, d.qualification,
             d.new_consultation_fee, d.renewal_consultation_fee, d.followup_consultation_fee, d.working_days, d.start_time, d.end_time
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.branch_id = $1 AND d.status = 'active' AND u.status = 'active'
      ORDER BY u.full_name ASC
    `, [branchId]);

    return res.json(formatResponse(true, result.rows, 'Active doctors retrieved successfully'));
  } catch (err) {
    console.error('getActiveDoctors error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.10 Appointments
async function createAppointment(req, res) {
  try {
    const { patient_id, doctor_id, appointment_date, appointment_time, appointment_type, reason, remarks } = req.body;
    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json(formatResponse(false, null, 'patient_id, doctor_id, appointment_date, and appointment_time are required'));
    }

    const branchId = req.user.branch_id || 1;

    // Check active doctor
    const docRes = await db.query(`SELECT status FROM doctors WHERE doctor_id = $1 AND branch_id = $2`, [parseInt(doctor_id), branchId]);
    if (docRes.rows.length === 0 || docRes.rows[0].status !== 'active') {
      return res.status(400).json(formatResponse(false, null, 'Selected doctor is inactive or resigned. Please select an active doctor'));
    }

    // Check Doctor Slot Availability (Prevent Double Booking)
    const slotCheck = await db.query(`
      SELECT appointment_id FROM appointments
      WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time::time = $3::time AND status NOT IN ('cancelled')
    `, [parseInt(doctor_id), appointment_date, appointment_time]);

    if (slotCheck.rows.length > 0) {
      return res.status(400).json(formatResponse(false, null, `Selected doctor is already booked at ${appointment_time} on ${appointment_date}. Double booking is not allowed. Please choose another time slot.`));
    }

    // Check Patient Slot Availability (Prevent Patient Double Booking)
    const patientSlotCheck = await db.query(`
      SELECT appointment_id FROM appointments
      WHERE patient_id = $1 AND appointment_date = $2 AND appointment_time::time = $3::time AND status NOT IN ('cancelled')
    `, [parseInt(patient_id), appointment_date, appointment_time]);

    if (patientSlotCheck.rows.length > 0) {
      return res.status(400).json(formatResponse(false, null, `Patient already has an appointment scheduled at ${appointment_time} on ${appointment_date}.`));
    }

    const result = await db.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, created_by, branch_id)
      VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7)
      RETURNING *
    `, [parseInt(patient_id), parseInt(doctor_id), appointment_date, appointment_time, (appointment_type || 'new').toLowerCase(), req.user.user_id, branchId]);

    res.locals.auditEntry = { module: 'Appointments', action: 'Create Appointment', recordId: result.rows[0].appointment_id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Appointment created successfully'));
  } catch (err) {
    console.error('createAppointment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getAppointments(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const { date, doctor_id, status } = req.query;

    let query = `
      SELECT a.*, p.full_name as patient_name, p.mobile_number, u.full_name as doctor_name, d.specialization
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE a.branch_id = $1
    `;
    const params = [branchId];

    if (date) {
      params.push(date);
      query += ` AND a.appointment_date = $${params.length}`;
    }
    if (doctor_id) {
      params.push(parseInt(doctor_id));
      query += ` AND a.doctor_id = $${params.length}`;
    }
    if (status) {
      const dbStatus = status.replace('-', '_');
      params.push(dbStatus);
      query += ` AND a.status = $${params.length}`;
    }

    query += ` ORDER BY a.appointment_date DESC, a.appointment_time ASC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Appointments retrieved successfully'));
  } catch (err) {
    console.error('getAppointments error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function rescheduleAppointment(req, res) {
  try {
    const apptId = parseInt(req.params.id);
    const { appointment_date, appointment_time } = req.body;

    if (!appointment_date || !appointment_time) {
      return res.status(400).json(formatResponse(false, null, 'appointment_date and appointment_time are required'));
    }

    const apptRes = await db.query(`SELECT * FROM appointments WHERE appointment_id = $1`, [apptId]);
    if (apptRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Appointment not found'));
    }

    const appt = apptRes.rows[0];

    // Check Doctor Slot Availability (excluding current appointment)
    const slotCheck = await db.query(`
      SELECT appointment_id FROM appointments
      WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time::time = $3::time AND status NOT IN ('cancelled') AND appointment_id != $4
    `, [appt.doctor_id, appointment_date, appointment_time, apptId]);

    if (slotCheck.rows.length > 0) {
      return res.status(400).json(formatResponse(false, null, `Selected doctor is already booked at ${appointment_time} on ${appointment_date}. Double booking is not allowed. Please choose another time slot.`));
    }

    await db.query(`
      UPDATE appointments SET appointment_date = $1, appointment_time = $2, updated_at = now()
      WHERE appointment_id = $3
    `, [appointment_date, appointment_time, apptId]);

    res.locals.auditEntry = { module: 'Appointments', action: 'Reschedule Appointment', recordId: apptId, newValue: { appointment_date, appointment_time } };
    return res.json(formatResponse(true, null, 'Appointment rescheduled successfully'));
  } catch (err) {
    console.error('rescheduleAppointment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function cancelAppointment(req, res) {
  try {
    const apptId = parseInt(req.params.id);

    const apptRes = await db.query(`SELECT * FROM appointments WHERE appointment_id = $1`, [apptId]);
    if (apptRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Appointment not found'));
    }

    await db.query(`
      UPDATE appointments SET status = 'cancelled', updated_at = now()
      WHERE appointment_id = $1
    `, [apptId]);

    res.locals.auditEntry = { module: 'Appointments', action: 'Cancel Appointment', recordId: apptId, newValue: { status: 'cancelled' } };
    return res.json(formatResponse(true, null, 'Appointment cancelled successfully'));
  } catch (err) {
    console.error('cancelAppointment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.11 Consultation Billing & Discounts
async function createConsultationBill(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_id, appointment_id, bill_type, discount_amount, payment_method, payment_amount } = req.body;

    // Rule 9: Server-side check that bill_type MUST be 'consultation'
    if (bill_type && bill_type !== 'consultation') {
      await client.query('ROLLBACK');
      return res.status(403).json(formatResponse(false, null, `Receptionist is restricted to consultation fee billing only. Cannot create '${bill_type}' bill.`));
    }

    if (!patient_id || !appointment_id) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_id and appointment_id are required'));
    }

    const branchId = req.user.branch_id || 1;

    // Get appointment & doctor details
    const apptRes = await client.query(`
      SELECT a.*, d.new_consultation_fee, d.renewal_consultation_fee, d.followup_consultation_fee
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      WHERE a.appointment_id = $1 AND a.patient_id = $2
    `, [parseInt(appointment_id), parseInt(patient_id)]);

    if (apptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Appointment not found for patient'));
    }

    const appt = apptRes.rows[0];
    const apptType = (appt.appointment_type || 'new').toLowerCase();

    // Server-side fee lookup
    let baseFee = parseFloat(appt.new_consultation_fee || 500);
    if (apptType === 'renewal') baseFee = parseFloat(appt.renewal_consultation_fee || 300);
    if (apptType === 'followup') baseFee = parseFloat(appt.followup_consultation_fee || 200);

    const discount = discount_amount ? parseFloat(discount_amount) : 0;
    if (discount > 0) {
      const permRes = await client.query(`SELECT consultation_fee_billing FROM receptionist_permissions WHERE user_id = $1`, [req.user.user_id]);
      if (permRes.rows.length > 0 && !permRes.rows[0].consultation_fee_billing) {
        await client.query('ROLLBACK');
        return res.status(403).json(formatResponse(false, null, 'Receptionist does not have permission to apply discounts'));
      }

      const ruleRes = await client.query(`SELECT max_discount_pct FROM master_discount_rules LIMIT 1`);
      const maxPct = ruleRes.rows.length > 0 ? parseFloat(ruleRes.rows[0].max_discount_pct) : 20.0;
      const maxAllowedDisc = (baseFee * maxPct) / 100.0;
      if (discount > maxAllowedDisc) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, `Discount amount (${discount}) exceeds max allowed limit (${maxAllowedDisc})`));
      }
    }

    const finalFee = Math.max(0, baseFee - discount);
    const paidAmt = payment_amount !== undefined ? parseFloat(payment_amount) : finalFee;
    const dueAmt = Math.max(0, finalFee - paidAmt);

    const billNum = await generateId('INV-', 'bills');

    const billRes = await client.query(`
      INSERT INTO bills (
        bill_number, patient_id, doctor_id, bill_type, created_by, branch_id,
        amount, discount_amount, final_amount, status
      ) VALUES ($1, $2, $3, 'consultation', $4, $5, $6, $7, $8, 'created')
      RETURNING *
    `, [billNum, parseInt(patient_id), appt.doctor_id, req.user.user_id, branchId, baseFee, discount, finalFee]);

    const newBill = billRes.rows[0];
    newBill.due_amount = dueAmt;
    newBill.paid_amount = paidAmt;

    let newPayment = null;
    if (paidAmt > 0) {
      const payMeth = payment_method || 'cash';
      const payRes = await client.query(`
        INSERT INTO payments (
          bill_id, patient_id, payment_method, amount, status, received_by, branch_id
        ) VALUES ($1, $2, $3, $4, 'success', $5, $6)
        RETURNING *
      `, [newBill.bill_id, parseInt(patient_id), payMeth, paidAmt, req.user.user_id, branchId]);
      newPayment = payRes.rows[0];
    }

    if (dueAmt > 0) {
      await client.query(`
        INSERT INTO due_patients (patient_id, bill_id, due_amount, status, branch_id)
        VALUES ($1, $2, $3, 'pending', $4)
      `, [parseInt(patient_id), newBill.bill_id, dueAmt, branchId]);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Consultation Billing', action: 'Create Consultation Bill', recordId: newBill.bill_id, newValue: newBill };
    return res.status(201).json(formatResponse(true, { bill: newBill, payment: newPayment }, 'Consultation bill created successfully'));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createConsultationBill error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getConsultationBills(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const result = await db.query(`
      SELECT b.*, p.full_name as patient_name, u.full_name as doctor_name
      FROM bills b
      JOIN patients p ON b.patient_id = p.patient_id
      LEFT JOIN doctors d ON b.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE b.branch_id = $1 AND b.bill_type = 'consultation'
      ORDER BY b.bill_id DESC
    `, [branchId]);
    return res.json(formatResponse(true, result.rows, 'Consultation bills retrieved successfully'));
  } catch (err) {
    console.error('getConsultationBills error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.13 Check-in
async function checkinAppointment(req, res) {
  try {
    const apptId = parseInt(req.params.id);
    const { status } = req.body;
    const reqStatus = (status || 'checked_in').replace('-', '_');

    // Rule 11: Receptionist can ONLY transition to 'checked_in'. Downstream status modifications rejected with 403.
    if (reqStatus !== 'checked_in') {
      return res.status(403).json(formatResponse(false, null, `Receptionist can only transition appointment to 'checked-in'. Stage '${status}' belongs to Doctor/PRO/Pharmacy.`));
    }

    const apptRes = await db.query(`SELECT * FROM appointments WHERE appointment_id = $1`, [apptId]);
    if (apptRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Appointment not found'));
    }

    await db.query(`
      UPDATE appointments SET status = 'checked_in', updated_at = now() WHERE appointment_id = $1
    `, [apptId]);

    res.locals.auditEntry = { module: 'Check-in', action: 'Patient Check-in', recordId: apptId, newValue: { status: 'checked_in' } };
    return res.json(formatResponse(true, null, 'Patient checked in successfully. Added to Doctor Waiting Queue'));
  } catch (err) {
    console.error('checkinAppointment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getWaitingQueue(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const today = new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT a.*, p.full_name as patient_name, p.mobile_number, u.full_name as doctor_name, d.specialization
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE a.branch_id = $1 AND a.appointment_date = $2 AND a.status = 'checked_in'
      ORDER BY a.appointment_time ASC
    `, [branchId, today]);

    return res.json(formatResponse(true, result.rows, 'Waiting queue retrieved successfully'));
  } catch (err) {
    console.error('getWaitingQueue error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.14 Renewals
async function renewRegistration(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_id, doctor_id, appointment_date, appointment_time, discount_amount, payment_method, payment_amount, remarks } = req.body;

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_id, doctor_id, appointment_date, and appointment_time are required'));
    }

    const branchId = req.user.branch_id || 1;

    // Check doctor
    const docRes = await client.query(`SELECT doctor_id, renewal_consultation_fee, status FROM doctors WHERE doctor_id = $1`, [parseInt(doctor_id)]);
    if (docRes.rows.length === 0 || docRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Selected doctor is inactive or resigned'));
    }

    const doctor = docRes.rows[0];
    const baseFee = parseFloat(doctor.renewal_consultation_fee || 300);
    const discount = discount_amount ? parseFloat(discount_amount) : 0;
    const finalFee = Math.max(0, baseFee - discount);
    const paidAmt = payment_amount !== undefined ? parseFloat(payment_amount) : finalFee;
    const dueAmt = Math.max(0, finalFee - paidAmt);

    // Update patient registration expiry (extend 30 days)
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);

    await client.query(`
      UPDATE patients SET registration_expiry = $1, updated_at = now() WHERE patient_id = $2
    `, [newExpiry, parseInt(patient_id)]);

    // Write renewal record
    const renRes = await client.query(`
      INSERT INTO renewals (patient_id, doctor_id, renewal_date, amount)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [parseInt(patient_id), parseInt(doctor_id), appointment_date, finalFee]);

    // Check Doctor Slot Availability (Prevent Double Booking)
    const slotCheck = await client.query(`
      SELECT appointment_id FROM appointments
      WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time::time = $3::time AND status NOT IN ('cancelled')
    `, [parseInt(doctor_id), appointment_date, appointment_time]);

    if (slotCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Selected doctor is already booked at ${appointment_time} on ${appointment_date}. Double booking is not allowed. Please choose another time slot.`));
    }

    // Create renewal appointment
    const apptRes = await client.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, created_by, branch_id)
      VALUES ($1, $2, $3, $4, 'renewal', 'scheduled', $5, $6) RETURNING *
    `, [parseInt(patient_id), parseInt(doctor_id), appointment_date, appointment_time, req.user.user_id, branchId]);

    // Create Bill
    const billNum = await generateId('INV-', 'bills');
    const billRes = await client.query(`
      INSERT INTO bills (
        bill_number, patient_id, doctor_id, bill_type, created_by, branch_id,
        amount, discount_amount, final_amount, status
      ) VALUES ($1, $2, $3, 'consultation', $4, $5, $6, $7, $8, 'created') RETURNING *
    `, [billNum, parseInt(patient_id), parseInt(doctor_id), req.user.user_id, branchId, baseFee, discount, finalFee]);

    const newBill = billRes.rows[0];
    newBill.due_amount = dueAmt;
    newBill.paid_amount = paidAmt;

    if (paidAmt > 0) {
      await client.query(`
        INSERT INTO payments (bill_id, patient_id, payment_method, amount, status, received_by, branch_id)
        VALUES ($1, $2, $3, $4, 'success', $5, $6)
      `, [newBill.bill_id, parseInt(patient_id), payment_method || 'cash', paidAmt, req.user.user_id, branchId]);
    }

    if (dueAmt > 0) {
      await client.query(`
        INSERT INTO due_patients (patient_id, bill_id, due_amount, status, branch_id)
        VALUES ($1, $2, $3, 'pending', $4)
      `, [parseInt(patient_id), newBill.bill_id, dueAmt, branchId]);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Renewals', action: 'Renew Patient Registration', recordId: renRes.rows[0].id, newValue: renRes.rows[0] };
    return res.status(201).json(formatResponse(true, {
      renewal: renRes.rows[0],
      appointment: apptRes.rows[0],
      bill: newBill
    }, 'Patient registration renewed successfully (routes to Unit Target)'));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('renewRegistration error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// 3.15 Due Patients
async function getDuePatients(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const result = await db.query(`
      SELECT dp.*, p.full_name as patient_name, p.mobile_number, b.bill_number, b.bill_type
      FROM due_patients dp
      JOIN patients p ON dp.patient_id = p.patient_id
      JOIN bills b ON dp.bill_id = b.bill_id
      WHERE dp.branch_id = $1 AND dp.status = 'pending'
      ORDER BY dp.created_at DESC
    `, [branchId]);

    return res.json(formatResponse(true, result.rows, 'Due patients retrieved successfully'));
  } catch (err) {
    console.error('getDuePatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function collectDuePayment(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const dueId = parseInt(req.params.id);
    const { payment_amount, payment_method, remarks } = req.body;

    if (!payment_amount || parseFloat(payment_amount) <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'payment_amount must be greater than 0'));
    }

    const branchId = req.user.branch_id || 1;
    const dueRes = await client.query(`SELECT * FROM due_patients WHERE id = $1 AND branch_id = $2`, [dueId, branchId]);
    if (dueRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Due record not found'));
    }

    const dueRec = dueRes.rows[0];
    const payAmt = parseFloat(payment_amount);
    const currentDue = parseFloat(dueRec.due_amount);

    if (payAmt > currentDue) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Payment amount (${payAmt}) cannot exceed due amount (${currentDue})`));
    }

    const newDue = currentDue - payAmt;
    const newStatus = newDue === 0 ? 'paid' : 'pending';

    // Update due record
    await client.query(`
      UPDATE due_patients SET due_amount = $1, status = $2 WHERE id = $3
    `, [newDue, newStatus, dueId]);

    // Record payment
    const payRes = await client.query(`
      INSERT INTO payments (bill_id, patient_id, payment_method, amount, status, received_by, branch_id)
      VALUES ($1, $2, $3, $4, 'success', $5, $6) RETURNING *
    `, [dueRec.bill_id, dueRec.patient_id, payment_method || 'cash', payAmt, req.user.user_id, branchId]);

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Due Patients', action: 'Collect Due Payment', recordId: dueId, newValue: payRes.rows[0] };
    return res.json(formatResponse(true, { payment: payRes.rows[0], remaining_due: newDue }, 'Due payment collected successfully'));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('collectDuePayment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

// 3.16 CRM Calls & Callback Tasks
async function logCallRecord(req, res) {
  try {
    const { patient_id, lead_id, interaction_type, call_purpose, call_status, callback_date, callback_time, remarks } = req.body;

    if (!patient_id && !lead_id) {
      return res.status(400).json(formatResponse(false, null, 'patient_id or lead_id is required'));
    }
    if (!interaction_type || !call_purpose || !call_status) {
      return res.status(400).json(formatResponse(false, null, 'interaction_type, call_purpose, and call_status are required'));
    }

    // Normalize enum inputs to match PostgreSQL call_records enum types
    const normInteraction = interaction_type.toString().toLowerCase().trim() === 'inbound' ? 'inbound' : 'outbound';

    let normPurpose = call_purpose.toString().toLowerCase().trim();
    if (normPurpose.includes('followup')) normPurpose = 'followup';
    else if (normPurpose.includes('renewal')) normPurpose = 'renewal';
    else if (normPurpose.includes('due')) normPurpose = 'due_payment';
    else if (normPurpose.includes('acq')) normPurpose = 'acq';
    else if (normPurpose.includes('ocnr')) normPurpose = 'ocnr';
    else if (normPurpose.includes('appointment')) normPurpose = 'appointment';
    else if (normPurpose.includes('enquiry')) normPurpose = 'general_enquiry';
    else if (normPurpose.includes('callback')) normPurpose = 'callback';
    else if (normPurpose.includes('feedback')) normPurpose = 'patient_feedback';
    else {
      const validPurposes = ['followup', 'renewal', 'due_payment', 'acq', 'ocnr', 'appointment', 'general_enquiry', 'callback', 'patient_feedback', 'other'];
      if (!validPurposes.includes(normPurpose)) normPurpose = 'other';
    }

    let normStatus = call_status.toString().toLowerCase().trim().replace('-', '_');
    const validStatuses = ['connected', 'not_connected', 'busy', 'switched_off', 'interested', 'not_interested', 'callback_requested', 'appointment_booked', 'followup_required', 'completed', 'closed'];
    if (!validStatuses.includes(normStatus)) normStatus = 'connected';

    // Rule 13: If call_status == 'callback_requested', callback_date is mandatory!
    if (normStatus === 'callback_requested' && !callback_date) {
      return res.status(400).json(formatResponse(false, null, 'callback_date is required when call_status is callback_requested'));
    }

    const branchId = req.user.branch_id || 1;

    const result = await db.query(`
      INSERT INTO call_records (
        patient_id, lead_id, interaction_type, call_purpose, call_status,
        callback_date, callback_time, task_status, handled_by, branch_id, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10)
      RETURNING *
    `, [
      patient_id ? parseInt(patient_id) : null,
      lead_id ? parseInt(lead_id) : null,
      normInteraction, normPurpose, normStatus,
      callback_date || null, callback_time || null,
      req.user.user_id, branchId, remarks || null
    ]);

    res.locals.auditEntry = { module: 'CRM Calling', action: 'Log Call Record', recordId: result.rows[0].call_id, newValue: result.rows[0] };
    return res.status(201).json(formatResponse(true, result.rows[0], 'Call record logged successfully'));
  } catch (err) {
    console.error('logCallRecord error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getCallRecords(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const result = await db.query(`
      SELECT cr.*, p.full_name as patient_name, l.lead_name, u.full_name as handled_by_name
      FROM call_records cr
      LEFT JOIN patients p ON cr.patient_id = p.patient_id
      LEFT JOIN leads l ON cr.lead_id = l.lead_id
      JOIN users u ON cr.handled_by = u.user_id
      WHERE cr.branch_id = $1
      ORDER BY cr.call_id DESC
    `, [branchId]);

    return res.json(formatResponse(true, result.rows, 'Call records retrieved successfully'));
  } catch (err) {
    console.error('getCallRecords error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.17 Callback Automation / My Tasks
async function getMyTasks(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const userId = req.user.user_id;

    const result = await db.query(`
      SELECT cr.call_id, cr.patient_id, cr.lead_id, cr.call_purpose, cr.call_status,
             cr.callback_date, cr.callback_time, cr.task_status, cr.remarks, cr.created_at,
             COALESCE(p.full_name, l.lead_name) as contact_name,
             COALESCE(p.mobile_number, l.mobile_number) as mobile_number
      FROM call_records cr
      LEFT JOIN patients p ON cr.patient_id = p.patient_id
      LEFT JOIN leads l ON cr.lead_id = l.lead_id
      WHERE cr.branch_id = $1 AND cr.handled_by = $2 AND cr.call_status = 'callback_requested' AND cr.task_status = 'pending'
      ORDER BY cr.callback_date ASC, cr.callback_time ASC
    `, [branchId, userId]);

    return res.json(formatResponse(true, result.rows, 'My pending tasks retrieved successfully'));
  } catch (err) {
    console.error('getMyTasks error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function completeTask(req, res) {
  try {
    const callId = parseInt(req.params.call_id);
    const { remarks } = req.body;

    const taskRes = await db.query(`SELECT * FROM call_records WHERE call_id = $1`, [callId]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Task record not found'));
    }

    await db.query(`
      UPDATE call_records SET task_status = 'completed', remarks = COALESCE($1, remarks), updated_at = now()
      WHERE call_id = $2
    `, [remarks, callId]);

    res.locals.auditEntry = { module: 'My Tasks', action: 'Complete Callback Task', recordId: callId, newValue: { task_status: 'completed' } };
    return res.json(formatResponse(true, null, 'Callback task marked as completed'));
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
      return res.status(400).json(formatResponse(false, null, 'callback_date is required to reschedule task'));
    }

    const taskRes = await db.query(`SELECT * FROM call_records WHERE call_id = $1`, [callId]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Task record not found'));
    }

    await db.query(`
      UPDATE call_records SET callback_date = $1, callback_time = $2, task_status = 'rescheduled', remarks = COALESCE($3, remarks), updated_at = now()
      WHERE call_id = $4
    `, [callback_date, callback_time || null, remarks, callId]);

    res.locals.auditEntry = { module: 'My Tasks', action: 'Reschedule Callback Task', recordId: callId, newValue: { callback_date, callback_time } };
    return res.json(formatResponse(true, null, 'Callback task rescheduled successfully'));
  } catch (err) {
    console.error('rescheduleTask error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getDashboard,
  searchPatients,
  getPatientOverview,
  registerPatient,
  createEnquiry,
  getEnquiries,
  createEmployeeReferral,
  createPatientReferral,
  getPatientReferrals,
  getEmployeeReferrals,
  getExecutiveLeads,
  openExecutiveLead,
  getActiveDoctors,
  createAppointment,
  getAppointments,
  rescheduleAppointment,
  cancelAppointment,
  createConsultationBill,
  getConsultationBills,
  checkinAppointment,
  getWaitingQueue,
  renewRegistration,
  getDuePatients,
  collectDuePayment,
  logCallRecord,
  getCallRecords,
  getMyTasks,
  completeTask,
  rescheduleTask
};
