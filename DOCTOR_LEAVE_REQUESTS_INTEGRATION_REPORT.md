# DOCTOR PORTAL — LEAVE REQUESTS MODULE INTEGRATION REPORT
**Module Route**: `/doctor/leaves`  
**Target Actor**: Doctor Role (Super Admin Authorized)  
**Database**: PostgreSQL (`hospital_erp_db`)  
**Audit Date**: September 6, 2026  
**Final Status**: **COMPLETE & PRODUCTION-VERIFIED**

---

## 1. Executive Summary

A comprehensive, end-to-end audit, security verification, and integration fix was performed on the **Doctor Portal → Leave Requests** module (`/doctor/leaves`). 

Prior to this audit:
1. **Critical Timezone Shift Bug**: Stored PostgreSQL `DATE` values (e.g. `2026-09-20`) were shifting backwards by 1 calendar day (rendering as `2026-09-19`) when serialized via `new Date(...).toISOString()` due to IST (+05:30) midnight offsets.
2. **Doctor Scoping Vulnerability**: `applyLeave` allowed arbitrary `doctor_id` injection from the request body or defaulted to `1` when unlinked.
3. **Missing Date Logic & Overlap Validation**: Inverted dates (`to_date < from_date`) were not guarded at the controller level, causing raw PostgreSQL constraint 500 exceptions, and duplicate/overlapping active leaves were not detected.
4. **UX Resilience Deficits**: Missing network retry/error state, form fields remained dirty on cancel, and reason options omitted values stored in production database records.

All root causes were resolved directly at the database query, controller authorization, and React component layers. Automated regression test suites were created and executed with 100% pass rates.

---

## 2. Architecture & Database Source of Truth

### 2.1 Database Schema (`doctor_leaves`)

Table inspection on live PostgreSQL database `hospital_erp_db`:

```sql
CREATE TABLE IF NOT EXISTS doctor_leaves (
    id             SERIAL PRIMARY KEY,
    doctor_id      INTEGER NOT NULL REFERENCES doctors(doctor_id),
    from_date      DATE NOT NULL,
    to_date        DATE NOT NULL,
    reason         TEXT NOT NULL,
    remarks        TEXT,
    status         reset_status NOT NULL DEFAULT 'pending',
    approved_by    INTEGER REFERENCES users(user_id),
    branch_id      INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (to_date >= from_date)
);
```

### 2.2 Status Workflow (`reset_status` Enum)

