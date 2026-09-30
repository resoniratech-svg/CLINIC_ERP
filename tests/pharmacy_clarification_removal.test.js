import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// PHARMACY PORTAL — CLARIFICATION WORKFLOW REMOVAL & REGRESSION TEST SUITE
// ============================================================================

const PHARMACY_CLARIFICATIONS_PAGE = path.resolve(process.cwd(), 'src/pages/pharmacy/PrescriptionClarificationsPage.jsx');
const PROCESS_PRESCRIPTION_PAGE = path.resolve(process.cwd(), 'src/pages/pharmacy/ProcessPrescriptionPage.jsx');
const SIDEBAR_FILE = path.resolve(process.cwd(), 'src/components/layout/PharmacySidebar.jsx');
const APP_FILE = path.resolve(process.cwd(), 'src/App.jsx');
const API_FILE = path.resolve(process.cwd(), 'src/api/index.js');

describe('Pharmacy Portal — Clarification Workflow Removal Verification Suite', () => {
  const sidebarContent = fs.readFileSync(SIDEBAR_FILE, 'utf-8');
  const processPageContent = fs.readFileSync(PROCESS_PRESCRIPTION_PAGE, 'utf-8');
  const appContent = fs.readFileSync(APP_FILE, 'utf-8');
  const apiContent = fs.readFileSync(API_FILE, 'utf-8');

  // 1. Sidebar Menu Item Removal
  describe('1. Pharmacy Sidebar Menu Removal', () => {
    test('1.1 Sidebar does NOT contain link to /pharmacy/clarifications', () => {
      assert.strictEqual(
        sidebarContent.includes('to="/pharmacy/clarifications"'),
        false,
        'Pharmacy sidebar must NOT contain link to /pharmacy/clarifications'
      );
    });

    test('1.2 Sidebar does NOT display "Prescription Clarification" text', () => {
      assert.strictEqual(
        sidebarContent.includes('Prescription Clarification'),
        false,
        'Pharmacy sidebar must NOT display "Prescription Clarification" text'
      );
    });

    test('1.3 Sidebar preserves all 9 required navigation items', () => {
      const requiredRoutes = [
        '/pharmacy/dashboard',
        '/pharmacy/queue',
        '/pharmacy/patients',
        '/pharmacy/dispensing',
        '/pharmacy/inventory',
        '/pharmacy/transactions',
        '/pharmacy/returns',
        '/pharmacy/adjustments',
        '/pharmacy/profile'
      ];

      for (const route of requiredRoutes) {
        assert.ok(sidebarContent.includes(`to="${route}"`), `Sidebar must retain link to ${route}`);
      }
    });
  });

  // 2. Process Prescription Page Header Clean-up
  describe('2. Process Prescription Header Clean-up', () => {
    test('2.1 Header does NOT contain "Raise Clarification" button', () => {
      assert.strictEqual(
        processPageContent.includes('Raise Clarification'),
        false,
        'Process Prescription page must NOT render "Raise Clarification" button'
      );
    });

    test('2.2 Header retains Save Draft and Dispense Medicines action buttons', () => {
      assert.ok(processPageContent.includes('Save Draft'), 'Must retain Save Draft action');
      assert.ok(processPageContent.includes('Dispense Medicines'), 'Must retain Dispense Medicines action');
      assert.ok(processPageContent.includes('handleSaveDraft'), 'Must retain handleSaveDraft handler');
      assert.ok(processPageContent.includes('handleCompleteDispensing'), 'Must retain handleCompleteDispensing handler');
    });
  });

  // 3. Medicine Table Actions Column Clean-up
  describe('3. Medicine Table Actions Column Clean-up', () => {
    test('3.1 Medicine row Actions column does NOT contain "Clarify" button', () => {
      assert.strictEqual(
        processPageContent.includes('<span>Clarify</span>') ||
        processPageContent.includes('>Clarify<'),
        false,
        'Medicine table rows must NOT contain a "Clarify" button'
      );
    });

    test('3.2 Medicine table retains essential dispensing columns', () => {
      assert.ok(processPageContent.includes('Medicine & Potency'), 'Must retain medicine column');
      assert.ok(processPageContent.includes('Dosage / Frequency'), 'Must retain dosage column');
      assert.ok(processPageContent.includes('Duration'), 'Must retain duration column');
      assert.ok(processPageContent.includes('Stock Check'), 'Must retain stock check column');
      assert.ok(processPageContent.includes('FEFO Batch Selection'), 'Must retain batch selection column');
      assert.ok(processPageContent.includes('Dispense Qty'), 'Must retain dispense qty column');
      assert.ok(processPageContent.includes('Actions'), 'Must retain actions column');
    });
  });

  // 4. Modal & State Removal
  describe('4. Component State & Clarification Modal Clean-up', () => {
    test('4.1 Raise Clarification modal markup is completely removed', () => {
      assert.strictEqual(
        processPageContent.includes('title="Raise Clarification to Doctor"'),
        false,
        'Clarification modal title must not exist in ProcessPrescriptionPage'
      );
      assert.strictEqual(
        processPageContent.includes('handleSaveClarification'),
        false,
        'handleSaveClarification must be removed'
      );
      assert.strictEqual(
        processPageContent.includes('clarificationModalOpen'),
        false,
        'clarificationModalOpen state must be removed'
      );
    });

    test('4.2 PrescriptionClarificationsPage component is deleted from disk', () => {
      assert.strictEqual(
        fs.existsSync(PHARMACY_CLARIFICATIONS_PAGE),
        false,
        'PrescriptionClarificationsPage.jsx must be deleted to prevent mounting'
      );
    });
  });

  // 5. Routing & Direct URL Redirection
  describe('5. Route Protection & Direct URL Redirection', () => {
    test('5.1 App.jsx does NOT import PrescriptionClarificationsPage', () => {
      assert.strictEqual(
        appContent.includes('PrescriptionClarificationsPage'),
        false,
        'App.jsx must not import PrescriptionClarificationsPage'
      );
    });

    test('5.2 App.jsx redirects /pharmacy/clarifications to /pharmacy/dispensing', () => {
      assert.ok(
        appContent.includes('<Route path="clarifications" element={<Navigate to="/pharmacy/dispensing" replace />} />'),
        'Must redirect /pharmacy/clarifications to /pharmacy/dispensing'
      );
    });

    test('5.3 App.jsx redirects /pharmacy/clarification and prescription-clarification aliases', () => {
      assert.ok(
        appContent.includes('<Route path="clarification" element={<Navigate to="/pharmacy/dispensing" replace />} />'),
        'Must redirect /pharmacy/clarification to /pharmacy/dispensing'
      );
      assert.ok(
        appContent.includes('<Route path="prescription-clarification" element={<Navigate to="/pharmacy/dispensing" replace />} />'),
        'Must redirect /pharmacy/prescription-clarification to /pharmacy/dispensing'
      );
    });
  });

  // 6. API Service Clean-up
  describe('6. API Service Clean-up & Isolation', () => {
    test('6.1 pharmacyApi does NOT expose clarification endpoints', () => {
      assert.strictEqual(
        apiContent.includes('createClarification: (data) => axiosClient.post(\'/pharmacy/clarifications\''),
        false,
        'pharmacyApi must not export createClarification'
      );
      assert.strictEqual(
        apiContent.includes('closeClarification: (id, data) => axiosClient.put(`/pharmacy/clarifications'),
        false,
        'pharmacyApi must not export closeClarification'
      );
    });

    test('6.2 Doctor clarification API methods remain preserved for other roles', () => {
      assert.ok(
        apiContent.includes('getClarifications: (params) => axiosClient.get(\'/doctor/clarifications\''),
        'Doctor clarification inquiries must be preserved'
      );
      assert.ok(
        apiContent.includes('respondToClarification: (id, data) => axiosClient.post(`/doctor/clarifications/${id}/respond`'),
        'Doctor response endpoints must be preserved'
      );
    });
  });
});
