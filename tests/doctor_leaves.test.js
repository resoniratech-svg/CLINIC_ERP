import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// DOCTOR PORTAL — COMPLETE LEAVE REQUESTS REMOVAL & REGRESSION SUITE
// ============================================================================

const DOCTOR_LEAVES_PAGE = path.resolve(process.cwd(), 'src/pages/doctor/DoctorLeavesPage.jsx');
const API_FILE = path.resolve(process.cwd(), 'src/api/index.js');
const APP_FILE = path.resolve(process.cwd(), 'src/App.jsx');
const SIDEBAR_FILE = path.resolve(process.cwd(), 'src/components/layout/DoctorSidebar.jsx');
const DASHBOARD_FILE = path.resolve(process.cwd(), 'src/pages/doctor/DoctorDashboard.jsx');

describe('Doctor Portal — Leave Requests Removal Verification Suite', () => {
  const apiContent = fs.readFileSync(API_FILE, 'utf-8');
  const appContent = fs.readFileSync(APP_FILE, 'utf-8');
  const sidebarContent = fs.readFileSync(SIDEBAR_FILE, 'utf-8');
  const dashboardContent = fs.readFileSync(DASHBOARD_FILE, 'utf-8');

  // 1. Doctor Sidebar Removal Verification
  describe('1. Doctor Sidebar Menu Removal', () => {
    test('1.1 DoctorSidebar does NOT contain any link to "/doctor/leaves"', () => {
      assert.strictEqual(
        sidebarContent.includes('to="/doctor/leaves"'),
        false,
        'DoctorSidebar must NOT contain any link to /doctor/leaves'
      );
    });

    test('1.2 DoctorSidebar does NOT display "Leave Requests" text', () => {
      assert.strictEqual(
        sidebarContent.includes('Leave Requests'),
        false,
        'DoctorSidebar must NOT display "Leave Requests" label'
      );
    });

    test('1.3 DoctorSidebar does NOT import or render CalendarOff icon', () => {
      assert.strictEqual(
        sidebarContent.includes('CalendarOff'),
        false,
        'DoctorSidebar must not import or render CalendarOff icon'
      );
    });

    test('1.4 DoctorSidebar preserves all required menu items', () => {
      const requiredLinks = [
        '/doctor/dashboard',
        '/doctor/appointments',
        '/doctor/queue',
        '/doctor/patients',
        '/doctor/consultations',
        '/doctor/prescriptions',
        '/doctor/treatment-plans',
        '/doctor/targets',
        '/doctor/profile'
      ];
      for (const link of requiredLinks) {
        assert.ok(
          sidebarContent.includes(`to="${link}"`),
          `DoctorSidebar must retain link to ${link}`
        );
      }
    });
  });

  // 2. Doctor Routing & Direct URL Redirect
  describe('2. Routing & Direct URL Access Protection', () => {
    test('2.1 App.jsx does NOT import DoctorLeavesPage component', () => {
      assert.strictEqual(
        appContent.includes('DoctorLeavesPage'),
        false,
        'App.jsx must NOT import or mount DoctorLeavesPage'
      );
    });

    test('2.2 DoctorLeavesPage component file is removed from disk', () => {
      assert.strictEqual(
        fs.existsSync(DOCTOR_LEAVES_PAGE),
        false,
        'DoctorLeavesPage.jsx must be deleted to prevent unauthorized mounting'
      );
    });

    test('2.3 Direct access to /doctor/leaves redirects to /doctor/dashboard', () => {
      assert.ok(
        appContent.includes('<Route path="leaves" element={<Navigate to="/doctor/dashboard" replace />} />') ||
        appContent.includes('path="leaves" element={<Navigate to="/doctor/dashboard"'),
        'Direct access to leaves must redirect immediately to /doctor/dashboard'
      );
    });
  });

  // 3. Doctor Dashboard Quick Actions Clean-up
  describe('3. Doctor Dashboard Navigation Clean-up', () => {
    test('3.1 DoctorDashboard does NOT contain link to /doctor/leaves', () => {
      assert.strictEqual(
        dashboardContent.includes('/doctor/leaves'),
        false,
        'DoctorDashboard must not contain any link to /doctor/leaves'
      );
    });

    test('3.2 DoctorDashboard does NOT contain "Apply Leave" text', () => {
      assert.strictEqual(
        dashboardContent.includes('Apply Leave'),
        false,
        'DoctorDashboard must not contain "Apply Leave" quick action'
      );
    });

    test('3.3 DoctorDashboard preserves clinical quick actions', () => {
      assert.ok(dashboardContent.includes('/doctor/queue'), 'Must retain Patient Queue quick action');
      assert.ok(dashboardContent.includes('/doctor/appointments'), 'Must retain Appointments quick action');
      assert.ok(dashboardContent.includes('/doctor/consultations'), 'Must retain Consultation History quick action');
    });
  });

  // 4. API & Unused Code Clean-up
  describe('4. Unused Code & API Clean-up', () => {
    test('4.1 doctorApi does NOT expose applyLeave or getMyLeaves methods', () => {
      assert.strictEqual(
        apiContent.includes('applyLeave:'),
        false,
        'doctorApi must not export applyLeave'
      );
      assert.strictEqual(
        apiContent.includes('getMyLeaves:'),
        false,
        'doctorApi must not export getMyLeaves'
      );
    });
  });
});
