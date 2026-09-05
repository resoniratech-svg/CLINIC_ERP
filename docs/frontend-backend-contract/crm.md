# API Contract: CRM & Follow-up Management (Module 12)

## 1. CRM Follow-ups
- **Endpoint**: `GET /api/v1/crm/followups?category=...&status=...&assigned_to=...`
- **Endpoint**: `POST /api/v1/crm/followups`
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "category": "treatment",
    "assigned_to": 2,
    "due_date": "2026-09-03",
    "remarks": "Check on constitutional medicine response"
  }
  ```
- **Valid Categories**: `treatment`, `appointment`, `renewal`, `due`, `acq`, `ocnr`, `general`.
- **Crucial Rule 12**: CRM follow-ups can only be assigned to users with role `receptionist`, `pro_manager`, or `super_admin`. Assignment to `executive` is explicitly rejected with HTTP 400 Bad Request.

---

## 2. ACQ (Acquired Patients) Monthly Care Plans
- **Endpoint**: `POST /api/v1/crm/acq`
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "monthly_plan_amount": 2500,
    "start_date": "2026-09-03",
    "frequency": "monthly"
  }
  ```

---

## 3. OC / NR (Old Case / Not Responding)
- **Endpoint**: `POST /api/v1/crm/ocnr`
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "classification": "oc",
    "reason": "Patient relocated"
  }
  ```
- **Valid Classifications**: `oc` (Old Case), `nr` (Not Responding).

---

## 4. CRM Referrals
- **Endpoint**: `POST /api/v1/crm/referrals`
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "referral_type": "employee",
    "referred_by": 1,
    "remarks": "Corporate health referral"
  }
  ```
- **Valid Types**: `employee`, `patient`.
