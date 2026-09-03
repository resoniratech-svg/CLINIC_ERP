-- PRO / Manager Module Schema Additions for Hospital ERP Backend

-- 1. Additive enum value for packages in bill_type
ALTER TYPE bill_type ADD VALUE IF NOT EXISTS 'package';

-- 2. Packages Table & Enums
DO $$ BEGIN
    CREATE TYPE package_type_enum AS ENUM ('monthly','quarterly','half_yearly','yearly','custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE package_status_enum AS ENUM ('pending','active','completed','expired','cancelled','on_hold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS packages (
    package_id          SERIAL PRIMARY KEY,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id           INTEGER REFERENCES doctors(doctor_id),
    package_name        VARCHAR(150) NOT NULL,
    package_type        package_type_enum NOT NULL,
    from_date           DATE NOT NULL,
    to_date             DATE,
    duration_days       INTEGER,
    package_amount      NUMERIC(12,2) NOT NULL,
    discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    final_amount        NUMERIC(12,2) NOT NULL,
    payment_status      VARCHAR(30) NOT NULL DEFAULT 'pending',
    status              package_status_enum NOT NULL DEFAULT 'pending',
    remarks             TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(user_id),
    branch_id           INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_patient ON packages(patient_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);

-- 3. Additive FK columns
ALTER TABLE bills ADD COLUMN IF NOT EXISTS package_id INTEGER REFERENCES packages(package_id);
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS package_id INTEGER REFERENCES packages(package_id);
ALTER TABLE acq_patients ADD COLUMN IF NOT EXISTS package_id INTEGER REFERENCES packages(package_id);

-- 4. Counselling Records Table
DO $$ BEGIN
    CREATE TYPE counselling_type_enum AS ENUM ('treatment','medication','package','procedure','followup','general','other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS counselling_records (
    counselling_id          SERIAL PRIMARY KEY,
    patient_id              INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id               INTEGER REFERENCES doctors(doctor_id),
    counselled_by           INTEGER NOT NULL REFERENCES users(user_id),
    counselling_type        counselling_type_enum NOT NULL,
    counselling_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    counselling_time        TIME NOT NULL DEFAULT CURRENT_TIME,
    notes                   TEXT NOT NULL,
    patient_understanding   VARCHAR(30) NOT NULL,
    patient_response        TEXT,
    remarks                 TEXT,
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counselling_patient ON counselling_records(patient_id);

-- 5. Prescription Modifications Audit & Approval Table
DO $$ BEGIN
    CREATE TYPE modification_field_type AS ENUM ('duration','quantity','medicine','dosage','frequency','instructions');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE modification_status_enum AS ENUM ('applied','pending_doctor_confirmation','approved','rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS prescription_modifications (
    id                      SERIAL PRIMARY KEY,
    prescription_item_id    INTEGER NOT NULL REFERENCES prescription_items(id),
    field_changed           modification_field_type NOT NULL,
    original_value          VARCHAR(255) NOT NULL,
    modified_value          VARCHAR(255) NOT NULL,
    modified_by             INTEGER NOT NULL REFERENCES users(user_id),
    modifier_role           user_role NOT NULL,
    reason                  TEXT NOT NULL,
    status                  modification_status_enum NOT NULL DEFAULT 'applied',
    doctor_decision_by      INTEGER REFERENCES users(user_id),
    doctor_decision_at      TIMESTAMPTZ,
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_mods_item ON prescription_modifications(prescription_item_id);

-- 6. Feedback & Complaints Merged Table
DO $$ BEGIN
    CREATE TYPE record_kind_enum AS ENUM ('feedback','complaint');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fc_status_enum AS ENUM ('open','in_progress','resolved','closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fc_priority_enum AS ENUM ('low','normal','high','urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS feedback_complaints (
    id                      SERIAL PRIMARY KEY,
    patient_id              INTEGER NOT NULL REFERENCES patients(patient_id),
    kind                    record_kind_enum NOT NULL,
    category_type           VARCHAR(50) NOT NULL,
    description             TEXT NOT NULL,
    rating                  SMALLINT CHECK (rating BETWEEN 1 AND 5),
    priority                fc_priority_enum,
    assigned_to             INTEGER REFERENCES users(user_id),
    action_taken            TEXT,
    resolution              TEXT,
    status                  fc_status_enum NOT NULL DEFAULT 'open',
    remarks                 TEXT,
    logged_by               INTEGER NOT NULL REFERENCES users(user_id),
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fc_patient ON feedback_complaints(patient_id);
CREATE INDEX IF NOT EXISTS idx_fc_kind_status ON feedback_complaints(kind, status);
