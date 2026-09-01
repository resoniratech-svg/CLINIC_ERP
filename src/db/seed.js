const db = require('./index');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Seeding database...');

  // Ensure default branch
  await db.query(`
    INSERT INTO branches (branch_id, branch_name, branch_code, address, phone_number, status)
    VALUES (1, 'Hyderabad Main Branch', 'HYD001', 'Hyderabad, Telangana', '9876543210', 'active')
    ON CONFLICT (branch_code) DO NOTHING;
  `);

  // Seed Super Admin
  const passHash = await bcrypt.hash('SuperAdmin@123', 10);
  await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'EMP000', 'Super Admin', '9999999999', 'admin@hospital.com', 'male', 'admin', $1, 'super_admin', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active';
  `, [passHash]);

  // Seed Default Receptionist User
  const recPassHash = await bcrypt.hash('Password@123', 10);
  const recUserRes = await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'REC001', 'Rita Receptionist', '9888877771', 'receptionist@hospital.com', 'female', 'rita_rec', $1, 'receptionist', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active'
    RETURNING user_id;
  `, [recPassHash]);

  if (recUserRes.rows.length > 0) {
    const recUserId = recUserRes.rows[0].user_id;
    await db.query(`
      INSERT INTO receptionist_permissions (
        user_id, registration, enquiry, appointment, checkin, consultation_fee_billing,
        payment_collection, crm_calling, followup, renewal, due_management
      ) VALUES ($1, true, true, true, true, true, true, true, true, true, true)
      ON CONFLICT (user_id) DO NOTHING;
    `, [recUserId]);
  }

  // Master Lead Sources
  const leadSources = ['Inbound Call', 'Outbound Campaign', 'Walk-in', 'Website', 'Referral', 'Employee Referral', 'Patient Referral'];
  for (const ls of leadSources) {
    await db.query(`INSERT INTO master_lead_sources (name) VALUES ($1) ON CONFLICT DO NOTHING`, [ls]);
  }

  // Master Referral Sources
  const refSources = ['Doctor Referral', 'Employee Referral', 'Patient Referral', 'External Clinic'];
  for (const rs of refSources) {
    await db.query(`INSERT INTO master_referral_sources (name) VALUES ($1) ON CONFLICT DO NOTHING`, [rs]);
  }

  // Master Departments
  const depts = ['General Medicine', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Call Center', 'Pharmacy', 'Accounts'];
  for (const d of depts) {
    await db.query(`INSERT INTO master_departments (name) VALUES ($1) ON CONFLICT DO NOTHING`, [d]);
  }

  // Master Specializations
  const specs = ['Cardiologist', 'Orthopedist', 'General Physician', 'Pediatrician', 'Dermatologist'];
  for (const s of specs) {
    await db.query(`INSERT INTO master_specializations (name) VALUES ($1) ON CONFLICT DO NOTHING`, [s]);
  }

  // Master Charge Types
  const charges = ['Consultation', 'Lab Test', 'X-Ray', 'Procedure', 'Treatment', 'Nursing'];
  for (const c of charges) {
    await db.query(`INSERT INTO master_charge_types (name) VALUES ($1) ON CONFLICT DO NOTHING`, [c]);
  }

  // Master Expense Categories
  const expCats = ['Medical Supplies', 'Utilities', 'Maintenance', 'Staff Tea/Snacks', 'Office Stationery'];
  for (const ec of expCats) {
    await db.query(`INSERT INTO master_expense_categories (name) VALUES ($1) ON CONFLICT DO NOTHING`, [ec]);
  }

  // Master Discount Rules
  await db.query(`
    INSERT INTO master_discount_rules (name, max_discount_pct, approver_role)
    VALUES ('Standard Manager Discount', 20.00, 'pro_manager')
    ON CONFLICT DO NOTHING;
  `);

  // Default Hospital Settings
  const defaultSettings = [
    ['hospital_name', 'Hyderabad City Hospital'],
    ['hospital_logo', '/assets/logo.png'],
    ['hospital_phone', '040-12345678'],
    ['hospital_email', 'contact@cityhospital.com'],
    ['hospital_address', 'Main Road, Hyderabad'],
    ['appointment_slot_duration', '15'],
    ['registration_prefix', 'REG-'],
    ['invoice_prefix', 'INV-'],
    ['receipt_prefix', 'RCT-'],
    ['executive_incentive_trigger', 'created'],
    ['registration_validity_days', '30']
  ];
  for (const [k, v] of defaultSettings) {
    await db.query(`
      INSERT INTO hospital_settings (setting_key, setting_value)
      VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2;
    `, [k, v]);
  }

  // Role Permissions Matrix Defaults
  const matrix = [
    ['super_admin', 'All', 'full'],
    ['receptionist', 'Registration', 'full'],
    ['receptionist', 'Appointment', 'full'],
    ['receptionist', 'Billing', 'partial'],
    ['receptionist', 'CRM', 'full'],
    ['doctor', 'Consultation', 'full'],
    ['doctor', 'Prescription', 'full'],
    ['pro_manager', 'Billing', 'full'],
    ['pro_manager', 'Payment', 'full'],
    ['pro_manager', 'CRM', 'full'],
    ['executive', 'Call Center', 'full'],
    ['executive', 'Leads', 'full'],
    ['pharmacy', 'Inventory', 'full'],
    ['pharmacy', 'Dispensing', 'full']
  ];

  for (const [r, m, a] of matrix) {
    await db.query(`
      INSERT INTO role_permissions_matrix (role, module, access_level)
      VALUES ($1, $2, $3)
      ON CONFLICT (role, module) DO UPDATE SET access_level = $3;
    `, [r, m, a]);
  }

  console.log('Database seeded successfully.');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}

module.exports = seed;
