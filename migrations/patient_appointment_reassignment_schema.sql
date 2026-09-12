-- ============================================================
-- PATIENT APPOINTMENT REASSIGNMENT & REVENUE ATTRIBUTION SCHEMA
-- Database: hospital_erp_db
-- ============================================================

-- 1. Safely add nullable appointment_id foreign key to bills table
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bills' AND column_name = 'appointment_id'
    ) THEN
        ALTER TABLE bills ADD COLUMN appointment_id INTEGER REFERENCES appointments(appointment_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bills_appointment_id ON bills(appointment_id);

-- 2. Unambiguous 1:1 backfill for consultation bills without an assigned appointment_id
UPDATE bills b
SET appointment_id = sub.appointment_id
FROM (
  SELECT a.appointment_id, a.patient_id, a.doctor_id, a.appointment_date
  FROM appointments a
  WHERE a.appointment_id IN (
    SELECT MIN(apt.appointment_id)
    FROM appointments apt
    WHERE apt.status NOT IN ('cancelled')
    GROUP BY apt.patient_id, apt.doctor_id, apt.appointment_date
    HAVING COUNT(*) = 1
  )
) sub
WHERE b.bill_type = 'consultation'
  AND b.appointment_id IS NULL
  AND b.patient_id = sub.patient_id
  AND b.doctor_id = sub.doctor_id
  AND DATE(b.created_at) = sub.appointment_date;

-- 3. Optimization indexes for doctor leaves conflict checking
CREATE INDEX IF NOT EXISTS idx_doctor_leaves_conflict ON doctor_leaves(doctor_id, from_date, to_date, status);

-- 4. Defensive patient location columns
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'village_id'
    ) THEN
        ALTER TABLE patients ADD COLUMN village_id INTEGER REFERENCES master_villages(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'mandal_id'
    ) THEN
        ALTER TABLE patients ADD COLUMN mandal_id INTEGER REFERENCES master_mandals(id);
    END IF;
END $$;
