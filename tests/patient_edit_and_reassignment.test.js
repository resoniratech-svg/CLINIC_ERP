const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

let adminToken = '';
let receptionistToken = '';
let doctor1Token = '';
let doctor2Token = '';
let pharmacyToken = '';
let doc1Id = null;
let doc2Id = null;
const ts = Date.now();

beforeAll(async () => {
  await seed();

  // Admin login
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
  adminToken = adminLogin.body.data.token;

  // Receptionist login
  const recLogin = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
  receptionistToken = recLogin.body.data.token;

  // Pharmacy login
  const pharmLogin = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
  pharmacyToken = pharmLogin.body.data.token;

  // Create Doctor 1
  const doc1User = `doc_reas1_${ts}`;
  await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
    employee_id: `DOC_R1_${ts}`, full_name: 'Dr. Primary One', mobile_number: `91${ts.toString().slice(-8)}`,
    username: doc1User, password: 'Password@123', role: 'doctor',
    doctor_details: { specialization: 'General Physician', new_consultation_fee: 500, start_time: '09:00:00', end_time: '17:00:00', working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
  });
  const doc1Login = await request(app).post('/api/v1/auth/login').send({ username: doc1User, password: 'Password@123' });
  doctor1Token = doc1Login.body.data.token;

  const d1Query = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [doc1Login.body.data.user.user_id]);
  doc1Id = d1Query.rows[0].doctor_id;

  // Create Doctor 2
  const doc2User = `doc_reas2_${ts}`;
  await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
    employee_id: `DOC_R2_${ts}`, full_name: 'Dr. Secondary Two', mobile_number: `92${ts.toString().slice(-8)}`,
    username: doc2User, password: 'Password@123', role: 'doctor',
    doctor_details: { specialization: 'Homeopathy Specialist', new_consultation_fee: 600, start_time: '09:00:00', end_time: '17:00:00', working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
  });
  const doc2Login = await request(app).post('/api/v1/auth/login').send({ username: doc2User, password: 'Password@123' });
  doctor2Token = doc2Login.body.data.token;

  const d2Query = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [doc2Login.body.data.user.user_id]);
  doc2Id = d2Query.rows[0].doctor_id;
});

afterAll(async () => {
  await db.pool.end();
});

