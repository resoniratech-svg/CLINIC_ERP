-- Package + Prescription Integration Migration
-- Links packages and prescriptions bidirectionally and ensures pharmacy fulfillment

-- 1. Add prescription_id to packages table
ALTER TABLE packages ADD COLUMN IF NOT EXISTS prescription_id INTEGER REFERENCES prescriptions(id);
CREATE INDEX IF NOT EXISTS idx_packages_prescription_id ON packages(prescription_id);

-- 2. Add package_id, created_by, branch_id to prescriptions table
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS package_id INTEGER REFERENCES packages(package_id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(user_id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(branch_id) DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_prescriptions_package_id ON prescriptions(package_id);

-- 3. Relax doctor_id in prescriptions so packages can be enrolled directly by authorized PRO Managers
ALTER TABLE prescriptions ALTER COLUMN doctor_id DROP NOT NULL;
