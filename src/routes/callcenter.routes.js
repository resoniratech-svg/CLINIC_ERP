const express = require('express');
const router = express.Router();
const callCenterController = require('../controllers/callcenter.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

const executiveController = require('../controllers/executive.controller');

router.post('/inbound/search', authenticateToken, callCenterController.searchPatientInbound);
router.post('/leads', authenticateToken, callCenterController.createLead);
router.post('/outbound/import', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), callCenterController.importOutboundLeads);
router.get('/outbound/queue', authenticateToken, authorizeRoles('executive', 'super_admin', 'pro_manager'), executiveController.getOutboundQueue);
router.get('/queue', authenticateToken, authorizeRoles('executive', 'super_admin', 'pro_manager'), executiveController.getOutboundQueue);
router.get('/executive-incentives', authenticateToken, authorizeRoles('super_admin'), callCenterController.getExecutiveIncentives);

module.exports = router;
