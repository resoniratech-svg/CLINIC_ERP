const db = require('../db');
const { formatResponse } = require('../utils/helpers');
const { resolveOrCreateLocation, ensurePatientLocationColumns } = require('../utils/locationResolver');
const { validateDoctorAvailability, generateDoctorSlots } = require('../utils/doctorScheduleHelper');

// Helper to generate padded sequential code (collision-proof)
async function generateId(prefix, tableName, client = null) {
  const queryRunner = client || db;
  let colName = 'id';
  if (tableName === 'patients') colName = 'registration_id';
  else if (tableName === 'bills') colName = 'bill_number';
  else if (tableName === 'referrals') colName = 'referral_code';
  else if (tableName === 'coupons') colName = 'coupon_code';

  const res = await queryRunner.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  let nextNum = parseInt(res.rows[0]?.count || 0) + 1;
  let candidate = `${prefix}${String(nextNum).padStart(5, '0')}`;

  let check = await queryRunner.query(`SELECT 1 FROM ${tableName} WHERE ${colName} = $1`, [candidate]);
  while (check.rows.length > 0) {
    nextNum++;
    candidate = `${prefix}${String(nextNum).padStart(5, '0')}`;
    check = await queryRunner.query(`SELECT 1 FROM ${tableName} WHERE ${colName} = $1`, [candidate]);
  }
  return candidate;
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
    const { mobile, name, registration_id, registered_id, patient_id, prescription_date, search, limit, offset } = req.query;
    const branchId = req.user.branch_id || 1;

    const regId = registration_id || registered_id;

    let query = `
      SELECT p.*,
             COALESCE(
               (
                 SELECT u.full_name
                 FROM appointments a
                 JOIN doctors d ON a.doctor_id = d.doctor_id
                 JOIN users u ON d.user_id = u.user_id
                 WHERE a.patient_id = p.patient_id
                 ORDER BY a.appointment_date DESC, a.appointment_time DESC
                 LIMIT 1
               ),
               'General OPD'
             ) as doctor_name,
             (
               SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.patient_id
             ) as appointment_count
      FROM patients p
    `;
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
      params.push(`%${regId.trim()}%`);
      conditions.push(`p.registration_id ILIKE $${params.length}`);
    } else if (patient_id) {
      params.push(parseInt(patient_id));
      conditions.push(`p.patient_id = $${params.length}`);
    } else if (search && search.trim() !== '' && search.trim() !== '%') {
      const s = search.trim();
      params.push(`%${s}%`);
      conditions.push(`(p.full_name ILIKE $${params.length} OR p.mobile_number ILIKE $${params.length} OR p.registration_id ILIKE $${params.length} OR p.village ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY p.patient_id DESC`;

    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;
    }

    const result = await db.query(query, params);

    const today = new Date().toISOString().split('T')[0];
    const patients = result.rows.map(patient => {
      const regExpiry = patient.registration_expiry ? new Date(patient.registration_expiry).toISOString().split('T')[0] : null;
      const regStatus = regExpiry && regExpiry >= today ? 'active' : 'expired';
      const locDisplay = (patient.village && patient.mandal)
        ? `${patient.village}, ${patient.mandal}`
        : (patient.village || patient.mandal || patient.address || null);
      return {
        ...patient,
        registration_status: regStatus,
        expiry_date: regExpiry,
        current_doctor_name: patient.doctor_name,
        village_name: patient.village || null,
        mandal_name: patient.mandal || null,
        display_location: locDisplay
      };
    });

    if (patients.length === 0) {
      return res.json(formatResponse(true, { exists: false, classification: 'new', count: 0, patient: null, patients: [] }, 'Patient not found. Classified as NEW patient'));
    }

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

    const patientRes = await db.query(`
      SELECT p.*,
             COALESCE(
               (
                 SELECT u.full_name
                 FROM appointments a
                 JOIN doctors d ON a.doctor_id = d.doctor_id
                 JOIN users u ON d.user_id = u.user_id
                 WHERE a.patient_id = p.patient_id
                 ORDER BY a.appointment_date DESC, a.appointment_time DESC
                 LIMIT 1
               ),
               'General OPD'
             ) as current_doctor_name
      FROM patients p WHERE p.patient_id = $1 AND p.branch_id = $2
    `, [patientId, branchId]);

    if (patientRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Patient not found'));
    }
    const patient = patientRes.rows[0];

    const today = new Date().toISOString().split('T')[0];
    const regExpiry = patient.registration_expiry ? new Date(patient.registration_expiry).toISOString().split('T')[0] : null;
    const regStatus = regExpiry && regExpiry >= today ? 'active' : 'expired';
    patient.expiry_date = regExpiry;
    patient.registration_status = regStatus;
    patient.village_name = patient.village || null;
    patient.mandal_name = patient.mandal || null;
    patient.display_location = (patient.village && patient.mandal)
      ? `${patient.village}, ${patient.mandal}`
      : (patient.village || patient.mandal || patient.address || null);

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
      SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.appointment_type, a.status, u.full_name as doctor_name, d.specialization
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE a.patient_id = $1 ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 10
    `, [patientId]);

    const prescRes = await db.query(`
      SELECT pr.id as prescription_id, pr.created_at, u.full_name as doctor_name
      FROM prescriptions pr
      JOIN doctors d ON pr.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE pr.patient_id = $1 ORDER BY pr.created_at DESC LIMIT 10
    `, [patientId]);

    // CRM Calls & Callbacks
    const crmRes = await db.query(`
      SELECT * FROM call_records WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10
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
      recent_visits: visitsRes.rows,
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

    const p = req.body.patient || {};
    const a = req.body.appointment || {};
    const b = req.body.billing || {};

    const mobile_number = req.body.mobile_number || p.mobile_number;
    const full_name = req.body.full_name || p.full_name;
    const age = req.body.age !== undefined ? req.body.age : p.age;
    const gender = req.body.gender || p.gender;
    const village_mandal = req.body.village_mandal || p.village_mandal;
    const village = req.body.village || p.village;
    const mandal = req.body.mandal || p.mandal;
    const village_id = req.body.village_id || p.village_id;
    const mandal_id = req.body.mandal_id || p.mandal_id;
    const address = req.body.address || p.address;
    const ailment_reason = req.body.ailment_reason || p.ailment_reason;
    const lead_source = req.body.lead_source || p.lead_source;
    const lead_source_id = req.body.lead_source_id || p.lead_source_id;
    const lead_id = req.body.lead_id || p.lead_id;
    const referring_employee_id = req.body.referring_employee_id || req.body.referral_employee_id;
    const referring_patient_id = req.body.referring_patient_id || req.body.referral_patient_id;

    const assigned_doctor_id = req.body.assigned_doctor_id || a.doctor_id || a.assigned_doctor_id;
    const appointment_date = req.body.appointment_date || a.appointment_date;
    const appointment_time = req.body.appointment_time || a.appointment_time;
    const appointment_type = req.body.appointment_type || a.appointment_type;

    const discount_amount = req.body.discount_amount !== undefined ? req.body.discount_amount : (b.discount !== undefined ? b.discount : b.discount_amount);
    const payment_method = req.body.payment_method || b.payment_mode || b.payment_method;
    const payment_amount = req.body.payment_amount !== undefined ? req.body.payment_amount : (b.amount !== undefined ? b.amount : b.payment_amount);
    const remarks = req.body.remarks || a.remarks;

    if (!mobile_number || !full_name || !assigned_doctor_id || !appointment_date || !appointment_time) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'mobile_number, full_name, assigned_doctor_id, appointment_date, and appointment_time are required'));
    }

    const cleanMobile = mobile_number.toString().trim();
    let numericMobile = cleanMobile.replace(/\D/g, '');
    if (numericMobile.length === 12 && numericMobile.startsWith('91')) {
      numericMobile = numericMobile.slice(2);
    }
    if (numericMobile.length !== 10) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Mobile number must be a valid 10-digit number'));
    }

    let parsedAge = null;
    if (age !== undefined && age !== null && age !== '') {
      parsedAge = parseInt(age);
      if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Age must be a valid number between 1 and 120'));
      }
    }

    const cleanGender = gender ? gender.toLowerCase() : 'male';
    if (!['male', 'female', 'other'].includes(cleanGender)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, "Gender must be 'male', 'female', or 'other'"));
    }

    const apptType = (appointment_type || 'new').toLowerCase();
    if (!['new', 'renewal', 'followup'].includes(apptType)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, "Appointment type must be 'new', 'renewal', or 'followup'"));
    }

    const payMeth = (payment_method || 'cash').toLowerCase();
    if (!['cash', 'card', 'upi', 'razorpay', 'bajaj_pay'].includes(payMeth)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, "Payment method must be 'cash', 'card', 'upi', 'razorpay', or 'bajaj_pay'"));
    }

    const branchId = req.user.branch_id || 1;

    // Ensure patients table has location columns
    await ensurePatientLocationColumns(client);

    // Resolve or dynamically create Village and Mandal master data
    let locResolution = { village: null, mandal: null, village_id: null, mandal_id: null };
    if (village_mandal || village || mandal || village_id || mandal_id) {
      locResolution = await resolveOrCreateLocation(client, {
        village_mandal,
        village,
        mandal,
        village_id,
        mandal_id
      });
      if (locResolution.error) {
        await client.query('ROLLBACK');
        return res.status(locResolution.statusCode || 400).json(formatResponse(false, null, locResolution.error));
      }
    }

    // Distinguish patient acquisition channel vs medical ailment/reason
    const channelNames = [
      'inbound call', 'outbound call', 'excel import', 'import from excel',
      'outbound excel', 'call center outreach', 'inbound consultation enquiry',
      'call center executive lead', 'general consultation request', 'phone inquiry', 'phone enquiry'
    ];

    let resolvedAilment = ailment_reason ? ailment_reason.toString().trim() : '';
    const isChannelName = resolvedAilment && channelNames.includes(resolvedAilment.toLowerCase());

    if ((!resolvedAilment || isChannelName) && lead_id) {
      const leadCheck = await client.query(`SELECT requirement, remarks FROM leads WHERE lead_id = $1`, [parseInt(lead_id)]);
      if (leadCheck.rows.length > 0) {
        resolvedAilment = leadCheck.rows[0].requirement || '';
      }
    } else if (isChannelName) {
      resolvedAilment = '';
    }

    const resolvedSource = req.body.source || req.body.patient_source || p.source || (
      lead_id || lead_source === 'executive_lead'
        ? 'Call Center Executive Lead'
        : (lead_source === 'employee_referral' ? 'Employee Referral' : (lead_source === 'patient_referral' ? 'Patient Referral' : (lead_source || 'Walk-in')))
    );

    // Check if patient exists -> Auto classification
    let targetPatient = null;
    let targetPatientId = null;
    let classification = 'new';
    const existingPt = await client.query(`SELECT * FROM patients WHERE mobile_number = $1`, [numericMobile]);

    if (existingPt.rows.length > 0) {
      targetPatient = existingPt.rows[0];
      targetPatientId = targetPatient.patient_id;
      classification = 'existing';
      if (resolvedAilment) {
        await client.query(`UPDATE patients SET ailment_reason = $1, updated_at = now() WHERE patient_id = $2`, [resolvedAilment, targetPatientId]);
        targetPatient.ailment_reason = resolvedAilment;
      }
      if (locResolution.village || locResolution.mandal || locResolution.village_id || locResolution.mandal_id) {
        await client.query(`
          UPDATE patients
          SET village = COALESCE($1, village),
              mandal = COALESCE($2, mandal),
              village_id = COALESCE($3, village_id),
              mandal_id = COALESCE($4, mandal_id),
              address = COALESCE($5, address),
              updated_at = now()
          WHERE patient_id = $6
        `, [
          locResolution.village,
          locResolution.mandal,
          locResolution.village_id,
          locResolution.mandal_id,
          address || (locResolution.village && locResolution.mandal ? `${locResolution.village}, ${locResolution.mandal}` : null),
          targetPatientId
        ]);
        if (locResolution.village) targetPatient.village = locResolution.village;
        if (locResolution.mandal) targetPatient.mandal = locResolution.mandal;
        if (locResolution.village_id) targetPatient.village_id = locResolution.village_id;
        if (locResolution.mandal_id) targetPatient.mandal_id = locResolution.mandal_id;
      }
      if (!targetPatient.registration_id) {
        const regId = await generateId('REG-', 'patients', client);
        await client.query(`UPDATE patients SET registration_id = $1 WHERE patient_id = $2`, [regId, targetPatientId]);
        targetPatient.registration_id = regId;
      }
    } else {
      // Calculate registration expiry (default 30 days)
      const settingRes = await client.query(`SELECT setting_value FROM hospital_settings WHERE setting_key = 'registration_validity_days'`);
      const validityDays = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].setting_value) : 30;

      const regId = await generateId('REG-', 'patients', client);
      const regDate = new Date();
      const regExpiry = new Date();
      regExpiry.setDate(regExpiry.getDate() + validityDays);

      const resolvedAddress = address || (
        locResolution.village && locResolution.mandal
          ? `${locResolution.village}, ${locResolution.mandal}`
          : (locResolution.village || locResolution.mandal || village_mandal || null)
      );

      const newPtRes = await client.query(`
        INSERT INTO patients (
          full_name, mobile_number, age, gender, village, mandal, village_id, mandal_id, address, ailment_reason,
          registration_id, registration_date, registration_expiry, patient_type, branch_id, registered_by, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'new', $14, $15, $16)
        RETURNING *
      `, [
        full_name.trim(), numericMobile, parsedAge, cleanGender,
        locResolution.village || null,
        locResolution.mandal || null,
        locResolution.village_id || null,
        locResolution.mandal_id || null,
        resolvedAddress,
        resolvedAilment || null, regId, regDate, regExpiry, branchId, req.user.user_id,
        resolvedSource
      ]);
      targetPatient = newPtRes.rows[0];
      targetPatientId = targetPatient.patient_id;
    }

    // Verify Active Doctor
    const docRes = await client.query(`
      SELECT d.doctor_id, d.status, d.new_consultation_fee, d.renewal_consultation_fee, d.followup_consultation_fee
      FROM doctors d WHERE d.doctor_id = $1
    `, [parseInt(assigned_doctor_id)]);

    if (docRes.rows.length === 0 || docRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Selected doctor is inactive or resigned. Please select an active doctor'));
    }

    const doctor = docRes.rows[0];

    // Server-side Doctor Default Consultation Fee
    let defaultDocFee = parseFloat(doctor.new_consultation_fee || 500);
    if (apptType === 'renewal') defaultDocFee = parseFloat(doctor.renewal_consultation_fee || 300);
    if (apptType === 'followup') defaultDocFee = parseFloat(doctor.followup_consultation_fee || 200);

    // Patient-Specific Consultation Fee Override (Temporary for this registration only)
    const rawFee = req.body.consultation_fee !== undefined
      ? req.body.consultation_fee
      : (b.consultation_fee !== undefined
        ? b.consultation_fee
        : (req.body.fee !== undefined ? req.body.fee : undefined));

    let baseFee = defaultDocFee;
    if (rawFee !== undefined && rawFee !== null && rawFee !== '') {
      const parsedFee = parseFloat(rawFee);
      if (isNaN(parsedFee) || parsedFee < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Consultation fee must be a valid non-negative number'));
      }
      baseFee = parsedFee;
    }

    // Handle Discount Validation
    const discount = discount_amount !== undefined && discount_amount !== '' ? parseFloat(discount_amount) : 0;
    if (isNaN(discount) || discount < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Discount amount cannot be negative'));
    }

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
    const paidAmt = payment_amount !== undefined && payment_amount !== '' ? parseFloat(payment_amount) : finalFee;
    if (isNaN(paidAmt) || paidAmt < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Payment amount cannot be negative'));
    }
    if (paidAmt > finalFee) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Payment amount (₹${paidAmt}) cannot exceed final payable fee (₹${finalFee})`));
    }
    const dueAmt = Math.max(0, finalFee - paidAmt);

    // Parse and sanitize appointment date (accepts YYYY-MM-DD or DD/MM/YYYY)
    let cleanDate = appointment_date.toString().trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
      const [d, m, y] = cleanDate.split('/');
      cleanDate = `${y}-${m}-${d}`;
    }

    // Parse and sanitize appointment time (strips 'hrs', 'am', 'pm' and ensures valid time format)
    let cleanTime = appointment_time.toString().trim().replace(/\s*hrs$/i, '').replace(/\s*(am|pm)$/i, '').trim();
    if (/^\d{1,2}:\d{2}$/.test(cleanTime)) {
      cleanTime = `${cleanTime}:00`;
    }

    // Check Doctor Slot Availability (Prevent Double Booking)
    const slotCheck = await client.query(`
      SELECT appointment_id FROM appointments
      WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time::time = $3::time AND status NOT IN ('cancelled')
    `, [parseInt(assigned_doctor_id), cleanDate, cleanTime]);

    if (slotCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Selected doctor is already booked at ${appointment_time} on ${cleanDate}. Double booking is not allowed. Please choose another time slot.`));
    }

    // Determine initial appointment status (checked_in for today if auto_checkin enabled, scheduled otherwise)
    const localToday = new Date().toLocaleDateString('en-CA');
    const utcToday = new Date().toISOString().split('T')[0];
    const isToday = (cleanDate === localToday || cleanDate === utcToday);
    const initialApptStatus = (isToday && req.body.auto_checkin !== false) ? 'checked_in' : 'scheduled';

    // Create Appointment
    const apptRes = await client.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, created_by, branch_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [targetPatientId, parseInt(assigned_doctor_id), cleanDate, cleanTime, apptType, initialApptStatus, req.user.user_id, branchId]);

    const newAppt = apptRes.rows[0];

    // Create Bill (Bill Type = 'consultation', status = 'created')
    const billNum = await generateId('INV-', 'bills', client);
    const billRes = await client.query(`
      INSERT INTO bills (
        bill_number, patient_id, doctor_id, bill_type, created_by, branch_id,
        amount, discount_amount, final_amount, status, appointment_id
      ) VALUES ($1, $2, $3, 'consultation', $4, $5, $6, $7, $8, 'created', $9)
      RETURNING *
    `, [billNum, targetPatientId, parseInt(assigned_doctor_id), req.user.user_id, branchId, baseFee, discount, finalFee, newAppt.appointment_id]);

    const newBill = billRes.rows[0];
    newBill.due_amount = dueAmt;
    newBill.paid_amount = paidAmt;

    // Record Payment
    let newPayment = null;
    if (paidAmt > 0) {
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

    // If Referral metadata provided, link in referrals table
    let newReferral = null;
    if (referring_employee_id || lead_source === 'employee_referral') {
      const empId = referring_employee_id ? parseInt(referring_employee_id) : req.user.user_id;
      const empRes = await client.query(`SELECT user_id, employee_id, department, full_name, status FROM users WHERE user_id = $1`, [empId]);
      if (empRes.rows.length === 0 || empRes.rows[0].status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Selected referring employee not found or inactive'));
      }
      const emp = empRes.rows[0];
      const refCode = await generateId('REF-', 'referrals', client);
      const refRes = await client.query(`
        INSERT INTO referrals (patient_id, referral_type, referred_by, referral_code, referring_employee_id, department, remarks)
        VALUES ($1, 'employee', $2, $3, $4, $5, $6)
        RETURNING *
      `, [targetPatientId, emp.user_id, refCode, emp.user_id, emp.department || 'General', remarks || null]);
      newReferral = refRes.rows[0];
    } else if (referring_patient_id || lead_source === 'patient_referral') {
      if (referring_patient_id) {
        const ptRefRes = await client.query(`SELECT patient_id, full_name FROM patients WHERE patient_id = $1`, [parseInt(referring_patient_id)]);
        if (ptRefRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json(formatResponse(false, null, 'Selected referring patient not found'));
        }
        const refCode = await generateId('REF-', 'referrals', client);
        const refRes = await client.query(`
          INSERT INTO referrals (patient_id, referral_type, referral_code, referring_patient_id, remarks)
          VALUES ($1, 'patient', $2, $3, $4)
          RETURNING *
        `, [targetPatientId, refCode, parseInt(referring_patient_id), remarks || null]);
        newReferral = refRes.rows[0];
      }
    }

    await client.query('COMMIT');

    const isReferralTarget = !!newReferral || lead_source === 'employee_referral' || lead_source === 'patient_referral';
    const targetTarget = isReferralTarget ? 'Unit Target' : (classification === 'new' ? 'Enquiry Target' : 'Unit Target');

    res.locals.auditEntry = { module: 'Patient Registration', action: 'Register Patient', recordId: targetPatientId, newValue: newBill };
    return res.status(201).json(formatResponse(true, {
      classification,
      target_target: targetTarget,
      patient_id: targetPatientId,
      registration_id: targetPatient?.registration_id,
      patient: {
        ...targetPatient,
        village_id: locResolution.village_id || targetPatient?.village_id || null,
        mandal_id: locResolution.mandal_id || targetPatient?.mandal_id || null,
        village_name: locResolution.village || targetPatient?.village || null,
        mandal_name: locResolution.mandal || targetPatient?.mandal || null,
        display_location: (locResolution.village && locResolution.mandal)
          ? `${locResolution.village}, ${locResolution.mandal}`
          : (locResolution.village || locResolution.mandal || targetPatient?.village || targetPatient?.mandal || targetPatient?.address || null)
      },
      appointment: newAppt,
      bill: newBill,
      payment: newPayment,
      referral: newReferral
    }, `Patient registered successfully (${targetTarget})`));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('registerPatient error:', err);
    return res.status(500).json(formatResponse(false, null, err.message || 'Internal server error'));
  } finally {
    client.release();
  }
}

