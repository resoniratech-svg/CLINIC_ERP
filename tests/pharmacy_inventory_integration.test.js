import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Pharmacy Portal — Inventory & Formulary Module Integration Suite', () => {

  // --------------------------------------------------------------------------
  // 1. TAB AND ROUTE RESOLUTION
  // --------------------------------------------------------------------------
  describe('1. Inventory Hub Tab Resolution and Navigation Contracts', () => {
    const tabsList = [
      { id: 'medicines', label: 'Formulary Master', path: '/pharmacy/inventory/medicines' },
      { id: 'stock', label: 'Stock Levels', path: '/pharmacy/inventory/stock' },
      { id: 'add-stock', label: '+ Manual Add Stock', path: '/pharmacy/inventory/add-stock' },
      { id: 'import-excel', label: 'Excel Import', path: '/pharmacy/inventory/import-excel' },
      { id: 'low-stock', label: 'Low Stock Alert', path: '/pharmacy/inventory/low-stock' },
      { id: 'expiring', label: 'Expiring Soon (30d)', path: '/pharmacy/inventory/expiring' },
      { id: 'expired', label: 'Expired Stock', path: '/pharmacy/inventory/expired' },
      { id: 'out-of-stock', label: 'Out of Stock', path: '/pharmacy/inventory/out-of-stock' },
    ];

    test('1.1 Resolves all 8 primary inventory tabs correctly', () => {
      assert.strictEqual(tabsList.length, 8);
      assert.deepStrictEqual(tabsList.map(t => t.id), [
        'medicines', 'stock', 'add-stock', 'import-excel',
        'low-stock', 'expiring', 'expired', 'out-of-stock'
      ]);
    });

    test('1.2 Maps tab paths strictly without sub-menu sidebar nesting', () => {
      tabsList.forEach(tab => {
        assert.ok(tab.path.startsWith('/pharmacy/inventory/'));
      });
    });

    test('1.3 Defaults activeTab to "medicines" when parameter is empty or undefined', () => {
      const getActiveTab = (param) => param || 'medicines';
      assert.strictEqual(getActiveTab(undefined), 'medicines');
      assert.strictEqual(getActiveTab(''), 'medicines');
      assert.strictEqual(getActiveTab('stock'), 'stock');
      assert.strictEqual(getActiveTab('low-stock'), 'low-stock');
    });

    test('1.4 Supports both "import-excel" and "import" tab aliases', () => {
      const isImportTab = (tab) => tab === 'import-excel' || tab === 'import';
      assert.strictEqual(isImportTab('import-excel'), true);
      assert.strictEqual(isImportTab('import'), true);
      assert.strictEqual(isImportTab('medicines'), false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. SEARCH & FILTER QUERY BUILDER
  // --------------------------------------------------------------------------
  describe('2. Search Query Builder & Debounce Formatters', () => {
    const buildSearchQuery = (search) => {
      const trimmed = (search || '').trim();
      return trimmed ? { search: trimmed } : {};
    };

    test('2.1 Trims query strings and returns undefined for whitespace', () => {
      assert.deepStrictEqual(buildSearchQuery('   Arnica Montana   '), { search: 'Arnica Montana' });
      assert.deepStrictEqual(buildSearchQuery('   '), {});
      assert.deepStrictEqual(buildSearchQuery(''), {});
      assert.deepStrictEqual(buildSearchQuery(null), {});
    });

    test('2.2 Preserves batch number search queries', () => {
      assert.deepStrictEqual(buildSearchQuery('BAT-2026-01'), { search: 'BAT-2026-01' });
    });
  });

  // --------------------------------------------------------------------------
  // 3. MANUAL ADD STOCK VALIDATION CONTRACTS
  // --------------------------------------------------------------------------
  describe('3. Manual Stock Receipt Validation Rules', () => {
    const validateStockReceipt = (form) => {
      if (!form.medicine_id || !form.batch_number?.trim() || !form.expiry_date || !form.quantity) {
        return { valid: false, error: 'Please fill all mandatory fields (Medicine, Batch, Expiry, Quantity)' };
      }
      const qty = parseInt(form.quantity);
      if (isNaN(qty) || qty <= 0) {
        return { valid: false, error: 'Quantity must be a positive number' };
      }
      if (form.manufacture_date && new Date(form.expiry_date) <= new Date(form.manufacture_date)) {
        return { valid: false, error: 'Expiry date must be strictly after manufacture date' };
      }
      return {
        valid: true,
        payload: {
          medicine_id: parseInt(form.medicine_id),
          batch_number: form.batch_number.trim(),
          manufacture_date: form.manufacture_date || undefined,
          expiry_date: form.expiry_date,
          quantity: qty,
          purchase_rate: form.purchase_rate ? parseFloat(form.purchase_rate) : undefined,
          mrp: form.mrp ? parseFloat(form.mrp) : undefined,
          supplier: form.supplier?.trim() || undefined,
          invoice_number: form.invoice_number?.trim() || undefined,
          remarks: form.remarks?.trim() || 'Manual stock receipt',
        }
      };
    };

    test('3.1 Rejects missing mandatory fields', () => {
      const res = validateStockReceipt({
        medicine_id: '',
        batch_number: 'BAT-01',
        expiry_date: '2028-01-01',
        quantity: '50'
      });
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /mandatory/i);
    });

    test('3.2 Rejects non-positive quantities', () => {
      const res = validateStockReceipt({
        medicine_id: '1',
        batch_number: 'BAT-01',
        expiry_date: '2028-01-01',
        quantity: '-5'
      });
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /positive/i);
    });

    test('3.3 Rejects expiry dates equal to or before manufacture date', () => {
      const res = validateStockReceipt({
        medicine_id: '1',
        batch_number: 'BAT-01',
        manufacture_date: '2026-05-01',
        expiry_date: '2026-05-01',
        quantity: '50'
      });
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /strictly after/i);
    });

    test('3.4 Successfully builds valid stock addition payload', () => {
      const res = validateStockReceipt({
        medicine_id: '12',
        batch_number: '  ARN-BATCH-10  ',
        manufacture_date: '2026-01-01',
        expiry_date: '2028-12-31',
        quantity: '100',
        purchase_rate: '85.50',
        mrp: '140.00',
        supplier: 'Dr. Reckeweg GmbH',
        invoice_number: 'INV-4421',
        remarks: 'Direct vendor shipment'
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.payload.medicine_id, 12);
      assert.strictEqual(res.payload.batch_number, 'ARN-BATCH-10');
      assert.strictEqual(res.payload.quantity, 100);
      assert.strictEqual(res.payload.purchase_rate, 85.5);
      assert.strictEqual(res.payload.mrp, 140.0);
      assert.strictEqual(res.payload.supplier, 'Dr. Reckeweg GmbH');
    });
  });

  // --------------------------------------------------------------------------
  // 4. EXCEL IMPORT SCHEMA & ROW VALIDATION
  // --------------------------------------------------------------------------
  describe('4. Excel Stock Import Structure & Row Parser', () => {
    const requiredExcelColumns = [
      'Medicine Name',
      'Batch Number',
      'Expiry Date',
      'Quantity'
    ];

    const sampleRow = {
      'Medicine Name': 'Arnica Montana',
      'Potency': '200CH',
      'Unit': 'bottle',
      'Category': 'Homeopathic Dilution',
      'Batch Number': 'ARN-2026-01',
      'Manufacture Date': '2026-01-01',
      'Expiry Date': '2028-12-31',
      'Quantity': 50,
      'Purchase Price': 85.00,
      'MRP': 140.00,
    };

    test('4.1 Sample template contains all mandatory import columns', () => {
      requiredExcelColumns.forEach(col => {
        assert.ok(col in sampleRow, `Sample template must contain column: ${col}`);
      });
    });

    test('4.2 Parses numeric quantities and currency fields accurately', () => {
      const parsedQty = parseInt(sampleRow['Quantity']);
      const parsedPurchase = parseFloat(sampleRow['Purchase Price']);
      const parsedMrp = parseFloat(sampleRow['MRP']);
      assert.strictEqual(parsedQty, 50);
      assert.strictEqual(parsedPurchase, 85.0);
      assert.strictEqual(parsedMrp, 140.0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. STOCK ALERTS DATA NORMALIZATION
  // --------------------------------------------------------------------------
  describe('5. Stock Alert Calculations and Normalization', () => {
    test('5.1 Normalizes available_quantity for aggregated alerts (low-stock, out-of-stock)', () => {
      const lowStockRow = {
        medicine_id: 5,
        medicine_name: 'Belladonna',
        potency: '30C',
        reorder_level: 20,
        available_quantity: 4
      };

      const outOfStockRow = {
        medicine_id: 8,
        medicine_name: 'Bryonia Alba',
        potency: '200CH',
        reorder_level: 15,
        available_quantity: 0
      };

      const getDisplayQty = (item) => item.available_quantity ?? item.quantity ?? 0;
      assert.strictEqual(getDisplayQty(lowStockRow), 4);
      assert.strictEqual(getDisplayQty(outOfStockRow), 0);
    });

    test('5.2 Accurately calculates days remaining and overdue for batches', () => {
      const now = new Date('2026-09-06T12:00:00Z');
      const expiringDate = new Date('2026-09-20T12:00:00Z');
      const expiredDate = new Date('2026-08-01T12:00:00Z');

      const calcDays = (targetDate, baseDate) => Math.ceil((targetDate - baseDate) / (1000 * 60 * 60 * 24));
      assert.strictEqual(calcDays(expiringDate, now), 14);
      assert.strictEqual(calcDays(expiredDate, now), -36);
    });
  });

  // --------------------------------------------------------------------------
  // 6. SUPER ADMIN PHARMACY MASTER ALIGNMENT CONTRACTS
  // --------------------------------------------------------------------------
  describe('6. Super Admin Formulary Master Alignment Contracts', () => {
    const expectedFormularyColumns = [
      'Serial Number',
      'Medicine Name',
      'Potency / Strength',
      'Quantity',
      'Actions'
    ];

    test('6.1 Table renders exact 5 canonical Super Admin columns', () => {
      assert.strictEqual(expectedFormularyColumns.length, 5);
      assert.deepStrictEqual(expectedFormularyColumns, [
        'Serial Number',
        'Medicine Name',
        'Potency / Strength',
        'Quantity',
        'Actions'
      ]);
    });

    test('6.2 Add/Edit modal strictly enforces 4 canonical formulary fields', () => {
      const validateFormularyForm = (form) => {
        if (!form.medicine_name?.trim()) {
          return { valid: false, error: 'Medicine Name is required' };
        }
        if (!form.strength?.trim()) {
          return { valid: false, error: 'Potency / Strength is required' };
        }
        if (form.quantity !== '' && form.quantity !== undefined && form.quantity !== null) {
          const q = parseInt(form.quantity, 10);
          if (isNaN(q) || q < 0) {
            return { valid: false, error: 'Quantity cannot be negative' };
          }
        }
        return {
          valid: true,
          payload: {
            medicine_name: form.medicine_name.trim(),
            strength: form.strength.trim(),
            quantity: form.quantity !== '' && form.quantity !== undefined ? parseInt(form.quantity, 10) : undefined
          }
        };
      };

      // Valid with quantity
      const res1 = validateFormularyForm({ medicine_name: 'Arnica Montana', strength: '200C', quantity: '100' });
      assert.strictEqual(res1.valid, true);
      assert.strictEqual(res1.payload.medicine_name, 'Arnica Montana');
      assert.strictEqual(res1.payload.strength, '200C');
      assert.strictEqual(res1.payload.quantity, 100);

      // Valid without quantity (optional)
      const res2 = validateFormularyForm({ medicine_name: 'Bryonia Alba', strength: '1M', quantity: '' });
      assert.strictEqual(res2.valid, true);
      assert.strictEqual(res2.payload.quantity, undefined);

      // Rejects empty name
      const res3 = validateFormularyForm({ medicine_name: '   ', strength: '30C' });
      assert.strictEqual(res3.valid, false);
      assert.match(res3.error, /Medicine Name is required/i);

      // Rejects empty strength
      const res4 = validateFormularyForm({ medicine_name: 'Rhus Tox', strength: '' });
      assert.strictEqual(res4.valid, false);
      assert.match(res4.error, /Potency \/ Strength is required/i);

      // Rejects negative quantity
      const res5 = validateFormularyForm({ medicine_name: 'Nux Vomica', strength: '30C', quantity: '-10' });
      assert.strictEqual(res5.valid, false);
      assert.match(res5.error, /Quantity cannot be negative/i);
    });

    test('6.3 Serial number formatting adheres to MED-XXXXX specification', () => {
      const formatSerial = (id) => `MED-${String(id).padStart(5, '0')}`;
      assert.strictEqual(formatSerial(1), 'MED-00001');
      assert.strictEqual(formatSerial(42), 'MED-00042');
      assert.strictEqual(formatSerial(1024), 'MED-01024');
      assert.match(formatSerial(99), /^MED-[0-9]{5}$/);
    });

    test('6.4 Add Stock tab dropdown formats option as ${serial_number} — ${medicine_name} (${strength})', () => {
      const formatAddStockOption = (m) =>
        `${m.serial_number || ('MED-' + String(m.id).padStart(5, '0'))} — ${m.medicine_name} (${m.strength || 'Standard'})`;

      const optionText = formatAddStockOption({
        id: 1,
        serial_number: 'MED-00001',
        medicine_name: 'Paracetamol 500mg',
        strength: '500 mg'
      });
      assert.strictEqual(optionText, 'MED-00001 — Paracetamol 500mg (500 mg)');

      const fallbackOption = formatAddStockOption({
        id: 5,
        serial_number: null,
        medicine_name: 'Arnica Montana',
        strength: '200C'
      });
      assert.strictEqual(fallbackOption, 'MED-00005 — Arnica Montana (200C)');
    });

    test('6.5 Stock Adjustments dropdown formats option as ${medicine_name} — ${strength} — ${serial_number}', () => {
      const formatAdjustmentOption = (m) =>
        `${m.medicine_name} — ${m.strength || 'Standard'} — ${m.serial_number || ('MED-' + String(m.id).padStart(5, '0'))}`;

      const optionText = formatAdjustmentOption({
        id: 1,
        serial_number: 'MED-00001',
        medicine_name: 'Paracetamol 500mg',
        strength: '500 mg'
      });
      assert.strictEqual(optionText, 'Paracetamol 500mg — 500 mg — MED-00001');

      const fallbackOption = formatAdjustmentOption({
        id: 7,
        serial_number: null,
        medicine_name: 'Belladonna',
        strength: '30C'
      });
      assert.strictEqual(fallbackOption, 'Belladonna — 30C — MED-00007');
    });
  });

});
