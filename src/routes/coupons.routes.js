const express = require('express');
const router = express.Router();
const couponsController = require('../controllers/coupons.controller');
const { authenticateToken } = require('../middleware/auth');
const { requireCouponPermission } = require('../middleware/rbac');

// All coupon endpoints require authentication and coupon permission (Super Admin or authorized role)
router.use(authenticateToken);
router.use(requireCouponPermission());

// Patient search for autocomplete
router.get('/patients/search', couponsController.searchPatientsForCoupon);

// Code generator
router.get('/generate-code', couponsController.getGeneratedCode);

// Validation & calculation helper (for future billing/receptionist integration)
router.get('/validate', couponsController.validateCoupon);
router.post('/validate', couponsController.validateCoupon);

// Redemption endpoints (transactional redemption on billing)
router.post('/redeem', couponsController.redeemCoupon);
router.post('/:id/redeem', couponsController.redeemCoupon);

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
