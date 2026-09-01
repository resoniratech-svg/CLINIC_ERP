const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/patients', authenticateToken, authorizeRoles('super_admin'), reportsController.getPatientReport);
router.get('/revenue', authenticateToken, authorizeRoles('super_admin'), reportsController.getRevenueReport);
router.get('/target', authenticateToken, authorizeRoles('super_admin'), reportsController.getTargetReport);
router.get('/executive', authenticateToken, authorizeRoles('super_admin'), reportsController.getExecutiveReport);
router.get('/pharmacy', authenticateToken, authorizeRoles('super_admin'), reportsController.getPharmacyReport);
router.get('/crm', authenticateToken, authorizeRoles('super_admin'), reportsController.getCrmReport);

module.exports = router;
