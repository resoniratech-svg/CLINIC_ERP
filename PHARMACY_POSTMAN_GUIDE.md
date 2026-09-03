# Pharmacy Module — Postman Setup & API Guide

This guide provides instructions for importing, configuring, and testing the **Pharmacy Module** API collection (`pharmacy_module.postman_collection.json`) in Postman.

---

## 1. Credentials & Authentication

### Default Seeding Details
| Role | Username | Password | Default Endpoint |
|---|---|---|---|
| Super Admin | `admin` | `SuperAdmin@123` | `/api/v1/auth/login` |
| Pharmacy Manager | `peter_pharmacy` | `Password@123` | `/api/v1/auth/login` |
| Doctor | `dr_smith` | `Password@123` | `/api/v1/auth/login` |
| PRO / Manager | `pat_pro` | `Password@123` | `/api/v1/auth/login` |
| Receptionist | `rita_rec` | `Password@123` | `/api/v1/auth/login` |

### Environment Variables
Configure the following in your Postman Environment:
- `base_url`: `http://localhost:5000/api/v1`
- `pharmacy_token`: Auto-set upon `POST /auth/login` as `peter_pharmacy`.

---

## 2. Fixed Hospital Operational Pipeline

```
RECEPTIONIST → PATIENT REGISTRATION → APPOINTMENT → CHECK-IN
  ↓
DOCTOR → CONSULTATION → PRESCRIPTION → DOCTOR COMPLETED
  ↓
PRO / MANAGER → COUNSELLING → BILLING → PAYMENT → PRO COMPLETED
  ↓
PHARMACY PENDING → PHARMACY QUEUE → PROCESS PRESCRIPTION → STOCK CHECK (FEFO)
  ↓
DISPENSE MEDICINES → COMPLETE DISPENSING → DEDUCT STOCK → CRM / FOLLOW-UP
```

---

## 3. Postman Collection Overview

### Core Sub-Modules Included:

1. **Auth & Profile**:
   - `POST /auth/login` (login as Pharmacy)
   - `GET /pharmacy/profile`
   - `PUT /pharmacy/profile`
   - `POST /auth/logout`

2. **Dashboard & Queue**:
   - `GET /pharmacy/dashboard`
   - `GET /pharmacy/queue?status=pending`
   - `GET /pharmacy/prescriptions/:id/process`

3. **Prescription Duration & Quantity Modification**:
   - `POST /pharmacy/prescriptions/items/:item_id/modify-days`
   - `GET /pharmacy/prescriptions/items/:item_id/modifications`

4. **Stock Check & FEFO Batch Selection**:
   - `GET /pharmacy/prescriptions/:id/stock-check`
   - `GET /pharmacy/medicines/:id/batches`
   - `PUT /pharmacy/prescriptions/items/:item_id/select-batch`

5. **Dispensing Workflow**:
   - `POST /pharmacy/prescriptions/:id/dispense/draft`
   - `POST /pharmacy/prescriptions/:id/dispense/complete`
   - `PUT /pharmacy/prescriptions/items/:item_id/status`

6. **Doctor Clarification Workflow**:
   - `POST /pharmacy/clarifications`
   - `GET /pharmacy/clarifications`
   - `POST /doctor/clarifications/:id/respond` (Doctor role)
   - `PUT /pharmacy/clarifications/:id/close`

7. **Inventory & Manual Stock Entry**:
   - `GET /pharmacy/medicines`
   - `POST /pharmacy/medicines`
   - `PUT /pharmacy/medicines/:id`
   - `GET /pharmacy/medicines/:id/stock`
   - `GET /pharmacy/stock`
   - `POST /pharmacy/stock`

8. **Excel Stock Import**:
   - `POST /pharmacy/stock/import/preview`
   - `POST /pharmacy/stock/import/confirm`
   - `GET /pharmacy/stock/import/history`
   - `GET /pharmacy/stock/import/:batch_id`

9. **Stock Alerts**:
   - `GET /pharmacy/stock/low-stock`
   - `GET /pharmacy/stock/expiring`
   - `GET /pharmacy/stock/expired`
   - `GET /pharmacy/stock/out-of-stock`

10. **Stock Transactions**:
    - `GET /pharmacy/stock/transactions`

11. **Stock Adjustments & Threshold Approval**:
    - `POST /pharmacy/stock/adjustments`
    - `GET /pharmacy/stock/adjustments`
    - `POST /pharmacy/stock/adjustments/:id/approve` (Super Admin role)

12. **Medicine Returns**:
    - `POST /pharmacy/returns`
    - `GET /pharmacy/returns`

13. **Dispensing History & Patient Search**:
    - `GET /pharmacy/dispensing/history`
    - `GET /pharmacy/patients/search`
