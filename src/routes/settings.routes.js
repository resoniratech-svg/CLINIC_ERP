const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/permissions-matrix', authenticateToken, authorizeRoles('super_admin'), settingsController.getPermissionsMatrix);
router.post('/permissions-matrix', authenticateToken, authorizeRoles('super_admin'), settingsController.updatePermissionsMatrix);
router.get('/hospital', authenticateToken, settingsController.getHospitalSettings);
router.put('/hospital', authenticateToken, authorizeRoles('super_admin'), settingsController.updateHospitalSettings);
router.get('/masters/:type', authenticateToken, settingsController.getMasterData);
router.post('/masters/:type', authenticateToken, authorizeRoles('super_admin'), settingsController.addMasterData);

module.exports = router;
