const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/password-reset.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, authorizeRoles('super_admin'), passwordResetController.getPasswordResetRequests);
router.post('/:id/approve', authenticateToken, authorizeRoles('super_admin'), passwordResetController.approvePasswordReset);
router.post('/:id/reject', authenticateToken, authorizeRoles('super_admin'), passwordResetController.rejectPasswordReset);

module.exports = router;
