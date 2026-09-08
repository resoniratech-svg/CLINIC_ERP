const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor_module.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// All Doctor Module routes require authentication
router.use(authenticateToken);

// Diagnosis search (accessible by Doctor & Super Admin)
router.get('/diagnoses/search', authorizeRoles('doctor', 'super_admin'), doctorController.searchDiagnoses);

// Dashboard
router.get('/dashboard', authorizeRoles('doctor', 'super_admin'), doctorController.getDashboard);

// Appointments & Queue
router.get('/appointments/today', authorizeRoles('doctor', 'super_admin'), doctorController.getTodayAppointments);
router.get('/queue', authorizeRoles('doctor', 'super_admin'), doctorController.getPatientQueue);
router.get('/patient-queue', authorizeRoles('doctor', 'super_admin'), doctorController.getPatientQueue);

// Patient Search & Overview
router.get('/patients', authorizeRoles('doctor', 'super_admin'), doctorController.getPatients);
router.get('/patients/:id/overview', authorizeRoles('doctor', 'super_admin'), doctorController.getPatientOverview);

// Consultation Lifecycle
router.post('/consultations/start', authorizeRoles('doctor', 'super_admin'), doctorController.startConsultation);
router.put('/consultations/:id', authorizeRoles('doctor', 'super_admin'), doctorController.updateConsultation);
router.get('/consultations/:id/summary', authorizeRoles('doctor', 'super_admin'), doctorController.getConsultationSummary);
router.post('/consultations/:id/save-draft', authorizeRoles('doctor', 'super_admin'), doctorController.saveDraft);
router.post('/consultations/draft', authorizeRoles('doctor', 'super_admin'), doctorController.saveDraft);
router.post('/consultations/:id/complete', authorizeRoles('doctor', 'super_admin'), doctorController.completeConsultation);
router.post('/consultations/complete', authorizeRoles('doctor', 'super_admin'), doctorController.completeConsultation);
router.get('/consultations', authorizeRoles('doctor', 'super_admin'), doctorController.getConsultationHistory);
router.get('/consultations/:id', authorizeRoles('doctor', 'super_admin'), doctorController.getConsultationDetails);

// Prescriptions
router.post('/prescriptions', authorizeRoles('doctor', 'super_admin'), doctorController.createPrescription);
router.get('/prescriptions/mine', authorizeRoles('doctor', 'super_admin'), doctorController.getMyPrescriptions);
router.get('/prescriptions/:id', authorizeRoles('doctor', 'super_admin'), doctorController.getPrescriptionDetails);

// Treatment Plans
router.post('/treatment-plans', authorizeRoles('doctor', 'super_admin'), doctorController.createTreatmentPlan);
router.get('/treatment-plans/mine', authorizeRoles('doctor', 'super_admin'), doctorController.getMyTreatmentPlans);
router.get('/treatment-plans/:id', authorizeRoles('doctor', 'super_admin'), doctorController.getTreatmentPlanDetails);
router.put('/treatment-plans/:id', authorizeRoles('doctor', 'super_admin'), doctorController.updateTreatmentPlan);

// Targets (View-only for Doctor role)
router.get('/targets/mine', authorizeRoles('doctor', 'super_admin'), doctorController.getMyTargets);
router.get('/targets/mine/daily', authorizeRoles('doctor', 'super_admin'), doctorController.getMyTargets);
router.get('/targets/mine/weekly', authorizeRoles('doctor', 'super_admin'), doctorController.getMyTargets);
router.post('/targets/mine', authorizeRoles('doctor'), doctorController.blockTargetMutation);
router.put('/targets/mine', authorizeRoles('doctor'), doctorController.blockTargetMutation);
router.delete('/targets/mine', authorizeRoles('doctor'), doctorController.blockTargetMutation);

// Doctor Profile & Schedule
router.get('/profile', authorizeRoles('doctor', 'super_admin'), doctorController.getProfile);
router.put('/profile', authorizeRoles('doctor', 'super_admin'), doctorController.updateProfile);
router.get('/schedule', authorizeRoles('doctor', 'super_admin'), doctorController.getSchedule);

// Doctor Leaves
router.post('/leaves', authorizeRoles('doctor', 'super_admin'), doctorController.applyLeave);
router.get('/leaves/mine', authorizeRoles('doctor', 'super_admin'), doctorController.getMyLeaves);

// Prescription Modification Decision (Doctor Only)
router.post('/prescription-modifications/:id/decision', authorizeRoles('doctor'), doctorController.doctorPrescriptionModificationDecision);

// Prescription Clarification Workflow (Doctor)
router.get('/clarifications', authorizeRoles('doctor', 'super_admin'), doctorController.getDoctorClarifications);
router.post('/clarifications/:id/respond', authorizeRoles('doctor'), doctorController.respondToClarification);

module.exports = router;
