# 🩺 DOCTOR MODULE — COMPLETE POSTMAN API GUIDE

This guide provides full Postman testing documentation for the **Doctor Module** (`/api/v1/doctor`) of the Hospital ERP backend.

---

## 🔑 Seeded Credentials & Authentication

To obtain a Doctor access token:

* **URL**: `POST http://localhost:5000/api/v1/auth/login`
* **Headers**: `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "username": "dr_smith",
    "password": "Password@123"
  }
  ```
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "user_id": 44,
        "username": "dr_smith",
        "full_name": "Dr. John Smith",
        "role": "doctor"
      }
    },
    "message": "Login successful"
  }
  ```

> All protected routes require header: `Authorization: Bearer {{token}}`

---

## 📋 Endpoints Reference

### 1. Doctor Dashboard (`GET /api/v1/doctor/dashboard`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/dashboard`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "today_appts": 25,
      "waiting": 6,
      "in_consultation": 1,
      "completed_today": 18,
      "recommended_followups": 5,
      "my_followup_view": [],
      "target_summary": {
        "month": 9,
        "year": 2026,
        "revenue_target": { "target": 200000, "achieved": 145000, "remaining": 55000, "achievement_pct": 72.5 },
        "unit_target": { "target": 300000, "achieved": 225000, "remaining": 75000, "achievement_pct": 75 },
        "referral_target": { "target": 30, "achieved": 22, "remaining": 8, "achievement_pct": 73.3 }
      }
    },
    "message": "Doctor dashboard retrieved successfully"
  }
  ```

---

### 2. Today's Appointments (`GET /api/v1/doctor/appointments/today`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/appointments/today?status=waiting`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "appointment_id": 10,
        "token_number": 10,
        "patient_id": 1,
        "registration_id": "REG-HYD-001",
        "patient_name": "Ravi Kumar",
        "age": 42,
        "gender": "male",
        "appointment_time": "10:00:00",
        "appointment_type": "new",
        "status": "waiting"
      }
    ],
    "message": "Doctor appointments retrieved successfully"
  }
  ```

---

### 3. Patient Queue (`GET /api/v1/doctor/queue`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/queue`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "appointment_id": 10,
        "token_number": 10,
        "patient_id": 1,
        "registration_id": "REG-HYD-001",
        "patient_name": "Ravi Kumar",
        "age": 42,
        "gender": "male",
        "appointment_time": "10:00:00",
        "appointment_type": "new",
        "doctor_id": 1,
        "waiting_time_minutes": 15,
        "status": "waiting"
      }
    ],
    "message": "Doctor patient queue retrieved successfully"
  }
  ```

---

### 4. Search Patients (`GET /api/v1/doctor/patients`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/patients?search=Ravi`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "patient_id": 1,
        "registration_id": "REG-HYD-001",
        "patient_name": "Ravi Kumar",
        "mobile_number": "9777766665",
        "age": 42,
        "gender": "male",
        "last_visit_date": "2026-09-02",
        "last_status": "waiting"
      }
    ],
    "message": "Patients list retrieved successfully"
  }
  ```

---

### 5. Patient Overview (`GET /api/v1/doctor/patients/:id/overview`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/patients/1/overview`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "patient": {
        "patient_id": 1,
        "full_name": "Ravi Kumar",
        "registration_id": "REG-HYD-001",
        "mobile_number": "9777766665",
        "age": 42,
        "gender": "male"
      },
      "previous_consultations": [],
      "previous_prescriptions": [],
      "previous_treatments": []
    },
    "message": "Patient overview retrieved successfully"
  }
  ```

---

### 6. Start Consultation (`POST /api/v1/doctor/consultations/start`)
* **URL**: `POST http://localhost:5000/api/v1/doctor/consultations/start`
* **Headers**: `Authorization: Bearer {{token}}`, `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "appointment_id": 10
  }
  ```
* **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "consultation_id": 5,
      "appointment_id": 10,
      "patient_id": 1,
      "doctor_id": 1,
      "status": "draft",
      "start_time": "2026-09-02T10:48:00.000Z",
      "branch_id": 1
    },
    "message": "Consultation started successfully"
  }
  ```

---

### 7. Search Diagnoses (`GET /api/v1/doctor/diagnoses/search`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/diagnoses/search?q=Osteo`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Osteoarthritis",
        "category": "Orthopedics"
      }
    ],
    "message": "Master diagnoses search retrieved successfully"
  }
  ```

---

### 8. Update Clinical Consultation (`PUT /api/v1/doctor/consultations/:id`)
* **URL**: `PUT http://localhost:5000/api/v1/doctor/consultations/5`
* **Headers**: `Authorization: Bearer {{token}}`, `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "present_illness": "Severe knee pain since 2 weeks",
    "previous_medical_history": "Hypertension",
    "current_medications": "Amlodipine 5mg",
    "allergy_status": "known",
    "allergies": [
      { "name": "Penicillin", "reaction": "Skin Rash", "severity": "Moderate" }
    ],
    "height_cm": 170,
    "weight_kg": 75,
    "temperature": 98.6,
    "pulse_rate": 72,
    "bp_systolic": 120,
    "bp_diastolic": 80,
    "respiratory_rate": 18,
    "spo2": 99,
    "chief_complaint": "Knee Pain",
    "complaint_duration": "2 Weeks",
    "complaint_severity": "Moderate",
    "complaint_onset": "Gradual",
    "primary_diagnosis_id": 1,
    "primary_diagnosis_text": "Osteoarthritis",
    "investigations": [
      { "test": "X-Ray Knee Joint", "priority": "Routine", "reason": "Evaluate joint condition" }
    ],
    "followup_recommended": true,
    "followup_recommended_date": "2026-09-16",
    "followup_instructions": "Review after 15 days treatment course",
    "pro_required": true,
    "pro_reason": "Treatment Counselling",
    "pro_priority": "Normal",
    "pro_instructions": "Explain 15-day treatment procedure",
    "doctor_notes": "Patient conscious and stable. Mild tenderness around knee."
  }
  ```
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "consultation_id": 5,
      "chief_complaint": "Knee Pain",
      "bmi": 26.0,
      "status": "draft"
    },
    "message": "Consultation clinical data updated successfully"
  }
  ```

---

### 9. Create Prescription (`POST /api/v1/doctor/prescriptions`)
* **URL**: `POST http://localhost:5000/api/v1/doctor/prescriptions`
* **Headers**: `Authorization: Bearer {{token}}`, `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "consultation_id": 5,
    "medicines": [
      {
        "medicine_id": 1,
        "dosage": "500 mg",
        "frequency": "2/day",
        "duration": 5,
        "quantity": 10,
        "food_instruction": "After Food"
      }
    ]
  }
  ```
