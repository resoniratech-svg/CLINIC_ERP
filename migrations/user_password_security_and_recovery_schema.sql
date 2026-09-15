-- Ensure user password security and recovery columns exist across all environments
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_used_at TIMESTAMP WITH TIME ZONE;

-- Create Super Admin recovery tracking table if not exists
CREATE TABLE IF NOT EXISTS super_admin_password_recovery (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
    identifier_type VARCHAR(50),
    submitted_identifier VARCHAR(150),
    reason TEXT,
    recovery_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    email_destination VARCHAR(255) NOT NULL,
    generated_token_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_rec_user_status ON super_admin_password_recovery(user_id, recovery_status);
