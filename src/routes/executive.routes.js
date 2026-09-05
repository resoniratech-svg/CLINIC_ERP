const express = require('express');
const router = express.Router();
const executiveController = require('../controllers/executive.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// All Executive routes require authentication and Executive or Super Admin role
router.use(authenticateToken);

// 2. Executive Dashboard
router.get('/dashboard', authorizeRoles('executive', 'super_admin'), executiveController.getDashboard);

// 4 & 5. Inbound Patient Search
router.get('/patients/search', authorizeRoles('executive', 'super_admin'), executiveController.searchPatientInbound);
router.post('/inbound/search', authorizeRoles('executive', 'super_admin'), executiveController.searchPatientInbound);

// 6 & 12. Create & Update Lead
router.post('/leads', authorizeRoles('executive', 'super_admin'), executiveController.createLead);
router.put('/leads/:id', authorizeRoles('executive', 'super_admin'), executiveController.updateLead);

// 8 & 9. Outbound Excel Import & Update
router.post('/outbound/import', authorizeRoles('executive', 'super_admin', 'pro_manager'), executiveController.importOutboundLeads);
router.put('/outbound/leads/:id', authorizeRoles('executive', 'super_admin'), executiveController.updateOutboundLead);

// 10. Outbound Queue
router.get('/outbound/queue', authorizeRoles('executive', 'super_admin'), executiveController.getOutboundQueue);

// 11. Record & Update Call Outcome
router.post('/calls/outcome', authorizeRoles('executive', 'super_admin'), executiveController.recordCallOutcome);
router.post('/calls', authorizeRoles('executive', 'super_admin'), executiveController.recordCallOutcome);
router.put('/calls/:id', authorizeRoles('executive', 'super_admin'), executiveController.updateCallRecord);

// 15. Callbacks
router.get('/callbacks', authorizeRoles('executive', 'super_admin'), executiveController.getCallbacks);

// 14 & 16. Leads List & Details
router.get('/leads', authorizeRoles('executive', 'super_admin'), executiveController.getLeads);
router.get('/leads/:id', authorizeRoles('executive', 'super_admin'), executiveController.getLeadDetails);

// 17. Call History
router.get('/calls/history', authorizeRoles('executive', 'super_admin'), executiveController.getCallHistory);

// 18 & 19. Incentives
router.get('/incentives', authorizeRoles('executive', 'super_admin'), executiveController.getIncentives);

// 20. Super Admin Executive Performance Report
router.get('/performance', authorizeRoles('super_admin'), executiveController.getExecutivePerformanceReport);

module.exports = router;
