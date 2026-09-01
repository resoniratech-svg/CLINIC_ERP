const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, authorizeRoles('super_admin'), usersController.getUsers);
router.get('/:id', authenticateToken, authorizeRoles('super_admin'), usersController.getUserById);
router.post('/', authenticateToken, authorizeRoles('super_admin'), usersController.createUser);
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), usersController.updateUser);
router.patch('/:id/status', authenticateToken, authorizeRoles('super_admin'), usersController.updateUserStatus);

module.exports = router;
