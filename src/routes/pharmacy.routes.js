const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacy.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/medicines', authenticateToken, pharmacyController.getMedicines);
router.post('/medicines', authenticateToken, authorizeRoles('super_admin', 'pharmacy'), pharmacyController.createMedicine);
router.get('/stock', authenticateToken, pharmacyController.getStock);
router.post('/stock', authenticateToken, authorizeRoles('super_admin', 'pharmacy'), pharmacyController.addStock);
router.post('/prescriptions', authenticateToken, authorizeRoles('super_admin', 'doctor'), pharmacyController.createPrescription);
router.post('/dispense', authenticateToken, authorizeRoles('super_admin', 'pharmacy'), pharmacyController.dispensePrescription);

module.exports = router;
