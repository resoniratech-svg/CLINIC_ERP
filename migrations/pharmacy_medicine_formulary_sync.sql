-- Migration: Pharmacy Medicine Formulary Sync
-- 1. Add updated_at column to medicine_master
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medicine_master' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE medicine_master ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- 2. Backfill updated_at
UPDATE medicine_master SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;

-- 3. Unique partial index to guarantee single active record per (normalized name + strength)
CREATE UNIQUE INDEX IF NOT EXISTS idx_medicine_master_name_strength_active 
ON medicine_master(LOWER(TRIM(medicine_name)), LOWER(TRIM(strength))) 
WHERE status != 'deleted';
