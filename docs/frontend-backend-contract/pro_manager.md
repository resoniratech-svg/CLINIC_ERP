# API Contract: PRO / Manager (Module 6)

## 1. PRO Dashboard & Queue
- **Endpoints**:
  - `GET /api/v1/pro/dashboard`
  - `GET /api/v1/pro/queue?status=pending|in_progress`
  - `GET /api/v1/pro/patients/:id/overview` *(Crucial: `doctor_notes` is permanently masked from PRO for clinical confidentiality)*

---

## 2. Treatment Packages & Plans
- **Endpoint**: `POST /api/v1/pro/packages`
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "package_name": "Annual Constitutional Care",
    "package_type": "yearly",
    "from_date": "2026-09-03",
    "package_amount": 15000,
    "discount_amount": 1000,
    "payment_status": "paid",
    "remarks": "12-month care plan"
  }
  ```
- **Durations**: `monthly` (30 days), `quarterly` (90 days), `half_yearly` (180 days), `yearly` (365 days), `custom`.

---

## 3. Comprehensive Billing & Due Collection
- **Endpoints**:
  - `POST /api/v1/pro/bills` `{ patient_id, bill_type: 'treatment', items: [...], discount_amount, paid_amount, payment_method }`
  - `POST /api/v1/pro/payments`
  - `GET /api/v1/pro/payments/today`
  - `GET /api/v1/pro/payments/due-collection`

---

## 4. CRM, ACQ, and OC/NR Queues
- **Endpoints**:
  - `GET /api/v1/pro/acq`
  - `GET /api/v1/pro/ocnr`
  - `GET /api/v1/pro/renewals/queue`
  - `POST /api/v1/pro/calls`

---

## 5. Accountant & Cash Management
- **Endpoints**:
  - `GET /api/v1/pro/accountant/daily-summary`
  - `POST /api/v1/pro/accountant/expenditure`
  - `POST /api/v1/pro/accountant/deposit`

---

## 6. Feedback & Complaints
- **Endpoints**:
  - `POST /api/v1/pro/feedback` `{ patient_id, category_type, description, rating }`
  - `POST /api/v1/pro/complaints` `{ patient_id, category_type, description }`
  - `GET /api/v1/pro/complaints`
