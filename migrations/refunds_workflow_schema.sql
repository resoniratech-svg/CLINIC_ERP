-- Migration: Refunds Workflow Schema
-- Adds refunds table linked to original payments, bills, and patients.

CREATE TABLE IF NOT EXISTS refunds (
    refund_id          SERIAL PRIMARY KEY,
    refund_number      VARCHAR(50) UNIQUE NOT NULL,
    payment_id         INTEGER NOT NULL REFERENCES payments(payment_id),
    bill_id            INTEGER NOT NULL REFERENCES bills(bill_id),
    patient_id         INTEGER NOT NULL REFERENCES patients(patient_id),
    amount             NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    refund_method      payment_method_type NOT NULL,
    reason             TEXT NOT NULL,
    refunded_by        INTEGER NOT NULL REFERENCES users(user_id),
    branch_id          INTEGER NOT NULL REFERENCES branches(branch_id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_bill_id ON refunds(bill_id);
CREATE INDEX IF NOT EXISTS idx_refunds_patient_id ON refunds(patient_id);
CREATE INDEX IF NOT EXISTS idx_refunds_branch_id ON refunds(branch_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);
