const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/password-reset.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// Public / Unauthenticated route to request password reset
router.post('/request', passwordResetController.requestPasswordReset);
router.post('/', passwordResetController.requestPasswordReset);

// Super Admin protected routes
router.get('/all', authenticateToken, authorizeRoles('super_admin'), passwordResetController.getPasswordResetRequests);
router.get('/', authenticateToken, authorizeRoles('super_admin'), passwordResetController.getPasswordResetRequests);
router.post('/:id/approve', authenticateToken, authorizeRoles('super_admin'), passwordResetController.approvePasswordReset);
router.post('/:id/reject', authenticateToken, authorizeRoles('super_admin'), passwordResetController.rejectPasswordReset);

module.exports = router;
