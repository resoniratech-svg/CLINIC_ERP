-- Migration: Add serial_no and problem to outbound_leads
ALTER TABLE outbound_leads ADD COLUMN IF NOT EXISTS serial_no VARCHAR(100);
ALTER TABLE outbound_leads ADD COLUMN IF NOT EXISTS problem TEXT;
