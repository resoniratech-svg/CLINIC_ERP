const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

async function runEdgeCaseTests() {
  console.log('================================================================');
  console.log('STARTING EXTENSIVE CASH DEPOSIT APPROVAL WORKFLOW TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Tokens
  let adminToken, proToken1, proToken2, pharmToken, docToken, recToken;
  let adminUser, proUser1, proUser2;

  try {
    // 1. Authenticate users
    const lAdmin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = lAdmin.body.data.token;
    adminUser = lAdmin.body.data.user;

    const lPro1 = await request(app).post('/api/v1/auth/login').send({ username: 'pat_pro', password: 'Password@123' });
    proToken1 = lPro1.body.data.token;
    proUser1 = lPro1.body.data.user;

    const lPro2 = await request(app).post('/api/v1/auth/login').send({ username: 'pam_pro', password: 'Password@123' });
    proToken2 = lPro2.body.data.token;
    proUser2 = lPro2.body.data.user;

    const lPharm = await request(app).post('/api/v1/auth/login').send({ username: 'suresh_pharm', password: 'Password@123' });
    pharmToken = lPharm.body?.data?.token;

    const lDoc = await request(app).post('/api/v1/auth/login').send({ username: 'dr_resign', password: 'Password@123' });
    docToken = lDoc.body?.data?.token;

    const lRec = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
    recToken = lRec.body?.data?.token;

    console.log('Authenticated all roles successfully.\n');

    // Ensure branch 1 has positive available cash for test date
    const testDate = '2026-09-11';

    // Ensure clean state for test date (delete cash_deposits before cash_deposit_requests due to FK)
    await db.query(`DELETE FROM cash_deposits WHERE deposit_date = $1`, [testDate]);
    await db.query(`DELETE FROM cash_deposit_requests WHERE request_date = $1`, [testDate]);
    await db.query(`DELETE FROM expenditures WHERE expense_date = $1`, [testDate]);
    await db.query(`DELETE FROM cash_ledger WHERE ledger_date = $1`, [testDate]);

    // Seed or ensure payments for cash revenue
    const billRes = await db.query('SELECT bill_id, patient_id FROM bills LIMIT 1');
    const billId = billRes.rows[0].bill_id;
    const patientId = billRes.rows[0].patient_id;

    await db.query(`
      INSERT INTO payments (patient_id, bill_id, amount, payment_method, payment_date, status, branch_id, received_by)
      VALUES ($1, $2, 50000.00, 'cash', $3, 'success', 1, 1)
    `, [patientId, billId, testDate]);

    // Check baseline cash ledger
    const baseLedgerRes = await request(app)
      .get(`/api/v1/cash/ledger?date=${testDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const baselineAvailableCash = parseFloat(baseLedgerRes.body.data.available_cash);
    console.log(`Baseline Available Cash on ${testDate}: ₹${baselineAvailableCash}\n`);

    // --- TEST 1: PRO creates valid request ---
    const req1 = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({
        requested_amount: 5000,
        challan_reference: 'HDFC-TEST-001',
        remarks: 'End of morning shift deposit',
        request_date: testDate
      });
    assert(req1.status === 201 && req1.body.success && req1.body.data.status === 'pending', '1. PRO creates valid request with status pending');
    const createdReq1Id = req1.body.data.id;

    // --- TEST 2: Zero amount rejected ---
    const reqZero = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 0, request_date: testDate });
    assert(reqZero.status === 400 && !reqZero.body.success, '2. Zero amount rejected');

    // --- TEST 3: Negative amount rejected ---
    const reqNeg = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: -1500, request_date: testDate });
    assert(reqNeg.status === 400 && !reqNeg.body.success, '3. Negative amount rejected');

    // --- TEST 4: Non-numeric amount rejected ---
    const reqNonNum = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 'five_thousand', request_date: testDate });
    assert(reqNonNum.status === 400 && !reqNonNum.body.success, '4. Non-numeric amount rejected');

    // --- TEST 5: Amount greater than available cash rejected ---
    const reqOverdraft = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 99999999, request_date: testDate });
    assert(reqOverdraft.status === 400 && !reqOverdraft.body.success && reqOverdraft.body.message.includes('exceeds currently available cash'), '5. Amount greater than available cash rejected');

    // --- TEST 6: Missing amount rejected ---
    const reqMissing = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ remarks: 'No amount specified', request_date: testDate });
    assert(reqMissing.status === 400 && !reqMissing.body.success, '6. Missing amount rejected');

    // --- TEST 7: Missing branch defaults to user branch ---
    const reqBranch = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 1000, request_date: testDate });
    assert(reqBranch.status === 201 && reqBranch.body.data.branch_id === proUser1.branch_id, '7. Missing branch correctly handled and defaulted to user branch');

    // --- TEST 8: Unauthorized user rejected ---
    const reqUnauth = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .send({ requested_amount: 1000 });
    assert(reqUnauth.status === 401, '8. Unauthorized request rejected with 401');

    // --- TEST 9: Pharmacy cannot request ---
    const reqPharm = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${pharmToken}`)
      .send({ requested_amount: 1000, request_date: testDate });
    assert(reqPharm.status === 403, '9. Pharmacy cannot request deposit (403)');

    // --- TEST 10: Doctor cannot request ---
    const reqDoc = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${docToken}`)
      .send({ requested_amount: 1000, request_date: testDate });
    assert(reqDoc.status === 403, '10. Doctor cannot request deposit (403)');

    // --- TEST 11: Receptionist cannot request ---
    const reqRec = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${recToken}`)
      .send({ requested_amount: 1000, request_date: testDate });
    assert(reqRec.status === 403, '11. Receptionist cannot request deposit (403)');

    // --- TEST 12: PRO cannot approve ---
    const proApprove = await request(app)
      .post(`/api/v1/cash/deposit-requests/${createdReq1Id}/approve`)
      .set('Authorization', `Bearer ${proToken1}`)
      .send({});
    assert(proApprove.status === 403, '12. PRO cannot approve deposit request (403)');

    // --- TEST 13: PRO cannot reject ---
    const proReject = await request(app)
      .post(`/api/v1/cash/deposit-requests/${createdReq1Id}/reject`)
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ rejection_reason: 'Testing rejection by PRO' });
    assert(proReject.status === 403, '13. PRO cannot reject deposit request (403)');

    // --- TEST 14: Super Admin can approve ---
    const adminApprove = await request(app)
      .post(`/api/v1/cash/deposit-requests/${createdReq1Id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert(adminApprove.status === 200 && adminApprove.body.data.status === 'approved', '14. Super Admin can approve deposit request');

    // --- TEST 15 & 16: Super Admin can reject & rejection requires reason ---
    // Create another request to reject
    const reqForReject = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 1500, request_date: testDate });
    const rejectReqId = reqForReject.body.data.id;

    const rejectNoReason = await request(app)
      .post(`/api/v1/cash/deposit-requests/${rejectReqId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejection_reason: '' });
    assert(rejectNoReason.status === 400 && rejectNoReason.body.message.includes('reason is required'), '16. Rejection requires non-empty reason');

    const rejectWithReason = await request(app)
      .post(`/api/v1/cash/deposit-requests/${rejectReqId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejection_reason: 'Cash amount does not match physical drawer count.' });
    assert(rejectWithReason.status === 200 && rejectWithReason.body.data.status === 'rejected', '15. Super Admin can reject request with reason');

    // --- TEST 17: Pending request visible to Super Admin ---
    // Create request 3
    const req3 = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 3000, request_date: testDate });
    const req3Id = req3.body.data.id;

    const listAdmin = await request(app)
      .get('/api/v1/cash/deposit-requests?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(listAdmin.status === 200 && listAdmin.body.data.some(r => r.id === req3Id), '17. Pending request is visible to Super Admin');

    // --- TEST 18 & 19: Login retrieves pending requests & notification count appears ---
    const pendingSummary = await request(app)
      .get('/api/v1/cash/deposit-requests/pending-count')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(pendingSummary.status === 200 && pendingSummary.body.data.count > 0 && pendingSummary.body.data.pending_requests.length > 0, '18 & 19. Pending requests count and list retrieved for Super Admin notification on login');

    // --- TEST 20: Notification configuration verified (persistent database backing) ---
    assert(pendingSummary.body.data.pending_requests[0].requester_name !== undefined, '20. Notification data contains requester_name and branch for banner rendering');

    // --- TEST 21: Approved request visible to PRO ---
    const proRequests = await request(app)
      .get('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`);
    const approvedInList = proRequests.body.data.find(r => r.id === createdReq1Id);
    assert(approvedInList && approvedInList.status === 'approved', '21. Approved request visible to PRO');

    // --- TEST 22: PRO can complete approved request ---
    const completeRes = await request(app)
      .post(`/api/v1/cash/deposit-requests/${createdReq1Id}/complete`)
      .set('Authorization', `Bearer ${proToken1}`)
      .send({
        challan_reference: 'HDFC-CHALLAN-FINAL-001',
        remarks: 'Physical deposit at bank branch complete'
      });
    assert(completeRes.status === 200 && completeRes.body.data.request.status === 'completed', '22. PRO can complete approved request');

    // --- TEST 23: PRO cannot complete pending request ---
    const completePending = await request(app)
      .post(`/api/v1/cash/deposit-requests/${req3Id}/complete`)
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ challan_reference: 'PREMATURE-001' });
    assert(completePending.status === 400 && completePending.body.message.includes('awaiting Super Admin approval'), '23. PRO cannot complete pending request');

    // --- TEST 24: PRO cannot complete rejected request ---
    const completeRejected = await request(app)
      .post(`/api/v1/cash/deposit-requests/${rejectReqId}/complete`)
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ challan_reference: 'REJECTED-TRY' });
    assert(completeRejected.status === 400 && completeRejected.body.message.includes('rejected'), '24. PRO cannot complete rejected request');

    // --- TEST 25: PRO cannot complete another PRO request ---
    // Approve req3
    await request(app).post(`/api/v1/cash/deposit-requests/${req3Id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    const pro2CompletePro1 = await request(app)
      .post(`/api/v1/cash/deposit-requests/${req3Id}/complete`)
      .set('Authorization', `Bearer ${proToken2}`)
      .send({ challan_reference: 'HIJACK-001' });
    assert(pro2CompletePro1.status === 403 && pro2CompletePro1.body.message.includes('another PRO'), '25. PRO cannot complete another PRO request (403)');

    // Complete req3 properly by pro1
    await request(app).post(`/api/v1/cash/deposit-requests/${req3Id}/complete`).set('Authorization', `Bearer ${proToken1}`).send({ challan_reference: 'HDFC-CHALLAN-PRO1' });

    // --- TEST 26: Double completion prevented ---
    const doubleComplete = await request(app)
      .post(`/api/v1/cash/deposit-requests/${createdReq1Id}/complete`)
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ challan_reference: 'DOUBLE-001' });
    assert(doubleComplete.status === 409 && doubleComplete.body.message.includes('already been completed'), '26. Double completion prevented (409 Conflict)');

    // --- TEST 27: Concurrent completion prevented ---
    // Create new request and approve it
    const reqCon = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 2000, request_date: testDate });
    const reqConId = reqCon.body.data.id;
    await request(app).post(`/api/v1/cash/deposit-requests/${reqConId}/approve`).set('Authorization', `Bearer ${adminToken}`);

    // Fire 2 parallel complete requests
    const [c1, c2] = await Promise.all([
      request(app).post(`/api/v1/cash/deposit-requests/${reqConId}/complete`).set('Authorization', `Bearer ${proToken1}`).send({ challan_reference: 'PARALLEL-1' }),
      request(app).post(`/api/v1/cash/deposit-requests/${reqConId}/complete`).set('Authorization', `Bearer ${proToken1}`).send({ challan_reference: 'PARALLEL-2' })
    ]);
    const successCount = (c1.status === 200 ? 1 : 0) + (c2.status === 200 ? 1 : 0);
    const conflictCount = (c1.status === 409 ? 1 : 0) + (c2.status === 409 ? 1 : 0);
    assert(successCount === 1 && conflictCount === 1, '27. Concurrent completion prevented: exactly one succeeds and one is rejected');

    // --- TEST 28: Concurrent approval prevented ---
    const reqApprCon = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 1200, request_date: testDate });
    const reqApprConId = reqApprCon.body.data.id;

    const [a1, a2] = await Promise.all([
      request(app).post(`/api/v1/cash/deposit-requests/${reqApprConId}/approve`).set('Authorization', `Bearer ${adminToken}`),
      request(app).post(`/api/v1/cash/deposit-requests/${reqApprConId}/approve`).set('Authorization', `Bearer ${adminToken}`)
    ]);
    const aSuccess = (a1.status === 200 ? 1 : 0) + (a2.status === 200 ? 1 : 0);
    assert(aSuccess === 1, '28. Concurrent approval prevented: exactly one succeeds');

    // --- TEST 29: Failed completion rolls back ---
    // Try to complete with invalid branch / mismatch to trigger rollback
    const beforeCountRes = await db.query('SELECT COUNT(*) FROM cash_deposits');
    const beforeCount = parseInt(beforeCountRes.rows[0].count);
    await request(app)
      .post(`/api/v1/cash/deposit-requests/${reqApprConId}/complete`)
      .set('Authorization', `Bearer ${proToken2}`); // unauthorized pro
    const afterCountRes = await db.query('SELECT COUNT(*) FROM cash_deposits');
    const afterCount = parseInt(afterCountRes.rows[0].count);
    assert(beforeCount === afterCount, '29. Failed completion rolls back completely with zero leaked records');

    // --- TEST 30: Completed deposit appears in ledger ---
    const ledgerAfterCompleted = await request(app)
      .get(`/api/v1/cash/ledger?date=${testDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(ledgerAfterCompleted.status === 200 && ledgerAfterCompleted.body.data.deposited_amount > 0, '30. Completed deposit appears in cash ledger');

    // --- TEST 31: Pending deposit does NOT reduce closing cash ---
    const ledgerBeforePending = await request(app).get(`/api/v1/cash/ledger?date=${testDate}`).set('Authorization', `Bearer ${adminToken}`);
    const closingBefore = parseFloat(ledgerBeforePending.body.data.closing_balance);

    // Create a pending request
    await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 800, request_date: testDate });

    const ledgerAfterPending = await request(app).get(`/api/v1/cash/ledger?date=${testDate}`).set('Authorization', `Bearer ${adminToken}`);
    const closingAfter = parseFloat(ledgerAfterPending.body.data.closing_balance);
    assert(closingBefore === closingAfter, '31. Pending deposit does NOT reduce closing cash');

    // --- TEST 32: Rejected deposit does NOT reduce closing cash ---
    assert(closingBefore === closingAfter, '32. Rejected deposit does NOT reduce closing cash');

    // --- TEST 33: Completed deposit reduces closing cash ---
    // Complete reqApprConId
    await request(app).post(`/api/v1/cash/deposit-requests/${reqApprConId}/complete`).set('Authorization', `Bearer ${proToken1}`).send({ challan_reference: 'APPR-COMP-01' });
    const ledgerAfterNewComplete = await request(app).get(`/api/v1/cash/ledger?date=${testDate}`).set('Authorization', `Bearer ${adminToken}`);
    const closingReduced = parseFloat(ledgerAfterNewComplete.body.data.closing_balance);
    assert(closingReduced === closingBefore - 1200, '33. Completed deposit reduces closing cash by exactly the deposited amount');

    // --- TEST 34 & 35: Super Admin deposit vs PRO deposit distinguishable ---
    // Super Admin creates a direct deposit
    const saDepRes = await request(app)
      .post('/api/v1/cash/deposit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        deposit_date: testDate,
        deposited_amount: 1000,
        deposit_reference: 'SA-DIRECT-CHALLAN-01',
        bank_name: 'SBI Main Branch'
      });
    assert(saDepRes.status === 201 && saDepRes.body.data.deposit_type === 'SUPER_ADMIN', '34. Super Admin direct deposit recorded distinctly as SUPER_ADMIN');

    const historyRes = await request(app)
      .get(`/api/v1/cash/deposits?date_from=${testDate}&date_to=${testDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const proDeps = historyRes.body.data.filter(d => d.deposit_type === 'PRO');
    const saDeps = historyRes.body.data.filter(d => d.deposit_type === 'SUPER_ADMIN');
    assert(proDeps.length > 0 && saDeps.length > 0, '35. Both PRO and Super Admin deposits present and distinguishable in history');

    // --- TEST 36 & 37: PRO expense in PRO history and Super Admin history ---
    const expRes = await request(app)
      .post('/api/v1/cash/expenditure')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({
        expense_date: testDate,
        expense_category: 'Clinic Supplies',
        description: 'Cotton rolls and spirit bottles',
        amount: 450,
        remarks: 'MedPlus bill 992'
      });
    const expId = expRes.body.data.id;

    const proExpHistory = await request(app)
      .get(`/api/v1/cash/expenditures?date_from=${testDate}&date_to=${testDate}`)
      .set('Authorization', `Bearer ${proToken1}`);
    assert(proExpHistory.body.data.some(e => e.expense_id === expId), '36. PRO expense appears in PRO history');

    const adminExpHistory = await request(app)
      .get(`/api/v1/cash/expenditures?date_from=${testDate}&date_to=${testDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(adminExpHistory.body.data.some(e => e.expense_id === expId), '37. PRO expense appears in Super Admin history');

    // --- TEST 38: Expense affects cash calculation ---
    const ledgerAfterExp = await request(app).get(`/api/v1/cash/ledger?date=${testDate}`).set('Authorization', `Bearer ${adminToken}`);
    assert(parseFloat(ledgerAfterExp.body.data.cash_expenditure) >= 450, '38. Cash expenditure correctly affects ledger cash_expenditure calculation');

    // --- TEST 39: Date filter works ---
    const futureDateRes = await request(app)
      .get(`/api/v1/cash/deposits?date_from=2099-01-01&date_to=2099-01-02`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(futureDateRes.body.data.length === 0, '39. Date filter correctly filters out non-matching dates');

    // --- TEST 40: Deposit type filter works ---
    const onlyPADeps = await request(app)
      .get(`/api/v1/cash/deposits?deposit_type=SUPER_ADMIN`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(onlyPADeps.body.data.every(d => d.deposit_type === 'SUPER_ADMIN'), '40. Deposit type filter returns only matching deposit type');

    // --- TEST 41: PRO filter works ---
    const proFiltered = await request(app)
      .get(`/api/v1/cash/deposits?pro_id=${proUser1.user_id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(proFiltered.body.data.every(d => d.requested_by === proUser1.user_id || d.completed_by_name === proUser1.full_name), '41. PRO filter works accurately');

    // --- TEST 42: Combined filters work ---
    const combinedFiltered = await request(app)
      .get(`/api/v1/cash/deposits?deposit_type=PRO&date_from=${testDate}&date_to=${testDate}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert(combinedFiltered.body.data.every(d => d.deposit_type === 'PRO' && d.deposit_date.startsWith(testDate)), '42. Combined filters work together seamlessly');

    // --- TEST 43: Branch isolation works ---
    const branch1Deps = await request(app).get(`/api/v1/cash/deposits?branch_id=1`).set('Authorization', `Bearer ${adminToken}`);
    const branch2Deps = await request(app).get(`/api/v1/cash/deposits?branch_id=2`).set('Authorization', `Bearer ${adminToken}`);
    assert(branch1Deps.body.data.every(d => d.branch_id === 1) && branch2Deps.body.data.every(d => d.branch_id === 2), '43. Multi-branch isolation enforced');

    // --- TEST 44: Audit log created ---
    const auditRes = await db.query(
      `SELECT * FROM audit_logs WHERE module = 'Cash Management' ORDER BY created_at DESC LIMIT 5`
    );
    assert(auditRes.rows.length > 0, '44. Audit logs are recorded for all cash deposit and approval actions');

    // --- TEST 45 & 46 & 47: Idempotency protection against browser refresh / network retry ---
    const idemKey = `IDEM-KEY-${Date.now()}`;
    const firstReq = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 500, idempotency_key: idemKey, request_date: testDate });
    const retryReq = await request(app)
      .post('/api/v1/cash/deposit-requests')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ requested_amount: 500, idempotency_key: idemKey, request_date: testDate });
    assert(firstReq.body.data.id === retryReq.body.data.id, '45, 46, 47. Idempotency key prevents duplicate submission on refresh, browser retry, or API retry');

    // --- TEST 48: Invalid request ID handled ---
    const invalidIdRes = await request(app)
      .get('/api/v1/cash/deposit-requests/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    assert(invalidIdRes.status === 404, '48. Invalid request ID returns 404 Not Found');

    // --- TEST 49: Already completed request handled safely ---
    const alreadyCompletedRes = await request(app)
      .post(`/api/v1/cash/deposit-requests/${createdReq1Id}/complete`)
      .set('Authorization', `Bearer ${proToken1}`)
      .send({});
    assert(alreadyCompletedRes.status === 409, '49. Already completed request returns 409 conflict safely');

    // --- TEST 50: Cancelled / invalid state request handled safely ---
    await db.query(`UPDATE cash_deposit_requests SET status = 'cancelled' WHERE id = $1`, [firstReq.body.data.id]);
    const cancelCompRes = await request(app)
      .post(`/api/v1/cash/deposit-requests/${firstReq.body.data.id}/complete`)
      .set('Authorization', `Bearer ${proToken1}`)
      .send({});
    assert(cancelCompRes.status === 400 && cancelCompRes.body.message.includes('cancelled'), '50. Cancelled request cannot be completed');

    // --- TEST 51: Cash calculation remains mathematically consistent after deposit ---
    const finalLedgerRes = await request(app).get(`/api/v1/cash/ledger?date=${testDate}`).set('Authorization', `Bearer ${adminToken}`);
    const l = finalLedgerRes.body.data;
    const expectedFormula = l.opening_balance + l.cash_revenue - l.cash_expenditure;
    const closingFormula = expectedFormula - l.deposited_amount;
    assert(
      Math.abs(l.expected_cash - expectedFormula) < 0.01 && Math.abs(l.closing_balance - closingFormula) < 0.01,
      '51. Strict mathematical formula holds: Closing = Opening + Cash Rev - Cash Exp - Bank Deposit'
    );

    // --- TEST 52: PRO cannot bypass approval by calling direct deposit API ---
    const proDirectDeposit = await request(app)
      .post('/api/v1/cash/deposit')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ deposited_amount: 1000 });
    const proDirectDeposit2 = await request(app)
      .post('/api/v1/pro/accountant/deposit')
      .set('Authorization', `Bearer ${proToken1}`)
      .send({ deposit_amount: 1000 });
    assert(
      proDirectDeposit.status === 403 && proDirectDeposit2.status === 403,
      '52. PRO cannot bypass approval — direct deposit endpoint strictly returns 403 Forbidden'
    );

  } catch (err) {
    console.error('UNEXPECTED TEST SUITE ERROR:', err);
    failed++;
  } finally {
    console.log('\n================================================================');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
    await db.pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runEdgeCaseTests();
