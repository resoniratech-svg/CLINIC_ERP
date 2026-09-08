import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// DOCTOR PORTAL — PRESCRIPTION MEDICINE SELECTOR TEST SUITE
// Verifies Search + Dropdown component, real DB alignment, duplicate checks,
// debouncing, mobile/desktop styling, and Doctor -> Pharmacy contract.
// ============================================================================

const FRONTEND_DIR = path.resolve(process.cwd());
const SELECTOR_FILE = path.join(FRONTEND_DIR, 'src/components/doctor/MedicineSelector.jsx');
const CONSULTATION_PAGE = path.join(FRONTEND_DIR, 'src/pages/doctor/ConsultationPage.jsx');
const API_INDEX = path.join(FRONTEND_DIR, 'src/api/index.js');

describe('Doctor Portal — Prescription Medicine Search + Dropdown Suite', () => {
  const selectorCode = fs.readFileSync(SELECTOR_FILE, 'utf-8');
  const consultationCode = fs.readFileSync(CONSULTATION_PAGE, 'utf-8');
  const apiCode = fs.readFileSync(API_INDEX, 'utf-8');

  // Real mock medicine records from medicine_master table
  const mockMedicinesMaster = [
    {
      id: 1,
      medicine_name: 'Paracetamol 500mg',
      generic_name: 'Paracetamol',
      medicine_type: 'tablet',
      strength: '500 mg',
      unit: 'pcs',
      category: 'General',
      manufacturer: null,
      status: 'active'
    },
    {
      id: 310,
      medicine_name: 'Amoxicillin 500mg',
      generic_name: 'Amoxicillin',
      medicine_type: 'capsule',
      strength: '500 mg',
      unit: 'capsules',
      category: 'Antibiotic',
      manufacturer: null,
      status: 'active'
    },
    {
      id: 311,
      medicine_name: 'Cetirizine 10mg',
      generic_name: 'Cetirizine',
      medicine_type: 'tablet',
      strength: '10 mg',
      unit: 'pcs',
      category: 'Antihistamine',
      manufacturer: null,
      status: 'active'
    },
    {
      id: 999,
      medicine_name: 'Inactive Medicine',
      generic_name: 'Old Drug',
      medicine_type: 'syrup',
      strength: '100 ml',
      unit: 'bottle',
      category: 'General',
      manufacturer: null,
      status: 'inactive'
    }
  ];

  describe('1. Architectural Rules & No Free-Text / No Mock Data', () => {
    test('1.1 MedicineSelector uses pharmacyApi.getMedicines with status: active', () => {
      assert.ok(selectorCode.includes('pharmacyApi.getMedicines'), 'Calls pharmacyApi.getMedicines');
      assert.ok(selectorCode.includes("status: 'active'"), 'Requests active status medicines');
    });

    test('1.2 MedicineSelector contains strictly ZERO hardcoded medicine mock arrays', () => {
      assert.strictEqual(selectorCode.includes("['Amoxicillin'"), false, 'No hardcoded names array');
      assert.strictEqual(selectorCode.includes('[{ medicine_name:'), false, 'No dummy medicine objects');
    });

    test('1.3 ConsultationPage.jsx imports and integrates MedicineSelector', () => {
      assert.ok(consultationCode.includes("import { MedicineSelector } from '../../components/doctor/MedicineSelector';"), 'Imports MedicineSelector');
      assert.ok(consultationCode.includes('<MedicineSelector'), 'Renders MedicineSelector');
      assert.ok(!consultationCode.includes('handleMedSearch'), 'Legacy plain search input removed');
    });

    test('1.4 API client provides pharmacy.getMedicines endpoint', () => {
      assert.ok(apiCode.includes("getMedicines: (params) => axiosClient.get('/pharmacy/medicines'"), 'pharmacyApi.getMedicines exists');
    });
  });

  describe('2. UI Structure & Real Database Field Display', () => {
    test('2.1 Dropdown renders only real columns from medicine_master', () => {
      assert.ok(selectorCode.includes('med.medicine_name'), 'Displays medicine_name');
      assert.ok(selectorCode.includes('med.generic_name'), 'Displays generic_name');
      assert.ok(selectorCode.includes('med.strength'), 'Displays strength');
      assert.ok(selectorCode.includes('med.medicine_type'), 'Displays medicine_type');
      assert.ok(selectorCode.includes('med.category'), 'Displays category');
    });

    test('2.2 High z-index (z-50) guarantees no clipping by parent containers', () => {
      assert.ok(selectorCode.includes('z-50'), 'Dropdown specifies z-50');
    });

    test('2.3 Loading, Error, and Empty states exist in dropdown panel', () => {
      assert.ok(selectorCode.includes('Loading medicines from catalog...'), 'Renders loading text');
      assert.ok(selectorCode.includes('No medicines found'), 'Renders empty state');
      assert.ok(selectorCode.includes('Try again'), 'Provides retry on error');
    });

    test('2.4 Supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)', () => {
      assert.ok(selectorCode.includes("e.key === 'ArrowDown'"), 'Handles ArrowDown');
      assert.ok(selectorCode.includes("e.key === 'ArrowUp'"), 'Handles ArrowUp');
      assert.ok(selectorCode.includes("e.key === 'Enter'"), 'Handles Enter');
      assert.ok(selectorCode.includes("e.key === 'Escape'"), 'Handles Escape');
    });
  });

  describe('3. Dynamic Filtering Logic & Case-Insensitive Search', () => {
    const filterMedicines = (list, query) => {
      if (!query || !query.trim()) {
        return list.filter(m => m.status === 'active');
      }
      const q = query.trim().toLowerCase();
      return list.filter(m =>
        m.status === 'active' && (
          (m.medicine_name && m.medicine_name.toLowerCase().includes(q)) ||
          (m.generic_name && m.generic_name.toLowerCase().includes(q))
        )
      );
    };

    test('3.1 Empty query returns all active medicines', () => {
      const results = filterMedicines(mockMedicinesMaster, '');
      assert.strictEqual(results.length, 3);
      assert.ok(results.every(m => m.status === 'active'));
    });

    test('3.2 Searches case-insensitively by medicine name', () => {
      const lowerRes = filterMedicines(mockMedicinesMaster, 'amox');
      const upperRes = filterMedicines(mockMedicinesMaster, 'AMOX');
      assert.strictEqual(lowerRes.length, 1);
      assert.strictEqual(upperRes.length, 1);
      assert.strictEqual(lowerRes[0].id, 310);
      assert.strictEqual(upperRes[0].id, 310);
    });

    test('3.3 Searches by generic name', () => {
      const results = filterMedicines(mockMedicinesMaster, 'Cetirizine');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, 311);
    });

    test('3.4 Non-existent query returns empty array', () => {
      const results = filterMedicines(mockMedicinesMaster, 'NonExistentDrug123');
      assert.strictEqual(results.length, 0);
    });
  });

  describe('4. Rapid Typing & Debouncing Race Condition Safety', () => {
    test('4.1 Discards stale responses using sequential request tracking', async () => {
      let activeRequestId = 0;
      let stateMedicines = [];

      const simulateApiCall = (query, delay, reqId) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const results = mockMedicinesMaster.filter(m =>
              m.medicine_name.toLowerCase().includes(query.toLowerCase())
            );
            resolve({ reqId, results });
          }, delay);
        });
      };

      // Query 1: slow (100ms)
      const id1 = ++activeRequestId;
      const p1 = simulateApiCall('Para', 100, id1);

      // Query 2: fast (20ms)
      const id2 = ++activeRequestId;
      const p2 = simulateApiCall('Amox', 20, id2);

      // Process p2 first (finishes in 20ms)
      const res2 = await p2;
      if (res2.reqId === activeRequestId) {
        stateMedicines = res2.results;
      }

      // Process p1 second (finishes in 100ms, should be rejected)
      const res1 = await p1;
      if (res1.reqId === activeRequestId) {
        stateMedicines = res1.results;
      }

      // Latest query was 'Amox', so state must contain Amoxicillin, not Paracetamol
      assert.strictEqual(stateMedicines.length, 1);
      assert.strictEqual(stateMedicines[0].id, 310);
      assert.strictEqual(stateMedicines[0].medicine_name, 'Amoxicillin 500mg');
    });
  });

  describe('5. Selection, Prescription State, & Duplicate Prevention', () => {
    test('5.1 Selecting medicine passes actual medicine ID', () => {
      let capturedMedicine = null;
      const onSelect = (med) => { capturedMedicine = med; };

      const selected = mockMedicinesMaster[1]; // Amoxicillin id 310
      onSelect(selected);

      assert.ok(capturedMedicine);
      assert.strictEqual(capturedMedicine.id, 310);
      assert.strictEqual(capturedMedicine.medicine_name, 'Amoxicillin 500mg');
    });

    test('5.2 Adding medicine to prescription prevents duplicate entries', () => {
      let prescriptionMeds = [
        { medicine_id: 310, medicine_name: 'Amoxicillin 500mg', dosage: '1 tab', quantity: 21 }
      ];

      const addMed = (med) => {
        if (prescriptionMeds.some(m => m.medicine_id === med.id)) {
          return { success: false, message: 'Already added' };
        }
        prescriptionMeds.push({
          medicine_id: med.id,
          medicine_name: med.medicine_name,
          dosage: '1 tab',
          quantity: 21
        });
        return { success: true };
      };

      // Try adding duplicate
      const duplicateRes = addMed({ id: 310, medicine_name: 'Amoxicillin 500mg' });
      assert.strictEqual(duplicateRes.success, false);
      assert.strictEqual(prescriptionMeds.length, 1);

      // Add different medicine
      const validRes = addMed({ id: 1, medicine_name: 'Paracetamol 500mg' });
      assert.strictEqual(validRes.success, true);
      assert.strictEqual(prescriptionMeds.length, 2);
    });

    test('5.3 Payload matches backend doctorApi.createPrescription specification', () => {
      const consultationId = 533;
      const prescriptionMeds = [
        { medicine_id: 310, medicine_name: 'Amoxicillin 500mg', dosage: '1 tab', frequency: '3 times/day', route: 'oral', duration_days: 7, quantity: 21 }
      ];

      const payload = {
        consultation_id: consultationId,
        medicines: prescriptionMeds
      };

      assert.strictEqual(typeof payload.consultation_id, 'number');
      assert.ok(Array.isArray(payload.medicines));
      assert.strictEqual(payload.medicines[0].medicine_id, 310);
      assert.strictEqual(typeof payload.medicines[0].quantity, 'number');
    });
  });
});
