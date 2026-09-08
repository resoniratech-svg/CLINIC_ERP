import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper matching PROCRMPage.jsx
const formatCallback = (dateStr, timeStr) => {
  if (!dateStr) return '—';
  try {
    const cleanDate = typeof dateStr === 'string' && dateStr.includes('T')
      ? dateStr.split('T')[0]
      : String(dateStr);
    const parts = cleanDate.split('-');
    let dateFormatted = cleanDate;
    if (parts.length === 3) {
      const [y, m, d] = parts;
      dateFormatted = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    if (!timeStr) return dateFormatted;

    const timeParts = String(timeStr).split(':');
    if (timeParts.length >= 2) {
      let h = parseInt(timeParts[0], 10);
      const m = timeParts[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${dateFormatted}, ${h.toString().padStart(2, '0')}:${m} ${ampm}`;
    }
    return `${dateFormatted}, ${timeStr}`;
  } catch (err) {
    return `${dateStr} ${timeStr || ''}`;
  }
};

// Domain validations matching UI rules
function validateCallForm(form) {
  const errors = [];
  if (!form.patient_id) errors.push('Patient selection is required');
  const validInteractions = ['inbound', 'outbound'];
  if (!validInteractions.includes(form.interaction_type)) errors.push('Invalid interaction type');

  const validPurposes = ['followup', 'renewal', 'due_payment', 'acq', 'ocnr', 'appointment', 'general_enquiry', 'callback', 'patient_feedback', 'other'];
  if (!validPurposes.includes(form.call_purpose)) errors.push('Invalid call purpose');

  const validStatuses = ['connected', 'not_connected', 'busy', 'switched_off', 'interested', 'not_interested', 'callback_requested', 'appointment_booked', 'followup_required', 'completed', 'closed'];
  if (!validStatuses.includes(form.call_status)) errors.push('Invalid call status');

  if (form.call_status === 'callback_requested' && !form.callback_date) {
    errors.push('Callback date is required when callback is requested');
  }

  return { isValid: errors.length === 0, errors };
}

function validateFollowupForm(form) {
  const errors = [];
  if (!form.patient_id) errors.push('Patient selection is required');
  if (!form.purpose || !form.purpose.trim()) errors.push('Purpose is required');
  if (!form.followup_date) errors.push('Due date is required');

  const validCategories = ['treatment', 'appointment', 'renewal', 'due', 'acq', 'ocnr', 'general'];
  if (!validCategories.includes(form.followup_type)) errors.push('Invalid followup category');

  return { isValid: errors.length === 0, errors };
}

function validateRenewalForm(form) {
  const errors = [];
  if (!form.patient_id) errors.push('Patient selection is required');
  const amt = parseFloat(form.renewal_amount);
  if (form.renewal_amount === undefined || form.renewal_amount === null || isNaN(amt) || amt <= 0) {
    errors.push('Renewal amount must be a positive number greater than 0');
  }
  return { isValid: errors.length === 0, errors };
}

function validateOCNRForm(form) {
  const errors = [];
  if (!form.patient_id) errors.push('Patient selection is required');
  if (!['oc', 'nr'].includes(form.classification)) {
    errors.push("Classification must be either 'oc' or 'nr'");
  }
  return { isValid: errors.length === 0, errors };
}

describe('PRO CRM & Calling Frontend Test Suite', () => {
  describe('1. Date & Time Formatting (Resolving raw ISO issue from screenshot)', () => {
    test('should format ISO timestamp and time into clean DD/MM/YYYY, hh:mm A', () => {
      // Replicating screenshot input: '2026-09-04T18:30:00.000Z 10:00:00'
      const formatted = formatCallback('2026-09-04T18:30:00.000Z', '10:00:00');
      assert.strictEqual(formatted, '04/09/2026, 10:00 AM');
    });

    test('should format standard YYYY-MM-DD date and PM time cleanly', () => {
      const formatted = formatCallback('2026-09-06', '14:30:00');
      assert.strictEqual(formatted, '06/09/2026, 02:30 PM');
    });

    test('should format 12:00 PM and 12:00 AM edge cases accurately', () => {
      assert.strictEqual(formatCallback('2026-09-06', '12:00:00'), '06/09/2026, 12:00 PM');
      assert.strictEqual(formatCallback('2026-09-06', '00:00:00'), '06/09/2026, 12:00 AM');
    });

    test('should return dash when date is empty or null', () => {
      assert.strictEqual(formatCallback(null, null), '—');
      assert.strictEqual(formatCallback('', '10:00:00'), '—');
    });
  });

  describe('2. Log Call Form Validation', () => {
    test('should fail validation when patient_id is missing', () => {
      const res = validateCallForm({
        patient_id: '',
        interaction_type: 'outbound',
        call_purpose: 'followup',
        call_status: 'connected'
      });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('Patient selection is required'));
    });

    test('should require callback_date if call_status is callback_requested', () => {
      const res = validateCallForm({
        patient_id: 10,
        interaction_type: 'outbound',
        call_purpose: 'followup',
        call_status: 'callback_requested',
        callback_date: ''
      });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('Callback date is required when callback is requested'));
    });

    test('should reject invalid Postgres enums in form input', () => {
      const res = validateCallForm({
        patient_id: 10,
        interaction_type: 'pigeon_post',
        call_purpose: 'magic',
        call_status: 'teleporting'
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.length, 3);
    });

    test('should pass validation with valid data', () => {
      const res = validateCallForm({
        patient_id: 464,
        interaction_type: 'outbound',
        call_purpose: 'callback',
        call_status: 'callback_requested',
        callback_date: '2026-09-07',
        callback_time: '10:00:00'
      });
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.errors.length, 0);
    });
  });

  describe('3. Follow-up Form Validation', () => {
    test('should fail when purpose or patient_id is missing', () => {
      const res = validateFollowupForm({
        patient_id: '',
        followup_type: 'treatment',
        followup_date: '2026-09-10',
        purpose: ''
      });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('Patient selection is required'));
      assert.ok(res.errors.includes('Purpose is required'));
    });

    test('should pass with complete follow-up details', () => {
      const res = validateFollowupForm({
        patient_id: 5,
        followup_type: 'treatment',
        followup_date: '2026-09-10',
        purpose: 'Check prescription tolerance'
      });
      assert.strictEqual(res.isValid, true);
    });
  });

  describe('4. Renewal Form Validation', () => {
    test('should reject 0 or negative renewal amount', () => {
      const res1 = validateRenewalForm({ patient_id: 5, renewal_amount: '0' });
      assert.strictEqual(res1.isValid, false);

      const res2 = validateRenewalForm({ patient_id: 5, renewal_amount: '-500' });
      assert.strictEqual(res2.isValid, false);
    });

    test('should accept valid renewal amount', () => {
      const res = validateRenewalForm({ patient_id: 5, renewal_amount: '12000' });
      assert.strictEqual(res.isValid, true);
    });
  });

  describe('5. OC / NR Form Validation', () => {
    test('should enforce classification to be oc or nr', () => {
      const resBad = validateOCNRForm({ patient_id: 5, classification: 'other' });
      assert.strictEqual(resBad.isValid, false);

      const resOC = validateOCNRForm({ patient_id: 5, classification: 'oc' });
      assert.strictEqual(resOC.isValid, true);

      const resNR = validateOCNRForm({ patient_id: 5, classification: 'nr' });
      assert.strictEqual(resNR.isValid, true);
    });
  });
});
