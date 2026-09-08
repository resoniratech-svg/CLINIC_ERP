# PRO Portal — CRM / Calling Module Integration & Audit Report

**Date:** 06 September 2026  
**Module:** PRO Portal — CRM & Patient Calling Hub  
**Frontend Route:** `/pro/crm/calls` (with tabs: `/followups`, `/renewals`, `/dues`, `/acq`, `/ocnr`)  
**Backend API Base:** `/api/v1/pro` (`/calls`, `/followups`, `/renewals`, `/due-patients`, `/acq`, `/ocnr`)  
**Database Tables:** `call_records`, `crm_followups`, `renewals`, `patient_packages`, `billing_invoices`, `acq_patients`, `oc_nr_patients`, `patients`, `users`

---

## 1. Executive Summary & Screenshot Discrepancy Resolution

The audit was triggered to inspect and verify the complete implementation and backend/database integration of the PRO CRM & Patient Calling Hub shown in the reference UI screenshot (`media_1788687725558.png`).

### Root Cause Analysis of UI Screenshot Defects:
1. **Raw ISO Timestamp Leak in Callback Details:**
   - **Screenshot observation:** The CALLBACK DETAILS column displayed `2026-09-04T18:30:00.000Z 10:00:00` for record `call_id: 464` ("Default Patient").
   - **Root Cause:** PostgreSQL column `callback_date` is of data type `date`. When Node.js `pg` driver serialized this date object, it generated a full UTC ISO string `2026-09-04T18:30:00.000Z`, which was then concatenated directly with `callback_time` without formatting.
   - **Resolution:**
     - Backend SQL now uses `to_char(c.callback_date, 'YYYY-MM-DD') as callback_date`.
     - Frontend uses a dedicated formatting helper `formatCallback(dateStr, timeStr)` that outputs clean, localized format: `05/09/2026, 10:00 AM`.

2. **Enum Incompatibilities in UI Select Boxes:**
   - **Finding:** Frontend had arbitrary strings like `not_reachable` and `wrong_number` that did not exist in the PostgreSQL `call_status_type` enum (`connected`, `not_connected`, `busy`, `switched_off`, `interested`, `not_interested`, `callback_requested`, `appointment_booked`, `followup_required`, `completed`, `closed`).
   - **Resolution:** Synced frontend select options with live PostgreSQL enum definitions.

3. **Missing Patient Selection UX (Manual ID Guesswork):**
   - **Finding:** User had to manually enter integer patient IDs across all 4 modals (Log Call, Follow-up, Renewal, OC/NR).
   - **Resolution:** Integrated an interactive, debounced `PatientSelector` dropdown calling `proApi.searchPatients`. PROs can now search by patient name, phone number, or ID with real-time feedback and clear selection.

4. **Follow-up Lifecycle Completion:**
   - **Finding:** Follow-ups table lacked action controls to mark tasks as completed.
   - **Resolution:** Implemented `updateFollowupStatus` (`PUT /pro/followups/:id/status` and `POST /pro/followups/:id/complete`) in controller and routes, with a 1-click "Complete" button in the frontend table.

5. **Renewals Queue Visibility:**
   - **Finding:** Renewals tab only showed expiring packages without showing recorded renewals history.
   - **Resolution:** Updated `getRenewalsQueue` to query both `patient_packages` (expiring/expired) and `renewals` (recorded), rendering both sections with monetary figures and dates.

---

## 2. Live Database Verification & Schema Mapping

The PostgreSQL database `hospital_erp_db` is the absolute source of truth:

### 2.1 Enums Verified in `pg_enum`:
- `call_interaction_type`: `'inbound'`, `'outbound'`
- `call_purpose_type`: `'followup'`, `'renewal'`, `'due_payment'`, `'acq'`, `'ocnr'`, `'appointment'`, `'general_enquiry'`, `'callback'`, `'patient_feedback'`, `'other'`
- `call_status_type`: `'connected'`, `'not_connected'`, `'busy'`, `'switched_off'`, `'interested'`, `'not_interested'`, `'callback_requested'`, `'appointment_booked'`, `'followup_required'`, `'completed'`, `'closed'`
- `followup_category`: `'treatment'`, `'appointment'`, `'renewal'`, `'due'`, `'acq'`, `'ocnr'`, `'general'`
- `ocnr_type`: `'oc'`, `'nr'`

