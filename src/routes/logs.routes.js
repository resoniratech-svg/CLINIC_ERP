const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logs.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, authorizeRoles('super_admin'), (req, res, next) => {
  if (req.baseUrl.includes('login-logs') || req.path.includes('login')) {
    return logsController.getLoginLogs(req, res, next);
  }
  return logsController.getAuditLogs(req, res, next);
});
router.get('/audit', authenticateToken, authorizeRoles('super_admin'), logsController.getAuditLogs);
router.get('/audit-logs', authenticateToken, authorizeRoles('super_admin'), logsController.getAuditLogs);
router.get('/login', authenticateToken, authorizeRoles('super_admin'), logsController.getLoginLogs);
router.get('/login-logs', authenticateToken, authorizeRoles('super_admin'), logsController.getLoginLogs);

module.exports = router;
