-- Migration: coupon_management_schema.sql
-- Purpose: Schema for Coupon Management, Patient Referral Discounts, and Granular RBAC Permissions
-- Additive & idempotent migration

-- 1. Ensure coupon_management column on receptionist_permissions
ALTER TABLE receptionist_permissions ADD COLUMN IF NOT EXISTS coupon_management BOOLEAN DEFAULT false;

-- 2. Ensure coupon_management column on pro_manager_permissions
ALTER TABLE pro_manager_permissions ADD COLUMN IF NOT EXISTS coupon_management BOOLEAN DEFAULT false;

-- 3. Create doctor_permissions table if not exists
CREATE TABLE IF NOT EXISTS doctor_permissions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    coupon_management   BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create coupons table if not exists
CREATE TABLE IF NOT EXISTS coupons (
    id                      SERIAL PRIMARY KEY,
    coupon_code             VARCHAR(50) NOT NULL UNIQUE,
    discount_type           VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'cash')),
    discount_value          NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    max_discount_limit      NUMERIC(10, 2) DEFAULT NULL,
    referring_patient_id    INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    referred_patient_id     INTEGER REFERENCES patients(patient_id) ON DELETE RESTRICT,
    valid_from              DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until             DATE NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'redeemed', 'cancelled')),
    remarks                 TEXT,
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_by              INTEGER REFERENCES users(user_id),
    updated_by              INTEGER REFERENCES users(user_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create coupon_redemptions table if not exists
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id                  SERIAL PRIMARY KEY,
    coupon_id           INTEGER NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    bill_id             INTEGER REFERENCES bills(bill_id) ON DELETE SET NULL,
    bill_amount         NUMERIC(10, 2) NOT NULL,
    discount_amount     NUMERIC(10, 2) NOT NULL,
    final_payable       NUMERIC(10, 2) NOT NULL,
    redeemed_by         INTEGER REFERENCES users(user_id),
    redeemed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    remarks             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist in case table was created with partial schema
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS bill_id INTEGER REFERENCES bills(bill_id) ON DELETE SET NULL;
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 6. Indexes for fast query lookups and search
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(coupon_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_coupons_lower_code ON coupons(LOWER(coupon_code));
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_coupons_referring_patient ON coupons(referring_patient_id);
CREATE INDEX IF NOT EXISTS idx_coupons_referred_patient ON coupons(referred_patient_id);
CREATE INDEX IF NOT EXISTS idx_coupons_validity ON coupons(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_patient_id ON coupon_redemptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_bill_id ON coupon_redemptions(bill_id);

-- Ensure non-negative payable constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_coupon_redemptions_final_payable'
    ) THEN
        ALTER TABLE coupon_redemptions ADD CONSTRAINT chk_coupon_redemptions_final_payable CHECK (final_payable >= 0);
    END IF;
END $$;

