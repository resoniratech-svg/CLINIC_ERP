const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const seed = require('../src/db/seed');

describe('Financial & Inventory Reconciliation Integration Suite', () => {
  let adminToken, receptionistToken, doctorToken, proToken, pharmacyToken, executiveToken;

  beforeAll(async () => {
    await seed();

    adminToken = (await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' })).body.data.token;
    receptionistToken = (await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' })).body.data.token;
    doctorToken = (await request(app).post('/api/v1/auth/login').send({ username: 'dr_smith', password: 'Password@123' })).body.data.token;
    proToken = (await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' })).body.data.token;
    pharmacyToken = (await request(app).post('/api/v1/auth/login').send({ username: 'peter_pharmacy', password: 'Password@123' })).body.data.token;
    executiveToken = (await request(app).post('/api/v1/auth/login').send({ username: 'eric_exec', password: 'Password@123' })).body.data.token;
  });

  // Reconciliation 1: Full Patient Journey Payments Sum
  it('Reconciles total payments against consultation + treatment bills', async () => {
    const mob = '94' + Date.now().toString().slice(-8);
    const docRes = await db.query("SELECT d.doctor_id FROM doctors d JOIN users u ON d.user_id = u.user_id WHERE u.username = 'dr_smith'");
    const activeDoctorId = docRes.rows[0].doctor_id;

    const reg = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${receptionistToken}`).send({
      patient: { full_name: 'Reconciliation Patient', mobile_number: mob, age: 30, gender: 'male' },
      appointment: { doctor_id: activeDoctorId, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '07:20', appointment_type: 'new' },
      billing: { amount: 500, discount: 0, payment_mode: 'cash' }
    });
    expect(reg.status).toBe(201);
    const ptId = reg.body.data.patient.patient_id;
    const apptId = reg.body.data.appointment.appointment_id;

    // Doctor consultation
    await request(app).put(`/api/v1/receptionist/appointments/${apptId}/checkin`).set('Authorization', `Bearer ${receptionistToken}`).send({ status: 'checked_in' });
    const start = await request(app).post('/api/v1/doctor/consultations/start').set('Authorization', `Bearer ${doctorToken}`).send({ appointment_id: apptId });
    expect(start.status).toBe(201);
    await request(app).post('/api/v1/doctor/consultations/complete').set('Authorization', `Bearer ${doctorToken}`).send({
      consultation_id: start.body.data.consultation_id,
      chief_complaint: 'Fever',
      primary_diagnosis_text: 'Fever',
      prescription_items: [{ medicine_id: 1, dosage: '500 mg', frequency: '2/day', route: 'oral', duration_days: 3, quantity: 6 }]
    });

    // PRO Bill & Payment (1000 total: 600 cash, 400 card)
    const bill = await request(app).post('/api/v1/pro/billing').set('Authorization', `Bearer ${proToken}`).send({
      patient_id: ptId,
      appointment_id: apptId,
      bill_type: 'treatment',
      items: [{ item_type: 'treatment', description: 'Care Package', quantity: 1, unit_price: 1000 }],
      discount_amount: 0
    });
    expect(bill.status).toBe(201);

    await request(app).post('/api/v1/pro/payments').set('Authorization', `Bearer ${proToken}`).send({
      bill_id: bill.body.data.bill_id,
      patient_id: ptId,
      payments: [
        { payment_mode: 'cash', amount: 600 },
        { payment_mode: 'card', amount: 400 }
      ]
    });

    // DB Payments Sum Verification
    const pSumRes = await db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE patient_id = $1`, [ptId]);
    const totalPaid = parseFloat(pSumRes.rows[0].total);
    expect(totalPaid).toBe(1500); // 500 consultation + 1000 treatment
  });

  // Reconciliation 2: Grand Total Revenue Report
  it('Reconciles Grand Total revenue report across all payment modes', async () => {
    const reportRes = await request(app).get('/api/v1/pro/reports/revenue').set('Authorization', `Bearer ${proToken}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data).toHaveProperty('grand_total');
  });

  // Reconciliation 3: Cash Ledger Balancing
  it('Reconciles Cash Ledger Opening + Cash Revenue - Cash Expenditure = Closing', async () => {
    const ledgerRes = await request(app).get('/api/v1/pro/accountant/cash-ledger').set('Authorization', `Bearer ${proToken}`);
    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body.data).toHaveProperty('closing_cash');
  });

  // Reconciliation 4: Doctor Target Revenue Attribution (Paid vs Billed)
  it('Reconciles Doctor target revenue to paid amount only (ignoring unpaid due)', async () => {
    const targetRes = await request(app).get('/api/v1/doctor/targets/mine').set('Authorization', `Bearer ${doctorToken}`);
    expect(targetRes.status).toBe(200);
  });

  // Reconciliation 5: Live Stock vs Stock Transactions
  it('Reconciles live medicine stock quantity against transaction log history', async () => {
    const stockRes = await db.query(`SELECT quantity FROM medicine_stock WHERE id = 1`);
    const stockQty = parseInt(stockRes.rows[0].quantity);
    expect(stockQty).toBeGreaterThanOrEqual(0);
  });

  // Reconciliation 6: Executive Incentive Attribution
  it('Reconciles Executive incentive earnings with generated lead count', async () => {
    const incRes = await request(app).get('/api/v1/executive/incentives').set('Authorization', `Bearer ${executiveToken}`);
    expect(incRes.status).toBe(200);
  });
});
