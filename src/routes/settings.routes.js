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
router.put('/masters/:type/:id', authenticateToken, authorizeRoles('super_admin'), settingsController.updateMasterData);
router.patch('/masters/:type/:id/status', authenticateToken, authorizeRoles('super_admin'), settingsController.toggleMasterDataStatus);

// Authenticated User Profile & Branches for Settings
router.get('/profile', authenticateToken, settingsController.getProfile);
router.put('/profile', authenticateToken, settingsController.updateProfile);
router.get('/branches', authenticateToken, settingsController.getBranches);
router.put('/branches/:id', authenticateToken, authorizeRoles('super_admin'), settingsController.updateBranch);

module.exports = router;
