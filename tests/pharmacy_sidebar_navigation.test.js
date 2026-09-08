import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// WECARE HOMEOPATHY ERP - PHARMACY SIDEBAR NAVIGATION TEST SUITE
// Verifies Dispensing and Inventory are single direct navigation entries
// with ZERO child items, and operations are managed inside their respective hubs.
// ============================================================================

describe('Pharmacy Sidebar Navigation — Dispensing Cleanup Suite', () => {
  const sidebarPath = path.resolve('src/components/layout/PharmacySidebar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  const appPath = path.resolve('src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  const dispensingHubPath = path.resolve('src/pages/pharmacy/PharmacyDispensingHubPage.jsx');
  const hubContent = fs.readFileSync(dispensingHubPath, 'utf8');

  test('1. Sidebar does NOT contain collapsible toggle state for dispensing', () => {
    assert.doesNotMatch(sidebarContent, /dispensingOpen/);
    assert.doesNotMatch(sidebarContent, /setDispensingOpen/);
  });

  test('2. Sidebar does NOT contain dropdown button or chevron for dispensing', () => {
    const dispensingSection = sidebarContent.split('{/* Dispensing - Single Direct Module */}')[1]?.split('{/* Inventory - Single Direct Module */}')[0];
    assert.ok(dispensingSection, 'Dispensing single direct module section must exist in sidebar');
    assert.doesNotMatch(dispensingSection, /ChevronDown/);
    assert.doesNotMatch(dispensingSection, /ChevronRight/);
    assert.doesNotMatch(dispensingSection, /<button/);
  });

  test('3. Sidebar has strictly NO child sub-menu items underneath Dispensing', () => {
    const dispensingSection = sidebarContent.split('{/* Dispensing - Single Direct Module */}')[1]?.split('{/* Inventory - Single Direct Module */}')[0];
    assert.ok(dispensingSection, 'Dispensing section must exist');
    assert.doesNotMatch(dispensingSection, /<span>Pending<\/span>/);
    assert.doesNotMatch(dispensingSection, /<span>Processing<\/span>/);
    assert.doesNotMatch(dispensingSection, /<span>Dispensed<\/span>/);
    assert.doesNotMatch(dispensingSection, /<span>Dispensing History<\/span>/);
    assert.doesNotMatch(dispensingSection, /to="\/pharmacy\/dispensing\/pending"/);
    assert.doesNotMatch(dispensingSection, /to="\/pharmacy\/dispensing\/processing"/);
    assert.doesNotMatch(dispensingSection, /to="\/pharmacy\/dispensing\/dispensed"/);
    assert.doesNotMatch(dispensingSection, /to="\/pharmacy\/dispensing\/history"/);
  });

  test('4. Dispensing NavLink targets /pharmacy/dispensing directly', () => {
    const dispensingSection = sidebarContent.split('{/* Dispensing - Single Direct Module */}')[1]?.split('{/* Inventory - Single Direct Module */}')[0];
    assert.match(dispensingSection, /to="\/pharmacy\/dispensing"/);
    assert.match(dispensingSection, /<span>Dispensing<\/span>/);
  });

  test('5. Active state matcher activates for all /pharmacy/dispensing/* and /pharmacy/prescriptions/* routes', () => {
    const isDispensingActive = (pathname) =>
      pathname.startsWith('/pharmacy/dispensing') || pathname.startsWith('/pharmacy/prescriptions');

    const dispensingRoutes = [
      '/pharmacy/dispensing',
      '/pharmacy/dispensing/pending',
      '/pharmacy/dispensing/processing',
      '/pharmacy/dispensing/dispensed',
      '/pharmacy/dispensing/history',
      '/pharmacy/prescriptions/12/process',
      '/pharmacy/prescriptions/45/process'
    ];

    for (const route of dispensingRoutes) {
      assert.strictEqual(isDispensingActive(route), true, `Route ${route} must highlight Dispensing sidebar link`);
    }
  });

  test('6. Active state matcher does NOT activate for other non-dispensing pharmacy routes', () => {
    const isDispensingActive = (pathname) =>
      pathname.startsWith('/pharmacy/dispensing') || pathname.startsWith('/pharmacy/prescriptions');

    const otherRoutes = [
      '/pharmacy/dashboard',
      '/pharmacy/queue',
      '/pharmacy/patients',
      '/pharmacy/inventory/stock',
      '/pharmacy/transactions',
      '/pharmacy/returns',
      '/pharmacy/adjustments',
      '/pharmacy/clarifications',
      '/pharmacy/profile'
    ];

    for (const route of otherRoutes) {
      assert.strictEqual(isDispensingActive(route), false, `Route ${route} must NOT highlight Dispensing`);
    }
  });

  test('7. App.jsx routing preserves direct dispensing and tabbed routes', () => {
    assert.match(appContent, /<Route path="dispensing" element={<Navigate to="\/pharmacy\/dispensing\/pending" replace \/>} \/>/);
    assert.match(appContent, /<Route path="dispensing\/:tab" element={<PharmacyDispensingHubPage \/>} \/>/);
  });

  test('8. Medicine Dispensing Hub retains all 4 internal operational tabs', () => {
    assert.match(hubContent, /id:\s*'pending'/);
    assert.match(hubContent, /label:\s*'Pending Dispensing'/);
    assert.match(hubContent, /id:\s*'processing'/);
    assert.match(hubContent, /label:\s*'Processing & Clarifications'/);
    assert.match(hubContent, /id:\s*'dispensed'/);
    assert.match(hubContent, /label:\s*'Dispensed'/);
    assert.match(hubContent, /id:\s*'history'/);
    assert.match(hubContent, /label:\s*'Dispensing History'/);
  });
});

describe('Pharmacy Sidebar Navigation — Inventory Cleanup Suite', () => {
  const sidebarPath = path.resolve('src/components/layout/PharmacySidebar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  const appPath = path.resolve('src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  const inventoryHubPath = path.resolve('src/pages/pharmacy/PharmacyInventoryHubPage.jsx');
  const hubContent = fs.readFileSync(inventoryHubPath, 'utf8');

  test('9. Sidebar does NOT contain collapsible toggle state for inventory', () => {
    assert.doesNotMatch(sidebarContent, /inventoryOpen/);
    assert.doesNotMatch(sidebarContent, /setInventoryOpen/);
  });

  test('10. Sidebar does NOT contain dropdown button or chevron for inventory', () => {
    const inventorySection = sidebarContent.split('{/* Inventory - Single Direct Module */}')[1]?.split('{/* Stock Transactions */}')[0];
    assert.ok(inventorySection, 'Inventory single direct module section must exist in sidebar');
    assert.doesNotMatch(inventorySection, /ChevronDown/);
    assert.doesNotMatch(inventorySection, /ChevronRight/);
    assert.doesNotMatch(inventorySection, /<button/);
  });

  test('11. Sidebar has strictly NO child sub-menu items underneath Inventory', () => {
    const inventorySection = sidebarContent.split('{/* Inventory - Single Direct Module */}')[1]?.split('{/* Stock Transactions */}')[0];
    assert.ok(inventorySection, 'Inventory section must exist');
    assert.doesNotMatch(inventorySection, /<span>Medicine \/ Drug List<\/span>/);
    assert.doesNotMatch(inventorySection, /<span>Stock<\/span>/);
    assert.doesNotMatch(inventorySection, /<span>Add Stock<\/span>/);
    assert.doesNotMatch(inventorySection, /<span>Import Excel<\/span>/);
    assert.doesNotMatch(inventorySection, /<span>Low Stock<\/span>/);
    assert.doesNotMatch(inventorySection, /<span>Expiring Soon<\/span>/);
    assert.doesNotMatch(inventorySection, /<span>Expired<\/span>/);
    assert.doesNotMatch(inventorySection, /<span>Out of Stock<\/span>/);
    assert.doesNotMatch(inventorySection, /to="\/pharmacy\/inventory\//);
  });

  test('12. Inventory NavLink targets /pharmacy/inventory directly', () => {
    const inventorySection = sidebarContent.split('{/* Inventory - Single Direct Module */}')[1]?.split('{/* Stock Transactions */}')[0];
    assert.match(inventorySection, /to="\/pharmacy\/inventory"/);
    assert.match(inventorySection, /<span>Inventory<\/span>/);
  });

  test('13. Active state matcher activates for all /pharmacy/inventory/* routes', () => {
    const isInventoryActive = (pathname) => pathname.startsWith('/pharmacy/inventory');

    const inventoryRoutes = [
      '/pharmacy/inventory',
      '/pharmacy/inventory/medicines',
      '/pharmacy/inventory/stock',
      '/pharmacy/inventory/add-stock',
      '/pharmacy/inventory/import-excel',
      '/pharmacy/inventory/low-stock',
      '/pharmacy/inventory/expiring',
      '/pharmacy/inventory/expired',
      '/pharmacy/inventory/out-of-stock'
    ];

    for (const route of inventoryRoutes) {
      assert.strictEqual(isInventoryActive(route), true, `Route ${route} must highlight Inventory sidebar link`);
    }
  });

  test('14. Active state matcher does NOT activate for non-inventory routes', () => {
    const isInventoryActive = (pathname) => pathname.startsWith('/pharmacy/inventory');

    const otherRoutes = [
      '/pharmacy/dashboard',
      '/pharmacy/queue',
      '/pharmacy/patients',
      '/pharmacy/dispensing',
      '/pharmacy/transactions',
      '/pharmacy/returns',
      '/pharmacy/adjustments',
      '/pharmacy/clarifications',
      '/pharmacy/profile'
    ];

    for (const route of otherRoutes) {
      assert.strictEqual(isInventoryActive(route), false, `Route ${route} must NOT highlight Inventory`);
    }
  });

  test('15. App.jsx routing preserves direct inventory and tabbed routes', () => {
    assert.match(appContent, /<Route path="inventory" element={<Navigate to="\/pharmacy\/inventory\/medicines" replace \/>} \/>/);
    assert.match(appContent, /<Route path="inventory\/:tab" element={<PharmacyInventoryHubPage \/>} \/>/);
  });

  test('16. Pharmacy Inventory Hub retains all 8 internal operational tabs', () => {
    assert.match(hubContent, /id:\s*'medicines'/);
    assert.match(hubContent, /label:\s*'Formulary Master'/);
    assert.match(hubContent, /id:\s*'stock'/);
    assert.match(hubContent, /label:\s*'Stock Levels'/);
    assert.match(hubContent, /id:\s*'add-stock'/);
    assert.match(hubContent, /label:\s*'\+ Manual Add Stock'/);
    assert.match(hubContent, /id:\s*'import-excel'/);
    assert.match(hubContent, /label:\s*'Excel Import'/);
    assert.match(hubContent, /id:\s*'low-stock'/);
    assert.match(hubContent, /label:\s*'Low Stock Alert'/);
    assert.match(hubContent, /id:\s*'expiring'/);
    assert.match(hubContent, /label:\s*'Expiring Soon \(30d\)'/);
    assert.match(hubContent, /id:\s*'expired'/);
    assert.match(hubContent, /label:\s*'Expired Stock'/);
    assert.match(hubContent, /id:\s*'out-of-stock'/);
    assert.match(hubContent, /label:\s*'Out of Stock'/);
  });

  test('17. Standalone Pharmacy sidebar items remain intact and unmodified', () => {
    assert.match(sidebarContent, /to="\/pharmacy\/dashboard"/);
    assert.match(sidebarContent, /to="\/pharmacy\/queue"/);
    assert.match(sidebarContent, /to="\/pharmacy\/patients"/);
    assert.match(sidebarContent, /to="\/pharmacy\/dispensing"/);
    assert.match(sidebarContent, /to="\/pharmacy\/inventory"/);
    assert.match(sidebarContent, /to="\/pharmacy\/transactions"/);
    assert.match(sidebarContent, /to="\/pharmacy\/returns"/);
    assert.match(sidebarContent, /to="\/pharmacy\/adjustments"/);
    assert.match(sidebarContent, /to="\/pharmacy\/clarifications"/);
    assert.match(sidebarContent, /to="\/pharmacy\/profile"/);
  });
});
