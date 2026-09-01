const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logs.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/audit', authenticateToken, authorizeRoles('super_admin'), logsController.getAuditLogs);
router.get('/login', authenticateToken, authorizeRoles('super_admin'), logsController.getLoginLogs);

module.exports = router;
