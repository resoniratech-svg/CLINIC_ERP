-- ============================================================
-- DOCTOR MODULE SCHEMA ADDITIONS
-- Database: hospital_erp_db
-- ============================================================

-- 1. ADDITIVE ENUM VALUES FOR APPOINTMENT PIPELINE STATUS
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'waiting';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'in_consultation';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'doctor_completed';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pro_pending';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pro_completed';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pharmacy_pending';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'dispensed';
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'deleted';

-- 2. ENUM TYPES FOR CLINICAL ENCOUNTERS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultation_status') THEN
        CREATE TYPE consultation_status AS ENUM ('draft', 'completed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'allergy_status_type') THEN
        CREATE TYPE allergy_status_type AS ENUM ('none', 'known');
    END IF;
END $$;

-- 3. MASTER DIAGNOSES LOOKUP TABLE
CREATE TABLE IF NOT EXISTS master_diagnoses (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL UNIQUE,
    category     VARCHAR(100),
    status       user_status NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_diagnoses_name ON master_diagnoses USING gin (to_tsvector('simple', name));

-- Seed initial common diagnoses if empty
INSERT INTO master_diagnoses (name, category) VALUES
  ('Osteoarthritis', 'Orthopedics'),
  ('Hypertension', 'Cardiology'),
  ('Type 2 Diabetes Mellitus', 'Endocrinology'),
  ('Migraine', 'Neurology'),
  ('Upper Respiratory Infection', 'General Medicine'),
  ('Gastroesophageal Reflux Disease', 'Gastroenterology'),
  ('Asthma', 'Pulmonology'),
  ('Urinary Tract Infection', 'Urology')
ON CONFLICT (name) DO NOTHING;

-- 4. CONSULTATIONS TABLE (MAIN CLINICAL ENCOUNTER TABLE)
CREATE TABLE IF NOT EXISTS consultations (
    consultation_id        SERIAL PRIMARY KEY,
    appointment_id          INTEGER NOT NULL REFERENCES appointments(appointment_id),
    patient_id               INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id                INTEGER NOT NULL REFERENCES doctors(doctor_id),
    status                    consultation_status NOT NULL DEFAULT 'draft',
    start_time                TIMESTAMPTZ,
    end_time                  TIMESTAMPTZ,

    -- Patient History
    present_illness           TEXT,
    previous_medical_history  TEXT,
    previous_treatment_history TEXT,
    surgical_history          TEXT,
    family_history             TEXT,
    current_medications        TEXT,
    other_history               TEXT,

    -- Allergies
    allergy_status              allergy_status_type NOT NULL DEFAULT 'none',
    allergies                    JSONB DEFAULT '[]'::jsonb,

    -- Vitals
    height_cm                   NUMERIC(5,2),
    weight_kg                   NUMERIC(5,2),
    temperature                 NUMERIC(4,1),
    pulse_rate                  INTEGER,
    bp_systolic                  INTEGER,
    bp_diastolic                  INTEGER,
    respiratory_rate               INTEGER,
    spo2                            NUMERIC(4,1),
    bmi                              NUMERIC(4,1),
    other_vitals                     JSONB DEFAULT '{}'::jsonb,
    vitals_recorded_by               INTEGER REFERENCES users(user_id),

    -- Chief Complaint
    chief_complaint                    TEXT,
    complaint_duration                  VARCHAR(50),
    complaint_severity                    VARCHAR(50),
    complaint_onset                        VARCHAR(50),
    associated_symptoms                     JSONB DEFAULT '[]'::jsonb,

    -- Symptoms / Present Illness
    symptoms                                 TEXT,
    symptom_progression                       VARCHAR(100),

    -- Clinical Examination
    general_examination                        TEXT,
    physical_examination                        TEXT,
    system_examination                           TEXT,
    local_examination                              TEXT,
    other_findings                                  TEXT,

    -- Diagnosis
    primary_diagnosis_id                             INTEGER REFERENCES master_diagnoses(id),
    primary_diagnosis_text                            VARCHAR(255),
    secondary_diagnosis_id                             INTEGER REFERENCES master_diagnoses(id),
    secondary_diagnosis_text                            VARCHAR(255),
    diagnosis_description                                TEXT,
    diagnosis_notes                                       TEXT,

    -- Investigations
    investigations                                         JSONB DEFAULT '[]'::jsonb,

    -- Follow-up Recommendation (Recommendation only - NOT a CRM task)
    followup_recommended                                     BOOLEAN NOT NULL DEFAULT false,
    followup_recommended_date                                 DATE,
    followup_instructions                                       TEXT,

    -- PRO Instructions
    pro_required                                                 BOOLEAN NOT NULL DEFAULT false,
    pro_reason                                                     TEXT,
    pro_priority                                                    VARCHAR(30),
    pro_instructions                                                 TEXT,

    -- Doctor Notes (Private clinical notes)
    doctor_notes                                                      TEXT,

    branch_id                                                          INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at                                                          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                                                          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_consultation_appointment UNIQUE (appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);

-- 5. TREATMENT PLANS TABLE
CREATE TABLE IF NOT EXISTS treatment_plans (
    treatment_id       SERIAL PRIMARY KEY,
    consultation_id     INTEGER NOT NULL REFERENCES consultations(consultation_id),
    patient_id            INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id              INTEGER NOT NULL REFERENCES doctors(doctor_id),
    treatment_name           VARCHAR(150) NOT NULL,
    treatment_type             VARCHAR(100) NOT NULL,
    start_date                   DATE NOT NULL,
    duration                       INTEGER NOT NULL,
    duration_unit                    VARCHAR(20) NOT NULL,
    end_date                           DATE,
    frequency                             VARCHAR(100),
    instructions                            TEXT,
    treatment_notes                            TEXT,
    status                                       VARCHAR(30) NOT NULL DEFAULT 'active',
    branch_id                                     INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at                                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON treatment_plans(patient_id);

-- 6. ADD CONSULTATION_ID TO PRESCRIPTIONS TABLE
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS consultation_id INTEGER REFERENCES consultations(consultation_id);

-- 7. DOCTOR LEAVES TABLE
CREATE TABLE IF NOT EXISTS doctor_leaves (
    id             SERIAL PRIMARY KEY,
    doctor_id       INTEGER NOT NULL REFERENCES doctors(doctor_id),
    from_date         DATE NOT NULL,
    to_date             DATE NOT NULL,
    reason               TEXT NOT NULL,
    remarks                TEXT,
    status                  reset_status NOT NULL DEFAULT 'pending',
    approved_by               INTEGER REFERENCES users(user_id),
    branch_id                   INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (to_date >= from_date)
);
