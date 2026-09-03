-- Pharmacy Module Schema Additions for Hospital ERP Backend

-- 1. Additive enum values for stock_txn_type
DO $$ BEGIN
    ALTER TYPE stock_txn_type ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE stock_txn_type ADD VALUE IF NOT EXISTS 'damaged';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Additive columns for medicine_stock
ALTER TABLE medicine_stock ADD COLUMN IF NOT EXISTS manufacture_date DATE;
ALTER TABLE medicine_stock ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(10,2);
ALTER TABLE medicine_stock ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);
ALTER TABLE medicine_stock ADD COLUMN IF NOT EXISTS supplier VARCHAR(150);
ALTER TABLE medicine_stock ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
ALTER TABLE medicine_stock ADD COLUMN IF NOT EXISTS received_date DATE DEFAULT CURRENT_DATE;

DO $$ BEGIN
    ALTER TABLE medicine_stock ADD CONSTRAINT uq_medicine_stock_batch UNIQUE (medicine_id, batch_number);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Additive column for prescriptions (pharmacy_status)
DO $$ BEGIN
    CREATE TYPE pharmacy_status_enum AS ENUM ('pending','processing','partially_dispensed','dispensed','on_hold','cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacy_status pharmacy_status_enum NOT NULL DEFAULT 'pending';

-- 4. Additive columns for prescription_items
DO $$ BEGIN
    CREATE TYPE item_dispense_status AS ENUM ('pending','available','partially_available','out_of_stock','on_hold','clarification_requested','dispensed','partially_dispensed','unavailable');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS frequency VARCHAR(50);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS route VARCHAR(50);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS timing VARCHAR(50);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS food_instruction VARCHAR(100);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS selected_batch_id INTEGER REFERENCES medicine_stock(id);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS dispensed_quantity INTEGER DEFAULT 0;
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS dispense_status item_dispense_status NOT NULL DEFAULT 'pending';
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS hold_reason TEXT;

-- 5. Excel Stock Import Batches Table
CREATE TABLE IF NOT EXISTS stock_import_batches (
    batch_id                SERIAL PRIMARY KEY,
    imported_by             INTEGER NOT NULL REFERENCES users(user_id),
    file_name               VARCHAR(255) NOT NULL,
    total_rows              INTEGER NOT NULL DEFAULT 0,
    valid_rows              INTEGER NOT NULL DEFAULT 0,
    invalid_rows            INTEGER NOT NULL DEFAULT 0,
    new_medicines_created   INTEGER NOT NULL DEFAULT 0,
    existing_stock_updated  INTEGER NOT NULL DEFAULT 0,
    failed_rows_report      JSONB DEFAULT '[]',
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    imported_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Prescription Clarifications Table
DO $$ BEGIN
    CREATE TYPE clarification_issue_type AS ENUM (
        'medicine_unavailable','dosage_clarification','quantity_clarification',
        'prescription_error','duration_clarification','substitution_request','other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE clarification_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE clarification_status AS ENUM ('open','responded','resolved','closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS prescription_clarifications (
    id                      SERIAL PRIMARY KEY,
    prescription_id         INTEGER NOT NULL REFERENCES prescriptions(id),
    prescription_item_id    INTEGER REFERENCES prescription_items(id),
    patient_id              INTEGER NOT NULL REFERENCES patients(patient_id),
    raised_by               INTEGER NOT NULL REFERENCES users(user_id),
    issue_type              clarification_issue_type NOT NULL,
    description             TEXT NOT NULL,
    priority                clarification_priority NOT NULL DEFAULT 'normal',
    doctor_response         TEXT,
    responded_by            INTEGER REFERENCES users(user_id),
    responded_at            TIMESTAMPTZ,
    status                  clarification_status NOT NULL DEFAULT 'open',
    remarks                 TEXT,
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clarifications_prescription ON prescription_clarifications(prescription_id);

-- 7. Stock Adjustments Table
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id                      SERIAL PRIMARY KEY,
    medicine_id             INTEGER NOT NULL REFERENCES medicine_master(id),
    stock_id                INTEGER NOT NULL REFERENCES medicine_stock(id),
    system_quantity         INTEGER NOT NULL,
    physical_quantity        INTEGER NOT NULL,
    difference              INTEGER NOT NULL,
    reason                  VARCHAR(50) NOT NULL,
    remarks                 TEXT,
    requires_approval        BOOLEAN NOT NULL DEFAULT false,
    approval_status         reset_status NOT NULL DEFAULT 'approved',
    approved_by             INTEGER REFERENCES users(user_id),
    performed_by            INTEGER NOT NULL REFERENCES users(user_id),
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Medicine Returns Table
DO $$ BEGIN
    CREATE TYPE return_condition_enum AS ENUM ('good','damaged','expired','opened');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS medicine_returns (
    id                      SERIAL PRIMARY KEY,
    patient_id              INTEGER NOT NULL REFERENCES patients(patient_id),
    prescription_id         INTEGER REFERENCES prescriptions(id),
    medicine_id             INTEGER NOT NULL REFERENCES medicine_master(id),
    stock_id                INTEGER NOT NULL REFERENCES medicine_stock(id),
    return_quantity         INTEGER NOT NULL,
    return_reason           TEXT NOT NULL,
    condition               return_condition_enum NOT NULL,
    restocked               BOOLEAN NOT NULL DEFAULT false,
    remarks                 TEXT,
    processed_by            INTEGER NOT NULL REFERENCES users(user_id),
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
