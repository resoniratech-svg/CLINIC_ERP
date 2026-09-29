-- Migration: treatment_plans_billing_columns.sql
-- Description: Add billing_status and billed_in_bill_id columns to treatment_plans
-- Required by PRO Billing Integration and getPatientVisitStatusHelper query
-- Safe: uses IF NOT EXISTS / idempotent

ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS billing_status VARCHAR(30) NOT NULL DEFAULT 'awaiting_billing';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS billed_in_bill_id INTEGER REFERENCES bills(bill_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_treatment_plans_billing_status ON treatment_plans(billing_status);

-- Ensure packages.prescription_id FK allows SET NULL on prescription delete
-- (packages_prescription_id_fkey must have ON DELETE SET NULL for test teardown)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'packages_prescription_id_fkey'
        AND table_name = 'packages'
    ) THEN
        ALTER TABLE packages DROP CONSTRAINT packages_prescription_id_fkey;
        ALTER TABLE packages ADD CONSTRAINT packages_prescription_id_fkey
            FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;
    END IF;
END $$;
