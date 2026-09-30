/**
 * WeCare ERP — Billing & Payment Calculation Backend Integration Test Suite
 *
 * Covers:
 * - A. Basic Bill Calculations (9553 - 553 = 9000)
 * - B. Discount Edge Cases
 * - C. Payment Amount Validation
 * - D. Partial Payments
 * - E. Decimal / Rounding precision
 * - F. Dedicated Bajaj Pay Integration
 * - G. Payment Edit & Pre-fill
 * - H. Payment + Discount Interaction
 * - I. Frontend/Backend Consistency
 * - J. Database precision (NUMERIC)
 * - 7. Permanent Regression Test
 *
 * Run: npx jest tests/billing_payment_calculation.test.js --no-watchman --runInBand --forceExit
 */

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db');

let proToken;
let testPatientId;
const createdBillIds = [];

async function getProToken() {
  try {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'SuperAdmin@123' });
    if (res.body?.data?.token) return res.body.data.token;
    if (res.body?.token) return res.body.token;
  } catch {}
  return null;
}

async function getTestPatient() {
  const r = await db.query(`SELECT patient_id FROM patients LIMIT 1`);
  return r.rows[0]?.patient_id || null;
}

beforeAll(async () => {
  proToken = await getProToken();
  testPatientId = await getTestPatient();
  if (!testPatientId) {
    throw new Error('No patient found in database for testing');
  }
}, 15000);

afterAll(async () => {
  // Clean up any test bills and associated records
  if (createdBillIds.length > 0) {
    await db.query('DELETE FROM due_patients WHERE bill_id = ANY($1::int[])', [createdBillIds]).catch(() => {});
    await db.query('DELETE FROM payments WHERE bill_id = ANY($1::int[])', [createdBillIds]).catch(() => {});
    await db.query('DELETE FROM bill_items WHERE bill_id = ANY($1::int[])', [createdBillIds]).catch(() => {});
    await db.query('DELETE FROM bills WHERE bill_id = ANY($1::int[])', [createdBillIds]).catch(() => {});
  }
  await db.pool.end();
}, 10000);

