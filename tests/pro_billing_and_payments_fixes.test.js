import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('PRO Billing & Payments Routes & Features Verification Suite', async (t) => {
  const appPath = path.resolve('src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  const billingPagePath = path.resolve('src/pages/pro/PROBillingPage.jsx');
  const billingPageContent = fs.readFileSync(billingPagePath, 'utf8');

  const paymentsPagePath = path.resolve('src/pages/pro/PROPaymentsPage.jsx');
  const paymentsPageContent = fs.readFileSync(paymentsPagePath, 'utf8');

  await t.test('1. App.jsx registers /pro/payments/refunds route', () => {
    assert.match(appContent, /Route path="payments\/refunds" element={<PROPaymentsPage \/>}/);
  });

  await t.test('2. App.jsx registers /pro/payments/refund-history redirect route', () => {
    assert.match(appContent, /Route path="payments\/refund-history" element={<Navigate to="\/pro\/payments\/refunds" replace \/>}/);
  });

  await t.test('3. App.jsx registers /pro/billing/reports route', () => {
    assert.match(appContent, /Route path="billing\/reports" element={<PROBillingPage \/>}/);
  });

  await t.test('4. App.jsx registers /pro/billing/operational-reports redirect route', () => {
    assert.match(appContent, /Route path="billing\/operational-reports" element={<Navigate to="\/pro\/billing\/reports" replace \/>}/);
  });

  await t.test('5. PROPaymentsPage handles refunds and refund-history in initialTab', () => {
    assert.match(paymentsPageContent, /path\.includes\('\/refunds'\) \|\| path\.includes\('\/refund-history'\)/);
  });

  await t.test('6. PROBillingPage handles reports and operational-reports in initialTab', () => {
    assert.match(billingPageContent, /path\.includes\('\/reports'\) \|\| path\.includes\('\/operational-reports'\)/);
  });

  await t.test('7. PROBillingPage header button submits form when activeTab is new', () => {
    assert.match(billingPageContent, /activeTab === 'new'/);
    assert.match(billingPageContent, /requestSubmit\(\)/);
    assert.match(billingPageContent, /\+ Save & Generate Bill/);
  });

  await t.test('8. PROBillingPage form has id="pro-billing-form"', () => {
    assert.match(billingPageContent, /id="pro-billing-form"/);
  });

  await t.test('9. PROBillingPage supports live patient search via proApi.searchPatients', () => {
    assert.match(billingPageContent, /proApi\.searchPatients/);
    assert.match(billingPageContent, /patientSearchTerm/);
    assert.match(billingPageContent, /handleSelectPatient/);
  });

  await t.test('10. PROBillingPage verifyPatient resolves registration IDs (REG-) and numeric IDs', () => {
    assert.match(billingPageContent, /startsWith\('REG'\)/);
  });
});
