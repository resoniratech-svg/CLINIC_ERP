const request = require('supertest');
const app = require('../src/app');
const seed = require('../src/db/seed');
const db = require('../src/db');

describe('PRO / Manager Module Business Rules Test Suite', () => {
  let adminToken;
  let proToken;
  let doctorToken;
  let recToken;
  let execToken;

  let patientId;
  let appointmentId;
  let consultationId;
  let prescriptionId;
  let prescriptionItemId;
  let doctorId = 100;

  beforeAll(async () => {
    await seed();

    // 1. Login Super Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = adminLogin.body.data.token;

    // 2. Login PRO Manager (pat_pro / Password@123)
    const proLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pat_pro', password: 'Password@123' });
    proToken = proLogin.body.data.token;

    // 3. Login Doctor (dr_smith / Password@123)
    const docLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'dr_smith', password: 'Password@123' });
    doctorToken = docLogin.body.data.token;

    // 4. Login Receptionist (rita_rec / Password@123)
    const recLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rita_rec', password: 'Password@123' });
    recToken = recLogin.body.data.token;

    // 5. Login Executive (eric_exec / Password@123)
    const execLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'eric_exec', password: 'Password@123' });
    execToken = execLogin.body.data.token;

    // Fetch dr_smith doctor_id
    const docUser = await db.query(`SELECT user_id FROM users WHERE username = 'dr_smith'`);
    const docUserId = docUser.rows[0].user_id;
    const dRes = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [docUserId]);
    doctorId = dRes.rows[0].doctor_id;

    const todayStr = new Date().toISOString().split('T')[0];
    const randMin = Math.floor(10 + Math.random() * 49);
    const randSec = Math.floor(10 + Math.random() * 49);
    const randTime = `23:${randMin}:${randSec}`;

    // 6. Seed Test Patient & Appointment
    const uniqueMob = '977' + Math.floor(1000000 + Math.random() * 9000000);

    const ptRes = await request(app)
      .post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${recToken}`)
      .send({
        full_name: 'PRO Test Patient',
        mobile_number: uniqueMob,
        gender: 'male',
        age: 40,
        address: 'Hyderabad',
        assigned_doctor_id: doctorId,
        appointment_date: todayStr,
        appointment_time: randTime,
        appointment_type: 'new'
      });

    if (ptRes.status !== 201) {
      console.log('ptRes failed:', ptRes.status, ptRes.body);
    }

    patientId = ptRes.body.data ? ptRes.body.data.patient_id : null;
    appointmentId = ptRes.body.data && ptRes.body.data.appointment ? ptRes.body.data.appointment.appointment_id : null;

    // Doctor starts consultation
    const startRes = await request(app)
      .post('/api/v1/doctor/consultations/start')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ appointment_id: appointmentId });

    if (!startRes.body.data) {
      console.log('startRes failed:', startRes.status, startRes.body);
    }

    consultationId = startRes.body.data ? startRes.body.data.consultation_id : null;

    // Doctor updates clinical consultation & creates prescription
    await request(app)
      .put(`/api/v1/doctor/consultations/${consultationId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        chief_complaint: 'Severe Knee Pain',
        primary_diagnosis_text: 'Osteoarthritis',
        doctor_notes: 'CONFIDENTIAL DOCTOR SECRET NOTES'
      });

    const prescRes = await request(app)
      .post('/api/v1/doctor/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        consultation_id: consultationId,
        medicines: [
          { medicine_id: 1, medicine_name: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', duration: 5, quantity: 10 }
        ]
      });
    prescriptionId = prescRes.body.data.prescription.id;
    prescriptionItemId = prescRes.body.data.items[0].id;

    // Doctor completes consultation
    await request(app)
      .post(`/api/v1/doctor/consultations/${consultationId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({});
  });

  // Rule 1: Single Branch Isolation (branch_id = 1)
  test('Rule 1: Single Branch Isolation — All PRO records carry branch_id = 1', async () => {
    const pkgRes = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        package_name: 'Annual Care Plan',
        package_type: 'monthly',
        from_date: '2026-09-01',
        package_amount: 10000,
        discount_amount: 1000,
        payment_status: 'pending'
      });

    expect(pkgRes.status).toBe(201);
    expect(pkgRes.body.data.branch_id).toBe(1);
    expect(parseFloat(pkgRes.body.data.final_amount)).toBe(9000);
  });

  // Rule 2: Bill Type Restrictions (Block consultation bill type)
  test('Rule 2: Bill Type Restrictions — Attempt to create bill_type = consultation is rejected with 403', async () => {
    const billRes = await request(app)
      .post('/api/v1/pro/bills')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        bill_type: 'consultation',
        items: [{ item_name: 'Consultation Fee', quantity: 1, unit_price: 500 }]
      });

    expect(billRes.status).toBe(403);
    expect(billRes.body.message).toContain('Forbidden');
  });

  // Rule 3: Server-Computed Monetary Math (Subtotal & Total Amount)
  test('Rule 3: Server-Computed Subtotal & Total Amount', async () => {
    const billRes = await request(app)
      .post('/api/v1/pro/bills')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        appointment_id: appointmentId,
        bill_type: 'treatment',
        discount_amount: 500,
        items: [
          { item_name: 'Physical Therapy Session', quantity: 2, unit_price: 1500 },
          { item_name: 'Knee Support Brace', quantity: 1, unit_price: 2000 }
        ]
      });

    expect(billRes.status).toBe(201);
    const bill = billRes.body.data;
    expect(parseFloat(bill.subtotal)).toBe(5000); // 2*1500 + 1*2000
    expect(parseFloat(bill.discount_amount)).toBe(500);
    expect(parseFloat(bill.total_amount)).toBe(4500); // 5000 - 500
  });

  // Rule 4 & 5: Package Server Computation & Dynamic To Date
  test('Rule 4 & 5: Package final_amount & to_date server computation', async () => {
    const pkgRes = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        package_name: 'Custom Package',
        package_type: 'custom',
        from_date: '2026-09-01',
        to_date: '2026-10-15',
        package_amount: 15000,
        discount_amount: 2000
      });

    expect(pkgRes.status).toBe(201);
    expect(parseFloat(pkgRes.body.data.final_amount)).toBe(13000);
    expect(pkgRes.body.data.to_date).toBe('2026-10-15');
  });

  // Rule 6: Partial Payment & Due Patient Record Creation
  test('Rule 6: Partial Payment creates due_patients record with remaining_due', async () => {
    const billRes = await request(app)
      .post('/api/v1/pro/bills')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        bill_type: 'treatment',
        discount_amount: 0,
        items: [{ item_name: 'Treatment Session', quantity: 1, unit_price: 6000 }]
      });

    const billId = billRes.body.data.bill_id;

    const payRes = await request(app)
      .post('/api/v1/pro/payments')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        bill_id: billId,
        amount: 4000,
        payment_method: 'cash'
      });

    expect(payRes.status).toBe(201);
    expect(payRes.body.data.updated_bill_status).toBe('partial');
    expect(payRes.body.data.remaining_due).toBe(2000);

    const dueCheck = await db.query(`SELECT * FROM due_patients WHERE bill_id = $1`, [billId]);
    expect(dueCheck.rows.length).toBe(1);
    expect(parseFloat(dueCheck.rows[0].due_amount)).toBe(2000);
  });

  // Rule 7 & 8: Doctor Target Realized Revenue Attribution & Refund Reversal
  test('Rule 7 & 8: Realized Revenue Target Attribution & Refund Reversal', async () => {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const tgtResBefore = await request(app)
      .get(`/api/v1/doctor/targets/mine?month=${month}&year=${year}`)
      .set('Authorization', `Bearer ${doctorToken}`);
    const initAchieved = tgtResBefore.body.data ? parseFloat(tgtResBefore.body.data.revenue_target.achieved) : 0;

    const billRes = await request(app)
      .post('/api/v1/pro/bills')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        doctor_id: doctorId,
        bill_type: 'other',
        items: [{ item_name: 'Specialized Test', quantity: 1, unit_price: 3000 }]
      });

    const billId = billRes.body.data.bill_id;

    const payRes = await request(app)
      .post('/api/v1/pro/payments')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        bill_id: billId,
        amount: 3000,
        payment_method: 'upi'
      });

    const paymentId = payRes.body.data.payments[0].payment_id;

    const tgtResAfter = await request(app)
      .get(`/api/v1/doctor/targets/mine?month=${month}&year=${year}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    const afterAchieved = parseFloat(tgtResAfter.body.data.revenue_target.achieved);
    expect(afterAchieved).toBeGreaterThanOrEqual(initAchieved + 3000);

    // Refund
    const refRes = await request(app)
      .post(`/api/v1/pro/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({});

    expect(refRes.status).toBe(200);

    const tgtResRefund = await request(app)
      .get(`/api/v1/doctor/targets/mine?month=${month}&year=${year}`)
      .set('Authorization', `Bearer ${doctorToken}`);
    const refundAchieved = parseFloat(tgtResRefund.body.data.revenue_target.achieved);
    expect(refundAchieved).toBe(initAchieved);
  });

  // Rule 9: Operational Prescription Modification (duration/quantity) Auto-Applies
  test('Rule 9: Operational Prescription Modification (quantity) applies immediately', async () => {
    const modRes = await request(app)
      .post(`/api/v1/pro/prescriptions/items/${prescriptionItemId}/modify`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        field_changed: 'quantity',
        modified_value: 15,
        reason: 'Patient extended course by 5 days'
      });

    expect(modRes.status).toBe(201);
    expect(modRes.body.data.status).toBe('applied');

    const itemCheck = await db.query(`SELECT quantity FROM prescription_items WHERE id = $1`, [prescriptionItemId]);
    expect(itemCheck.rows[0].quantity).toBe(15);
  });

  // Rule 10 & 11: Clinical Prescription Modification & Doctor Approval Flow
  test('Rule 10 & 11: Clinical Modification creates pending status & Doctor Decision updates item', async () => {
    const modRes = await request(app)
      .post(`/api/v1/pro/prescriptions/items/${prescriptionItemId}/modify`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        field_changed: 'dosage',
        modified_value: '650mg',
        reason: 'Increase dosage for acute pain relief'
      });

    expect(modRes.status).toBe(201);
    expect(modRes.body.data.status).toBe('pending_doctor_confirmation');

    const modId = modRes.body.data.id;

    // Item dosage should NOT change yet!
    const itemBefore = await db.query(`SELECT dosage FROM prescription_items WHERE id = $1`, [prescriptionItemId]);
    expect(itemBefore.rows[0].dosage).toBe('500mg');

    // PRO calling decision endpoint should be rejected 403
    const proCall = await request(app)
      .post(`/api/v1/doctor/prescription-modifications/${modId}/decision`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({ decision: 'approved' });
    expect(proCall.status).toBe(403);

    // Doctor approves
    const docApprove = await request(app)
      .post(`/api/v1/doctor/prescription-modifications/${modId}/decision`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ decision: 'approved' });

    expect(docApprove.status).toBe(200);
    expect(docApprove.body.data.status).toBe('approved');

    // Item dosage should now be updated!
    const itemAfter = await db.query(`SELECT dosage FROM prescription_items WHERE id = $1`, [prescriptionItemId]);
    expect(itemAfter.rows[0].dosage).toBe('650mg');
  });

  // Rule 12 & 13: Cash Closing Balance vs Grand Total
  test('Rule 12 & 13: Cash Closing Balance vs Grand Total distinction', async () => {
    const today = new Date().toISOString().split('T')[0];

    const billRes = await request(app)
      .post('/api/v1/pro/bills')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        bill_type: 'other',
        items: [{ item_name: 'Multi-mode Bill', quantity: 1, unit_price: 10000 }]
      });

    const billId = billRes.body.data.bill_id;

    // Pay 5000 Cash + 5000 Card
    await request(app)
      .post('/api/v1/pro/payments')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        bill_id: billId,
        payments: [
          { amount: 5000, payment_method: 'cash' },
          { amount: 5000, payment_method: 'card' }
        ]
      });

    // Record cash expense
    await request(app)
      .post('/api/v1/pro/accountant/expenditure')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        category: 'Office Stationery',
        description: 'Papers and Pens',
        amount: 500
      });

    const summaryRes = await request(app)
      .get(`/api/v1/pro/accountant/daily-summary?date=${today}`)
      .set('Authorization', `Bearer ${proToken}`);

    expect(summaryRes.status).toBe(200);
    const data = summaryRes.body.data;

    // Cash Closing = Cash Rev (>=5000) - Cash Exp (500)
    expect(data.cash_revenue).toBeGreaterThanOrEqual(5000);
    expect(data.cash_expenditure).toBeGreaterThanOrEqual(500);
    expect(data.grand_total).toBeGreaterThanOrEqual(10000);
    expect(data.grand_total).not.toEqual(data.closing_cash);
  });

  // Rule 14 & 15: PRO Completion Checklist & Pharmacy Handoff
  test('Rule 14 & 15: PRO Completion validates checklist & releases to Pharmacy queue', async () => {
    // Check checklist
    const chkRes = await request(app)
      .get(`/api/v1/pro/patients/${patientId}/pro-checklist`)
      .set('Authorization', `Bearer ${proToken}`);

    expect(chkRes.status).toBe(200);

    // Create counselling record to satisfy checklist
    await request(app)
      .post('/api/v1/pro/counselling')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        counselling_type: 'treatment',
        notes: 'Explained 15-day therapy plan and dietary advice',
        patient_understanding: 'good'
      });

    // Complete PRO
    const compRes = await request(app)
      .post(`/api/v1/pro/patients/${patientId}/complete-pro`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({});

    expect(compRes.status).toBe(200);
    expect(compRes.body.data.pharmacy_queue_status).toBe('unlocked');

    const apptCheck = await db.query(`SELECT status FROM appointments WHERE appointment_id = $1`, [appointmentId]);
    expect(apptCheck.rows[0].status).toBe('pro_completed');
  });

  // Rule 16: CRM Task Assignment Block (Executive blocked)
  test('Rule 16: Attempting to assign CRM follow-up to Executive role returns 403', async () => {
    const execUser = await db.query(`SELECT user_id FROM users WHERE username = 'eric_exec'`);
    const execUserId = execUser.rows[0].user_id;

    const folRes = await request(app)
      .post('/api/v1/pro/followups')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        followup_type: 'treatment',
        followup_date: '2026-09-20',
        purpose: 'Post-treatment review',
        assigned_to: execUserId
      });

    expect(folRes.status).toBe(403);
    expect(folRes.body.message).toContain('Forbidden');
  });

  // Rule 17: Dynamic Package Expiry in Renewal Queue
  test('Rule 17: Dynamic Package Expiry surfaces active packages in renewal queue', async () => {
    // Create an expired active package in DB
    await db.query(`
      INSERT INTO packages (
        patient_id, package_name, package_type, from_date, to_date, package_amount, discount_amount, final_amount, status, created_by, branch_id
      ) VALUES ($1, 'Expired Monthly Pack', 'monthly', '2026-07-01', '2026-07-31', 5000, 0, 5000, 'active', 1, 1)
    `, [patientId]);

    const renRes = await request(app)
      .get('/api/v1/pro/renewals/queue')
      .set('Authorization', `Bearer ${proToken}`);

    expect(renRes.status).toBe(200);
    expect(renRes.body.data.expired_packages.length).toBeGreaterThan(0);
  });

  // Rule 18 & 18a: RBAC & Private Doctor Notes Masking
  test('Rule 18 & 18a: RBAC blocks non-PRO roles & doctor_notes is masked in patient overview', async () => {
    // Non-PRO user calling PRO endpoint
    const nonProCall = await request(app)
      .get('/api/v1/pro/dashboard')
      .set('Authorization', `Bearer ${recToken}`);

    expect(nonProCall.status).toBe(403);

    // PRO user viewing patient overview
    const overRes = await request(app)
      .get(`/api/v1/pro/patients/${patientId}/overview`)
      .set('Authorization', `Bearer ${proToken}`);

    expect(overRes.status).toBe(200);
    const consultData = overRes.body.data.consultation;
    if (consultData) {
      expect(consultData.doctor_notes).toBeUndefined();
    }
  });

  // Rule 19: Reusable Audit Logging
  test('Rule 19: Mutating PRO actions create audit_logs with role = pro_manager', async () => {
    const feedbackRes = await request(app)
      .post('/api/v1/pro/feedback')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        category_type: 'pro_experience',
        description: 'Very helpful counselling and clear package pricing explanation',
        rating: 5
      });

    expect(feedbackRes.status).toBe(201);

    const auditCheck = await db.query(`
      SELECT * FROM audit_logs WHERE role = 'pro_manager' AND module = 'PRO Feedback' ORDER BY id DESC LIMIT 1
    `);

    expect(auditCheck.rows.length).toBe(1);
  });

  // Edge Case 1: Custom Package missing to_date returns 400
  test('Edge Case 1: Custom package type requires to_date parameter', async () => {
    const pkgRes = await request(app)
      .post('/api/v1/pro/packages')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        package_name: 'Invalid Custom Package',
        package_type: 'custom',
        from_date: '2026-09-01',
        package_amount: 5000
      });

    expect(pkgRes.status).toBe(400);
    expect(pkgRes.body.message).toContain('to_date is required');
  });

  // Edge Case 2: Empty items in Bill creation returns 400
  test('Edge Case 2: Bill creation requires non-empty items array', async () => {
    const billRes = await request(app)
      .post('/api/v1/pro/bills')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        bill_type: 'treatment',
        items: []
      });

    expect(billRes.status).toBe(400);
  });

  // Edge Case 3: Incomplete PRO Checklist returns 422 with missing items
  test('Edge Case 3: Incomplete PRO Checklist returns 422 Unprocessable Entity', async () => {
    // Create new patient without billing or counselling
    const todayStr = new Date().toISOString().split('T')[0];
    const uniqueMob = '988' + Math.floor(1000000 + Math.random() * 9000000);
    const randMin = Math.floor(10 + Math.random() * 49);
    const randSec = Math.floor(10 + Math.random() * 49);

    const ptRes = await request(app)
      .post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${recToken}`)
      .send({
        full_name: 'Incomplete Checklist Patient',
        mobile_number: uniqueMob,
        gender: 'female',
        age: 30,
        address: 'Secunderabad',
        assigned_doctor_id: doctorId,
        appointment_date: todayStr,
        appointment_time: `10:${randMin}:${randSec}`,
        appointment_type: 'new'
      });

    const newPtId = ptRes.body.data.patient_id;

    const compRes = await request(app)
      .post(`/api/v1/pro/patients/${newPtId}/complete-pro`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({});

    expect(compRes.status).toBe(422);
    expect(compRes.body.data.missing_items.length).toBeGreaterThan(0);
  });

  // Edge Case 4: Complaint Resolution Workflow (open -> in_progress -> resolved)
  test('Edge Case 4: Complaint Resolution Workflow updates status cleanly', async () => {
    const compRes = await request(app)
      .post('/api/v1/pro/complaints')
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        patient_id: patientId,
        category_type: 'wait_time',
        description: 'Excessive waiting time at billing counter',
        priority: 'high'
      });

    expect(compRes.status).toBe(201);
    const complaintId = compRes.body.data.id;

    const updateRes = await request(app)
      .put(`/api/v1/pro/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        status: 'resolved',
        action_taken: 'Opened express billing counter',
        resolution: 'Issue resolved; patient satisfied'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('resolved');
  });

  // Rule 20: Login & Logout Duration Auditing
  test('Rule 20: PRO Login & Logout produces login_logs entry with session duration', async () => {
    const proLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pat_pro', password: 'Password@123' });

    const pToken = proLogin.body.data.token;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${pToken}`)
      .send({});

    expect(logoutRes.status).toBe(200);

    const logCheck = await db.query(`
      SELECT * FROM login_logs WHERE role = 'pro_manager' ORDER BY id DESC LIMIT 1
    `);

    expect(logCheck.rows.length).toBe(1);
    expect(logCheck.rows[0].logout_time).not.toBeNull();
  });
});
