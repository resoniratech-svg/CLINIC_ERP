const express = require('express');
const router = express.Router();
const couponsController = require('../controllers/coupons.controller');
const { authenticateToken } = require('../middleware/auth');
const { requireCouponPermission, authorizeRoles } = require('../middleware/rbac');

// All coupon endpoints require authentication
router.use(authenticateToken);

// Patient coupon wallet & validation (accessible to staff involved in billing and consultations)
router.get('/patient/:patientId', authorizeRoles('super_admin', 'pro_manager', 'receptionist', 'doctor'), couponsController.getPatientCoupons);
router.get('/validate', authorizeRoles('super_admin', 'pro_manager', 'receptionist', 'doctor'), couponsController.validateCoupon);
router.post('/validate', authorizeRoles('super_admin', 'pro_manager', 'receptionist', 'doctor'), couponsController.validateCoupon);

// Administrative coupon management operations require coupon_management permission
router.use(requireCouponPermission());

// Redemption endpoints (transactional redemption on billing)
router.post('/redeem', couponsController.redeemCoupon);
router.post('/:id/redeem', couponsController.redeemCoupon);

// Patient search for autocomplete
router.get('/patients/search', couponsController.searchPatientsForCoupon);

// Code generator
router.get('/generate-code', couponsController.getGeneratedCode);

// Coupon CRUD & lifecycle
router.get('/', couponsController.listCoupons);
router.post('/', couponsController.createCoupon);
router.get('/:id', couponsController.getCouponById);
router.put('/:id', couponsController.updateCoupon);
router.patch('/:id', couponsController.updateCoupon);
router.patch('/:id/status', couponsController.updateCouponStatus);
router.put('/:id/status', couponsController.updateCouponStatus);
router.get('/:id/redemptions', couponsController.getCouponRedemptions);

module.exports = router;