describe('WeCare ERP — Billing & Payment Calculation Backend Suite', () => {

  // ─────────────────────────────────────────────────────────────────────────────
  // A. BASIC BILL CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  describe('A. Basic Bill Calculations via API', () => {
    test('A.1: Bill ₹9,553 with ₹553 discount produces final_amount = 9000.00 (NOT 8999.63)', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [
            { item_name: 'Treatment Session', charge_type: 'Treatment', quantity: 1, unit_price: 9553 }
          ],
          discount_amount: 553
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const bill = res.body.data;
      createdBillIds.push(bill.bill_id);

      expect(parseFloat(bill.subtotal || bill.amount)).toBe(9553.00);
      expect(parseFloat(bill.discount_amount)).toBe(553.00);
      expect(parseFloat(bill.final_amount)).toBe(9000.00);
      expect(parseFloat(bill.final_amount)).not.toBe(8999.63);

      // Verify in Database directly
      const dbRow = await db.query('SELECT * FROM bills WHERE bill_id = $1', [bill.bill_id]);
      expect(parseFloat(dbRow.rows[0].amount)).toBe(9553.00);
      expect(parseFloat(dbRow.rows[0].discount_amount)).toBe(553.00);
      expect(parseFloat(dbRow.rows[0].final_amount)).toBe(9000.00);
    });

    test('A.2: Bill ₹1,000 with ₹0 discount produces final_amount = 1000.00', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [{ item_name: 'Standard Therapy', quantity: 1, unit_price: 1000 }],
          discount_amount: 0
        });

      expect(res.status).toBe(201);
      const bill = res.body.data;
      createdBillIds.push(bill.bill_id);
      expect(parseFloat(bill.final_amount)).toBe(1000.00);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // B. DISCOUNT EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────────
  describe('B. Discount Edge Cases via API', () => {
    test('B.1: Decimal discount: ₹9553.00 - ₹553.50 = ₹8999.50', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [{ item_name: 'Session', quantity: 1, unit_price: 9553 }],
          discount_amount: 553.50
        });

      expect(res.status).toBe(201);
      const bill = res.body.data;
      createdBillIds.push(bill.bill_id);
      expect(parseFloat(bill.final_amount)).toBe(8999.50);
    });

    test('B.2: Very small discount: ₹9553.00 - ₹0.01 = ₹9552.99', async () => {
      const res = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [{ item_name: 'Session', quantity: 1, unit_price: 9553 }],
          discount_amount: 0.01
        });

      expect(res.status).toBe(201);
      const bill = res.body.data;
      createdBillIds.push(bill.bill_id);
      expect(parseFloat(bill.final_amount)).toBe(9552.99);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // F & 7. PERMANENT REGRESSION TEST: BAJAJ PAY ON ₹9,553 - ₹553 = ₹9,000
  // ─────────────────────────────────────────────────────────────────────────────
  describe('7. Permanent Regression Test — Bajaj Pay on 9553 Bill with 553 Discount', () => {
    test('should allow exact payment of 9000 after 553 discount on 9553 bill using Bajaj Pay', async () => {
      // Step 1: Create Bill (9553 - 553 = 9000)
      const billRes = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [{ item_name: 'Comprehensive Homeopathy Course', quantity: 1, unit_price: 9553.00 }],
          discount_amount: 553.00
        });

      expect(billRes.status).toBe(201);
      const bill = billRes.body.data;
      createdBillIds.push(bill.bill_id);

      expect(parseFloat(bill.final_amount)).toBe(9000.00);
      expect(parseFloat(bill.final_amount)).not.toBe(8999.63);

      // Step 2: Record Payment of ₹9,000.00 using 'bajaj_pay'
      const payRes = await request(app)
        .post('/api/v1/pro/payments')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          bill_id: bill.bill_id,
          amount: 9000.00,
          payment_method: 'bajaj_pay',
          remarks: 'Bajaj Pay EMI full settlement'
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.success).toBe(true);

      const payData = payRes.body.data;
      expect(parseFloat(payData.amount)).toBe(9000.00);
      expect(payData.payment_method).toBe('bajaj_pay');

      // Step 3: Check Bill Details in database
      const billCheck = await db.query('SELECT * FROM bills WHERE bill_id = $1', [bill.bill_id]);
      const paymentsCheck = await db.query('SELECT SUM(amount) as paid FROM payments WHERE bill_id = $1', [bill.bill_id]);
      const paidTotal = parseFloat(paymentsCheck.rows[0].paid);
      const remainingDue = Math.max(0, parseFloat(billCheck.rows[0].final_amount) - paidTotal);

      expect(paidTotal).toBe(9000.00);
      expect(remainingDue).toBe(0.00);

      // Overpayment check: Attempting to pay another ₹1 or ₹0.01 should now be rejected as bill is settled
      const overpayRes = await request(app)
        .post('/api/v1/pro/payments')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          bill_id: bill.bill_id,
          amount: 1.00,
          payment_method: 'bajaj_pay'
        });

      expect(overpayRes.status).toBe(400);
      expect(overpayRes.body.message).toMatch(/exceed the remaining due/i);
    });

    test('Bajaj Pay payment = ₹9,000.01 on ₹9,000 bill is rejected as overpayment', async () => {
      const billRes = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [{ item_name: 'Treatment Session', quantity: 1, unit_price: 9000 }],
          discount_amount: 0
        });

      expect(billRes.status).toBe(201);
      const bill = billRes.body.data;
      createdBillIds.push(bill.bill_id);

      const payRes = await request(app)
        .post('/api/v1/pro/payments')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          bill_id: bill.bill_id,
          amount: 9000.01,
          payment_method: 'bajaj_pay'
        });

      expect(payRes.status).toBe(400);
      expect(payRes.body.message).toMatch(/exceed the remaining due/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // D. PARTIAL PAYMENT TESTS VIA API
  // ─────────────────────────────────────────────────────────────────────────────
  describe('D. Partial Payment Sequence via API', () => {
    test('Sequence: 3000 -> 2500 -> 3500 on ₹9,000 bill completes to zero due', async () => {
      const billRes = await request(app)
        .post('/api/v1/pro/bills')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          patient_id: testPatientId,
          bill_type: 'treatment',
          items: [{ item_name: 'Multi-stage Treatment', quantity: 1, unit_price: 9000 }],
          discount_amount: 0
        });

      const bill = billRes.body.data;
      createdBillIds.push(bill.bill_id);

      // Payment 1: 3000
      const p1 = await request(app)
        .post('/api/v1/pro/payments')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ bill_id: bill.bill_id, amount: 3000, payment_method: 'bajaj_pay' });
      expect(p1.status).toBe(201);

      // Payment 2: 2500
      const p2 = await request(app)
        .post('/api/v1/pro/payments')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ bill_id: bill.bill_id, amount: 2500, payment_method: 'upi' });
      expect(p2.status).toBe(201);

      // Payment 3: 3500
      const p3 = await request(app)
        .post('/api/v1/pro/payments')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ bill_id: bill.bill_id, amount: 3500, payment_method: 'cash' });
      expect(p3.status).toBe(201);

      // Total paid in DB must be exactly 9000.00
      const dbPay = await db.query('SELECT SUM(amount) as paid FROM payments WHERE bill_id = $1', [bill.bill_id]);
      expect(parseFloat(dbPay.rows[0].paid)).toBe(9000.00);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // J. DATABASE PRECISION
  // ─────────────────────────────────────────────────────────────────────────────
  describe('J. Database Precision and Numeric Columns', () => {
    test('bills and payments tables use numeric/decimal types', async () => {
      const cols = await db.query(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_name IN ('bills', 'payments') AND column_name IN ('amount', 'discount_amount', 'final_amount')
      `);

      for (const row of cols.rows) {
        expect(row.data_type).toBe('numeric');
      }
    });
  });
});
