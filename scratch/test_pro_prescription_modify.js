import request from 'supertest';
import app from '/Users/resoniratechnologies/Downloads/CLINIC_ERP_BACKEND/src/app.js';
import db from '/Users/resoniratechnologies/Downloads/CLINIC_ERP_BACKEND/src/db/index.js';

async function verifyModifyFlow() {
  try {
    console.log('--- Starting Verification of PRO Prescription Modify Flow ---');

    // 1. Authenticate PRO Manager
    const proLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pat_pro', password: 'Password@123' });
    const proToken = proLogin.body?.data?.token;
    if (!proToken) throw new Error('Failed to login as pat_pro');

    // 2. Fetch Prescription #516
    console.log('\n[Test 1] Fetching Prescription #516...');
    const pRes = await request(app)
      .get('/api/v1/pro/prescriptions/516')
      .set('Authorization', `Bearer ${proToken}`);

    if (pRes.status !== 200) {
      throw new Error(`Failed to fetch prescription 516: ${JSON.stringify(pRes.body)}`);
    }

    const { prescription, items } = pRes.body.data;
    console.log('Prescription details loaded:', {
      id: prescription.id,
      patient_id: prescription.patient_id,
      patient_name: prescription.patient_name,
      doctor_name: prescription.doctor_name,
      pharmacy_status: prescription.pharmacy_status,
      items_count: items.length
    });

    if (!items || items.length === 0) throw new Error('No items found in prescription 516');
    const targetItem = items[0];
    console.log('Initial target item:', {
      id: targetItem.id,
      medicine_name: targetItem.medicine_name,
      dosage: targetItem.dosage,
      frequency: targetItem.frequency,
      duration_days: targetItem.duration_days,
      quantity: targetItem.quantity
    });

    // 3. Test Modify: change duration 5 -> 7 days
    console.log('\n[Test 2] Modifying duration from 5 to 7 days for item #', targetItem.id);
    const modRes = await request(app)
      .post(`/api/v1/pro/prescriptions/items/${targetItem.id}/modify`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        field_changed: 'duration',
        modified_value: 7,
        reason: 'Extended treatment duration to 7 days per clinical package review'
      });

    if (modRes.status !== 201) {
      throw new Error(`Modification failed: ${JSON.stringify(modRes.body)}`);
    }

    console.log('Modification response:', {
      status: modRes.status,
      message: modRes.body.message,
      calculated_quantity: modRes.body.data?.calculated_quantity,
      duration_days: modRes.body.data?.duration_days
    });

    // 4. Verify in PostgreSQL database directly
    console.log('\n[Test 3] Verifying live PostgreSQL database...');
    const dbItem = await db.query(`SELECT * FROM prescription_items WHERE id = $1`, [targetItem.id]);
    console.log('Postgres prescription_items updated row:', {
      id: dbItem.rows[0].id,
      duration_days: dbItem.rows[0].duration_days,
      quantity: dbItem.rows[0].quantity
    });

    if (dbItem.rows[0].duration_days !== 7) {
      throw new Error(`Expected duration_days to be 7, got ${dbItem.rows[0].duration_days}`);
    }
    if (dbItem.rows[0].quantity !== 7) {
      throw new Error(`Expected quantity to be 7, got ${dbItem.rows[0].quantity}`);
    }

    // 5. Verify audit trail in prescription_modifications
    console.log('\n[Test 4] Verifying Audit Trail in prescription_modifications...');
    const auditRes = await request(app)
      .get(`/api/v1/pro/prescriptions/items/${targetItem.id}/modifications`)
      .set('Authorization', `Bearer ${proToken}`);

    if (auditRes.status !== 200) throw new Error('Failed to fetch audit trail');
    console.log('Audit trail entries count:', auditRes.body.data.length);
    const latestAudit = auditRes.body.data[auditRes.body.data.length - 1];
    console.log('Latest audit record:', {
      field_changed: latestAudit.field_changed,
      original_value: latestAudit.original_value,
      modified_value: latestAudit.modified_value,
      modifier_role: latestAudit.modifier_role,
      reason: latestAudit.reason,
      status: latestAudit.status
    });

    if (latestAudit.modified_value !== '7') {
      throw new Error(`Expected modified_value '7', got ${latestAudit.modified_value}`);
    }

    // 6. Test invalid duration validation
    console.log('\n[Test 5] Testing validation against invalid inputs...');
    const invalidRes = await request(app)
      .post(`/api/v1/pro/prescriptions/items/${targetItem.id}/modify`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        field_changed: 'duration',
        modified_value: -10,
        reason: 'Invalid test'
      });
    if (invalidRes.status !== 400) {
      throw new Error(`Expected 400 for negative duration, got ${invalidRes.status}`);
    }
    console.log('Validation correctly rejected negative duration: 400 OK');

    const emptyReasonRes = await request(app)
      .post(`/api/v1/pro/prescriptions/items/${targetItem.id}/modify`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        field_changed: 'duration',
        modified_value: 10,
        reason: ''
      });
    if (emptyReasonRes.status !== 400) {
      throw new Error(`Expected 400 for empty reason, got ${emptyReasonRes.status}`);
    }
    console.log('Validation correctly rejected empty reason: 400 OK');

    // 7. Non-existent prescription
    const notFoundRes = await request(app)
      .get('/api/v1/pro/prescriptions/999999')
      .set('Authorization', `Bearer ${proToken}`);
    if (notFoundRes.status !== 404) {
      throw new Error(`Expected 404 for invalid prescription ID, got ${notFoundRes.status}`);
    }
    console.log('Invalid prescription returned 404: OK');

    // 8. Test multi-medicine calculation with different frequency (e.g. 2 times/day for 7 days -> 14 units)
    console.log('\n[Test 6] Testing frequency calculation logic...');
    // Update target item frequency to '2 times/day' temporarily
    await db.query(`UPDATE prescription_items SET frequency = '2 times/day' WHERE id = $1`, [targetItem.id]);
    const freqTestRes = await request(app)
      .post(`/api/v1/pro/prescriptions/items/${targetItem.id}/modify`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({
        field_changed: 'duration',
        modified_value: 7,
        reason: 'Testing 2 times/day frequency quantity multiplier'
      });
    const dbFreqItem = await db.query(`SELECT * FROM prescription_items WHERE id = $1`, [targetItem.id]);
    console.log('2 times/day for 7 days result:', {
      frequency: dbFreqItem.rows[0].frequency,
      duration_days: dbFreqItem.rows[0].duration_days,
      quantity: dbFreqItem.rows[0].quantity
    });
    if (dbFreqItem.rows[0].quantity !== 14) {
      throw new Error(`Expected quantity to be 14 (2 * 7), got ${dbFreqItem.rows[0].quantity}`);
    }

    // Restore frequency to 1 time/day and duration to 7 days, quantity to 7
    await db.query(`UPDATE prescription_items SET frequency = '1 time/day', duration_days = 7, quantity = 7 WHERE id = $1`, [targetItem.id]);

    console.log('\n======================================================');
    console.log(' ALL TESTS PASSED! PRO Modify Flow is 100% Verified');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  }
}

verifyModifyFlow();
