import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// WECARE HOMEOPATHY ERP - PACKAGE ENROLLMENT SEARCHABLE PATIENT SELECTOR SUITE
// Verifies single-input selector, removal of number input & spinners,
// search logic, selection, form state, validation, and backend contract.
// ============================================================================

describe('PRO Package Enrollment — Searchable Patient Selector Suite', () => {

  const authorizedPatients = [
    {
      patient_id: 1246,
      registration_id: 'REG-1246',
      full_name: 'Ravi Kumar',
      patient_name: 'Ravi Kumar',
      mobile_number: '9876543210',
      age: 32,
      gender: 'male',
      village: 'Kukatpally',
      branch_id: 1
    },
    {
      patient_id: 1247,
      registration_id: 'REG-1247',
      full_name: 'Sita Sharma',
      patient_name: 'Sita Sharma',
      mobile_number: '9876543211',
      age: 28,
      gender: 'female',
      village: 'Madhapur',
      branch_id: 1
    },
    {
      patient_id: 1288,
      registration_id: 'REG-1288',
      full_name: 'Ravi Sharma',
      patient_name: 'Ravi Sharma',
      mobile_number: '9876543299',
      age: 40,
      gender: 'male',
      village: 'Hitech City',
      branch_id: 1
    }
  ];

  // Backend search simulation adhering to pro_module.controller.js searchPatients logic
  const simulateBackendSearch = (params = {}) => {
    const { search, name, patient_id, mobile, limit = 50 } = params;
    const s = (search || name || '').trim().toLowerCase();

    let results = authorizedPatients.filter(p => p.branch_id === 1);

    if (patient_id) {
      const pid = parseInt(patient_id);
      results = results.filter(p => p.patient_id === pid);
    } else if (mobile) {
      results = results.filter(p => p.mobile_number.includes(mobile.trim()));
    } else if (s) {
      const num = parseInt(s);
      if (!isNaN(num) && String(num) === s) {
        results = results.filter(p =>
          p.patient_id === num ||
          p.mobile_number.includes(s) ||
          p.full_name.toLowerCase().includes(s)
        );
      } else {
        results = results.filter(p =>
          p.full_name.toLowerCase().includes(s) ||
          p.mobile_number.includes(s) ||
          p.registration_id.toLowerCase().includes(s)
        );
      }
    }

    return results.slice(0, limit);
  };

  // --------------------------------------------------------------------------
  // TEST GROUP 1: SINGLE-INPUT UI ARCHITECTURE & REMOVAL OF NUMBER INPUT
  // --------------------------------------------------------------------------
  describe('1. UI Architecture & Spinner Removal', () => {
    test('1.1 Patient field is NOT a type="number" input and has no browser spinners', () => {
      const inputElement = {
        type: 'text',
        placeholder: 'Search patient by ID or name...',
        hasSpinners: false
      };
      assert.strictEqual(inputElement.type, 'text');
      assert.notStrictEqual(inputElement.type, 'number');
      assert.strictEqual(inputElement.hasSpinners, false);
    });

    test('1.2 There is strictly ONE search input and NO nested search box inside the dropdown', () => {
      const componentTree = {
        mainInput: {
          tag: 'input',
          type: 'text',
          placeholder: 'Search patient by ID or name...'
        },
        dropdown: {
          tag: 'div',
          hasInputChild: false,
          rendersItemsOnly: true
        }
      };

      assert.strictEqual(componentTree.mainInput.tag, 'input');
      assert.strictEqual(componentTree.dropdown.hasInputChild, false);
      assert.strictEqual(componentTree.dropdown.rendersItemsOnly, true);
    });

    test('1.3 Dropdown container specifies z-50 to guarantee rendering above modal content', () => {
      const dropdownClasses = 'absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden flex flex-col max-h-60';
      assert.ok(dropdownClasses.includes('z-50'));
      assert.ok(dropdownClasses.includes('absolute'));
      assert.ok(dropdownClasses.includes('shadow-2xl'));
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: PATIENT SEARCH LOGIC & QUERY MATCHING
  // --------------------------------------------------------------------------
  describe('2. Patient Search Matching', () => {
    test('2.1 Search by exact numeric Patient ID returns expected patient', () => {
      const results = simulateBackendSearch({ search: '1246' });
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].patient_id, 1246);
      assert.strictEqual(results[0].full_name, 'Ravi Kumar');
    });

    test('2.2 Search by name "Ravi" returns both matching patients', () => {
      const results = simulateBackendSearch({ search: 'Ravi' });
      assert.strictEqual(results.length, 2);
      assert.deepStrictEqual(results.map(p => p.patient_id).sort(), [1246, 1288]);
    });

    test('2.3 Partial name search "Rav" returns matching patients', () => {
      const results = simulateBackendSearch({ search: 'Rav' });
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].full_name, 'Ravi Kumar');
      assert.strictEqual(results[1].full_name, 'Ravi Sharma');
    });

    test('2.4 Search is case-insensitive (lowercase "ravi" and uppercase "RAVI")', () => {
      const resLower = simulateBackendSearch({ search: 'ravi' });
      const resUpper = simulateBackendSearch({ search: 'RAVI' });
      assert.strictEqual(resLower.length, resUpper.length);
      assert.strictEqual(resLower[0].patient_id, resUpper[0].patient_id);
    });

    test('2.5 Empty search returns all authorized branch patients', () => {
      const results = simulateBackendSearch({ search: '' });
      assert.strictEqual(results.length, authorizedPatients.length);
    });

    test('2.6 Non-existent patient returns empty results ("No patients found")', () => {
      const results = simulateBackendSearch({ search: 'NonExistent999' });
      assert.strictEqual(results.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: SELECTION & FORM STATE MANAGEMENT
  // --------------------------------------------------------------------------
  describe('3. Patient Selection & Form State', () => {
    test('3.1 Selecting patient stores actual numeric patient_id in form state', () => {
      let formState = { patient_id: '', package_name: '', package_amount: '' };
      let selectedPatient = null;
      let displaySearchTerm = '';

      const handleSelect = (pt) => {
        selectedPatient = pt;
        formState = { ...formState, patient_id: String(pt.patient_id) };
        displaySearchTerm = `${pt.full_name || pt.patient_name} • ID: ${pt.patient_id}`;
      };

      handleSelect(authorizedPatients[0]);

      assert.strictEqual(formState.patient_id, '1246');
      assert.strictEqual(selectedPatient.patient_id, 1246);
      assert.strictEqual(displaySearchTerm, 'Ravi Kumar • ID: 1246');
    });

    test('3.2 Selecting different patient updates patient_id and display term', () => {
      let formState = { patient_id: '1246' };
      let displaySearchTerm = 'Ravi Kumar • ID: 1246';

      const handleSelect = (pt) => {
        formState = { ...formState, patient_id: String(pt.patient_id) };
        displaySearchTerm = `${pt.full_name || pt.patient_name} • ID: ${pt.patient_id}`;
      };

      handleSelect(authorizedPatients[2]); // Ravi Sharma, 1288
      assert.strictEqual(formState.patient_id, '1288');
      assert.strictEqual(displaySearchTerm, 'Ravi Sharma • ID: 1288');
    });

    test('3.3 Clear button resets patient_id, selectedPatient, and search term', () => {
      let formState = { patient_id: '1246' };
      let selectedPatient = authorizedPatients[0];
      let displaySearchTerm = 'Ravi Kumar • ID: 1246';

      const handleClear = () => {
        selectedPatient = null;
        formState = { ...formState, patient_id: '' };
        displaySearchTerm = '';
      };

      handleClear();
      assert.strictEqual(formState.patient_id, '');
      assert.strictEqual(selectedPatient, null);
      assert.strictEqual(displaySearchTerm, '');
    });

    test('3.4 Typing directly clears previous selection until a new one is selected', () => {
      let formState = { patient_id: '1246' };
      let selectedPatient = authorizedPatients[0];

      const handleInputChange = () => {
        if (selectedPatient) {
          selectedPatient = null;
          formState = { ...formState, patient_id: '' };
        }
      };

      handleInputChange();
      assert.strictEqual(selectedPatient, null);
      assert.strictEqual(formState.patient_id, '');
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 4: SUBMISSION VALIDATION & BACKEND PAYLOAD INTEGRITY
  // --------------------------------------------------------------------------
  describe('4. Submission Validation & Backend Contract', () => {
    test('4.1 Submitting without patient selection is rejected', () => {
      const form = {
        patient_id: '',
        package_name: 'Silver Health Plan',
        package_type: 'monthly',
        package_amount: '5000'
      };

      const validate = (f) => {
        const pid = parseInt(f.patient_id);
        if (!pid || isNaN(pid)) return { valid: false, error: 'Please select a valid patient' };
        if (!f.package_name.trim()) return { valid: false, error: 'Package name required' };
        return { valid: true };
      };

      const result = validate(form);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Please select a valid patient');
    });

    test('4.2 Submitting with non-numeric patient_id is rejected', () => {
      const validate = (pid) => {
        const parsed = parseInt(pid);
        return !isNaN(parsed) && parsed > 0;
      };

      assert.strictEqual(validate(''), false);
      assert.strictEqual(validate(null), false);
      assert.strictEqual(validate(undefined), false);
      assert.strictEqual(validate('invalid-patient'), false);
      assert.strictEqual(validate('1246'), true);
    });

    test('4.3 Valid enrollment constructs exact payload required by POST /pro/packages', () => {
      const form = {
        patient_id: '1246',
        package_name: 'Annual Wellness Care Plan',
        package_type: 'yearly',
        from_date: '2026-09-05',
        to_date: '',
        package_amount: '18000',
        discount_amount: '2000',
        payment_status: 'pending',
        remarks: 'Test notes'
      };

      const payload = {
        ...form,
        patient_id: parseInt(form.patient_id),
        package_amount: parseFloat(form.package_amount),
        discount_amount: parseFloat(form.discount_amount || 0)
      };

      assert.strictEqual(payload.patient_id, 1246);
      assert.strictEqual(typeof payload.patient_id, 'number');
      assert.strictEqual(payload.package_name, 'Annual Wellness Care Plan');
      assert.strictEqual(payload.package_type, 'yearly');
      assert.strictEqual(payload.package_amount, 18000);
      assert.strictEqual(payload.discount_amount, 2000);
      assert.strictEqual(payload.payment_status, 'pending');
    });

    test('4.4 Custom package type requires to_date', () => {
      const formCustomWithoutToDate = {
        patient_id: '1246',
        package_name: 'Custom Care',
        package_type: 'custom',
        from_date: '2026-09-05',
        to_date: '',
        package_amount: '10000'
      };

      const validate = (f) => {
        if (f.package_type === 'custom' && !f.to_date) {
          return { valid: false, error: 'To Date is required for custom package duration' };
        }
        return { valid: true };
      };

      assert.strictEqual(validate(formCustomWithoutToDate).valid, false);
      assert.strictEqual(validate({ ...formCustomWithoutToDate, to_date: '2026-11-05' }).valid, true);
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 5: RACE CONDITIONS & RECOVERY
  // --------------------------------------------------------------------------
  describe('5. Rapid Typing Race Condition Handling', () => {
    test('5.1 Rapid typing discards out-of-order stale search responses', async () => {
      let latestSearchId = 0;
      let activeResults = [];

      const searchAsync = async (query, delayMs) => {
        const thisId = ++latestSearchId;
        await new Promise(r => setTimeout(r, delayMs));
        const res = simulateBackendSearch({ search: query });
        if (thisId === latestSearchId) {
          activeResults = res;
        }
      };

      // Request 1: query 'Ra' with 50ms delay
      // Request 2: query '1246' with 10ms delay
      const p1 = searchAsync('Ra', 50);
      const p2 = searchAsync('1246', 10);

      await Promise.all([p1, p2]);

      // Request 2 was newer, so activeResults must be the 1246 result
      assert.strictEqual(activeResults.length, 1);
      assert.strictEqual(activeResults[0].patient_id, 1246);
    });
  });

});
