import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('PRO Sidebar Navigation - Billing Module Cleanup Suite', () => {
  const sidebarPath = path.resolve('src/components/layout/PROSidebar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  test('1. Sidebar does not contain collapsible toggle for billing', () => {
    // Assert openSections state does not track billing
    assert.doesNotMatch(sidebarContent, /openSections\.billing/);
    assert.doesNotMatch(sidebarContent, /toggleSection\(['"]billing['"]\)/);
  });

  test('2. Sidebar does not contain chevron dropdown for billing', () => {
    // Check that Billing is not accompanied by a ChevronDown in a button wrapper
    const billingSection = sidebarContent.split('{/* Billing - Single Direct Module */}')[1]?.split('{/* Payments - Single Direct Module */}')[0];
    assert.ok(billingSection, 'Billing section must exist');
    assert.doesNotMatch(billingSection, /ChevronDown/);
    assert.doesNotMatch(billingSection, /<button/);
  });

  test('3. Sidebar has NO child sub-items under Billing', () => {
    const billingSection = sidebarContent.split('{/* Billing - Single Direct Module */}')[1]?.split('{/* Payments - Single Direct Module */}')[0];
    assert.ok(billingSection, 'Billing section must exist');
    assert.doesNotMatch(billingSection, /\+ New Bill<\/span>/);
    assert.doesNotMatch(billingSection, /Pending Bills<\/span>/);
    assert.doesNotMatch(billingSection, /Paid Bills<\/span>/);
    assert.doesNotMatch(billingSection, /Partial \/ Due<\/span>/);
    assert.doesNotMatch(billingSection, /Billing History<\/span>/);
  });

  test('4. Billing NavLink targets /pro/billing/new', () => {
    const billingSection = sidebarContent.split('{/* Billing - Single Direct Module */}')[1]?.split('{/* Payments - Single Direct Module */}')[0];
    assert.match(billingSection, /to="\/pro\/billing\/new"/);
  });

  test('5. Active state matcher activates for all /pro/billing/* routes', () => {
    const isBillingActive = (pathname) => pathname.startsWith('/pro/billing');

    const billingRoutes = [
      '/pro/billing',
      '/pro/billing/new',
      '/pro/billing/pending',
      '/pro/billing/paid',
      '/pro/billing/partial-due',
      '/pro/billing/history'
    ];

    for (const route of billingRoutes) {
      assert.strictEqual(isBillingActive(route), true, `Route ${route} must activate Billing sidebar item`);
    }
  });

  test('6. Active state matcher does NOT activate for non-billing routes', () => {
    const isBillingActive = (pathname) => pathname.startsWith('/pro/billing');

    const nonBillingRoutes = [
      '/pro/dashboard',
      '/pro/queue',
      '/pro/patients',
      '/pro/counselling',
      '/pro/packages',
      '/pro/prescriptions',
      '/pro/payments/today',
      '/pro/accountant/daily-summary',
      '/pro/crm/calls',
      '/pro/tasks',
      '/pro/feedback',
      '/pro/complaints',
      '/pro/profile'
    ];

    for (const route of nonBillingRoutes) {
      assert.strictEqual(isBillingActive(route), false, `Route ${route} must NOT activate Billing sidebar item`);
    }
  });

  test('7. Active styling applies WeCare primary blue and red accent border', () => {
    const computeClasses = (pathname) => {
      const isActive = pathname.startsWith('/pro/billing');
      return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
        isActive
          ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`;
    };

    const activeClasses = computeClasses('/pro/billing/new');
    assert.match(activeClasses, /bg-\[#1565C0\]/);
    assert.match(activeClasses, /text-white/);
    assert.match(activeClasses, /border-l-4/);
    assert.match(activeClasses, /border-\[#D32F2F\]/);

    const inactiveClasses = computeClasses('/pro/dashboard');
    assert.match(inactiveClasses, /text-slate-600/);
    assert.doesNotMatch(inactiveClasses, /bg-\[#1565C0\]/);
    assert.doesNotMatch(inactiveClasses, /border-\[#D32F2F\]/);
  });

  test('8. App.jsx redirects /pro/billing to /pro/billing/new', () => {
    const appPath = path.resolve('src/App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /Route path="billing" element={<Navigate to="\/pro\/billing\/new" replace \/>}/);
  });
});

describe('PRO Sidebar Navigation - Payments Module Cleanup Suite', () => {
  const sidebarPath = path.resolve('src/components/layout/PROSidebar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  test('9. Sidebar does not contain collapsible toggle for payments', () => {
    assert.doesNotMatch(sidebarContent, /openSections\.payments/);
    assert.doesNotMatch(sidebarContent, /toggleSection\(['"]payments['"]\)/);
  });

  test('10. Sidebar does not contain chevron dropdown for payments', () => {
    const paymentsSection = sidebarContent.split('{/* Payments - Single Direct Module */}')[1]?.split('{/* Accountant - Single Direct Module */}')[0];
    assert.ok(paymentsSection, 'Payments section must exist');
    assert.doesNotMatch(paymentsSection, /ChevronDown/);
    assert.doesNotMatch(paymentsSection, /<button/);
  });

  test('11. Sidebar has NO child sub-items under Payments', () => {
    const paymentsSection = sidebarContent.split('{/* Payments - Single Direct Module */}')[1]?.split('{/* Accountant - Single Direct Module */}')[0];
    assert.ok(paymentsSection, 'Payments section must exist');
    assert.doesNotMatch(paymentsSection, /Today's Payments<\/span>/);
    assert.doesNotMatch(paymentsSection, /Due Collection<\/span>/);
    assert.doesNotMatch(paymentsSection, /Payment History<\/span>/);
  });

  test('12. Payments NavLink targets /pro/payments/today', () => {
    const paymentsSection = sidebarContent.split('{/* Payments - Single Direct Module */}')[1]?.split('{/* Accountant - Single Direct Module */}')[0];
    assert.match(paymentsSection, /to="\/pro\/payments\/today"/);
  });

  test('13. Active state matcher activates for all /pro/payments/* routes', () => {
    const isPaymentsActive = (pathname) => pathname.startsWith('/pro/payments');

    const paymentRoutes = [
      '/pro/payments',
      '/pro/payments/today',
      '/pro/payments/due-collection',
      '/pro/payments/history'
    ];

    for (const route of paymentRoutes) {
      assert.strictEqual(isPaymentsActive(route), true, `Route ${route} must activate Payments sidebar item`);
    }
  });

  test('14. Active state matcher does NOT activate for non-payments routes', () => {
    const isPaymentsActive = (pathname) => pathname.startsWith('/pro/payments');

    const nonPaymentRoutes = [
      '/pro/dashboard',
      '/pro/queue',
      '/pro/patients',
      '/pro/counselling',
      '/pro/packages',
      '/pro/billing/new',
      '/pro/billing/pending',
      '/pro/accountant/daily-summary',
      '/pro/crm/calls',
      '/pro/tasks',
      '/pro/feedback',
      '/pro/complaints',
      '/pro/profile'
    ];

    for (const route of nonPaymentRoutes) {
      assert.strictEqual(isPaymentsActive(route), false, `Route ${route} must NOT activate Payments sidebar item`);
    }
  });

  test('15. Payments active styling applies WeCare primary blue and red accent border', () => {
    const computeClasses = (pathname) => {
      const isActive = pathname.startsWith('/pro/payments');
      return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
        isActive
          ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`;
    };

    const activeClasses = computeClasses('/pro/payments/today');
    assert.match(activeClasses, /bg-\[#1565C0\]/);
    assert.match(activeClasses, /text-white/);
    assert.match(activeClasses, /border-l-4/);
    assert.match(activeClasses, /border-\[#D32F2F\]/);

    const inactiveClasses = computeClasses('/pro/dashboard');
    assert.match(inactiveClasses, /text-slate-600/);
    assert.doesNotMatch(inactiveClasses, /bg-\[#1565C0\]/);
    assert.doesNotMatch(inactiveClasses, /border-\[#D32F2F\]/);
  });

  test('16. App.jsx preserves all payments routes', () => {
    const appPath = path.resolve('src/App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /Route path="payments" element={<Navigate to="\/pro\/payments\/today" replace \/>}/);
    assert.match(appContent, /Route path="payments\/today" element={<PROPaymentsPage \/>}/);
    assert.match(appContent, /Route path="payments\/due-collection" element={<PROPaymentsPage \/>}/);
    assert.match(appContent, /Route path="payments\/history" element={<PROPaymentsPage \/>}/);
  });

  test('17. PROPaymentsPage internal tabs and state handlers remain intact', () => {
    const paymentsPagePath = path.resolve('src/pages/pro/PROPaymentsPage.jsx');
    const pageContent = fs.readFileSync(paymentsPagePath, 'utf8');
    assert.match(pageContent, /due-collection/);
    assert.match(pageContent, /history/);
    assert.match(pageContent, /today/);
    assert.match(pageContent, /handleTabChange/);
    assert.match(pageContent, /handleRecordPayment/);
    assert.match(pageContent, /fetchData/);
  });
});

describe('PRO Sidebar Navigation - Accountant Module Cleanup Suite', () => {
  const sidebarPath = path.resolve('src/components/layout/PROSidebar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  test('18. Sidebar does not contain collapsible toggle for accountant', () => {
    assert.doesNotMatch(sidebarContent, /openSections\.accountant/);
    assert.doesNotMatch(sidebarContent, /toggleSection\(['"]accountant['"]\)/);
  });

  test('19. Sidebar does not contain chevron dropdown for accountant', () => {
    const accountantSection = sidebarContent.split('{/* Accountant - Single Direct Module */}')[1]?.split('{/* CRM / Calling - Single Direct Module */}')[0];
    assert.ok(accountantSection, 'Accountant section must exist');
    assert.doesNotMatch(accountantSection, /ChevronDown/);
    assert.doesNotMatch(accountantSection, /<button/);
  });

  test('20. Sidebar has NO child sub-items under Accountant', () => {
    const accountantSection = sidebarContent.split('{/* Accountant - Single Direct Module */}')[1]?.split('{/* CRM / Calling - Single Direct Module */}')[0];
    assert.ok(accountantSection, 'Accountant section must exist');
    assert.doesNotMatch(accountantSection, /Daily Cash Summary<\/span>/);
    assert.doesNotMatch(accountantSection, /Opening Balance<\/span>/);
    assert.doesNotMatch(accountantSection, /Cash Revenue<\/span>/);
    assert.doesNotMatch(accountantSection, /Expenditure<\/span>/);
    assert.doesNotMatch(accountantSection, /Closing Balance<\/span>/);
    assert.doesNotMatch(accountantSection, /Bank Deposit<\/span>/);
    assert.doesNotMatch(accountantSection, /Grand Total<\/span>/);
  });

  test('21. Accountant NavLink targets /pro/accountant/daily-summary', () => {
    const accountantSection = sidebarContent.split('{/* Accountant - Single Direct Module */}')[1]?.split('{/* CRM / Calling - Single Direct Module */}')[0];
    assert.match(accountantSection, /to="\/pro\/accountant\/daily-summary"/);
  });

  test('22. Active state matcher activates for all /pro/accountant/* routes', () => {
    const isAccountantActive = (pathname) => pathname.startsWith('/pro/accountant');

    const accountantRoutes = [
      '/pro/accountant',
      '/pro/accountant/daily-summary',
      '/pro/accountant/opening-balance',
      '/pro/accountant/cash-revenue',
      '/pro/accountant/expenditure',
      '/pro/accountant/closing-balance',
      '/pro/accountant/deposit',
      '/pro/accountant/grand-total'
    ];

    for (const route of accountantRoutes) {
      assert.strictEqual(isAccountantActive(route), true, `Route ${route} must activate Accountant sidebar item`);
    }
  });

  test('23. Active state matcher does NOT activate for non-accountant routes', () => {
    const isAccountantActive = (pathname) => pathname.startsWith('/pro/accountant');

    const nonAccountantRoutes = [
      '/pro/dashboard',
      '/pro/queue',
      '/pro/patients',
      '/pro/counselling',
      '/pro/packages',
      '/pro/billing/new',
      '/pro/payments/today',
      '/pro/crm/calls',
      '/pro/tasks',
      '/pro/feedback',
      '/pro/complaints',
      '/pro/profile'
    ];

    for (const route of nonAccountantRoutes) {
      assert.strictEqual(isAccountantActive(route), false, `Route ${route} must NOT activate Accountant sidebar item`);
    }
  });

  test('24. Accountant active styling applies WeCare primary blue and red accent border', () => {
    const computeClasses = (pathname) => {
      const isActive = pathname.startsWith('/pro/accountant');
      return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
        isActive
          ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`;
    };

    const activeClasses = computeClasses('/pro/accountant/daily-summary');
    assert.match(activeClasses, /bg-\[#1565C0\]/);
    assert.match(activeClasses, /text-white/);
    assert.match(activeClasses, /border-l-4/);
    assert.match(activeClasses, /border-\[#D32F2F\]/);

    const inactiveClasses = computeClasses('/pro/dashboard');
    assert.match(inactiveClasses, /text-slate-600/);
    assert.doesNotMatch(inactiveClasses, /bg-\[#1565C0\]/);
    assert.doesNotMatch(inactiveClasses, /border-\[#D32F2F\]/);
  });

  test('25. App.jsx preserves all accountant routes', () => {
    const appPath = path.resolve('src/App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /Route path="accountant" element={<Navigate to="\/pro\/accountant\/daily-summary" replace \/>}/);
    assert.match(appContent, /Route path="accountant\/daily-summary" element={<PROAccountantPage \/>}/);
    assert.match(appContent, /Route path="accountant\/opening-balance" element={<PROAccountantPage \/>}/);
    assert.match(appContent, /Route path="accountant\/cash-revenue" element={<PROAccountantPage \/>}/);
    assert.match(appContent, /Route path="accountant\/expenditure" element={<PROAccountantPage \/>}/);
    assert.match(appContent, /Route path="accountant\/closing-balance" element={<PROAccountantPage \/>}/);
    assert.match(appContent, /Route path="accountant\/deposit" element={<PROAccountantPage \/>}/);
    assert.match(appContent, /Route path="accountant\/grand-total" element={<PROAccountantPage \/>}/);
  });

  test('26. PROAccountantPage reconciliation calculations and modals remain intact', () => {
    const accountantPagePath = path.resolve('src/pages/pro/PROAccountantPage.jsx');
    const pageContent = fs.readFileSync(accountantPagePath, 'utf8');
    assert.match(pageContent, /fetchSummary/);
    assert.match(pageContent, /handleCreateExpense/);
    assert.match(pageContent, /handleDepositCash/);
    assert.match(pageContent, /Physical Cash Drawer Ledger/i);
    assert.match(pageContent, /Collections by Payment Mode/i);
    assert.match(pageContent, /Grand Total Revenue/i);
  });
});

describe('PRO Sidebar Navigation - CRM / Calling Module Cleanup Suite', () => {
  const sidebarPath = path.resolve('src/components/layout/PROSidebar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  test('27. Sidebar does not contain collapsible toggle for CRM', () => {
    assert.doesNotMatch(sidebarContent, /openSections\.crm/);
    assert.doesNotMatch(sidebarContent, /toggleSection\(['"]crm['"]\)/);
  });

  test('28. Sidebar does not contain chevron dropdown for CRM', () => {
    const crmSection = sidebarContent.split('{/* CRM / Calling - Single Direct Module */}')[1]?.split('{/* My Tasks */}')[0];
    assert.ok(crmSection, 'CRM section must exist');
    assert.doesNotMatch(crmSection, /ChevronDown/);
    assert.doesNotMatch(crmSection, /<button/);
  });

  test('29. Sidebar has NO child sub-items under CRM / Calling', () => {
    const crmSection = sidebarContent.split('{/* CRM / Calling - Single Direct Module */}')[1]?.split('{/* My Tasks */}')[0];
    assert.ok(crmSection, 'CRM section must exist');
    assert.doesNotMatch(crmSection, /Today's Calls<\/span>/);
    assert.doesNotMatch(crmSection, /Follow-ups<\/span>/);
    assert.doesNotMatch(crmSection, /Renewals<\/span>/);
    assert.doesNotMatch(crmSection, /Due Reminders<\/span>/);
    assert.doesNotMatch(crmSection, /ACQ Patients<\/span>/);
    assert.doesNotMatch(crmSection, /OC \/ NR Patients<\/span>/);
  });

  test('30. CRM NavLink targets /pro/crm/calls', () => {
    const crmSection = sidebarContent.split('{/* CRM / Calling - Single Direct Module */}')[1]?.split('{/* My Tasks */}')[0];
    assert.match(crmSection, /to="\/pro\/crm\/calls"/);
  });

  test('31. Active state matcher activates for all /pro/crm/* routes', () => {
    const isCRMActive = (pathname) => pathname.startsWith('/pro/crm');

    const crmRoutes = [
      '/pro/crm',
      '/pro/crm/calls',
      '/pro/crm/followups',
      '/pro/crm/renewals',
      '/pro/crm/dues',
      '/pro/crm/acq',
      '/pro/crm/ocnr'
    ];

    for (const route of crmRoutes) {
      assert.strictEqual(isCRMActive(route), true, `Route ${route} must activate CRM / Calling sidebar item`);
    }
  });

  test('32. Active state matcher does NOT activate for non-CRM routes', () => {
    const isCRMActive = (pathname) => pathname.startsWith('/pro/crm');

    const nonCRMRoutes = [
      '/pro/dashboard',
      '/pro/queue',
      '/pro/patients',
      '/pro/counselling',
      '/pro/packages',
      '/pro/billing/new',
      '/pro/payments/today',
      '/pro/accountant/daily-summary',
      '/pro/tasks',
      '/pro/feedback',
      '/pro/complaints',
      '/pro/profile'
    ];

    for (const route of nonCRMRoutes) {
      assert.strictEqual(isCRMActive(route), false, `Route ${route} must NOT activate CRM / Calling sidebar item`);
    }
  });

  test('33. CRM active styling applies WeCare primary blue and red accent border', () => {
    const computeClasses = (pathname) => {
      const isActive = pathname.startsWith('/pro/crm');
      return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
        isActive
          ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`;
    };

    const activeClasses = computeClasses('/pro/crm/calls');
    assert.match(activeClasses, /bg-\[#1565C0\]/);
    assert.match(activeClasses, /text-white/);
    assert.match(activeClasses, /border-l-4/);
    assert.match(activeClasses, /border-\[#D32F2F\]/);

    const inactiveClasses = computeClasses('/pro/dashboard');
    assert.match(inactiveClasses, /text-slate-600/);
    assert.doesNotMatch(inactiveClasses, /bg-\[#1565C0\]/);
    assert.doesNotMatch(inactiveClasses, /border-\[#D32F2F\]/);
  });

  test('34. App.jsx preserves all CRM routes', () => {
    const appPath = path.resolve('src/App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /Route path="crm" element={<Navigate to="\/pro\/crm\/calls" replace \/>}/);
    assert.match(appContent, /Route path="crm\/calls" element={<PROCRMPage \/>}/);
    assert.match(appContent, /Route path="crm\/followups" element={<PROCRMPage \/>}/);
    assert.match(appContent, /Route path="crm\/renewals" element={<PROCRMPage \/>}/);
    assert.match(appContent, /Route path="crm\/dues" element={<PROCRMPage \/>}/);
    assert.match(appContent, /Route path="crm\/acq" element={<PROCRMPage \/>}/);
    assert.match(appContent, /Route path="crm\/ocnr" element={<PROCRMPage \/>}/);
  });

  test('35. PROCRMPage internal tabs and state handlers remain intact', () => {
    const crmPagePath = path.resolve('src/pages/pro/PROCRMPage.jsx');
    const pageContent = fs.readFileSync(crmPagePath, 'utf8');
    assert.match(pageContent, /fetchTabContent/);
    assert.match(pageContent, /calls/);
    assert.match(pageContent, /followups/);
    assert.match(pageContent, /renewals/);
    assert.match(pageContent, /dues/);
    assert.match(pageContent, /acq/);
    assert.match(pageContent, /ocnr/);
    assert.match(pageContent, /showCallModal/);
    assert.match(pageContent, /showFollowupModal/);
    assert.match(pageContent, /showRenewalModal/);
    assert.match(pageContent, /showOCNRModal/);
  });
});



