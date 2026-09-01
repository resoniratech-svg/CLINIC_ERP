const express = require('express');
const router = express.Router();
const targetsController = require('../controllers/targets.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, authorizeRoles('super_admin'), targetsController.getTargets);
router.post('/', authenticateToken, authorizeRoles('super_admin'), targetsController.setTarget);
router.post('/doctor-target', authenticateToken, authorizeRoles('super_admin'), targetsController.setDoctorTarget);
router.get('/doctor-performance', authenticateToken, authorizeRoles('super_admin'), targetsController.getDoctorPerformance);

module.exports = router;
