const fs = require('fs');
const path = require('path');
const db = require('./index');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Checking and initializing database schema...');
  const schemaPath = path.join(__dirname, '../../schema.sql');
  if (fs.existsSync(schemaPath)) {
    console.log('Applying schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSql);
    console.log('Schema applied successfully.');
  }

  console.log('Seeding database...');

  // Ensure default branch
  await db.query(`
    INSERT INTO branches (branch_id, branch_name, branch_code, address, phone_number, status)
    VALUES (1, 'Hyderabad Main Branch', 'HYD001', 'Hyderabad, Telangana', '9876543210', 'active')
    ON CONFLICT (branch_id) DO NOTHING;
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

  // Seed Default PRO / Manager User (pat_pro / Password@123)
  const proPassHash = await bcrypt.hash('Password@123', 10);
  const proUserRes = await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'PRO001', 'Patrick PRO Manager', '9888877773', 'pro@hospital.com', 'male', 'pat_pro', $1, 'pro_manager', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active'
    RETURNING user_id;
  `, [proPassHash]);

  if (proUserRes.rows.length > 0) {
    const proUserId = proUserRes.rows[0].user_id;
    await db.query(`
      INSERT INTO pro_manager_permissions (
        user_id, counselling, billing, payment, due_collection, crm, followup, renewals, complaints, feedback, reports, accountant
      ) VALUES ($1, true, true, true, true, true, true, true, true, true, true, true)
      ON CONFLICT (user_id) DO NOTHING;
    `, [proUserId]);
  }

  // Seed Default Executive User (eric_exec / Password@123)
  const execPassHash = await bcrypt.hash('Password@123', 10);
  await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'EXE001', 'Eric Executive', '9888877774', 'exec@hospital.com', 'male', 'eric_exec', $1, 'executive', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active';
  `, [execPassHash]);

  // Seed Default Pharmacy User (peter_pharmacy / Password@123)
  const phaPassHash = await bcrypt.hash('Password@123', 10);
  const phaUserRes = await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'PHA001', 'Peter Pharmacy Manager', '9888877775', 'pharmacy@hospital.com', 'male', 'peter_pharmacy', $1, 'pharmacy', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active'
    RETURNING user_id;
  `, [phaPassHash]);

  if (phaUserRes.rows.length > 0) {
    const phaUserId = phaUserRes.rows[0].user_id;
    await db.query(`
      INSERT INTO pharmacy_permissions (
        user_id, prescription_queue, dispensing, inventory, stock, batch, expiry, returns, stock_adjustment, stock_transactions
      ) VALUES ($1, true, true, true, true, true, true, true, true, true)
      ON CONFLICT (user_id) DO NOTHING;
    `, [phaUserId]);
  }

  // Seed Default Doctor User (dr_smith / Password@123)
  const docPassHash = await bcrypt.hash('Password@123', 10);
  const docUserRes = await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'DOC_SMITH_001', 'Dr. John Smith', '9888877772', 'drsmith@hospital.com', 'male', 'dr_smith', $1, 'doctor', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active'
    RETURNING user_id;
  `, [docPassHash]);

  let docUserId = null;
  if (docUserRes.rows.length > 0) {
    docUserId = docUserRes.rows[0].user_id;
  } else {
    const existingDocUser = await db.query(`SELECT user_id FROM users WHERE username = 'dr_smith'`);
    docUserId = existingDocUser.rows[0].user_id;
  }

  await db.query(`
    INSERT INTO doctors (
      user_id, doctor_code, qualification, specialization, medical_registration_number,
      new_consultation_fee, renewal_consultation_fee, status, branch_id
    ) VALUES (
      $1, 'DOC_SMITH_001', 'MBBS, MD', 'Cardiology', 'REG-CARD-12345',
      500.00, 300.00, 'active', 1
    ) ON CONFLICT (user_id) DO UPDATE SET status = 'active';
  `, [docUserId]);

  // Seed Second Receptionist User (rachel_rec / Password@123)
  const rec2Res = await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'REC002', 'Rachel Receptionist', '9888877791', 'receptionist2@hospital.com', 'female', 'rachel_rec', $1, 'receptionist', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active'
    RETURNING user_id;
  `, [recPassHash]);
  if (rec2Res.rows.length > 0) {
    await db.query(`
      INSERT INTO receptionist_permissions (
        user_id, registration, enquiry, appointment, checkin, consultation_fee_billing,
        payment_collection, crm_calling, followup, renewal, due_management
      ) VALUES ($1, true, true, true, true, true, true, true, true, true, true)
      ON CONFLICT (user_id) DO NOTHING;
    `, [rec2Res.rows[0].user_id]);
  }

  // Seed Second PRO / Manager User (pam_pro / Password@123)
  const pro2Res = await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'PRO002', 'Pamela PRO Manager', '9888877793', 'pro2@hospital.com', 'female', 'pam_pro', $1, 'pro_manager', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active'
    RETURNING user_id;
  `, [proPassHash]);
  if (pro2Res.rows.length > 0) {
    await db.query(`
      INSERT INTO pro_manager_permissions (
        user_id, counselling, billing, payment, due_collection, crm, followup, renewals, complaints, feedback, reports, accountant
      ) VALUES ($1, true, true, true, true, true, true, true, true, true, true, true)
      ON CONFLICT (user_id) DO NOTHING;
    `, [pro2Res.rows[0].user_id]);
  }

  // Seed Second Executive User (edward_exec / Password@123)
  await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'EXE002', 'Edward Executive', '9888877794', 'exec2@hospital.com', 'male', 'edward_exec', $1, 'executive', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active';
  `, [execPassHash]);

  // Seed Second Pharmacy User (paul_pharmacy / Password@123)
  const pha2Res = await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'PHA002', 'Paul Pharmacy Manager', '9888877795', 'pharmacy2@hospital.com', 'male', 'paul_pharmacy', $1, 'pharmacy', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active'
    RETURNING user_id;
  `, [phaPassHash]);
  if (pha2Res.rows.length > 0) {
    await db.query(`
      INSERT INTO pharmacy_permissions (
        user_id, prescription_queue, dispensing, inventory, stock, batch, expiry, returns, stock_adjustment, stock_transactions
      ) VALUES ($1, true, true, true, true, true, true, true, true, true)
      ON CONFLICT (user_id) DO NOTHING;
    `, [pha2Res.rows[0].user_id]);
  }

  // Seed Second Doctor User (dr_jones / Password@123)
  const doc2UserRes = await db.query(`
    INSERT INTO users (
      employee_id, full_name, mobile_number, email, gender, username, password_hash, role, status, branch_id
    ) VALUES (
      'DOC_JONES_002', 'Dr. Sarah Jones', '9888877792', 'drjones@hospital.com', 'female', 'dr_jones', $1, 'doctor', 'active', 1
    ) ON CONFLICT (username) DO UPDATE SET password_hash = $1, status = 'active'
    RETURNING user_id;
  `, [docPassHash]);

  let doc2UserId = doc2UserRes.rows.length > 0 ? doc2UserRes.rows[0].user_id : (await db.query(`SELECT user_id FROM users WHERE username = 'dr_jones'`)).rows[0].user_id;

  await db.query(`
    INSERT INTO doctors (
      user_id, doctor_code, qualification, specialization, medical_registration_number,
      new_consultation_fee, renewal_consultation_fee, status, branch_id
    ) VALUES (
      $1, 'DOC_JONES_002', 'MBBS, MS', 'Orthopedics', 'REG-ORTHO-67890',
      700.00, 400.00, 'active', 1
    ) ON CONFLICT (user_id) DO UPDATE SET status = 'active';
  `, [doc2UserId]);

  const doc2Res = await db.query(`SELECT doctor_id FROM doctors WHERE user_id = $1`, [doc2UserId]);
  if (doc2Res.rows.length > 0) {
    const doc2Id = doc2Res.rows[0].doctor_id;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    await db.query(`
      INSERT INTO doctor_targets (
        doctor_id, month, year, revenue_target, unit_target, referral_target
      ) VALUES (
        $1, $2, $3, 250000.00, 350000.00, 40
      ) ON CONFLICT (doctor_id, month, year) DO NOTHING;
    `, [doc2Id, month, year]);
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

  // Default Medicine Master (ID 1)
  await db.query(`
    INSERT INTO medicine_master (id, medicine_name, generic_name, medicine_type, strength, unit, category, status)
    VALUES (1, 'Paracetamol 500mg', 'Paracetamol', 'tablet', '500 mg', 'pcs', 'General', 'active')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Default Patient (ID 1)
  await db.query(`
    INSERT INTO patients (patient_id, full_name, mobile_number, age, gender, address, branch_id)
    VALUES (1, 'Default Patient', '9999999901', 30, 'male', 'Hyderabad', 1)
    ON CONFLICT (patient_id) DO NOTHING;
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
    ['registration_validity_days', '30'],
    ['pharmacy_expiry_alert_days', '30'],
    ['pharmacy_adjustment_approval_threshold', '10'],
    ['pharmacy_return_policy', 'good_condition_only']
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

  // Default Demo Prescription & Stock (ID 1) for Postman & Integration Testing
  await db.query(`
    INSERT INTO medicine_stock (id, medicine_id, batch_number, manufacture_date, expiry_date, quantity, purchase_rate, mrp, supplier, branch_id)
    VALUES (1, 1, 'BATCH-P500-01', '2026-01-01', '2027-12-31', 100, 4.00, 10.00, 'City Pharma', 1)
    ON CONFLICT (id) DO NOTHING;
  `);

  const docQueryRes = await db.query(`SELECT doctor_id FROM doctors LIMIT 1`);
  const docId = docQueryRes.rows.length > 0 ? docQueryRes.rows[0].doctor_id : 1;

  await db.query(`
    INSERT INTO appointments (appointment_id, patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, branch_id)
    VALUES (1, 1, $1, CURRENT_DATE, '10:00', 'new', 'pro_completed', 1)
    ON CONFLICT (appointment_id) DO NOTHING;
  `, [docId]);

  await db.query(`
    INSERT INTO consultations (consultation_id, appointment_id, patient_id, doctor_id, chief_complaint, primary_diagnosis_text, status, branch_id)
    VALUES (1, 1, 1, $1, 'Fever and Body Pain', 'Viral Infection', 'completed', 1)
    ON CONFLICT (consultation_id) DO NOTHING;
  `, [docId]);

  await db.query(`
    INSERT INTO prescriptions (id, consultation_id, patient_id, doctor_id, appointment_id, pharmacy_status)
    VALUES (1, 1, 1, $1, 1, 'pending')
    ON CONFLICT (id) DO NOTHING;
  `, [docId]);

  await db.query(`
    INSERT INTO prescription_items (id, prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, timing, food_instruction, dispense_status)
    VALUES (1, 1, 1, '500 mg', '2/day', 'oral', 5, 10, 'morning & night', 'after food', 'pending')
    ON CONFLICT (id) DO NOTHING;
  `);

  await db.query(`
    INSERT INTO prescription_clarifications (id, prescription_id, prescription_item_id, patient_id, raised_by, issue_type, description, priority, status, branch_id)
    VALUES (1, 1, 1, 1, 1345, 'substitution_request', 'Paracetamol 500mg unavailable, requesting substitution', 'high', 'open', 1)
    ON CONFLICT (id) DO NOTHING;
  `);

  await db.query(`
    INSERT INTO stock_adjustments (id, stock_id, medicine_id, system_quantity, physical_quantity, difference, reason, requires_approval, approval_status, performed_by, branch_id)
    VALUES (1, 1, 1, 100, 80, -20, 'Physical audit count discrepancy', true, 'pending', 1345, 1)
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed Prescription 516 & Item 601 (Paracetamol 500mg) for PRO Review & Modification
  await db.query(`
    INSERT INTO prescriptions (id, consultation_id, patient_id, doctor_id, appointment_id, pharmacy_status)
    VALUES (516, 1, 1, $1, 1, 'pending')
    ON CONFLICT (id) DO NOTHING;
  `, [docId]);

  await db.query(`
    INSERT INTO prescription_items (id, prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity, timing, food_instruction, dispense_status)
    VALUES (601, 516, 1, '1 tab', '1 time/day', 'oral', 5, 5, 'morning', 'after food', 'pending')
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log('Database seeded successfully.');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}

module.exports = seed;
