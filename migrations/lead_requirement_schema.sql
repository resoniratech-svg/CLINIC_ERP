-- Add requirement and remarks columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS requirement TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS remarks TEXT;
