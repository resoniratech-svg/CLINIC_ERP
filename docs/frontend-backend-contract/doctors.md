# API Contract: Doctor Governance & Transfer (Module 5)

## 1. List Doctors
- **Endpoint**: `GET /api/v1/doctors`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Query Parameters**:
  - `status` (optional): `active`, `inactive`
  - `specialization` (optional): Filter by specialization string
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "doctor_id": 5,
        "user_id": 12,
        "doctor_code": "DOC-101",
        "full_name": "Dr. John Smith",
        "mobile_number": "9876543210",
        "email": "john@wecare.com",
        "qualification": "MBBS, BHMS",
        "specialization": "Cardiology & Homeopathy",
        "experience_years": 8,
        "working_days": "Mon,Tue,Wed,Thu,Fri",
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        "slot_duration_minutes": 15,
        "new_consultation_fee": 500.0,
        "renewal_consultation_fee": 300.0,
        "followup_consultation_fee": 200.0,
        "status": "active"
      }
    ],
    "message": "Doctors retrieved successfully"
  }
  ```

---

## 2. Doctor Active Workload Summary
- **Endpoint**: `GET /api/v1/doctors/:id/summary`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "doctor_id": 5,
      "doctor_name": "Dr. John Smith",
      "status": "active",
      "upcoming_appointments_count": 4,
      "active_treatments_count": 3,
      "pending_followups_count": 1
    },
    "message": "Doctor active responsibilities summary retrieved successfully"
  }
  ```

---

## 3. Resignation & Responsibilities Transfer
- **Endpoint**: `POST /api/v1/doctors/:id/transfer`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Request Body**:
  ```json
  {
    "to_doctor_id": 6
  }
  ```
- **Business Logic & Guarantees**:
  - Source doctor is marked `inactive` in both `doctors` and `users` tables.
  - Historical prescriptions, completed consultations, and clinical diagnoses remain permanently associated with the source doctor.
  - Future scheduled appointments (`appointment_date >= CURRENT_DATE` and `status = 'scheduled'`) are reassigned to `to_doctor_id`.
  - Pending renewals/followups are reassigned to `to_doctor_id`.
  - Transactional audit log entry is written to `doctor_transfers` and `audit_logs`.
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "from_doctor_id": 5,
      "to_doctor_id": 6,
      "appointments_moved": 4,
      "followups_moved": 1,
      "source_doctor_status": "inactive"
    },
    "message": "Doctor responsibilities transferred and doctor deactivated successfully. Historical records preserved."
  }
  ```
