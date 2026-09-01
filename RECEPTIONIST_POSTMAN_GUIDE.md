# Receptionist Module — Postman API Guide

This guide provides end-to-end instructions for testing the **Receptionist Module API** in Postman.

## 🚀 Quick Setup Instructions

1. **Import Collection**: Import `receptionist_module.postman_collection.json` into Postman.
2. **Environment Variables**:
   - `baseUrl`: `http://localhost:5000/api/v1`
   - `token`: *(Auto-populated after executing Login request)*

---

## 🔑 Authentication

### 1. Receptionist Login
- **URL**: `POST {{baseUrl}}/auth/login`
- **Body**:
  ```json
  {
    "username": "rita_rec",
    "password": "Password@123"
  }
  ```
- **Response**: `200 OK` (Token saved automatically).

---

## 📊 1. Receptionist Dashboard
- **URL**: `GET {{baseUrl}}/receptionist/dashboard`
- **Headers**: `Authorization: Bearer {{token}}`
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "new_patients_today": 5,
      "appointments_today": 12,
      "waiting_patients": 3,
      "enquiries_today": 8,
      "pending_leads": 4,
      "callbacks_today": 2,
      "renewals_today": 1,
      "due_patients_count": 2,
      "followups_today": 3,
      "consultation_revenue_today": 3500.00,
      "pending_tasks_count": 2
    },
    "message": "Receptionist dashboard summary retrieved successfully"
  }
  ```

---

## 🔍 2. Patient Search & Auto-Classification
- **URL**: `GET {{baseUrl}}/receptionist/patients/search?mobile=9876543210`
- **Response (New Patient)**:
  ```json
  {
    "success": true,
    "data": {
      "exists": false,
      "classification": "new",
      "patient": null
    },
    "message": "Patient not found. Classified as NEW patient"
  }
  ```

---

## 🧑‍⚕️ 3. Walk-in / New Patient Registration
- **URL**: `POST {{baseUrl}}/receptionist/patients/register`
- **Body**:
  ```json
  {
    "full_name": "Ramesh Kumar",
    "mobile_number": "9876543210",
    "age": 35,
    "gender": "male",
    "village_mandal": "Kukatpally",
    "address": "Flat 201, HMT Hills",
    "ailment_reason": "Severe Fever & Cough",
    "assigned_doctor_id": 1,
    "appointment_date": "2026-09-01",
    "appointment_time": "10:30",
    "appointment_type": "new",
    "discount_amount": 50,
    "payment_method": "cash",
    "payment_amount": 450
  }
  ```

---

## 📞 4. Enquiry Management
- **URL**: `POST {{baseUrl}}/receptionist/enquiries`
- **Body**:
  ```json
  {
    "name": "Suresh Patel",
    "mobile": "9123456789",
    "reason_requirement": "Enquiry for Cardiology Consultation Fee",
    "remarks": "Inquired on behalf of father"
  }
  ```

---

## 🤝 5. Employee & Patient Referrals
- **URL**: `POST {{baseUrl}}/receptionist/referrals/employee`
- **Body**:
  ```json
  {
    "patient_name": "Anil Verma",
    "mobile_number": "9988776655",
    "age": 42,
    "gender": "male",
    "village_mandal": "Ameerpet",
    "reason": "General Health Checkup",
    "referring_employee_id": 1,
    "remarks": "Employee relative discount applied"
  }
  ```

---

## 🗓️ 6. Doctor Assignment & Appointment Scheduling
- **URL**: `POST {{baseUrl}}/receptionist/appointments`
- **Body**:
  ```json
  {
    "patient_id": 1,
    "doctor_id": 1,
    "appointment_date": "2026-09-02",
    "appointment_time": "11:00",
    "appointment_type": "new"
  }
  ```

---

## 💳 7. Consultation Billing
- **URL**: `POST {{baseUrl}}/receptionist/billing/bills`
- **Body**:
  ```json
  {
    "patient_id": 1,
    "appointment_id": 1,
    "bill_type": "consultation",
    "discount_amount": 0,
    "payment_method": "upi",
    "payment_amount": 500
  }
  ```

---

## 🚪 8. Patient Check-in
- **URL**: `POST {{baseUrl}}/receptionist/appointments/1/checkin`
- **Body**:
  ```json
  {
    "status": "checked-in"
  }
  ```

---

## 🔄 9. Registration Renewal
- **URL**: `POST {{baseUrl}}/receptionist/renewals`
- **Body**:
  ```json
  {
    "patient_id": 1,
    "doctor_id": 1,
    "appointment_date": "2026-09-01",
    "appointment_time": "14:00",
    "payment_method": "cash"
  }
  ```

---

## 💰 10. Due Payment Collection
- **URL**: `POST {{baseUrl}}/receptionist/due-patients/1/collect`
- **Body**:
  ```json
  {
    "payment_amount": 200,
    "payment_method": "cash",
    "remarks": "Cleared partial due"
  }
  ```

---

## 📱 11. CRM Calling & Callback Automation
- **URL**: `POST {{baseUrl}}/receptionist/crm/calls`
- **Body**:
  ```json
  {
    "patient_id": 1,
    "interaction_type": "outbound",
    "call_purpose": "Followup confirmation",
    "call_status": "callback_requested",
    "callback_date": "2026-09-03",
    "callback_time": "15:00",
    "remarks": "Patient asked to call back in the evening"
  }
  ```

---

## ✅ 12. Callback Tasks (My Tasks)
- **URL**: `GET {{baseUrl}}/receptionist/my-tasks`
- **Complete Task URL**: `POST {{baseUrl}}/receptionist/my-tasks/1/complete`
- **Body**:
  ```json
  {
    "remarks": "Callback completed, appointment booked"
  }
  ```
