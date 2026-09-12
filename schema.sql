-- ============================================================
-- HOSPITAL ERP - SUPER ADMIN MODULE - FULL SCHEMA
-- Database name: hospital_erp_db
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- ENUM TYPES ----------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('super_admin','receptionist','doctor','pro_manager','executive','pharmacy');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active','inactive','suspended','deleted');
    END IF;
    ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'deleted';
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
        CREATE TYPE gender_type AS ENUM ('male','female','other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_type') THEN
        CREATE TYPE patient_type AS ENUM ('new','existing');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_type') THEN
        CREATE TYPE appointment_type AS ENUM ('new','renewal','followup');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE appointment_status AS ENUM ('scheduled','completed','cancelled','no_show');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_source_type') THEN
        CREATE TYPE lead_source_type AS ENUM ('inbound','outbound');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM ('new','interested','not_interested','converted','rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
        CREATE TYPE payment_method_type AS ENUM ('cash','card','upi','razorpay','bajaj_pay');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_type') THEN
        CREATE TYPE bill_type AS ENUM ('consultation','treatment','other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_status') THEN
        CREATE TYPE bill_status AS ENUM ('created','cancelled','refunded');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reset_status') THEN
        CREATE TYPE reset_status AS ENUM ('pending','approved','rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'followup_category') THEN
        CREATE TYPE followup_category AS ENUM ('treatment','appointment','renewal','due','acq','ocnr','general');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_type') THEN
        CREATE TYPE referral_type AS ENUM ('employee','patient');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_txn_type') THEN
        CREATE TYPE stock_txn_type AS ENUM ('in','out','adjustment','return');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ocnr_type') THEN
        CREATE TYPE ocnr_type AS ENUM ('oc','nr');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incentive_trigger') THEN
        CREATE TYPE incentive_trigger AS ENUM ('created','qualified','converted');
    END IF;
END $$;

-- 1. BRANCH
CREATE TABLE IF NOT EXISTS branches (
    branch_id       SERIAL PRIMARY KEY,
    branch_name     VARCHAR(150) NOT NULL,
    branch_code     VARCHAR(30) NOT NULL UNIQUE,
    branch_type     VARCHAR(50),
    address         TEXT,
    phone_number    VARCHAR(20),
    email           VARCHAR(150),
    manager_user_id INTEGER,
    opening_time    TIME,
    closing_time    TIME,
    status          user_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO branches (branch_name, branch_code, address, phone_number, status)
VALUES ('Hyderabad Main Branch', 'HYD001', 'Hyderabad, Telangana', '9876543210', 'active')
ON CONFLICT (branch_code) DO NOTHING;

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    user_id             SERIAL PRIMARY KEY,
    employee_id         VARCHAR(30) NOT NULL UNIQUE,
    full_name           VARCHAR(150) NOT NULL,
    mobile_number       VARCHAR(15) NOT NULL,
    email               VARCHAR(150),
    gender              gender_type,
    date_of_joining     DATE,
    username            VARCHAR(50) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    department          VARCHAR(100),
    designation         VARCHAR(100),
    reporting_manager_id INTEGER REFERENCES users(user_id),
    branch_id           INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    role                user_role NOT NULL,
    status              user_status NOT NULL DEFAULT 'active',
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RECEPTIONIST PERMISSIONS
CREATE TABLE IF NOT EXISTS receptionist_permissions (
    id                          SERIAL PRIMARY KEY,
    user_id                     INTEGER NOT NULL UNIQUE REFERENCES users(user_id),
    registration                BOOLEAN DEFAULT true,
    enquiry                     BOOLEAN DEFAULT true,
    appointment                 BOOLEAN DEFAULT true,
    checkin                     BOOLEAN DEFAULT true,
    consultation_fee_billing    BOOLEAN DEFAULT true,
    payment_collection          BOOLEAN DEFAULT true,
    crm_calling                 BOOLEAN DEFAULT true,
    followup                    BOOLEAN DEFAULT true,
    renewal                     BOOLEAN DEFAULT true,
    due_management              BOOLEAN DEFAULT true,
    coupon_management           BOOLEAN DEFAULT false,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. DOCTORS
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id                   SERIAL PRIMARY KEY,
    user_id                     INTEGER NOT NULL UNIQUE REFERENCES users(user_id),
    doctor_code                 VARCHAR(30) NOT NULL UNIQUE,
    qualification               VARCHAR(150),
    specialization              VARCHAR(150),
    medical_registration_number VARCHAR(100),
    experience_years            INTEGER,
    working_days                VARCHAR(100),
    start_time                  TIME,
    end_time                    TIME,
    slot_duration_minutes       INTEGER DEFAULT 15,
    new_consultation_fee        NUMERIC(10,2),
    renewal_consultation_fee    NUMERIC(10,2),
    followup_consultation_fee   NUMERIC(10,2),
    branch_id                   INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    status                      user_status NOT NULL DEFAULT 'active',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4B. DOCTOR PERMISSIONS
CREATE TABLE IF NOT EXISTS doctor_permissions (
    id                          SERIAL PRIMARY KEY,
    user_id                     INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    coupon_management           BOOLEAN DEFAULT false,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PRO / MANAGER PERMISSIONS
CREATE TABLE IF NOT EXISTS pro_manager_permissions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(user_id),
    counselling     BOOLEAN DEFAULT true,
    billing         BOOLEAN DEFAULT true,
    payment         BOOLEAN DEFAULT true,
    due_collection  BOOLEAN DEFAULT true,
    crm             BOOLEAN DEFAULT true,
    followup        BOOLEAN DEFAULT true,
    renewals        BOOLEAN DEFAULT true,
    complaints      BOOLEAN DEFAULT true,
    feedback        BOOLEAN DEFAULT true,
    reports         BOOLEAN DEFAULT true,
    accountant      BOOLEAN DEFAULT true,
    coupon_management BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. EXECUTIVES
CREATE TABLE IF NOT EXISTS executives (
    executive_id        SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL UNIQUE REFERENCES users(user_id),
    per_lead_incentive  NUMERIC(10,2) NOT NULL DEFAULT 0,
    incentive_type      VARCHAR(50) DEFAULT 'per_lead',
    incentive_amount    NUMERIC(10,2),
    incentive_trigger   incentive_trigger NOT NULL DEFAULT 'created',
    effective_date      DATE DEFAULT CURRENT_DATE,
    branch_id           INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    status              user_status NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PHARMACY PERMISSIONS
CREATE TABLE IF NOT EXISTS pharmacy_permissions (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER NOT NULL UNIQUE REFERENCES users(user_id),
    prescription_queue   BOOLEAN DEFAULT true,
    dispensing           BOOLEAN DEFAULT true,
    inventory            BOOLEAN DEFAULT true,
    stock                BOOLEAN DEFAULT true,
    batch                BOOLEAN DEFAULT true,
    expiry               BOOLEAN DEFAULT true,
    returns              BOOLEAN DEFAULT true,
    stock_adjustment     BOOLEAN DEFAULT true,
    stock_transactions   BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. MASTER TABLES
CREATE TABLE IF NOT EXISTS master_villages        (id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL, mandal_id INTEGER, status user_status DEFAULT 'active');
CREATE TABLE IF NOT EXISTS master_mandals         (id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL, status user_status DEFAULT 'active');
CREATE TABLE IF NOT EXISTS master_lead_sources    (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, status user_status DEFAULT 'active');
CREATE TABLE IF NOT EXISTS master_referral_sources(id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, status user_status DEFAULT 'active');
CREATE TABLE IF NOT EXISTS master_departments     (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, status user_status DEFAULT 'active');
CREATE TABLE IF NOT EXISTS master_specializations (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, status user_status DEFAULT 'active');
CREATE TABLE IF NOT EXISTS master_charge_types    (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, status user_status DEFAULT 'active');
CREATE TABLE IF NOT EXISTS master_expense_categories (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, status user_status DEFAULT 'active');
CREATE TABLE IF NOT EXISTS master_ailments          (id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL UNIQUE, status user_status DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS master_discount_rules (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    max_discount_pct NUMERIC(5,2) NOT NULL,
    approver_role    user_role NOT NULL DEFAULT 'pro_manager',
    status           user_status DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS payment_methods_config (
    id           SERIAL PRIMARY KEY,
    method_name  payment_method_type NOT NULL UNIQUE,
    is_active    BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO payment_methods_config (method_name) VALUES ('cash'),('card'),('upi'),('razorpay'),('bajaj_pay') ON CONFLICT (method_name) DO NOTHING;

-- 9. PATIENTS
CREATE TABLE IF NOT EXISTS patients (
    patient_id      SERIAL PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    mobile_number   VARCHAR(15) NOT NULL UNIQUE,
    age             INTEGER,
    gender          gender_type,
    village         VARCHAR(150),
    mandal          VARCHAR(150),
    village_id      INTEGER REFERENCES master_villages(id),
    mandal_id       INTEGER REFERENCES master_mandals(id),
    address         TEXT,
    source          VARCHAR(100),
    patient_type    patient_type NOT NULL DEFAULT 'new',
    branch_id       INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. LEADS
CREATE TABLE IF NOT EXISTS outbound_import_batches (
    batch_id        SERIAL PRIMARY KEY,
    imported_by     INTEGER NOT NULL REFERENCES users(user_id),
    file_name       VARCHAR(255),
    total_records   INTEGER DEFAULT 0,
    valid_records   INTEGER DEFAULT 0,
    duplicate_records INTEGER DEFAULT 0,
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_leads (
    id                  SERIAL PRIMARY KEY,
    batch_id            INTEGER REFERENCES outbound_import_batches(batch_id),
    serial_no           VARCHAR(100),
    patient_name        VARCHAR(150),
    mobile_number       VARCHAR(15) NOT NULL,
    problem             TEXT,
    age                 INTEGER,
    gender              gender_type,
    village             VARCHAR(150),
    mandal              VARCHAR(150),
    source              VARCHAR(100),
    campaign            VARCHAR(150),
    assigned_executive_id INTEGER REFERENCES executives(executive_id),
    status              lead_status NOT NULL DEFAULT 'new',
    remarks             TEXT,
    branch_id           INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
    lead_id                 SERIAL PRIMARY KEY,
    patient_id              INTEGER REFERENCES patients(patient_id),
    lead_name               VARCHAR(150) NOT NULL,
    mobile_number           VARCHAR(15) NOT NULL,
    age                     INTEGER,
    gender                  gender_type,
    village                 VARCHAR(150),
    mandal                  VARCHAR(150),
    source                  VARCHAR(100),
    campaign                VARCHAR(150),
    lead_created_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
    executive_id            INTEGER REFERENCES executives(executive_id),
    lead_source             lead_source_type NOT NULL,
    status                  lead_status NOT NULL DEFAULT 'new',
    assigned_receptionist_id INTEGER REFERENCES users(user_id),
    branch_id               INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    requirement             TEXT,
    remarks                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id      SERIAL PRIMARY KEY,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id           INTEGER NOT NULL REFERENCES doctors(doctor_id),
    appointment_type    appointment_type NOT NULL DEFAULT 'new',
    appointment_date    DATE NOT NULL,
    appointment_time    TIME NOT NULL,
    status              appointment_status NOT NULL DEFAULT 'scheduled',
    created_by          INTEGER REFERENCES users(user_id),
    branch_id           INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. TARGETS
CREATE TABLE IF NOT EXISTS targets (
    target_id       SERIAL PRIMARY KEY,
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year            INTEGER NOT NULL,
    overall_target  NUMERIC(12,2) NOT NULL,
    enquiry_target  NUMERIC(12,2) NOT NULL,
    unit_target     NUMERIC(12,2) NOT NULL,
    allow_unallocated BOOLEAN NOT NULL DEFAULT false,
    branch_id       INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_by      INTEGER REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (month, year, branch_id)
);

CREATE TABLE IF NOT EXISTS doctor_targets (
    id              SERIAL PRIMARY KEY,
    doctor_id       INTEGER NOT NULL REFERENCES doctors(doctor_id),
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year            INTEGER NOT NULL,
    enquiry_target  NUMERIC(12,2) DEFAULT 0,
    unit_target     NUMERIC(12,2) DEFAULT 0,
    referral_target NUMERIC(12,2) DEFAULT 0,
    revenue_target  NUMERIC(12,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (doctor_id, month, year)
);

CREATE TABLE IF NOT EXISTS executive_performance (
    id              SERIAL PRIMARY KEY,
    executive_id    INTEGER NOT NULL REFERENCES executives(executive_id),
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year            INTEGER NOT NULL,
    leads_generated INTEGER DEFAULT 0,
    incentive_earned NUMERIC(10,2) DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (executive_id, month, year)
);

-- 13. BILLING & PAYMENTS
CREATE TABLE IF NOT EXISTS consultation_fees (
    id               SERIAL PRIMARY KEY,
    doctor_id        INTEGER NOT NULL REFERENCES doctors(doctor_id),
    branch_id        INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    appointment_type appointment_type NOT NULL,
    fee_amount       NUMERIC(10,2) NOT NULL,
    effective_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    status           user_status NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_configuration (
    id          SERIAL PRIMARY KEY,
    config_key  VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bills (
    bill_id           SERIAL PRIMARY KEY,
    bill_number       VARCHAR(30) NOT NULL UNIQUE,
    patient_id        INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id         INTEGER REFERENCES doctors(doctor_id),
    bill_type         bill_type NOT NULL,
    created_by        INTEGER NOT NULL REFERENCES users(user_id),
    amount            NUMERIC(12,2) NOT NULL,
    discount_amount   NUMERIC(12,2) DEFAULT 0,
    discount_approved_by INTEGER REFERENCES users(user_id),
    final_amount      NUMERIC(12,2) NOT NULL,
    status            bill_status NOT NULL DEFAULT 'created',
    branch_id         INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bill_items (
    id           SERIAL PRIMARY KEY,
    bill_id      INTEGER NOT NULL REFERENCES bills(bill_id),
    charge_type  VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    amount       NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id      SERIAL PRIMARY KEY,
    bill_id         INTEGER NOT NULL REFERENCES bills(bill_id),
    patient_id      INTEGER NOT NULL REFERENCES patients(patient_id),
    payment_method  payment_method_type NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    payment_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by     INTEGER NOT NULL REFERENCES users(user_id),
    status          VARCHAR(30) NOT NULL DEFAULT 'success',
    branch_id       INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id)
);

CREATE TABLE IF NOT EXISTS due_patients (
    id           SERIAL PRIMARY KEY,
    patient_id   INTEGER NOT NULL REFERENCES patients(patient_id),
    bill_id      INTEGER REFERENCES bills(bill_id),
    due_amount   NUMERIC(12,2) NOT NULL,
    due_date     DATE,
    status       VARCHAR(30) NOT NULL DEFAULT 'pending',
    branch_id    INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. CASH MANAGEMENT
CREATE TABLE IF NOT EXISTS cash_ledger (
    id                SERIAL PRIMARY KEY,
    branch_id         INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    ledger_date       DATE NOT NULL,
    opening_balance   NUMERIC(12,2) NOT NULL DEFAULT 0,
    cash_revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
    cash_expenditure  NUMERIC(12,2) NOT NULL DEFAULT 0,
    deposited_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    closing_balance   NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, ledger_date)
);

CREATE TABLE IF NOT EXISTS expenditures (
    id               SERIAL PRIMARY KEY,
    expense_date     DATE NOT NULL,
    branch_id        INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    expense_category VARCHAR(100) NOT NULL,
    description      TEXT,
    amount           NUMERIC(12,2) NOT NULL,
    payment_mode     payment_method_type NOT NULL DEFAULT 'cash',
    approved_by      INTEGER REFERENCES users(user_id),
    entered_by       INTEGER NOT NULL REFERENCES users(user_id),
    remarks          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_cdr_branch_id ON cash_deposit_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_cdr_requested_by ON cash_deposit_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_cdr_status ON cash_deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_cdr_request_date ON cash_deposit_requests(request_date);
CREATE INDEX IF NOT EXISTS idx_cdr_created_at ON cash_deposit_requests(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cdr_idempotency_key ON cash_deposit_requests(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS cash_deposits (
    id               SERIAL PRIMARY KEY,
    branch_id        INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    deposit_date     DATE NOT NULL,
    opening_balance  NUMERIC(12,2) NOT NULL,
    cash_revenue     NUMERIC(12,2) NOT NULL,
    cash_expenditure NUMERIC(12,2) NOT NULL,
    available_cash   NUMERIC(12,2) NOT NULL,
    deposited_amount NUMERIC(12,2) NOT NULL,
    deposit_reference VARCHAR(100),
    deposited_by     INTEGER REFERENCES users(user_id),
    closing_balance  NUMERIC(12,2) NOT NULL,
    deposit_type     VARCHAR(30) DEFAULT 'SUPER_ADMIN',
    deposit_request_id INTEGER REFERENCES cash_deposit_requests(id),
    approved_by      INTEGER REFERENCES users(user_id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cd_deposit_request_id_unique ON cash_deposits(deposit_request_id) WHERE deposit_request_id IS NOT NULL;

-- 15. CRM
CREATE TABLE IF NOT EXISTS crm_followups (
    id           SERIAL PRIMARY KEY,
    patient_id   INTEGER NOT NULL REFERENCES patients(patient_id),
    category     followup_category NOT NULL,
    assigned_to  INTEGER NOT NULL REFERENCES users(user_id),
    status       VARCHAR(30) NOT NULL DEFAULT 'pending',
    due_date     DATE,
    remarks      TEXT,
    branch_id    INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acq_patients (
    id                  SERIAL PRIMARY KEY,
    patient_id          INTEGER NOT NULL REFERENCES patients(patient_id),
    monthly_plan_amount NUMERIC(10,2) NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE,
    frequency           VARCHAR(30) DEFAULT 'monthly',
    status              VARCHAR(30) NOT NULL DEFAULT 'active',
    renewal_date        DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oc_nr_patients (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES patients(patient_id),
    classification  ocnr_type NOT NULL,
    reason          TEXT,
    marked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS renewals (
    id           SERIAL PRIMARY KEY,
    patient_id   INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id    INTEGER REFERENCES doctors(doctor_id),
    renewal_date DATE NOT NULL,
    amount       NUMERIC(10,2),
    status       VARCHAR(30) DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
    id             SERIAL PRIMARY KEY,
    patient_id     INTEGER NOT NULL REFERENCES patients(patient_id),
    referral_type  referral_type NOT NULL,
    referred_by    INTEGER REFERENCES users(user_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. PHARMACY
CREATE TABLE IF NOT EXISTS medicine_master (
    id              SERIAL PRIMARY KEY,
    serial_number   VARCHAR(50) UNIQUE,
    medicine_name   VARCHAR(150) NOT NULL,
    generic_name    VARCHAR(150),
    medicine_type   VARCHAR(80),
    strength        VARCHAR(50),
    unit            VARCHAR(30),
    category        VARCHAR(100),
    manufacturer    VARCHAR(150),
    reorder_level   INTEGER DEFAULT 10,
    status          user_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicine_stock (
    id              SERIAL PRIMARY KEY,
    medicine_id     INTEGER NOT NULL REFERENCES medicine_master(id),
    batch_number    VARCHAR(50) NOT NULL,
    expiry_date     DATE NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 0,
    branch_id       INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id              SERIAL PRIMARY KEY,
    medicine_id     INTEGER NOT NULL REFERENCES medicine_master(id),
    transaction_type stock_txn_type NOT NULL,
    quantity        INTEGER NOT NULL,
    batch_number    VARCHAR(50),
    reference       VARCHAR(150),
    performed_by    INTEGER NOT NULL REFERENCES users(user_id),
    branch_id       INTEGER NOT NULL DEFAULT 1 REFERENCES branches(branch_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id       INTEGER NOT NULL REFERENCES doctors(doctor_id),
    appointment_id  INTEGER REFERENCES appointments(appointment_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescription_items (
    id              SERIAL PRIMARY KEY,
    prescription_id INTEGER NOT NULL REFERENCES prescriptions(id),
    medicine_id     INTEGER NOT NULL REFERENCES medicine_master(id),
    dosage          VARCHAR(100),
    quantity        INTEGER NOT NULL,
    dispensed       BOOLEAN NOT NULL DEFAULT false,
    dispensed_at    TIMESTAMPTZ,
    dispensed_by    INTEGER REFERENCES users(user_id)
);

-- 17. PASSWORD RESET REQUESTS
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(user_id),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    status              reset_status NOT NULL DEFAULT 'pending',
    approved_by         INTEGER REFERENCES users(user_id),
    temp_password_hash  VARCHAR(255),
    approved_at         TIMESTAMPTZ
);

-- 18. DOCTOR TRANSFER LOG
CREATE TABLE IF NOT EXISTS doctor_transfers (
    id                      SERIAL PRIMARY KEY,
    from_doctor_id          INTEGER NOT NULL REFERENCES doctors(doctor_id),
    to_doctor_id            INTEGER NOT NULL REFERENCES doctors(doctor_id),
    appointments_moved      INTEGER DEFAULT 0,
    active_treatments_moved INTEGER DEFAULT 0,
    followups_moved         INTEGER DEFAULT 0,
    performed_by            INTEGER NOT NULL REFERENCES users(user_id),
    performed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. ROLES & PERMISSIONS MATRIX
CREATE TABLE IF NOT EXISTS role_permissions_matrix (
    id          SERIAL PRIMARY KEY,
    role        user_role NOT NULL,
    module      VARCHAR(100) NOT NULL,
    access_level VARCHAR(30) NOT NULL DEFAULT 'none',
    UNIQUE (role, module)
);

-- 20. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(user_id),
    role            user_role,
    action          VARCHAR(100) NOT NULL,
    module          VARCHAR(100) NOT NULL,
    record_id       VARCHAR(50),
    old_value       JSONB,
    new_value       JSONB,
    ip_address      VARCHAR(50),
    device          VARCHAR(150),
    browser         VARCHAR(150),
    branch_id       INTEGER DEFAULT 1 REFERENCES branches(branch_id),
    remarks         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 21. LOGIN LOGS
CREATE TABLE IF NOT EXISTS login_logs (
    id                 BIGSERIAL PRIMARY KEY,
    user_id            INTEGER NOT NULL REFERENCES users(user_id),
    role               user_role NOT NULL,
    login_time         TIMESTAMPTZ NOT NULL DEFAULT now(),
    logout_time        TIMESTAMPTZ,
    session_duration_seconds INTEGER,
    ip_address         VARCHAR(50),
    device             VARCHAR(150),
    browser            VARCHAR(150),
    location           VARCHAR(150),
    status             VARCHAR(30) NOT NULL DEFAULT 'success'
);

-- 22. HOSPITAL SETTINGS
CREATE TABLE IF NOT EXISTS hospital_settings (
    id            SERIAL PRIMARY KEY,
    setting_key   VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 23. COUPONS
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

-- 24. COUPON REDEMPTIONS
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_patients_mobile ON patients(mobile_number);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_bills_patient ON bills(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_executive ON leads(executive_id);
CREATE INDEX IF NOT EXISTS idx_stock_medicine ON medicine_stock(medicine_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_coupons_referring_patient ON coupons(referring_patient_id);
CREATE INDEX IF NOT EXISTS idx_coupons_referred_patient ON coupons(referred_patient_id);
CREATE INDEX IF NOT EXISTS idx_coupons_validity ON coupons(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_coupons_referring_created ON coupons(referring_patient_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_patient_id ON coupon_redemptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_bill_id ON coupon_redemptions(bill_id);

-- BILLS COUPON LINK
ALTER TABLE bills ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bills_coupon_id ON bills(coupon_id);

-- PRO BILLING: TREATMENT PLAN BILLING STATUS TRACKING
-- billing_status: awaiting_billing | billed
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS billing_status VARCHAR(30) NOT NULL DEFAULT 'awaiting_billing';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS billed_in_bill_id INTEGER REFERENCES bills(bill_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_treatment_plans_billing_status ON treatment_plans(billing_status);

-- PRO BILLING: BILL ITEMS TRACEABILITY — link each item back to its source treatment plan
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS treatment_plan_id INTEGER REFERENCES treatment_plans(treatment_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bill_items_treatment_plan ON bill_items(treatment_plan_id);
