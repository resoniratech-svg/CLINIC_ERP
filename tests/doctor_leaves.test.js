import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// DOCTOR PORTAL — LEAVE REQUESTS MODULE FRONTEND & CONTRACT INTEGRATION TEST
// ============================================================================

const DOCTOR_LEAVES_PAGE = path.resolve(process.cwd(), 'src/pages/doctor/DoctorLeavesPage.jsx');
const API_FILE = path.resolve(process.cwd(), 'src/api/index.js');
const APP_FILE = path.resolve(process.cwd(), 'src/App.jsx');
const SIDEBAR_FILE = path.resolve(process.cwd(), 'src/components/layout/DoctorSidebar.jsx');

describe('Doctor Portal — Leave Requests Module Frontend & Contract Suite', () => {
  const pageContent = fs.readFileSync(DOCTOR_LEAVES_PAGE, 'utf-8');
  const apiContent = fs.readFileSync(API_FILE, 'utf-8');
  const appContent = fs.readFileSync(APP_FILE, 'utf-8');
  const sidebarContent = fs.readFileSync(SIDEBAR_FILE, 'utf-8');

  // 1. Navigation & Routing Architecture
  describe('1. Navigation & Routing Architecture', () => {
    test('1.1 App.jsx registers route "/leaves" pointing to DoctorLeavesPage', () => {
      assert.ok(
        appContent.includes('path="leaves"') || appContent.includes('/doctor/leaves'),
        'App.jsx must declare leaves route'
      );
      assert.ok(
        appContent.includes('DoctorLeavesPage'),
        'App.jsx must import and mount DoctorLeavesPage component'
      );
    });

    test('1.2 DoctorSidebar contains NavLink to "/doctor/leaves" labeled "Leave Requests"', () => {
      assert.ok(
        sidebarContent.includes('to="/doctor/leaves"'),
        'DoctorSidebar must link to /doctor/leaves'
      );
      assert.ok(
        sidebarContent.includes('Leave Requests'),
        'DoctorSidebar must label the link as Leave Requests'
      );
    });

    test('1.3 Zero localStorage or sessionStorage used for leave data persistence', () => {
      assert.strictEqual(
        pageContent.includes('localStorage.setItem') || pageContent.includes('sessionStorage.setItem'),
        false,
        'Leaves page must not persist leave records in browser storage'
      );
    });
  });

  // 2. Component Architecture & UI Controls
  describe('2. Component Architecture & UI Controls', () => {
    test('2.1 Header contains title "Leave Requests" and description', () => {
      assert.ok(pageContent.includes('Leave Requests'), 'Must contain header Leave Requests');
      assert.ok(pageContent.includes('Apply for leave and track approval status'), 'Must describe approval tracking');
    });

    test('2.2 Header has Refresh button and "+ Apply for Leave" button', () => {
      assert.ok(pageContent.includes('RefreshCw'), 'Must contain refresh icon button');
      assert.ok(pageContent.includes('Apply for Leave'), 'Must contain Apply for Leave button');
      assert.ok(pageContent.includes('setShowForm'), 'Must toggle form visibility on click');
    });

    test('2.3 Apply for Leave form contains From Date, To Date, Reason, and Remarks fields', () => {
      assert.ok(pageContent.includes('from_date'), 'Form must bind from_date');
      assert.ok(pageContent.includes('to_date'), 'Form must bind to_date');
      assert.ok(pageContent.includes('reason'), 'Form must bind reason');
      assert.ok(pageContent.includes('remarks'), 'Form must bind remarks');
    });

    test('2.4 Reason dropdown includes "Attending Medical Conference" matching database records', () => {
      assert.ok(
        pageContent.includes('Attending Medical Conference'),
        'Dropdown must contain Attending Medical Conference option'
      );
      assert.ok(pageContent.includes('Medical Leave'), 'Dropdown must contain Medical Leave option');
      assert.ok(pageContent.includes('Family Emergency'), 'Dropdown must contain Family Emergency option');
      assert.ok(pageContent.includes('Planned Vacation'), 'Dropdown must contain Planned Vacation option');
    });

    test('2.5 Cancel button resets form fields and closes form section', () => {
      assert.ok(pageContent.includes('handleCancel'), 'Must have handleCancel function');
      assert.ok(pageContent.includes('Cancel'), 'Must render Cancel button');
    });

    test('2.6 Submit button prevents rapid double submissions with spinner and disabled state', () => {
      assert.ok(pageContent.includes('disabled={submitting}'), 'Submit button must disable when submitting');
      assert.ok(pageContent.includes('submitting ?'), 'Submit button must reflect submitting status');
    });

    test('2.7 Error state renders retry "Try Again" button for network resilience', () => {
      assert.ok(pageContent.includes('Try Again'), 'Must provide Try Again button on error');
      assert.ok(pageContent.includes('fetchLeaves'), 'Try Again button must trigger fetchLeaves');
    });
  });

  // 3. Date Math & Validation Logic
  describe('3. Date Math & Day Count Logic', () => {
    // Replicate calcDays logic from component
    const calcDays = (from, to) => {
      if (!from || !to) return 0;
      const [y1, m1, d1] = String(from).split('-').map(Number);
      const [y2, m2, d2] = String(to).split('-').map(Number);
      if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
      const t1 = Date.UTC(y1, m1 - 1, d1);
      const t2 = Date.UTC(y2, m2 - 1, d2);
      if (t2 < t1) return 0;
      return Math.round((t2 - t1) / (1000 * 60 * 60 * 24)) + 1;
    };

    test('3.1 Same-day leave counts as 1 day', () => {
      assert.strictEqual(calcDays('2026-09-20', '2026-09-20'), 1);
    });

    test('3.2 Three-day leave (2026-09-20 to 2026-09-22) counts as 3 days', () => {
      assert.strictEqual(calcDays('2026-09-20', '2026-09-22'), 3);
    });

    test('3.3 Inverted dates return 0 days', () => {
      assert.strictEqual(calcDays('2026-09-25', '2026-09-20'), 0);
    });

    test('3.4 Empty or undefined dates return 0 days', () => {
      assert.strictEqual(calcDays('', '2026-09-20'), 0);
      assert.strictEqual(calcDays('2026-09-20', ''), 0);
      assert.strictEqual(calcDays(null, null), 0);
    });

    test('3.5 Frontend validates that to_date is not earlier than from_date before submitting', () => {
      assert.ok(
        pageContent.includes('form.to_date < form.from_date'),
        'Must validate to_date >= from_date before submitting'
      );
    });
  });

  // 4. Leave History & Status Rendering
  describe('4. Leave History & Status Rendering', () => {
    test('4.1 Status colors cover pending, approved, and rejected', () => {
      assert.ok(pageContent.includes('pending'), 'Status colors must support pending');
      assert.ok(pageContent.includes('approved'), 'Status colors must support approved');
      assert.ok(pageContent.includes('rejected'), 'Status colors must support rejected');
    });

    test('4.2 Empty state renders CalendarOff icon and clear message', () => {
      assert.ok(pageContent.includes('No leave requests found'), 'Must show empty message');
      assert.ok(pageContent.includes('CalendarOff'), 'Must render CalendarOff icon');
    });

    test('4.3 Remarks / covering doctor note rendered cleanly', () => {
      assert.ok(pageContent.includes('l.remarks'), 'Must render remarks when present');
    });

    test('4.4 Reviewed by info rendered when approved_by_name is provided', () => {
      assert.ok(pageContent.includes('approved_by_name'), 'Must render reviewer name when present');
    });
  });

  // 5. API Service Contracts
  describe('5. API Service Contracts', () => {
    test('5.1 doctorApi.applyLeave sends POST to /doctor/leaves', () => {
      assert.ok(
        apiContent.includes("applyLeave: (data) => axiosClient.post('/doctor/leaves', data)"),
        'applyLeave must invoke POST /doctor/leaves'
      );
    });

    test('5.2 doctorApi.getMyLeaves sends GET to /doctor/leaves/mine', () => {
      assert.ok(
        apiContent.includes("getMyLeaves: () => axiosClient.get('/doctor/leaves/mine')"),
        'getMyLeaves must invoke GET /doctor/leaves/mine'
      );
    });
  });
});
