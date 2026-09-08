-- Migration: Convert doctor_targets.referral_target from INTEGER to NUMERIC(12,2)
-- Enables monetary referral revenue quota instead of patient count
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'doctor_targets' 
          AND column_name = 'referral_target' 
          AND data_type = 'integer'
    ) THEN
        ALTER TABLE doctor_targets 
        ALTER COLUMN referral_target TYPE NUMERIC(12,2) 
        USING referral_target::numeric(12,2);
    END IF;
END $$;
