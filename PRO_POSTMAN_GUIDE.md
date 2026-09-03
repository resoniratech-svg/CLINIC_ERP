# 🧑‍💼 PRO / Manager Module — Postman Execution Guide

This document provides step-by-step instructions for testing all 16 PRO sub-modules using Postman or cURL.

---

## 1. Setup Instructions

### Server & Base URL
- **Base URL**: `http://localhost:5000/api/v1`
- **Headers Required for Authenticated Requests**:
  ```http
  Authorization: Bearer <TOKEN>
  Content-Type: application/json
  ```

---

## 2. Test Credentials

| Role | Username | Password |
|---|---|---|
| **PRO / Manager** | `pat_pro` | `Password@123` |
| **Doctor** | `dr_smith` | `Password@123` |
| **Receptionist** | `rita_rec` | `Password@123` |
| **Executive** | `eric_exec` | `Password@123` |

---

## 3. Postman Workflow Steps

### Step 1: PRO Login & Obtain Token
- **POST** `/api/v1/auth/login`
- **Request Body**:
  ```json
  {
    "username": "pat_pro",
    "password": "Password@123"
  }
  ```
- **Response**: Copy the `data.token` and set it in your Postman collection variables as `pro_token`.

---

### Step 2: PRO Dashboard & Queue Management
- **GET** `/api/v1/pro/dashboard`
- **GET** `/api/v1/pro/queue?status=pending`

---

### Step 3: Patient 360° Overview
- **GET** `/api/v1/pro/patients/1/overview`
- **Key Business Rule Verification**: Notice `consultation.doctor_notes` is hidden/masked from PRO.

---

### Step 4: Counselling Module
- **POST** `/api/v1/pro/counselling`
  ```json
  {
    "patient_id": 1,
    "doctor_id": 1,
    "counselling_type": "treatment_plan",
    "notes": "Patient counselled on 30-day comprehensive care plan.",
    "patient_understanding": "agreed",
    "patient_response": "Ready to start treatment today"
  }
  ```
- **GET** `/api/v1/pro/counselling/history?patient_id=1`

---

### Step 5: Packages / Plans Management
- **POST** `/api/v1/pro/packages`
  ```json
  {
    "patient_id": 1,
    "package_name": "30-Day Recovery Plan",
    "package_type": "monthly",
    "from_date": "2026-09-02",
    "package_amount": 15000,
    "discount_amount": 2000
  }
  ```
- **GET** `/api/v1/pro/packages?status=active`

---

### Step 6: Billing & Invoicing
- **POST** `/api/v1/pro/bills`
  ```json
  {
    "patient_id": 1,
    "bill_type": "package",
    "items": [
      { "item_name": "30-Day Package Initial Session", "quantity": 1, "unit_price": 13000 }
    ],
    "discount_amount": 0
  }
  ```
- **GET** `/api/v1/pro/bills/pending`

---

### Step 7: Payments & Collections
- **POST** `/api/v1/pro/payments`
  ```json
  {
    "bill_id": 1,
    "payments": [
      { "amount": 8000, "payment_method": "cash" }
    ]
  }
  ```
- **GET** `/api/v1/pro/payments/due-collections`

---

### Step 8: Prescription Modifications (Audit Flow)
- **POST** `/api/v1/pro/prescriptions/items/1/modify` (Operational - Quantity/Duration)
  ```json
  {
    "field_changed": "quantity",
    "modified_value": "15",
    "reason": "Patient requested additional 5 days supply"
  }
  ```
- **POST** `/api/v1/pro/prescriptions/items/1/modify` (Clinical - Dosage/Medicine)
  ```json
  {
    "field_changed": "dosage",
    "modified_value": "650mg",
    "reason": "Fever unresolved"
  }
  ```
- **POST** `/api/v1/doctor/prescription-modifications/1/decision` (Doctor Token)
  ```json
  {
    "decision": "approved",
    "doctor_remarks": "Increased dosage approved"
  }
  ```

---

### Step 9: Accountant / Cash Management Ledger
- **GET** `/api/v1/pro/accountant/opening-balance`
- **GET** `/api/v1/pro/accountant/cash-revenue`
- **POST** `/api/v1/pro/accountant/expenditure`
  ```json
  {
    "category": "Office Stationery",
    "description": "Receipt book printing",
    "amount": 500
  }
  ```
- **GET** `/api/v1/pro/accountant/closing-balance`
- **POST** `/api/v1/pro/accountant/deposit`
  ```json
  {
    "deposit_amount": 7000,
    "deposit_reference": "HDFC-DEP-998811"
  }
  ```
- **GET** `/api/v1/pro/accountant/daily-summary`

---

### Step 10: Feedback & Complaints
- **POST** `/api/v1/pro/feedback`
  ```json
  {
    "patient_id": 1,
    "category_type": "care_quality",
    "description": "Excellent service by nursing staff",
    "rating": 5
  }
  ```
- **POST** `/api/v1/pro/complaints`
  ```json
  {
    "patient_id": 1,
    "category_type": "wait_time",
    "description": "Wait time in pharmacy was 30 minutes",
    "priority": "high"
  }
  ```

---

### Step 11: PRO Handoff Checklist & Completion
- **GET** `/api/v1/pro/patients/1/pro-checklist`
- **POST** `/api/v1/pro/patients/1/complete-pro`
- **Response**: Unlocks prescription and releases patient to Pharmacy Queue.

---

### Step 12: PRO Logout
- **POST** `/api/v1/auth/logout`
  - Records session duration in `login_logs`.
