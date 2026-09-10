-- Migration: patient_location_schema.sql
-- Purpose: Add hierarchical village_id and mandal_id foreign keys to patients table
-- Backward compatible: Columns are NULLable to preserve historical patient records.

-- 1. Ensure columns exist on patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS village_id INTEGER;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mandal_id INTEGER;

-- 2. Add foreign key constraints safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'patients_village_id_fkey' AND table_name = 'patients'
    ) THEN
        ALTER TABLE patients
        ADD CONSTRAINT patients_village_id_fkey
        FOREIGN KEY (village_id) REFERENCES master_villages(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'patients_mandal_id_fkey' AND table_name = 'patients'
    ) THEN
        ALTER TABLE patients
        ADD CONSTRAINT patients_mandal_id_fkey
        FOREIGN KEY (mandal_id) REFERENCES master_mandals(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Create indexes for fast joins and lookups
CREATE INDEX IF NOT EXISTS idx_patients_village_id ON patients(village_id);
CREATE INDEX IF NOT EXISTS idx_patients_mandal_id ON patients(mandal_id);
