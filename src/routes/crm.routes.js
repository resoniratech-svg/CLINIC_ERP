const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crm.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/followups', authenticateToken, crmController.getFollowups);
router.post('/followups', authenticateToken, authorizeRoles('super_admin', 'receptionist', 'pro_manager'), crmController.createFollowup);
router.get('/acq', authenticateToken, authorizeRoles('super_admin', 'receptionist', 'pro_manager'), crmController.getAcqPatients);
router.post('/acq', authenticateToken, authorizeRoles('super_admin', 'receptionist', 'pro_manager'), crmController.createAcqPatient);
router.get('/ocnr', authenticateToken, authorizeRoles('super_admin', 'receptionist', 'pro_manager'), crmController.getOcNrPatients);
router.post('/ocnr', authenticateToken, authorizeRoles('super_admin', 'receptionist', 'pro_manager'), crmController.markOcNrPatient);
router.post('/referrals', authenticateToken, authorizeRoles('super_admin', 'receptionist', 'pro_manager'), crmController.createReferral);

module.exports = router;
