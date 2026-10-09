-- Migration: Add trigram extension and GIN indexes for fast partial-match patient search
-- Run ONLY on local/test databases. Never delete or overwrite existing clinical data.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm ON patients USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_mobile_trgm ON patients USING gin (mobile_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_reg_id_trgm ON patients USING gin (registration_id gin_trgm_ops);
