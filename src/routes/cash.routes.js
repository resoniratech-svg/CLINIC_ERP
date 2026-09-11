const express = require('express');
const router = express.Router();
const cashController = require('../controllers/cash.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// 1. Cash Day-Closing Ledger
router.get('/ledger', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.getCashLedger);

// 2. Cash Expenditures
router.post('/expenditure', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.createExpenditure);
router.get('/expenditures', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.getExpendituresHistory);

// 3. Bank Cash Deposits
// Direct deposit is exclusively for Super Admin! (PRO gets 403)
router.post('/deposit', authenticateToken, authorizeRoles('super_admin'), cashController.createCashDeposit);
router.get('/deposits', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.getDepositHistory);

// 4. Deposit Approval Requests Workflow
router.post('/deposit-requests', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.createDepositRequest);
router.get('/deposit-requests', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.getDepositRequests);
router.get('/deposit-requests/pending-count', authenticateToken, authorizeRoles('super_admin'), cashController.getPendingDepositRequestsCount);
router.get('/deposit-requests/:id', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.getDepositRequestById);
router.post('/deposit-requests/:id/approve', authenticateToken, authorizeRoles('super_admin'), cashController.approveDepositRequest);
router.post('/deposit-requests/:id/reject', authenticateToken, authorizeRoles('super_admin'), cashController.rejectDepositRequest);
router.post('/deposit-requests/:id/complete', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.completeDepositRequest);

module.exports = router;
