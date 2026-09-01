const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/consultation-fees', authenticateToken, billingController.getConsultationFees);
router.post('/consultation-fees', authenticateToken, authorizeRoles('super_admin'), billingController.setConsultationFee);
router.get('/rules', authenticateToken, billingController.getBillingRules);
router.post('/bills', authenticateToken, authorizeRoles('super_admin', 'receptionist', 'pro_manager'), billingController.createBill);
router.post('/payments', authenticateToken, authorizeRoles('super_admin', 'receptionist', 'pro_manager'), billingController.recordPayment);
router.get('/revenue', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), billingController.getRevenueReport);

module.exports = router;
