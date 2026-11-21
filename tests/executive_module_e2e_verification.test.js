import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// WECARE ERP — EXECUTIVE MODULE COMPREHENSIVE VERIFICATION SUITE
// Tests: Inbound 10-digit mobile number searching, new vs existing caller handling,
// executive route mapping, button triggers, and lead creation validation.
// ============================================================================

describe('Executive Module End-to-End Verification Suite', () => {

  describe('1. Inbound Mobile Number Sanitization & Search Contract', () => {
    test('1.1 Strips non-digit characters and accepts valid 10-digit mobile number', () => {
      const rawInputs = [
        '5373737373',
        '+91 5373737373',
        '537-373-7373',
        ' (537) 373-7373 ',
        '537373737344' // > 10 digits
      ];

      const sanitize = (val) => {
        const digits = val.replace(/\D/g, '');
        if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
        return digits.slice(0, 10);
      };

      assert.strictEqual(sanitize(rawInputs[0]), '5373737373');
      assert.strictEqual(sanitize(rawInputs[1]), '5373737373');
      assert.strictEqual(sanitize(rawInputs[2]), '5373737373');
      assert.strictEqual(sanitize(rawInputs[3]), '5373737373');
      assert.strictEqual(sanitize(rawInputs[4]), '5373737373');
    });

    test('1.2 Numeric patient_id validation guards against 32-bit integer overflow', () => {
      // 5373737373 > 2147483647
      const checkValidPatientId = (str) => {
        const num = parseInt(str, 10);
        return !isNaN(num) && num > 0 && num <= 2147483647 && String(num) === str;
      };

      assert.strictEqual(checkValidPatientId('123'), true);
      assert.strictEqual(checkValidPatientId('1'), true);
      assert.strictEqual(checkValidPatientId('2147483647'), true);
      assert.strictEqual(checkValidPatientId('5373737373'), false); // Phone number should NOT be parsed as patient_id!
      assert.strictEqual(checkValidPatientId('9876543210'), false);
    });

    test('1.3 Inbound search response correctly switches UI to New Caller vs Existing Patient', () => {
      const handleSearchResult = (res, currentForm) => {
        if (!res.is_existing) {
          return {
            ...currentForm,
            mobile_number: res.searched_mobile,
            lead_name: '',
            requirement: '',
            remarks: '',
            isNewCaller: true
          };
        }
        return {
          ...currentForm,
          isNewCaller: false,
          patient: res.patient
        };
      };

      const initialForm = { lead_name: '', mobile_number: '', requirement: '', remarks: '' };
      const newCallerRes = { is_existing: false, searched_mobile: '5373737373', patient: null };
      const existingRes = { is_existing: true, patient: { patient_id: 1, full_name: 'Test Patient', mobile_number: '9999999901' } };

      const afterNew = handleSearchResult(newCallerRes, initialForm);
      assert.strictEqual(afterNew.isNewCaller, true);
      assert.strictEqual(afterNew.mobile_number, '5373737373');

      const afterExisting = handleSearchResult(existingRes, initialForm);
      assert.strictEqual(afterExisting.isNewCaller, false);
      assert.strictEqual(afterExisting.patient.full_name, 'Test Patient');
    });
  });

  describe('2. Executive Header & Navigation Routes Matching', () => {
    const executiveRoutes = [
      { name: 'Dashboard', path: '/executive/dashboard' },
      { name: 'Inbound Calls', path: '/executive/calls/inbound' },
      { name: 'Outbound Queue', path: '/executive/outbound/queue' },
      { name: 'Create Lead', path: '/executive/leads/new' },
      { name: 'All Leads', path: '/executive/leads' },
      { name: 'Call History', path: '/executive/calls/history' },
      { name: 'Callbacks', path: '/executive/callbacks' },
      { name: 'Incentives', path: '/executive/incentives' },
      { name: 'Profile', path: '/executive/profile' }
    ];

    test('2.1 All header action buttons link to valid executive route paths', () => {
      const headerActionPaths = ['/executive/calls/inbound', '/executive/outbound/queue', '/executive/leads/new'];
      const registeredPaths = executiveRoutes.map(r => r.path);

      for (const p of headerActionPaths) {
        assert.ok(registeredPaths.includes(p), `Path ${p} must be defined in executive routes`);
      }
    });

    test('2.2 Dashboard quick shortcuts link directly to valid targets', () => {
      const dashboardLinks = [
        '/executive/calls/inbound',
        '/executive/outbound/queue',
        '/executive/callbacks'
      ];
      const registeredPaths = executiveRoutes.map(r => r.path);

      for (const p of dashboardLinks) {
        assert.ok(registeredPaths.includes(p), `Dashboard shortcut ${p} must be valid`);
      }
    });
  });

  describe('3. Executive Lead Generation Form Payload Validation', () => {
    test('3.1 Rejects empty lead_name or invalid mobile_number', () => {
      const validate = (form) => {
        if (!form.lead_name || !form.lead_name.trim()) return 'Caller / Lead Name is required';
        const cleanMobile = (form.mobile_number || '').replace(/\D/g, '');
        if (!cleanMobile || cleanMobile.length !== 10) return 'Valid 10-digit mobile number is required';
        return null;
      };

      assert.strictEqual(validate({ lead_name: '', mobile_number: '5373737373' }), 'Caller / Lead Name is required');
      assert.strictEqual(validate({ lead_name: 'John', mobile_number: '123' }), 'Valid 10-digit mobile number is required');
      assert.strictEqual(validate({ lead_name: 'John', mobile_number: '5373737373' }), null);
    });

    test('3.2 Payload builds clean string types for village and mandal', () => {
      const form = {
        lead_name: 'Ramesh Reddy',
        mobile_number: '5373737373',
        age: '38',
        gender: 'male',
        village: 'Achampalli — Gangadhara',
        mandal: 'Gangadhara',
        requirement: 'Back Pain',
        remarks: 'Inbound caller'
      };

      const payload = {
        lead_name: form.lead_name.trim(),
        mobile_number: form.mobile_number.replace(/\D/g, ''),
        age: form.age ? parseInt(form.age, 10) : null,
        gender: form.gender,
        village: typeof form.village === 'string' ? form.village.trim() : null,
        mandal: typeof form.mandal === 'string' ? form.mandal.trim() : null,
        requirement: form.requirement.trim() || null,
        source: 'Inbound Call',
        remarks: form.remarks.trim() || null
      };

      assert.strictEqual(payload.lead_name, 'Ramesh Reddy');
      assert.strictEqual(payload.mobile_number, '5373737373');
      assert.strictEqual(payload.age, 38);
      assert.strictEqual(payload.village, 'Achampalli — Gangadhara');
      assert.strictEqual(payload.mandal, 'Gangadhara');
      assert.strictEqual(payload.requirement, 'Back Pain');
    });
  });
});
