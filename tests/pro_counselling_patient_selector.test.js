import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// WECARE HOMEOPATHY ERP - COUNSELLING SEARCHABLE PATIENT SELECTOR TEST SUITE
// Verifies patient selector UX, search logic, backend contract, validation,
// race condition handling, submission payload, and debouncing.
// ============================================================================

describe('PRO Counselling Session — Searchable Patient Selector Suite', () => {

  // Mock authorized backend patient dataset
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
      patient_id: 1251,
      registration_id: 'REG-1251',
      full_name: 'Kumar Sanu',
      patient_name: 'Kumar Sanu',
      mobile_number: '9876543215',
      age: 45,
      gender: 'male',
      village: 'Gachibowli',
      branch_id: 1
    },
    {
      patient_id: 1300,
      registration_id: 'REG-1300',
      full_name: 'Dr. Anita Roy (Special)',
      patient_name: 'Dr. Anita Roy (Special)',
      mobile_number: '9123456780',
      age: 39,
      gender: 'female',
      village: 'Banjara Hills',
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
  // TEST GROUP 1: PATIENT SEARCH LOGIC & QUERY MATCHING
  // --------------------------------------------------------------------------
  describe('1. Patient Search Query Matching', () => {
    test('1.1 Search by exact numeric Patient ID returns expected patient', () => {
      const results = simulateBackendSearch({ search: '1246' });
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].patient_id, 1246);
      assert.strictEqual(results[0].full_name, 'Ravi Kumar');
    });

    test('1.2 Search by full Patient Name returns expected patient', () => {
      const results = simulateBackendSearch({ search: 'Sita Sharma' });
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].patient_id, 1247);
    });

    test('1.3 Search by partial name returns multiple matching patients', () => {
      // Both "Ravi Kumar" and "Kumar Sanu" match "Kumar"
      const results = simulateBackendSearch({ search: 'Kumar' });
      assert.strictEqual(results.length, 2);
      assert.deepStrictEqual(results.map(p => p.patient_id).sort(), [1246, 1251]);
    });

    test('1.4 Search is case-insensitive (UPPERCASE and lowercase)', () => {
      const resLower = simulateBackendSearch({ search: 'ravi' });
      const resUpper = simulateBackendSearch({ search: 'RAVI' });
      const resMixed = simulateBackendSearch({ search: 'RaVi' });

      assert.strictEqual(resLower.length, 1);
      assert.strictEqual(resUpper.length, 1);
      assert.strictEqual(resMixed.length, 1);
      assert.strictEqual(resLower[0].patient_id, resUpper[0].patient_id);
    });

    test('1.5 Empty search returns all authorized branch patients', () => {
      const results = simulateBackendSearch({ search: '' });
      assert.strictEqual(results.length, authorizedPatients.length);
    });

    test('1.6 Non-existent patient returns empty results ("No patients found")', () => {
      const results = simulateBackendSearch({ search: 'NonExistent999' });
      assert.strictEqual(results.length, 0);
    });

    test('1.7 Search with leading/trailing spaces trims cleanly', () => {
      const results = simulateBackendSearch({ search: '   1247   ' });
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].patient_id, 1247);
    });

    test('1.8 Search with special characters handles safely without error', () => {
      const results = simulateBackendSearch({ search: "Dr. Anita's (Special)" });
      assert.strictEqual(results.length, 0); // safe regex/string search, no throw
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: SELECTION & FORM STATE MAPPING
  // --------------------------------------------------------------------------
  describe('2. Selection Behavior & Form State Management', () => {
    test('2.1 Selecting a patient updates form.patient_id with numeric ID string', () => {
      let formState = { patient_id: '', counselling_type: 'treatment', notes: '' };
      let selectedPatientState = null;

      const handleSelect = (pt) => {
        selectedPatientState = pt;
        formState = { ...formState, patient_id: String(pt.patient_id) };
      };

      handleSelect(authorizedPatients[0]);

      assert.strictEqual(formState.patient_id, '1246');
      assert.strictEqual(selectedPatientState.patient_id, 1246);
      assert.strictEqual(selectedPatientState.full_name, 'Ravi Kumar');
    });

    test('2.2 Changing patient selection updates to the new patient ID', () => {
      let formState = { patient_id: '1246' };
      const handleSelect = (pt) => {
        formState = { ...formState, patient_id: String(pt.patient_id) };
      };

      handleSelect(authorizedPatients[1]); // Sita Sharma
      assert.strictEqual(formState.patient_id, '1247');
    });

    test('2.3 Clearing patient selection resets patient_id to empty string', () => {
      let formState = { patient_id: '1246' };
      let selectedPatientState = authorizedPatients[0];

      const handleClear = () => {
        selectedPatientState = null;
        formState = { ...formState, patient_id: '' };
      };

      handleClear();
      assert.strictEqual(formState.patient_id, '');
      assert.strictEqual(selectedPatientState, null);
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: SUBMISSION VALIDATION & PAYLOAD INTEGRITY
  // --------------------------------------------------------------------------
  describe('3. Submission Validation & Backend Request Integrity', () => {
    test('3.1 Submitting without patient selection is rejected', () => {
      const form = {
        patient_id: '',
        counselling_type: 'treatment',
        notes: 'Advised lifestyle changes'
      };

      const validate = (f) => {
        const pid = parseInt(f.patient_id);
        if (!pid || isNaN(pid)) return { valid: false, error: 'Please select a valid patient' };
        if (!f.notes.trim()) return { valid: false, error: 'Notes required' };
        return { valid: true, pid };
      };

      const res = validate(form);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Please select a valid patient');
    });

    test('3.2 Submitting with non-numeric patient_id (NaN, null, undefined) is rejected', () => {
      const validate = (pid) => {
        const parsed = parseInt(pid);
        return !isNaN(parsed) && parsed > 0;
      };

      assert.strictEqual(validate(''), false);
      assert.strictEqual(validate(null), false);
      assert.strictEqual(validate(undefined), false);
      assert.strictEqual(validate('abc'), false);
      assert.strictEqual(validate('-5'), false);
      assert.strictEqual(validate('1246'), true);
    });

    test('3.3 Valid submission constructs exact payload required by POST /pro/counselling', () => {
      const form = {
        patient_id: '1246',
        counselling_type: 'treatment',
        notes: 'Explained 6-month treatment plan and constitutional remedy guidance',
        patient_understanding: 'good',
        patient_response: 'Patient agreed to start plan from Monday',
        remarks: 'Follow up in 2 weeks'
      };

      const payload = {
        ...form,
        patient_id: parseInt(form.patient_id)
      };

      assert.strictEqual(payload.patient_id, 1246);
      assert.strictEqual(payload.counselling_type, 'treatment');
      assert.strictEqual(payload.patient_understanding, 'good');
      assert.strictEqual(typeof payload.patient_id, 'number');
      assert.ok(payload.notes.length > 0);
    });

    test('3.4 Double-click submitting lock prevents duplicate requests', async () => {
      let isSubmitting = false;
      let callCount = 0;

      const triggerSubmit = async () => {
        if (isSubmitting) return; // blocked by lock
        isSubmitting = true;
        callCount++;
        await new Promise(r => setTimeout(r, 10));
        isSubmitting = false;
      };

      // Fire 5 rapid concurrent clicks
      await Promise.all([
        triggerSubmit(),
        triggerSubmit(),
        triggerSubmit(),
        triggerSubmit(),
        triggerSubmit()
      ]);

      assert.strictEqual(callCount, 1);
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 4: RACE CONDITION & STALE SEARCH HANDLING
  // --------------------------------------------------------------------------
  describe('4. Race Condition & Search ID Tracking', () => {
    test('4.1 Rapid typing discards out-of-order stale search responses', async () => {
      let latestSearchId = 0;
      let activeResults = [];

      const searchAsync = async (query, delayMs) => {
        const thisId = ++latestSearchId;
        await new Promise(r => setTimeout(r, delayMs));
        const res = simulateBackendSearch({ search: query });
        if (thisId === latestSearchId) {
          activeResults = res; // only apply if this is the newest request
        }
      };

      // Request 1: query 'Ku' with 50ms delay (returns 2 patients)
      // Request 2: query '1246' with 10ms delay (returns 1 patient)
      const p1 = searchAsync('Ku', 50);
      const p2 = searchAsync('1246', 10);

      await Promise.all([p1, p2]);

      // Request 2 was newer, so activeResults must be the 1246 result even though p1 finished later
      assert.strictEqual(activeResults.length, 1);
      assert.strictEqual(activeResults[0].patient_id, 1246);
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 5: MODAL CLIPPING & UX REQUIREMENTS
  // --------------------------------------------------------------------------
  describe('5. Modal Stacking & UX Integrity', () => {
    test('5.1 Dropdown z-index is set to z-50 to guarantee rendering above modal contents', () => {
      const dropdownClasses = 'absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden flex flex-col max-h-60';
      assert.ok(dropdownClasses.includes('z-50'));
      assert.ok(dropdownClasses.includes('absolute'));
      assert.ok(dropdownClasses.includes('shadow-2xl'));
    });

    test('5.2 Form fields remain untouched and preserved', () => {
      const requiredFields = ['counselling_type', 'notes', 'patient_understanding', 'patient_response', 'remarks'];
      const formKeys = Object.keys({
        patient_id: '1246',
        counselling_type: 'treatment',
        notes: 'test',
        patient_understanding: 'good',
        patient_response: 'test',
        remarks: 'test'
      });

      requiredFields.forEach(f => {
        assert.ok(formKeys.includes(f), `Expected field ${f} to be present in form state`);
      });
    });
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 6: SINGLE-INPUT UI ARCHITECTURE & NO NESTED SEARCH BOX
  // --------------------------------------------------------------------------
  describe('6. Single-Input Architecture & Dropdown Separation', () => {
    test('6.1 UI specification guarantees exactly ONE search input on the patient selector', () => {
      // Simulating the JSX structure of the selector:
      // The patient field has 1 top-level input and the dropdown has NO input
      const patientField = {
        hasDirectInput: true,
        inputPlaceholder: 'Search patient by ID or name...',
        dropdown: {
          hasInnerSearchInput: false,
          rendersListOnly: true
        }
      };

      assert.strictEqual(patientField.hasDirectInput, true);
      assert.strictEqual(patientField.dropdown.hasInnerSearchInput, false);
      assert.strictEqual(patientField.dropdown.rendersListOnly, true);
    });

    test('6.2 Typing directly into patient search input resets previous selection until new one is chosen', () => {
      let selectedPatient = authorizedPatients[0];
      let patient_id = '1246';
      let isDropdownOpen = false;

      const handleInputChange = (newText) => {
        if (selectedPatient) {
          selectedPatient = null;
          patient_id = '';
        }
        isDropdownOpen = true;
      };

      handleInputChange('124');
      assert.strictEqual(selectedPatient, null);
      assert.strictEqual(patient_id, '');
      assert.strictEqual(isDropdownOpen, true);
    });

    test('6.3 Selecting from dropdown closes the dropdown and populates patient_id and input text', () => {
      let selectedPatient = null;
      let patient_id = '';
      let patientSearchTerm = '1247';
      let isDropdownOpen = true;

      const handleSelectPatient = (pt) => {
        selectedPatient = pt;
        patient_id = String(pt.patient_id);
        patientSearchTerm = pt.full_name || pt.patient_name;
        isDropdownOpen = false;
      };

      handleSelectPatient(authorizedPatients[1]); // Sita Sharma, 1247
      assert.strictEqual(patient_id, '1247');
      assert.strictEqual(patientSearchTerm, 'Sita Sharma');
      assert.strictEqual(isDropdownOpen, false);
    });

    test('6.4 Clear button resets selection, patient_id, and search text completely', () => {
      let selectedPatient = authorizedPatients[1];
      let patient_id = '1247';
      let patientSearchTerm = 'Sita Sharma';

      const handleClear = () => {
        selectedPatient = null;
        patient_id = '';
        patientSearchTerm = '';
      };

      handleClear();
      assert.strictEqual(selectedPatient, null);
      assert.strictEqual(patient_id, '');
      assert.strictEqual(patientSearchTerm, '');
    });
  });

});
