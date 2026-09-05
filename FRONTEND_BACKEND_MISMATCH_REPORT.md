# WeCare Homeopathy ERP — Frontend-Backend Mismatch Audit & Resolution Report

This document records all contract, schema, parameter, and business rule mismatches detected during full-stack inspection, along with their resolutions.

---

## 1. Authentication & Session Keys
* **Mismatch**: Initial frontend code stored token under custom names and lacked authorization header injection for multipart requests.
* **Resolution**: Standardized on `token` in `localStorage`, unified Axios interceptors with `Bearer <token>` injection and proactive 401 token expiry redirection to `/login`.

---

## 2. Receptionist Single-Flow Registration Contract
* **Mismatch**: Frontend was attempting separate uncoordinated calls for patient registration, initial visit booking, and consultation bill generation.
* **Resolution**: Integrated with atomic `POST /api/v1/receptionist/patients/register-flow` which bundles:
  1. Patient master creation (`patients`)
  2. Appointment booking (`appointments`)
  3. Consultation billing invoice (`bills`)
  4. Initial payment settlement (`payments`) with live cash ledger auto-sync.

---

## 3. PRO Handoff Queue & Clinical Confidentiality
* **Mismatch**: Doctor's internal prescription notes were initially visible on general queues.
* **Resolution**: Verified that `GET /api/v1/pro/queue` explicitly masks `doctor_notes` (returning `[Confidential - Doctor Consultation]`), while exposing prescribed packages and duration for counseling.

---

## 4. Call Center & Lead Duplicate Protection
* **Mismatch**: Frontend bulk Excel upload lacked duplicate mobile number warnings.
* **Resolution**: Integrated with `POST /api/v1/executive/leads/import/preview` and `confirm` which validates mobile uniqueness against `patients` and `leads` tables and reports duplicates before committing.

---

## 5. Mathematical Target Split Constraint
* **Mismatch**: Target creation forms did not validate the equality between total quota and the sum of its subdivisions.
* **Resolution**: Enforced constraint $\text{Enquiry Target} + \text{Unit Target} = \text{Overall Target}$ with live mathematical calculation in UI and backend 400 validation.

---

## 6. Discount Approval Rules & Role Boundaries
* **Mismatch**: Treatment billing forms allowed arbitrary discount inputs without manager approval.
* **Resolution**: Aligned with backend discount threshold (20% maximum cap for staff, requiring admin approval or Super Admin privilege for higher discounts).

---

## 7. Cash Drawer Equation & Bank Over-Deposit Protection
* **Mismatch**: Cash management forms allowed bank deposits exceeding available cash in the drawer.
* **Resolution**: Integrated with backend validation where $\text{deposited\_amount} \le \text{available\_cash}$ ($\text{Opening} + \text{Cash In} - \text{Expenses} - \text{Prior Deposits}$) and updated the UI with live available balance warnings.

---

## 8. CRM Rule 12 Enforcement
* **Mismatch**: Follow-up assignments allowed choosing Call Center Executives.
* **Resolution**: Aligned dropdown to only list personnel with role `receptionist` or `pro_manager`, satisfying Rule 12 and preventing HTTP 400 rejections.

---

## 9. Pharmacy FEFO Batch Expiration & Prohibited Action Blockers
* **Mismatch**: Pharmacy inventory did not enforce First-Expiry-First-Out (FEFO) batching or block pharmacists from editing prescriptions.
* **Resolution**: Integrated FEFO batch picker (`/pharmacy/medicines/:id/batches`) and handled HTTP 403 blockers for unauthorized clinical alterations.

---

## 10. Doctor Resignation & Clinical Continuity Protocol
* **Mismatch**: Doctor deactivation risked orphaning scheduled appointments and corrupting historical medical records.
* **Resolution**: Integrated `POST /api/v1/doctors/:id/transfer` which reassigns future appointments and pending treatments to a designated successor while permanently preserving completed consultations and prescriptions under the original doctor.
