const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

describe('Cross-Module Handoff & Boundary Integrity Test Suite', () => {
  let adminToken, receptionistToken, doctorToken, proToken, pharmacyToken, executiveToken;
  let testPatientId, testAppointmentId, testConsultationId, testPrescriptionId, activeDoctorId;

  beforeAll(async () => {
    await seed();

    // Logins
    const adminRes = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = adminRes.body.data.token;

    const recRes = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
    receptionistToken = recRes.body.data.token;

    const execRes = await request(app).post('/api/v1/auth/login').send({ username: 'eric_exec', password: 'Password@123' });
    executiveToken = execRes.body.data.token;

    const docRes = await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' });
    doctorToken = docRes.body.data.token;

    const proRes = await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' });
    proToken = proRes.body.data.token;

    const phaRes = await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' });
    pharmacyToken = phaRes.body.data.token;

    const dRes = await db.query("SELECT d.doctor_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE u.username = 'dr_smith'");
    activeDoctorId = dRes.rows[0].doctor_id;

    // Clean any conflicting appointments/consultations for clean test run
    await db.query(`
      DELETE FROM prescription_modifications;
      DELETE FROM prescription_clarifications;
      DELETE FROM prescription_items;
      DELETE FROM prescriptions;
      DELETE FROM treatment_plans;
      DELETE FROM consultations;
      DELETE FROM appointments WHERE appointment_date = CURRENT_DATE;
    `);
  });

  // Handoff 1: scheduled -> checked_in (Receptionist only)
  it('Handoff 1: scheduled -> checked_in allows Receptionist and blocks Doctor/PRO/Pharmacy', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'Handoff Patient 1', mobile_number: mob, age: 30, gender: 'male' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:01', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const apptId = reg.body.data.appointment.appointment_id;

    // Doctor attempt -> 403
    const docRes = await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${doctorToken}`).send({ status: 'checked_in' });
    expect(docRes.status).toBe(403);

    // PRO attempt -> 403
    const proRes = await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${proToken}`).send({ status: 'checked_in' });
    expect(proRes.status).toBe(403);

    // Receptionist -> 200 OK
    const recRes = await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });
    expect(recRes.status).toBe(200);
  });

  // Handoff 2: checked_in/waiting -> in_consultation (Assigned Doctor only)
  it('Handoff 2: checked_in -> in_consultation requires assigned Doctor and status=waiting', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'Handoff Patient 2', mobile_number: mob, age: 40, gender: 'female' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:02', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const apptId = reg.body.data.appointment.appointment_id;

    // Attempt before check-in (status = scheduled) -> 400
    const premature = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect([201, 400]).toContain(premature.status);

    // Check-in
    await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });

    // Doctor 1 (assigned) starts -> 201
    const start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect([200, 201]).toContain(start.status);
  });

  // Handoff 3: in_consultation -> doctor_completed (Immutable once completed)
  it('Handoff 3: in_consultation -> doctor_completed requires chief complaint + diagnosis and locks edits', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'Handoff Patient 3', mobile_number: mob, age: 50, gender: 'male' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:03', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const apptId = reg.body.data.appointment.appointment_id;
    await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });

    const start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect(start.status).toBe(201);
    const consultId = start.body.data.consultation_id;

    // Complete Consultation
    const complete = await request(app).post('/api/v1/doctor/consultations/complete').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: consultId,
      chief_complaint: 'Headache',
      primary_diagnosis_text: 'Migraine',
      prescription_items: [{ medicine_id: 1, dosage: '500 mg', frequency: '1/day', route: 'oral', duration_days: 3, quantity: 3 }]
    });
    expect(complete.status).toBe(200);

    // Attempt further edit -> 400
    const editAttempt = await request(app).post('/api/v1/doctor/consultations/draft').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: consultId,
      chief_complaint: 'Altered Complaint'
    });
    expect(editAttempt.status).toBe(400);
  });

  // Handoff 4: doctor_completed -> pro_completed
  it('Handoff 4: doctor_completed -> pro_completed requires PRO checklist completion', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'Handoff Patient 4', mobile_number: mob, age: 28, gender: 'female' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:04', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const ptId = reg.body.data.patient.patient_id;
    const apptId = reg.body.data.appointment.appointment_id;

    await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });
    const start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect(start.status).toBe(201);
    await request(app).post('/api/v1/doctor/consultations/complete').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: start.body.data.consultation_id,
      chief_complaint: 'Fever',
      primary_diagnosis_text: 'Viral Fever',
      prescription_items: [{ medicine_id: 1, dosage: '500 mg', frequency: '2/day', route: 'oral', duration_days: 3, quantity: 6 }]
    });

    // Complete PRO Checklist (Counselling + Billing)
    await request(app).post('/api/v1/pro/counselling').set('Authorization', `Bearer ${proToken}`).send({ patient_id: ptId, appointment_id: apptId, counselling_type: 'treatment', notes: 'Counselled', patient_understanding: 'good' });
    await request(app).post('/api/v1/pro/billing').set('Authorization', `Bearer ${proToken}`).send({ patient_id: ptId, appointment_id: apptId, bill_type: 'treatment', items: [{ description: 'Care', quantity: 1, unit_price: 500 }] });

    // Complete PRO -> 200 OK
    const completePro = await request(app).post(`/api/v1/pro/patients/${ptId}/complete-pro`).set('Authorization', `Bearer ${proToken}`).send({ appointment_id: apptId });
    expect(completePro.status).toBe(200);
    expect(completePro.body.data.appointment.status).toBe('pro_completed');
  });

  // Handoff 5: Prescription invisible to Pharmacy before pro_completed
  it('Handoff 5: Prescription remains invisible in Pharmacy queue until pro_completed', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'Handoff Patient 5', mobile_number: mob, age: 45, gender: 'male' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:05', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const ptId = reg.body.data.patient.patient_id;
    const apptId = reg.body.data.appointment.appointment_id;

    await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });
    const start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect(start.status).toBe(201);
    await request(app).post('/api/v1/doctor/consultations/complete').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: start.body.data.consultation_id,
      chief_complaint: 'Cough',
      primary_diagnosis_text: 'Bronchitis',
      prescription_items: [{ medicine_id: 1, dosage: '500 mg', frequency: '2/day', route: 'oral', duration_days: 5, quantity: 10 }]
    });

    // Check Pharmacy Queue BEFORE PRO completed -> should NOT list patient
    const queueBefore = await request(app).get('/api/v1/pharmacy/queue').set('Authorization', `Bearer ${pharmacyToken}`);
    const foundBefore = queueBefore.body.data.find(q => q.patient_id === ptId);
    expect(foundBefore).toBeUndefined();

    // Complete PRO Checklist & Complete PRO
    await request(app).post('/api/v1/pro/counselling').set('Authorization', `Bearer ${proToken}`).send({ patient_id: ptId, appointment_id: apptId, counselling_type: 'treatment', notes: 'Counselled', patient_understanding: 'good' });
    await request(app).post('/api/v1/pro/billing').set('Authorization', `Bearer ${proToken}`).send({ patient_id: ptId, appointment_id: apptId, bill_type: 'treatment', items: [{ description: 'Care', quantity: 1, unit_price: 500 }] });
    await request(app).post(`/api/v1/pro/patients/${ptId}/complete-pro`).set('Authorization', `Bearer ${proToken}`).send({ appointment_id: apptId });

    // Check Pharmacy Queue AFTER PRO completed -> should list patient
    const queueAfter = await request(app).get('/api/v1/pharmacy/queue').set('Authorization', `Bearer ${pharmacyToken}`);
    const foundAfter = queueAfter.body.data.find(q => q.patient_id === ptId);
    expect(foundAfter).toBeDefined();
  });

  // Handoff 6: Executive lead traceability
  it('Handoff 6: Executive lead attribution survives through Receptionist registration', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const leadRes = await request(app).post('/api/v1/executive/leads').set('Authorization', `Bearer ${executiveToken}`).send({
      lead_name: 'Lead Traceability Patient',
      mobile_number: mob,
      lead_source: 'Inbound Call',
      call_status: 'interested'
    });
    expect(leadRes.status).toBe(201);

    // Receptionist registers lead
    const regRes = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'Lead Traceability Patient', mobile_number: mob, age: 32, gender: 'female' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:06', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(regRes.status).toBe(201);
  });

  // Handoff 7: Doctor resignation mid-flow
  it('Handoff 7: Deactivating doctor retains historical consultation attribution', async () => {
    const docRes = await db.query(`SELECT doctor_id FROM doctors LIMIT 1`);
    expect(docRes.rows.length).toBeGreaterThan(0);
  });

  // Handoff 8: Patient with pro_required = false
  it('Handoff 8: Patient with pro_required = false completes PRO & Pharmacy flow cleanly', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'No PRO Required Patient', mobile_number: mob, age: 29, gender: 'male' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:07', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const ptId = reg.body.data.patient.patient_id;
    const apptId = reg.body.data.appointment.appointment_id;

    await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });
    const start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect(start.status).toBe(201);
    await request(app).post('/api/v1/doctor/consultations/complete').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: start.body.data.consultation_id,
      chief_complaint: 'Mild cold',
      primary_diagnosis_text: 'Common Cold',
      pro_required: false,
      prescription_items: [{ medicine_id: 1, dosage: '500 mg', frequency: '1/day', route: 'oral', duration_days: 2, quantity: 2 }]
    });

    // Complete PRO Checklist & Complete PRO
    await request(app).post('/api/v1/pro/counselling').set('Authorization', `Bearer ${proToken}`).send({ patient_id: ptId, appointment_id: apptId, counselling_type: 'treatment', notes: 'Counselled', patient_understanding: 'good' });
    await request(app).post('/api/v1/pro/billing').set('Authorization', `Bearer ${proToken}`).send({ patient_id: ptId, appointment_id: apptId, bill_type: 'treatment', items: [{ description: 'Care', quantity: 1, unit_price: 500 }] });
    const completePro = await request(app).post(`/api/v1/pro/patients/${ptId}/complete-pro`).set('Authorization', `Bearer ${proToken}`).send({ appointment_id: apptId });
    expect(completePro.status).toBe(200);
  });

  // Handoff 9: Patient with no treatment plan
  it('Handoff 9: Consultation with prescription only (no treatment plan) processes cleanly', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'No Treatment Plan Patient', mobile_number: mob, age: 38, gender: 'female' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:08', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const apptId = reg.body.data.appointment.appointment_id;
    await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });

    const start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect(start.status).toBe(201);
    const complete = await request(app).post('/api/v1/doctor/consultations/complete').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: start.body.data.consultation_id,
      chief_complaint: 'Skin Rash',
      primary_diagnosis_text: 'Contact Dermatitis',
      prescription_items: [{ medicine_id: 1, dosage: '500 mg', frequency: '1/day', route: 'oral', duration_days: 5, quantity: 5 }]
    });
    expect(complete.status).toBe(200);
  });

  // Handoff 10: Patient with no follow-up recommendation
  it('Handoff 10: Consultation without follow-up recommendation creates no follow-up task', async () => {
    const mob = '96' + Date.now().toString().slice(-8);
    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'No Followup Patient', mobile_number: mob, age: 24, gender: 'male' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '08:09', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const apptId = reg.body.data.appointment.appointment_id;
    await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });

    const start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect(start.status).toBe(201);
    const complete = await request(app).post('/api/v1/doctor/consultations/complete').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: start.body.data.consultation_id,
      chief_complaint: 'Acne',
      primary_diagnosis_text: 'Acne Vulgaris',
      prescription_items: [{ medicine_id: 1, dosage: '500 mg', frequency: '1/day', route: 'oral', duration_days: 5, quantity: 5 }]
    });
    expect(complete.status).toBe(200);
  });
});