The `reset_status` Postgres enum defines strictly 3 valid lifecycle states:
- `pending`: Default status upon application submission by Doctor.
- `approved`: Transitioned by Super Admin (`approved_by` populated with Admin's `user_id`).
- `rejected`: Transitioned by Super Admin with rejection notes.

### 2.3 Covering Doctor Architecture Disproved & Resolved

- **Initial Observation**: Screenshot displayed `"Covered by Dr. Connor"`.
- **Database Inspection**: Disproved the existence of any separate `covering_doctor_id` column. The text was entered by the doctor in the `remarks` column (`remarks: 'Covered by Dr. Connor'`).
- **Resolution**: Enhanced the UI to render `remarks` with prominent styling as a contextual note (e.g. covering arrangements or handover details) without inventing fabricated database relationships.

---

## 3. Endpoints & API Contract

### 3.1 Apply for Leave
- **Endpoint**: `POST /api/v1/doctor/leaves`
- **RBAC**: `authorizeRoles('doctor', 'super_admin')`
- **Request Headers**: `Authorization: Bearer <jwt_token>`
- **Request Body**:
  ```json
  {
    "from_date": "2026-12-10",
    "to_date": "2026-12-15",
    "reason": "Attending Medical Conference",
    "remarks": "Covered by Dr. Connor"
  }
  ```
- **Validation Rules**:
  - `from_date`, `to_date`, and `reason` are mandatory.
  - Date strings must match `YYYY-MM-DD` regex and be valid calendar dates.
  - `to_date >= from_date` strictly enforced (returns `400 Bad Request` if violated).
  - Reason must be non-empty after whitespace trimming.
  - Doctor scoping: authenticated doctor `doctor_id` is resolved via JWT session; spoofing `req.body.doctor_id` is strictly blocked.
  - Overlapping active leave (`pending` or `approved`) check: returns `409 Conflict`.
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "id": 12,
      "doctor_id": 100,
      "from_date": "2026-12-10",
      "to_date": "2026-12-15",
      "reason": "Attending Medical Conference",
      "remarks": "Covered by Dr. Connor",
      "status": "pending",
      "approved_by": null,
      "branch_id": 1,
      "created_at": "2026-09-06T07:25:00.000Z",
      "updated_at": "2026-09-06T07:25:00.000Z"
    },
    "message": "Leave request submitted successfully. Awaiting Super Admin approval."
  }
  ```

### 3.2 Get My Leaves
- **Endpoint**: `GET /api/v1/doctor/leaves/mine`
- **RBAC**: `authorizeRoles('doctor', 'super_admin')`
- **Doctor Scoping**: Automatically resolves authenticated doctor ID from session. Ignores query param `?doctor_id=...` for doctor role to prevent cross-doctor snooping.
- **SQL Date Serialization**: Uses `to_char(dl.from_date, 'YYYY-MM-DD')` and `to_char(dl.to_date, 'YYYY-MM-DD')` to eliminate timezone offsets.
- **Join**: `LEFT JOIN users u_app ON dl.approved_by = u_app.user_id` to include `approved_by_name`.
- **Response**: `200 OK`

---

## 4. Bugs Found & Root Cause Fixes

| # | Bug / Vulnerability | Root Cause | Fix Applied |
|---|---------------------|------------|-------------|
| 1 | **Calendar Day Shift (-1 day)** | Controller used `new Date(r.from_date).toISOString().split('T')[0]` on midnight IST dates. | Replaced with SQL `to_char(from_date, 'YYYY-MM-DD')` and UTC date math. |
| 2 | **Doctor Spoofing Vulnerability** | `applyLeave` fell back to `req.body.doctor_id \|\| 1`. | Enforced strict JWT session resolution (`docId`) for `doctor` role. Rejected unlinked profiles with `404`. |
| 3 | **500 on Inverted Date Ranges** | Missing check when `to_date < from_date`, throwing DB constraint error. | Added validation returning clean `400 Bad Request`. |
| 4 | **Unchecked Overlapping Leaves** | No duplicate/overlap prevention. | Added SQL overlap verification returning `409 Conflict`. |
| 5 | **Missing Reason Option** | Production DB had "Attending Medical Conference", but dropdown lacked this option. | Added "Attending Medical Conference" to dropdown options. |
| 6 | **Dirty Form on Cancel** | Cancel button only toggled `showForm(false)` without resetting fields. | Implemented `handleCancel()` resetting form state. |
| 7 | **Missing Error / Retry State** | Network or API failure only showed transient toast without retry state. | Added inline error banner with "Try Again" retry button. |
| 8 | **Rapid Double Submission** | Submit button did not disable or show spinner while request was in-flight. | Added `disabled={submitting}` and spinning `RefreshCw` icon. |

---

## 5. Automated Test Coverage & Results

### 5.1 Backend Integration Tests (`tests/doctor_leaves_integration.test.js`)
Executed against live PostgreSQL database:

```text
PASS tests/doctor_leaves_integration.test.js
  Doctor Portal — Leave Requests Module End-to-End Integration & Audit Test Suite
    1. Authentication & Authorization Enforcement
      ✓ 1.1 GET /api/v1/doctor/leaves/mine without token returns 401 Unauthorized (18 ms)
      ✓ 1.2 POST /api/v1/doctor/leaves without token returns 401 Unauthorized (16 ms)
      ✓ 1.3 GET /api/v1/doctor/leaves/mine with invalid token returns 403 Forbidden (2 ms)
      ✓ 1.4 Receptionist role is forbidden (403) from viewing doctor leaves (4 ms)
      ✓ 1.5 Receptionist role is forbidden (403) from applying for doctor leave (4 ms)
      ✓ 1.6 Doctor role is authorized (200) to view leave requests (6 ms)
    2. Input Validation & Date Order Rules
      ✓ 2.1 Missing from_date returns 400 Bad Request (3 ms)
      ✓ 2.2 Missing to_date returns 400 Bad Request (3 ms)
      ✓ 2.3 Missing reason returns 400 Bad Request (3 ms)
      ✓ 2.4 Empty or whitespace-only reason returns 400 Bad Request (3 ms)
      ✓ 2.5 Non-YYYY-MM-DD date format returns 400 Bad Request (2 ms)
      ✓ 2.6 to_date earlier than from_date returns 400 Bad Request (3 ms)
      ✓ 2.7 Valid single-day leave (from_date === to_date) succeeds with 201 Created (18 ms)
      ✓ 2.8 Valid multi-day leave succeeds with 201 Created and exact dates (6 ms)
    3. Overlapping & Duplicate Leave Prevention
      ✓ 3.1 Applying for leave overlapping existing pending leave returns 409 Conflict (4 ms)
      ✓ 3.2 Applying for exact same date range returns 409 Conflict (3 ms)
    4. Doctor Data Isolation & Scoping
      ✓ 4.1 Doctor 2 sees Doctor 2 leave in /leaves/mine (4 ms)
      ✓ 4.2 Doctor 1 CANNOT see Doctor 2 leave in /leaves/mine (4 ms)
      ✓ 4.3 Doctor 2 attempting to spoof Doctor 1 via query param is ignored (5 ms)
      ✓ 4.4 Doctor 2 attempting to create leave on behalf of Doctor 1 is overridden to Doctor 2 (4 ms)
      ✓ 4.5 Super Admin can view all leaves or filter by doctor_id (5 ms)
    5. PostgreSQL Persistence & Timezone-Exact Date Fidelity
      ✓ 5.1 Leave record exists in PostgreSQL with exact matching dates (34 ms)

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

