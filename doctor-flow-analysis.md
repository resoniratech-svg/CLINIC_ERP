# Doctor Flow Analysis (Read-Only Analysis - Source of Truth)

## 1. End-to-End Doctor Flow Tracing

The Doctor consultation flow in WeCare Homeopathy ERP operates as follows:

```
Patient Check-in (Receptionist)
  → Appointment Status: 'waiting' / 'checked_in'
  → Doctor Queue (/doctor/queue)
  → Doctor Clicks "Start Consultation"
  → POST /api/v1/doctor/consultations/start
  → Consultation created (status: 'draft') & Appointment status: 'in_consultation'
  → Clinical Entry (History, Vitals, Chief Complaint, Examination, Diagnosis)
  → Prescription Entry (POST /api/v1/doctor/prescriptions)
  → Treatment Plan Entry (POST /api/v1/doctor/treatment-plans)
  → Consultation Completion (POST /api/v1/doctor/consultations/complete)
  → Consultation status: 'completed' & Appointment status: 'doctor_completed'
  → [HANDOFF TO PRO / MANAGER QUEUE]
```

---

## 2. Step-by-Step API Endpoints & Database Tables Written

### Step 1: Start Consultation
- **Endpoint**: `POST /api/v1/doctor/consultations/start`
- **Request Payload**:
  ```json
  {
    "appointment_id": 105
  }
  ```
- **Database Tables & Columns Written**:
  - `consultations`:
    - `appointment_id`: INTEGER (FK `appointments.appointment_id`)
    - `patient_id`: INTEGER (FK `patients.patient_id`)
    - `doctor_id`: INTEGER (FK `doctors.doctor_id`)
    - `status`: `'draft'` (`consultation_status` enum)
    - `start_time`: `now()`
    - `branch_id`: INTEGER
  - `appointments`:
    - `status`: Updated from `'waiting'` / `'checked_in'` to `'in_consultation'`
    - `updated_at`: `now()`
- **Response**:
  ```json
  {
    "success": true,
    "data": { "consultation_id": 42, "status": "draft", ... },
    "message": "Consultation started successfully"
  }
  ```

### Step 2: Clinical Data Entry / Draft Update
- **Endpoint**: `PUT /api/v1/doctor/consultations/:id` or `POST /api/v1/doctor/consultations/:id/save-draft`
- **Request Payload**:
  Includes history, vitals, complaint, examination, diagnosis, follow-up recommendation, PRO instructions:
  ```json
  {
    "chief_complaint": "Severe migraine and cervical stiffness for 3 months",
    "complaint_duration": "3 months",
    "complaint_severity": "moderate",
    "complaint_onset": "gradual",
    "symptoms": "Throbbing headache on right side, nausea",
    "primary_diagnosis_id": 4,
    "primary_diagnosis_text": "Migraine without aura",
    "secondary_diagnosis_text": "Cervical Spondylosis",
    "diagnosis_description": "Chronic tension and vascular headache",
    "followup_recommended": true,
    "followup_recommended_date": "2026-09-20",
    "followup_instructions": "Review after 15 days with headache diary",
    "pro_required": true,
    "pro_reason": "Patient needs 3-month comprehensive package and dietary counselling",
    "pro_priority": "high",
    "pro_instructions": "Enroll in 3-Month Migraine Care Package with lifestyle guidance",
    "doctor_notes": "CONFIDENTIAL clinical observation notes"
  }
  ```
- **Database Tables & Columns Written**:
  - `consultations`:
    - All clinical fields updated: `chief_complaint`, `primary_diagnosis_text`, `primary_diagnosis_id`, `secondary_diagnosis_text`, `diagnosis_description`, `followup_recommended`, `followup_recommended_date`, `followup_instructions`, `pro_required`, `pro_reason`, `pro_priority`, `pro_instructions`, `doctor_notes`, `bmi`, `height_cm`, `weight_kg`, `bp_systolic`, `bp_diastolic`, `pulse_rate`, `temperature`, `spo2`, `respiratory_rate`, etc.
    - `updated_at`: `now()`

### Step 3: Prescription Creation
- **Endpoint**: `POST /api/v1/doctor/prescriptions`
- **Request Payload**:
  ```json
  {
    "consultation_id": 42,
    "medicines": [
      {
        "medicine_id": 14,
        "medicine_name": "Belladonna 200CH",
        "dosage": "2 drops",
        "frequency": "twice daily",
        "route": "oral",
        "duration_days": 15,
        "quantity": 30
      }
    ]
  }
  ```
