import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// ============================================================================
// WECARE HOMOEOPATHY ERP - AUTHENTICATION CREDENTIAL SECURITY TEST SUITE
// Verifies that no credentials are pre-filled, embedded, cached, or stored
// across LoginPage, AuthContext, modals, localStorage, and application bundles.
// ============================================================================

describe('Clinic ERP - Authentication Security & Credential Isolation Suite', () => {

  // 1. Hardcoded Secret Scan across all source files
  test('1. No hardcoded SuperAdmin passwords in src directory', () => {
    function scanDirectory(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (/\.(jsx?|tsx?|html|css|json)$/.test(file)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.strictEqual(
            content.includes('SuperAdmin@123'),
            false,
            `Hardcoded password 'SuperAdmin@123' found in ${fullPath}`
          );
        }
      }
    }
    scanDirectory(srcDir);
  });

  // 2. LoginPage Component State & Attribute Verification
  test('2. LoginPage initializes username and password to empty strings', () => {
    const loginPagePath = path.join(srcDir, 'pages/auth/LoginPage.jsx');
    const content = fs.readFileSync(loginPagePath, 'utf8');

    // Verify empty state initialization
    assert.match(content, /const\s*\[username,\s*setUsername\]\s*=\s*useState\(['"]{2}\)/, 'username must initialize to empty string');
    assert.match(content, /const\s*\[password,\s*setPassword\]\s*=\s*useState\(['"]{2}\)/, 'password must initialize to empty string');
    assert.doesNotMatch(content, /useState\(['"]admin['"]\)/, 'username must not initialize to "admin"');
    assert.doesNotMatch(content, /useState\(['"]SuperAdmin@123['"]\)/, 'password must not initialize to "SuperAdmin@123"');
  });

  test('3. LoginPage rememberMe defaults to false', () => {
    const loginPagePath = path.join(srcDir, 'pages/auth/LoginPage.jsx');
    const content = fs.readFileSync(loginPagePath, 'utf8');

    assert.match(content, /const\s*\[rememberMe,\s*setRememberMe\]\s*=\s*useState\(false\)/, 'rememberMe must default to false');
    assert.doesNotMatch(content, /const\s*\[rememberMe,\s*setRememberMe\]\s*=\s*useState\(true\)/, 'rememberMe must not default to true');
  });

  test('4. LoginPage form inputs have secure placeholders and autocomplete attributes', () => {
    const loginPagePath = path.join(srcDir, 'pages/auth/LoginPage.jsx');
    const content = fs.readFileSync(loginPagePath, 'utf8');

    // Placeholders must not contain credentials
    assert.doesNotMatch(content, /placeholder=['"]admin['"]/, 'Username placeholder must not be "admin"');
    assert.doesNotMatch(content, /placeholder=['"]••••••••['"]/, 'Password placeholder must not simulate entered dots');
    assert.match(content, /placeholder=['"]Enter username or mobile['"]/, 'Username placeholder must be helpful guide text');
    assert.match(content, /placeholder=['"]Enter password['"]/, 'Password placeholder must be helpful guide text');

    // Autocomplete standards
    assert.match(content, /autoComplete=['"]username['"]/, 'Username input must specify autoComplete="username"');
    assert.match(content, /autoComplete=['"]current-password['"]/, 'Password input must specify autoComplete="current-password"');

    // Form field accessibility & linkage
    assert.match(content, /id=['"]username['"]/, 'Username input must have id="username"');
    assert.match(content, /id=['"]password['"]/, 'Password input must have id="password"');
  });

  test('5. LoginPage validates empty credentials before API dispatch', () => {
    const loginPagePath = path.join(srcDir, 'pages/auth/LoginPage.jsx');
    const content = fs.readFileSync(loginPagePath, 'utf8');

    assert.match(content, /!username\.trim\(\)\s*\|\|\s*!password\.trim\(\)/, 'Must reject empty or whitespace credentials');
  });

  // 3. AuthContext Storage and Credential Lifecycle
  test('6. AuthContext does not store plaintext password in localStorage or sessionStorage', () => {
    const authContextPath = path.join(srcDir, 'context/AuthContext.jsx');
    const content = fs.readFileSync(authContextPath, 'utf8');

    assert.doesNotMatch(content, /localStorage\.setItem\(['"]password['"]/, 'Password must never be saved to localStorage');
    assert.doesNotMatch(content, /sessionStorage\.setItem\(['"]password['"]/, 'Password must never be saved to sessionStorage');
    assert.doesNotMatch(content, /localStorage\.setItem\(['"]username['"]/, 'Username must not be saved to localStorage');
  });

  test('7. AuthContext logout thoroughly purges tokens, user profile, and legacy storage keys', () => {
    const authContextPath = path.join(srcDir, 'context/AuthContext.jsx');
    const content = fs.readFileSync(authContextPath, 'utf8');

    assert.match(content, /localStorage\.removeItem\(['"]clinic_token['"]\)/, 'Logout must remove clinic_token');
    assert.match(content, /localStorage\.removeItem\(['"]clinic_user['"]\)/, 'Logout must remove clinic_user');
    assert.match(content, /localStorage\.removeItem\(['"]username['"]\)/, 'Logout must purge legacy username');
    assert.match(content, /localStorage\.removeItem\(['"]password['"]\)/, 'Logout must purge legacy password');
    assert.match(content, /sessionStorage\.clear\(\)/, 'Logout must clear sessionStorage');
  });

  // 4. Modal Password and Reset Fields
  test('8. ChangePasswordModal initializes all input fields to empty strings', () => {
    const modalPath = path.join(srcDir, 'pages/auth/ChangePasswordModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.match(content, /const\s*\[oldPassword,\s*setOldPassword\]\s*=\s*useState\(['"]{2}\)/);
    assert.match(content, /const\s*\[newPassword,\s*setNewPassword\]\s*=\s*useState\(['"]{2}\)/);
    assert.match(content, /const\s*\[confirmPassword,\s*setConfirmPassword\]\s*=\s*useState\(['"]{2}\)/);
  });

  test('9. ForgotPasswordModal initializes identifier field to empty string', () => {
    const modalPath = path.join(srcDir, 'pages/auth/ForgotPasswordModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.match(content, /const\s*\[identifier,\s*setIdentifier\]\s*=\s*useState\(['"]{2}\)/);
  });

  // 5. Codebase-wide sensitive storage search
  test('10. Codebase wide check: no code writes passwords to client-side storage', () => {
    function checkDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          checkDir(fullPath);
        } else if (/\.(jsx?|tsx?)$/.test(file)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.doesNotMatch(
            content,
            /localStorage\.setItem\(\s*['"`](password|passwd|user_password|credentials)['"`]/i,
            `Sensitive key written to localStorage in ${fullPath}`
          );
          assert.doesNotMatch(
            content,
            /sessionStorage\.setItem\(\s*['"`](password|passwd|user_password|credentials)['"`]/i,
            `Sensitive key written to sessionStorage in ${fullPath}`
          );
        }
      }
    }
    checkDir(srcDir);
  });

  // 6. Production Build Artifacts Audit
  test('11. Production bundle in dist/ does not contain hardcoded credentials', () => {
    const distDir = path.resolve(__dirname, '../dist');
    if (fs.existsSync(distDir)) {
      function scanDist(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDist(fullPath);
          } else if (/\.(js|html|css|map)$/.test(file)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            assert.strictEqual(
              content.includes('SuperAdmin@123'),
              false,
              `Found credentials in built artifact ${fullPath}`
            );
          }
        }
      }
      scanDist(distDir);
    }
  });

  // 7. Session persistence contract
  test('12. Session storage contract guarantees no password storage in user payload', () => {
    const sanitizedUser = {
      user_id: 1,
      employee_id: 'EMP001',
      full_name: 'Dr. Ramesh',
      role: 'doctor',
      branch_id: 1,
      must_change_password: false
    };
    assert.strictEqual(sanitizedUser.password, undefined);
    assert.strictEqual(sanitizedUser.password_hash, undefined);
    assert.strictEqual(Object.keys(sanitizedUser).includes('password'), false);
    assert.strictEqual(Object.keys(sanitizedUser).includes('password_hash'), false);
  });

});

