const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('PRO / Manager Accountant & Cash Management Integration Test Suite', () => {
  let proToken;
  let adminToken;
  let execToken;

  const testExpenseIds = [];
  const testDepositIds = [];

  beforeAll(async () => {
    // 1. Authenticate PRO Manager
    const proLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pat_pro', password: 'Password@123' });
    proToken = proLogin.body?.data?.token;

    // 2. Authenticate Super Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = adminLogin.body?.data?.token;

    // 3. Authenticate Executive (unauthorized for accountant)
    const execLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'eric_exec', password: 'Password@123' });
    execToken = execLogin.body?.data?.token;

    // 4. Seed test baseline for 2026-09-06
    await db.query(`
      INSERT INTO cash_ledger (branch_id, ledger_date, opening_balance, cash_revenue, cash_expenditure, deposited_amount, closing_balance)
      VALUES (1, '2026-09-05', 0, 0, 0, 0, 600)
      ON CONFLICT (branch_id, ledger_date) DO UPDATE SET closing_balance = 600
    `);

    const billRes = await db.query('SELECT bill_id, patient_id FROM bills LIMIT 1');
    const billId = billRes.rows[0]?.bill_id || 1;
    const patientId = billRes.rows[0]?.patient_id || 1;

    const pCheck = await db.query("SELECT COUNT(*) FROM payments WHERE DATE(payment_date) = '2026-09-06' AND branch_id = 1");
    if (parseInt(pCheck.rows[0].count) === 0) {
      await db.query(`
        INSERT INTO payments (patient_id, bill_id, amount, payment_method, payment_date, status, branch_id, received_by)
        VALUES
          ($1, $2, 10600, 'cash', '2026-09-06 10:00:00', 'success', 1, 1),
          ($1, $2, 400, 'card', '2026-09-06 11:00:00', 'success', 1, 1),
          ($1, $2, 900, 'upi', '2026-09-06 12:00:00', 'success', 1, 1)
      `, [patientId, billId]);
    }
  });

  afterAll(async () => {
    // Clean up any test expenditures and deposits
    if (testExpenseIds.length > 0) {
      await db.query(`DELETE FROM expenditures WHERE id = ANY($1::int[])`, [testExpenseIds]);
    }
    if (testDepositIds.length > 0) {
      await db.query(`DELETE FROM cash_deposits WHERE id = ANY($1::int[])`, [testDepositIds]);
    }
    await db.pool.end();
  });

  describe('1. Authentication & Role-Based Access Control (RBAC)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .get('/api/v1/pro/accountant/daily-summary?date=2026-09-06');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthorized role (executive) with 403', async () => {
      const res = await request(app)
        .get('/api/v1/pro/accountant/daily-summary?date=2026-09-06')
        .set('Authorization', `Bearer ${execToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow pro_manager to access daily cash summary', async () => {
      const res = await request(app)
        .get('/api/v1/pro/accountant/daily-summary?date=2026-09-06')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should allow super_admin to access daily cash summary', async () => {
      const res = await request(app)
        .get('/api/v1/pro/accountant/daily-summary?date=2026-09-06')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('2. Live Data Verification & Mathematical Reconciliation (2026-09-06)', () => {
    it('should retrieve daily cash summary matching the live PostgreSQL database and UI screenshot', async () => {
      const res = await request(app)
        .get('/api/v1/pro/accountant/daily-summary?date=2026-09-06')
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.date).toBe('2026-09-06');
      expect(data.opening_cash).toBe(600);
      expect(data.cash_revenue).toBe(10600);
      expect(data.expected_cash).toBe(data.opening_cash + data.cash_revenue - data.cash_expenditure);
      expect(data.closing_cash).toBe(data.expected_cash - data.cash_deposited);

      // Breakdown
      expect(data.payment_method_breakdown.cash).toBe(10600);
      expect(data.payment_method_breakdown.card).toBe(400);
      expect(data.payment_method_breakdown.upi).toBe(900);
      expect(data.payment_method_breakdown.razorpay).toBe(0);
      expect(data.payment_method_breakdown.bajaj_pay).toBe(0);

      // Grand Total
      expect(data.grand_total).toBe(11900);
      const sumBreakdown = Object.values(data.payment_method_breakdown).reduce((a, b) => a + b, 0);
      expect(data.grand_total).toBe(sumBreakdown);
    });

    it('should return opening balance correctly from getOpeningBalance', async () => {
      const res = await request(app)
        .get('/api/v1/pro/accountant/opening-balance?date=2026-09-06')
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.opening_cash).toBe(600);
    });

    it('should return cash revenue correctly from getCashRevenue', async () => {
      const res = await request(app)
        .get('/api/v1/pro/accountant/cash-revenue?date=2026-09-06')
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cash_revenue).toBe(10600);
    });

    it('should return grand total correctly from getGrandTotal', async () => {
      const res = await request(app)
        .get('/api/v1/pro/accountant/grand-total?date=2026-09-06')
        .set('Authorization', `Bearer ${proToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.grand_total).toBe(11900);
    });
  });

  describe('3. Cash Expenditure Creation & Validation', () => {
    it('should reject expenditure with missing category', async () => {
      const res = await request(app)
        .post('/api/v1/pro/accountant/expenditure')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ description: 'Printer paper', amount: 350 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/category/i);
    });

    it('should reject expenditure with missing description', async () => {
      const res = await request(app)
        .post('/api/v1/pro/accountant/expenditure')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ category: 'Printing & Stationery', amount: 350 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/description/i);
    });

    it('should reject expenditure with zero or negative amount', async () => {
      const res1 = await request(app)
        .post('/api/v1/pro/accountant/expenditure')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ category: 'Printing & Stationery', description: 'Zero paper', amount: 0 });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/v1/pro/accountant/expenditure')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ category: 'Printing & Stationery', description: 'Negative paper', amount: -150 });
      expect(res2.status).toBe(400);
    });

    it('should successfully record valid cash expenditure', async () => {
      const res = await request(app)
        .post('/api/v1/pro/accountant/expenditure')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          category: 'Tea & Refreshments',
          description: 'Guest and Staff Refreshments',
          amount: 150,
          remarks: 'Voucher-TEST-01'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.payment_mode).toBe('cash');
      expect(parseFloat(res.body.data.amount)).toBe(150);

      testExpenseIds.push(res.body.data.id);
    });

    it('should reject immediate duplicate expenditure with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/pro/accountant/expenditure')
        .set('Authorization', `Bearer ${proToken}`)
        .send({
          category: 'Tea & Refreshments',
          description: 'Guest and Staff Refreshments',
          amount: 150,
          remarks: 'Voucher-TEST-01'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/duplicate/i);
    });
  });

  describe('4. Bank Cash Deposit & Overdraft Protection', () => {
    it('should reject direct deposit by PRO role with 403 (Core Business Rule)', async () => {
      const res = await request(app)
        .post('/api/v1/pro/accountant/deposit')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ deposit_amount: 500 });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/cannot perform direct bank deposits/i);
    });

    it('should reject direct deposit with zero or negative amount when called by super_admin', async () => {
      const res1 = await request(app)
        .post('/api/v1/cash/deposit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deposited_amount: 0 });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/v1/cash/deposit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deposited_amount: -500 });
      expect(res2.status).toBe(400);
    });

    it('should reject deposit exceeding available cash in drawer (overdraft protection)', async () => {
      const res = await request(app)
        .post('/api/v1/cash/deposit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deposited_amount: 9999999 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot exceed available cash/i);
    });

    it('should successfully record valid bank cash deposit within available balance for super_admin', async () => {
      const res = await request(app)
        .post('/api/v1/cash/deposit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deposit_date: '2026-09-06',
          deposited_amount: 200,
          deposit_reference: 'HDFC-TEST-DEP-001',
          bank_name: 'SBI Main Branch',
          remarks: 'Afternoon bank drop'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(parseFloat(res.body.data.deposited_amount)).toBe(200);

      testDepositIds.push(res.body.data.id);
    });
  });

  describe('5. Multi-Tenant Branch Isolation', () => {
    it('should scope records to user branch and not leak across branches', async () => {
      // Super admin can specify branch_id query parameter
      const b1 = await request(app)
        .get('/api/v1/pro/accountant/daily-summary?date=2026-09-06&branch_id=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(b1.status).toBe(200);
      expect(b1.body.data.branch_id).toBe(1);

      const b2 = await request(app)
        .get('/api/v1/pro/accountant/daily-summary?date=2026-09-06&branch_id=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(b2.status).toBe(200);
      expect(b2.body.data.branch_id).toBe(2);
      expect(b2.body.data.cash_revenue).toBe(0); // No Branch 2 cash payments recorded for this date
    });
  });
});
