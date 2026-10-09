const db = require('../db');
const { formatResponse } = require('../utils/helpers');

async function getDoctors(req, res) {
  try {
    const { status, specialization } = req.query;
    let query = `
      SELECT d.*, u.full_name, u.mobile_number, u.email, u.employee_id, u.status as user_status
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.branch_id = $1 AND d.status::text != 'deleted' AND u.status::text != 'deleted'
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
    return res.status(500).json(formatResponse(false, null, err.message || 'Internal server error'));
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

    // Count upcoming / active appointments (today & future)
    const upcomingApptRes = await db.query(`
      SELECT COUNT(*) FROM appointments
      WHERE doctor_id = $1
        AND appointment_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date
        AND status NOT IN ('completed', 'cancelled', 'no_show', 'doctor_completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed')
    `, [doctorId]);

    // Count past uncompleted appointments (not completed, date in past)
    const pastApptRes = await db.query(`
      SELECT COUNT(*) FROM appointments
      WHERE doctor_id = $1
        AND appointment_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
        AND status NOT IN ('completed', 'cancelled', 'no_show', 'doctor_completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed')
    `, [doctorId]);

    // Count active treatments linked to this doctor
    let activeTreatmentsCount = 0;
    try {
      const activeTreatmentsRes = await db.query(`
        SELECT COUNT(*) FROM treatment_plans
        WHERE doctor_id = $1 AND status = 'active'
      `, [doctorId]);
      activeTreatmentsCount = parseInt(activeTreatmentsRes.rows[0]?.count || 0);
    } catch (e) {
      activeTreatmentsCount = 0;
    }

    // Count pending followups / renewals
    let followupsCount = 0;
    try {
      const followupsRes = await db.query(`
        SELECT COUNT(*) FROM renewals WHERE doctor_id = $1 AND status = 'pending'
      `, [doctorId]);
      followupsCount = parseInt(followupsRes.rows[0]?.count || 0);
    } catch (e) {
      followupsCount = 0;
    }

    return res.json(formatResponse(true, {
      doctor_id: doctor.doctor_id,
      doctor_name: doctor.full_name,
      status: doctor.status,
      upcoming_appointments_count: parseInt(upcomingApptRes.rows[0]?.count || 0),
      past_uncompleted_appointments_count: parseInt(pastApptRes.rows[0]?.count || 0),
      active_treatments_count: activeTreatmentsCount,
      pending_followups_count: followupsCount
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

    // 1. Mark source doctor as resigned and user as inactive
    await client.query(`UPDATE doctors SET status = 'resigned', updated_at = now() WHERE doctor_id = $1`, [fromDoctorId]);
    await client.query(`UPDATE users SET status = 'inactive', updated_at = now() WHERE user_id = $1`, [fromDoc.user_id]);

    // 2. Query all active / upcoming appointments (scheduled for today or future) to transfer
    const apptsToMove = await client.query(`
      SELECT appointment_id, patient_id
      FROM appointments
      WHERE doctor_id = $1
        AND appointment_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date
        AND status NOT IN ('completed', 'cancelled', 'no_show', 'doctor_completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed')
    `, [fromDoctorId]);

    const apptUpdateRes = await client.query(`
      UPDATE appointments
      SET doctor_id = $1, updated_at = now()
      WHERE doctor_id = $2
        AND appointment_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date
        AND status NOT IN ('completed', 'cancelled', 'no_show', 'doctor_completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed')
    `, [toDoctorId, fromDoctorId]);
    const appointmentsMoved = apptUpdateRes.rowCount;

    // 3. Transfer active treatment plans
    let treatmentsMoved = 0;
    let treatmentsToMove = { rows: [] };
    try {
      treatmentsToMove = await client.query(`
        SELECT treatment_id, patient_id
        FROM treatment_plans
        WHERE doctor_id = $1 AND status = 'active'
      `, [fromDoctorId]);

      const treatmentUpdateRes = await client.query(`
        UPDATE treatment_plans
        SET doctor_id = $1, updated_at = now()
        WHERE doctor_id = $2 AND status = 'active'
      `, [toDoctorId, fromDoctorId]);
      treatmentsMoved = treatmentUpdateRes.rowCount;
    } catch (e) {
      console.warn('treatment_plans update:', e.message);
    }

    // 4. Transfer pending renewals / followups
    let followupsMoved = 0;
    let renewalsToMove = { rows: [] };
    try {
      renewalsToMove = await client.query(`
        SELECT id, patient_id
        FROM renewals
        WHERE doctor_id = $1 AND status = 'pending'
      `, [fromDoctorId]);

      const renewalsUpdateRes = await client.query(`
        UPDATE renewals
        SET doctor_id = $1
        WHERE doctor_id = $2 AND status = 'pending'
      `, [toDoctorId, fromDoctorId]);
      followupsMoved = renewalsUpdateRes.rowCount;
    } catch (e) {
      console.warn('renewals update:', e.message);
    }

    // 5. Transfer pending/active packages
    try {
      await client.query(`
        UPDATE packages
        SET doctor_id = $1, updated_at = now()
        WHERE doctor_id = $2 AND status IN ('pending', 'active')
      `, [toDoctorId, fromDoctorId]);
    } catch (e) {
      console.warn('packages update:', e.message);
    }

    // 6. Transfer draft consultations (if any)
    try {
      await client.query(`
        UPDATE consultations
        SET doctor_id = $1, updated_at = now()
        WHERE doctor_id = $2 AND status = 'draft'
      `, [toDoctorId, fromDoctorId]);
    } catch (e) {
      console.warn('consultations update:', e.message);
    }

    // 7. Reject pending leave requests for the resigning doctor
    try {
      await client.query(`
        UPDATE doctor_leaves
        SET status = 'rejected', remarks = 'Doctor resigned & transferred', updated_at = now()
        WHERE doctor_id = $1 AND status = 'pending'
      `, [fromDoctorId]);
    } catch (e) {
      console.warn('doctor_leaves update:', e.message);
    }

    // Record transfer in doctor_transfers table
    const transferInsertRes = await client.query(`
      INSERT INTO doctor_transfers (
        from_doctor_id, to_doctor_id, appointments_moved, active_treatments_moved, followups_moved, performed_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING id
    `, [fromDoctorId, toDoctorId, appointmentsMoved, treatmentsMoved, followupsMoved, req.user.user_id]);
    const transferId = transferInsertRes.rows[0].id;

    // Record granular items in doctor_transfer_items table for exact Option A restoration
    try {
      for (const appt of apptsToMove.rows) {
        await client.query(`
          INSERT INTO doctor_transfer_items (
            transfer_id, resigned_doctor_id, new_doctor_id, record_type, record_id, patient_id, transferred_at, status
          ) VALUES ($1, $2, $3, 'appointment', $4, $5, now(), 'transferred')
        `, [transferId, fromDoctorId, toDoctorId, appt.appointment_id, appt.patient_id]);
      }

      for (const tr of treatmentsToMove.rows) {
        await client.query(`
          INSERT INTO doctor_transfer_items (
            transfer_id, resigned_doctor_id, new_doctor_id, record_type, record_id, patient_id, transferred_at, status
          ) VALUES ($1, $2, $3, 'treatment_plan', $4, $5, now(), 'transferred')
        `, [transferId, fromDoctorId, toDoctorId, tr.treatment_id, tr.patient_id]);
      }

      for (const ren of renewalsToMove.rows) {
        await client.query(`
          INSERT INTO doctor_transfer_items (
            transfer_id, resigned_doctor_id, new_doctor_id, record_type, record_id, patient_id, transferred_at, status
          ) VALUES ($1, $2, $3, 'renewal', $4, $5, now(), 'transferred')
        `, [transferId, fromDoctorId, toDoctorId, ren.id, ren.patient_id]);
      }
    } catch (dtiErr) {
      console.warn('doctor_transfer_items logging:', dtiErr.message);
    }

    await client.query('COMMIT');

    if (res.locals) {
      res.locals.auditEntry = {
        module: 'Doctor Resignation',
        action: 'Transfer Doctor Responsibilities',
        recordId: fromDoctorId,
        oldValue: { from_doctor_id: fromDoctorId, status: 'active' },
        newValue: { from_doctor_id: fromDoctorId, status: 'resigned', transferred_to: toDoctorId, appointments_moved: appointmentsMoved, treatments_moved: treatmentsMoved, followups_moved: followupsMoved }
      };
    }

    return res.json(formatResponse(true, {
      from_doctor_id: fromDoctorId,
      to_doctor_id: toDoctorId,
      appointments_moved: appointmentsMoved,
      treatments_moved: treatmentsMoved,
      followups_moved: followupsMoved,
      source_doctor_status: 'resigned'
    }, 'Doctor responsibilities transferred and doctor resigned successfully. Historical records preserved.'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('transferDoctorResponsibilities error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

async function getReactivationPreview(req, res) {
  try {
    const doctorId = parseInt(req.params.id);

    const docRes = await db.query(`
      SELECT d.*, u.full_name, u.username, u.email
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.doctor_id = $1
    `, [doctorId]);

    if (docRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Doctor not found'));
    }

    const doctor = docRes.rows[0];
    if (doctor.status === 'active') {
      return res.status(400).json(formatResponse(false, null, 'Doctor is already active'));
    }

    // Find the latest transfer record where this doctor was the resigning doctor
    const transferRes = await db.query(`
      SELECT dt.*, u_new.full_name as new_doctor_name, d_new.doctor_code as new_doctor_code
      FROM doctor_transfers dt
      JOIN doctors d_new ON dt.to_doctor_id = d_new.doctor_id
      JOIN users u_new ON d_new.user_id = u_new.user_id
      WHERE dt.from_doctor_id = $1
      ORDER BY dt.id DESC LIMIT 1
    `, [doctorId]);

    const transfer = transferRes.rows[0] || null;
    const patientsReturning = [];
    const patientsStaying = [];
    const skippedItems = [];

    if (transfer) {
      const toDoctorId = transfer.to_doctor_id;
      const transferDate = transfer.performed_at;

      // 1. Get transferred items from doctor_transfer_items
      let itemsRes = await db.query(`
        SELECT dti.*, p.full_name as patient_name, p.registration_id, p.mobile_number
        FROM doctor_transfer_items dti
        JOIN patients p ON dti.patient_id = p.patient_id
        WHERE dti.transfer_id = $1 AND dti.status = 'transferred'
      `, [transfer.id]);

      // Fallback: if transfer predates doctor_transfer_items table
      if (itemsRes.rows.length === 0 && transfer.appointments_moved > 0) {
        const fallbackAppts = await db.query(`
          SELECT a.appointment_id as record_id, a.patient_id, 'appointment' as record_type,
                 p.full_name as patient_name, p.registration_id, p.mobile_number, a.appointment_date, a.status as appt_status
          FROM appointments a
          JOIN patients p ON a.patient_id = p.patient_id
          WHERE a.doctor_id = $1
            AND a.status NOT IN ('completed', 'cancelled', 'no_show', 'doctor_completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed')
            AND a.updated_at >= $2 - INTERVAL '2 minutes'
        `, [toDoctorId, transferDate]);
        itemsRes = fallbackAppts;
      }

      // Group items by patient
      const patientMap = new Map();
      for (const item of itemsRes.rows) {
        if (!patientMap.has(item.patient_id)) {
          patientMap.set(item.patient_id, {
            patient_id: item.patient_id,
            patient_name: item.patient_name,
            registration_id: item.registration_id,
            mobile_number: item.mobile_number,
            items: []
          });
        }
        patientMap.get(item.patient_id).items.push(item);
      }

      for (const [pId, pData] of patientMap.entries()) {
        // Check if the patient HAS been consulted by the new doctor since transfer:
        const consultCheck = await db.query(`
          SELECT c.consultation_id, to_char(c.created_at, 'YYYY-MM-DD') as consult_date
          FROM consultations c
          WHERE c.doctor_id = $1 AND c.patient_id = $2
            AND c.status = 'completed' AND c.created_at >= $3
          ORDER BY c.created_at DESC LIMIT 1
        `, [toDoctorId, pId, transferDate]);

        const rxCheck = await db.query(`
          SELECT rx.id, to_char(rx.created_at, 'YYYY-MM-DD') as rx_date
          FROM prescriptions rx
          WHERE rx.doctor_id = $1 AND rx.patient_id = $2 AND rx.created_at >= $3
          ORDER BY rx.created_at DESC LIMIT 1
        `, [toDoctorId, pId, transferDate]);

        if (consultCheck.rows.length > 0 || rxCheck.rows.length > 0) {
          const dateStr = consultCheck.rows[0]?.consult_date || rxCheck.rows[0]?.rx_date;
          patientsStaying.push({
            patient_id: pId,
            patient_name: pData.patient_name,
            registration_id: pData.registration_id,
            reason: `Consulted by Dr. ${transfer.new_doctor_name} on ${dateStr}`,
            consulted_date: dateStr,
            items_count: pData.items.length
          });
        } else {
          let validAppointmentsToReturn = 0;
          let validFollowupsToReturn = 0;

          for (const it of pData.items) {
            if (it.record_type === 'appointment') {
              const apptCheck = await db.query(`
                SELECT appointment_id, to_char(appointment_date, 'YYYY-MM-DD') as appt_date, status
                FROM appointments WHERE appointment_id = $1
              `, [it.record_id]);

              if (apptCheck.rows.length > 0) {
                const appt = apptCheck.rows[0];
                const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

                if (appt.appt_date === todayStr && ['waiting', 'in_consultation', 'checked_in'].includes(appt.status)) {
                  skippedItems.push({
                    patient_id: pId,
                    patient_name: pData.patient_name,
                    record_type: 'appointment',
                    record_id: appt.appointment_id,
                    reason: `Appointment #${appt.appointment_id} is in queue today (${appt.status}) — retained with current doctor`
                  });
                } else if (appt.appt_date < todayStr) {
                  skippedItems.push({
                    patient_id: pId,
                    patient_name: pData.patient_name,
                    record_type: 'appointment',
                    record_id: appt.appointment_id,
                    reason: `Appointment #${appt.appointment_id} date has passed (${appt.appt_date}) — retained where it is`
                  });
                } else {
                  validAppointmentsToReturn++;
                }
              }
            } else if (it.record_type === 'renewal') {
              validFollowupsToReturn++;
            }
          }

          patientsReturning.push({
            patient_id: pId,
            patient_name: pData.patient_name,
            registration_id: pData.registration_id,
            appointments_count: validAppointmentsToReturn,
            followups_count: validFollowupsToReturn,
            reason: `No consultations with Dr. ${transfer.new_doctor_name} since transfer`
          });
        }
      }
    }

    const totalApptsReturning = patientsReturning.reduce((sum, p) => sum + p.appointments_count, 0);
    const totalFollowupsReturning = patientsReturning.reduce((sum, p) => sum + p.followups_count, 0);

    return res.json(formatResponse(true, {
      doctor_id: doctor.doctor_id,
      doctor_name: doctor.full_name,
      doctor_code: doctor.doctor_code,
      status: doctor.status,
      transferred_to_doctor_id: transfer?.to_doctor_id || null,
      transferred_to_doctor_name: transfer?.new_doctor_name || null,
      transferred_at: transfer?.performed_at || null,
      patients_returning: patientsReturning,
      patients_staying: patientsStaying,
      skipped_items: skippedItems,
      counts: {
        returning_patients: patientsReturning.length,
        staying_patients: patientsStaying.length,
        appointments_to_restore: totalApptsReturning,
        followups_to_restore: totalFollowupsReturning,
        skipped_count: skippedItems.length
      },
      summary: {
        returning_patients_count: patientsReturning.length,
        staying_patients_count: patientsStaying.length,
        appointments_to_restore_count: totalApptsReturning,
        renewals_to_restore_count: totalFollowupsReturning,
        skipped_items_count: skippedItems.length
      }
    }, 'Doctor reactivation preview retrieved successfully'));
  } catch (err) {
    console.error('getReactivationPreview error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

async function reactivateDoctor(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const doctorId = parseInt(req.params.id);
    let { option } = req.body; // 'with_restore' (Option A) or 'without_restore' (Option B)
    if (option === 'A' || option === 'restore') option = 'with_restore';
    if (option === 'B' || option === 'fresh') option = 'without_restore';

    if (!option || !['with_restore', 'without_restore'].includes(option)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, "option must be either 'with_restore' (Option A) or 'without_restore' (Option B)"));
    }

    const docRes = await client.query(`
      SELECT d.*, u.user_id, u.full_name
      FROM doctors d
      JOIN users u ON d.user_id = u.user_id
      WHERE d.doctor_id = $1
    `, [doctorId]);

    if (docRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Doctor not found'));
    }

    const doctor = docRes.rows[0];

    // Idempotency: if doctor is already active, return 409
    if (doctor.status === 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json(formatResponse(false, null, `Doctor ${doctor.full_name} is already active`));
    }

    // 1. Reactivate doctor profile and user login account
    await client.query(`UPDATE doctors SET status = 'active', updated_at = now() WHERE doctor_id = $1`, [doctorId]);
    await client.query(`UPDATE users SET status = 'active', updated_at = now() WHERE user_id = $1`, [doctor.user_id]);

    let restoredApptsCount = 0;
    let restoredFollowupsCount = 0;
    let returningPatientsCount = 0;
    let stayingPatientsCount = 0;

    const latestTransferRes = await client.query(`
      SELECT * FROM doctor_transfers
      WHERE from_doctor_id = $1
      ORDER BY id DESC LIMIT 1
    `, [doctorId]);
    const latestTransfer = latestTransferRes.rows[0] || null;

    if (option === 'with_restore' && latestTransfer) {
      const toDoctorId = latestTransfer.to_doctor_id;
      const transferDate = latestTransfer.performed_at;

      let itemsRes = await client.query(`
        SELECT * FROM doctor_transfer_items
        WHERE transfer_id = $1 AND status = 'transferred'
      `, [latestTransfer.id]);

      // Fallback for older transfer
      if (itemsRes.rows.length === 0 && latestTransfer.appointments_moved > 0) {
        const fallbackAppts = await client.query(`
          SELECT a.appointment_id as record_id, a.patient_id, 'appointment' as record_type
          FROM appointments a
          WHERE a.doctor_id = $1
            AND a.status NOT IN ('completed', 'cancelled', 'no_show', 'doctor_completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed')
            AND a.updated_at >= $2 - INTERVAL '2 minutes'
        `, [toDoctorId, transferDate]);
        itemsRes = fallbackAppts;
      }

      const patientMap = new Map();
      for (const it of itemsRes.rows) {
        if (!patientMap.has(it.patient_id)) {
          patientMap.set(it.patient_id, []);
        }
        patientMap.get(it.patient_id).push(it);
      }

      for (const [pId, items] of patientMap.entries()) {
        const consultCheck = await client.query(`
          SELECT 1 FROM consultations
          WHERE doctor_id = $1 AND patient_id = $2
            AND status = 'completed' AND created_at >= $3
          LIMIT 1
        `, [toDoctorId, pId, transferDate]);

        const rxCheck = await client.query(`
          SELECT 1 FROM prescriptions
          WHERE doctor_id = $1 AND patient_id = $2 AND created_at >= $3
          LIMIT 1
        `, [toDoctorId, pId, transferDate]);

        if (consultCheck.rows.length > 0 || rxCheck.rows.length > 0) {
          stayingPatientsCount++;
          await client.query(`
            UPDATE doctor_transfer_items
            SET status = 'retained'
            WHERE transfer_id = $1 AND patient_id = $2
          `, [latestTransfer.id, pId]);
        } else {
          returningPatientsCount++;
          for (const it of items) {
            if (it.record_type === 'appointment') {
              // Move appointment only if upcoming (not in queue today, not past)
              const moveRes = await client.query(`
                UPDATE appointments
                SET doctor_id = $1, updated_at = now()
                WHERE appointment_id = $2
                  AND appointment_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date
                  AND status NOT IN ('in_consultation', 'completed', 'cancelled', 'no_show', 'doctor_completed', 'pro_pending', 'pro_completed', 'pharmacy_pending', 'dispensed')
              `, [doctorId, it.record_id]);

              if (moveRes.rowCount > 0) {
                restoredApptsCount += moveRes.rowCount;
                await client.query(`
                  UPDATE doctor_transfer_items
                  SET status = 'restored', restored_at = now(), restored_by = $1
                  WHERE record_type = 'appointment' AND record_id = $2
                `, [req.user.user_id, it.record_id]);
              }
            } else if (it.record_type === 'renewal') {
              const renMoveRes = await client.query(`
                UPDATE renewals
                SET doctor_id = $1
                WHERE id = $2 AND status = 'pending'
              `, [doctorId, it.record_id]);

              if (renMoveRes.rowCount > 0) {
                restoredFollowupsCount += renMoveRes.rowCount;
                await client.query(`
                  UPDATE doctor_transfer_items
                  SET status = 'restored', restored_at = now(), restored_by = $1
                  WHERE record_type = 'renewal' AND record_id = $2
                `, [req.user.user_id, it.record_id]);
              }
            } else if (it.record_type === 'treatment_plan') {
              await client.query(`
                UPDATE treatment_plans
                SET doctor_id = $1, updated_at = now()
                WHERE treatment_id = $2 AND status = 'active'
              `, [doctorId, it.record_id]);
              await client.query(`
                UPDATE doctor_transfer_items
                SET status = 'restored', restored_at = now(), restored_by = $1
                WHERE record_type = 'treatment_plan' AND record_id = $2
              `, [req.user.user_id, it.record_id]);
            }
          }
        }
      }

      await client.query(`
        UPDATE doctor_transfers
        SET status = 'restored', reactivated_at = now(), reactivated_by = $1, reactivation_option = 'with_restore'
        WHERE id = $2
      `, [req.user.user_id, latestTransfer.id]);
    } else if (latestTransfer) {
      await client.query(`
        UPDATE doctor_transfers
        SET status = 'reactivated_without_restore', reactivated_at = now(), reactivated_by = $1, reactivation_option = 'without_restore'
        WHERE id = $2
      `, [req.user.user_id, latestTransfer.id]);
    }

    await client.query('COMMIT');

    if (res.locals) {
      res.locals.auditEntry = {
        module: 'Doctor Governance',
        action: 'Reactivate Doctor',
        recordId: doctorId,
        oldValue: { doctor_id: doctorId, status: doctor.status },
        newValue: {
          doctor_id: doctorId,
          status: 'active',
          option,
          restored_appointments: restoredApptsCount,
          restored_followups: restoredFollowupsCount,
          returning_patients: returningPatientsCount,
          staying_patients: stayingPatientsCount
        }
      };
    }

    return res.json(formatResponse(true, {
      doctor_id: doctorId,
      status: 'active',
      option,
      restored_appointments: restoredApptsCount,
      restored_followups: restoredFollowupsCount,
      returning_patients: returningPatientsCount,
      staying_patients: stayingPatientsCount
    }, `Doctor ${doctor.full_name} reactivated successfully (${option === 'with_restore' ? 'with patient data restore' : 'without patient data restore'}).`));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('reactivateDoctor error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  } finally {
    client.release();
  }
}

module.exports = {
  getDoctors,
  getDoctorSummary,
  transferDoctorResponsibilities,
  getReactivationPreview,
  reactivateDoctor
};
