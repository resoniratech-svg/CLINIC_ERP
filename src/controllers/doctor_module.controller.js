const db = require('../db');
const { formatResponse } = require('../utils/helpers');

// Helper to resolve doctor_id for current user
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
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    if (!docId && req.user.role !== 'super_admin') {
      return res.status(403).json(formatResponse(false, null, 'Doctor profile not found for this user account'));
    }

    const doctorFilterId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);
    const today = new Date().toISOString().split('T')[0];

    // Appointments Counts today
    const apptsRes = await db.query(`
      SELECT 
        COUNT(*) as today_appts,
        COUNT(CASE WHEN status IN ('waiting', 'checked_in') THEN 1 END) as waiting,
        COUNT(CASE WHEN status = 'in_consultation' THEN 1 END) as in_consultation,
        COUNT(CASE WHEN status IN ('doctor_completed', 'completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed') THEN 1 END) as completed_today
      FROM appointments
      WHERE ($1::integer IS NULL OR doctor_id = $1) AND appointment_date = $2
    `, [doctorFilterId, today]);

    // Recommended Follow-ups Count today
    const followupsRes = await db.query(`
      SELECT COUNT(*) as recommended_followups
      FROM consultations
      WHERE ($1::integer IS NULL OR doctor_id = $1) AND followup_recommended = true AND DATE(created_at) = $2
    `, [doctorFilterId, today]);

    // Read-only My Follow-up View (recent recommendations history)
    const followupHistoryRes = await db.query(`
      SELECT c.consultation_id, c.appointment_id, c.patient_id, p.full_name as patient_name,
             c.followup_recommended_date, c.followup_instructions, c.created_at, a.status as appointment_status
      FROM consultations c
      JOIN patients p ON c.patient_id = p.patient_id
      JOIN appointments a ON c.appointment_id = a.appointment_id
      WHERE ($1::integer IS NULL OR c.doctor_id = $1) AND c.followup_recommended = true
      ORDER BY c.created_at DESC LIMIT 10
    `, [doctorFilterId]);

    // Target Summary for current month
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    const targetRes = await db.query(`
      SELECT revenue_target, unit_target, referral_target
      FROM doctor_targets
      WHERE ($1::integer IS NULL OR doctor_id = $1) AND month = $2 AND year = $3
    `, [doctorFilterId, curMonth, curYear]);

    // Target achievement calculations
    let revTarget = 200000;
    let unitTarget = 300000;
    let refTarget = 30;

    if (targetRes.rows.length > 0) {
      revTarget = parseFloat(targetRes.rows[0].revenue_target || 200000);
      unitTarget = parseFloat(targetRes.rows[0].unit_target || 300000);
      refTarget = parseInt(targetRes.rows[0].referral_target || 30);
    }

    // Revenue achieved (consultation bills completed for doctor)
    const revAchievedRes = await db.query(`
      SELECT COALESCE(SUM(b.final_amount), 0) as total_revenue, COUNT(*) as completed_units
      FROM bills b
      WHERE ($1::integer IS NULL OR b.doctor_id = $1)
        AND EXTRACT(MONTH FROM b.created_at) = $2 AND EXTRACT(YEAR FROM b.created_at) = $3
    `, [doctorFilterId, curMonth, curYear]);

    const revAchieved = parseFloat(revAchievedRes.rows[0].total_revenue || 0);
    const unitAchieved = parseInt(revAchievedRes.rows[0].completed_units || 0) * 500; // estimated unit revenue
    const refAchievedRes = await db.query(`
      SELECT COUNT(*) as referrals FROM appointments
      WHERE ($1::integer IS NULL OR doctor_id = $1) AND appointment_type = 'new'
        AND EXTRACT(MONTH FROM appointment_date) = $2 AND EXTRACT(YEAR FROM appointment_date) = $3
    `, [doctorFilterId, curMonth, curYear]);
    const refAchieved = parseInt(refAchievedRes.rows[0].referrals || 0);

    const stats = apptsRes.rows[0];
    const dashboardData = {
      today_appts: parseInt(stats.today_appts || 0),
      waiting: parseInt(stats.waiting || 0),
      in_consultation: parseInt(stats.in_consultation || 0),
      completed_today: parseInt(stats.completed_today || 0),
      recommended_followups: parseInt(followupsRes.rows[0].recommended_followups || 0),
      my_followup_view: followupHistoryRes.rows,
      target_summary: {
        month: curMonth,
        year: curYear,
        revenue_target: {
          target: revTarget,
          achieved: revAchieved,
          remaining: Math.max(0, revTarget - revAchieved),
          achievement_pct: revTarget > 0 ? Math.min(100, parseFloat(((revAchieved / revTarget) * 100).toFixed(1))) : 0
        },
        unit_target: {
          target: unitTarget,
          achieved: unitAchieved,
          remaining: Math.max(0, unitTarget - unitAchieved),
          achievement_pct: unitTarget > 0 ? Math.min(100, parseFloat(((unitAchieved / unitTarget) * 100).toFixed(1))) : 0
        },
        referral_target: {
          target: refTarget,
          achieved: refAchieved,
          remaining: Math.max(0, refTarget - refAchieved),
          achievement_pct: refTarget > 0 ? Math.min(100, parseFloat(((refAchieved / refTarget) * 100).toFixed(1))) : 0
        }
      }
    };

    return res.json(formatResponse(true, dashboardData, 'Doctor dashboard retrieved successfully'));
  } catch (err) {
    console.error('getDoctorDashboard error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 2. Today's Appointments
async function getTodayAppointments(req, res) {
  try {
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const doctorFilterId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);

    const { type, status, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let query = `
      SELECT a.appointment_id, a.appointment_id as token_number, a.patient_id,
             p.registration_id, p.full_name as patient_name, p.age, p.gender,
             a.appointment_time, a.appointment_type, a.status, a.created_at as checkin_time
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      WHERE ($1::integer IS NULL OR a.doctor_id = $1) AND a.appointment_date = $2
    `;
    const params = [doctorFilterId, targetDate];

    if (type) {
      params.push(type);
      query += ` AND a.appointment_type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    query += ` ORDER BY a.appointment_id ASC, a.appointment_time ASC`;
    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows, 'Doctor appointments retrieved successfully'));
  } catch (err) {
    console.error('getTodayAppointments error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 3. Patient Queue
async function getPatientQueue(req, res) {
  try {
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const doctorFilterId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);
    const today = new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT a.appointment_id, a.appointment_id as token_number, a.patient_id,
             p.registration_id, p.full_name as patient_name, p.age, p.gender,
             a.appointment_time, a.appointment_type, a.doctor_id,
             EXTRACT(EPOCH FROM (now() - a.updated_at))/60 as waiting_time_minutes,
             a.status
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      WHERE ($1::integer IS NULL OR a.doctor_id = $1)
        AND a.appointment_date = $2
        AND a.status IN ('waiting', 'checked_in', 'in_consultation')
      ORDER BY CASE WHEN a.status = 'in_consultation' THEN 1 ELSE 2 END, a.appointment_id ASC
    `, [doctorFilterId, today]);

    const formattedQueue = result.rows.map(r => ({
      ...r,
      waiting_time_minutes: Math.max(0, Math.floor(r.waiting_time_minutes || 0))
    }));

    return res.json(formatResponse(true, formattedQueue, 'Doctor patient queue retrieved successfully'));
  } catch (err) {
    console.error('getPatientQueue error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 4. Patients Search & Overview
async function getPatients(req, res) {
  try {
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const doctorFilterId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);

    const { search, date } = req.query;

    let query = `
      SELECT DISTINCT p.patient_id, p.registration_id, p.full_name as patient_name,
             p.mobile_number, p.age, p.gender, p.village, p.mandal,
             MAX(a.appointment_date) as last_visit_date, MAX(a.status) as last_status
      FROM patients p
      JOIN appointments a ON p.patient_id = a.patient_id
      WHERE ($1::integer IS NULL OR a.doctor_id = $1)
    `;
    const params = [doctorFilterId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.full_name ILIKE $${params.length} OR p.mobile_number ILIKE $${params.length} OR p.registration_id ILIKE $${params.length})`;
    }
    if (date) {
      params.push(date);
      query += ` AND a.appointment_date = $${params.length}`;
    }

    query += ` GROUP BY p.patient_id, p.registration_id, p.full_name, p.mobile_number, p.age, p.gender, p.village, p.mandal ORDER BY last_visit_date DESC LIMIT 50`;
    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows, 'Patients list retrieved successfully'));
  } catch (err) {
    console.error('getPatients error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getPatientOverview(req, res) {
  try {
    const patientId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    // Patient basic details
    const patRes = await db.query(`SELECT * FROM patients WHERE patient_id = $1`, [patientId]);
    if (patRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Patient not found'));
    }

    const patient = patRes.rows[0];

    // Previous Consultations History
    const consultsRes = await db.query(`
      SELECT c.*, md.name as primary_diagnosis_name, u.full_name as doctor_name
      FROM consultations c
      LEFT JOIN master_diagnoses md ON c.primary_diagnosis_id = md.id
      JOIN doctors d ON c.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE c.patient_id = $1 AND c.status = 'completed'
      ORDER BY c.created_at DESC LIMIT 10
    `, [patientId]);

    // Previous Prescriptions
    const prescRes = await db.query(`
      SELECT pr.id as prescription_id, pr.created_at, u.full_name as doctor_name,
             json_agg(json_build_object(
               'medicine_name', mm.medicine_name,
               'dosage', pi.dosage,
               'quantity', pi.quantity
             )) as medicines
      FROM prescriptions pr
      JOIN doctors d ON pr.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      JOIN prescription_items pi ON pr.id = pi.prescription_id
      JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE pr.patient_id = $1
      GROUP BY pr.id, pr.created_at, u.full_name
      ORDER BY pr.created_at DESC LIMIT 10
    `, [patientId]);

    // Previous Treatment Plans
    const treatRes = await db.query(`
      SELECT * FROM treatment_plans WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10
    `, [patientId]);

    // Mask doctor_notes if non-doctor/non-admin user calls overview
    const sanitizedConsultations = consultsRes.rows.map(c => {
      if (req.user.role !== 'doctor' && req.user.role !== 'super_admin') {
        delete c.doctor_notes;
      }
      return c;
    });

    return res.json(formatResponse(true, {
      patient,
      previous_consultations: sanitizedConsultations,
      previous_prescriptions: prescRes.rows,
      previous_treatments: treatRes.rows
    }, 'Patient overview retrieved successfully'));

  } catch (err) {
    console.error('getPatientOverview error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 5. Start Consultation
async function startConsultation(req, res) {
  try {
    const { appointment_id } = req.body;
    if (!appointment_id) {
      return res.status(400).json(formatResponse(false, null, 'appointment_id is required'));
    }

    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    // Validate appointment exists and belongs to doctor
    const apptRes = await db.query(`
      SELECT * FROM appointments WHERE appointment_id = $1
    `, [parseInt(appointment_id)]);

    if (apptRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Appointment not found'));
    }

    const appt = apptRes.rows[0];

    if (docId && appt.doctor_id !== docId && req.user.role !== 'super_admin') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Appointment is assigned to another doctor'));
    }

    if (appt.status !== 'waiting' && appt.status !== 'checked_in' && appt.status !== 'scheduled') {
      return res.status(400).json(formatResponse(false, null, 'Cannot start consultation for completed/cancelled appointment'));
    }

    const existingConsult = await db.query(`
      SELECT * FROM consultations WHERE appointment_id = $1
    `, [appt.appointment_id]);
    if (existingConsult.rows.length > 0) {
      return res.json(formatResponse(true, existingConsult.rows[0], 'Consultation already started. Active draft loaded.'));
    }

    // Insert new consultation row
    const consultRes = await db.query(`
      INSERT INTO consultations (
        appointment_id, patient_id, doctor_id, status, start_time, branch_id
      ) VALUES ($1, $2, $3, 'draft', now(), $4)
      RETURNING *
    `, [appt.appointment_id, appt.patient_id, appt.doctor_id, appt.branch_id || 1]);

    // Transition appointment status to in_consultation
    await db.query(`
      UPDATE appointments SET status = 'in_consultation', updated_at = now()
      WHERE appointment_id = $1
    `, [appt.appointment_id]);

    res.locals.auditEntry = { module: 'Doctor Consultation', action: 'Start Consultation', recordId: consultRes.rows[0].consultation_id, newValue: consultRes.rows[0] };
    return res.status(201).json(formatResponse(true, consultRes.rows[0], 'Consultation started successfully'));

  } catch (err) {
    console.error('startConsultation error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 6. Update Clinical Consultation Data
async function updateConsultation(req, res) {
  try {
    const consultId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    const checkRes = await db.query(`SELECT * FROM consultations WHERE consultation_id = $1`, [consultId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Consultation not found'));
    }

    const consult = checkRes.rows[0];
    if (docId && consult.doctor_id !== docId && req.user.role !== 'super_admin') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Cannot edit another doctor consultation'));
    }

    if (consult.status === 'completed') {
      return res.status(422).json(formatResponse(false, null, 'Unprocessable Entity: Completed consultations are immutable and cannot be updated'));
    }

    const {
      present_illness, previous_medical_history, previous_treatment_history, surgical_history, family_history, current_medications, other_history,
      allergy_status, allergies, height_cm, weight_kg, temperature, pulse_rate, bp_systolic, bp_diastolic, respiratory_rate, spo2, other_vitals,
      chief_complaint, complaint_duration, complaint_severity, complaint_onset, associated_symptoms,
      symptoms, symptom_progression, general_examination, physical_examination, system_examination, local_examination, other_findings,
      primary_diagnosis_id, primary_diagnosis_text, secondary_diagnosis_id, secondary_diagnosis_text, diagnosis_description, diagnosis_notes,
      investigations, followup_recommended, followup_recommended_date, followup_instructions,
      pro_required, pro_reason, pro_priority, pro_instructions, doctor_notes
    } = req.body;

    // Server-side BMI calculation
    let calculatedBmi = null;
    const h = height_cm !== undefined ? parseFloat(height_cm) : (consult.height_cm ? parseFloat(consult.height_cm) : null);
    const w = weight_kg !== undefined ? parseFloat(weight_kg) : (consult.weight_kg ? parseFloat(consult.weight_kg) : null);
    if (h && w && h > 0) {
      calculatedBmi = parseFloat((w / Math.pow(h / 100, 2)).toFixed(1));
    }

    const updateRes = await db.query(`
      UPDATE consultations SET
        present_illness = COALESCE($1, present_illness),
        previous_medical_history = COALESCE($2, previous_medical_history),
        previous_treatment_history = COALESCE($3, previous_treatment_history),
        surgical_history = COALESCE($4, surgical_history),
        family_history = COALESCE($5, family_history),
        current_medications = COALESCE($6, current_medications),
        other_history = COALESCE($7, other_history),
        allergy_status = COALESCE($8, allergy_status),
        allergies = COALESCE($9::jsonb, allergies),
        height_cm = COALESCE($10, height_cm),
        weight_kg = COALESCE($11, weight_kg),
        temperature = COALESCE($12, temperature),
        pulse_rate = COALESCE($13, pulse_rate),
        bp_systolic = COALESCE($14, bp_systolic),
        bp_diastolic = COALESCE($15, bp_diastolic),
        respiratory_rate = COALESCE($16, respiratory_rate),
        spo2 = COALESCE($17, spo2),
        bmi = COALESCE($18, bmi),
        other_vitals = COALESCE($19::jsonb, other_vitals),
        chief_complaint = COALESCE($20, chief_complaint),
        complaint_duration = COALESCE($21, complaint_duration),
        complaint_severity = COALESCE($22, complaint_severity),
        complaint_onset = COALESCE($23, complaint_onset),
        associated_symptoms = COALESCE($24::jsonb, associated_symptoms),
        symptoms = COALESCE($25, symptoms),
        symptom_progression = COALESCE($26, symptom_progression),
        general_examination = COALESCE($27, general_examination),
        physical_examination = COALESCE($28, physical_examination),
        system_examination = COALESCE($29, system_examination),
        local_examination = COALESCE($30, local_examination),
        other_findings = COALESCE($31, other_findings),
        primary_diagnosis_id = COALESCE($32, primary_diagnosis_id),
        primary_diagnosis_text = COALESCE($33, primary_diagnosis_text),
        secondary_diagnosis_id = COALESCE($34, secondary_diagnosis_id),
        secondary_diagnosis_text = COALESCE($35, secondary_diagnosis_text),
        diagnosis_description = COALESCE($36, diagnosis_description),
        diagnosis_notes = COALESCE($37, diagnosis_notes),
        investigations = COALESCE($38::jsonb, investigations),
        followup_recommended = COALESCE($39, followup_recommended),
        followup_recommended_date = COALESCE($40, followup_recommended_date),
        followup_instructions = COALESCE($41, followup_instructions),
        pro_required = COALESCE($42, pro_required),
        pro_reason = COALESCE($43, pro_reason),
        pro_priority = COALESCE($44, pro_priority),
        pro_instructions = COALESCE($45, pro_instructions),
        doctor_notes = COALESCE($46, doctor_notes),
        updated_at = now()
      WHERE consultation_id = $47
      RETURNING *
    `, [
      present_illness || null, previous_medical_history || null, previous_treatment_history || null, surgical_history || null, family_history || null, current_medications || null, other_history || null,
      allergy_status || null, allergies ? JSON.stringify(allergies) : null,
      height_cm || null, weight_kg || null, temperature || null, pulse_rate || null, bp_systolic || null, bp_diastolic || null, respiratory_rate || null, spo2 || null, calculatedBmi,
      other_vitals ? JSON.stringify(other_vitals) : null,
      chief_complaint || null, complaint_duration || null, complaint_severity || null, complaint_onset || null, associated_symptoms ? JSON.stringify(associated_symptoms) : null,
      symptoms || null, symptom_progression || null, general_examination || null, physical_examination || null, system_examination || null, local_examination || null, other_findings || null,
      primary_diagnosis_id || null, primary_diagnosis_text || null, secondary_diagnosis_id || null, secondary_diagnosis_text || null, diagnosis_description || null, diagnosis_notes || null,
      investigations ? JSON.stringify(investigations) : null,
      followup_recommended !== undefined ? followup_recommended : null, followup_recommended_date || null, followup_instructions || null,
      pro_required !== undefined ? pro_required : null, pro_reason || null, pro_priority || null, pro_instructions || null, doctor_notes || null,
      consultId
    ]);

    res.locals.auditEntry = { module: 'Doctor Consultation', action: 'Update Clinical Data', recordId: consultId, newValue: updateRes.rows[0] };
    return res.json(formatResponse(true, updateRes.rows[0], 'Consultation clinical data updated successfully'));

  } catch (err) {
    console.error('updateConsultation error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 7. Master Diagnoses Search
async function searchDiagnoses(req, res) {
  try {
    const { q } = req.query;
    const queryTerm = q ? `%${q}%` : '%';

    const result = await db.query(`
      SELECT id, name, category FROM master_diagnoses
      WHERE status = 'active' AND name ILIKE $1
      ORDER BY name ASC LIMIT 20
    `, [queryTerm]);

    return res.json(formatResponse(true, result.rows, 'Master diagnoses search retrieved successfully'));
  } catch (err) {
    console.error('searchDiagnoses error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 8. Prescription Management
async function createPrescription(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { consultation_id, medicines } = req.body;

    if (!consultation_id || !medicines || !Array.isArray(medicines) || medicines.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'consultation_id and non-empty medicines array are required'));
    }

    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    const consultRes = await client.query(`SELECT * FROM consultations WHERE consultation_id = $1`, [parseInt(consultation_id)]);
    if (consultRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Consultation not found'));
    }

    const consult = consultRes.rows[0];
    if (docId && consult.doctor_id !== docId && req.user.role !== 'super_admin') {
      await client.query('ROLLBACK');
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Cannot create prescription for another doctor consultation'));
    }

    if (consult.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(422).json(formatResponse(false, null, 'Unprocessable Entity: Cannot add prescription to completed consultation'));
    }

    // Insert prescription record
    const prescRes = await client.query(`
      INSERT INTO prescriptions (
        consultation_id, patient_id, doctor_id, appointment_id
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [consult.consultation_id, consult.patient_id, consult.doctor_id, consult.appointment_id]);

    const prescription = prescRes.rows[0];
    prescription.prescription_id = prescription.id;
    const insertedItems = [];

    for (const item of medicines) {
      const medId = item.medicine_id || item.id;
      const itemRes = await client.query(`
        INSERT INTO prescription_items (
          prescription_id, medicine_id, dosage, quantity
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        prescription.id, medId, item.dosage || '1 tab', item.quantity || 5
      ]);
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');

    res.locals.auditEntry = { module: 'Doctor Prescription', action: 'Create Prescription', recordId: prescription.id, newValue: prescription };
    return res.status(201).json(formatResponse(true, {
      prescription,
      items: insertedItems
    }, 'Prescription created successfully'));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createPrescription error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getMyPrescriptions(req, res) {
  try {
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const doctorFilterId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);

    const { patient_id, date } = req.query;

    let query = `
      SELECT pr.id as prescription_id, pr.created_at, pr.patient_id, pr.doctor_id, p.full_name as patient_name, p.registration_id,
             json_agg(json_build_object(
               'item_id', pi.id,
               'medicine_name', mm.medicine_name,
               'dosage', pi.dosage,
               'quantity', pi.quantity
             )) as medicines
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.patient_id
      JOIN prescription_items pi ON pr.id = pi.prescription_id
      JOIN medicine_master mm ON pi.medicine_id = mm.id
      WHERE ($1::integer IS NULL OR pr.doctor_id = $1)
    `;
    const params = [doctorFilterId];

    if (patient_id) {
      params.push(parseInt(patient_id));
      query += ` AND pr.patient_id = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND DATE(pr.created_at) = $${params.length}`;
    }

    query += ` GROUP BY pr.id, p.full_name, p.registration_id ORDER BY pr.id DESC LIMIT 50`;
    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows, 'Doctor prescriptions retrieved successfully'));
  } catch (err) {
    console.error('getMyPrescriptions error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 9. Treatment Plan Management
async function createTreatmentPlan(req, res) {
  try {
    const {
      consultation_id, treatment_name, treatment_type, start_date, duration, duration_unit, frequency, instructions, treatment_notes
    } = req.body;

    if (!consultation_id || !treatment_name || !treatment_type || !start_date || !duration || !duration_unit) {
      return res.status(400).json(formatResponse(false, null, 'consultation_id, treatment_name, treatment_type, start_date, duration, duration_unit are required'));
    }

    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    const consultRes = await db.query(`SELECT * FROM consultations WHERE consultation_id = $1`, [parseInt(consultation_id)]);
    if (consultRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Consultation not found'));
    }

    const consult = consultRes.rows[0];
    if (docId && consult.doctor_id !== docId && req.user.role !== 'super_admin') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Cannot create treatment plan for another doctor consultation'));
    }

    if (consult.status === 'completed') {
      return res.status(422).json(formatResponse(false, null, 'Unprocessable Entity: Cannot add treatment plan to completed consultation'));
    }

    // Server-side End Date Calculation
    const parts = start_date.toString().split('T')[0].split('-');
    const yr = parseInt(parts[0]);
    const mo = parseInt(parts[1]) - 1;
    const dy = parseInt(parts[2]);
    const endDateObj = new Date(yr, mo, dy);
    const durNum = parseInt(duration);
    const unitStr = duration_unit.toLowerCase();

    if (unitStr.startsWith('day')) {
      endDateObj.setDate(endDateObj.getDate() + durNum);
    } else if (unitStr.startsWith('week')) {
      endDateObj.setDate(endDateObj.getDate() + (durNum * 7));
    } else if (unitStr.startsWith('month')) {
      endDateObj.setMonth(endDateObj.getMonth() + durNum);
    } else {
      endDateObj.setDate(endDateObj.getDate() + durNum);
    }

    const yearStr = endDateObj.getFullYear();
    const monthStr = String(endDateObj.getMonth() + 1).padStart(2, '0');
    const dayStr = String(endDateObj.getDate()).padStart(2, '0');
    const calculatedEndDate = `${yearStr}-${monthStr}-${dayStr}`;

    const planRes = await db.query(`
      INSERT INTO treatment_plans (
        consultation_id, patient_id, doctor_id, treatment_name, treatment_type,
        start_date, duration, duration_unit, end_date, frequency, instructions, treatment_notes,
        status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13)
      RETURNING *
    `, [
      consult.consultation_id, consult.patient_id, consult.doctor_id, treatment_name, treatment_type,
      start_date, durNum, duration_unit, calculatedEndDate, frequency || null, instructions || null, treatment_notes || null,
      consult.branch_id || 1
    ]);

    const plan = planRes.rows[0];
    const formattedPlan = {
      ...plan,
      start_date: plan.start_date ? new Date(plan.start_date).toISOString().split('T')[0] : start_date,
      end_date: calculatedEndDate
    };

    res.locals.auditEntry = { module: 'Doctor Treatment', action: 'Create Treatment Plan', recordId: plan.treatment_id, newValue: formattedPlan };
    return res.status(201).json(formatResponse(true, formattedPlan, 'Treatment plan created successfully'));

  } catch (err) {
    console.error('createTreatmentPlan error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getMyTreatmentPlans(req, res) {
  try {
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const doctorFilterId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);

    const { status } = req.query;

    let query = `
      SELECT tp.*, p.full_name as patient_name, p.registration_id
      FROM treatment_plans tp
      JOIN patients p ON tp.patient_id = p.patient_id
      WHERE ($1::integer IS NULL OR tp.doctor_id = $1)
    `;
    const params = [doctorFilterId];

    if (status) {
      params.push(status);
      query += ` AND tp.status = $${params.length}`;
    }

    query += ` ORDER BY tp.treatment_id DESC LIMIT 50`;
    const result = await db.query(query, params);

    return res.json(formatResponse(true, result.rows, 'Doctor treatment plans retrieved successfully'));
  } catch (err) {
    console.error('getMyTreatmentPlans error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 10. Consultation Summary, Save Draft & Complete
async function getConsultationSummary(req, res) {
  try {
    const consultId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    const consultRes = await db.query(`
      SELECT c.*, p.full_name as patient_name, p.registration_id, md.name as primary_diagnosis_name
      FROM consultations c
      JOIN patients p ON c.patient_id = p.patient_id
      LEFT JOIN master_diagnoses md ON c.primary_diagnosis_id = md.id
      WHERE c.consultation_id = $1
    `, [consultId]);

    if (consultRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Consultation not found'));
    }

    const consult = consultRes.rows[0];

    const prescRes = await db.query(`
      SELECT pr.id as prescription_id, count(pi.id) as medicine_count
      FROM prescriptions pr
      JOIN prescription_items pi ON pr.id = pi.prescription_id
      WHERE pr.consultation_id = $1
      GROUP BY pr.id
    `, [consultId]);

    const treatRes = await db.query(`
      SELECT treatment_id, treatment_name, duration, duration_unit FROM treatment_plans WHERE consultation_id = $1
    `, [consultId]);

    return res.json(formatResponse(true, {
      summary: {
        consultation_id: consult.consultation_id,
        patient_name: consult.patient_name,
        registration_id: consult.registration_id,
        chief_complaint: consult.chief_complaint,
        diagnosis: consult.primary_diagnosis_name || consult.primary_diagnosis_text || 'Not Recorded',
        investigations_count: (consult.investigations || []).length,
        prescriptions_summary: prescRes.rows.length > 0 ? `${prescRes.rows[0].medicine_count} Medicines` : 'No Prescriptions',
        treatments: treatRes.rows,
        followup_recommended: consult.followup_recommended,
        followup_recommended_date: consult.followup_recommended_date,
        pro_required: consult.pro_required,
        status: consult.status
      }
    }, 'Consultation summary retrieved successfully'));
  } catch (err) {
    console.error('getConsultationSummary error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function saveDraft(req, res) {
  try {
    const consultId = parseInt(req.params.id || req.body.consultation_id);
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    const consultRes = await db.query(`SELECT * FROM consultations WHERE consultation_id = $1`, [consultId]);
    if (consultRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Consultation not found'));
    }

    const consult = consultRes.rows[0];
    if (consult.status === 'completed') {
      return res.status(400).json(formatResponse(false, null, 'Consultation is already completed and locked from editing'));
    }
    if (docId && consult.doctor_id !== docId && req.user.role !== 'super_admin') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Cannot save draft for another doctor consultation'));
    }

    // Persist draft status and ensure appointment stays in_consultation
    await db.query(`
      UPDATE consultations SET status = 'draft', updated_at = now() WHERE consultation_id = $1
    `, [consultId]);

    await db.query(`
      UPDATE appointments SET status = 'in_consultation', updated_at = now() WHERE appointment_id = $1
    `, [consult.appointment_id]);

    return res.json(formatResponse(true, { consultation_id: consultId, status: 'draft' }, 'Consultation draft saved successfully. Patient status remains in_consultation.'));
  } catch (err) {
    console.error('saveDraft error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function completeConsultation(req, res) {
  try {
    const consultId = parseInt(req.params.id || req.body.consultation_id);
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    const consultRes = await db.query(`SELECT * FROM consultations WHERE consultation_id = $1`, [consultId]);
    if (consultRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Consultation not found'));
    }

    const consult = consultRes.rows[0];
    if (docId && consult.doctor_id !== docId && req.user.role !== 'super_admin') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Cannot complete another doctor consultation'));
    }

    const { chief_complaint, primary_diagnosis_text, prescription_items } = req.body;
    if (chief_complaint || primary_diagnosis_text) {
      await db.query(`
        UPDATE consultations
        SET chief_complaint = COALESCE($1, chief_complaint),
            primary_diagnosis_text = COALESCE($2, primary_diagnosis_text),
            updated_at = now()
        WHERE consultation_id = $3
      `, [chief_complaint || null, primary_diagnosis_text || null, consultId]);

      if (chief_complaint) consult.chief_complaint = chief_complaint;
      if (primary_diagnosis_text) consult.primary_diagnosis_text = primary_diagnosis_text;
    }

    if (prescription_items && Array.isArray(prescription_items) && prescription_items.length > 0) {
      let rxRes = await db.query(`SELECT id FROM prescriptions WHERE consultation_id = $1`, [consultId]);
      let rxId;
      if (rxRes.rows.length === 0) {
        const newRx = await db.query(`
          INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, appointment_id, pharmacy_status)
          VALUES ($1, $2, $3, $4, 'pending') RETURNING id
        `, [consultId, consult.patient_id, consult.doctor_id, consult.appointment_id]);
        rxId = newRx.rows[0].id;
      } else {
        rxId = rxRes.rows[0].id;
      }

      for (const item of prescription_items) {
        const medId = parseInt(item.medicine_id || item.id || 1);
        const qty = parseInt(item.quantity || 1);
        const days = parseInt(item.duration_days || item.days || 1);
        await db.query(`
          INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [rxId, medId, item.dosage || '1 tab', item.frequency || '1/day', item.route || 'oral', days, qty]);
      }
    }

    // Business Rule: Require Chief Complaint and Primary Diagnosis for completion
    if (!consult.chief_complaint) {
      return res.status(422).json(formatResponse(false, null, 'Validation error: Chief complaint is required to complete consultation'));
    }
    if (!consult.primary_diagnosis_id && !consult.primary_diagnosis_text) {
      return res.status(422).json(formatResponse(false, null, 'Validation error: Primary diagnosis is required to complete consultation'));
    }

    // Transition consultation status to completed
    const updatedConsult = await db.query(`
      UPDATE consultations SET status = 'completed', end_time = now(), updated_at = now()
      WHERE consultation_id = $1
      RETURNING *
    `, [consultId]);

    // Transition appointment status to doctor_completed (which PRO queue picks up as pro_pending)
    await db.query(`
      UPDATE appointments SET status = 'doctor_completed', updated_at = now()
      WHERE appointment_id = $1
    `, [consult.appointment_id]);

    res.locals.auditEntry = { module: 'Doctor Consultation', action: 'Complete Consultation', recordId: consultId, newValue: updatedConsult.rows[0] };
    return res.json(formatResponse(true, {
      consultation: updatedConsult.rows[0],
      appointment_status: 'doctor_completed',
      handoff_target: 'PRO / Manager Queue'
    }, 'Consultation completed successfully. Patient transitioned to PRO Queue.'));

  } catch (err) {
    console.error('completeConsultation error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 11. Consultation History
async function getConsultationHistory(req, res) {
  try {
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const doctorFilterId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);

    const { patient_id, date, diagnosis, status } = req.query;

    let query = `
      SELECT c.*, p.full_name as patient_name, p.registration_id, md.name as primary_diagnosis_name
      FROM consultations c
      JOIN patients p ON c.patient_id = p.patient_id
      LEFT JOIN master_diagnoses md ON c.primary_diagnosis_id = md.id
      WHERE ($1::integer IS NULL OR c.doctor_id = $1)
    `;
    const params = [doctorFilterId];

    if (patient_id) {
      params.push(parseInt(patient_id));
      query += ` AND c.patient_id = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND DATE(c.created_at) = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }
    if (diagnosis) {
      params.push(`%${diagnosis}%`);
      query += ` AND (md.name ILIKE $${params.length} OR c.primary_diagnosis_text ILIKE $${params.length})`;
    }

    query += ` ORDER BY c.consultation_id DESC LIMIT 50`;
    const result = await db.query(query, params);

    // Sanitize doctor_notes for non-doctor roles
    const sanitizedRows = result.rows.map(r => {
      if (req.user.role !== 'doctor' && req.user.role !== 'super_admin') {
        delete r.doctor_notes;
      }
      return r;
    });

    return res.json(formatResponse(true, sanitizedRows, 'Consultation history retrieved successfully'));
  } catch (err) {
    console.error('getConsultationHistory error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getConsultationDetails(req, res) {
  try {
    const consultId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);

    const result = await db.query(`
      SELECT c.*, p.full_name as patient_name, p.registration_id, md.name as primary_diagnosis_name
      FROM consultations c
      JOIN patients p ON c.patient_id = p.patient_id
      LEFT JOIN master_diagnoses md ON c.primary_diagnosis_id = md.id
      WHERE c.consultation_id = $1
    `, [consultId]);

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Consultation not found'));
    }

    const consult = result.rows[0];

    // Scoping check for doctors
    if (docId && consult.doctor_id !== docId && req.user.role !== 'super_admin') {
      return res.status(403).json(formatResponse(false, null, 'Forbidden: Cannot access another doctor consultation'));
    }

    // Mask doctor_notes if non-doctor/non-admin
    if (req.user.role !== 'doctor' && req.user.role !== 'super_admin') {
      delete consult.doctor_notes;
    }

    return res.json(formatResponse(true, consult, 'Consultation details retrieved successfully'));
  } catch (err) {
    console.error('getConsultationDetails error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 12. My Targets (View-only for Doctors)
async function getMyTargets(req, res) {
  try {
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const doctorFilterId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);

    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const targetRes = await db.query(`
      SELECT * FROM doctor_targets
      WHERE ($1::integer IS NULL OR doctor_id = $1) AND month = $2 AND year = $3
    `, [doctorFilterId, targetMonth, targetYear]);

    let revTarget = 200000;
    let unitTarget = 300000;
    let refTarget = 30;

    if (targetRes.rows.length > 0) {
      revTarget = parseFloat(targetRes.rows[0].revenue_target || 200000);
      unitTarget = parseFloat(targetRes.rows[0].unit_target || 300000);
      refTarget = parseInt(targetRes.rows[0].referral_target || 30);
    }

    const revAchievedRes = await db.query(`
      SELECT COALESCE(SUM(p.amount), 0) as total_revenue, COUNT(DISTINCT b.bill_id) as completed_units
      FROM payments p
      JOIN bills b ON p.bill_id = b.bill_id
      WHERE ($1::integer IS NULL OR b.doctor_id = $1)
        AND b.status != 'refunded'
        AND EXTRACT(MONTH FROM p.payment_date) = $2 AND EXTRACT(YEAR FROM p.payment_date) = $3
    `, [doctorFilterId, targetMonth, targetYear]);

    const revAchieved = parseFloat(revAchievedRes.rows[0].total_revenue || 0);
    const unitAchieved = parseInt(revAchievedRes.rows[0].completed_units || 0) * 500;
    const refAchievedRes = await db.query(`
      SELECT COUNT(*) as referrals FROM appointments
      WHERE ($1::integer IS NULL OR doctor_id = $1) AND appointment_type = 'new'
        AND EXTRACT(MONTH FROM appointment_date) = $2 AND EXTRACT(YEAR FROM appointment_date) = $3
    `, [doctorFilterId, targetMonth, targetYear]);
    const refAchieved = parseInt(refAchievedRes.rows[0].referrals || 0);

    return res.json(formatResponse(true, {
      month: targetMonth,
      year: targetYear,
      revenue_target: {
        target: revTarget,
        achieved: revAchieved,
        remaining: Math.max(0, revTarget - revAchieved),
        achievement_pct: revTarget > 0 ? Math.min(100, parseFloat(((revAchieved / revTarget) * 100).toFixed(1))) : 0
      },
      unit_target: {
        target: unitTarget,
        achieved: unitAchieved,
        remaining: Math.max(0, unitTarget - unitAchieved),
        achievement_pct: unitTarget > 0 ? Math.min(100, parseFloat(((unitAchieved / unitTarget) * 100).toFixed(1))) : 0
      },
      referral_target: {
        target: refTarget,
        achieved: refAchieved,
        remaining: Math.max(0, refTarget - refAchieved),
        achievement_pct: refTarget > 0 ? Math.min(100, parseFloat(((refAchieved / refTarget) * 100).toFixed(1))) : 0
      }
    }, 'Doctor target performance retrieved successfully'));
  } catch (err) {
    console.error('getMyTargets error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// Reject write on doctor targets for Doctor role
async function blockTargetMutation(req, res) {
  return res.status(403).json(formatResponse(false, null, 'Forbidden: Targets are read-only for Doctor role. Only Super Admin can manage targets.'));
}

// 13. Doctor Profile & Schedule
async function getProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const docRes = await db.query(`
      SELECT u.user_id, u.employee_id, u.full_name, u.mobile_number, u.email, u.gender, u.date_of_joining, u.department,
             d.doctor_id, d.qualification, d.specialization, d.medical_registration_number,
             d.status as doctor_status, d.branch_id
      FROM users u
      LEFT JOIN doctors d ON u.user_id = d.user_id
      WHERE u.user_id = $1
    `, [userId]);

    if (docRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Doctor profile not found'));
    }

    return res.json(formatResponse(true, docRes.rows[0], 'Doctor profile retrieved successfully'));
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const { mobile_number, email } = req.body;

    // Doctor can only update personal contact fields. Professional fields are restricted to Super Admin.
    const result = await db.query(`
      UPDATE users SET
        mobile_number = COALESCE($1, mobile_number),
        email = COALESCE($2, email),
        updated_at = now()
      WHERE user_id = $3
      RETURNING user_id, full_name, mobile_number, email
    `, [mobile_number || null, email || null, userId]);

    res.locals.auditEntry = { module: 'Doctor Profile', action: 'Update Profile', recordId: userId, newValue: result.rows[0] };
    return res.json(formatResponse(true, result.rows[0], 'Doctor profile contact details updated successfully. Professional fields are Super-Admin-managed.'));
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getSchedule(req, res) {
  try {
    return res.json(formatResponse(true, {
      schedule: [
        { day: 'Monday', start_time: '09:00 AM', end_time: '01:00 PM', slot_duration: '15 mins' },
        { day: 'Monday', start_time: '05:00 PM', end_time: '08:00 PM', slot_duration: '15 mins' },
        { day: 'Tuesday', start_time: '09:00 AM', end_time: '01:00 PM', slot_duration: '15 mins' },
        { day: 'Wednesday', start_time: '09:00 AM', end_time: '01:00 PM', slot_duration: '15 mins' },
        { day: 'Thursday', start_time: '09:00 AM', end_time: '01:00 PM', slot_duration: '15 mins' },
        { day: 'Friday', start_time: '09:00 AM', end_time: '01:00 PM', slot_duration: '15 mins' },
        { day: 'Saturday', start_time: '09:00 AM', end_time: '01:00 PM', slot_duration: '15 mins' }
      ]
    }, 'Doctor schedule retrieved successfully'));
  } catch (err) {
    console.error('getSchedule error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

// 14. Doctor Leaves
async function applyLeave(req, res) {
  try {
    const { from_date, to_date, reason, remarks } = req.body;
    if (!from_date || !to_date || !reason) {
      return res.status(400).json(formatResponse(false, null, 'from_date, to_date, and reason are required'));
    }

    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const targetDoctorId = docId || (req.body.doctor_id ? parseInt(req.body.doctor_id) : 1);

    const leaveRes = await db.query(`
      INSERT INTO doctor_leaves (
        doctor_id, from_date, to_date, reason, remarks, status, branch_id
      ) VALUES ($1, $2, $3, $4, $5, 'pending'::reset_status, 1)
      RETURNING *
    `, [targetDoctorId, from_date, to_date, reason, remarks || null]);

    const leave = leaveRes.rows[0];
    const formattedLeave = {
      ...leave,
      from_date: leave.from_date ? new Date(leave.from_date).toISOString().split('T')[0] : from_date,
      to_date: leave.to_date ? new Date(leave.to_date).toISOString().split('T')[0] : to_date
    };

    res.locals.auditEntry = { module: 'Doctor Leaves', action: 'Apply Leave', recordId: leave.id, newValue: formattedLeave };
    return res.status(201).json(formatResponse(true, formattedLeave, 'Leave request submitted successfully. Awaiting Super Admin approval.'));
  } catch (err) {
    console.error('applyLeave error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getMyLeaves(req, res) {
  try {
    const userId = req.user.user_id;
    const docId = await resolveDoctorId(userId);
    const targetDoctorId = docId || (req.query.doctor_id ? parseInt(req.query.doctor_id) : null);

    const result = await db.query(`
      SELECT * FROM doctor_leaves WHERE ($1::integer IS NULL OR doctor_id = $1) ORDER BY id DESC
    `, [targetDoctorId]);

    const formattedLeaves = result.rows.map(r => ({
      ...r,
      from_date: r.from_date ? new Date(r.from_date).toISOString().split('T')[0] : r.from_date,
      to_date: r.to_date ? new Date(r.to_date).toISOString().split('T')[0] : r.to_date
    }));

    return res.json(formatResponse(true, formattedLeaves, 'Doctor leave requests retrieved successfully'));
  } catch (err) {
    console.error('getMyLeaves error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function doctorPrescriptionModificationDecision(req, res) {
  const client = await db.pool.connect();
  try {
    const modId = parseInt(req.params.id || req.body.clarification_id || req.body.modification_id);
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json(formatResponse(false, null, 'Decision must be approved or rejected'));
    }

    await client.query('BEGIN');
    const modRes = await client.query(`SELECT * FROM prescription_modifications WHERE id = $1`, [modId]);
    if (modRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription modification request not found'));
    }

    const mod = modRes.rows[0];
    const userId = req.user.user_id;

    if (decision === 'approved') {
      const field = mod.field_changed;
      const val = mod.modified_value;

      if (field === 'duration') {
        await client.query(`UPDATE prescription_items SET quantity = $1 WHERE id = $2`, [parseInt(val) || 5, mod.prescription_item_id]);
      } else if (field === 'quantity') {
        await client.query(`UPDATE prescription_items SET quantity = $1 WHERE id = $2`, [parseInt(val) || 5, mod.prescription_item_id]);
      } else if (field === 'dosage') {
        await client.query(`UPDATE prescription_items SET dosage = $1 WHERE id = $2`, [val, mod.prescription_item_id]);
      } else if (field === 'medicine') {
        await client.query(`UPDATE prescription_items SET medicine_id = $1 WHERE id = $2`, [parseInt(val) || 1, mod.prescription_item_id]);
      }
    }

    const updatedMod = await client.query(`
      UPDATE prescription_modifications
      SET status = $1, doctor_decision_by = $2, doctor_decision_at = now()
      WHERE id = $3
      RETURNING *
    `, [decision, userId, modId]);

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'Doctor Prescription', action: 'Prescription Modification Decision', recordId: modId, newValue: updatedMod.rows[0] };
    return res.json(formatResponse(true, updatedMod.rows[0], `Prescription modification ${decision} successfully`));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('doctorPrescriptionModificationDecision error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function respondToClarification(req, res) {
  const client = await db.pool.connect();
  try {
    const clarificationId = parseInt(req.params.id);
    const response = req.body.response || req.body.doctor_response;
    const { updates_to_prescription_item } = req.body;

    if (!response) {
      return res.status(400).json(formatResponse(false, null, 'response (or doctor_response) string is required'));
    }

    await client.query('BEGIN');

    const cRes = await client.query(`SELECT * FROM prescription_clarifications WHERE id = $1`, [clarificationId]);
    if (cRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Prescription clarification request not found'));
    }

    const clarification = cRes.rows[0];

    // Update clarification record
    const updatedRes = await client.query(`
      UPDATE prescription_clarifications
      SET doctor_response = $1, responded_by = $2, responded_at = now(), status = 'responded'
      WHERE id = $3 RETURNING *
    `, [response, req.user.user_id, clarificationId]);

    // Apply prescription item updates if provided
    if (clarification.prescription_item_id && updates_to_prescription_item) {
      const { dosage, quantity, instructions, frequency } = updates_to_prescription_item;
      await client.query(`
        UPDATE prescription_items
        SET dosage = COALESCE($1, dosage),
            quantity = COALESCE($2, quantity),
            frequency = COALESCE($3, frequency),
            special_instructions = COALESCE($4, special_instructions),
            dispense_status = 'pending'
        WHERE id = $5
      `, [dosage || null, quantity || null, frequency || null, instructions || null, clarification.prescription_item_id]);
    }

    await client.query('COMMIT');
    res.locals.auditEntry = { module: 'Doctor Clarification', action: 'Respond to Clarification', recordId: clarificationId, newValue: updatedRes.rows[0] };
    return res.json(formatResponse(true, updatedRes.rows[0], 'Doctor response submitted successfully'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('respondToClarification error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

module.exports = {
  getDashboard,
  getTodayAppointments,
  getPatientQueue,
  getPatients,
  getPatientOverview,
  startConsultation,
  updateConsultation,
  searchDiagnoses,
  createPrescription,
  getMyPrescriptions,
  createTreatmentPlan,
  getMyTreatmentPlans,
  getConsultationSummary,
  saveDraft,
  completeConsultation,
  getConsultationHistory,
  getConsultationDetails,
  getMyTargets,
  blockTargetMutation,
  getProfile,
  updateProfile,
  getSchedule,
  applyLeave,
  getMyLeaves,
  doctorPrescriptionModificationDecision,
  respondToClarification
};
