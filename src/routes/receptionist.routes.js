const express = require('express');
const router = express.Router();
const receptionistController = require('../controllers/receptionist.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles, requireReceptionistPermission } = require('../middleware/rbac');

// All Receptionist routes require authentication and Receptionist or Super Admin role
router.use(authenticateToken);
router.use(authorizeRoles('receptionist', 'super_admin'));

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard — always accessible (no granular permission required)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', receptionistController.getDashboard);

// ──────────────────────────────────────────────────────────────────────────────
// Patient Search & Overview — always accessible (read-only, no granular lock)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/patients/search', receptionistController.searchPatients);
router.get('/patients/:id/overview', receptionistController.getPatientOverview);
router.get('/patients/:id/invoices', receptionistController.getPatientInvoices);
router.get('/doctors', receptionistController.getActiveDoctors);
router.get('/doctors/:id/available-slots', receptionistController.getDoctorAvailableSlots);
router.get('/employees', receptionistController.getEligibleEmployees);

// ──────────────────────────────────────────────────────────────────────────────
// Registration  →  permission: registration
// ──────────────────────────────────────────────────────────────────────────────
router.post('/patients/register', requireReceptionistPermission('registration'), receptionistController.registerPatient);
router.put('/patients/:id',       requireReceptionistPermission('registration'), receptionistController.updatePatient);
router.patch('/patients/:id',     requireReceptionistPermission('registration'), receptionistController.updatePatient);
router.post('/register-walkin',   requireReceptionistPermission('registration'), receptionistController.registerPatient);
router.post('/register',          requireReceptionistPermission('registration'), receptionistController.registerPatient);

// ──────────────────────────────────────────────────────────────────────────────
// Enquiries  →  permission: enquiry
// ──────────────────────────────────────────────────────────────────────────────
router.post('/enquiries', requireReceptionistPermission('enquiry'), receptionistController.createEnquiry);
router.get('/enquiries',  requireReceptionistPermission('enquiry'), receptionistController.getEnquiries);

// ──────────────────────────────────────────────────────────────────────────────
// Referrals — tied to enquiry/registration scope; no separate permission
// ──────────────────────────────────────────────────────────────────────────────
router.post('/referrals/employee', receptionistController.createEmployeeReferral);
router.get('/referrals/employee',  receptionistController.getEmployeeReferrals);
router.post('/referrals/patient',  receptionistController.createPatientReferral);
router.get('/referrals/patient',   receptionistController.getPatientReferrals);

// ──────────────────────────────────────────────────────────────────────────────
// Executive Lead Queue — tied to enquiry scope
// ──────────────────────────────────────────────────────────────────────────────
router.get('/leads',              requireReceptionistPermission('enquiry'), receptionistController.getExecutiveLeads);
router.post('/leads/:id/open',    requireReceptionistPermission('enquiry'), receptionistController.openExecutiveLead);
router.post('/leads/:id/assign',  requireReceptionistPermission('enquiry'), receptionistController.assignExecutiveLeadDoctor);

// ──────────────────────────────────────────────────────────────────────────────
// Appointments  →  permission: appointment
// ──────────────────────────────────────────────────────────────────────────────
router.post('/appointments',                  requireReceptionistPermission('appointment'), receptionistController.createAppointment);
router.get('/appointments',                   requireReceptionistPermission('appointment'), receptionistController.getAppointments);
router.post('/appointments/:id/reschedule',   requireReceptionistPermission('appointment'), receptionistController.rescheduleAppointment);
router.post('/appointments/:id/reassign-doctor', requireReceptionistPermission('appointment'), receptionistController.reassignDoctor);
router.put('/appointments/:id/reassign-doctor',  requireReceptionistPermission('appointment'), receptionistController.reassignDoctor);
router.post('/appointments/:id/cancel',       requireReceptionistPermission('appointment'), receptionistController.cancelAppointment);

// ──────────────────────────────────────────────────────────────────────────────
// Check-in & Waiting Queue  →  permission: checkin
// ──────────────────────────────────────────────────────────────────────────────
router.post('/appointments/:id/checkin', requireReceptionistPermission('checkin'), receptionistController.checkinAppointment);
router.put('/appointments/:id/checkin',  requireReceptionistPermission('checkin'), receptionistController.checkinAppointment);
router.get('/checkin/waiting',           requireReceptionistPermission('checkin'), receptionistController.getWaitingQueue);

// ──────────────────────────────────────────────────────────────────────────────
// Consultation Fee & Billing  →  permission: consultation_fee_billing
// ──────────────────────────────────────────────────────────────────────────────
router.post('/billing/bills',   requireReceptionistPermission('consultation_fee_billing'), receptionistController.createConsultationBill);
router.get('/billing/bills',    requireReceptionistPermission('consultation_fee_billing'), receptionistController.getConsultationBills);
router.get('/consultation-fee', requireReceptionistPermission('consultation_fee_billing'), receptionistController.getConsultationFee);

// ──────────────────────────────────────────────────────────────────────────────
// Due Patients & Payment Collection  →  permission: due_management
// (collecting payment also requires payment_collection — both checked)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/due-patients',              requireReceptionistPermission('due_management'),    receptionistController.getDuePatients);
router.post('/due-patients/:id/collect', requireReceptionistPermission('due_management'),    receptionistController.collectDuePayment);

// ──────────────────────────────────────────────────────────────────────────────
// Renewals  →  permission: renewal
// ──────────────────────────────────────────────────────────────────────────────
router.post('/renewals', requireReceptionistPermission('renewal'), receptionistController.renewRegistration);

// ──────────────────────────────────────────────────────────────────────────────
// CRM Calls  →  permission: crm_calling
// ──────────────────────────────────────────────────────────────────────────────
router.post('/crm/calls', requireReceptionistPermission('crm_calling'), receptionistController.logCallRecord);
router.get('/crm/calls',  requireReceptionistPermission('crm_calling'), receptionistController.getCallRecords);

// ──────────────────────────────────────────────────────────────────────────────
// My Tasks (follow-ups)  →  permission: followup
// ──────────────────────────────────────────────────────────────────────────────
router.get('/my-tasks',                        requireReceptionistPermission('followup'), receptionistController.getMyTasks);
router.post('/my-tasks/:call_id/complete',     requireReceptionistPermission('followup'), receptionistController.completeTask);
router.post('/my-tasks/:call_id/reschedule',   requireReceptionistPermission('followup'), receptionistController.rescheduleTask);
router.put('/my-tasks/:call_id/reschedule',    requireReceptionistPermission('followup'), receptionistController.rescheduleTask);

module.exports = router;
