import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Validation logic matching PROProfilePage.jsx
function validateContactForm({ mobile_number, email }) {
  const errors = [];
  if (mobile_number && !/^\d{10,12}$/.test(mobile_number.replace(/\D/g, ''))) {
    errors.push('Mobile number must contain 10-12 digits');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email address format');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

function validatePasswordForm({ old_password, new_password, confirm_password }) {
  const errors = [];
  if (!old_password || !old_password.trim()) {
    errors.push('Current password is required');
  }
  if (!new_password || !new_password.trim()) {
    errors.push('New password is required');
  }
  if (!confirm_password || !confirm_password.trim()) {
    errors.push('Confirm password is required');
  }
  if (new_password && new_password.length < 6) {
    errors.push('New password must be at least 6 characters');
  }
  if (new_password && confirm_password && new_password !== confirm_password) {
    errors.push('New passwords do not match');
  }
  if (old_password && new_password && old_password === new_password) {
    errors.push('New password must be different from current password');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, d] = cleanDate.split('-');
    return y && m && d ? `${d}/${m}/${y}` : cleanDate;
  } catch {
    return dateStr;
  }
}

describe('PRO Profile & Security Settings Frontend Test Suite', () => {
  describe('1. Date Formatting for Profile', () => {
    test('should format standard YYYY-MM-DD joining date to DD/MM/YYYY', () => {
      assert.strictEqual(formatDate('2026-09-05'), '05/09/2026');
    });

    test('should format ISO timestamp string to DD/MM/YYYY', () => {
      assert.strictEqual(formatDate('2026-09-04T18:30:00.000Z'), '04/09/2026');
    });

    test('should return dash when date is null or empty', () => {
      assert.strictEqual(formatDate(null), '—');
      assert.strictEqual(formatDate(''), '—');
    });
  });

  describe('2. Contact Form Validation', () => {
    test('should reject invalid mobile numbers', () => {
      const res = validateContactForm({ mobile_number: '123', email: 'test@wecare.com' });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('Mobile number must contain 10-12 digits'));
    });

    test('should reject invalid email formats', () => {
      const res = validateContactForm({ mobile_number: '9876543210', email: 'not-an-email' });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('Invalid email address format'));
    });

    test('should accept valid contact details', () => {
      const res = validateContactForm({ mobile_number: '9876543210', email: 'pro@wecare.com' });
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.errors.length, 0);
    });
  });

  describe('3. Password Form Validation', () => {
    test('should reject when fields are missing', () => {
      const res = validatePasswordForm({ old_password: '', new_password: 'Pass', confirm_password: '' });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('Current password is required'));
      assert.ok(res.errors.includes('Confirm password is required'));
    });

    test('should reject when new password is shorter than 6 characters', () => {
      const res = validatePasswordForm({ old_password: 'Current123', new_password: '123', confirm_password: '123' });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('New password must be at least 6 characters'));
    });

    test('should reject when new password and confirm password do not match', () => {
      const res = validatePasswordForm({
        old_password: 'CurrentPassword@123',
        new_password: 'NewPassword@123',
        confirm_password: 'DifferentPassword@123'
      });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('New passwords do not match'));
    });

    test('should reject when new password is identical to current password', () => {
      const res = validatePasswordForm({
        old_password: 'CurrentPassword@123',
        new_password: 'CurrentPassword@123',
        confirm_password: 'CurrentPassword@123'
      });
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.includes('New password must be different from current password'));
    });

    test('should pass validation with valid matching passwords >= 6 characters', () => {
      const res = validatePasswordForm({
        old_password: 'CurrentPassword@123',
        new_password: 'StrongNewPassword@2026',
        confirm_password: 'StrongNewPassword@2026'
      });
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.errors.length, 0);
    });
  });

  describe('4. Dynamic Authorised Module Privileges Rendering Logic', () => {
    function renderPrivileges(permissions) {
      if (permissions && permissions.length > 0) {
        return {
          hasPrivileges: true,
          count: permissions.length,
          items: permissions
        };
      }
      return {
        hasPrivileges: false,
        emptyStateMessage: 'No active module privileges assigned. Please contact Super Administrator.'
      };
    }

    test('should render dynamic items when user has permissions assigned', () => {
      const perms = ['Patient Counselling & Care Coordination', 'Payment Collection & Attribution'];
      const result = renderPrivileges(perms);
      assert.strictEqual(result.hasPrivileges, true);
      assert.strictEqual(result.count, 2);
      assert.deepStrictEqual(result.items, perms);
    });

    test('should render empty state message when user has zero assigned privileges', () => {
      const result = renderPrivileges([]);
      assert.strictEqual(result.hasPrivileges, false);
      assert.strictEqual(result.emptyStateMessage, 'No active module privileges assigned. Please contact Super Administrator.');
    });

    test('should render empty state when permissions is null or undefined', () => {
      const result = renderPrivileges(null);
      assert.strictEqual(result.hasPrivileges, false);
      assert.ok(result.emptyStateMessage);
    });
  });

  describe('5. Double-Submission & Concurrency Prevention', () => {
    test('should block duplicate submit when request is already in-flight', () => {
      let callCount = 0;
      let saving = false;

      function handleSubmit() {
        if (saving) return false;
        saving = true;
        callCount++;
        return true;
      }

      assert.strictEqual(handleSubmit(), true);
      assert.strictEqual(handleSubmit(), false); // blocked by saving flag
      assert.strictEqual(callCount, 1);
    });
  });
});
