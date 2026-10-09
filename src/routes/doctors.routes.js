const express = require('express');
const router = express.Router();
const doctorsController = require('../controllers/doctors.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, authorizeRoles('super_admin'), doctorsController.getDoctors);
router.get('/:id/summary', authenticateToken, authorizeRoles('super_admin'), doctorsController.getDoctorSummary);
router.post('/:id/transfer', authenticateToken, authorizeRoles('super_admin'), doctorsController.transferDoctorResponsibilities);
router.get('/:id/reactivation-preview', authenticateToken, authorizeRoles('super_admin'), doctorsController.getReactivationPreview);
router.post('/:id/reactivate', authenticateToken, authorizeRoles('super_admin'), doctorsController.reactivateDoctor);

module.exports = router;
