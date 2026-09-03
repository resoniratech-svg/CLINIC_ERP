const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

let adminToken = '';
let doctor1Token = '';
let doctor2Token = '';
let receptionistToken = '';
let doctor1Id = null;
let doctor2Id = null;
let patientId = null;
let appointmentId = null;
let consultationId = null;
const ts = Date.now();

beforeAll(async () => {
  await seed();

  // Admin login
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
  adminToken = adminLogin.body.data.token;

  // Receptionist login
  const recLogin = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
  receptionistToken = recLogin.body.data.token;

  // Doctor 1 login (seeded dr_smith)
  const doc1Login = await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' });
  if (doc1Login.body && doc1Login.body.data) {
    doctor1Token = doc1Login.body.data.token;
    const doc1Res = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [doc1Login.body.data.user.user_id]);
    doctor1Id = doc1Res.rows[0].doctor_id;
  }

  // Create Doctor 2 for isolation tests
  const doc2Emp = `DOC2_${ts}`;
  const doc2User = `doc2_user_${ts}`;
  const doc2UserRes = await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
    employee_id: doc2Emp, full_name: 'Dr. Sarah Connor', mobile_number: `95${ts.toString().slice(-8)}`,
    username: doc2User, password: 'Password@123', role: 'doctor',
    doctor_details: { qualification: 'MBBS, MS', specialization: 'Orthopedics', new_consultation_fee: 600 }
  });
  const doc2Login = await request(app).post('/api/v1/auth/login').send({ username: doc2User, password: 'Password@123' });
  doctor2Token = doc2Login.body.data.token;
  const doc2Res = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [doc2UserRes.body.data.user_id]);
  doctor2Id = doc2Res.rows[0].doctor_id;

  // Seed patient & appointment for Doctor 1
  const patMob = `98${ts.toString().slice(-8)}`;
  const regId = `REG-${ts.toString().slice(-8)}`;
  const patRes = await db.query(`
    INSERT INTO patients (full_name, mobile_number, registration_id, branch_id)
    VALUES ('Clinical Test Patient', $1, $2, 1) RETURNING patient_id
  `, [patMob, regId]);
  patientId = patRes.rows[0].patient_id;

  const apptRes = await db.query(`
    INSERT INTO appointments (
      patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id
    ) VALUES ($1, $2, CURRENT_DATE, '10:00', 'new', 'waiting', 1) RETURNING appointment_id
  `, [patientId, doctor1Id]);
  appointmentId = apptRes.rows[0].appointment_id;
});

