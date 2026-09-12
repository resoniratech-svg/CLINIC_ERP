/**
 * Doctor Scheduling & Availability Helper
 * Validates doctor working hours, approved leaves, and conflicting bookings.
 */

/**
 * Validates doctor availability for an appointment slot.
 * @param {object} client - pg pool or client
 * @param {number} doctorId - Doctor ID
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:MM or HH:MM:SS
 * @param {number|null} excludeAppointmentId - Current appointment ID if rescheduling
 * @param {number|null} branchId - Enforce branch boundary
 * @param {number|null} patientId - Enforce patient double-booking check
 */
async function validateDoctorAvailability(client, doctorId, dateStr, timeStr, excludeAppointmentId = null, branchId = null, patientId = null) {
  // 1. Validate date
  if (!dateStr || !timeStr) {
    return { available: false, error: 'Date and time are required' };
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const aptDate = new Date(y, m - 1, d);
  if (isNaN(aptDate.getTime())) {
    return { available: false, valid: false, error: 'Invalid appointment date format' };
  }

  // Prevent past dates
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateStr < todayStr) {
    return { available: false, valid: false, error: 'Cannot book or reschedule an appointment to a past date' };
  }

  // 2. Fetch Doctor Profile
  let query = `
    SELECT d.*, u.full_name as doctor_name, u.status as user_status, b.branch_name, b.branch_code
    FROM doctors d
    JOIN users u ON d.user_id = u.user_id
    JOIN branches b ON d.branch_id = b.branch_id
    WHERE d.doctor_id = $1
  `;
  const params = [parseInt(doctorId)];
  if (branchId !== null && branchId !== undefined) {
    query += ` AND d.branch_id = $2`;
    params.push(parseInt(branchId));
  }

  const docRes = await client.query(query, params);
  if (docRes.rows.length === 0) {
    return { available: false, valid: false, statusCode: 404, error: 'Doctor not found or does not belong to your clinic branch' };
  }

  const doctor = docRes.rows[0];
  if (doctor.status !== 'active' || doctor.user_status !== 'active') {
    return { available: false, valid: false, statusCode: 400, error: `Doctor ${doctor.doctor_name} is inactive or resigned. Please select an active doctor.` };
  }

  // 3. Validate Working Days
  const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayIndex = aptDate.getDay();
  const dayName = fullDays[dayIndex];
  const shortName = shortDays[dayIndex].toLowerCase();

  if (doctor.working_days) {
    let allowedDays = [];
    if (Array.isArray(doctor.working_days)) {
      allowedDays = doctor.working_days.map(s => String(s).trim().toLowerCase());
    } else {
      const cleanStr = String(doctor.working_days).replace(/[{}\"]/g, '');
      allowedDays = cleanStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    }

    const matchesDay = allowedDays.length === 0 || allowedDays.some(ad => ad === dayName.toLowerCase() || ad === shortName || ad.startsWith(shortName));
    if (!matchesDay) {
      return {
        available: false,
        valid: false,
        statusCode: 400,
        error: `Doctor ${doctor.doctor_name} does not work on ${dayName}s. Scheduled working days: ${doctor.working_days}.`
      };
    }
  }

  // 4. Validate Working Hours
  const startTime = doctor.start_time || '09:00:00';
  const endTime = doctor.end_time || '17:00:00';

  // Normalize time string (e.g. '10:00' -> '10:00:00')
  let cleanTime = timeStr.trim();
  if (cleanTime.length === 5) cleanTime += ':00';

  if (cleanTime < startTime || cleanTime >= endTime) {
    return {
      available: false,
      statusCode: 400,
      error: `Selected time ${cleanTime.slice(0, 5)} is outside Doctor ${doctor.doctor_name}'s consultation hours (${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}).`
    };
  }

  // 5. Check Approved Doctor Leaves
  const leaveRes = await client.query(`
    SELECT id, from_date, to_date, reason
    FROM doctor_leaves
    WHERE doctor_id = $1 AND status = 'approved'
      AND $2::date BETWEEN from_date AND to_date
    LIMIT 1
  `, [parseInt(doctorId), dateStr]);

  if (leaveRes.rows.length > 0) {
    const leave = leaveRes.rows[0];
    return {
      available: false,
      statusCode: 400,
      error: `Doctor ${doctor.doctor_name} is on approved leave on ${dateStr} (${leave.reason || 'Medical / Personal Leave'}). Please choose another doctor or date.`
    };
  }

  // 6. Check Doctor Slot Double Booking
  const conflictRes = await client.query(`
    SELECT appointment_id
    FROM appointments
    WHERE doctor_id = $1
      AND appointment_date = $2
      AND appointment_time::time = $3::time
      AND status NOT IN ('cancelled')
      AND ($4::integer IS NULL OR appointment_id != $4)
    FOR UPDATE
  `, [parseInt(doctorId), dateStr, cleanTime, excludeAppointmentId ? parseInt(excludeAppointmentId) : null]);

  if (conflictRes.rows.length > 0) {
    return {
      available: false,
      statusCode: 400,
      error: `Doctor ${doctor.doctor_name} is already booked at ${cleanTime.slice(0, 5)} on ${dateStr}. Double booking is not allowed. Please choose another slot.`
    };
  }

  // 7. Check Patient Double Booking (optional if patientId provided)
  if (patientId) {
    const ptConflict = await client.query(`
      SELECT appointment_id
      FROM appointments
      WHERE patient_id = $1
        AND appointment_date = $2
        AND appointment_time::time = $3::time
        AND status NOT IN ('cancelled')
        AND ($4::integer IS NULL OR appointment_id != $4)
    `, [parseInt(patientId), dateStr, cleanTime, excludeAppointmentId ? parseInt(excludeAppointmentId) : null]);

    if (ptConflict.rows.length > 0) {
      return {
        available: false,
        statusCode: 400,
        error: `Patient already has another appointment scheduled at ${cleanTime.slice(0, 5)} on ${dateStr}.`
      };
    }
  }

  return {
    available: true,
    valid: true,
    doctor,
    normalizedTime: cleanTime
  };
}

/**
 * Generates available slots for a doctor on a specific date.
 */
async function generateDoctorSlots(client, doctorId, dateStr, excludeAppointmentId = null) {
  const docRes = await client.query(`
    SELECT d.*, u.full_name as doctor_name, u.status as user_status
    FROM doctors d
    JOIN users u ON d.user_id = u.user_id
    WHERE d.doctor_id = $1
  `, [parseInt(doctorId)]);

  if (docRes.rows.length === 0) {
    return { success: false, error: 'Doctor not found' };
  }

  const doctor = docRes.rows[0];
  const [y, m, d] = dateStr.split('-').map(Number);
  const aptDate = new Date(y, m - 1, d);
  const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayIndex = aptDate.getDay();
  const dayName = fullDays[dayIndex];
  const shortName = shortDays[dayIndex].toLowerCase();

  // Check working days
  let isWorkingDay = true;
  if (doctor.working_days) {
    let allowed = [];
    if (Array.isArray(doctor.working_days)) {
      allowed = doctor.working_days.map(s => String(s).trim().toLowerCase());
    } else {
      const cleanStr = String(doctor.working_days).replace(/[{}\"]/g, '');
      allowed = cleanStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    }
    isWorkingDay = allowed.length === 0 || allowed.some(ad => ad === dayName.toLowerCase() || ad === shortName || ad.startsWith(shortName));
  }

  // Check leaves
  const leaveRes = await client.query(`
    SELECT reason FROM doctor_leaves
    WHERE doctor_id = $1 AND status = 'approved' AND $2::date BETWEEN from_date AND to_date
    LIMIT 1
  `, [parseInt(doctorId), dateStr]);
  const onLeave = leaveRes.rows.length > 0;
  const leaveReason = onLeave ? leaveRes.rows[0].reason : null;

  // Booked appointments
  const bookedRes = await client.query(`
    SELECT appointment_time::text as appt_time
    FROM appointments
    WHERE doctor_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled')
      AND ($3::integer IS NULL OR appointment_id != $3)
  `, [parseInt(doctorId), dateStr, excludeAppointmentId ? parseInt(excludeAppointmentId) : null]);

  const bookedTimes = new Set(bookedRes.rows.map(r => r.appt_time.slice(0, 5)));

  // Generate slots from start_time to end_time
  const startHour = parseInt((doctor.start_time || '09:00:00').slice(0, 2), 10) || 9;
  const endHour = parseInt((doctor.end_time || '17:00:00').slice(0, 2), 10) || 17;
  const stepMinutes = parseInt(doctor.slot_duration_minutes, 10) || 30;

  const slots = [];
  let currentMinutes = startHour * 60;
  const totalEndMinutes = endHour * 60;

  while (currentMinutes < totalEndMinutes) {
    const hh = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
    const mm = String(currentMinutes % 60).padStart(2, '0');
    const timeKey = `${hh}:${mm}`;
    const fullTime = `${timeKey}:00`;

    let isAvailable = true;
    let unavailableReason = null;

    if (!isWorkingDay) {
      isAvailable = false;
      unavailableReason = `Doctor off duty on ${dayName}`;
    } else if (onLeave) {
      isAvailable = false;
      unavailableReason = `On Leave: ${leaveReason || 'Approved Leave'}`;
    } else if (bookedTimes.has(timeKey)) {
      isAvailable = false;
      unavailableReason = 'Booked';
    }

    // Format label: e.g. "10:00 AM"
    const hNum = parseInt(hh, 10);
    const ampm = hNum >= 12 ? 'PM' : 'AM';
    const h12 = hNum % 12 || 12;
    const label = `${String(h12).padStart(2, '0')}:${mm} ${ampm}`;

    slots.push({
      time: fullTime,
      display_time: timeKey,
      label,
      is_available: isAvailable,
      reason: unavailableReason
    });

    currentMinutes += (stepMinutes > 0 ? stepMinutes : 30);
  }

  return {
    success: true,
    doctor_id: doctor.doctor_id,
    doctor_name: doctor.doctor_name,
    date: dateStr,
    on_leave: onLeave,
    is_on_leave: onLeave,
    leave_reason: leaveReason,
    is_working_day: isWorkingDay,
    slots
  };
}

module.exports = {
  validateDoctorAvailability,
  generateDoctorSlots
};
