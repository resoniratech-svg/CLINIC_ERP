# API Contract: Executive / Call Center (Module 7)

## 1. Executive Dashboard & Metrics
- **Endpoint**: `GET /api/v1/executive/dashboard`
- **Authentication**: `Bearer <token>` (Roles: `executive`, `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "calls_today": 12,
      "connected": 9,
      "leads_created": 4,
      "inbound": 5,
      "outbound": 7,
      "callbacks": 2,
      "interested": 4,
      "not_interested": 3,
      "appointments_converted": 2,
      "incentive": {
        "month": 9,
        "year": 2026,
        "per_lead_incentive": 100.0,
        "leads_generated": 14,
        "current_incentive": 1400.0
      }
    }
  }
  ```

---

## 2. Inbound Patient Search
- **Endpoint**: `GET /api/v1/executive/patients/search?mobile=...` (or `POST /api/v1/executive/inbound/search`)
- **Behavior**: Auto-classifies whether the caller is an `existing` patient (returns non-clinical visit/call overview) or `new` (prompts lead generation).

---

## 3. Lead Creation & Receptionist Queue Routing
- **Endpoint**: `POST /api/v1/executive/leads`
- **Request Body**:
  ```json
  {
    "lead_name": "Ravi Teja",
    "mobile_number": "9876543210",
    "age": 32,
    "gender": "male",
    "village": "Madhapur",
    "mandal": "Serilingampally",
    "source": "Inbound Google Ads",
    "campaign": "Monsoon Care",
    "remarks": "Inquired regarding respiratory care consultation"
  }
  ```
- **Handoff Target**: Pushed to Receptionist Lead Queue with attribution to the generating Executive.

---

## 4. Bulk Outbound Excel Import
- **Endpoint**: `POST /api/v1/executive/outbound/import`
- **Request Body**:
  ```json
  {
    "file_name": "campaign_leads_sep.xlsx",
    "records": [
      { "name": "Patient 1", "mobile": "9876543211", "reason": "Skin care" }
    ]
  }
  ```
- **Guarantees**: Automatic duplicate validation against `patients` and `outbound_leads` tables before assigning to calling queues.

---

## 5. Call Outcome & Scheduled Callbacks
- **Endpoints**:
  - `POST /api/v1/executive/calls/outcome` `{ outbound_lead_id, mobile_number, patient_name, call_status, callback_date, callback_time, remarks }`
  - `GET /api/v1/executive/callbacks`
  - `GET /api/v1/executive/outbound/queue`

---

## 6. Executive Incentive Ledger & Performance
- **Endpoints**:
  - `GET /api/v1/executive/incentives` (Executive view)
  - `GET /api/v1/executive/performance` (Super Admin governance view)
