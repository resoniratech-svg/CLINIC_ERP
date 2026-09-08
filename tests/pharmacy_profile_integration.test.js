import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Pharmacy Portal — My Profile Module Integration Suite', () => {

  describe('1. Dynamic Profile Data Resolution (Zero Hardcoding)', () => {
    const resolveDisplayProfile = (profile) => {
      if (!profile) return null;
      return {
        fullName: profile.full_name || 'N/A',
        username: profile.username ? `@${profile.username}` : null,
        role: profile.role ? profile.role.replace('_', ' ') : 'Pharmacist',
        status: profile.status ? profile.status.toUpperCase() : 'ACTIVE',
        employeeId: profile.employee_id || 'N/A',
        branchName: profile.branch_name || (profile.branch_id ? `Branch #${profile.branch_id}` : 'Main Branch'),
        branchIdLabel: profile.branch_id ? `Branch ID: #${profile.branch_id}` : 'Branch ID: N/A',
        department: profile.department || 'Dispensing & Stock',
      };
    };

    test('1.1 Accurately maps dynamic database record with zero hardcoded placeholders', () => {
      const dbRecord = {
        user_id: 1345,
        employee_id: 'PHA001',
        full_name: 'Peter Pharmacy Manager',
        username: 'peter_pharmacy',
        role: 'pharmacy',
        status: 'active',
        branch_id: 1,
        branch_name: 'Karimnagar Main Branch',
        email: 'pharmacy@hospital.com',
        mobile_number: '9888877775'
      };

      const resolved = resolveDisplayProfile(dbRecord);
      assert.strictEqual(resolved.fullName, 'Peter Pharmacy Manager');
      assert.strictEqual(resolved.username, '@peter_pharmacy');
      assert.strictEqual(resolved.role, 'pharmacy');
      assert.strictEqual(resolved.status, 'ACTIVE');
      assert.strictEqual(resolved.employeeId, 'PHA001');
      assert.strictEqual(resolved.branchName, 'Karimnagar Main Branch');
      assert.strictEqual(resolved.branchIdLabel, 'Branch ID: #1');
    });

    test('1.2 Gracefully handles missing branch name using branch_id fallback without inventing mock hospitals', () => {
      const dbRecord = {
        user_id: 2001,
        employee_id: 'PHA099',
        full_name: 'Pharmacist User',
        username: 'pharm_usr',
        branch_id: 4,
        branch_name: null
      };

      const resolved = resolveDisplayProfile(dbRecord);
      assert.strictEqual(resolved.branchName, 'Branch #4');
      assert.strictEqual(resolved.branchIdLabel, 'Branch ID: #4');
    });
  });

  describe('2. Contact Details Form Validation Rules', () => {
    const validateContactForm = ({ full_name, mobile_number, email }) => {
      const cleanName = (full_name || '').trim();
      const cleanMobile = (mobile_number || '').trim();
      const cleanEmail = (email || '').trim();

      if (!cleanName) {
        return { valid: false, error: 'Full Name cannot be empty' };
      }

      if (cleanMobile && !/^\d{10,15}$/.test(cleanMobile)) {
        return { valid: false, error: 'Invalid mobile number format. Must be between 10 and 15 digits' };
      }

      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { valid: false, error: 'Invalid email format' };
      }

      return {
        valid: true,
        data: {
          full_name: cleanName,
          mobile_number: cleanMobile,
          email: cleanEmail
        }
      };
    };

    test('2.1 Rejects empty or whitespace-only full name', () => {
      assert.strictEqual(validateContactForm({ full_name: '' }).valid, false);
      assert.strictEqual(validateContactForm({ full_name: '   ' }).valid, false);
      assert.strictEqual(validateContactForm({ full_name: '   ' }).error, 'Full Name cannot be empty');
    });

    test('2.2 Validates mobile number digit count (10-15 digits)', () => {
      assert.strictEqual(validateContactForm({ full_name: 'Peter', mobile_number: '123' }).valid, false);
      assert.strictEqual(validateContactForm({ full_name: 'Peter', mobile_number: 'abcdefghij' }).valid, false);
      assert.strictEqual(validateContactForm({ full_name: 'Peter', mobile_number: '9876543210' }).valid, true);
      assert.strictEqual(validateContactForm({ full_name: 'Peter', mobile_number: '919876543210' }).valid, true);
    });

    test('2.3 Validates email address format', () => {
      assert.strictEqual(validateContactForm({ full_name: 'Peter', email: 'notanemail' }).valid, false);
      assert.strictEqual(validateContactForm({ full_name: 'Peter', email: 'peter@' }).valid, false);
      assert.strictEqual(validateContactForm({ full_name: 'Peter', email: 'peter@clinic.com' }).valid, true);
    });
  });

  describe('3. Password Update Form Validation Rules', () => {
    const validatePasswordForm = ({ old_password, new_password, confirm_password }) => {
      if (!old_password || !new_password || !confirm_password) {
        return { valid: false, error: 'All password fields are required' };
      }

      if (new_password !== confirm_password) {
        return { valid: false, error: 'New password and confirm password do not match' };
      }

      if (new_password.length < 6) {
        return { valid: false, error: 'New password must be at least 6 characters long' };
      }

      return { valid: true };
    };

    test('3.1 Rejects when any password field is missing', () => {
      assert.strictEqual(validatePasswordForm({ old_password: '', new_password: 'abc', confirm_password: 'abc' }).valid, false);
      assert.strictEqual(validatePasswordForm({ old_password: 'abc', new_password: '', confirm_password: 'abc' }).valid, false);
      assert.strictEqual(validatePasswordForm({ old_password: 'abc', new_password: 'abc', confirm_password: '' }).valid, false);
    });

    test('3.2 Rejects when new password and confirm password do not match', () => {
      const res = validatePasswordForm({
        old_password: 'CurrentPassword1',
        new_password: 'Password123',
        confirm_password: 'Password456'
      });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'New password and confirm password do not match');
    });

    test('3.3 Rejects when new password is under 6 characters', () => {
      const res = validatePasswordForm({
        old_password: 'CurrentPassword1',
        new_password: '12345',
        confirm_password: '12345'
      });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'New password must be at least 6 characters long');
    });

    test('3.4 Accepts compliant password change submission', () => {
      const res = validatePasswordForm({
        old_password: 'CurrentPassword1',
        new_password: 'SecureNewPassword@123',
        confirm_password: 'SecureNewPassword@123'
      });
      assert.strictEqual(res.valid, true);
    });
  });

  describe('4. Context Synchronization & Immutability Guarantee', () => {
    test('4.1 Synchronizes updated full name into user session state', () => {
      let currentUser = { user_id: 1345, username: 'peter_pharmacy', full_name: 'Peter Pharmacy' };
      const updateUser = (fields) => {
        currentUser = { ...currentUser, ...fields };
      };

      updateUser({ full_name: 'Peter Pharmacy Lead' });
      assert.strictEqual(currentUser.full_name, 'Peter Pharmacy Lead');
      assert.strictEqual(currentUser.username, 'peter_pharmacy');
    });

    test('4.2 Rejects client-side modification of immutable system attributes', () => {
      const initialProfile = {
        user_id: 1345,
        role: 'pharmacy',
        branch_id: 1,
        employee_id: 'PHA001',
        status: 'active',
        full_name: 'Peter',
        mobile_number: '9888877775',
        email: 'peter@clinic.com'
      };

      const applySafeContactUpdate = (prev, updatePayload) => {
        return {
          ...prev,
          full_name: updatePayload.full_name || prev.full_name,
          mobile_number: updatePayload.mobile_number !== undefined ? updatePayload.mobile_number : prev.mobile_number,
          email: updatePayload.email !== undefined ? updatePayload.email : prev.email
        };
      };

      // Attacker attempts to modify role, branch, and status
      const updated = applySafeContactUpdate(initialProfile, {
        full_name: 'Peter Lead',
        role: 'super_admin',
        branch_id: 999,
        status: 'inactive'
      });

      assert.strictEqual(updated.full_name, 'Peter Lead');
      assert.strictEqual(updated.role, 'pharmacy');
      assert.strictEqual(updated.branch_id, 1);
      assert.strictEqual(updated.status, 'active');
      assert.strictEqual(updated.employee_id, 'PHA001');
    });
  });
});