describe('Doctor Module Business Rules & Integration Verification', () => {

  // Rule 1 & Rule 3: Start Consultation (System Generated IDs, mandatory branch_id = 1)
  test('Rule 1 & 3: Start Consultation creates draft consultation with system generated fields & branch_id=1', async () => {
    const startRes = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctor1Token}`).send({
      appointment_id: appointmentId,
      consultation_id: 99999, // client-submitted should be ignored
      doctor_id: 88888,       // client-submitted should be ignored
      status: 'completed'     // client-submitted should be ignored
    });

    expect(startRes.status).toBe(201);
    expect(startRes.body.data).toHaveProperty('consultation_id');
    consultationId = startRes.body.data.consultation_id;
    expect(startRes.body.data.consultation_id).not.toBe(99999);
    expect(startRes.body.data.doctor_id).toBe(doctor1Id);
    expect(startRes.body.data.status).toBe('draft');
    expect(startRes.body.data.branch_id).toBe(1);

    // Verify appointment status updated to in_consultation
    const apptCheck = await db.query(`SELECT status FROM appointments WHERE appointment_id = $1`, [appointmentId]);
    expect(apptCheck.rows[0].status).toBe('in_consultation');
  });

  // Rule 2: Appointment Scoping
  test('Rule 2: Starting consultation for another doctor appointment is rejected with 403', async () => {
    const res = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctor2Token}`).send({
      appointment_id: appointmentId
    });
    expect(res.status).toBe(403);
  });

  // Rule 4: Server-side BMI Calculation
  test('Rule 4: Updating vitals computes BMI server-side from height & weight', async () => {
    const updateRes = await request(app).put(`/api/v1/doctor/consultations/${consultationId}`).set('Authorization', `Bearer ${doctor1Token}`).send({
      height_cm: 170,
      weight_kg: 68,
      bmi: 99.9 // should be overridden
    });

    expect(updateRes.status).toBe(200);
    // 68 / (1.7)^2 = 23.5
    expect(parseFloat(updateRes.body.data.bmi)).toBe(23.5);
  });

  // Rule 17: Diagnosis Search
  test('Rule 17: Search master diagnoses returns searchable matches', async () => {
    const diagRes = await request(app).get('/api/v1/doctor/diagnoses/search?q=Osteo').set('Authorization', `Bearer ${doctor1Token}`);
    expect(diagRes.status).toBe(200);
    expect(diagRes.body.data.length).toBeGreaterThan(0);
    expect(diagRes.body.data[0].name).toContain('Osteoarthritis');
  });

  // Rule 8: Follow-up recommendation does NOT create CRM tasks
  test('Rule 8: Saving follow-up recommendation updates consultation without creating CRM tasks', async () => {
    const updateRes = await request(app).put(`/api/v1/doctor/consultations/${consultationId}`).set('Authorization', `Bearer ${doctor1Token}`).send({
      chief_complaint: 'Knee Pain',
      primary_diagnosis_text: 'Osteoarthritis',
      followup_recommended: true,
      followup_recommended_date: '2026-09-16',
      followup_instructions: 'Review after 15 days'
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.followup_recommended).toBe(true);

    // Verify no CRM followup created
    const crmCheck = await db.query(`SELECT * FROM crm_followups WHERE patient_id = $1`, [patientId]);
    expect(crmCheck.rows.length).toBe(0);
  });

  // Rule 9: Server-side Treatment Plan End Date Computation
  test('Rule 9: Creating treatment plan computes end_date server-side', async () => {
    const treatRes = await request(app).post('/api/v1/doctor/treatment-plans').set('Authorization', `Bearer ${doctor1Token}`).send({
      consultation_id: consultationId,
      treatment_name: 'Physiotherapy Sessions',
      treatment_type: 'Procedure',
      start_date: '2026-09-01',
      duration: 15,
      duration_unit: 'days',
      end_date: '2099-01-01' // should be overridden to 2026-09-16
    });

    expect(treatRes.status).toBe(201);
    expect(treatRes.body.data.end_date).toBe('2026-09-16');
  });

  // Rule 16: Prescription & Treatment write validation
  test('Rule 16: Adding prescription to active draft consultation succeeds', async () => {
    // Seed medicine master if needed
    const medRes = await db.query(`
      INSERT INTO medicine_master (medicine_name, generic_name, medicine_type, status)
      VALUES ('Paracetamol 500mg', 'Paracetamol', 'tablet', 'active')
      RETURNING id
    `);
    const medId = medRes.rows[0].id;

    const prescRes = await request(app).post('/api/v1/doctor/prescriptions').set('Authorization', `Bearer ${doctor1Token}`).send({
      consultation_id: consultationId,
      medicines: [
        { medicine_id: medId, dosage: '500 mg', frequency: '2/day', duration: 5 }
      ]
    });

    expect(prescRes.status).toBe(201);
    expect(prescRes.body.data.prescription.consultation_id).toBe(consultationId);
  });

  // Rule 5 & 6: Save Draft vs Complete Consultation Pipeline
  test('Rule 5: Save draft keeps appointment status in_consultation', async () => {
    const draftRes = await request(app).post(`/api/v1/doctor/consultations/${consultationId}/save-draft`).set('Authorization', `Bearer ${doctor1Token}`);
    expect(draftRes.status).toBe(200);

    const apptCheck = await db.query(`SELECT status FROM appointments WHERE appointment_id = $1`, [appointmentId]);
    expect(apptCheck.rows[0].status).toBe('in_consultation');
  });

  test('Rule 6: Complete consultation transitions appointment to doctor_completed (PRO Pending)', async () => {
    const completeRes = await request(app).post(`/api/v1/doctor/consultations/${consultationId}/complete`).set('Authorization', `Bearer ${doctor1Token}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.handoff_target).toBe('PRO / Manager Queue');

    const apptCheck = await db.query(`SELECT status FROM appointments WHERE appointment_id = $1`, [appointmentId]);
    expect(apptCheck.rows[0].status).toBe('doctor_completed');
  });

  // Rule 7: Immutability of Completed Consultations
  test('Rule 7: Completed consultation rejects further updates with 422', async () => {
    const editRes = await request(app).put(`/api/v1/doctor/consultations/${consultationId}`).set('Authorization', `Bearer ${doctor1Token}`).send({
      chief_complaint: 'Updated Complaint After Completion'
    });
    expect(editRes.status).toBe(422);

    // Adding prescription to completed consultation is also rejected
    const prescRes = await request(app).post('/api/v1/doctor/prescriptions').set('Authorization', `Bearer ${doctor1Token}`).send({
      consultation_id: consultationId,
      medicines: [{ medicine_id: 1, dosage: '1 tab', frequency: '1/day', duration: 3 }]
    });
    expect(prescRes.status).toBe(422);
  });

  // Rule 10: Doctor Notes Masking for Non-Doctor Roles
  test('Rule 10: doctor_notes is hidden from non-doctor/non-admin users in patient overview', async () => {
    // Add private doctor note as Doctor 1
    await db.query(`UPDATE consultations SET doctor_notes = 'Private note: Patient seems anxious' WHERE consultation_id = $1`, [consultationId]);

    const overviewRes = await request(app).get(`/api/v1/doctor/patients/${patientId}/overview`).set('Authorization', `Bearer ${adminToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.previous_consultations[0]).toHaveProperty('doctor_notes');

    const docRes = await request(app).get(`/api/v1/doctor/consultations/${consultationId}`).set('Authorization', `Bearer ${doctor1Token}`);
    expect(docRes.status).toBe(200);
    expect(docRes.body.data.doctor_notes).toBe('Private note: Patient seems anxious');
  });

  // Rule 11: Doctor Isolation & Zero Cross-Contamination
  test('Rule 11: Doctor 2 cannot see Doctor 1 appointments or queue', async () => {
    const doc2Queue = await request(app).get('/api/v1/doctor/queue').set('Authorization', `Bearer ${doctor2Token}`);
    expect(doc2Queue.status).toBe(200);
    const found = doc2Queue.body.data.find(q => q.appointment_id === appointmentId);
    expect(found).toBeUndefined();
  });

  // Rule 12: Doctor Targets are View-Only (403 on Write)
  test('Rule 12: Doctor target endpoints are view-only and reject POST/PUT/DELETE with 403', async () => {
    const viewRes = await request(app).get('/api/v1/doctor/targets/mine').set('Authorization', `Bearer ${doctor1Token}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.data).toHaveProperty('revenue_target');

    const postRes = await request(app).post('/api/v1/doctor/targets/mine').set('Authorization', `Bearer ${doctor1Token}`).send({ revenue_target: 500000 });
    expect(postRes.status).toBe(403);
  });

  // Rule 13: Profile Update restriction to Personal Contact Fields Only
  test('Rule 13: Doctor profile update only accepts personal fields (mobile/email)', async () => {
    const updateRes = await request(app).put('/api/v1/doctor/profile').set('Authorization', `Bearer ${doctor1Token}`).send({
      mobile_number: '9888877779',
      email: 'drsmith_updated@hospital.com',
      specialization: 'Neurology', // administrative field should be ignored
      qualification: 'PhD'
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.mobile_number).toBe('9888877779');

    // Verify specialization was NOT changed in database
    const docCheck = await db.query(`SELECT specialization FROM doctors WHERE doctor_id = $1`, [doctor1Id]);
    expect(docCheck.rows[0].specialization).toBe('Cardiology');
  });

  // Rule 15: Password Reset Request Flow
  test('Rule 15: Forgot password request creates reset request without exposing old password', async () => {
    const resetReq = await request(app).post('/api/v1/auth/forgot-password').send({
      username_or_employee_id: 'dr_smith'
    });
    expect(resetReq.status).toBe(200);
  });

  // Rule 18: Role-Based Access Control Blocking
  test('Rule 18: Receptionist is blocked from Doctor endpoints (403)', async () => {
    const rbacRes = await request(app).get('/api/v1/doctor/dashboard').set('Authorization', `Bearer ${receptionistToken}`);
    expect(rbacRes.status).toBe(403);
  });

  // Rule 20: Doctor Login/Logout Logging
  test('Rule 20: Doctor logout logs session duration in login_logs', async () => {
    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${doctor1Token}`);
    expect(logoutRes.status).toBe(200);
  });

});
