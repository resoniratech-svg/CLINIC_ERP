-- Migration: PRO Cash Deposit Approval Workflow & Cash Ledger Enhancements
-- File: migrations/cash_deposit_workflow_schema.sql

-- 1. Create cash_deposit_requests table
CREATE TABLE IF NOT EXISTS cash_deposit_requests (
    id                SERIAL PRIMARY KEY,
    branch_id         INTEGER NOT NULL REFERENCES branches(branch_id),
    requested_by      INTEGER NOT NULL REFERENCES users(user_id),
    requested_role    VARCHAR(50) NOT NULL DEFAULT 'pro_manager',
    requested_amount  NUMERIC(12,2) NOT NULL CHECK (requested_amount > 0),
    request_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    status            VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    approved_by       INTEGER REFERENCES users(user_id),
    approved_at       TIMESTAMPTZ,
    rejected_by       INTEGER REFERENCES users(user_id),
    rejected_at       TIMESTAMPTZ,
    rejection_reason  TEXT,
    completed_by      INTEGER REFERENCES users(user_id),
    completed_at      TIMESTAMPTZ,
    challan_reference VARCHAR(100),
    remarks           TEXT,
    idempotency_key   VARCHAR(100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes on cash_deposit_requests
CREATE INDEX IF NOT EXISTS idx_cdr_branch_id ON cash_deposit_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_cdr_requested_by ON cash_deposit_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_cdr_status ON cash_deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_cdr_request_date ON cash_deposit_requests(request_date);
CREATE INDEX IF NOT EXISTS idx_cdr_created_at ON cash_deposit_requests(created_at);

-- 3. Enhance existing cash_deposits table
ALTER TABLE cash_deposits ADD COLUMN IF NOT EXISTS deposit_type VARCHAR(30) DEFAULT 'SUPER_ADMIN';
ALTER TABLE cash_deposits ADD COLUMN IF NOT EXISTS deposit_request_id INTEGER REFERENCES cash_deposit_requests(id);
ALTER TABLE cash_deposits ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(user_id);

CREATE INDEX IF NOT EXISTS idx_cd_deposit_type ON cash_deposits(deposit_type);
CREATE INDEX IF NOT EXISTS idx_cd_deposit_request_id ON cash_deposits(deposit_request_id);
