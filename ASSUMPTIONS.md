# 📋 PRO / Manager Module — System Assumptions & Design Decisions

This document outlines key technical assumptions, schema mappings, and design decisions made during the implementation of the PRO / Manager module.

---

## 1. Multi-Branch System Assumption
- **Single Branch Operation**: As specified in Rule 1, `branch_id = 1` is hardcoded/defaulted across all SQL queries and table constraints for the single-branch hospital deployment.

---

## 2. Monetary & Financial Computations
- **Server Authority**: All subtotals, final amounts, discounts, package totals, remaining dues, and closing cash balances are calculated on the backend server. Any client-sent total amounts or subtotals are overridden by server calculations.
- **Realized Revenue vs Accrued Revenue**: Realized revenue is computed strictly from confirmed payments in the `payments` table (excluding refunded transactions), ensuring Doctor target attribution reflects actual cash/bank collections.
- **Cash Ledger Closing Balance Calculation**:
  $$\text{Closing Cash} = \text{Opening Cash} + \text{Cash Revenue} - \text{Cash Expenditures} - \text{Cash Deposited}$$

---

## 3. Prescription Modification Classification
- **Operational Modifications**: Changes to `duration` or `quantity` are treated as operational adjustments and applied immediately to `prescription_items` with status `applied`.
- **Clinical Modifications**: Changes to `dosage`, `medicine`, `frequency`, or `instructions` are treated as clinical decisions and require Doctor approval (`POST /api/v1/doctor/prescription-modifications/:id/decision`) before updating `prescription_items`.

---

## 4. Privacy & Compliance (HIPAA / Clinical Isolation)
- **Doctor Notes Isolation**: `consultations.doctor_notes` is strictly omitted from PRO endpoints (including `GET /api/v1/pro/patients/:id/overview`) to protect sensitive doctor-patient clinical notes while giving PRO full visibility over diagnosis, complaints, tests, and prescriptions.

---

## 5. Handoff to Pharmacy Queue
- **Gatekeeping**: `POST /patients/:id/complete-pro` verifies that counselling and treatment/package billing invoices are recorded before transitioning appointment status to `pro_completed` and unlocking the prescription for Pharmacy dispensing.

---

## 6. Pharmacy Module — Operational & FEFO Assumptions
- **Operational Stage Isolation**: Pharmacy does NOT process payments or generate billing invoices. Every prohibited action (`patient registration`, `doctor assignment`, `consultation fee edit`, `billing`, `payment`) returns `403 Forbidden`.
- **Prescription Queue Gating**: Prescriptions are listed in `GET /api/v1/pharmacy/queue` and available for dispensing ONLY when the patient appointment status is `pro_completed`.
- **FEFO Batch Selection**: Usable batches (`expiry_date >= CURRENT_DATE` and `quantity > 0`) are selected in FEFO (`expiry_date ASC`) order. Expired or zero-quantity batches are blocked from selection with HTTP `422 Unprocessable Entity`.
- **Stock Deductions & Locking**: Complete dispensing uses PostgreSQL `SELECT ... FOR UPDATE` row locks to prevent race conditions and negative inventory under concurrent multi-user dispensing requests.
- **Stock Adjustment Threshold Approval**: Stock reconciliation adjustments exceeding the configured threshold (`pharmacy_adjustment_approval_threshold = 10` units by default) are saved as `pending` and require Super Admin approval via `POST /api/v1/pharmacy/stock/adjustments/:id/approve` before updating inventory.
- **Returns & Restocking Policy**: Returned medicines in `good` condition restore stock quantity (`quantity = quantity + return_qty`), whereas damaged, expired, or opened medicines record the return ledger without updating stock (`restocked = false`).
