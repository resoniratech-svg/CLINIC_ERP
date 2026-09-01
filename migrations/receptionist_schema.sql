-- Receptionist Module Additive Schema

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_interaction_type') THEN
        CREATE TYPE call_interaction_type AS ENUM ('inbound','outbound');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_purpose_type') THEN
        CREATE TYPE call_purpose_type AS ENUM (
          'followup','renewal','due_payment','acq','ocnr','appointment',
          'general_enquiry','callback','patient_feedback','other'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status_type') THEN
        CREATE TYPE call_status_type AS ENUM (
          'connected','not_connected','busy','switched_off','interested',
          'not_interested','callback_requested','appointment_booked',
          'followup_required','completed','closed'
        );
    END IF;
END $$;

ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'in_consultation';

CREATE TABLE IF NOT EXISTS call_records (
    call_id           SERIAL PRIMARY KEY,
    patient_id         INTEGER REFERENCES patients(patient_id),
    lead_id            INTEGER REFERENCES leads(lead_id),
    interaction_type   call_interaction_type NOT NULL,
    call_purpose       call_purpose_type NOT NULL,
    call_status        call_status_type NOT NULL,
    callback_date       DATE,
    callback_time       TIME,
    task_status         VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending | completed | rescheduled
    handled_by          INTEGER NOT NULL REFERENCES users(user_id),
    branch_id           INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    remarks              TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (patient_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_call_records_handled_by ON call_records(handled_by);
CREATE INDEX IF NOT EXISTS idx_call_records_callback_date ON call_records(callback_date);

-- Additive columns to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS registration_id VARCHAR(30) UNIQUE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS registration_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS registration_expiry DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ailment_reason TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS lead_source_id INTEGER REFERENCES master_lead_sources(id);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(user_id);

-- Additive columns to referrals table
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_code VARCHAR(30) UNIQUE;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referring_employee_id INTEGER REFERENCES users(user_id);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referring_patient_id INTEGER REFERENCES patients(patient_id);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS remarks TEXT;
