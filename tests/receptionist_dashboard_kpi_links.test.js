import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Receptionist Dashboard KPI Gridbox Navigation Suite', async (t) => {
  const dashPath = path.resolve('src/pages/receptionist/ReceptionistDashboard.jsx');
  const dashContent = fs.readFileSync(dashPath, 'utf8');

  await t.test('1. New Patients gridbox links to /receptionist/patients', () => {
    assert.match(dashContent, /to="\/receptionist\/patients"[\s\S]*?New Patients/);
  });

  await t.test('2. Appointments gridbox links to /receptionist/appointments', () => {
    assert.match(dashContent, /to="\/receptionist\/appointments"[\s\S]*?Appointments/);
  });

  await t.test('3. Waiting Patients gridbox links to /receptionist/check-in', () => {
    assert.match(dashContent, /to="\/receptionist\/check-in"[\s\S]*?Waiting Patients/);
  });

  await t.test('4. Consultation Revenue gridbox links to /receptionist/billing', () => {
    assert.match(dashContent, /to="\/receptionist\/billing"[\s\S]*?Consultation Revenue/);
  });

  await t.test('5. Enquiries Today gridbox links to /receptionist/enquiries', () => {
    assert.match(dashContent, /to="\/receptionist\/enquiries"[\s\S]*?Enquiries Today/);
  });

  await t.test('6. Executive Leads gridbox links to /receptionist/leads', () => {
    assert.match(dashContent, /to="\/receptionist\/leads"[\s\S]*?Executive Leads/);
  });

  await t.test('7. Callbacks Today gridbox links to /receptionist/crm', () => {
    assert.match(dashContent, /to="\/receptionist\/crm"[\s\S]*?Callbacks Today/);
  });

  await t.test('8. Renewals Due gridbox links to /receptionist/renewals', () => {
    assert.match(dashContent, /to="\/receptionist\/renewals"[\s\S]*?Renewals Due/);
  });

  await t.test('9. Due Patients gridbox links to /receptionist/due-patients', () => {
    assert.match(dashContent, /to="\/receptionist\/due-patients"[\s\S]*?Due Patients/);
  });

  await t.test('10. CRM Follow-ups gridbox links to /receptionist/crm', () => {
    assert.match(dashContent, /to="\/receptionist\/crm"[\s\S]*?CRM Follow-ups/);
  });

  await t.test('11. My Pending Tasks gridbox links to /receptionist/tasks', () => {
    assert.match(dashContent, /to="\/receptionist\/tasks"[\s\S]*?My Pending Tasks/);
  });
});
