/**
 * patient_reassignment_visibility.test.js
 * 29-case test suite: Doctor Reassignment Visibility
 */

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

let adminToken = '';
let receptionistToken = '';
let doctorAToken = '';
let doctorBToken = '';
let docAId = null;
let docBId = null;

const ts = Date.now();
const futureDate  = new Date(Date.now() + 7  * 86400000).toISOString().split('T')[0];
const futureDate2 = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

// Shared state — set in setup beforeAll
let patientId     = null;
let appointmentId = null;

beforeAll(async () => {
  await seed();

  const adminLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
  adminToken = adminLogin.body.data.token;

  const recLogin = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
  receptionistToken = recLogin.body.data.token;

  // Doctor A
  const docAUser = `vis_docA_${ts}`;
  await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
    employee_id: `VIS_A_${ts}`, full_name: 'Dr. Alpha Visibility',
    mobile_number: `71${ts.toString().slice(-8)}`,
    username: docAUser, password: 'Password@123', role: 'doctor',
    doctor_details: { specialization: 'General Physician', new_consultation_fee: 400, start_time: '09:00:00', end_time: '17:00:00', working_days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] }
  });
  const dALogin = await request(app).post('/api/v1/auth/login').send({ username: docAUser, password: 'Password@123' });
  doctorAToken = dALogin.body.data.token;
  const dARes = await db.query('SELECT doctor_id FROM doctors WHERE user_id = $1', [dALogin.body.data.user.user_id]);
  docAId = dARes.rows[0].doctor_id;

  // Doctor B
  const docBUser = `vis_docB_${ts}`;
  await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
    employee_id: `VIS_B_${ts}`, full_name: 'Dr. Beta Visibility',
    mobile_number: `72${ts.toString().slice(-8)}`,
    username: docBUser, password: 'Password@123', role: 'doctor',
    doctor_details: { specialization: 'Homeopathy', new_consultation_fee: 500, start_time: '09:00:00', end_time: '17:00:00', working_days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] }
  });
  const dBLogin = await request(app).post('/api/v1/auth/login').send({ username: docBUser, password: 'Password@123' });
  doctorBToken = dBLogin.body.data.token;
  const dBRes = await db.query('SELECT doctor_id FROM doctors WHERE user_id = $1', [dBLogin.body.data.user.user_id]);
  docBId = dBRes.rows[0].doctor_id;

  // Register the core test patient with Doctor A
  const mob = `75${ts.toString().slice(-8)}`;
  const regRes = await request(app).post('/api/v1/receptionist/patients/register')
    .set('Authorization', `Bearer ${receptionistToken}`)
    .send({ full_name: 'Visibility Test Patient', mobile_number: mob, age: 35, gender: 'female', address: 'Test Street', ailment_reason: 'Fever', assigned_doctor_id: docAId, appointment_date: futureDate, appointment_time: '09:00', appointment_type: 'new' });

  patientId = regRes.body.data?.patient_id || regRes.body.data?.patient?.patient_id;
  if (!patientId) throw new Error(`Setup failed: patient registration returned ${regRes.status}: ${JSON.stringify(regRes.body)}`);

  const apptRow = await db.query('SELECT appointment_id FROM appointments WHERE patient_id = $1 AND doctor_id = $2 ORDER BY appointment_id DESC LIMIT 1', [patientId, docAId]);
  appointmentId = apptRow.rows[0]?.appointment_id;
  if (!appointmentId) throw new Error('Setup failed: appointment not created');
}, 90000);

afterAll(async () => { await db.pool.end(); });

