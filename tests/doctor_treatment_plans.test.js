import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// DOCTOR PORTAL — TREATMENT PLANS MODULE FRONTEND & CONTRACT INTEGRATION TEST
// ============================================================================

const TREATMENT_PLANS_PAGE = path.resolve(process.cwd(), 'src/pages/doctor/TreatmentPlansPage.jsx');
const API_FILE = path.resolve(process.cwd(), 'src/api/index.js');
const APP_FILE = path.resolve(process.cwd(), 'src/App.jsx');
const SIDEBAR_FILE = path.resolve(process.cwd(), 'src/components/layout/DoctorSidebar.jsx');

describe('Doctor Portal — Treatment Plans Module Frontend & Contract Suite', () => {
  const pageContent = fs.readFileSync(TREATMENT_PLANS_PAGE, 'utf-8');
  const apiContent = fs.readFileSync(API_FILE, 'utf-8');
  const appContent = fs.readFileSync(APP_FILE, 'utf-8');
  const sidebarContent = fs.readFileSync(SIDEBAR_FILE, 'utf-8');

  // 1. Navigation & Route Architecture
  describe('1. Navigation & Routing Architecture', () => {
    test('1.1 App.jsx registers the route "/treatment-plans" pointing to TreatmentPlansPage', () => {
      assert.ok(
        appContent.includes('path="treatment-plans"') || appContent.includes('treatment-plans'),
        'App.jsx must declare treatment-plans route'
      );
      assert.ok(
        appContent.includes('TreatmentPlansPage'),
        'App.jsx must mount TreatmentPlansPage component'
      );
    });

    test('1.2 DoctorSidebar contains NavLink to "/doctor/treatment-plans" labeled "Treatments"', () => {
      assert.ok(
        sidebarContent.includes('to="/doctor/treatment-plans"'),
        'DoctorSidebar must link to /doctor/treatment-plans'
      );
      assert.ok(
        sidebarContent.includes('Treatments'),
        'DoctorSidebar must label the link as Treatments'
      );
    });

    test('1.3 Prohibited billing/inventory links are absent from DoctorSidebar', () => {
      assert.strictEqual(sidebarContent.includes('/doctor/billing'), false);
      assert.strictEqual(sidebarContent.includes('/doctor/pharmacy-stock'), false);
    });
  });

  // 2. API Contract Alignment
  describe('2. Backend API Service Contract', () => {
    test('2.1 doctorApi defines getMyTreatmentPlans targeting GET /doctor/treatment-plans/mine', () => {
      assert.ok(
        apiContent.includes('getMyTreatmentPlans'),
        'doctorApi must include getMyTreatmentPlans'
      );
      assert.ok(
        apiContent.includes('/doctor/treatment-plans/mine'),
        'getMyTreatmentPlans must target /doctor/treatment-plans/mine'
      );
    });

    test('2.2 doctorApi defines getTreatmentPlanDetails targeting GET /doctor/treatment-plans/:id', () => {
      assert.ok(
        apiContent.includes('getTreatmentPlanDetails'),
        'doctorApi must include getTreatmentPlanDetails'
      );
      assert.ok(
        apiContent.includes('/doctor/treatment-plans/${id}') || apiContent.includes('/doctor/treatment-plans/'),
        'getTreatmentPlanDetails must target /doctor/treatment-plans/:id'
      );
    });

    test('2.3 doctorApi defines updateTreatmentPlan targeting PUT /doctor/treatment-plans/:id', () => {
      assert.ok(
        apiContent.includes('updateTreatmentPlan'),
        'doctorApi must include updateTreatmentPlan'
      );
      assert.ok(
        apiContent.includes("axiosClient.put(`/doctor/treatment-plans/${id}`"),
        'updateTreatmentPlan must perform PUT to /doctor/treatment-plans/:id'
      );
    });

    test('2.4 doctorApi defines createTreatmentPlan targeting POST /doctor/treatment-plans', () => {
      assert.ok(
        apiContent.includes('createTreatmentPlan'),
        'doctorApi must include createTreatmentPlan'
      );
      assert.ok(
        apiContent.includes("axiosClient.post('/doctor/treatment-plans'"),
        'createTreatmentPlan must perform POST to /doctor/treatment-plans'
      );
    });
  });

  // 3. UI Component Architecture & Visible Controls
  describe('3. Treatment Plans UI Controls & Data Display', () => {
    test('3.1 Page header renders Treatment Plans title and subtitle', () => {
      assert.ok(pageContent.includes('Treatment Plans'), 'Page header must display Treatment Plans');
      assert.ok(pageContent.includes('All treatment plans issued for your patients'), 'Page subtitle must be present');
    });

    test('3.2 Status filter dropdown provides All Status, Active, Completed, and Cancelled', () => {
      assert.ok(pageContent.includes('<select'), 'Status filter select element must exist');
      assert.ok(pageContent.includes('All Status'), 'All Status option must exist');
      assert.ok(pageContent.includes('value="active"'), 'Active option must exist');
      assert.ok(pageContent.includes('value="completed"'), 'Completed option must exist');
      assert.ok(pageContent.includes('value="cancelled"'), 'Cancelled option must exist');
    });

    test('3.3 Refresh button triggers API fetch and displays spin animation during refresh', () => {
      assert.ok(pageContent.includes('fetchPlans(true)'), 'Refresh button must invoke fetchPlans');
      assert.ok(pageContent.includes('animate-spin'), 'Refresh icon must show spin animation while loading');
    });

    test('3.4 Search input allows searching treatments or patients and binds to search query', () => {
      assert.ok(pageContent.includes('placeholder="Search treatment or patient..."'), 'Search input placeholder must match');
      assert.ok(pageContent.includes('onChange={e => setSearch(e.target.value)}'), 'Search input must bind to search state');
    });

    test('3.5 Treatment cards render real backend-supported fields', () => {
      assert.ok(pageContent.includes('t.treatment_name'), 'Card must render treatment_name');
      assert.ok(pageContent.includes('t.treatment_type'), 'Card must render treatment_type');
      assert.ok(pageContent.includes('t.patient_name'), 'Card must render patient_name');
      assert.ok(pageContent.includes('t.registration_id'), 'Card must render registration_id');
      assert.ok(pageContent.includes('formatDate(t.start_date)'), 'Card must render formatted start_date');
      assert.ok(pageContent.includes('formatDate(t.end_date)'), 'Card must render formatted end_date');
      assert.ok(pageContent.includes('t.duration'), 'Card must render duration');
      assert.ok(pageContent.includes('t.duration_unit'), 'Card must render duration_unit');
      assert.ok(pageContent.includes('statusColors[t.status]'), 'Card must render color-coded status badge');
    });

    test('3.6 Card click triggers handleOpenDetails modal', () => {
      assert.ok(
        pageContent.includes('onClick={() => handleOpenDetails(t)}'),
        'Card click must trigger handleOpenDetails'
      );
    });
  });

  // 4. Details & Action Modal Architecture
  describe('4. Treatment Plan Details & Action Modal', () => {
    test('4.1 Details modal renders patient contact, age, and gender', () => {
      assert.ok(pageContent.includes('selectedPlan.patient_name'), 'Details modal must show patient name');
      assert.ok(pageContent.includes('selectedPlan.registration_id'), 'Details modal must show registration ID');
      assert.ok(pageContent.includes('selectedPlan.patient_phone'), 'Details modal must show phone if present');
      assert.ok(pageContent.includes('selectedPlan.patient_age'), 'Details modal must show age if present');
    });

    test('4.2 Details modal renders doctor information and consultation ID', () => {
      assert.ok(pageContent.includes('selectedPlan.doctor_name'), 'Details modal must show doctor name');
      assert.ok(pageContent.includes('selectedPlan.doctor_code'), 'Details modal must show doctor code');
      assert.ok(pageContent.includes('selectedPlan.consultation_id'), 'Details modal must show consultation ID');
    });

    test('4.3 Active treatment plan provides Mark Completed and Cancel Plan action buttons', () => {
      assert.ok(
        pageContent.includes("handleUpdateStatus('completed')"),
        'Modal must allow marking plan completed'
      );
      assert.ok(
        pageContent.includes("handleUpdateStatus('cancelled')"),
        'Modal must allow cancelling plan'
      );
      assert.ok(pageContent.includes('Mark Completed'), 'Button label must be Mark Completed');
      assert.ok(pageContent.includes('Cancel Plan'), 'Button label must be Cancel Plan');
    });

    test('4.4 Edit mode allows modifying instructions, treatment notes, frequency, and duration', () => {
      assert.ok(pageContent.includes('isEditing'), 'Modal must support edit mode');
      assert.ok(pageContent.includes('editForm.instructions'), 'Edit form must bind instructions');
      assert.ok(pageContent.includes('editForm.treatment_notes'), 'Edit form must bind treatment_notes');
      assert.ok(pageContent.includes('editForm.frequency'), 'Edit form must bind frequency');
      assert.ok(pageContent.includes('handleSaveEdits'), 'Save edits button must trigger handleSaveEdits');
    });
  });

  // 5. Creation Modal Architecture
  describe('5. New Treatment Plan Modal', () => {
    test('5.1 Header includes "New Plan" button opening creation modal', () => {
      assert.ok(pageContent.includes('handleOpenCreateModal'), 'New Plan button must invoke handleOpenCreateModal');
      assert.ok(pageContent.includes('New Plan'), 'Button text must include New Plan');
    });

    test('5.2 Creation form fetches active draft consultations for patient attachment', () => {
      assert.ok(
        pageContent.includes("getConsultationHistory({ status: 'draft' })"),
        'Create modal must query draft consultations'
      );
      assert.ok(
        pageContent.includes('draftConsultations'),
        'Create modal must populate draft consultations list'
      );
    });

    test('5.3 Creation form includes required fields: consultation, name, type, date, duration, unit', () => {
      assert.ok(pageContent.includes('createForm.consultation_id'), 'Form must bind consultation_id');
      assert.ok(pageContent.includes('createForm.treatment_name'), 'Form must bind treatment_name');
      assert.ok(pageContent.includes('createForm.treatment_type'), 'Form must bind treatment_type');
      assert.ok(pageContent.includes('createForm.start_date'), 'Form must bind start_date');
      assert.ok(pageContent.includes('createForm.duration'), 'Form must bind duration');
      assert.ok(pageContent.includes('createForm.duration_unit'), 'Form must bind duration_unit');
      assert.ok(pageContent.includes('handleCreateSubmit'), 'Form submit must call handleCreateSubmit');
    });
  });

  // 6. Error Handling & Distinctions
  describe('6. Error Handling & State Segregation', () => {
    test('6.1 Component distinguishes between Loading, API Failure, and Empty Data states', () => {
      assert.ok(pageContent.includes('LoadingSpinner'), 'Loading state must use LoadingSpinner');
      assert.ok(pageContent.includes('error ? ('), 'API error must render dedicated error state');
      assert.ok(pageContent.includes('Try Again'), 'Error state must provide Try Again button');
      assert.ok(pageContent.includes('No treatment plans found'), 'Empty data must display No treatment plans found');
    });

    test('6.2 Component prevents masking API errors as empty data', () => {
      assert.ok(
        pageContent.includes('setError(errMsg)'),
        'API errors must set error state rather than presenting false empty lists'
      );
    });
  });

  // 7. Data Sanitization & Date Formatting
  describe('7. Date Formatting & Timezone Skew Prevention', () => {
    test('7.1 formatDate helper parses YYYY-MM-DD strings directly to prevent UTC timezone drift', () => {
      assert.ok(pageContent.includes("s.split('-')"), 'formatDate must split YYYY-MM-DD components');
      assert.ok(
        pageContent.includes("parseInt(d, 10)") && pageContent.includes("parseInt(m, 10)"),
        'formatDate must format day and month directly'
      );
    });
  });
});
