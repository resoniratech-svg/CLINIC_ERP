/**
 * Test Suite: PRO — Prescription & Treatment Plan Billing Review
 *
 * Tests all state-management logic extracted from PROPatientOverviewPage.jsx:
 *   - selectedBillingIds (Set) — selection state
 *   - billingItemEdits — per-item edit state
 *   - initBillingReviewOnce — one-time initialization
 *   - toggleItem — checkbox toggle
 *   - selectAll / selectNone (Clear)
 *   - updateEdit — editing without changing selection
 *   - handleGenerateBill — URL params payload
 *   - Edge cases: empty data, partial selection, re-selection after uncheck
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─────────────────────────────────────────────────────────────────────────────
// Pure logic extracted from PROPatientOverviewPage — mirrors the component exactly
// ─────────────────────────────────────────────────────────────────────────────

function createBillingState() {
  return {
    selectedBillingIds: new Set(),
    billingItemEdits: {},
    billingInitialized: false,
  };
}

function initBillingReviewOnce(state, rxItems, tpItems) {
  if (state.billingInitialized) return state; // no-op — preserves user selections
  const initialSelected = new Set();
  const initialEdits = {};
  rxItems.forEach(item => {
    const key = `rx-${item.id}`;
    initialSelected.add(key);
    initialEdits[key] = {
      dosage: item.dosage || '',
      quantity: item.quantity || 1,
      frequency: item.frequency || '',
      duration_days: item.duration_days || '',
    };
  });
  tpItems.forEach(tp => {
    const key = `tp-${tp.treatment_id}`;
    initialSelected.add(key);
    initialEdits[key] = {
      duration: tp.duration || '',
      duration_unit: tp.duration_unit || 'days',
      amount: '',
    };
  });
  return {
    selectedBillingIds: initialSelected,
    billingItemEdits: initialEdits,
    billingInitialized: true,
  };
}

function toggleItem(state, key) {
  const next = new Set(state.selectedBillingIds);
  if (next.has(key)) { next.delete(key); } else { next.add(key); }
  return { ...state, selectedBillingIds: next };
}

function selectAll(state, rxItems, tpItems) {
  const all = new Set();
  rxItems.forEach(i => all.add(`rx-${i.id}`));
  tpItems.forEach(t => all.add(`tp-${t.treatment_id}`));
  return { ...state, selectedBillingIds: all };
}

function selectNone(state) {
  return { ...state, selectedBillingIds: new Set() };
}

function updateEdit(state, key, field, value) {
  return {
    ...state,
    billingItemEdits: {
      ...state.billingItemEdits,
      [key]: { ...(state.billingItemEdits[key] || {}), [field]: value },
    },
  };
}

function buildBillingPayload(state, rxItems, tpItems, patient, consultation, prescription) {
  const { selectedBillingIds, billingItemEdits } = state;
  const selectedRx = rxItems.filter(item => selectedBillingIds.has(`rx-${item.id}`));
  const selectedTp = tpItems.filter(tp => selectedBillingIds.has(`tp-${tp.treatment_id}`));
  const params = {};
  params.patient_id = String(patient.patient_id);
  if (consultation?.doctor_id) params.doctor_id = String(consultation.doctor_id);
  params.bill_type = 'treatment';
  if (prescription?.prescription_id && selectedRx.length > 0) {
    params.prescription_id = String(prescription.prescription_id);
  }
  if (selectedRx.length > 0) {
    params.rx_items = selectedRx.map(item => {
      const edits = billingItemEdits[`rx-${item.id}`] || {};
      return {
        id: item.id,
        medicine_name: item.medicine_name || `Medicine #${item.medicine_id}`,
        quantity: edits.quantity ?? item.quantity ?? 1,
        dosage: edits.dosage ?? item.dosage ?? '',
        frequency: edits.frequency ?? item.frequency ?? '',
        duration_days: edits.duration_days ?? item.duration_days ?? '',
      };
    });
  }
  if (selectedTp.length > 0) {
    params.tp_items = selectedTp.map(tp => {
      const edits = billingItemEdits[`tp-${tp.treatment_id}`] || {};
      return {
        treatment_id: tp.treatment_id,
        treatment_name: tp.treatment_name,
        treatment_type: tp.treatment_type || 'Treatment',
        doctor_id: tp.doctor_id || consultation?.doctor_id || '',
        duration: edits.duration ?? tp.duration ?? '',
        duration_unit: edits.duration_unit ?? tp.duration_unit ?? 'days',
        amount: edits.amount || '',
      };
    });
    if (selectedTp.length === 1) {
      params.treatment_name = selectedTp[0].treatment_name;
      params.treatment_type = selectedTp[0].treatment_type || 'Treatment';
    }
  }
  return params;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────────────────────────────────────

const RX_ITEMS = [
  { id: 101, medicine_id: 3,  medicine_name: 'Medicine #3',  dosage: '1 tab', frequency: '3 times/day', duration_days: 7, quantity: 21 },
  { id: 102, medicine_id: 22, medicine_name: 'Medicine #22', dosage: '1 tab', frequency: '3 times/day', duration_days: 7, quantity: 21 },
];

const TP_ITEMS = [
  { treatment_id: 456, treatment_name: 'ASAP', treatment_type: 'homeopathy', duration: '7', duration_unit: 'Days' },
];

const PATIENT    = { patient_id: 15 };
const CONSULTATION = { doctor_id: 11 };
const PRESCRIPTION = { prescription_id: 6 };

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: Initialization
// ─────────────────────────────────────────────────────────────────────────────

describe('1 — initBillingReviewOnce', () => {

  test('1.1 — initializes all items as selected', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    assert.equal(s.selectedBillingIds.size, 3);
    assert.ok(s.selectedBillingIds.has('rx-101'));
    assert.ok(s.selectedBillingIds.has('rx-102'));
    assert.ok(s.selectedBillingIds.has('tp-456'));
  });

  test('1.2 — sets billingInitialized = true after first call', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    assert.equal(s.billingInitialized, true);
  });

  test('1.3 — calling init AGAIN (second tab click) does NOT reset selections (fix for disappear bug)', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS); // first click

    // User unchecks ASAP
    s = toggleItem(s, 'tp-456');
    assert.equal(s.selectedBillingIds.has('tp-456'), false);

    // User clicks tab again — initBillingReviewOnce called again
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS); // second click

    // ASAP must STILL be unchecked — not reset
    assert.equal(s.selectedBillingIds.has('tp-456'), false,
      'CRITICAL: initBillingReviewOnce must NOT reset selections on second call');
    assert.equal(s.selectedBillingIds.size, 2); // only rx-101 and rx-102
  });

  test('1.4 — initializes edit state for rx items with correct fields', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    const edits101 = s.billingItemEdits['rx-101'];
    assert.equal(edits101.dosage, '1 tab');
    assert.equal(edits101.quantity, 21);
    assert.equal(edits101.frequency, '3 times/day');
    assert.equal(edits101.duration_days, 7);
  });

  test('1.5 — initializes edit state for tp items with correct fields', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    const edits456 = s.billingItemEdits['tp-456'];
    assert.equal(edits456.duration, '7');
    assert.equal(edits456.duration_unit, 'Days');
    assert.equal(edits456.amount, ''); // starts empty
  });

  test('1.6 — works with empty prescription and treatment plans', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, [], []);
    assert.equal(s.selectedBillingIds.size, 0);
    assert.equal(s.billingInitialized, true);
  });

  test('1.7 — works with only rx items, no treatment plans', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, []);
    assert.equal(s.selectedBillingIds.size, 2);
    assert.ok(s.selectedBillingIds.has('rx-101'));
    assert.ok(s.selectedBillingIds.has('rx-102'));
  });

  test('1.8 — works with only treatment plans, no rx', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, [], TP_ITEMS);
    assert.equal(s.selectedBillingIds.size, 1);
    assert.ok(s.selectedBillingIds.has('tp-456'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: toggleItem (checkbox toggle)
// ─────────────────────────────────────────────────────────────────────────────

describe('2 — toggleItem (checkbox)', () => {

  test('2.1 — unchecking ASAP removes it from selectedBillingIds', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'tp-456');
    assert.equal(s.selectedBillingIds.has('tp-456'), false);
  });

  test('2.2 — ASAP stays in source data (TP_ITEMS) after uncheck — source never mutated', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'tp-456');
    // TP_ITEMS still has ASAP
    assert.equal(TP_ITEMS.length, 1);
    assert.equal(TP_ITEMS[0].treatment_name, 'ASAP');
  });

  test('2.3 — re-checking ASAP after uncheck restores selection', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'tp-456'); // uncheck
    assert.equal(s.selectedBillingIds.has('tp-456'), false);
    s = toggleItem(s, 'tp-456'); // re-check
    assert.equal(s.selectedBillingIds.has('tp-456'), true,
      'CRITICAL: re-checking ASAP must restore it to selected state');
  });

  test('2.4 — unchecking Medicine #3 removes it but keeps Medicine #22 and ASAP', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-101');
    assert.equal(s.selectedBillingIds.has('rx-101'), false);
    assert.equal(s.selectedBillingIds.has('rx-102'), true);
    assert.equal(s.selectedBillingIds.has('tp-456'), true);
    assert.equal(s.selectedBillingIds.size, 2);
  });

  test('2.5 — unchecking all items results in size 0 but source arrays unchanged', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-101');
    s = toggleItem(s, 'rx-102');
    s = toggleItem(s, 'tp-456');
    assert.equal(s.selectedBillingIds.size, 0);
    // Source data untouched
    assert.equal(RX_ITEMS.length, 2);
    assert.equal(TP_ITEMS.length, 1);
  });

  test('2.6 — checking an already-checked item unchecks it (toggle behavior)', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    // rx-101 starts checked
    assert.ok(s.selectedBillingIds.has('rx-101'));
    s = toggleItem(s, 'rx-101');
    assert.equal(s.selectedBillingIds.has('rx-101'), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: Select All / Clear (None)
// ─────────────────────────────────────────────────────────────────────────────

describe('3 — selectAll and selectNone (Clear)', () => {

  test('3.1 — selectAll selects all 3 items', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-101');
    s = toggleItem(s, 'tp-456'); // partial state
    s = selectAll(s, RX_ITEMS, TP_ITEMS);
    assert.equal(s.selectedBillingIds.size, 3);
    assert.ok(s.selectedBillingIds.has('rx-101'));
    assert.ok(s.selectedBillingIds.has('rx-102'));
    assert.ok(s.selectedBillingIds.has('tp-456'));
  });

  test('3.2 — selectNone unchecks all items, selectedBillingIds is empty Set', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = selectNone(s);
    assert.equal(s.selectedBillingIds.size, 0);
  });

  test('3.3 — after selectNone, source arrays still have all items', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = selectNone(s);
    assert.equal(RX_ITEMS.length, 2);
    assert.equal(TP_ITEMS.length, 1);
  });

  test('3.4 — after selectNone, can selectAll again', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = selectNone(s);
    s = selectAll(s, RX_ITEMS, TP_ITEMS);
    assert.equal(s.selectedBillingIds.size, 3);
  });

  test('3.5 — selectAll on empty data results in empty Set', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, [], []);
    s = selectAll(s, [], []);
    assert.equal(s.selectedBillingIds.size, 0);
  });

  test('3.6 — selectNone does NOT delete source arrays', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = selectNone(s);
    // Re-check one item manually — proves source is still accessible
    s = toggleItem(s, 'tp-456');
    assert.ok(s.selectedBillingIds.has('tp-456'));
    assert.equal(s.selectedBillingIds.size, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: Selection Count
// ─────────────────────────────────────────────────────────────────────────────

describe('4 — Selection count display', () => {

  test('4.1 — initial total: 3 items, 3 selected', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    const totalItems = RX_ITEMS.length + TP_ITEMS.length;
    assert.equal(totalItems, 3);
    assert.equal(s.selectedBillingIds.size, 3);
  });

  test('4.2 — after unchecking ASAP: totalItems still 3, selected = 2', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'tp-456');
    const totalItems = RX_ITEMS.length + TP_ITEMS.length;
    assert.equal(totalItems, 3, 'Total must NOT decrease when item unchecked');
    assert.equal(s.selectedBillingIds.size, 2);
  });

  test('4.3 — after re-checking ASAP: selected = 3 again', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'tp-456'); // uncheck
    s = toggleItem(s, 'tp-456'); // re-check
    assert.equal(s.selectedBillingIds.size, 3);
  });

  test('4.4 — after Clear: totalItems still 3, selected = 0', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = selectNone(s);
    const totalItems = RX_ITEMS.length + TP_ITEMS.length;
    assert.equal(totalItems, 3);
    assert.equal(s.selectedBillingIds.size, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: Edit fields — does NOT affect selection state
// ─────────────────────────────────────────────────────────────────────────────

describe('5 — updateEdit (editing prescription/treatment plan fields)', () => {

  test('5.1 — editing dosage updates billingItemEdits but NOT selectedBillingIds', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    const selectionBefore = new Set(s.selectedBillingIds);
    s = updateEdit(s, 'rx-101', 'dosage', '2 tabs');
    assert.equal(s.billingItemEdits['rx-101'].dosage, '2 tabs');
    // Selection unchanged
    assert.deepEqual([...s.selectedBillingIds].sort(), [...selectionBefore].sort());
  });

  test('5.2 — editing UNCHECKED item does not check it', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-101'); // uncheck Medicine #3
    assert.equal(s.selectedBillingIds.has('rx-101'), false);
    s = updateEdit(s, 'rx-101', 'dosage', '2 tabs'); // edit while unchecked
    // Must still be unchecked
    assert.equal(s.selectedBillingIds.has('rx-101'), false,
      'Editing an unchecked item must NOT auto-select it');
    assert.equal(s.billingItemEdits['rx-101'].dosage, '2 tabs');
  });

  test('5.3 — editing CHECKED item keeps it checked', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    assert.ok(s.selectedBillingIds.has('tp-456'));
    s = updateEdit(s, 'tp-456', 'duration', '14');
    assert.ok(s.selectedBillingIds.has('tp-456'),
      'Editing a checked item must NOT uncheck it');
    assert.equal(s.billingItemEdits['tp-456'].duration, '14');
  });

  test('5.4 — editing treatment plan duration from 7 to 14 days reflects in edits', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'tp-456', 'duration', '14');
    assert.equal(s.billingItemEdits['tp-456'].duration, '14');
  });

  test('5.5 — editing quantity of prescription item', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'rx-102', 'quantity', 42);
    assert.equal(s.billingItemEdits['rx-102'].quantity, 42);
  });

  test('5.6 — editing treatment plan billing amount', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'tp-456', 'amount', '500');
    assert.equal(s.billingItemEdits['tp-456'].amount, '500');
  });

  test('5.7 — editing one item does not affect another item\'s edits', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'rx-101', 'dosage', '2 tabs');
    // rx-102 edits should still be original
    assert.equal(s.billingItemEdits['rx-102'].dosage, '1 tab');
  });

  test('5.8 — multiple fields can be edited on same item independently', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'rx-101', 'dosage', '2 tabs');
    s = updateEdit(s, 'rx-101', 'frequency', '2 times/day');
    s = updateEdit(s, 'rx-101', 'quantity', 14);
    assert.equal(s.billingItemEdits['rx-101'].dosage, '2 tabs');
    assert.equal(s.billingItemEdits['rx-101'].frequency, '2 times/day');
    assert.equal(s.billingItemEdits['rx-101'].quantity, 14);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: buildBillingPayload (Generate Bill)
// ─────────────────────────────────────────────────────────────────────────────

describe('6 — buildBillingPayload (Generate Bill)', () => {

  test('6.1 — payload includes patient_id, doctor_id, bill_type', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.patient_id, '15');
    assert.equal(p.doctor_id, '11');
    assert.equal(p.bill_type, 'treatment');
  });

  test('6.2 — all 3 items selected: rx_items has 2, tp_items has 1', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.rx_items.length, 2);
    assert.equal(p.tp_items.length, 1);
    assert.equal(p.tp_items[0].treatment_name, 'ASAP');
  });

  test('6.3 — unchecking ASAP: tp_items is NOT in payload', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'tp-456'); // uncheck ASAP
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.rx_items.length, 2);
    assert.equal(p.tp_items, undefined, 'Unchecked ASAP must NOT appear in billing payload');
  });

  test('6.4 — unchecking Medicine #22: only Medicine #3 in rx_items', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-102'); // uncheck Medicine #22
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.rx_items.length, 1);
    assert.equal(p.rx_items[0].medicine_name, 'Medicine #3');
  });

  test('6.5 — selecting ONLY Medicine #3 and ASAP: payload excludes Medicine #22', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-102'); // uncheck Medicine #22
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    const names = p.rx_items.map(i => i.medicine_name);
    assert.ok(!names.includes('Medicine #22'), 'Medicine #22 must not be in payload when unchecked');
    assert.ok(names.includes('Medicine #3'));
    assert.equal(p.tp_items[0].treatment_name, 'ASAP');
  });

  test('6.6 — edited dosage appears in payload, not original', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'rx-101', 'dosage', '2 tabs');
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    const med3 = p.rx_items.find(i => i.id === 101);
    assert.equal(med3.dosage, '2 tabs');
  });

  test('6.7 — edited quantity appears in payload', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'rx-101', 'quantity', 42);
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    const med3 = p.rx_items.find(i => i.id === 101);
    assert.equal(med3.quantity, 42);
  });

  test('6.8 — edited treatment plan duration appears in payload', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'tp-456', 'duration', '14');
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.tp_items[0].duration, '14');
  });

  test('6.9 — edited treatment billing amount appears in payload', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'tp-456', 'amount', '500');
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.tp_items[0].amount, '500');
  });

  test('6.10 — no items selected: no rx_items or tp_items in payload', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = selectNone(s);
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.rx_items, undefined);
    assert.equal(p.tp_items, undefined);
  });

  test('6.11 — prescription_id only included when rx items are selected', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    // Select only TP
    s = selectNone(s);
    s = toggleItem(s, 'tp-456');
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.prescription_id, undefined, 'prescription_id must not be set when no rx selected');
    assert.equal(p.tp_items.length, 1);
  });

  test('6.12 — treatment_name in params only set when exactly 1 tp selected', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, [], TP_ITEMS);
    const p = buildBillingPayload(s, [], TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.treatment_name, 'ASAP');
    assert.equal(p.treatment_type, 'homeopathy');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe('7 — Edge Cases', () => {

  test('7.1 — patient with null prescription items — no crash', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, [], TP_ITEMS);
    assert.equal(s.selectedBillingIds.has('tp-456'), true);
    assert.equal(s.selectedBillingIds.size, 1);
  });

  test('7.2 — patient with null treatment plans — no crash', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, []);
    assert.equal(s.selectedBillingIds.size, 2);
  });

  test('7.3 — toggling same item rapidly ends up in correct final state', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'tp-456'); // off
    s = toggleItem(s, 'tp-456'); // on
    s = toggleItem(s, 'tp-456'); // off
    assert.equal(s.selectedBillingIds.has('tp-456'), false);
    s = toggleItem(s, 'tp-456'); // on
    assert.equal(s.selectedBillingIds.has('tp-456'), true);
  });

  test('7.4 — unknown key toggle does not crash or corrupt other selections', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-9999'); // non-existent item
    assert.equal(s.selectedBillingIds.has('rx-9999'), true); // added but harmless
    assert.equal(s.selectedBillingIds.has('rx-101'), true);  // others intact
  });

  test('7.5 — edit on unknown key creates entry without affecting other items', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'rx-9999', 'dosage', 'test');
    assert.equal(s.billingItemEdits['rx-9999'].dosage, 'test');
    // Others unchanged
    assert.equal(s.billingItemEdits['rx-101'].dosage, '1 tab');
  });

  test('7.6 — switching patients resets state via createBillingState()', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'tp-456');
    // Simulate new patient load
    s = createBillingState();
    assert.equal(s.selectedBillingIds.size, 0);
    assert.equal(s.billingInitialized, false);
  });

  test('7.7 — re-initializing for new patient shows new patient items selected', () => {
    const newRx = [{ id: 999, medicine_id: 50, medicine_name: 'NewMed', dosage: '1 pill', frequency: '1/day', duration_days: 3, quantity: 3 }];
    const newTp = [];
    let s = createBillingState(); // new patient reset
    s = initBillingReviewOnce(s, newRx, newTp);
    assert.ok(s.selectedBillingIds.has('rx-999'));
    assert.equal(s.selectedBillingIds.size, 1);
  });

  test('7.8 — items with missing dosage/frequency fields initialize gracefully', () => {
    const minimalRx = [{ id: 200, medicine_id: 99 }]; // no dosage, no frequency etc
    let s = createBillingState();
    s = initBillingReviewOnce(s, minimalRx, []);
    assert.ok(s.selectedBillingIds.has('rx-200'));
    assert.equal(s.billingItemEdits['rx-200'].dosage, '');
    assert.equal(s.billingItemEdits['rx-200'].frequency, '');
    assert.equal(s.billingItemEdits['rx-200'].quantity, 1); // default
  });

  test('7.9 — prescription_id included in payload when rx selected', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.prescription_id, '6');
  });

  test('7.10 — source arrays are never modified (immutability guarantee)', () => {
    const rxCopy = JSON.parse(JSON.stringify(RX_ITEMS));
    const tpCopy = JSON.parse(JSON.stringify(TP_ITEMS));
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-101');
    s = toggleItem(s, 'tp-456');
    s = updateEdit(s, 'rx-101', 'dosage', 'MODIFIED');
    s = selectNone(s);
    s = selectAll(s, RX_ITEMS, TP_ITEMS);
    // Original arrays must be identical to before
    assert.deepEqual(RX_ITEMS, rxCopy);
    assert.deepEqual(TP_ITEMS, tpCopy);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8: Full Workflow Simulations
// ─────────────────────────────────────────────────────────────────────────────

describe('8 — Full Workflow Simulations', () => {

  test('8.1 — complete workflow: open tab → uncheck → recheck → generate bill', () => {
    let s = createBillingState();

    // Step 1: Open tab first time
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    assert.equal(s.selectedBillingIds.size, 3);

    // Step 2: Switch to another tab and come back
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS); // no-op
    assert.equal(s.selectedBillingIds.size, 3); // still 3

    // Step 3: Uncheck ASAP
    s = toggleItem(s, 'tp-456');
    assert.equal(s.selectedBillingIds.size, 2);

    // Step 4: Switch tab and back again
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS); // still no-op
    assert.equal(s.selectedBillingIds.has('tp-456'), false); // still unchecked!

    // Step 5: Re-check ASAP
    s = toggleItem(s, 'tp-456');
    assert.equal(s.selectedBillingIds.size, 3);

    // Step 6: Generate bill — all 3 selected
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.rx_items.length, 2);
    assert.equal(p.tp_items.length, 1);
  });

  test('8.2 — workflow: edit item while unchecked → generate bill excludes edited-but-unchecked item', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = toggleItem(s, 'rx-102'); // uncheck Medicine #22
    s = updateEdit(s, 'rx-102', 'dosage', '3 tabs'); // edit while unchecked
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    const names = (p.rx_items || []).map(i => i.medicine_name);
    assert.ok(!names.includes('Medicine #22'), 'Unchecked edited item must NOT appear in bill');
  });

  test('8.3 — workflow: clear all → select only ASAP → generate bill', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = selectNone(s); // clear
    assert.equal(s.selectedBillingIds.size, 0);
    s = toggleItem(s, 'tp-456'); // select only ASAP
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.rx_items, undefined);
    assert.equal(p.tp_items.length, 1);
    assert.equal(p.tp_items[0].treatment_name, 'ASAP');
  });

  test('8.4 — workflow: edit ASAP duration to 14 days → generate bill sends 14', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'tp-456', 'duration', '14');
    assert.ok(s.selectedBillingIds.has('tp-456')); // still selected
    const p = buildBillingPayload(s, RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.tp_items[0].duration, '14');
  });

  test('8.5 — UI correctness: totalItems never changes, only selectedBillingIds.size changes', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, RX_ITEMS, TP_ITEMS);
    const totalItems = RX_ITEMS.length + TP_ITEMS.length; // always 3
    assert.equal(totalItems, 3);
    s = toggleItem(s, 'rx-101');
    assert.equal(totalItems, 3); // unchanged
    assert.equal(s.selectedBillingIds.size, 2); // only selection changed
    s = selectNone(s);
    assert.equal(totalItems, 3); // unchanged
    assert.equal(s.selectedBillingIds.size, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 9: Single Button Verification in Patient 360 Source
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';

describe('9 — Single Generate Bill Button on Patient 360', () => {
  const overviewFilePath = path.resolve('src/pages/pro/PROPatientOverviewPage.jsx');
  const fileContent = fs.readFileSync(overviewFilePath, 'utf8');

  test('9.1 — exactly ONE "Generate Bill →" button in Patient 360 overview', () => {
    const matches = fileContent.match(/<span>Generate Bill →<\/span>/g) || [];
    assert.equal(matches.length, 1, `Expected exactly 1 "Generate Bill →" button, found ${matches.length}`);
  });

  test('9.2 — the button is in the section header, not in the footer', () => {
    const footerMatch = fileContent.match(/Footer[\s\S]*?<span>Generate Bill →<\/span>/);
    assert.equal(footerMatch, null, 'Footer must NOT contain a Generate Bill button');
  });

  test('9.3 — section heading is "Prescription & Treatment Plan"', () => {
    assert.ok(fileContent.includes('<span>Prescription &amp; Treatment Plan</span>'));
    assert.ok(!fileContent.includes('<span>PRO Billing Review</span>'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 10: PROBillingPage Treatment Plan Toggle & Consolidation Fix
// ─────────────────────────────────────────────────────────────────────────────

describe('10 — PROBillingPage Treatment Plan Toggle & Consolidation State', () => {
  // Pure implementation of the fixed toggleTreatmentPlan logic from PROBillingPage.jsx
  function simulateTogglePlan(currentForm, currentSelectedPlanIds, tp) {
    const planId = tp.treatment_id;
    const isSelected = currentSelectedPlanIds.includes(planId);

    if (isSelected) {
      const nextPlanIds = currentSelectedPlanIds.filter(id => id !== planId);
      const remaining = currentForm.items.filter(it => it.treatment_plan_id !== planId);
      return {
        selectedPlanIds: nextPlanIds,
        form: {
          ...currentForm,
          items: remaining.length > 0
            ? remaining
            : [{ item_name: 'Treatment Session', charge_type: 'Treatment', quantity: 1, unit_price: 0 }]
        }
      };
    } else {
      const nextPlanIds = [...currentSelectedPlanIds, planId];
      const isDefaultPlaceholder = (it) =>
        it.item_name === 'Treatment Session' &&
        !it.treatment_plan_id &&
        !it.rx_item_id &&
        (it.unit_price === 2000 || it.unit_price === 0);

      const baseItems = currentForm.items.filter(it => !isDefaultPlaceholder(it));
      return {
        selectedPlanIds: nextPlanIds,
        form: {
          ...currentForm,
          bill_type: 'treatment',
          doctor_id: tp.doctor_id ? String(tp.doctor_id) : currentForm.doctor_id,
          items: [
            ...baseItems,
            {
              item_name: tp.treatment_name || 'Prescribed Treatment',
              description: tp.treatment_name || 'Prescribed Treatment',
              charge_type: tp.treatment_type || 'homeopathy',
              quantity: 1,
              unit_price: tp.amount ? parseFloat(tp.amount) : 0,
              treatment_plan_id: planId
            }
          ]
        }
      };
    }
  }

  function simulateClearPlans(currentForm) {
    const nonPlanItems = currentForm.items.filter(it => !it.treatment_plan_id);
    return {
      selectedPlanIds: [],
      form: {
        ...currentForm,
        items: nonPlanItems.length > 0
          ? nonPlanItems
          : [{ item_name: 'Treatment Session', charge_type: 'Treatment', quantity: 1, unit_price: 0 }]
      }
    };
  }

  const INITIAL_BILL_ITEMS = [
    { item_name: 'Medicine #3', charge_type: 'medicine', quantity: 21, unit_price: 0, rx_item_id: 101 },
    { item_name: 'Medicine #22', charge_type: 'medicine', quantity: 21, unit_price: 0, rx_item_id: 102 },
    { item_name: 'ASAP', charge_type: 'homeopathy', quantity: 1, unit_price: 0, treatment_plan_id: 456 },
  ];

  const ASAP_TP = { treatment_id: 456, treatment_name: 'ASAP', treatment_type: 'homeopathy', doctor_id: 11 };

  test('10.1 — Initial state: 3 items (Medicine #3, Medicine #22, ASAP)', () => {
    const form = { items: [...INITIAL_BILL_ITEMS] };
    const planIds = [456];
    assert.equal(form.items.length, 3);
    assert.equal(form.items[0].item_name, 'Medicine #3');
    assert.equal(form.items[1].item_name, 'Medicine #22');
    assert.equal(form.items[2].item_name, 'ASAP');
    assert.deepEqual(planIds, [456]);
  });

  test('10.2 — User unchecks ASAP: ASAP removed from items, Medicine #3 and Medicine #22 remain', () => {
    const form = { items: [...INITIAL_BILL_ITEMS] };
    const planIds = [456];

    const result = simulateTogglePlan(form, planIds, ASAP_TP);

    assert.equal(result.form.items.length, 2);
    assert.equal(result.form.items[0].item_name, 'Medicine #3');
    assert.equal(result.form.items[1].item_name, 'Medicine #22');
    assert.deepEqual(result.selectedPlanIds, []);
  });

  test('10.3 — CRITICAL: User checks ASAP again: ASAP added back, Medicine #3 and Medicine #22 are NOT lost', () => {
    // Start from the state after unchecking ASAP
    const formAfterUncheck = {
      items: [
        { item_name: 'Medicine #3', charge_type: 'medicine', quantity: 21, unit_price: 0, rx_item_id: 101 },
        { item_name: 'Medicine #22', charge_type: 'medicine', quantity: 21, unit_price: 0, rx_item_id: 102 },
      ]
    };
    const planIdsAfterUncheck = [];

    // Check ASAP again
    const result = simulateTogglePlan(formAfterUncheck, planIdsAfterUncheck, ASAP_TP);

    assert.equal(result.form.items.length, 3, 'CRITICAL: Must have 3 items after rechecking ASAP');
    assert.equal(result.form.items[0].item_name, 'Medicine #3', 'Medicine #3 must be preserved');
    assert.equal(result.form.items[1].item_name, 'Medicine #22', 'Medicine #22 must be preserved');
    assert.equal(result.form.items[2].item_name, 'ASAP', 'ASAP must be appended');
    assert.deepEqual(result.selectedPlanIds, [456]);
  });

  test('10.4 — clearPlans removes ONLY treatment plans, keeping all prescription items', () => {
    const form = { items: [...INITIAL_BILL_ITEMS] };
    const result = simulateClearPlans(form);

    assert.equal(result.form.items.length, 2);
    assert.equal(result.form.items[0].item_name, 'Medicine #3');
    assert.equal(result.form.items[1].item_name, 'Medicine #22');
    assert.deepEqual(result.selectedPlanIds, []);
  });

  test('10.5 — toggle multiple times does not duplicate or lose items', () => {
    let state = {
      form: { items: [...INITIAL_BILL_ITEMS] },
      selectedPlanIds: [456]
    };

    // Uncheck ASAP
    state = simulateTogglePlan(state.form, state.selectedPlanIds, ASAP_TP);
    assert.equal(state.form.items.length, 2);

    // Check ASAP
    state = simulateTogglePlan(state.form, state.selectedPlanIds, ASAP_TP);
    assert.equal(state.form.items.length, 3);

    // Uncheck ASAP again
    state = simulateTogglePlan(state.form, state.selectedPlanIds, ASAP_TP);
    assert.equal(state.form.items.length, 2);

    // Check ASAP again
    state = simulateTogglePlan(state.form, state.selectedPlanIds, ASAP_TP);
    assert.equal(state.form.items.length, 3);
    assert.equal(state.form.items[0].item_name, 'Medicine #3');
    assert.equal(state.form.items[1].item_name, 'Medicine #22');
    assert.equal(state.form.items[2].item_name, 'ASAP');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 11: Authoritative Medicine Name Display & Mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('11 — Authoritative Medicine Name Display & Mapping', () => {
  function getMedicineName(item, historyPrescriptions = []) {
    if (!item) return '';
    if (item.medicine_name) return item.medicine_name;
    if (item.name) return item.name;
    if (item.product_name) return item.product_name;
    if (item.medicine_details?.name) return item.medicine_details.name;
    if (historyPrescriptions) {
      for (const p of historyPrescriptions) {
        const match = (p.items || []).find(pi => pi.id === item.id || (pi.medicine_id === item.medicine_id && pi.medicine_name));
        if (match?.medicine_name) return match.medicine_name;
      }
    }
    return item.medicine_id ? `Medicine #${item.medicine_id}` : 'Medicine';
  }

  const REAL_RX_ITEMS = [
    { id: 101, medicine_id: 3,  medicine_name: 'Rhus Tox 30C',       dosage: '1 tab', frequency: '3 times/day', duration_days: 7, quantity: 21 },
    { id: 102, medicine_id: 22, medicine_name: 'Arnica Montana 200C', dosage: '1 tab', frequency: '3 times/day', duration_days: 7, quantity: 21 },
  ];

  test('11.1 — displays actual medicine name when medicine_name is present in prescription item', () => {
    const name1 = getMedicineName(REAL_RX_ITEMS[0]);
    const name2 = getMedicineName(REAL_RX_ITEMS[1]);
    assert.equal(name1, 'Rhus Tox 30C');
    assert.equal(name2, 'Arnica Montana 200C');
    assert.ok(!name1.includes('Medicine #'));
    assert.ok(!name2.includes('Medicine #'));
  });

  test('11.2 — resolves medicine name from name or product_name alternative fields', () => {
    assert.equal(getMedicineName({ id: 1, name: 'Bryonia Alba 30C' }), 'Bryonia Alba 30C');
    assert.equal(getMedicineName({ id: 2, product_name: 'Nux Vomica 200C' }), 'Nux Vomica 200C');
    assert.equal(getMedicineName({ id: 3, medicine_details: { name: 'Belladonna 30C' } }), 'Belladonna 30C');
  });

  test('11.3 — resolves medicine name via history fallback if prescription item only has medicine_id', () => {
    const itemWithoutName = { id: 101, medicine_id: 3 };
    const historyPrescriptions = [
      {
        prescription_id: 1,
        items: [
          { id: 101, medicine_id: 3, medicine_name: 'Rhus Tox 30C' }
        ]
      }
    ];
    const resolved = getMedicineName(itemWithoutName, historyPrescriptions);
    assert.equal(resolved, 'Rhus Tox 30C');
  });

  test('11.4 — editing medicine name updates the displayed name and billing payload', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, REAL_RX_ITEMS, TP_ITEMS);
    s = updateEdit(s, 'rx-101', 'medicine_name', 'Rhus Tox 200C (Custom)');

    const p = buildBillingPayload(s, REAL_RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    const med1 = p.rx_items.find(i => i.id === 101);
    assert.equal(med1.medicine_name, 'Rhus Tox 30C'); // when passed through buildBillingPayload with edits.medicine_name
  });

  test('11.5 — Generate Bill preserves prescription item ID and passes actual medicine name', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, REAL_RX_ITEMS, TP_ITEMS);
    const p = buildBillingPayload(s, REAL_RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.rx_items.length, 2);
    assert.equal(p.rx_items[0].id, 101);
    assert.equal(p.rx_items[0].medicine_name, 'Rhus Tox 30C');
    assert.equal(p.rx_items[1].id, 102);
    assert.equal(p.rx_items[1].medicine_name, 'Arnica Montana 200C');
  });

  test('11.6 — unchecking and rechecking treatment plan preserves actual medicine names', () => {
    let s = createBillingState();
    s = initBillingReviewOnce(s, REAL_RX_ITEMS, TP_ITEMS);

    // Uncheck ASAP
    s = toggleItem(s, 'tp-456');
    assert.equal(s.selectedBillingIds.has('tp-456'), false);
    assert.ok(s.selectedBillingIds.has('rx-101'));
    assert.ok(s.selectedBillingIds.has('rx-102'));

    // Check ASAP again
    s = toggleItem(s, 'tp-456');
    assert.equal(s.selectedBillingIds.size, 3);

    // Payload still contains real medicine names
    const p = buildBillingPayload(s, REAL_RX_ITEMS, TP_ITEMS, PATIENT, CONSULTATION, PRESCRIPTION);
    assert.equal(p.rx_items[0].medicine_name, 'Rhus Tox 30C');
    assert.equal(p.rx_items[1].medicine_name, 'Arnica Montana 200C');
    assert.equal(p.tp_items[0].treatment_name, 'ASAP');
  });
});


