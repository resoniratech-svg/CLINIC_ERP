const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const pharmacyController = require('../controllers/pharmacy.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// All Pharmacy routes require authentication
router.use(authenticateToken);

// 1. Dashboard
router.get('/dashboard', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getDashboard);

// 2. Prescription Queue & Process Prescription
router.get('/queue', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getPrescriptionQueue);
router.get('/prescriptions/:id/process', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.processPrescription);

// 3. Modify Days & Prescription Audit
router.post('/prescriptions/items/:item_id/modify-days', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.modifyPrescriptionItemDays);
router.get('/prescriptions/items/:item_id/modifications', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getItemModifications);

// Prohibited Clinical Edits Blockers
router.post('/prescriptions/items/:item_id/modify-medicine', authorizeRoles('pharmacy'), pharmacyController.blockClinicalModification);
router.post('/prescriptions/items/:item_id/modify-dosage', authorizeRoles('pharmacy'), pharmacyController.blockClinicalModification);
router.post('/prescriptions/items/:item_id/modify-frequency', authorizeRoles('pharmacy'), pharmacyController.blockClinicalModification);

// Prohibited Role Action Blockers (Registration, Billing, Payment, Diagnosis)
router.post('/patients/register', authorizeRoles('pharmacy'), pharmacyController.blockProhibitedAction);
router.post('/consultations', authorizeRoles('pharmacy'), pharmacyController.blockProhibitedAction);
router.post('/billing', authorizeRoles('pharmacy'), pharmacyController.blockProhibitedAction);
router.post('/payments', authorizeRoles('pharmacy'), pharmacyController.blockProhibitedAction);

// 4. Stock Check & FEFO Batch Selection
router.get('/prescriptions/:id/stock-check', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.checkPrescriptionStock);
router.get('/medicines/:id/batches', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getMedicineBatches);
router.put('/prescriptions/items/:item_id/select-batch', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.selectBatch);

// 5. Dispensing Workflow
router.post('/prescriptions/:id/dispense/draft', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.saveDispenseDraft);
router.post('/prescriptions/:id/dispense/complete', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.completeDispensing);
router.put('/prescriptions/items/:item_id/status', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.updateItemDispenseStatus);
router.post('/prescriptions/items/:item_id/status', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.updateItemDispenseStatus);

// 6. Prescription Clarification Workflow
router.post('/clarifications', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.createClarification);
router.get('/clarifications', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getClarifications);
router.put('/clarifications/:id/close', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.closeClarification);
router.post('/clarifications/:id/close', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.closeClarification);
router.get('/clarifications/:id/close', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.closeClarification);

// 7. Inventory & Medicine Master
router.get('/medicines', authorizeRoles('pharmacy', 'super_admin', 'doctor', 'receptionist'), pharmacyController.getMedicines);
router.post('/medicines', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.createMedicine);
router.put('/medicines/:id', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.updateMedicine);
router.get('/medicines/:id/stock', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getMedicineStockDetail);

// 8. Manual Stock Entry & Excel Stock Import
router.get('/stock', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getStock);
router.post('/stock', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.addStock);

router.post('/stock/import/preview', authorizeRoles('pharmacy', 'super_admin'), upload.single('file'), pharmacyController.previewStockImport);
router.post('/stock/import/confirm', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.confirmStockImport);
router.get('/stock/import/history', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getImportHistory);
router.get('/stock/import/:batch_id', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getImportBatchDetail);

// 9. Stock Alerts
router.get('/stock/low-stock', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getLowStock);
router.get('/stock/expiring', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getExpiringStock);
router.get('/stock/expired', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getExpiredStock);
router.get('/stock/out-of-stock', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getOutOfStock);

// 10. Stock Transactions
router.get('/stock/transactions', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getStockTransactions);

// 11. Stock Adjustments
router.post('/stock/adjustments', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.createStockAdjustment);
router.get('/stock/adjustments', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getStockAdjustments);
router.post('/stock/adjustments/:id/approve', authorizeRoles('super_admin'), pharmacyController.approveStockAdjustment);

// 12. Medicine Returns
router.post('/returns', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.createMedicineReturn);
router.get('/returns', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getMedicineReturns);

// 13. Dispensing History & Patient Search
router.get('/dispensing/history', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getDispensingHistory);
router.get('/patients/search', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.searchPatients);

// 14. Pharmacy Profile
router.get('/profile', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.getProfile);
router.put('/profile', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.updateProfile);

// Legacy backward-compatibility routes
router.post('/prescriptions', authorizeRoles('super_admin', 'doctor'), pharmacyController.createPrescription);
router.post('/dispense', authorizeRoles('pharmacy', 'super_admin'), pharmacyController.dispensePrescription);

module.exports = router;
