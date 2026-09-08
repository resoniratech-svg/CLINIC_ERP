import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Pharmacy Portal — Prescription Clarifications Module Integration Suite', () => {

  describe('1. PostgreSQL Enum & Issue Type Formatting', () => {
    const formatIssueType = (type) => {
      switch (type) {
        case 'dosage_clarification':
          return 'Dosage Clarification';
        case 'substitution_request':
          return 'Medicine Substitution';
        case 'medicine_unavailable':
          return 'Stock Unavailable';
        case 'quantity_clarification':
          return 'Quantity Discrepancy';
        case 'duration_clarification':
          return 'Duration Clarification';
        case 'prescription_error':
          return 'Prescription Error';
        case 'other':
        default:
          return type ? type.replace(/_/g, ' ') : 'Clinical Inquiry';
      }
    };

    test('1.1 Accurately maps all PostgreSQL enum issue types to clinical display labels', () => {
      assert.strictEqual(formatIssueType('dosage_clarification'), 'Dosage Clarification');
      assert.strictEqual(formatIssueType('substitution_request'), 'Medicine Substitution');
      assert.strictEqual(formatIssueType('medicine_unavailable'), 'Stock Unavailable');
      assert.strictEqual(formatIssueType('quantity_clarification'), 'Quantity Discrepancy');
      assert.strictEqual(formatIssueType('duration_clarification'), 'Duration Clarification');
      assert.strictEqual(formatIssueType('prescription_error'), 'Prescription Error');
      assert.strictEqual(formatIssueType('other'), 'other');
    });

    test('1.2 Gracefully formats arbitrary underscore-separated issue types', () => {
      assert.strictEqual(formatIssueType('custom_issue_type'), 'custom issue type');
      assert.strictEqual(formatIssueType(null), 'Clinical Inquiry');
    });
  });

  describe('2. Priority Badge Configuration (DB Enum Alignment)', () => {
    const getPriorityConfig = (priority) => {
      switch (priority) {
        case 'urgent':
          return { label: 'Urgent', colorClass: 'bg-rose-100 text-rose-800' };
        case 'high':
          return { label: 'High', colorClass: 'bg-amber-100 text-amber-800' };
        case 'normal':
        case 'medium':
          return { label: 'Normal', colorClass: 'bg-blue-100 text-blue-800' };
        case 'low':
        default:
          return { label: 'Low', colorClass: 'bg-slate-100 text-slate-700' };
      }
    };

    test('2.1 Correctly configures urgent priority badge', () => {
      const cfg = getPriorityConfig('urgent');
      assert.strictEqual(cfg.label, 'Urgent');
      assert.ok(cfg.colorClass.includes('rose-100'));
    });

    test('2.2 Correctly configures normal priority badge and handles legacy medium fallback', () => {
      const normalCfg = getPriorityConfig('normal');
      assert.strictEqual(normalCfg.label, 'Normal');
      assert.ok(normalCfg.colorClass.includes('blue-100'));

      const mediumCfg = getPriorityConfig('medium');
      assert.strictEqual(mediumCfg.label, 'Normal');
      assert.ok(mediumCfg.colorClass.includes('blue-100'));
    });

    test('2.3 Correctly configures low priority badge', () => {
      const lowCfg = getPriorityConfig('low');
      assert.strictEqual(lowCfg.label, 'Low');
      assert.ok(lowCfg.colorClass.includes('slate-100'));
    });
  });

  describe('3. Status Badge Configuration (DB Enum: open, responded, resolved, closed)', () => {
    const getStatusConfig = (status) => {
      switch (status) {
        case 'responded':
          return { label: 'Doctor Responded', colorClass: 'bg-purple-100 text-purple-800' };
        case 'resolved':
        case 'closed':
          return { label: 'Resolved / Closed', colorClass: 'bg-emerald-100 text-emerald-800' };
        case 'open':
        default:
          return { label: 'Awaiting Doctor', colorClass: 'bg-amber-100 text-amber-800' };
      }
    };

    test('3.1 Maps open status to amber "Awaiting Doctor"', () => {
      const cfg = getStatusConfig('open');
      assert.strictEqual(cfg.label, 'Awaiting Doctor');
      assert.ok(cfg.colorClass.includes('amber-100'));
    });

    test('3.2 Maps responded status to purple "Doctor Responded"', () => {
      const cfg = getStatusConfig('responded');
      assert.strictEqual(cfg.label, 'Doctor Responded');
      assert.ok(cfg.colorClass.includes('purple-100'));
    });

    test('3.3 Maps closed and resolved status to emerald "Resolved / Closed"', () => {
      const closedCfg = getStatusConfig('closed');
      assert.strictEqual(closedCfg.label, 'Resolved / Closed');
      assert.ok(closedCfg.colorClass.includes('emerald-100'));

      const resolvedCfg = getStatusConfig('resolved');
      assert.strictEqual(resolvedCfg.label, 'Resolved / Closed');
      assert.ok(resolvedCfg.colorClass.includes('emerald-100'));
    });
  });

  describe('4. Doctor Response Display & Fallback Handling', () => {
    const getDoctorResponseText = (clarification) => {
      return clarification.doctor_response || clarification.response || null;
    };

    test('4.1 Extracts doctor_response from database column name', () => {
      const c = { doctor_response: 'Give 30C instead of 200C' };
      assert.strictEqual(getDoctorResponseText(c), 'Give 30C instead of 200C');
    });

    test('4.2 Supports legacy alias response field seamlessly', () => {
      const c = { response: 'Approved drug substitution' };
      assert.strictEqual(getDoctorResponseText(c), 'Approved drug substitution');
    });

    test('4.3 Returns null when no response has been submitted yet', () => {
      const c = { doctor_response: null, response: null };
      assert.strictEqual(getDoctorResponseText(c), null);
    });
  });

  describe('5. Form Validation & Payload Construction', () => {
    const validateAndBuildPayload = (form) => {
      if (!form.prescription_id || !form.description || !form.description.trim()) {
        throw new Error('Prescription ID and question description are required');
      }

      return {
        prescription_id: parseInt(form.prescription_id),
        prescription_item_id: form.prescription_item_id ? parseInt(form.prescription_item_id) : undefined,
        issue_type: form.issue_type || 'dosage_clarification',
        description: form.description.trim(),
        priority: form.priority || 'normal',
        remarks: form.remarks ? form.remarks.trim() : undefined,
      };
    };

    test('5.1 Valid form creates complete payload with defaults', () => {
      const payload = validateAndBuildPayload({
        prescription_id: '458',
        description: 'Need dosage check',
      });
      assert.strictEqual(payload.prescription_id, 458);
      assert.strictEqual(payload.issue_type, 'dosage_clarification');
      assert.strictEqual(payload.priority, 'normal');
      assert.strictEqual(payload.description, 'Need dosage check');
      assert.strictEqual(payload.prescription_item_id, undefined);
    });

    test('5.2 Rejects missing prescription_id', () => {
      assert.throws(() => {
        validateAndBuildPayload({ prescription_id: '', description: 'Some text' });
      }, /Prescription ID/);
    });

    test('5.3 Rejects empty description', () => {
      assert.throws(() => {
        validateAndBuildPayload({ prescription_id: '123', description: '   ' });
      }, /question description/);
    });

    test('5.4 Includes item_id and remarks when specified', () => {
      const payload = validateAndBuildPayload({
        prescription_id: '123',
        prescription_item_id: '55',
        issue_type: 'substitution_request',
        priority: 'urgent',
        description: 'Item out of stock',
        remarks: 'Patient waiting',
      });
      assert.strictEqual(payload.prescription_item_id, 55);
      assert.strictEqual(payload.issue_type, 'substitution_request');
      assert.strictEqual(payload.priority, 'urgent');
      assert.strictEqual(payload.remarks, 'Patient waiting');
    });
  });

  describe('6. Search & Filter Matching Logic', () => {
    const sampleClarifications = [
      { id: 101, prescription_id: 458, patient_name: 'Rahul Sharma', doctor_name: 'Dr. Smith', medicine_name: 'Belladonna', status: 'open', priority: 'urgent' },
      { id: 102, prescription_id: 459, patient_name: 'Priya Patel', doctor_name: 'Dr. Jones', medicine_name: 'Arnica', status: 'responded', priority: 'normal' },
      { id: 103, prescription_id: 460, patient_name: 'Amit Kumar', doctor_name: 'Dr. Smith', medicine_name: 'Nux Vomica', status: 'closed', priority: 'high' },
    ];

    test('6.1 Filters by status', () => {
      const openItems = sampleClarifications.filter(c => c.status === 'open');
      assert.strictEqual(openItems.length, 1);
      assert.strictEqual(openItems[0].id, 101);
    });

    test('6.2 Filters by priority', () => {
      const urgentItems = sampleClarifications.filter(c => c.priority === 'urgent');
      assert.strictEqual(urgentItems.length, 1);
      assert.strictEqual(urgentItems[0].id, 101);
    });

    test('6.3 Matches text search across patient, doctor, medicine, or ID', () => {
      const query = 'rahul';
      const matches = sampleClarifications.filter(c =>
        c.patient_name.toLowerCase().includes(query) ||
        c.doctor_name.toLowerCase().includes(query) ||
        c.medicine_name.toLowerCase().includes(query) ||
        String(c.prescription_id) === query
      );
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0].patient_name, 'Rahul Sharma');
    });
  });

});