### 5.2 Frontend Contract Tests (`tests/doctor_leaves.test.js`)
Executed with Node.js test runner:

```text
▶ Doctor Portal — Leave Requests Module Frontend & Contract Suite
  ✔ 1. Navigation & Routing Architecture (3 tests passed)
  ✔ 2. Component Architecture & UI Controls (7 tests passed)
  ✔ 3. Date Math & Day Count Logic (5 tests passed)
  ✔ 4. Leave History & Status Rendering (4 tests passed)
  ✔ 5. API Service Contracts (2 tests passed)
✔ Doctor Portal — Leave Requests Module Frontend & Contract Suite (21 passed, 0 failed)
```

### 5.3 Regression Test Results
- **Backend Treatment Plans Integration Suite**: 29/29 tests passed.
- **Frontend Full Suite**: 219/219 tests passed (across all 66 suites).
- **Vite Production Build**: Succeeded (`dist/assets/index-DYkW4R2W.js` bundled cleanly).

---

## 6. Final Acceptance Verification

- [x] Route `/doctor/leaves` operates with zero console errors.
- [x] Backend routes correctly authenticated via JWT and authorized for Doctor & Super Admin.
- [x] PostgreSQL table `doctor_leaves` verified as single source of truth.
- [x] No `localStorage` or `sessionStorage` used for persistence.
- [x] Date integrity verified: dates match database records with 100% calendar accuracy.
- [x] Multi-doctor isolation enforced: Doctor 1 cannot see or manipulate Doctor 2 leaves.
- [x] Overlapping and duplicate submissions rejected with `409 Conflict`.
- [x] Form cancel clears input state and closes section.
- [x] Refresh button triggers live database fetch with active spinner.
- [x] Responsive on desktop, tablet, and mobile viewport widths.

**Conclusion**: The **Doctor Portal — Leave Requests Module** is fully audited, securely integrated, resiliently tested, and certified **COMPLETE**.
