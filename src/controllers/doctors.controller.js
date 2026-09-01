const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getDoctors(req, res) {
  try {
    const { status, specialization } = req.query;
    let query = `
      SELECT d.*, u.full_name, u.mobile_number, u.email, u.employee_id, u.status as user_status
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.branch_id = $1
    `;
    const params = [req.user.branch_id || 1];

    if (status) {
      params.push(status);
      query += ` AND d.status = $${params.length}`;
    }

    if (specialization) {
      params.push(`%${specialization}%`);
      query += ` AND d.specialization ILIKE $${params.length}`;
    }

    query += ` ORDER BY d.doctor_id DESC`;
    const result = await db.query(query, params);
    return res.json(formatResponse(true, result.rows, 'Doctors retrieved successfully'));
  } catch (err) {
    console.error('getDoctors error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function getDoctorSummary(req, res) {
  try {
    const doctorId = parseInt(req.params.id);

    const docRes = await db.query(`SELECT d.*, u.full_name FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE d.doctor_id = $1`, [doctorId]);
    if (docRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Doctor not found'));
    }

    const doctor = docRes.rows[0];

    // Count upcoming appointments
    const apptRes = await db.query(`
      SELECT COUNT(*) FROM appointments
      WHERE doctor_id = $1 AND appointment_date >= CURRENT_DATE AND status = 'scheduled'
    `, [doctorId]);

    // Count active patients / treatments linked to this doctor
    const activeTreatmentsRes = await db.query(`
      SELECT COUNT(DISTINCT patient_id) FROM appointments
      WHERE doctor_id = $1 AND appointment_date >= CURRENT_DATE
    `, [doctorId]);

    // Count pending followups
    const followupsRes = await db.query(`
      SELECT COUNT(*) FROM renewals WHERE doctor_id = $1 AND status = 'pending'
    `, [doctorId]);

    return res.json(formatResponse(true, {
      doctor_id: doctor.doctor_id,
      doctor_name: doctor.full_name,
      status: doctor.status,
      upcoming_appointments_count: parseInt(apptRes.rows[0].count),
      active_treatments_count: parseInt(activeTreatmentsRes.rows[0].count),
      pending_followups_count: parseInt(followupsRes.rows[0].count)
    }, 'Doctor active responsibilities summary retrieved successfully'));
  } catch (err) {
    console.error('getDoctorSummary error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function transferDoctorResponsibilities(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const fromDoctorId = parseInt(req.params.id);
    const { to_doctor_id } = req.body;

    if (!to_doctor_id) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Target doctor ID (to_doctor_id) is required'));
    }

    const toDoctorId = parseInt(to_doctor_id);
    if (fromDoctorId === toDoctorId) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Source and target doctor cannot be the same'));
    }

    // Verify source doctor exists
    const fromDocRes = await client.query(`SELECT d.*, u.user_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE d.doctor_id = $1`, [fromDoctorId]);
    if (fromDocRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Source doctor not found'));
    }
    const fromDoc = fromDocRes.rows[0];

    // Verify target doctor exists and is active
    const toDocRes = await client.query(`SELECT d.*, u.user_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE d.doctor_id = $1 AND d.status = 'active'`, [toDoctorId]);
    if (toDocRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Target doctor not found or is inactive'));
    }

    // 1. Mark source doctor and user as inactive (resignation)
    await client.query(`UPDATE doctors SET status = 'inactive', updated_at = now() WHERE doctor_id = $1`, [fromDoctorId]);
    await client.query(`UPDATE users SET status = 'inactive', updated_at = now() WHERE user_id = $1`, [fromDoc.user_id]);

    // 2. Transfer future scheduled appointments ONLY (appointment_date >= CURRENT_DATE)
    const apptUpdateRes = await client.query(`
      UPDATE appointments
      SET doctor_id = $1, updated_at = now()
      WHERE doctor_id = $2 AND appointment_date >= CURRENT_DATE AND status = 'scheduled'
    `, [toDoctorId, fromDoctorId]);
    const appointmentsMoved = apptUpdateRes.rowCount;

    // 3. Transfer pending renewals / followups
    const renewalsUpdateRes = await client.query(`
      UPDATE renewals
      SET doctor_id = $1
      WHERE doctor_id = $2 AND status = 'pending'
    `, [toDoctorId, fromDoctorId]);
    const followupsMoved = renewalsUpdateRes.rowCount;

    // Record transfer in doctor_transfers table
    await client.query(`
      INSERT INTO doctor_transfers (
        from_doctor_id, to_doctor_id, appointments_moved, active_treatments_moved, followups_moved, performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [fromDoctorId, toDoctorId, appointmentsMoved, appointmentsMoved, followupsMoved, req.user.user_id]);

    await client.query('COMMIT');

    res.locals.auditEntry = {
      module: 'Doctor Resignation',
      action: 'Transfer Doctor Responsibilities',
      recordId: fromDoctorId,
      oldValue: { from_doctor_id: fromDoctorId, status: 'active' },
      newValue: { from_doctor_id: fromDoctorId, status: 'inactive', transferred_to: toDoctorId, appointments_moved: appointmentsMoved, followups_moved: followupsMoved }
    };

    return res.json(formatResponse(true, {
      from_doctor_id: fromDoctorId,
      to_doctor_id: toDoctorId,
      appointments_moved: appointmentsMoved,
      followups_moved: followupsMoved,
      source_doctor_status: 'inactive'
    }, 'Doctor responsibilities transferred and doctor deactivated successfully. Historical records preserved.'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('transferDoctorResponsibilities error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

module.exports = {
  getDoctors,
  getDoctorSummary,
  transferDoctorResponsibilities
};