### 2.2 Live Data Record from Screenshot:
- Call `call_id: 464` in `call_records`:
  - `patient_id: 1` ("Default Patient")
  - `interaction_type: 'outbound'`
  - `call_purpose: 'callback'`
  - `call_status: 'callback_requested'`
  - `callback_date: '2026-09-05'`
  - `callback_time: '10:00:00'`
  - Time logged: `12:20 PM IST`

---

## 3. Endpoints & Business Logic Verified

| Endpoint | Method | Purpose | Key Validations & Logic |
| :--- | :--- | :--- | :--- |
| `/api/v1/pro/calls` | `GET` | Retrieve today's calls | Scoped by `branch_id`, formatted `callback_date`, patient joins |
| `/api/v1/pro/calls` | `POST` | Log call outcome | Patient existence check (404), enum validation (400), `callback_date` required when `callback_requested` (400), 5s idempotency guard (409) |
| `/api/v1/pro/followups` | `GET` | List follow-up tasks | Scoped by `branch_id`, formatted `due_date`, patient & assigned user joins |
| `/api/v1/pro/followups` | `POST` | Schedule follow-up | Patient existence check, category enum validation, Rule 16 executive assignment block (403), 5s idempotency guard |
| `/api/v1/pro/followups/:id/status` | `PUT` | Update follow-up status | Supports `completed`, `pending`, `cancelled` with audit trail |
| `/api/v1/pro/renewals/queue` | `GET` | Expiring pkgs & renewals | Returns `{ expired_packages, renewals }` with patient & doctor info |
| `/api/v1/pro/renewals` | `POST` | Record package renewal | Positive amount validation, patient existence check, idempotency guard |
| `/api/v1/pro/due-patients` | `GET` | Overdue bills | Scoped by branch, filters `due_amount > 0` |
| `/api/v1/pro/acq` | `GET` | ACQ care patients | Branch scoped, formatted dates |
| `/api/v1/pro/acq/:id` | `PUT` | Update ACQ status | Validates record existence and branch match |
| `/api/v1/pro/ocnr` | `GET` | OC / NR patients | Scoped by branch, formatted timestamps |
| `/api/v1/pro/ocnr` | `POST` | Record OC / NR patient | Classification enum check (`'oc'` or `'nr'`), patient existence, 5s idempotency guard |

---

## 4. Test Verification Summary

### 4.1 Backend Integration Test Suite (`tests/pro_crm_integration.test.js`):
- **26 Test Cases Executed & Passed (100% Pass Rate)**:
  - RBAC checks (401 unauthenticated, PRO manager / Super Admin authorized)
  - Missing field validation (400)
  - Non-existent patient validation (404)
  - Strict enum validation (`interaction_type`, `call_purpose`, `call_status`, `followup_type`, `classification`)
  - Callback date requirement logic
  - 5-second idempotency duplicate protection (409)
  - PostgreSQL record creation & update verification (`call_records`, `crm_followups`, `renewals`, `oc_nr_patients`)
  - Follow-up status completion via `PUT /followups/:id/status`

### 4.2 Frontend Unit & Integration Test Suite (`tests/pro_crm_hub.test.js`):
- **13 Test Cases Executed & Passed (100% Pass Rate)**:
  - Date & time formatting resolution (raw ISO to `DD/MM/YYYY, hh:mm A`)
  - Call form validation & required callback date
  - Follow-up form validation & purpose requirement
  - Renewal amount positive numerical requirement
  - OC/NR classification enforcement
- **Full Frontend Regression Suite:** 244 tests passed across 78 test suites.
- **Vite Production Build:** Successfully compiled with 0 errors.
