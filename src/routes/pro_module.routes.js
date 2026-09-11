const express = require('express');
const router = express.Router();
const proController = require('../controllers/pro_module.controller');
const cashController = require('../controllers/cash.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// All PRO routes require authentication and pro_manager or super_admin role
router.use(authenticateToken);
router.use(authorizeRoles('pro_manager', 'super_admin'));

// 1. Dashboard
router.get('/dashboard', proController.getDashboard);

// 2. Patient Queue & Search
router.get('/queue', proController.getPatientQueue);
router.get('/patients/search', proController.searchPatients);

// 3. Patient 360° Overview & History
router.get('/patients/:id', proController.getPatientOverview);
router.get('/patients/:id/overview', proController.getPatientOverview);
router.get('/patients/:id/history', proController.getPatientHistory);

// 4. Counselling
router.post('/counselling', proController.createCounselling);
router.get('/counselling', proController.getCounsellingHistory);
router.get('/counselling/history', proController.getCounsellingHistory);

// 5. Packages / Plans
router.post('/packages', proController.createPackage);
router.post('/packages/enroll', proController.createPackage);
router.get('/packages', proController.getPackages);
router.put('/packages/:id/status', proController.updatePackageStatus);

// 6. Prescription Review & Modification
router.get('/prescriptions/:id', proController.getPrescriptionDetails);
router.post('/prescriptions/items/:item_id/modify', proController.modifyPrescriptionItem);
router.get('/prescriptions/items/:item_id/modifications', proController.getPrescriptionItemModifications);

// 7. Billing & Invoices
router.post('/bills', proController.createBill);
router.post('/billing', proController.createBill);
router.get('/bills/pending', proController.getPendingBills);
router.get('/bills/paid', proController.getPaidBills);
router.get('/bills/partial-due', proController.getPartialDueBills);
router.get('/bills/history', proController.getBillingHistory);
router.get('/bills/:id', proController.getBillDetails);
router.get('/invoices/:id', proController.getBillDetails);

// 8. Payments & Doctor Target Attribution
router.post('/payments', proController.recordPayment);
router.post('/payments/:id/refund', proController.refundPayment);
router.get('/payments/today', proController.getTodayPayments);
router.get('/payments/due-collection', proController.getDueCollections);
router.get('/payments/due-collections', proController.getDueCollections);
router.get('/payments/history', proController.getPaymentHistory);

// 9. CRM / Calling & Renewals & Dues & ACQ & OC/NR
router.post('/calls', proController.createCall);
router.get('/calls', proController.getTodayCalls);

router.post('/followups', proController.createFollowup);
router.post('/crm/followups', proController.createFollowup);
router.get('/followups', proController.getFollowups);
router.put('/followups/:id/status', proController.updateFollowupStatus);
router.post('/followups/:id/complete', proController.updateFollowupStatus);
router.put('/crm/followups/:id/status', proController.updateFollowupStatus);

router.get('/renewals/queue', proController.getRenewalsQueue);
router.post('/renewals', proController.createRenewal);

router.get('/due-patients', proController.getDuePatients);

router.get('/acq', proController.getACQPatients);
router.put('/acq/:id', proController.updateACQPatient);

router.get('/ocnr', proController.getOCNRPatients);
router.get('/oc-nr', proController.getOCNRPatients);
router.post('/ocnr', proController.createOCNRPatient);
router.post('/oc-nr', proController.createOCNRPatient);

// 10. My Tasks
router.get('/my-tasks', proController.getMyTasks);
router.get('/crm/my-tasks', proController.getMyTasks);
router.post('/my-tasks/:call_id/complete', proController.completeTask);
router.put('/crm/tasks/:call_id/complete', proController.completeTask);
router.post('/my-tasks/:call_id/reschedule', proController.rescheduleTask);

// 11. Accountant / Cash Management
router.get('/accountant/opening-balance', proController.getOpeningBalance);
router.get('/accountant/cash-revenue', proController.getCashRevenue);
router.post('/accountant/expenditure', proController.createExpenditure);
router.get('/accountant/expenditures', cashController.getExpendituresHistory);
router.get('/accountant/closing-balance', proController.getClosingBalance);
router.post('/accountant/deposit', proController.depositCash);
router.get('/accountant/deposits', cashController.getDepositHistory);
router.post('/accountant/deposit-requests', cashController.createDepositRequest);
router.get('/accountant/deposit-requests', cashController.getDepositRequests);
router.get('/accountant/deposit-requests/pending-count', cashController.getPendingDepositRequestsCount);
router.get('/accountant/deposit-requests/:id', cashController.getDepositRequestById);
router.post('/accountant/deposit-requests/:id/approve', cashController.approveDepositRequest);
router.post('/accountant/deposit-requests/:id/reject', cashController.rejectDepositRequest);
router.post('/accountant/deposit-requests/:id/complete', cashController.completeDepositRequest);
router.get('/accountant/daily-summary', proController.getDailyCashSummary);
router.get('/accountant/cash-ledger', proController.getDailyCashSummary);
router.get('/accountant/grand-total', proController.getGrandTotal);
router.get('/reports/revenue', proController.getGrandTotal);
router.get('/reports/operational', proController.getOperationalReports);
router.get('/reports/summary', proController.getOperationalReports);

// 12. Feedback & Complaints
router.post('/feedback', proController.createFeedback);
router.get('/feedback', proController.getFeedback);

router.post('/complaints', proController.createComplaint);
router.put('/complaints/:id', proController.updateComplaint);
router.get('/complaints', proController.getComplaints);

// 13. PRO Completion & Pharmacy Handoff
router.get('/patients/:id/pro-checklist', proController.getPROChecklist);
router.get('/patients/:id/checklist', proController.getPROChecklist);
router.post('/patients/:id/complete-pro', proController.completePRO);
router.post('/patients/:id/complete', proController.completePRO);
router.get('/patients/:id/complete-pro', proController.completePRO);

// 14. PRO Profile
router.get('/profile', proController.getProfile);
router.put('/profile', proController.updateProfile);

module.exports = router;
