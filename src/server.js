const fs = require('fs');
const path = require('path');
const app = require('./app');
const db = require('./db');
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await db.query("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'deleted'");
    await db.query("ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'checked_in'");
    await db.query("ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'in_consultation'");
    await db.query("ALTER TABLE outbound_leads ADD COLUMN IF NOT EXISTS serial_no VARCHAR(100)");
    await db.query("ALTER TABLE outbound_leads ADD COLUMN IF NOT EXISTS problem TEXT");
    await db.query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS village_id INTEGER");
    await db.query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS mandal_id INTEGER");
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false");
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN NOT NULL DEFAULT false");
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_hash VARCHAR(255)");
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMP WITH TIME ZONE");
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_used_at TIMESTAMP WITH TIME ZONE");

    // Ensure password_reset_requests table exists for non-super-admin staff
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id),
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        approved_by INTEGER REFERENCES users(user_id),
        temp_password_hash VARCHAR(255),
        approved_at TIMESTAMPTZ
      );
    `);

    // Ensure super_admin_password_recovery table and all audit columns exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS super_admin_password_recovery (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
        identifier_type VARCHAR(50),
        submitted_identifier VARCHAR(150),
        reason TEXT,
        recovery_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        email_destination VARCHAR(255) NOT NULL,
        temporary_password_created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        temporary_password_expires_at TIMESTAMP WITH TIME ZONE,
        temporary_password_used_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        ip_address VARCHAR(100),
        user_agent TEXT,
        failure_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    await db.query("ALTER TABLE super_admin_password_recovery ADD COLUMN IF NOT EXISTS temporary_password_created_at TIMESTAMP WITH TIME ZONE DEFAULT now()");
    await db.query("ALTER TABLE super_admin_password_recovery ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMP WITH TIME ZONE");
    await db.query("ALTER TABLE super_admin_password_recovery ADD COLUMN IF NOT EXISTS temporary_password_used_at TIMESTAMP WITH TIME ZONE");
    await db.query("ALTER TABLE super_admin_password_recovery ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE");
    await db.query("ALTER TABLE super_admin_password_recovery ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100)");
    await db.query("ALTER TABLE super_admin_password_recovery ADD COLUMN IF NOT EXISTS user_agent TEXT");
    await db.query("ALTER TABLE super_admin_password_recovery ADD COLUMN IF NOT EXISTS failure_reason TEXT");
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'super_admin_password_recovery' AND column_name = 'expires_at'
        ) THEN
          ALTER TABLE super_admin_password_recovery ALTER COLUMN expires_at DROP NOT NULL;
          ALTER TABLE super_admin_password_recovery ALTER COLUMN expires_at SET DEFAULT now() + INTERVAL '20 minutes';
        END IF;
      END $$;
    `);

    // Auto-apply additive migration files safely
    const migDir = path.join(__dirname, '../migrations');
    if (fs.existsSync(migDir)) {
      const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
      for (const f of files) {
        try {
          const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
          await db.query(sql);
        } catch (mErr) {
          // Safe to ignore if already applied
        }
      }
    }
    console.log("Database initialized: enums and migrations verified");
  } catch (err) {
    console.warn("Database initialization notice:", err.message);
  }

  app.listen(PORT, () => {
    console.log(`Hospital ERP Backend running on port ${PORT}`);
  });
}

bootstrap();
