-- Migration: Coupon Billing Integration
-- Description: Adds coupon_id to bills and creates performance index for patient coupon wallet

ALTER TABLE bills ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_referring_created ON coupons(referring_patient_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_bills_coupon_id ON bills(coupon_id);