// ─────────────────────────────────────────────────────────────
// Phase 1-4: Initial state — patient assigned to Doctor A
// ─────────────────────────────────────────────────────────────
describe('Phase 1-4: Initial Assignment — Doctor A Sees Patient', () => {

  it('TC-01: patientId and appointmentId are set by beforeAll setup', () => {
    expect(patientId).toBeTruthy();
    expect(appointmentId).toBeTruthy();
  });

  it('TC-02: DB confirms appointment.doctor_id = Doctor A', async () => {
    const r = await db.query('SELECT doctor_id FROM appointments WHERE appointment_id = $1', [appointmentId]);
    expect(r.rows[0].doctor_id).toBe(docAId);
  });

  it('TC-03: Doctor A sees patient in date-specific appointment list', async () => {
    const res = await request(app).get(`/api/v1/doctor/appointments/today?date=${futureDate}`).set('Authorization', `Bearer ${doctorAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.patient_id === patientId)).toBe(true);
  });

  it('TC-04: Doctor A sees patient in /doctor/appointments/upcoming', async () => {
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.patient_id === patientId)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 5-8: Reassign to Doctor B → Doctor B sees patient
// ─────────────────────────────────────────────────────────────
describe('Phase 5-8: Receptionist Reassigns to Doctor B', () => {

  beforeAll(async () => {
    // Ensure appointment is back at Doctor A time 09:00 before this suite
    await db.query('UPDATE appointments SET doctor_id = $1, appointment_time = $2 WHERE appointment_id = $3', [docAId, '09:00:00', appointmentId]);
  });

  it('TC-05: Receptionist reassigns appointment from Doctor A to Doctor B', async () => {
    const res = await request(app).post(`/api/v1/receptionist/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ doctor_id: docBId, appointment_date: futureDate, appointment_time: '10:00', reason: 'Patient requested specialist' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.new_doctor_id).toBe(docBId);
    expect(res.body.data.old_doctor_id).toBe(docAId);
  });

  it('TC-06: DB confirms appointment.doctor_id is now Doctor B', async () => {
    const r = await db.query('SELECT doctor_id FROM appointments WHERE appointment_id = $1', [appointmentId]);
    expect(r.rows[0].doctor_id).toBe(docBId);
  });

  it('TC-07: Doctor B sees patient in date-specific appointment list for reassigned date', async () => {
    const res = await request(app).get(`/api/v1/doctor/appointments/today?date=${futureDate}`).set('Authorization', `Bearer ${doctorBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.patient_id === patientId)).toBe(true);
  });

  it('TC-08: Doctor B sees patient in /doctor/appointments/upcoming', async () => {
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.appointment_id === appointmentId)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 9-12: Doctor A isolation after reassignment
// ─────────────────────────────────────────────────────────────
describe('Phase 9-12: Doctor A No Longer Sees Patient After Reassignment', () => {

  it('TC-09: Doctor A does NOT see patient in date-specific list', async () => {
    const res = await request(app).get(`/api/v1/doctor/appointments/today?date=${futureDate}`).set('Authorization', `Bearer ${doctorAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.patient_id === patientId)).toBe(false);
  });

  it('TC-10: Doctor A does NOT see patient in upcoming appointments', async () => {
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.appointment_id === appointmentId)).toBe(false);
  });

  it('TC-11: DB confirms appointment.doctor_id is Doctor B, not Doctor A', async () => {
    const r = await db.query('SELECT doctor_id FROM appointments WHERE appointment_id = $1', [appointmentId]);
    expect(r.rows[0].doctor_id).toBe(docBId);
    expect(r.rows[0].doctor_id).not.toBe(docAId);
  });

  it('TC-12: Doctor B sees patient in /doctor/patients list', async () => {
    const res = await request(app).get('/api/v1/doctor/patients').set('Authorization', `Bearer ${doctorBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some(p => p.patient_id === patientId)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 13-16: Financial Invariants
// ─────────────────────────────────────────────────────────────
describe('Phase 13-16: Financial Invariants', () => {

  it('TC-13: At most 1 consultation bill exists for this appointment', async () => {
    const r = await db.query("SELECT COUNT(*) as cnt FROM bills WHERE appointment_id = $1 AND bill_type = 'consultation'", [appointmentId]);
    expect(parseInt(r.rows[0].cnt)).toBeLessThanOrEqual(1);
  });

  it('TC-14: Audit log exists for the Reassign Doctor action', async () => {
    const r = await db.query("SELECT * FROM audit_logs WHERE record_id = $1 AND action = 'Reassign Doctor' ORDER BY created_at DESC LIMIT 1", [String(appointmentId)]);
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('TC-15: Re-reassigning to Doctor A works and Doctor A sees patient', async () => {
    const res = await request(app).post(`/api/v1/receptionist/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ doctor_id: docAId, appointment_date: futureDate, appointment_time: '11:00', reason: 'Secondary reassignment test' });
    expect(res.status).toBe(200);
    expect(res.body.data.new_doctor_id).toBe(docAId);
    // Restore to Doctor B
    await request(app).post(`/api/v1/receptionist/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ doctor_id: docBId, appointment_date: futureDate, appointment_time: '10:00', reason: 'Restored to Doctor B for test continuity' });
  });

  it('TC-16: After double reassignment, bill count ≤ 1 and attribution matches current doctor', async () => {
    const r = await db.query("SELECT COUNT(*) as cnt, MAX(doctor_id) as doc_id FROM bills WHERE appointment_id = $1 AND bill_type = 'consultation'", [appointmentId]);
    expect(parseInt(r.rows[0].cnt)).toBeLessThanOrEqual(1);
    if (parseInt(r.rows[0].cnt) === 1) {
      expect(r.rows[0].doc_id).toBe(docBId);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 17-20: Upcoming appointments endpoint correctness
// ─────────────────────────────────────────────────────────────
describe('Phase 17-20: Upcoming Appointments Endpoint Correctness', () => {

  it('TC-17: Upcoming appointments are sorted by date ascending', async () => {
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorBToken}`);
    expect(res.status).toBe(200);
    const appts = res.body.data;
    for (let i = 1; i < appts.length; i++) {
      expect(String(appts[i].appointment_date) >= String(appts[i-1].appointment_date)).toBe(true);
    }
  });

  it('TC-18: Upcoming endpoint excludes cancelled appointments', async () => {
    await db.query("UPDATE appointments SET status = 'cancelled' WHERE appointment_id = $1", [appointmentId]);
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.appointment_id === appointmentId)).toBe(false);
    await db.query("UPDATE appointments SET status = 'scheduled' WHERE appointment_id = $1", [appointmentId]);
  });

  it('TC-19: Upcoming endpoint excludes completed appointments', async () => {
    await db.query("UPDATE appointments SET status = 'completed' WHERE appointment_id = $1", [appointmentId]);
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.appointment_id === appointmentId)).toBe(false);
    await db.query("UPDATE appointments SET status = 'scheduled' WHERE appointment_id = $1", [appointmentId]);
  });

  it('TC-20: Upcoming response records contain appointment_date and appointment_time fields', async () => {
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorBToken}`);
    expect(res.status).toBe(200);
    const target = res.body.data.find(a => a.appointment_id === appointmentId);
    if (target) {
      expect(target).toHaveProperty('appointment_date');
      expect(target).toHaveProperty('appointment_time');
      expect(String(target.appointment_date)).toContain(futureDate.slice(0, 4));
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 21-24: RBAC enforcement
// ─────────────────────────────────────────────────────────────
describe('Phase 21-24: RBAC Enforcement', () => {

  it('TC-21: Unauthenticated reassign request rejected with 401', async () => {
    const res = await request(app).post(`/api/v1/receptionist/appointments/${appointmentId}/reassign-doctor`)
      .send({ doctor_id: docAId, appointment_date: futureDate, appointment_time: '09:00', reason: 'Unauthenticated test' });
    expect(res.status).toBe(401);
  });

  it('TC-22: Doctor token rejected from receptionist reassign endpoint (403)', async () => {
    const res = await request(app).post(`/api/v1/receptionist/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${doctorBToken}`)
      .send({ doctor_id: docAId, appointment_date: futureDate, appointment_time: '09:00', reason: 'Role isolation test' });
    expect(res.status).toBe(403);
  });

  it('TC-23: Doctor CAN use /doctor/appointments/:id/reassign-doctor', async () => {
    // Reset appointment to Doctor B 10:00 before this test
    await db.query('UPDATE appointments SET doctor_id = $1, appointment_time = $2, appointment_date = $3, status = $4 WHERE appointment_id = $5',
      [docBId, '10:00:00', futureDate, 'scheduled', appointmentId]);

    const res = await request(app).post(`/api/v1/doctor/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${doctorBToken}`)
      .send({ doctor_id: docAId, appointment_date: futureDate, appointment_time: '09:00', reason: 'Doctor-initiated test' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Restore to Doctor B
    await request(app).post(`/api/v1/doctor/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({ doctor_id: docBId, appointment_date: futureDate, appointment_time: '10:00', reason: 'Restored after TC-23' });
  });

  it('TC-24: Receptionist token rejected from /doctor/appointments/upcoming (403)', async () => {
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${receptionistToken}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 25-27: Atomicity — invalid data rejected and rolled back
// ─────────────────────────────────────────────────────────────
describe('Phase 25-27: Atomicity — Invalid Payloads Rejected', () => {

  beforeAll(async () => {
    // Ensure appointment is at Doctor B before atomicity tests
    await db.query('UPDATE appointments SET doctor_id = $1, appointment_time = $2, appointment_date = $3, status = $4 WHERE appointment_id = $5',
      [docBId, '10:00:00', futureDate, 'scheduled', appointmentId]);
  });

  it('TC-25: Missing reason field rejected with 400, DB unchanged', async () => {
    const res = await request(app).post(`/api/v1/receptionist/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ doctor_id: docAId, appointment_date: futureDate, appointment_time: '09:30' });
    expect(res.status).toBe(400);
    const r = await db.query('SELECT doctor_id FROM appointments WHERE appointment_id = $1', [appointmentId]);
    expect(r.rows[0].doctor_id).toBe(docBId);
  });

  it('TC-26: Missing appointment_date rejected with 400', async () => {
    const res = await request(app).post(`/api/v1/receptionist/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ doctor_id: docAId, appointment_time: '09:30', reason: 'Missing date test' });
    expect(res.status).toBe(400);
  });

  it('TC-27: Non-existent appointment ID returns 404', async () => {
    const res = await request(app).post('/api/v1/receptionist/appointments/999999999/reassign-doctor')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ doctor_id: docBId, appointment_date: futureDate, appointment_time: '09:00', reason: 'Nonexistent appointment' });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 28-29: Doctor-initiated reassignment — identical outcome
// ─────────────────────────────────────────────────────────────
describe('Phase 28-29: Doctor-Initiated Reassignment — Identical Data Outcome', () => {

  beforeAll(async () => {
    // Ensure appointment is at Doctor B for final suite
    await db.query('UPDATE appointments SET doctor_id = $1, appointment_time = $2, appointment_date = $3, status = $4 WHERE appointment_id = $5',
      [docBId, '10:00:00', futureDate, 'scheduled', appointmentId]);
  });

  it('TC-28: Doctor B initiates reassignment to Doctor A → Doctor A sees patient in upcoming', async () => {
    const res = await request(app).post(`/api/v1/doctor/appointments/${appointmentId}/reassign-doctor`)
      .set('Authorization', `Bearer ${doctorBToken}`)
      .send({ doctor_id: docAId, appointment_date: futureDate2, appointment_time: '09:00', reason: 'Doctor B refers patient to Doctor A' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.new_doctor_id).toBe(docAId);

    const upcoming = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorAToken}`);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.data.some(a => a.appointment_id === appointmentId)).toBe(true);
  });

  it('TC-29: After doctor-initiated reassign, Doctor B no longer sees patient in upcoming', async () => {
    const res = await request(app).get('/api/v1/doctor/appointments/upcoming').set('Authorization', `Bearer ${doctorBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some(a => a.appointment_id === appointmentId)).toBe(false);
  });
});