describe('1. Patient Editing Workflow & Validation', () => {
  let testPatientId = null;
  let testRegId = null;
  let otherPatientId = null;

  const mob1 = `91${ts.toString().slice(-8)}`;
  const mob2 = `92${ts.toString().slice(-8)}`;
  const mobUpdated = `93${ts.toString().slice(-8)}`;

  beforeAll(async () => {
    // Register Patient 1
    const regRes = await request(app).post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        full_name: 'Original Patient One',
        mobile_number: mob1,
        age: 30,
        gender: 'male',
        address: 'Old Town Street 1',
        ailment_reason: 'Headache',
        village_mandal: 'Karimnagar, Karimnagar',
        assigned_doctor_id: doc1Id,
        appointment_date: '2026-10-01',
        appointment_time: '09:00:00'
      });
    testPatientId = regRes.body.data.patient_id;
    testRegId = regRes.body.data.registration_id;

    // Register Patient 2
    const regRes2 = await request(app).post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        full_name: 'Patient Two Other',
        mobile_number: mob2,
        age: 40,
        gender: 'female',
        address: 'Old Town Street 2',
        ailment_reason: 'Back Pain',
        village_mandal: 'Karimnagar, Karimnagar',
        assigned_doctor_id: doc1Id,
        appointment_date: '2026-10-01',
        appointment_time: '09:30:00'
      });
    otherPatientId = regRes2.body.data.patient_id;
  });

  test('Receptionist can update patient details with valid inputs', async () => {
    const res = await request(app)
      .put(`/api/v1/receptionist/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        full_name: 'Updated Patient One',
        mobile_number: mobUpdated,
        age: 32,
        gender: 'male',
        address: 'New Town Lane 5',
        ailment_reason: 'Severe Migraine',
        village_mandal: 'Malkapur, Kothapally'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('Updated Patient One');
    expect(res.body.data.mobile_number).toBe(mobUpdated);
    expect(res.body.data.age).toBe(32);
    expect(res.body.data.patient_id).toBe(testPatientId);
    expect(res.body.data.registration_id).toBe(testRegId); // Immutable
  });

  test('Duplicate mobile validation rejects conflicting mobile from another patient', async () => {
    const res = await request(app)
      .put(`/api/v1/receptionist/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        mobile_number: mob2 // Belongs to otherPatientId
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already belongs to another patient/i);
  });

  test('Updating same patient with their own mobile number succeeds', async () => {
    const res = await request(app)
      .put(`/api/v1/receptionist/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        mobile_number: mobUpdated
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Validation rejects invalid age and invalid gender', async () => {
    const ageRes = await request(app)
      .put(`/api/v1/receptionist/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ age: 150 });
    expect(ageRes.status).toBe(400);

    const genderRes = await request(app)
      .put(`/api/v1/receptionist/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ gender: 'unknown' });
    expect(genderRes.status).toBe(400);
  });

  test('Doctor portal can also update patient details', async () => {
    const res = await request(app)
      .put(`/api/v1/doctor/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${doctor1Token}`)
      .send({
        full_name: 'Patient One Validated By Doctor',
        ailment_reason: 'Chronic Migraine With Aura'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('Patient One Validated By Doctor');
    expect(res.body.data.ailment_reason).toBe('Chronic Migraine With Aura');
  });

  test('Audit log is properly recorded for patient update', async () => {
    const audit = await db.query(
      `SELECT * FROM audit_logs WHERE module = 'Patients' AND record_id = $1 ORDER BY id DESC LIMIT 1`,
      [String(testPatientId)]
    );
    expect(audit.rows.length).toBeGreaterThan(0);
    expect(audit.rows[0].action).toBe('Edit Patient Details');
  });

  test('Pharmacy role is forbidden from editing patient details (403)', async () => {
    const res = await request(app)
      .put(`/api/v1/receptionist/patients/${testPatientId}`)
      .set('Authorization', `Bearer ${pharmacyToken}`)
      .send({ full_name: 'Hacked Patient' });

    expect(res.status).toBe(403);
  });
});

describe('2. Doctor Availability, Schedule, and Slots', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  test('Slots generator returns formatted slots for doctor working hours', async () => {
    const res = await request(app)
      .get(`/api/v1/receptionist/doctors/${doc1Id}/available-slots?date=${dateStr}`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
    expect(res.body.data.is_on_leave).toBe(false);
  });

  test('Doctor with approved leave is marked on leave and booking is prevented', async () => {
    const leaveDate = new Date();
    leaveDate.setDate(leaveDate.getDate() + 5);
    const leaveDateStr = leaveDate.toISOString().split('T')[0];

    // Insert approved leave for doc2
    await db.query(`
      INSERT INTO doctor_leaves (doctor_id, from_date, to_date, reason, status)
      VALUES ($1, $2, $2, 'Conference Attendance', 'approved')
    `, [doc2Id, leaveDateStr]);

    // Check slot generator
    const slotsRes = await request(app)
      .get(`/api/v1/receptionist/doctors/${doc2Id}/available-slots?date=${leaveDateStr}`)
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(slotsRes.status).toBe(200);
    expect(slotsRes.body.data.is_on_leave).toBe(true);
    expect(slotsRes.body.data.leave_reason).toBe('Conference Attendance');

    const mobLeave = `94${ts.toString().slice(-8)}`;
    const regRes = await request(app).post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        full_name: 'Temp Patient Leave Test',
        mobile_number: mobLeave,
        age: 25,
        gender: 'female',
        village_mandal: 'Karimnagar, Karimnagar',
        assigned_doctor_id: doc1Id,
        appointment_date: '2026-10-01',
        appointment_time: '11:00:00'
      });
    const apptId = regRes.body.data.appointment.appointment_id;

    const reassignLeaveRes = await request(app)
      .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        doctor_id: doc2Id,
        appointment_date: leaveDateStr,
        appointment_time: '10:00:00',
        reason: 'Attempt reassign to leave day'
      });

    expect(reassignLeaveRes.status).toBe(400);
    expect(reassignLeaveRes.body.message).toMatch(/leave/i);
  });
});

describe('3. Doctor Reassignment & Consultation Revenue Transfer', () => {
  let patientId = null;
  let apptId = null;
  let billId = null;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const targetDateStr = tomorrow.toISOString().split('T')[0];

  beforeAll(async () => {
    const mobRev = `95${ts.toString().slice(-8)}`;
    const regRes = await request(app).post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        full_name: 'Revenue Transfer Patient',
        mobile_number: mobRev,
        age: 28,
        gender: 'female',
        village_mandal: 'Karimnagar, Karimnagar',
        assigned_doctor_id: doc1Id,
        appointment_date: targetDateStr,
        appointment_time: '10:00:00',
        payment_amount: 500
      });
    patientId = regRes.body.data.patient_id;
    apptId = regRes.body.data.appointment.appointment_id;
    billId = regRes.body.data.bill.bill_id;
  });

  test('Pre-condition: Bill is credited to Doctor 1 with 1 successful payment', async () => {
    const bill = await db.query(`SELECT * FROM bills WHERE bill_id = $1`, [billId]);
    expect(bill.rows[0].doctor_id).toBe(doc1Id);
    expect(parseFloat(bill.rows[0].final_amount)).toBe(500);

    const payments = await db.query(`SELECT * FROM payments WHERE bill_id = $1`, [billId]);
    expect(payments.rows.length).toBe(1);
    expect(parseFloat(payments.rows[0].amount)).toBe(500);
  });

  test('Reassign doctor requires a valid reason', async () => {
    const res = await request(app)
      .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        doctor_id: doc2Id,
        appointment_date: targetDateStr,
        appointment_time: '14:00:00',
        reason: '  ' // Invalid empty reason
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reason.*required/i);
  });

  test('Successful Doctor Reassignment transfers consultation bill attribution to Doctor 2', async () => {
    const res = await request(app)
      .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        doctor_id: doc2Id,
        appointment_date: targetDateStr,
        appointment_time: '14:00:00',
        reason: 'Patient requested female homeopathy specialist'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bill_transferred).toBe(true);
    expect(res.body.data.new_doctor_id).toBe(doc2Id);
    expect(res.body.data.old_doctor_id).toBe(doc1Id);

    // Verify appointment in DB
    const apptCheck = await db.query(`SELECT * FROM appointments WHERE appointment_id = $1`, [apptId]);
    expect(apptCheck.rows[0].doctor_id).toBe(doc2Id);
    expect(apptCheck.rows[0].appointment_time.slice(0, 5)).toBe('14:00');

    // Verify Bill in DB
    const billCheck = await db.query(`SELECT * FROM bills WHERE bill_id = $1`, [billId]);
    expect(billCheck.rows[0].doctor_id).toBe(doc2Id);
    expect(billCheck.rows[0].appointment_id).toBe(apptId);

    // Financial Invariants:
    // 1. Exactly 1 bill
    const totalBills = await db.query(`SELECT COUNT(*) as cnt FROM bills WHERE patient_id = $1`, [patientId]);
    expect(parseInt(totalBills.rows[0].cnt)).toBe(1);

    // 2. Exactly 1 payment, same amount, 0 extra charge
    const payments = await db.query(`SELECT * FROM payments WHERE patient_id = $1`, [patientId]);
    expect(payments.rows.length).toBe(1);
    expect(parseFloat(payments.rows[0].amount)).toBe(500);

    // 3. Audit log recorded
    const audit = await db.query(
      `SELECT * FROM audit_logs WHERE module = 'Appointments' AND record_id = $1 ORDER BY id DESC LIMIT 1`,
      [String(apptId)]
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0].action).toBe('Reassign Doctor');
    expect(audit.rows[0].remarks).toMatch(/Patient requested female homeopathy specialist/i);
  });

  test('Cannot double book Doctor 2 at the newly reassigned slot', async () => {
    // Register another patient
    const mobConflict = `96${ts.toString().slice(-8)}`;
    const regRes = await request(app).post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        full_name: 'Conflict Patient',
        mobile_number: mobConflict,
        age: 35,
        gender: 'male',
        village_mandal: 'Karimnagar, Karimnagar',
        assigned_doctor_id: doc1Id,
        appointment_date: '2026-10-01',
        appointment_time: '14:30:00'
      });
    const conflictPatientId = regRes.body.data.patient_id;

    const res = await request(app)
      .post('/api/v1/receptionist/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        patient_id: conflictPatientId,
        doctor_id: doc2Id,
        appointment_date: targetDateStr,
        appointment_time: '14:00:00', // Already booked by reassigned appointment
        appointment_type: 'new'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already booked/i);
  });

  test('Doctor portal cannot reassign completed consultations (immutability rule)', async () => {
    // Mark appointment as completed
    await db.query(`UPDATE appointments SET status = 'completed' WHERE appointment_id = $1`, [apptId]);

    const res = await request(app)
      .post(`/api/v1/doctor/appointments/${apptId}/reassign-doctor`)
      .set('Authorization', `Bearer ${doctor2Token}`)
      .send({
        doctor_id: doc1Id,
        appointment_date: targetDateStr,
        appointment_time: '15:00:00',
        reason: 'Attempt to reassign finished visit'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already completed/i);
  });

  test('Cannot reassign cancelled appointments', async () => {
    await db.query(`UPDATE appointments SET status = 'cancelled' WHERE appointment_id = $1`, [apptId]);

    const res = await request(app)
      .post(`/api/v1/receptionist/appointments/${apptId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        doctor_id: doc1Id,
        appointment_date: targetDateStr,
        appointment_time: '15:00:00',
        reason: 'Attempt to reassign cancelled visit'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cancelled/i);
  });
});
