const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('End-to-End 5-Patient Clinical Workflow: Receptionist -> Doctor -> PRO -> Pharmacy', () => {
  let adminToken, receptionistToken, doctorToken, proToken, pharmacyToken;
  let doctorId;

  const PATIENTS = [
    {
      name: 'Aarav Sharma',
      mobile: '98480' + Math.floor(10000 + Math.random() * 90000),
      time: '09:15',
      age: 32,
      gender: 'male',
      complaint: 'Chronic Allergic Rhinitis & Dust Allergy',
      diagnosis: 'Allergic Rhinitis',
      treatment_title: 'Constitutional Desensitization Protocol',
      treatment_type: 'Homeopathy',
      duration: 30,
      duration_unit: 'days',
      bill_amount: 2500,
      paid_amount: 2500,
      payment_mode: 'cash',
    },
    {
      name: 'Priya Patel',
      mobile: '98481' + Math.floor(10000 + Math.random() * 90000),
      time: '09:45',
      age: 28,
      gender: 'female',
      complaint: 'Migraine and Cervical Spondylosis',
      diagnosis: 'Cervical Spondylosis',
      treatment_title: 'Acupressure & Postural Alignment Therapy',
      treatment_type: 'Physiotherapy',
      duration: 14,
      duration_unit: 'days',
      bill_amount: 3000,
      paid_amount: 2000,
      payment_mode: 'upi',
    },
    {
      name: 'Rajesh Kumar',
      mobile: '98482' + Math.floor(10000 + Math.random() * 90000),
      time: '10:15',
      age: 45,
      gender: 'male',
      complaint: 'Acid Peptic Disease and Gastric Reflux',
      diagnosis: 'Gastroesophageal Reflux Disease (GERD)',
      treatment_title: 'Dietary & Lifestyle Modification Plan',
      treatment_type: 'Homeopathy',
      duration: 21,
      duration_unit: 'days',
      bill_amount: 1800,
      paid_amount: 1800,
      payment_mode: 'card',
    },
    {
      name: 'Sneha Reddy',
      mobile: '98483' + Math.floor(10000 + Math.random() * 90000),
      time: '10:45',
      age: 24,
      gender: 'female',
      complaint: 'Atopic Dermatitis and Eczema on Arms',
      diagnosis: 'Atopic Dermatitis',
      treatment_title: 'Topical Emollient & Skin Detox Regimen',
      treatment_type: 'Dermatology Care',
      duration: 30,
      duration_unit: 'days',
      bill_amount: 3500,
      paid_amount: 3500,
      payment_mode: 'upi',
    },
    {
      name: 'Vikram Malhotra',
      mobile: '98484' + Math.floor(10000 + Math.random() * 90000),
      time: '11:15',
      age: 52,
      gender: 'male',
      complaint: 'Osteoarthritis of Both Knees with Swelling',
      diagnosis: 'Bilateral Knee Osteoarthritis',
      treatment_title: 'Joint Mobilization & Pain Management',
      treatment_type: 'Physiotherapy',
      duration: 15,
      duration_unit: 'days',
      bill_amount: 4200,
      paid_amount: 3000,
      payment_mode: 'cash',
    },
  ];

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'SuperAdmin@123' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;

    // 2. Authenticate Receptionist, PRO, and Pharmacy
    const recRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rita_rec', password: 'Password@123' });
    expect(recRes.status).toBe(200);
    receptionistToken = recRes.body.data.token;

    const proRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pat_pro', password: 'Password@123' });
    expect(proRes.status).toBe(200);
    proToken = proRes.body.data.token;

    const phaRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'peter_pharmacy', password: 'Password@123' });
    expect(phaRes.status).toBe(200);
    pharmacyToken = phaRes.body.data.token;

    // 3. Create or find an active Doctor
    const docUser = 'dr_flow_' + Date.now();
    const docEmpId = 'DOC_FLOW_' + Date.now().toString().slice(-4);
    const newDocRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        role: 'doctor',
        employee_id: docEmpId,
        full_name: 'Dr. Flow Specialist',
        mobile_number: '98' + Date.now().toString().slice(-8),
        email: `drflow_${Date.now()}@wecare.hospital`,
        gender: 'female',
        username: docUser,
        password: 'Password@123',
        qualification: 'BHMS, MD (Hom)',
        specialization: 'General Medicine',
        medical_registration_number: 'MRN-' + Date.now().toString().slice(-6),
        new_consultation_fee: 500,
        renewal_consultation_fee: 300,
      });
    expect(newDocRes.status).toBe(201);

    const docLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: docUser, password: 'Password@123' });
    expect(docLogin.status).toBe(200);
    doctorToken = docLogin.body.data.token;

    const docDb = await db.query('SELECT doctor_id FROM doctors WHERE user_id = $1', [newDocRes.body.data.user_id]);
    doctorId = docDb.rows[0].doctor_id;

    // 4. Ensure stock exists for medicine ID 1 in branch 1
    await db.query(`
      INSERT INTO medicine_master (id, medicine_name, generic_name, medicine_type, strength, unit, category, status)
      VALUES (1, 'Paracetamol 500mg', 'Paracetamol', 'tablet', '500 mg', 'tablets', 'Analgesic', 'active')
      ON CONFLICT (id) DO UPDATE SET status = 'active';
      INSERT INTO medicine_stock (medicine_id, batch_number, manufacture_date, expiry_date, quantity, purchase_rate, mrp, supplier, branch_id)
      VALUES (1, 'BATCH-E2E-FLOW', '2026-01-01', '2028-12-31', 5000, 2.00, 5.00, 'WeCare Pharma Ltd', 1)
      ON CONFLICT DO NOTHING;
    `);
  });

  PATIENTS.forEach((ptData, index) => {
    describe(`Patient ${index + 1}: ${ptData.name} — Full Clinical Journey Verification`, () => {
      let patientId, appointmentId, consultationId, prescriptionId, billId;

      it(`1. Receptionist: Registers ${ptData.name}, books appointment with Doctor at ${ptData.time}, collects ₹500 fee, and checks in`, async () => {
        const regRes = await request(app)
          .post('/api/v1/receptionist/register-walkin')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({
            patient: {
              full_name: ptData.name,
              mobile_number: ptData.mobile,
              age: ptData.age,
              gender: ptData.gender,
              address: 'Karimnagar Main Road',
              village: 'Karimnagar',
              mandal: 'Karimnagar',
            },
            appointment: {
              doctor_id: doctorId,
              appointment_date: new Date().toISOString().split('T')[0],
              appointment_time: ptData.time,
              appointment_type: 'new',
            },
            billing: {
              amount: 500,
              discount: 0,
              payment_mode: ptData.payment_mode,
            },
          });

        expect(regRes.status).toBe(201);
        expect(regRes.body.success).toBe(true);
        patientId = regRes.body.data.patient_id || regRes.body.data.patient.patient_id;
        appointmentId = regRes.body.data.appointment.appointment_id;
        expect(patientId).toBeDefined();
        expect(appointmentId).toBeDefined();

        // Check-in
        const checkinRes = await request(app)
          .put(`/api/v1/receptionist/appointments/${appointmentId}/checkin`)
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({ status: 'checked_in' });
        expect(checkinRes.status).toBe(200);
      });

      it(`2. Doctor: Starts consultation, creates treatment plan "${ptData.treatment_title}", prescribes medicines, and completes consultation`, async () => {
        // Start consultation
        const startRes = await request(app)
          .post('/api/v1/doctor/consultations/start')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({ appointment_id: appointmentId });
        expect(startRes.status).toBe(201);
        consultationId = startRes.body.data.consultation_id;
        expect(consultationId).toBeDefined();

        // Create treatment plan while consultation is active
        const tpRes = await request(app)
          .post('/api/v1/doctor/treatment-plans')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({
            consultation_id: consultationId,
            treatment_name: ptData.treatment_title,
            treatment_type: ptData.treatment_type,
            duration: ptData.duration,
            duration_unit: ptData.duration_unit,
            start_date: new Date().toISOString().split('T')[0],
            instructions: `Doctor protocol for ${ptData.diagnosis}`,
          });
        expect(tpRes.status).toBe(201);
        expect(tpRes.body.data.treatment_name).toBe(ptData.treatment_title);

        // Complete consultation with clinical diagnosis, prescription, and pro_required flag
        const completeRes = await request(app)
          .post('/api/v1/doctor/consultations/complete')
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({
            consultation_id: consultationId,
            chief_complaint: ptData.complaint,
            primary_diagnosis_text: ptData.diagnosis,
            pro_instructions: `Counsel patient regarding ${ptData.treatment_title}`,
            pro_required: true,
            prescription_items: [
              { medicine_id: 1, dosage: '1 tab', frequency: '3 times/day', route: 'oral', duration_days: 7, quantity: 21 },
            ],
            followup_recommendation: {
              followup_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
              notes: 'Review clinical response',
            },
          });

        expect(completeRes.status).toBe(200);
        expect(completeRes.body.data.appointment_status).toBe('doctor_completed');

        // Fetch prescription ID
        const rxRes = await db.query('SELECT id FROM prescriptions WHERE consultation_id = $1', [consultationId]);
        expect(rxRes.rows.length).toBeGreaterThan(0);
        prescriptionId = rxRes.rows[0].id;
      });

      it(`3. PRO: Opens 360 overview for ${ptData.name}, verifies merged Prescriptions & Treatments data, bills treatment & medicines, and records payment`, async () => {
        // PRO loads Patient 360 overview (simulates frontend loading the merged tab)
        const ovRes = await request(app)
          .get(`/api/v1/pro/patients/${patientId}/overview`)
          .set('Authorization', `Bearer ${proToken}`);
        expect(ovRes.status).toBe(200);
        expect(ovRes.body.data.patient.patient_id).toBe(patientId);

        // Verify merged tab data: both prescription items and treatment plans are available together
        expect(ovRes.body.data.prescription.items.length).toBe(1);
        expect(ovRes.body.data.treatment_plans.length).toBe(1);
        expect(ovRes.body.data.treatment_plans[0].treatment_name).toBe(ptData.treatment_title);

        // PRO generates consolidated bill containing both treatment plan and medicines
        const billRes = await request(app)
          .post('/api/v1/pro/billing')
          .set('Authorization', `Bearer ${proToken}`)
          .send({
            patient_id: patientId,
            appointment_id: appointmentId,
            doctor_id: doctorId,
            bill_type: 'treatment',
            items: [
              { item_type: 'treatment', description: ptData.treatment_title, quantity: 1, unit_price: ptData.bill_amount - 105 },
              { item_type: 'medicine', description: 'Paracetamol 500mg (21 tabs)', quantity: 21, unit_price: 5 },
            ],
          });
        expect(billRes.status).toBe(201);
        billId = billRes.body.data.bill_id;
        expect(billId).toBeDefined();

        // PRO collects payment
        const payRes = await request(app)
          .post('/api/v1/pro/payments')
          .set('Authorization', `Bearer ${proToken}`)
          .send({
            bill_id: billId,
            patient_id: patientId,
            payments: [
              { payment_mode: ptData.payment_mode, amount: ptData.paid_amount },
            ],
          });
        expect(payRes.status).toBe(201);

        const dueBalance = ptData.bill_amount - ptData.paid_amount;
        if (dueBalance <= 0) {
          expect(payRes.body.data.bill.status).toBe('paid');
        } else {
          expect(payRes.body.data.bill.status).toBe('partial');
          expect(parseFloat(payRes.body.data.bill.due_amount)).toBe(dueBalance);
        }

        // PRO verifies checklist
        const chkRes = await request(app)
          .get(`/api/v1/pro/patients/${patientId}/checklist`)
          .set('Authorization', `Bearer ${proToken}`);
        expect(chkRes.status).toBe(200);
        expect(chkRes.body.data.checklist.doctor_consultation_completed).toBe(true);
        expect(chkRes.body.data.checklist.billing_completed).toBe(true);

        // PRO executes Complete PRO Handoff
        const handoffRes = await request(app)
          .post(`/api/v1/pro/patients/${patientId}/complete-pro`)
          .set('Authorization', `Bearer ${proToken}`)
          .send({ appointment_id: appointmentId });

        expect(handoffRes.status).toBe(200);
        expect(handoffRes.body.data.appointment.status).toBe('pro_completed');
      });

      it(`4. Pharmacy: Sees ${ptData.name}'s prescription in queue and completes dispensing successfully`, async () => {
        // Patient appears in Pharmacy Queue
        const queueRes = await request(app)
          .get('/api/v1/pharmacy/queue')
          .set('Authorization', `Bearer ${pharmacyToken}`);
        expect(queueRes.status).toBe(200);
        const queueItem = queueRes.body.data.find(q => q.prescription_id === prescriptionId || q.patient_id === patientId);
        expect(queueItem).toBeDefined();

        // Complete dispensing for this prescription
        const dispenseRes = await request(app)
          .post(`/api/v1/pharmacy/prescriptions/${prescriptionId}/dispense/complete`)
          .set('Authorization', `Bearer ${pharmacyToken}`)
          .send({});
        expect(dispenseRes.status).toBe(200);
        expect(dispenseRes.body.success).toBe(true);

        // Verify prescription status in DB is now 'dispensed'
        const rxCheck = await db.query('SELECT pharmacy_status FROM prescriptions WHERE id = $1', [prescriptionId]);
        expect(rxCheck.rows[0].pharmacy_status).toBe('dispensed');
      });
    });
  });
});
