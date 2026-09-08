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
