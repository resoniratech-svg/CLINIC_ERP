-- ============================================================
-- DOCTOR RESIGNATION TRANSFER TRACKING & REACTIVATION SCHEMA
-- Database: hospital_erp_db
-- ============================================================

-- 1. Add 'resigned' to user_status enum if not present
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'resigned';

-- 2. Doctor Transfer Item Log Table (Granular record-level tracking for restore)
CREATE TABLE IF NOT EXISTS doctor_transfer_items (
    id                  SERIAL PRIMARY KEY,
    transfer_id         INTEGER REFERENCES doctor_transfers(id) ON DELETE CASCADE,
    resigned_doctor_id  INTEGER NOT NULL REFERENCES doctors(doctor_id),
    new_doctor_id       INTEGER NOT NULL REFERENCES doctors(doctor_id),
    record_type         VARCHAR(50) NOT NULL, -- 'appointment', 'treatment_plan', 'renewal', 'package'
    record_id           INTEGER NOT NULL,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id),
    transferred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    restored_at         TIMESTAMPTZ,
    restored_by         INTEGER REFERENCES users(user_id),
    status              VARCHAR(30) NOT NULL DEFAULT 'transferred' -- 'transferred', 'restored', 'retained'
);

CREATE INDEX IF NOT EXISTS idx_dti_resigned_doc ON doctor_transfer_items(resigned_doctor_id);
CREATE INDEX IF NOT EXISTS idx_dti_new_doc ON doctor_transfer_items(new_doctor_id);
CREATE INDEX IF NOT EXISTS idx_dti_patient ON doctor_transfer_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_dti_status ON doctor_transfer_items(status);

-- 3. Extend doctor_transfers with reactivation tracking columns
ALTER TABLE doctor_transfers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
ALTER TABLE doctor_transfers ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ;
ALTER TABLE doctor_transfers ADD COLUMN IF NOT EXISTS reactivated_by INTEGER REFERENCES users(user_id);
ALTER TABLE doctor_transfers ADD COLUMN IF NOT EXISTS reactivation_option VARCHAR(30);