// 3.5B Patient Detail Corrections
async function updatePatient(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const patientId = parseInt(req.params.id);
    if (!patientId || isNaN(patientId)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Valid patient ID is required'));
    }

    const ptRes = await client.query(`SELECT * FROM patients WHERE patient_id = $1 FOR UPDATE`, [patientId]);
    if (ptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Patient not found'));
    }

    const currentPatient = ptRes.rows[0];
    const userBranchId = req.user.branch_id || 1;
    if (currentPatient.branch_id !== userBranchId && req.user.role !== 'super_admin') {
      await client.query('ROLLBACK');
      return res.status(403).json(formatResponse(false, null, 'Cannot edit patient from another branch'));
    }

    const {
      full_name,
      mobile_number,
      age,
      gender,
      village_mandal,
      village,
      mandal,
      village_id,
      mandal_id,
      address,
      ailment_reason,
      source
    } = req.body;

    // Validate full_name
    let cleanFullName = currentPatient.full_name;
    if (full_name !== undefined) {
      if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Patient full name cannot be empty or whitespace'));
      }
      cleanFullName = full_name.trim();
    }

    // Validate mobile_number
    let cleanMobile = currentPatient.mobile_number;
    if (mobile_number !== undefined) {
      const mobStr = mobile_number.toString().trim();
      let numericMobile = mobStr.replace(/\D/g, '');
      if (numericMobile.length === 12 && numericMobile.startsWith('91')) {
        numericMobile = numericMobile.slice(2);
      }
      if (numericMobile.length !== 10) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Mobile number must be a valid 10-digit number'));
      }

      // Check duplicate mobile for other patients
      const dupCheck = await client.query(
        `SELECT patient_id FROM patients WHERE mobile_number = $1 AND patient_id != $2`,
        [numericMobile, patientId]
      );
      if (dupCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, `Mobile number ${numericMobile} already belongs to another patient`));
      }
      cleanMobile = numericMobile;
    }

    // Validate age
    let cleanAge = currentPatient.age;
    if (age !== undefined && age !== null && age !== '') {
      const parsedAge = parseInt(age);
      if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 120) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Age must be a valid number between 0 and 120'));
      }
      cleanAge = parsedAge;
    }

    // Validate gender
    let cleanGender = currentPatient.gender;
    if (gender !== undefined) {
      const g = gender.toString().toLowerCase().trim();
      if (!['male', 'female', 'other'].includes(g)) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, "Gender must be 'male', 'female', or 'other'"));
      }
      cleanGender = g;
    }

    // Location resolution
    let cleanVillage = currentPatient.village;
    let cleanMandal = currentPatient.mandal;
    let cleanVillageId = currentPatient.village_id;
    let cleanMandalId = currentPatient.mandal_id;

    if (village_mandal !== undefined || village !== undefined || mandal !== undefined || village_id !== undefined || mandal_id !== undefined) {
      const locRes = await resolveOrCreateLocation(client, {
        village_mandal,
        village,
        mandal,
        village_id,
        mandal_id
      });
      if (locRes.error) {
        await client.query('ROLLBACK');
        return res.status(locRes.statusCode || 400).json(formatResponse(false, null, locRes.error));
      }
      cleanVillage = locRes.village;
      cleanMandal = locRes.mandal;
      cleanVillageId = locRes.village_id;
      cleanMandalId = locRes.mandal_id;
    }

    const cleanAddress = address !== undefined ? address : currentPatient.address;
    const cleanAilment = ailment_reason !== undefined ? ailment_reason : currentPatient.ailment_reason;
    const cleanSource = source !== undefined ? source : currentPatient.source;

    // Execute UPDATE — patient_id and registration_id remain immutable
    const updateRes = await client.query(`
      UPDATE patients
      SET full_name = $1,
          mobile_number = $2,
          age = $3,
          gender = $4,
          village = $5,
          mandal = $6,
          village_id = $7,
          mandal_id = $8,
          address = $9,
          ailment_reason = $10,
          source = $11,
          updated_at = now()
      WHERE patient_id = $12
      RETURNING *
    `, [
      cleanFullName, cleanMobile, cleanAge, cleanGender,
      cleanVillage, cleanMandal, cleanVillageId, cleanMandalId,
      cleanAddress, cleanAilment, cleanSource,
      patientId
    ]);

    const updatedPatient = updateRes.rows[0];

    // Audit Log
    await client.query(`
      INSERT INTO audit_logs (
        user_id, role, action, module, record_id, old_value, new_value, remarks, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      req.user.user_id,
      req.user.role,
      'Edit Patient Details',
      'Patients',
      String(patientId),
      JSON.stringify(currentPatient),
      JSON.stringify(updatedPatient),
      'Patient demographic details updated',
      userBranchId
    ]);

    await client.query('COMMIT');
    return res.json(formatResponse(true, updatedPatient, 'Patient details updated successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updatePatient error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while updating patient'));
  } finally {
    client.release();
  }
}

// 3.6 Enquiries
async function createEnquiry(req, res) {
  try {
    const {
      name,
      mobile,
      age,
      gender,
      village_mandal,
      reason_requirement,
      source,
      lead_source,
      remarks
    } = req.body;

    const trimmedName = name ? name.toString().trim() : '';
    const trimmedMobile = mobile ? mobile.toString().trim() : '';

    if (!trimmedName) {
      return res.status(400).json(formatResponse(false, null, 'Enquirer full name is required'));
    }

    if (!trimmedMobile || !/^[0-9]{10}$/.test(trimmedMobile)) {
      return res.status(400).json(formatResponse(false, null, 'Valid 10-digit mobile number is required'));
    }

    const branchId = req.user.branch_id || 1;
    const parsedAge = age ? parseInt(age) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 120)) {
      return res.status(400).json(formatResponse(false, null, 'Age must be between 1 and 120 years'));
    }

    const validGenders = ['male', 'female', 'other'];
    const pGender = gender && validGenders.includes(gender.toLowerCase()) ? gender.toLowerCase() : 'male';
    const validLeadSources = ['inbound', 'outbound'];
    const pLeadSource = lead_source && validLeadSources.includes(lead_source.toLowerCase()) ? lead_source.toLowerCase() : 'inbound';
    const sourceLabel = source ? source.toString().trim() : 'Phone Inquiry';
    const reqText = reason_requirement ? reason_requirement.toString().trim() : null;
    const remText = remarks ? remarks.toString().trim() : null;

    let resolvedVillage = null;
    let resolvedMandal = null;
    if (village_mandal) {
      try {
        const loc = await resolveOrCreateLocation(db, { village_mandal });
        resolvedVillage = loc.village || village_mandal.toString().trim();
        resolvedMandal = loc.mandal || null;
      } catch (e) {
        resolvedVillage = village_mandal.toString().trim();
      }
    }

    const leadRes = await db.query(`
      INSERT INTO leads (
        lead_name, mobile_number, age, gender, village, mandal, source,
        campaign, lead_source, lead_created_by_user_id, status, branch_id,
        requirement, remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', $11, $12, $13)
      RETURNING *
    `, [
      trimmedName,
      trimmedMobile,
      parsedAge,
      pGender,
      resolvedVillage,
      resolvedMandal,
      sourceLabel,
      null,
      pLeadSource,
      req.user.user_id,
      branchId,
      reqText,
      remText
    ]);

    res.locals.auditEntry = {
      module: 'Enquiry Management',
      action: 'Create Enquiry',
      recordId: leadRes.rows[0].lead_id,
      newValue: leadRes.rows[0]
    };

    return res.status(201).json(formatResponse(true, leadRes.rows[0], 'Enquiry recorded successfully (routes to Enquiry Target)'));
  } catch (err) {
    console.error('createEnquiry error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getEnquiries(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const { search, status, lead_source, limit, offset } = req.query;

    let query = `
      SELECT l.*, u.full_name as created_by_name, p.registration_id as converted_registration_id, p.full_name as converted_patient_name
      FROM leads l
      LEFT JOIN users u ON l.lead_created_by_user_id = u.user_id
      LEFT JOIN patients p ON l.patient_id = p.patient_id
      WHERE l.branch_id = $1
    `;
    const params = [branchId];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (l.lead_name ILIKE $${params.length} OR l.mobile_number ILIKE $${params.length} OR CAST(l.lead_id AS TEXT) ILIKE $${params.length})`;
    }

    if (status) {
      params.push(status);
      query += ` AND l.status = $${params.length}`;
    }

    if (lead_source) {
      params.push(lead_source);
      query += ` AND l.lead_source = $${params.length}`;
    }

    query += ` ORDER BY l.lead_id DESC`;

    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;
    }

    const result = await db.query(query, params);
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
    const { patient_name, mobile_number, age, gender, village_mandal, village, mandal, village_id, mandal_id, address, reason, referring_employee_id, remarks } = req.body;

    if (!patient_name || !mobile_number || !referring_employee_id) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_name, mobile_number, and referring_employee_id are required'));
    }

    const branchId = req.user.branch_id || 1;

    // Check referring employee user
    const empRes = await client.query(`SELECT user_id, employee_id, department, status, full_name FROM users WHERE user_id = $1`, [parseInt(referring_employee_id)]);
    if (empRes.rows.length === 0 || empRes.rows[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Referring employee not found or inactive'));
    }
    const emp = empRes.rows[0];

    // Find or create patient
    let ptId = null;
    const cleanMobile = mobile_number.toString().trim();
    const ptCheck = await client.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [cleanMobile]);
    if (ptCheck.rows.length > 0) {
      ptId = ptCheck.rows[0].patient_id;
    } else {
      // Fetch validity days setting from hospital_settings
      const settingRes = await client.query(`SELECT setting_value FROM hospital_settings WHERE setting_key = 'registration_validity_days'`);
      const validityDays = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].setting_value) : 30;

      const regId = await generateId('REG-', 'patients');
      const regDate = new Date();
      const regExpiry = new Date();
      regExpiry.setDate(regExpiry.getDate() + validityDays);

      await ensurePatientLocationColumns(client);

      let locResolution = { village: null, mandal: null, village_id: null, mandal_id: null };
      if (village_mandal || village || mandal || village_id || mandal_id) {
        locResolution = await resolveOrCreateLocation(client, {
          village_mandal,
          village,
          mandal,
          village_id,
          mandal_id
        });
        if (locResolution.error) {
          await client.query('ROLLBACK');
          return res.status(locResolution.statusCode || 400).json(formatResponse(false, null, locResolution.error));
        }
      }

      const resolvedAddress = address || (
        locResolution.village && locResolution.mandal
          ? `${locResolution.village}, ${locResolution.mandal}`
          : (locResolution.village || locResolution.mandal || village_mandal || null)
      );

      const newPt = await client.query(`
        INSERT INTO patients (
          full_name, mobile_number, age, gender, village, mandal, village_id, mandal_id, address, ailment_reason,
          registration_id, registration_date, registration_expiry, patient_type, branch_id, registered_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'new', $14, $15)
        RETURNING patient_id
      `, [
        patient_name.trim(),
        cleanMobile,
        age ? parseInt(age) : null,
        gender || 'male',
        locResolution.village || null,
        locResolution.mandal || null,
        locResolution.village_id || null,
        locResolution.mandal_id || null,
        resolvedAddress,
        reason ? reason.trim() : null,
        regId,
        regDate,
        regExpiry,
        branchId,
        req.user.user_id
      ]);
      ptId = newPt.rows[0].patient_id;
    }

    const refCode = await generateId('REF-', 'referrals');

    const refRes = await client.query(`
      INSERT INTO referrals (patient_id, referral_type, referred_by, referral_code, referring_employee_id, department, remarks)
      VALUES ($1, 'employee', $2, $3, $4, $5, $6)
      RETURNING *
    `, [ptId, req.user.user_id, refCode, emp.user_id, emp.department || 'General', remarks || null]);

    // Handle Appointment and Bill creation if doctor is provided
    let newAppt = null;
    let newBill = null;
    let newPayment = null;

    if (req.body.assigned_doctor_id && req.body.appointment_date) {
      const docRes = await client.query(`
        SELECT doctor_id, status, new_consultation_fee, renewal_consultation_fee, followup_consultation_fee
        FROM doctors WHERE doctor_id = $1
      `, [parseInt(req.body.assigned_doctor_id)]);

      if (docRes.rows.length === 0 || docRes.rows[0].status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Selected doctor is inactive or resigned'));
      }
      const doctor = docRes.rows[0];
      const apptDate = req.body.appointment_date;
      const apptTime = req.body.appointment_time || '10:00:00';
      const apptType = (req.body.appointment_type || 'new').toLowerCase();

      let defaultDocFee = parseFloat(doctor.new_consultation_fee || 500);
      if (apptType === 'renewal') defaultDocFee = parseFloat(doctor.renewal_consultation_fee || 300);
      if (apptType === 'followup') defaultDocFee = parseFloat(doctor.followup_consultation_fee || 200);

      const rawFee = req.body.consultation_fee !== undefined ? req.body.consultation_fee : req.body.fee;
      let baseFee = defaultDocFee;
      if (rawFee !== undefined && rawFee !== null && rawFee !== '') {
        const parsedFee = parseFloat(rawFee);
        if (isNaN(parsedFee) || parsedFee < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json(formatResponse(false, null, 'Consultation fee must be a valid non-negative number'));
        }
        baseFee = parsedFee;
      }

      const discount = req.body.discount_amount ? parseFloat(req.body.discount_amount) : 0;
      const finalFee = Math.max(0, baseFee - discount);
      const paidAmt = req.body.payment_amount !== undefined ? parseFloat(req.body.payment_amount) : finalFee;

      const apptRes = await client.query(`
        INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, created_by, branch_id)
        VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7) RETURNING *
      `, [ptId, doctor.doctor_id, apptDate, apptTime, apptType, req.user.user_id, branchId]);
      newAppt = apptRes.rows[0];

      const billNum = await generateId('INV-', 'bills');
      const billRes = await client.query(`
        INSERT INTO bills (bill_number, patient_id, doctor_id, bill_type, created_by, branch_id, total_amount, discount_amount, net_amount, paid_amount, balance_due, payment_status, status)
        VALUES ($1, $2, $3, 'consultation', $4, $5, $6, $7, $8, $9, $10, $11, 'completed') RETURNING *
      `, [billNum, ptId, doctor.doctor_id, req.user.user_id, branchId, baseFee, discount, finalFee, paidAmt, Math.max(0, finalFee - paidAmt), paidAmt >= finalFee ? 'paid' : (paidAmt > 0 ? 'partial' : 'pending')]);
      newBill = billRes.rows[0];

      if (paidAmt > 0) {
        const payNum = await generateId('PAY-', 'bill_payments');
        const payRes = await client.query(`
          INSERT INTO bill_payments (bill_id, payment_number, amount, payment_method, payment_status, created_by, branch_id)
          VALUES ($1, $2, $3, $4, 'completed', $5, $6) RETURNING *
        `, [newBill.bill_id, payNum, paidAmt, req.body.payment_method || 'cash', req.user.user_id, branchId]);
        newPayment = payRes.rows[0];
      }
    }

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Referral Management',
      action: 'Create Employee Referral',
      recordId: refRes.rows[0].referral_id,
      newValue: refRes.rows[0]
    };

    return res.status(201).json(formatResponse(true, {
      ...refRes.rows[0],
      appointment: newAppt,
      bill: newBill,
      payment: newPayment
    }, 'Employee referral recorded successfully (routes to Unit Target)'));

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
    const { patient_name, mobile_number, age, gender, village_mandal, village, mandal, village_id, mandal_id, address, reason, referring_patient_id, remarks, assigned_doctor_id } = req.body;
    const assignedDoctorId = assigned_doctor_id ? parseInt(assigned_doctor_id, 10) : null;

    if (!patient_name || !mobile_number || !referring_patient_id) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_name, mobile_number, and referring_patient_id are required'));
    }

    const branchId = req.user.branch_id || 1;

    // Check referring patient
    const ptRefRes = await client.query(`SELECT patient_id, full_name FROM patients WHERE patient_id = $1`, [parseInt(referring_patient_id)]);
    if (ptRefRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Referring patient not found'));
    }

    // Find or create patient
    let ptId = null;
    const cleanMobile = mobile_number.toString().trim();
    const ptCheck = await client.query(`SELECT patient_id FROM patients WHERE mobile_number = $1`, [cleanMobile]);
    if (ptCheck.rows.length > 0) {
      ptId = ptCheck.rows[0].patient_id;
    } else {
      const settingRes = await client.query(`SELECT setting_value FROM hospital_settings WHERE setting_key = 'registration_validity_days'`);
      const validityDays = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].setting_value) : 30;

      const regId = await generateId('REG-', 'patients');
      const regDate = new Date();
      const regExpiry = new Date();
      regExpiry.setDate(regExpiry.getDate() + validityDays);

      await ensurePatientLocationColumns(client);

      let locResolution = { village: null, mandal: null, village_id: null, mandal_id: null };
      if (village_mandal || village || mandal || village_id || mandal_id) {
        locResolution = await resolveOrCreateLocation(client, {
          village_mandal,
          village,
          mandal,
          village_id,
          mandal_id
        });
        if (locResolution.error) {
          await client.query('ROLLBACK');
          return res.status(locResolution.statusCode || 400).json(formatResponse(false, null, locResolution.error));
        }
      }

      const resolvedAddress = address || (
        locResolution.village && locResolution.mandal
          ? `${locResolution.village}, ${locResolution.mandal}`
          : (locResolution.village || locResolution.mandal || village_mandal || null)
      );

      const newPt = await client.query(`
        INSERT INTO patients (
          full_name, mobile_number, age, gender, village, mandal, village_id, mandal_id, address, ailment_reason,
          registration_id, registration_date, registration_expiry, patient_type, branch_id, registered_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'new', $14, $15)
        RETURNING patient_id
      `, [
        patient_name.trim(),
        cleanMobile,
        age ? parseInt(age) : null,
        gender || 'male',
        locResolution.village || null,
        locResolution.mandal || null,
        locResolution.village_id || null,
        locResolution.mandal_id || null,
        resolvedAddress,
        reason ? reason.trim() : null,
        regId,
        regDate,
        regExpiry,
        branchId,
        req.user.user_id
      ]);
      ptId = newPt.rows[0].patient_id;
    }

    const refCode = await generateId('REF-', 'referrals');

    const refRes = await client.query(`
      INSERT INTO referrals (patient_id, referral_type, referred_by, referral_code, referring_patient_id, remarks)
      VALUES ($1, 'patient', $2, $3, $4, $5)
      RETURNING *
    `, [ptId, req.user.user_id, refCode, parseInt(referring_patient_id), remarks || null]);

    // Automatically generate referral reward coupon for Patient A (the referrer)
    let rewardCoupon = null;
    try {
      const rewardCode = await generateId('REF-', 'coupons', client);
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 90);

      const coupRes = await client.query(`
        INSERT INTO coupons (
          coupon_code, discount_type, discount_value, max_discount_limit,
          referring_patient_id, referred_patient_id, valid_from, valid_until,
          status, remarks, branch_id, created_by
        ) VALUES ($1, 'cash', 500, NULL, $2, $3, $4, $5, 'active', $6, $7, $8)
        RETURNING *
      `, [
        rewardCode,
        parseInt(referring_patient_id, 10),
        ptId,
        validFrom.toISOString().split('T')[0],
        validUntil.toISOString().split('T')[0],
        `Referral reward for introducing patient #${ptId}`,
        branchId,
        req.user.user_id
      ]);
      rewardCoupon = coupRes.rows[0];
    } catch (cErr) {
      console.warn('Auto coupon generation warning:', cErr.message);
    }

    // If doctor assignment & schedule parameters are supplied, create Appointment & Bill & Payment
    let newAppt = null;
    let newBill = null;
    let newPayment = null;
    if (assignedDoctorId) {
      const docRes = await client.query(`SELECT doctor_id, status, new_consultation_fee, renewal_consultation_fee, followup_consultation_fee FROM doctors WHERE doctor_id = $1`, [assignedDoctorId]);
      if (docRes.rows.length > 0 && docRes.rows[0].status === 'active') {
        const doctor = docRes.rows[0];
        const apptDate = req.body.appointment_date || new Date().toISOString().split('T')[0];
        const apptTime = req.body.appointment_time || '10:00:00';
        const apptType = (req.body.appointment_type || 'new').toLowerCase();

        let defaultDocFee = parseFloat(doctor.new_consultation_fee || 500);
        if (apptType === 'renewal') defaultDocFee = parseFloat(doctor.renewal_consultation_fee || 300);
        if (apptType === 'followup') defaultDocFee = parseFloat(doctor.followup_consultation_fee || 200);

        const rawFee = req.body.consultation_fee !== undefined ? req.body.consultation_fee : req.body.fee;
        let baseFee = defaultDocFee;
        if (rawFee !== undefined && rawFee !== null && rawFee !== '') {
          const parsedFee = parseFloat(rawFee);
          if (isNaN(parsedFee) || parsedFee < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json(formatResponse(false, null, 'Consultation fee must be a valid non-negative number'));
          }
          baseFee = parsedFee;
        }

        const discount = req.body.discount_amount ? parseFloat(req.body.discount_amount) : 0;
        const finalFee = Math.max(0, baseFee - discount);
        const paidAmt = req.body.payment_amount !== undefined && req.body.payment_amount !== '' ? parseFloat(req.body.payment_amount) : finalFee;
        const payMeth = (req.body.payment_method || 'cash').toLowerCase();

        const isToday = apptDate === new Date().toISOString().split('T')[0];
        const initialApptStatus = isToday ? 'checked_in' : 'scheduled';

        const apptRes = await client.query(`
          INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, created_by, branch_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [ptId, assignedDoctorId, apptDate, apptTime, apptType, initialApptStatus, req.user.user_id, branchId]);
        newAppt = apptRes.rows[0];

        const billNum = await generateId('INV-', 'bills');
        const billRes = await client.query(`
          INSERT INTO bills (bill_number, patient_id, doctor_id, bill_type, created_by, branch_id, amount, discount_amount, final_amount, status)
          VALUES ($1, $2, $3, 'consultation', $4, $5, $6, $7, $8, 'created')
          RETURNING *
        `, [billNum, ptId, assignedDoctorId, req.user.user_id, branchId, baseFee, discount, finalFee]);
        newBill = billRes.rows[0];

        if (paidAmt > 0) {
          const payRes = await client.query(`
            INSERT INTO payments (bill_id, patient_id, payment_method, amount, status, received_by, branch_id)
            VALUES ($1, $2, $3, $4, 'success', $5, $6)
            RETURNING *
          `, [newBill.bill_id, ptId, payMeth, paidAmt, req.user.user_id, branchId]);
          newPayment = payRes.rows[0];
        }

        const dueAmt = Math.max(0, finalFee - paidAmt);
        if (dueAmt > 0) {
          await client.query(`
            INSERT INTO due_patients (patient_id, bill_id, due_amount, status, branch_id)
            VALUES ($1, $2, $3, 'pending', $4)
          `, [ptId, newBill.bill_id, dueAmt, branchId]);
        }
      }
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Referrals', action: 'Create Patient Referral', recordId: refRes.rows[0].id, newValue: refRes.rows[0] };
    return res.status(201).json(formatResponse(true, {
      ...refRes.rows[0],
      appointment: newAppt,
      bill: newBill,
      payment: newPayment
    }, 'Patient referral recorded successfully (routes to Unit Target)'));

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

async function getEligibleEmployees(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const { search, limit, offset } = req.query;

    let query = `
      SELECT user_id, full_name, username, employee_id, role, department, mobile_number, branch_id
      FROM users
      WHERE status = 'active' AND (branch_id = $1 OR branch_id IS NULL OR role = 'super_admin')
    `;
    const params = [branchId];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (full_name ILIKE $${params.length} OR employee_id ILIKE $${params.length} OR mobile_number ILIKE $${params.length} OR username ILIKE $${params.length})`;
    }

    query += ` ORDER BY full_name ASC`;

    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;
    }

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Eligible employees retrieved successfully'));
  } catch (err) {
    console.error('getEligibleEmployees error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3.8 Executive Lead Queue
async function getExecutiveLeads(req, res) {
  try {
    const branchId = req.user.branch_id || 1;
    const { status, search, limit, offset } = req.query;

    let query = `
      SELECT l.*,
             COALESCE(u.full_name, u2.full_name, 'Call Center Executive') as executive_name,
             COALESCE(u.employee_id, u2.employee_id, 'EXEC-001') as executive_employee_id,
             p.registration_id as converted_registration_id,
             p.full_name as converted_patient_name
      FROM leads l
      LEFT JOIN users u ON l.executive_id = u.user_id
      LEFT JOIN users u2 ON l.lead_created_by_user_id = u2.user_id
      LEFT JOIN patients p ON l.patient_id = p.patient_id
      WHERE l.branch_id = $1
    `;
    const params = [branchId];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND l.status = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (l.lead_name ILIKE $${params.length} OR l.mobile_number ILIKE $${params.length} OR CAST(l.lead_id AS TEXT) ILIKE $${params.length})`;
    }

    query += ` ORDER BY l.lead_id DESC`;

    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;
    }

    const result = await db.query(query, params);
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
      SELECT l.*,
             COALESCE(u.full_name, u2.full_name, 'Call Center Executive') as executive_name,
             COALESCE(u.employee_id, u2.employee_id, 'EXEC-001') as executive_employee_id
      FROM leads l
      LEFT JOIN users u ON l.executive_id = u.user_id
      LEFT JOIN users u2 ON l.lead_created_by_user_id = u2.user_id
      WHERE l.lead_id = $1 AND l.branch_id = $2
    `, [leadId, branchId]);

    if (leadRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Lead not found'));
    }

    // Touch status to 'contacted' if it was 'new'
    if (leadRes.rows[0].status === 'new') {
      await db.query(`
        UPDATE leads SET status = 'contacted', assigned_receptionist_id = $1, updated_at = now()
        WHERE lead_id = $2
      `, [req.user.user_id, leadId]);
      leadRes.rows[0].status = 'contacted';
    }

    return res.json(formatResponse(true, leadRes.rows[0], 'Executive lead details retrieved for doctor assignment'));
  } catch (err) {
    console.error('openExecutiveLead error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function assignExecutiveLeadDoctor(req, res) {
  try {
    const leadId = parseInt(req.params.id);
    const branchId = req.user.branch_id || 1;
    const { doctor_id, remarks } = req.body;

    if (!doctor_id) {
      return res.status(400).json(formatResponse(false, null, 'doctor_id is required'));
    }

    // Verify doctor is active and belongs to branch
    const docRes = await db.query(`
      SELECT d.doctor_id, u.full_name as doctor_name
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.doctor_id = $1 AND d.branch_id = $2 AND d.status = 'active' AND u.status = 'active'
    `, [parseInt(doctor_id), branchId]);

    if (docRes.rows.length === 0) {
      return res.status(400).json(formatResponse(false, null, 'Selected doctor is inactive or not available in this branch'));
    }

    // Verify lead exists in branch
    const leadCheck = await db.query(`SELECT * FROM leads WHERE lead_id = $1 AND branch_id = $2`, [leadId, branchId]);
    if (leadCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Lead not found in this branch'));
    }

    // Update lead status to 'assigned'
    const updateRes = await db.query(`
      UPDATE leads
      SET status = 'assigned', assigned_receptionist_id = $1, campaign = COALESCE($2, campaign), updated_at = now()
      WHERE lead_id = $3
      RETURNING *
    `, [req.user.user_id, remarks || null, leadId]);

    res.locals.auditEntry = {
      module: 'Executive Leads Queue',
      action: 'Assign Doctor to Lead',
      recordId: leadId,
      newValue: { lead_id: leadId, doctor_id: parseInt(doctor_id), status: 'assigned' }
    };

    return res.json(formatResponse(true, updateRes.rows[0], 'Doctor assigned to executive lead successfully'));
  } catch (err) {
    console.error('assignExecutiveLeadDoctor error:', err);
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

async function reassignOrRescheduleAppointment(req, res, isReassign = false) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const apptId = parseInt(req.params.id);
    if (!apptId || isNaN(apptId)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Valid appointment ID is required'));
    }

    const { appointment_date, appointment_time, doctor_id, reason } = req.body;

    if (!appointment_date || !appointment_time) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'appointment_date and appointment_time are required'));
    }

    if (isReassign && (!reason || typeof reason !== 'string' || reason.trim().length < 3)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'A valid reason (minimum 3 characters) is required for doctor reassignment'));
    }

    // Lock appointment
    const apptRes = await client.query(`
      SELECT a.*, p.branch_id as patient_branch_id, p.full_name as patient_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      WHERE a.appointment_id = $1
      FOR UPDATE OF a
    `, [apptId]);

    if (apptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Appointment not found'));
    }

    const appt = apptRes.rows[0];
    const userBranchId = req.user.branch_id || 1;

    // RBAC branch check
    if (req.user.role !== 'super_admin' && appt.patient_branch_id !== userBranchId) {
      await client.query('ROLLBACK');
      return res.status(403).json(formatResponse(false, null, 'Cannot modify appointment belonging to another branch'));
    }

    // Immutability checks: Completed or In Consultation appointments cannot be reassigned
    const completedStatuses = ['completed', 'doctor_completed', 'dispensed', 'pro_completed'];
    if (completedStatuses.includes(appt.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Cannot reassign or reschedule an appointment that is already ${appt.status}`));
    }
    if (appt.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Cannot reassign or reschedule a cancelled appointment'));
    }
    if (appt.status === 'in_consultation') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Cannot reassign an appointment currently in consultation'));
    }

    const targetDoctorId = doctor_id ? parseInt(doctor_id) : appt.doctor_id;
    if (!targetDoctorId || isNaN(targetDoctorId)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Valid doctor_id is required'));
    }

    // Validate Doctor Availability (doctor active, within branch, leaves, slot collision, patient double booking)
    const avail = await validateDoctorAvailability(
      client,
      targetDoctorId,
      appointment_date,
      appointment_time,
      apptId,
      appt.patient_branch_id,
      appt.patient_id
    );

    if (!avail.valid) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, avail.error));
    }

    const doctorChanged = targetDoctorId !== appt.doctor_id;
    let transferredBill = null;

    if (doctorChanged) {
      // Find consultation bill attached to this appointment (or by patient + old_doctor)
      const billRes = await client.query(`
        SELECT * FROM bills
        WHERE (appointment_id = $1 OR (patient_id = $2 AND doctor_id = $3 AND bill_type = 'consultation'))
          AND bill_type = 'consultation'
        ORDER BY bill_id DESC
        LIMIT 1
        FOR UPDATE
      `, [apptId, appt.patient_id, appt.doctor_id]);

      if (billRes.rows.length > 0) {
        const existingBill = billRes.rows[0];
        // Transfer consultation bill attribution to the new doctor.
        // Financial Invariant: exactly 1 bill, exactly existing payments, 0 extra charges to patient.
        const updatedBillRes = await client.query(`
          UPDATE bills
          SET doctor_id = $1,
              appointment_id = $2,
              updated_at = now()
          WHERE bill_id = $3
          RETURNING *
        `, [targetDoctorId, apptId, existingBill.bill_id]);

        transferredBill = updatedBillRes.rows[0];
      }
    }

    // Update appointment record
    const updatedApptRes = await client.query(`
      UPDATE appointments
      SET doctor_id = $1,
          appointment_date = $2,
          appointment_time = $3,
          updated_at = now()
      WHERE appointment_id = $4
      RETURNING *
    `, [targetDoctorId, appointment_date, appointment_time, apptId]);

    const updatedAppt = updatedApptRes.rows[0];

    // Audit Log
    const actionName = doctorChanged ? 'Reassign Doctor' : 'Reschedule Appointment';
    await client.query(`
      INSERT INTO audit_logs (
        user_id, role, action, module, record_id, old_value, new_value, remarks, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      req.user.user_id,
      req.user.role,
      actionName,
      'Appointments',
      String(apptId),
      JSON.stringify({ doctor_id: appt.doctor_id, appointment_date: appt.appointment_date, appointment_time: appt.appointment_time }),
      JSON.stringify({ doctor_id: targetDoctorId, appointment_date, appointment_time, bill_transferred: !!transferredBill, bill_id: transferredBill ? transferredBill.bill_id : null }),
      reason || (doctorChanged ? `Doctor reassigned from ${appt.doctor_id} to ${targetDoctorId}` : 'Appointment rescheduled'),
      userBranchId
    ]);

    await client.query('COMMIT');

    const message = doctorChanged
      ? (transferredBill
          ? 'Doctor reassigned successfully. Consultation fee attribution transferred to new doctor.'
          : 'Doctor reassigned successfully.')
      : 'Appointment rescheduled successfully';

    return res.json(formatResponse(true, {
      appointment: updatedAppt,
      bill_transferred: !!transferredBill,
      bill_id: transferredBill ? transferredBill.bill_id : null,
      old_doctor_id: appt.doctor_id,
      new_doctor_id: targetDoctorId
    }, message));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('reassignOrRescheduleAppointment error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while updating appointment'));
  } finally {
    client.release();
  }
}

