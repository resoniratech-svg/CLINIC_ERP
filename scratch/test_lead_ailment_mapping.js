import request from 'supertest';
import app from '/Users/resoniratechnologies/Downloads/CLINIC_ERP_BACKEND/src/app.js';
import db from '/Users/resoniratechnologies/Downloads/CLINIC_ERP_BACKEND/src/db/index.js';

async function runVerification() {
  try {
    console.log('--- Starting End-to-End Verification of Lead -> Receptionist Ailment Mapping ---');

    // 1. Authenticate Executive & Receptionist
    const execLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'eric_exec', password: 'Password@123' });
    const execToken = execLogin.body?.data?.token;
    if (!execToken) throw new Error('Failed to login as eric_exec');

    const recLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'rita_rec', password: 'Password@123' });
    const recToken = recLogin.body?.data?.token;
    if (!recToken) throw new Error('Failed to login as rita_rec');

    const docRes = await db.query(`SELECT doctor_id FROM doctors WHERE status = 'active' LIMIT 1`);
    const doctorId = docRes.rows[0].doctor_id;

    // Test 1: Inbound Lead with requirement "fever"
    console.log('\n[Test 1] Executive creates Inbound Lead with requirement="fever"...');
    const testMob1 = '9' + Date.now().toString().slice(-9);
    const leadRes = await request(app)
      .post('/api/v1/executive/leads')
      .set('Authorization', `Bearer ${execToken}`)
      .send({
        lead_name: 'Fever Patient Test',
        mobile_number: testMob1,
        age: 28,
        gender: 'female',
        village: 'Kondapur',
        requirement: 'fever',
        lead_source: 'inbound',
        remarks: 'Patient called reporting high fever'
      });

    if (leadRes.status !== 201) {
      throw new Error(`Failed to create lead: ${JSON.stringify(leadRes.body)}`);
    }

    const createdLead = leadRes.body.data.lead;
    console.log('Lead created:', {
      lead_id: createdLead.lead_id,
      lead_name: createdLead.lead_name,
      requirement: createdLead.requirement,
      source: createdLead.source,
      lead_source: createdLead.lead_source
    });

    if (createdLead.requirement !== 'fever') {
      throw new Error(`Expected createdLead.requirement to be 'fever', got: '${createdLead.requirement}'`);
    }
    if (createdLead.source !== 'Inbound Call') {
      throw new Error(`Expected createdLead.source to be 'Inbound Call', got: '${createdLead.source}'`);
    }

    // Verify directly in Postgres
    const dbLead = await db.query(`SELECT * FROM leads WHERE lead_id = $1`, [createdLead.lead_id]);
    console.log('Postgres leads row verification:', {
      requirement: dbLead.rows[0].requirement,
      source: dbLead.rows[0].source,
      remarks: dbLead.rows[0].remarks
    });
    if (dbLead.rows[0].requirement !== 'fever') {
      throw new Error(`Postgres requirement mismatch: ${dbLead.rows[0].requirement}`);
    }

    // Test 2: Receptionist Executive Leads Queue
    console.log('\n[Test 2] Receptionist queries Executive Leads Queue...');
    const qRes = await request(app)
      .get('/api/v1/receptionist/leads?status=new')
      .set('Authorization', `Bearer ${recToken}`);

    if (qRes.status !== 200) {
      throw new Error(`Failed to fetch leads queue: ${JSON.stringify(qRes.body)}`);
    }

    const queueLead = qRes.body.data.find(l => l.lead_id === createdLead.lead_id);
    if (!queueLead) throw new Error('Lead not found in receptionist queue');
    console.log('Queue Lead data:', {
      lead_id: queueLead.lead_id,
      lead_name: queueLead.lead_name,
      requirement: queueLead.requirement,
      source: queueLead.source
    });

    if (queueLead.requirement !== 'fever') {
      throw new Error(`Expected queueLead.requirement to be 'fever', got '${queueLead.requirement}'`);
    }

    // Test 3: Receptionist registers patient from this lead
    console.log('\n[Test 3] Receptionist registers patient with requirement="fever"...');
    const regRes = await request(app)
      .post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${recToken}`)
      .send({
        mobile_number: testMob1,
        full_name: 'Fever Patient Test',
        age: 28,
        gender: 'female',
        village_mandal: 'Kondapur',
        ailment_reason: 'fever',
        lead_source: 'executive_lead',
        source: 'Call Center Executive Lead',
        lead_id: createdLead.lead_id,
        assigned_doctor_id: doctorId,
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '11:00:00',
        appointment_type: 'new',
        payment_method: 'cash',
        payment_amount: 500
      });

    if (regRes.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
    }

    const regData = regRes.body.data;
    console.log('Registration successful:', {
      patient_id: regData.patient.patient_id,
      ailment_reason: regData.patient.ailment_reason,
      source: regData.patient.source,
      registration_id: regData.patient.registration_id
    });

    if (regData.patient.ailment_reason !== 'fever') {
      throw new Error(`Expected patient.ailment_reason to be 'fever', got '${regData.patient.ailment_reason}'`);
    }
    if (regData.patient.source !== 'Call Center Executive Lead') {
      throw new Error(`Expected patient.source to be 'Call Center Executive Lead', got '${regData.patient.source}'`);
    }

    // Verify patient in Postgres
    const dbPat = await db.query(`SELECT patient_id, full_name, ailment_reason, source FROM patients WHERE patient_id = $1`, [regData.patient.patient_id]);
    console.log('Postgres patient row:', dbPat.rows[0]);
    if (dbPat.rows[0].ailment_reason !== 'fever') {
      throw new Error(`Postgres patient.ailment_reason mismatch: ${dbPat.rows[0].ailment_reason}`);
    }

    // Verify lead status updated to converted in Postgres
    const convertedLead = await db.query(`SELECT lead_id, status, patient_id FROM leads WHERE lead_id = $1`, [createdLead.lead_id]);
    console.log('Converted lead row:', convertedLead.rows[0]);
    if (convertedLead.rows[0].status !== 'converted') {
      throw new Error(`Expected lead status to be converted, got: ${convertedLead.rows[0].status}`);
    }

    // Test 4: Safeguard against accidental "Inbound Call" as ailment_reason
    console.log('\n[Test 4] Testing safeguard when ailment_reason erroneously contains channel name "Inbound Call"...');
    const testMob2 = '9' + (Date.now() + 100).toString().slice(-9);
    const lead2Res = await request(app)
      .post('/api/v1/executive/leads')
      .set('Authorization', `Bearer ${execToken}`)
      .send({
        lead_name: 'Joint Pain Patient',
        mobile_number: testMob2,
        age: 45,
        gender: 'male',
        requirement: 'Knee Joint Pain',
        lead_source: 'inbound',
        remarks: 'Needs ortho consultation'
      });
    const lead2Id = lead2Res.body.data.lead.lead_id;

    // Simulate old buggy frontend sending "Inbound Call" as ailment_reason
    const reg2Res = await request(app)
      .post('/api/v1/receptionist/patients/register')
      .set('Authorization', `Bearer ${recToken}`)
      .send({
        mobile_number: testMob2,
        full_name: 'Joint Pain Patient',
        age: 45,
        gender: 'male',
        ailment_reason: 'Inbound Call', // Buggy channel name!
        lead_source: 'executive_lead',
        lead_id: lead2Id,
        assigned_doctor_id: doctorId,
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '11:30:00',
        appointment_type: 'new',
        payment_method: 'cash',
        payment_amount: 500
      });

    if (reg2Res.status !== 201) throw new Error(`Reg 2 failed: ${JSON.stringify(reg2Res.body)}`);
    console.log('Safeguard resolved patient:', {
      ailment_reason: reg2Res.body.data.patient.ailment_reason,
      source: reg2Res.body.data.patient.source
    });
    if (reg2Res.body.data.patient.ailment_reason !== 'Knee Joint Pain') {
      throw new Error(`Expected safeguard to resolve 'Knee Joint Pain', got: '${reg2Res.body.data.patient.ailment_reason}'`);
    }

    // Test 5: Outbound Call Outcome preserves problem as requirement
    console.log('\n[Test 5] Testing Outbound call outcome lead generation with problem...');
    const testMob3 = '9' + (Date.now() + 200).toString().slice(-9);
    const obLead = await db.query(`
      INSERT INTO outbound_leads (patient_name, mobile_number, problem, source, campaign, status, branch_id)
      VALUES ($1, $2, $3, 'Outbound Excel', 'Camp Outreach', 'new', 1)
      RETURNING *
    `, ['Migraine Patient', testMob3, 'Severe Migraine Headache']);

    const callRes = await request(app)
      .post('/api/v1/executive/calls/outcome')
      .set('Authorization', `Bearer ${execToken}`)
      .send({
        outbound_lead_id: obLead.rows[0].id,
        patient_name: 'Migraine Patient',
        mobile_number: testMob3,
        interaction_type: 'outbound',
        call_status: 'interested',
        remarks: 'Agreed to visit clinic'
      });

    if (callRes.status !== 201) throw new Error(`Call outcome failed: ${JSON.stringify(callRes.body)}`);
    const obCreatedLead = callRes.body.data.created_lead;
    console.log('Outbound interested lead created:', {
      lead_id: obCreatedLead.lead_id,
      requirement: obCreatedLead.requirement,
      source: obCreatedLead.source
    });

    if (obCreatedLead.requirement !== 'Severe Migraine Headache') {
      throw new Error(`Expected outbound lead requirement 'Severe Migraine Headache', got: '${obCreatedLead.requirement}'`);
    }
    if (obCreatedLead.source !== 'Outbound Call') {
      throw new Error(`Expected outbound lead source 'Outbound Call', got: '${obCreatedLead.source}'`);
    }

    console.log('\n======================================================');
    console.log(' ALL TESTS PASSED! Lead -> Receptionist pipeline verified 100%');
    console.log('======================================================');

    process.exit(0);
  } catch (err) {
    console.error('Verification failed with error:', err);
    process.exit(1);
  }
}

runVerification();
