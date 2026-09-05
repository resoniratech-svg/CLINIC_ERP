# API Contract: Doctor Resignation & Transfer Protocol (Module 18)

## 1. Audit Doctor Responsibilities Prior to Transfer
- **Endpoint**: `GET /api/v1/doctors/:id/summary`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "doctor_id": 10,
      "doctor_name": "Dr. Retiring Physician",
      "status": "active",
      "upcoming_appointments_count": 5,
      "active_treatments_count": 8,
      "pending_followups_count": 2
    }
  }
  ```

---

## 2. Execute Doctor Resignation & Safe Reassignment
- **Endpoint**: `POST /api/v1/doctors/:id/transfer`
- **Authentication**: `Bearer <token>` (Required Role: `super_admin`)
- **Request Body**:
  ```json
  {
    "to_doctor_id": 11
  }
  ```
- **Integrity Guarantees**:
  - Sets source doctor and linked user status to `inactive`.
  - Future appointments (`appointment_date >= CURRENT_DATE` and `status = 'scheduled'`) reassigned to `to_doctor_id`.
  - Pending follow-ups and renewals reassigned to `to_doctor_id`.
  - Historical prescriptions, completed consultations, and clinical diagnoses remain permanently associated with the original doctor.
  - Transfer metadata logged to `doctor_transfers` table.