- **Database Tables & Columns Written**:
  - `prescriptions`:
    - `id` (SERIAL PK)
    - `consultation_id`: INTEGER (FK `consultations.consultation_id`)
    - `patient_id`: INTEGER (FK `patients.patient_id`)
    - `doctor_id`: INTEGER (FK `doctors.doctor_id`)
    - `appointment_id`: INTEGER (FK `appointments.appointment_id`)
    - `created_at`: `now()`
  - `prescription_items`:
    - `prescription_id`: INTEGER (FK `prescriptions.id`)
    - `medicine_id`: INTEGER
    - `dosage`: VARCHAR
    - `quantity`: INTEGER
    - `duration_days`: INTEGER
    - `frequency`: VARCHAR
    - `route`: VARCHAR

### Step 4: Treatment Plan Creation
- **Endpoint**: `POST /api/v1/doctor/treatment-plans`
- **Request Payload**:
  ```json
  {
    "consultation_id": 42,
    "treatment_name": "3-Month Chronic Migraine Care Plan",
    "treatment_type": "homeopathy",
    "start_date": "2026-09-05",
    "duration": 90,
    "duration_unit": "days",
    "frequency": "Bi-weekly review",
    "instructions": "Avoid sour foods, maintain sleep cycle",
    "treatment_notes": "Prescribed long term constitutional care"
  }
  ```
- **Database Tables & Columns Written**:
  - `treatment_plans`:
    - `treatment_id` (SERIAL PK)
    - `consultation_id`: INTEGER (FK `consultations.consultation_id`)
    - `patient_id`: INTEGER (FK `patients.patient_id`)
    - `doctor_id`: INTEGER (FK `doctors.doctor_id`)
    - `treatment_name`: VARCHAR(150)
    - `treatment_type`: VARCHAR(100)
    - `start_date`: DATE
    - `duration`: INTEGER
    - `duration_unit`: VARCHAR(20)
    - `end_date`: DATE (server-computed: `start_date + duration`)
    - `frequency`: VARCHAR(100)
    - `instructions`: TEXT
    - `treatment_notes`: TEXT
    - `status`: `'active'`
    - `branch_id`: INTEGER

### Step 5: Complete Consultation (Handoff Trigger)
- **Endpoint**: `POST /api/v1/doctor/consultations/complete`
- **Request Payload**:
  ```json
  {
    "consultation_id": 42
  }
  ```
- **Validation**:
  - Requires `chief_complaint` is non-empty.
  - Requires `primary_diagnosis_id` or `primary_diagnosis_text` is non-empty.
- **Database Tables & Columns Written**:
  - `consultations`:
    - `status`: Updated from `'draft'` to `'completed'` (`consultation_status` enum)
    - `end_time`: `now()`
    - `updated_at`: `now()`
  - `appointments`:
    - `status`: Updated from `'in_consultation'` to `'doctor_completed'` (`appointment_status` enum)
    - `updated_at`: `now()`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "consultation": { "consultation_id": 42, "status": "completed", ... },
      "appointment_status": "doctor_completed",
      "handoff_target": "PRO / Manager Queue"
    },
    "message": "Consultation completed successfully. Patient transitioned to PRO Queue."
  }
  ```

---

## 3. The Exact Handoff Point to PRO

The handoff is established when:
1. Table `appointments`: Column `status = 'doctor_completed'`.
2. Table `consultations`: Column `status = 'completed'` with foreign key `appointment_id` matching the appointment.
3. Downstream Data Available for PRO:
   - Consulting Doctor: `consultations.doctor_id` / `appointments.doctor_id`
   - Clinical Diagnoses: `primary_diagnosis_text`, `secondary_diagnosis_text`
   - Prescribed Treatment Plans: Table `treatment_plans` rows linked by `consultation_id` and `patient_id`.
   - Prescription Items: Table `prescriptions` + `prescription_items` linked by `consultation_id` and `patient_id`.
   - Doctor's PRO Instructions: `pro_required` (boolean), `pro_reason` (text), `pro_priority`, `pro_instructions` (text).
   - Follow-up Recommendation: `followup_recommended` (boolean), `followup_recommended_date` (date), `followup_instructions` (text).
   - Confidentiality Boundary: `doctor_notes` is private and must **never** be shared with PRO.