async function rescheduleAppointment(req, res) {
  return reassignOrRescheduleAppointment(req, res, false);
}

async function reassignDoctor(req, res) {
  return reassignOrRescheduleAppointment(req, res, true);
}

async function getDoctorAvailableSlots(req, res) {
  try {
    const doctorId = parseInt(req.params.id || req.query.doctor_id);
    const dateStr = req.query.date;
    const excludeApptId = req.query.exclude_appointment_id ? parseInt(req.query.exclude_appointment_id) : null;

    if (!doctorId || isNaN(doctorId)) {
      return res.status(400).json(formatResponse(false, null, 'Valid doctor_id is required'));
    }
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json(formatResponse(false, null, 'Valid date (YYYY-MM-DD) is required'));
    }

    const result = await generateDoctorSlots(db, doctorId, dateStr, excludeApptId);
    return res.json(formatResponse(true, result, 'Doctor slots retrieved successfully'));
  } catch (err) {
    console.error('getDoctorAvailableSlots error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while fetching doctor slots'));
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
    let defaultDocFee = parseFloat(appt.new_consultation_fee || 500);
    if (apptType === 'renewal') defaultDocFee = parseFloat(appt.renewal_consultation_fee || 300);
    if (apptType === 'followup') defaultDocFee = parseFloat(appt.followup_consultation_fee || 200);

    const rawFee = req.body.consultation_fee !== undefined ? req.body.consultation_fee : req.body.fee;
    let baseFee = defaultDocFee;
    if (rawFee !== undefined && rawFee !== null && rawFee !== '') {
      const parsedFee = parseFloat(rawFee);
      if (isNaN(parsedFee) || parsedFee < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, null, 'Consultation fee must be a valid non-negative number'));
      }
      baseFee = parsedFee;
    }

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
        amount, discount_amount, final_amount, status, appointment_id
      ) VALUES ($1, $2, $3, 'consultation', $4, $5, $6, $7, $8, 'created', $9)
      RETURNING *
    `, [billNum, parseInt(patient_id), appt.doctor_id, req.user.user_id, branchId, baseFee, discount, finalFee, parseInt(appointment_id)]);

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
    const { patient_id } = req.query;

    let query = `
      SELECT b.*, p.full_name as patient_name, p.mobile_number, u.full_name as doctor_name
      FROM bills b
      JOIN patients p ON b.patient_id = p.patient_id
      LEFT JOIN doctors d ON b.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      WHERE b.branch_id = $1 AND b.bill_type = 'consultation'
    `;
    const params = [branchId];

    if (patient_id) {
      params.push(parseInt(patient_id));
      query += ` AND b.patient_id = $${params.length}`;
    }

    query += ` ORDER BY b.bill_id DESC`;

    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Consultation bills retrieved successfully'));
  } catch (err) {
    console.error('getConsultationBills error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getPatientInvoices(req, res) {
  try {
    const patientId = parseInt(req.params.id);
    if (!patientId || isNaN(patientId)) {
      return res.status(400).json(formatResponse(false, null, 'Valid patient_id is required'));
    }

    // Fetch patient info
    const ptRes = await db.query(`
      SELECT p.*,
             COALESCE(p.village, p.mandal, 'Hyderabad') as location
      FROM patients p
      WHERE p.patient_id = $1
    `, [patientId]);

    if (ptRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Patient not found'));
    }
    const patient = ptRes.rows[0];

    // Fetch referral metadata if patient was onboarded via referral
    const refRes = await db.query(`
      SELECT r.id as referral_id,
             r.referral_code,
             r.referral_type,
             r.referring_employee_id,
             r.referring_patient_id,
             r.department as referral_department,
             r.remarks as referral_remarks,
             u.full_name as referring_employee_name,
             u.employee_id as referring_employee_code,
             u.department as referring_employee_dept,
             u.role as referring_employee_role,
             rp.full_name as referring_patient_name,
             rp.registration_id as referring_patient_registration_id,
             rp.mobile_number as referring_patient_mobile
      FROM referrals r
      LEFT JOIN users u ON (r.referring_employee_id = u.user_id OR (r.referral_type = 'employee' AND r.referred_by = u.user_id))
      LEFT JOIN patients rp ON (r.referring_patient_id = rp.patient_id OR (r.referral_type = 'patient' AND r.referred_by = rp.patient_id))
      WHERE r.patient_id = $1
      ORDER BY r.id DESC
      LIMIT 1
    `, [patientId]);

    let referral = null;
    if (refRes.rows.length > 0) {
      const r = refRes.rows[0];
      if (r.referral_type === 'employee') {
        referral = {
          is_referral: true,
          referral_type: 'employee',
          referral_type_label: 'Employee Referral',
          referrer_name: r.referring_employee_name || 'Hospital Staff',
          referrer_id: r.referring_employee_code || (r.referring_employee_id ? `EMP${r.referring_employee_id}` : 'Staff'),
          department: r.referring_employee_dept || r.referral_department || 'Hospital Staff',
          referral_code: r.referral_code,
          remarks: r.referral_remarks
        };
      } else if (r.referral_type === 'patient') {
        referral = {
          is_referral: true,
          referral_type: 'patient',
          referral_type_label: 'Patient Referral',
          referrer_name: r.referring_patient_name || 'Registered Patient',
          referrer_id: r.referring_patient_registration_id || (r.referring_patient_id ? `REG-${r.referring_patient_id}` : 'Patient'),
          referral_code: r.referral_code,
          remarks: r.referral_remarks
        };
      }
    }

    patient.referral = referral;

    // Fetch all bills for patient
    const billsRes = await db.query(`
      SELECT b.*,
             COALESCE(u.full_name, 'Doctor') as doctor_name,
             d.specialization,
             d.qualification,
             COALESCE(rec.full_name, rec.username, 'Reception Desk') as cashier_name,
             rec.employee_id as cashier_employee_id,
             COALESCE(
               (SELECT py.payment_method FROM payments py WHERE py.bill_id = b.bill_id ORDER BY py.payment_id DESC LIMIT 1),
               'cash'
             ) as payment_method,
             COALESCE(
               (SELECT SUM(py.amount) FROM payments py WHERE py.bill_id = b.bill_id AND py.status = 'success'),
               b.final_amount
             ) as paid_amount,
             COALESCE(
               (SELECT dp.due_amount FROM due_patients dp WHERE dp.bill_id = b.bill_id AND dp.status = 'pending' LIMIT 1),
               0
             ) as due_amount,
             a.appointment_date,
             a.appointment_time,
             a.appointment_type
      FROM bills b
      LEFT JOIN doctors d ON b.doctor_id = d.doctor_id
      LEFT JOIN users u ON d.user_id = u.user_id
      LEFT JOIN users rec ON b.created_by = rec.user_id
      LEFT JOIN appointments a ON a.patient_id = b.patient_id AND a.doctor_id = b.doctor_id
      WHERE b.patient_id = $1
      ORDER BY b.bill_id DESC
    `, [patientId]);

    let invoices = billsRes.rows;
    if (invoices.length === 0) {
      const apptRes = await db.query(`
        SELECT a.*, u.full_name as doctor_name, d.specialization, d.new_consultation_fee, d.renewal_consultation_fee
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.doctor_id
        JOIN users u ON d.user_id = u.user_id
        WHERE a.patient_id = $1
        ORDER BY a.appointment_id DESC LIMIT 1
      `, [patientId]);

      if (apptRes.rows.length > 0) {
        const appt = apptRes.rows[0];
        const fee = parseFloat(appt.new_consultation_fee || 500);
        invoices = [{
          bill_id: 0,
          bill_number: `INV-${String(patient.patient_id).padStart(5, '0')}`,
          patient_id: patient.patient_id,
          doctor_id: appt.doctor_id,
          bill_type: 'consultation',
          amount: fee,
          discount_amount: 0,
          final_amount: fee,
          status: 'created',
          created_at: appt.created_at || new Date(),
          doctor_name: appt.doctor_name,
          specialization: appt.specialization,
          cashier_name: req.user.full_name || req.user.username,
          cashier_employee_id: req.user.employee_id || 'REC_OPD',
          payment_method: 'cash',
          paid_amount: fee,
          due_amount: 0,
          appointment_date: appt.appointment_date,
          appointment_time: appt.appointment_time,
          appointment_type: appt.appointment_type || 'new'
        }];
      }
    }

    return res.json(formatResponse(true, {
      patient,
      referral,
      invoices,
      latest_invoice: invoices[0] || null
    }, 'Patient invoices retrieved successfully'));

  } catch (err) {
    console.error('getPatientInvoices error:', err);
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
    const {
      patient_id,
      doctor_id: bodyDoctorId,
      assigned_doctor_id,
      appointment_date,
      appointment_time,
      discount_amount,
      payment_method,
      payment_amount,
      remarks,
      validity_days
    } = req.body;

    const doctor_id = bodyDoctorId || assigned_doctor_id;

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'patient_id, doctor_id, appointment_date, and appointment_time are required'));
    }

    const branchId = req.user.branch_id || 1;

    // 1. Verify Patient exists and belongs to this branch
    const ptRes = await client.query(`
      SELECT patient_id, registration_expiry, registration_date, full_name, mobile_number, patient_type, branch_id
      FROM patients WHERE patient_id = $1 AND branch_id = $2
    `, [parseInt(patient_id), branchId]);

    if (ptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Patient not found in this clinic branch'));
    }
    const patientRecord = ptRes.rows[0];

    // 2. Verify Doctor is active and belongs to this branch
    const docRes = await client.query(`
      SELECT d.doctor_id, d.renewal_consultation_fee, d.status, u.full_name as doctor_name
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.doctor_id = $1 AND d.branch_id = $2 AND d.status = 'active' AND u.status = 'active'
    `, [parseInt(doctor_id), branchId]);

    if (docRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Selected doctor is inactive, resigned, or not available in this branch'));
    }
    const doctor = docRes.rows[0];

    // 3. Verify Appointment Date is not in the past
    const todayStr = new Date().toISOString().split('T')[0];
    if (appointment_date < todayStr) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Appointment date cannot be in the past'));
    }

    // 4. Financial & Discount Validation
    const baseFee = parseFloat(doctor.renewal_consultation_fee || 300);
    const discount = discount_amount ? parseFloat(discount_amount) : 0;
    if (isNaN(discount) || discount < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Discount amount cannot be negative'));
    }
    if (discount > baseFee) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Discount cannot exceed the renewal consultation fee of ₹${baseFee}`));
    }

    const finalFee = Math.max(0, baseFee - discount);
    const paidAmt = payment_amount !== undefined && payment_amount !== '' ? parseFloat(payment_amount) : finalFee;
    if (isNaN(paidAmt) || paidAmt < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Payment amount cannot be negative'));
    }
    if (paidAmt > finalFee) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Payment amount cannot exceed final payable amount of ₹${finalFee}`));
    }
    const dueAmt = Math.max(0, finalFee - paidAmt);

    const validPaymentMethods = ['cash', 'card', 'upi', 'razorpay', 'bajaj_pay'];
    const pMethod = payment_method || 'cash';
    if (!validPaymentMethods.includes(pMethod)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Invalid payment method. Allowed: ${validPaymentMethods.join(', ')}`));
    }

    // 5. Update Patient Registration Validity (Extends from current expiry if active, or from today if expired)
    const daysToAdd = validity_days ? parseInt(validity_days) : 30;
    let baseExpiryDate = (patientRecord.registration_expiry && new Date(patientRecord.registration_expiry) > new Date())
      ? new Date(patientRecord.registration_expiry)
      : new Date();
    const newExpiry = new Date(baseExpiryDate);
    newExpiry.setDate(newExpiry.getDate() + daysToAdd);

    await client.query(`
      UPDATE patients
      SET registration_expiry = $1, patient_type = 'existing', updated_at = now()
      WHERE patient_id = $2
    `, [newExpiry, parseInt(patient_id)]);

    // 6. Write Renewal Record
    const renRes = await client.query(`
      INSERT INTO renewals (patient_id, doctor_id, renewal_date, amount, status)
      VALUES ($1, $2, $3, $4, 'completed') RETURNING *
    `, [parseInt(patient_id), parseInt(doctor_id), appointment_date, finalFee]);

    // 7. Check Doctor Slot Availability (Prevent Double Booking)
    const slotCheck = await client.query(`
      SELECT appointment_id FROM appointments
      WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time::time = $3::time AND status NOT IN ('cancelled')
    `, [parseInt(doctor_id), appointment_date, appointment_time]);

    if (slotCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Selected doctor is already booked at ${appointment_time} on ${appointment_date}. Double booking is not allowed. Please choose another time slot.`));
    }

    // 8. Create Renewal Appointment
    const apptStatus = appointment_date === todayStr ? 'checked_in' : 'scheduled';
    const apptRes = await client.query(`
      INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, created_by, branch_id)
      VALUES ($1, $2, $3, $4, 'renewal', $5, $6, $7) RETURNING *
    `, [parseInt(patient_id), parseInt(doctor_id), appointment_date, appointment_time, apptStatus, req.user.user_id, branchId]);

    // 9. Create Bill
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

    // 10. Record Payment
    if (paidAmt > 0) {
      await client.query(`
        INSERT INTO payments (bill_id, patient_id, payment_method, amount, status, received_by, branch_id)
        VALUES ($1, $2, $3, $4, 'success', $5, $6)
      `, [newBill.bill_id, parseInt(patient_id), pMethod, paidAmt, req.user.user_id, branchId]);
    }

    // 11. Record Due if partial payment
    if (dueAmt > 0) {
      await client.query(`
        INSERT INTO due_patients (patient_id, bill_id, due_amount, status, branch_id)
        VALUES ($1, $2, $3, 'pending', $4)
      `, [parseInt(patient_id), newBill.bill_id, dueAmt, branchId]);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Renewals',
      action: 'Renew Patient Registration',
      recordId: renRes.rows[0].id,
      newValue: {
        renewal_id: renRes.rows[0].id,
        patient_id: parseInt(patient_id),
        doctor_id: parseInt(doctor_id),
        amount: finalFee,
        new_expiry: newExpiry.toISOString().split('T')[0]
      }
    };

    return res.status(201).json(formatResponse(true, {
      renewal: renRes.rows[0],
      appointment: apptRes.rows[0],
      bill: newBill,
      new_expiry_date: newExpiry.toISOString().split('T')[0]
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

async function getConsultationFee(req, res) {
  try {
    const { doctor_id, appointment_type } = req.query;
    if (!doctor_id) {
      return res.status(400).json(formatResponse(false, null, 'doctor_id is required'));
    }
    const docRes = await db.query('SELECT new_consultation_fee, renewal_consultation_fee, followup_consultation_fee FROM doctors WHERE doctor_id = $1', [doctor_id]);
    if (docRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Doctor not found'));
    }
    const doctor = docRes.rows[0];
    const apptType = (appointment_type || 'new').toLowerCase();
    let fee = parseFloat(doctor.new_consultation_fee || 500);
    if (apptType === 'renewal') fee = parseFloat(doctor.renewal_consultation_fee || 300);
    if (apptType === 'followup') fee = parseFloat(doctor.followup_consultation_fee || 200);

    return res.json(formatResponse(true, { consultation_fee: fee, appointment_type: apptType }, 'Consultation fee retrieved successfully'));
  } catch (err) {
    console.error('getConsultationFee error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

module.exports = {
  getDashboard,
  searchPatients,
  getPatientOverview,
  registerPatient,
  getConsultationFee,
  createEnquiry,
  getEnquiries,
  createEmployeeReferral,
  createPatientReferral,
  getPatientReferrals,
  getEmployeeReferrals,
  getEligibleEmployees,
  getExecutiveLeads,
  openExecutiveLead,
  assignExecutiveLeadDoctor,
  getActiveDoctors,
  createAppointment,
  getAppointments,
  rescheduleAppointment,
  reassignDoctor,
  getDoctorAvailableSlots,
  cancelAppointment,
  updatePatient,
  createConsultationBill,
  getConsultationBills,
  getPatientInvoices,
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
