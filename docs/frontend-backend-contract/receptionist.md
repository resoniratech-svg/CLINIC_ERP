# API Contract: Receptionist (Module 4)

## 1. Receptionist Dashboard
- **Endpoint**: `GET /api/v1/receptionist/dashboard`
- **Authentication**: `Bearer <token>` (Roles: `receptionist`, `super_admin`)
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "new_patients_today": 3,
      "appointments_today": 7,
      "waiting_patients": 2,
      "enquiries_today": 4,
      "pending_leads": 1,
      "callbacks_today": 0,
      "renewals_today": 1,
      "due_patients_count": 2,
      "followups_today": 3,
      "consultation_revenue_today": 1500.0,
      "pending_tasks_count": 0
    }
  }
  ```

---

## 2. Patient Search & Overview
- **Endpoints**:
  - `GET /api/v1/receptionist/patients/search?search=...` (or `?mobile=...`, `?name=...`, `?registration_id=...`)
  - `GET /api/v1/receptionist/patients/:id/overview`

---

## 3. Single-Flow Patient Registration
- **Endpoint**: `POST /api/v1/receptionist/patients/register`
- **Request Body**:
  ```json
  {
    "full_name": "Ravi Kumar",
    "mobile_number": "9876543210",
    "gender": "male",
    "age": 35,
    "village_mandal": "Kukatpally, Hyderabad",
    "lead_source": "walkin",
    "assigned_doctor_id": 1,
    "appointment_date": "2026-09-03",
    "appointment_time": "10:00",
    "appointment_type": "new",
    "discount_amount": 0,
    "payment_amount": 500,
    "payment_method": "cash"
  }
  ```
- **Response (201 Created)**: Automatically creates `patients`, `appointments`, `bills`, and `payments` records transactionally.

---

## 4. Enquiries & Referrals
- **Endpoints**:
  - `POST /api/v1/receptionist/enquiries` `{ name, mobile, lead_source_id, remarks }`
  - `GET /api/v1/receptionist/enquiries`
  - `POST /api/v1/receptionist/referrals/employee` `{ patient_name, mobile_number, referring_employee_id, remarks }`
  - `GET /api/v1/receptionist/referrals/employee`
  - `POST /api/v1/receptionist/referrals/patient` `{ patient_name, mobile_number, referring_patient_id, remarks }`
  - `GET /api/v1/receptionist/referrals/patient`

---

## 5. Doctor Assignment & Appointments
- **Endpoints**:
  - `GET /api/v1/receptionist/doctors` (active doctors with fee matrix)
  - `POST /api/v1/receptionist/appointments` `{ patient_id, doctor_id, appointment_date, appointment_time, appointment_type }`
  - `POST /api/v1/receptionist/appointments/:id/reschedule` `{ appointment_date, appointment_time, reason }`
  - `POST /api/v1/receptionist/appointments/:id/cancel` `{ reason }`

---

## 6. Check-in & Waiting Queue
- **Endpoints**:
  - `POST /api/v1/receptionist/appointments/:id/checkin` (transitions status to `checked_in`)
  - `GET /api/v1/receptionist/checkin/waiting` (live OPD doctor queue)

---

## 7. Consultation Billing & Dues
- **Endpoints**:
  - `POST /api/v1/receptionist/billing/bills` `{ patient_id, appointment_id, bill_type: 'consultation', discount_amount, payment_amount, payment_method }`
  - `GET /api/v1/receptionist/billing/bills`
  - `GET /api/v1/receptionist/due-patients`
  - `POST /api/v1/receptionist/due-patients/:id/collect` `{ payment_amount, payment_method }`

---

## 8. Annual Renewals & CRM Calls
- **Endpoints**:
  - `POST /api/v1/receptionist/renewals` `{ patient_id, doctor_id, appointment_date, appointment_time, discount_amount, payment_amount, payment_method }`
  - `POST /api/v1/receptionist/crm/calls` `{ patient_id, interaction_type, call_purpose, call_status, callback_date, callback_time, remarks }`
  - `GET /api/v1/receptionist/crm/calls`
  - `GET /api/v1/receptionist/my-tasks`
  - `POST /api/v1/receptionist/my-tasks/:id/complete`
  - `POST /api/v1/receptionist/my-tasks/:id/reschedule`
