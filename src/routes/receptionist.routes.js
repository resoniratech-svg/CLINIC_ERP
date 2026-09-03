const express = require('express');
const router = express.Router();
const receptionistController = require('../controllers/receptionist.controller');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// All Receptionist routes require authentication and Receptionist or Super Admin role
router.use(authenticateToken);
router.use(authorizeRoles('receptionist', 'super_admin'));

// 3.2 Dashboard
router.get('/dashboard', receptionistController.getDashboard);

// 3.3 Patient Search & 3.4 Overview
router.get('/patients/search', receptionistController.searchPatients);
router.get('/patients/:id/overview', receptionistController.getPatientOverview);

// 3.5 New Patient Registration
router.post('/patients/register', receptionistController.registerPatient);
router.post('/register-walkin', receptionistController.registerPatient);
router.post('/register', receptionistController.registerPatient);

// 3.6 Enquiries
router.post('/enquiries', receptionistController.createEnquiry);
router.get('/enquiries', receptionistController.getEnquiries);

// 3.7 Referrals
router.post('/referrals/employee', receptionistController.createEmployeeReferral);
router.get('/referrals/employee', receptionistController.getEmployeeReferrals);
router.post('/referrals/patient', receptionistController.createPatientReferral);
router.get('/referrals/patient', receptionistController.getPatientReferrals);

// 3.8 Executive Lead Queue
router.get('/leads', receptionistController.getExecutiveLeads);
router.post('/leads/:id/open', receptionistController.openExecutiveLead);

// 3.9 Doctor Assignment
router.get('/doctors', receptionistController.getActiveDoctors);

// 3.10 Appointments
router.post('/appointments', receptionistController.createAppointment);
router.get('/appointments', receptionistController.getAppointments);
router.post('/appointments/:id/reschedule', receptionistController.rescheduleAppointment);
router.post('/appointments/:id/cancel', receptionistController.cancelAppointment);

// 3.11 Consultation Fee Billing
router.post('/billing/bills', receptionistController.createConsultationBill);
router.get('/billing/bills', receptionistController.getConsultationBills);
router.get('/consultation-fee', receptionistController.getConsultationFee);

// 3.13 Check-in & Waiting Queue
router.post('/appointments/:id/checkin', receptionistController.checkinAppointment);
router.put('/appointments/:id/checkin', receptionistController.checkinAppointment);
router.get('/checkin/waiting', receptionistController.getWaitingQueue);

// 3.14 Renewals
router.post('/renewals', receptionistController.renewRegistration);

// 3.15 Due Patients
router.get('/due-patients', receptionistController.getDuePatients);
router.post('/due-patients/:id/collect', receptionistController.collectDuePayment);

// 3.16 CRM Calls
router.post('/crm/calls', receptionistController.logCallRecord);
router.get('/crm/calls', receptionistController.getCallRecords);

// 3.17 My Tasks
router.get('/my-tasks', receptionistController.getMyTasks);
router.post('/my-tasks/:call_id/complete', receptionistController.completeTask);
router.post('/my-tasks/:call_id/reschedule', receptionistController.rescheduleTask);
router.put('/my-tasks/:call_id/reschedule', receptionistController.rescheduleTask);

module.exports = router;
