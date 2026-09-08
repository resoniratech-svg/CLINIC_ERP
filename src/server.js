const app = require('./app');
const db = require('./db');
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await db.query("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'deleted'");
    console.log("Database initialized: user_status enum verified");
  } catch (err) {
    console.warn("Database initialization notice:", err.message);
  }

  app.listen(PORT, () => {
    console.log(`Hospital ERP Backend running on port ${PORT}`);
  });
}

bootstrap();
