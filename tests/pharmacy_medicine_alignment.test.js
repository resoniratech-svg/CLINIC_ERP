const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const fs = require('fs');
const path = require('path');

describe('Pharmacy Portal & Super Admin Pharmacy Master Alignment Integration Suite', () => {
  let adminToken;
  let pharmacyToken;
  let createdMedId;
  let createdMedSerial;

  beforeAll(async () => {
    // Run backfill migration to ensure clean state
    const migrationSql = fs.readFileSync(
      path.join(__dirname, '../migrations/backfill_medicine_serial_numbers.sql'),
      'utf8'
    );
    await db.query(migrationSql);

    // Super Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = adminRes.body?.data?.token;

    // Pharmacy login
    const phaRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'peter_pharmacy', password: 'Password@123' });
    pharmacyToken = phaRes.body?.data?.token;
  });

  describe('1. Serial Number Generation & Backfill Integrity', () => {
    test('1.1 All existing medicines have valid, unique MED-XXXXX serials', async () => {
      const res = await db.query(`SELECT id, serial_number, medicine_name FROM medicine_master`);
      expect(res.rows.length).toBeGreaterThan(0);
      for (const row of res.rows) {
        expect(row.serial_number).toBeDefined();
        expect(row.serial_number).not.toBeNull();
        expect(row.serial_number).toMatch(/^MED-[0-9]{5}$/);
      }
    });

    test('1.2 Serial backfill migration is idempotent', async () => {
      const before = await db.query(`SELECT id, serial_number FROM medicine_master ORDER BY id ASC`);
      const migrationSql = fs.readFileSync(
        path.join(__dirname, '../migrations/backfill_medicine_serial_numbers.sql'),
        'utf8'
      );
      await db.query(migrationSql);
      const after = await db.query(`SELECT id, serial_number FROM medicine_master ORDER BY id ASC`);
      expect(before.rows).toEqual(after.rows);
    });

    test('1.3 GET /api/v1/pharmacy/medicines/next-serial returns correct sequential serial for both roles', async () => {
      const adminNext = await request(app)
        .get('/api/v1/pharmacy/medicines/next-serial')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminNext.status).toBe(200);
      expect(adminNext.body.success).toBe(true);
      expect(adminNext.body.data.serial_number).toMatch(/^MED-[0-9]{5}$/);

      const pharmacyNext = await request(app)
        .get('/api/v1/pharmacy/medicines/next-serial')
        .set('Authorization', `Bearer ${pharmacyToken}`);
      expect(pharmacyNext.status).toBe(200);
      expect(pharmacyNext.body.success).toBe(true);
      expect(pharmacyNext.body.data.serial_number).toBe(adminNext.body.data.serial_number);
    });
  });

  describe('2. Canonical 4-Field Medicine Creation & Validation', () => {
    test('2.1 Rejects empty or whitespace-only medicine name', async () => {
      const res1 = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ medicine_name: '', strength: '30C' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ medicine_name: '   ', strength: '30C' });
      expect(res2.status).toBe(400);
    });

    test('2.2 Rejects empty or whitespace-only strength/potency', async () => {
      const res = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ medicine_name: 'Bryonia Alba', strength: '  ' });
      expect(res.status).toBe(400);
    });

    test('2.3 Rejects negative or invalid numeric quantity', async () => {
      const res1 = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ medicine_name: 'Bryonia Alba', strength: '30C', quantity: -10 });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({ medicine_name: 'Bryonia Alba', strength: '30C', quantity: 'abc' });
      expect(res2.status).toBe(400);
    });

    test('2.4 Successfully creates medicine with optional quantity and assigns serial number', async () => {
      const uniqueName = `Hypericum Perf ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          medicine_name: uniqueName,
          strength: '200C',
          quantity: 75
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.medicine_name).toBe(uniqueName);
      expect(res.body.data.strength).toBe('200C');
      expect(res.body.data.serial_number).toMatch(/^MED-[0-9]{5}$/);

      createdMedId = res.body.data.id;
      createdMedSerial = res.body.data.serial_number;

      // Verify stock entry created
      const stockRes = await db.query(
        `SELECT * FROM medicine_stock WHERE medicine_id = $1`,
        [createdMedId]
      );
      expect(stockRes.rows.length).toBe(1);
      expect(stockRes.rows[0].quantity).toBe(75);
    });

    test('2.5 Successfully creates medicine with no quantity (optional)', async () => {
      const uniqueName = `Rhus Tox ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          medicine_name: uniqueName,
          strength: '1M'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.medicine_name).toBe(uniqueName);
      expect(res.body.data.strength).toBe('1M');
      expect(res.body.data.serial_number).toMatch(/^MED-[0-9]{5}$/);

      // Verify no stock entry created
      const stockRes = await db.query(
        `SELECT * FROM medicine_stock WHERE medicine_id = $1`,
        [res.body.data.id]
      );
      expect(stockRes.rows.length).toBe(0);
    });
  });

  describe('3. Single Source of Truth & Duplicate Consolidation', () => {
    test('3.1 Adding existing medicine with different case or whitespace merges and consolidates stock', async () => {
      const initialStockRes = await db.query(
        `SELECT SUM(quantity) as qty FROM medicine_stock WHERE medicine_id = $1`,
        [createdMedId]
      );
      const initialQty = parseInt(initialStockRes.rows[0]?.qty || 0, 10);

      // Fetch created medicine details
      const medRes = await db.query(`SELECT medicine_name, strength FROM medicine_master WHERE id = $1`, [createdMedId]);
      const currentName = medRes.rows[0].medicine_name;

      // Post duplicate with altered casing and extra spacing
      const dupRes = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          medicine_name: `  ${currentName.toUpperCase()}  `,
          strength: ' 200C ',
          quantity: 25
        });

      expect(dupRes.status).toBe(200);
      expect(dupRes.body.success).toBe(true);
      expect(dupRes.body.data.id).toBe(createdMedId);
      expect(dupRes.body.data.serial_number).toBe(createdMedSerial);
      expect(dupRes.body.data.merged).toBe(true);

      const finalStockRes = await db.query(
        `SELECT SUM(quantity) as qty FROM medicine_stock WHERE medicine_id = $1`,
        [createdMedId]
      );
      const finalQty = parseInt(finalStockRes.rows[0]?.qty || 0, 10);
      expect(finalQty).toBe(initialQty + 25);
    });

    test('3.2 Same medicine name with different strength creates distinct record with new serial', async () => {
      const medRes = await db.query(`SELECT medicine_name FROM medicine_master WHERE id = $1`, [createdMedId]);
      const currentName = medRes.rows[0].medicine_name;

      const diffRes = await request(app)
        .post('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          medicine_name: currentName,
          strength: '10M',
          quantity: 10
        });

      expect(diffRes.status).toBe(201);
      expect(diffRes.body.data.id).not.toBe(createdMedId);
      expect(diffRes.body.data.serial_number).not.toBe(createdMedSerial);
      expect(diffRes.body.data.strength).toBe('10M');
    });

    test('3.3 Single source of truth: Super Admin and Pharmacy see identical catalog data', async () => {
      const adminList = await request(app)
        .get('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${adminToken}`);
      const pharmacyList = await request(app)
        .get('/api/v1/pharmacy/medicines')
        .set('Authorization', `Bearer ${pharmacyToken}`);

      expect(adminList.status).toBe(200);
      expect(pharmacyList.status).toBe(200);

      const adminItem = adminList.body.data.find(m => m.id === createdMedId);
      const pharmacyItem = pharmacyList.body.data.find(m => m.id === createdMedId);

      expect(adminItem).toBeDefined();
      expect(pharmacyItem).toBeDefined();
      expect(adminItem.serial_number).toBe(pharmacyItem.serial_number);
      expect(adminItem.medicine_name).toBe(pharmacyItem.medicine_name);
      expect(adminItem.strength).toBe(pharmacyItem.strength);
      expect(adminItem.quantity).toBe(pharmacyItem.quantity);
    });
  });

  describe('4. Medicine Update & Serial Immutability', () => {
    test('4.1 Updating medicine details updates name/strength but preserves serial_number', async () => {
      const updatedName = `Hypericum Perf Fortis ${Date.now()}`;
      const updateRes = await request(app)
        .put(`/api/v1/pharmacy/medicines/${createdMedId}`)
        .set('Authorization', `Bearer ${pharmacyToken}`)
        .send({
          medicine_name: updatedName,
          strength: '200CH',
          serial_number: 'MED-99999' // attempt to override serial
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      const verifyRes = await db.query(`SELECT * FROM medicine_master WHERE id = $1`, [createdMedId]);
      expect(verifyRes.rows[0].medicine_name).toBe(updatedName);
      expect(verifyRes.rows[0].strength).toBe('200CH');
      // Serial number must NOT be overwritten
      expect(verifyRes.rows[0].serial_number).toBe(createdMedSerial);
      expect(verifyRes.rows[0].serial_number).not.toBe('MED-99999');
    });
  });

  describe('5. Stock Adjustments & Serial Integration', () => {
    test('5.1 Stock adjustments API returns serial_number and supports search by serial', async () => {
      // Find a stock item for createdMedId
      const sRes = await db.query(`SELECT id FROM medicine_stock WHERE medicine_id = $1 LIMIT 1`, [createdMedId]);
      if (sRes.rows.length > 0) {
        const stockId = sRes.rows[0].id;
        // Create an adjustment
        await request(app)
          .post('/api/v1/pharmacy/stock/adjustments')
          .set('Authorization', `Bearer ${pharmacyToken}`)
          .send({
            medicine_id: createdMedId,
            stock_id: stockId,
            physical_quantity: 100,
            reason: 'stock_count_correction',
            remarks: 'Audit verification test'
          });

        // Query adjustments with search by serial_number
        const adjRes = await request(app)
          .get(`/api/v1/pharmacy/stock/adjustments?search=${createdMedSerial}`)
          .set('Authorization', `Bearer ${pharmacyToken}`);

        expect(adjRes.status).toBe(200);
        expect(adjRes.body.success).toBe(true);
        expect(adjRes.body.data.length).toBeGreaterThan(0);
        expect(adjRes.body.data[0].serial_number).toBe(createdMedSerial);
        expect(adjRes.body.data[0].medicine_name).toBeDefined();
      }
    });
  });

  describe('6. Super Admin Excel Import Contract Compatibility', () => {
    test('6.1 Import confirm API accepts items with canonical formulary fields', async () => {
      const testImportName = `Imported Calcarea ${Date.now()}`;
      const payload = {
        file_name: 'test_formulary_import.xlsx',
        items: [
          {
            serial_number: '',
            medicine_name: testImportName,
            potency: '30C',
            quantity: 50
          }
        ],
        row_issues: [],
        duplicate_rows: 0,
        invalid_rows: 0
      };

      const res = await request(app)
        .post('/api/v1/pharmacy/medicines/import/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.successfully_imported).toBe(1);

      // Verify the imported medicine has an auto-assigned serial number and is visible to Pharmacy
      const phaSearch = await request(app)
        .get(`/api/v1/pharmacy/medicines?search=${encodeURIComponent(testImportName)}`)
        .set('Authorization', `Bearer ${pharmacyToken}`);

      expect(phaSearch.status).toBe(200);
      expect(phaSearch.body.data.length).toBe(1);
      expect(phaSearch.body.data[0].medicine_name).toBe(testImportName);
      expect(phaSearch.body.data[0].strength).toBe('30C');
      expect(phaSearch.body.data[0].serial_number).toMatch(/^MED-[0-9]{5}$/);
      expect(phaSearch.body.data[0].quantity).toBe(50);
    });
  });
});
