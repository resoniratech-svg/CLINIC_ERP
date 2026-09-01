const express = require('express');
const router = express.Router();
const cashController = require('../controllers/cash.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/ledger', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.getCashLedger);
router.post('/expenditure', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.createExpenditure);
router.post('/deposit', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), cashController.createCashDeposit);

module.exports = router;
