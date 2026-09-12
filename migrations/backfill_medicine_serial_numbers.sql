-- ============================================================
-- Migration: Backfill and Standardize Medicine Master Serial Numbers
-- Ensures all medicines have unique, non-null MED-XXXXX serials
-- Idempotent and safe to run multiple times
-- ============================================================

DO $$
DECLARE
    curr_max INTEGER := 0;
    r RECORD;
BEGIN
    -- Determine current maximum numeric serial value
    SELECT COALESCE(MAX(CAST(SUBSTRING(serial_number FROM '^MED-([0-9]+)$') AS INTEGER)), 0)
    INTO curr_max
    FROM medicine_master;

    -- Iterate through records with missing or invalid serial numbers in order of id
    FOR r IN (
        SELECT id 
        FROM medicine_master 
        WHERE serial_number IS NULL OR serial_number !~ '^MED-[0-9]+$'
        ORDER BY id ASC
    ) LOOP
        curr_max := curr_max + 1;
        UPDATE medicine_master
        SET serial_number = 'MED-' || LPAD(curr_max::text, 5, '0'),
            updated_at = NOW()
        WHERE id = r.id;
    END LOOP;

    -- Ensure unique constraint exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'uq_medicine_master_serial'
    ) THEN
        ALTER TABLE medicine_master ADD CONSTRAINT uq_medicine_master_serial UNIQUE (serial_number);
    END IF;
END $$;
