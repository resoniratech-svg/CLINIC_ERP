const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

const settingsController = require('../controllers/settings.controller');

router.post('/login', authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.post('/change-password', authenticateToken, authController.changePassword);
router.post('/forgot-password', authController.forgotPassword);
router.get('/profile', authenticateToken, settingsController.getProfile);
router.put('/profile', authenticateToken, settingsController.updateProfile);

module.exports = router;
