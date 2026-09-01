const express = require('express');
const router = express.Router();
const callCenterController = require('../controllers/callcenter.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.post('/inbound/search', authenticateToken, callCenterController.searchPatientInbound);
router.post('/leads', authenticateToken, callCenterController.createLead);
router.post('/outbound/import', authenticateToken, authorizeRoles('super_admin', 'pro_manager'), callCenterController.importOutboundLeads);
router.get('/executive-incentives', authenticateToken, authorizeRoles('super_admin'), callCenterController.getExecutiveIncentives);

module.exports = router;