* **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "prescription": {
        "id": 8,
        "consultation_id": 5,
        "patient_id": 1,
        "doctor_id": 1
      },
      "items": [
        {
          "id": 12,
          "prescription_id": 8,
          "medicine_id": 1,
          "dosage": "500 mg",
          "quantity": 10
        }
      ]
    },
    "message": "Prescription created successfully"
  }
  ```

---

### 10. Create Treatment Plan (`POST /api/v1/doctor/treatment-plans`)
* **URL**: `POST http://localhost:5000/api/v1/doctor/treatment-plans`
* **Headers**: `Authorization: Bearer {{token}}`, `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "consultation_id": 5,
    "treatment_name": "15-Day Knee Physiotherapy",
    "treatment_type": "Procedure",
    "start_date": "2026-09-01",
    "duration": 15,
    "duration_unit": "days",
    "instructions": "Daily morning session"
  }
  ```
* **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "treatment_id": 3,
      "consultation_id": 5,
      "treatment_name": "15-Day Knee Physiotherapy",
      "start_date": "2026-09-01",
      "duration": 15,
      "duration_unit": "days",
      "end_date": "2026-09-16",
      "status": "active"
    },
    "message": "Treatment plan created successfully"
  }
  ```

---

### 11. Consultation Summary (`GET /api/v1/doctor/consultations/:id/summary`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/consultations/5/summary`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "summary": {
        "consultation_id": 5,
        "patient_name": "Ravi Kumar",
        "chief_complaint": "Knee Pain",
        "diagnosis": "Osteoarthritis",
        "investigations_count": 1,
        "prescriptions_summary": "1 Medicines",
        "followup_recommended": true,
        "followup_recommended_date": "2026-09-16",
        "pro_required": true,
        "status": "draft"
      }
    },
    "message": "Consultation summary retrieved successfully"
  }
  ```

---

### 12. Complete Consultation (`POST /api/v1/doctor/consultations/:id/complete`)
* **URL**: `POST http://localhost:5000/api/v1/doctor/consultations/5/complete`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "consultation": {
        "consultation_id": 5,
        "status": "completed",
        "end_time": "2026-09-02T10:55:00.000Z"
      },
      "handoff_target": "PRO / Manager Queue"
    },
    "message": "Consultation completed successfully. Patient transitioned to PRO Queue."
  }
  ```

---

### 13. My Targets View-Only (`GET /api/v1/doctor/targets/mine`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/targets/mine?month=9&year=2026`
* **Headers**: `Authorization: Bearer {{token}}`
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "month": 9,
      "year": 2026,
      "revenue_target": { "target": 200000, "achieved": 145000, "remaining": 55000, "achievement_pct": 72.5 },
      "unit_target": { "target": 300000, "achieved": 225000, "remaining": 75000, "achievement_pct": 75 },
      "referral_target": { "target": 30, "achieved": 22, "remaining": 8, "achievement_pct": 73.3 }
    },
    "message": "Doctor target performance retrieved successfully"
  }
  ```

---

### 14. Doctor Profile (`GET /api/v1/doctor/profile` & `PUT /api/v1/doctor/profile`)
* **URL**: `GET http://localhost:5000/api/v1/doctor/profile`
* **Headers**: `Authorization: Bearer {{token}}`

* **PUT URL**: `PUT http://localhost:5000/api/v1/doctor/profile`
* **Body (JSON)**:
  ```json
  {
    "mobile_number": "9888877779",
    "email": "drsmith_updated@hospital.com"
  }
  ```

---

### 15. Apply Leave (`POST /api/v1/doctor/leaves`)
* **URL**: `POST http://localhost:5000/api/v1/doctor/leaves`
* **Headers**: `Authorization: Bearer {{token}}`, `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "from_date": "2026-09-20",
    "to_date": "2026-09-22",
    "reason": "Attending Medical Conference",
    "remarks": "Covered by Dr. Connor"
  }
  ```
* **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "doctor_id": 1,
      "from_date": "2026-09-20",
      "to_date": "2026-09-22",
      "status": "pending"
    },
    "message": "Leave request submitted successfully. Awaiting Super Admin approval."
  }
  ```
