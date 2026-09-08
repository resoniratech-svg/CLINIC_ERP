import axiosClient from './axiosClient';

export const authApi = {
  login: (credentials) => axiosClient.post('/auth/login', credentials),
  logout: () => axiosClient.post('/auth/logout'),
  changePassword: (data) => axiosClient.post('/auth/change-password', data),
  forgotPassword: (data) =>
    axiosClient.post(
      '/auth/forgot-password',
      typeof data === 'string'
        ? { username_or_employee_id: data }
        : { username_or_employee_id: data.username_or_employee_id || data.identifier || data.username, ...data }
    ),
};

export const dashboardApi = {
  getDashboard: () => axiosClient.get('/dashboard'),
};

export const usersApi = {
  getUsers: (params) => axiosClient.get('/users', { params }),
  getUserById: (id) => axiosClient.get(`/users/${id}`),
  createUser: (data) => axiosClient.post('/users', data),
  updateUser: (id, data) => axiosClient.put(`/users/${id}`, data),
  updateUserStatus: (id, status) => axiosClient.patch(`/users/${id}/status`, { status }),
  deleteUser: (id) => axiosClient.delete(`/users/${id}`),
};

export const passwordResetApi = {
  getRequests: (params) => axiosClient.get('/password-resets', { params }),
  approveRequest: (id) => axiosClient.post(`/password-resets/${id}/approve`),
  rejectRequest: (id) => axiosClient.post(`/password-resets/${id}/reject`),
};

export const doctorsApi = {
  getDoctors: (params) => axiosClient.get('/doctors', { params }),
  getDoctorSummary: (id) => axiosClient.get(`/doctors/${id}/summary`),
  transferResponsibilities: (id, data) => axiosClient.post(`/doctors/${id}/transfer`, data),
};

export const targetsApi = {
  getTargets: (params) => axiosClient.get('/targets', { params }),
  setTarget: (data) => axiosClient.post('/targets', data),
  setDoctorTarget: (data) => axiosClient.post('/targets/doctor-target', data),
  getDoctorPerformance: (params) => axiosClient.get('/targets/doctor-performance', { params }),
};

export const billingApi = {
  getConsultationFees: (params) => axiosClient.get('/billing/consultation-fees', { params }),
  setConsultationFee: (data) => axiosClient.post('/billing/consultation-fees', data),
  getBillingRules: () => axiosClient.get('/billing/rules'),
  getRevenueReport: (params) => axiosClient.get('/billing/revenue', { params }),
};

export const cashApi = {
  getCashLedger: (params) => axiosClient.get('/cash/ledger', { params }),
  createExpenditure: (data) => axiosClient.post('/cash/expenditure', data),
  createCashDeposit: (data) => axiosClient.post('/cash/deposit', data),
};

export const crmApi = {
  getFollowups: (params) => axiosClient.get('/crm/followups', { params }),
  createFollowup: (data) => axiosClient.post('/crm/followups', data),
  getAcqPatients: (params) => axiosClient.get('/pro/acq', { params }),
  createAcqPatient: (data) => axiosClient.post('/crm/acq', data),
  markOcNrPatient: (data) => axiosClient.post('/crm/ocnr', data),
  createReferral: (data) => axiosClient.post('/crm/referrals', data),
};

export const callCenterApi = {
  searchPatientInbound: (data) => axiosClient.post('/callcenter/inbound/search', data),
  createLead: (data) => axiosClient.post('/callcenter/leads', data),
  importOutboundLeads: (data) => axiosClient.post('/callcenter/outbound/import', data),
  getExecutiveIncentives: (params) => axiosClient.get('/callcenter/executive-incentives', { params }),
};

export const pharmacyApi = {
  // 1. Dashboard
  getDashboard: () => axiosClient.get('/pharmacy/dashboard'),

  // 2. Prescription Queue & Processing
  getPrescriptionQueue: (params) => axiosClient.get('/pharmacy/queue', { params }),
  processPrescription: (id) => axiosClient.get(`/pharmacy/prescriptions/${id}/process`),
  checkPrescriptionStock: (id) => axiosClient.get(`/pharmacy/prescriptions/${id}/stock-check`),
  getMedicineBatches: (medicineId) => axiosClient.get(`/pharmacy/medicines/${medicineId}/batches`),
  selectBatch: (itemId, data) => axiosClient.put(`/pharmacy/prescriptions/items/${itemId}/select-batch`, data),
  modifyPrescriptionItemDays: (itemId, data) => axiosClient.post(`/pharmacy/prescriptions/items/${itemId}/modify-days`, data),
  getItemModifications: (itemId) => axiosClient.get(`/pharmacy/prescriptions/items/${itemId}/modifications`),
  updateItemDispenseStatus: (itemId, data) => axiosClient.put(`/pharmacy/prescriptions/items/${itemId}/status`, data),
  saveDispenseDraft: (id, data) => axiosClient.post(`/pharmacy/prescriptions/${id}/dispense/draft`, data),
  completeDispensing: (id, data) => axiosClient.post(`/pharmacy/prescriptions/${id}/dispense/complete`, data),

  // 3. Clarification Workflow
  createClarification: (data) => axiosClient.post('/pharmacy/clarifications', data),
  getClarifications: (params) => axiosClient.get('/pharmacy/clarifications', { params }),
  closeClarification: (id, data) => axiosClient.put(`/pharmacy/clarifications/${id}/close`, data),

  // 4. Inventory & Medicine Master
  getMedicines: (params) => axiosClient.get('/pharmacy/medicines', { params }),
  getNextMedicineSerial: () => axiosClient.get('/pharmacy/medicines/next-serial'),
  createMedicine: (data) => axiosClient.post('/pharmacy/medicines', data),
  updateMedicine: (id, data) => axiosClient.put(`/pharmacy/medicines/${id}`, data),
  getMedicineStockDetail: (id) => axiosClient.get(`/pharmacy/medicines/${id}/stock`),
  previewMedicineImport: (data, config) => axiosClient.post('/pharmacy/medicines/import/preview', data, config),
  confirmMedicineImport: (data) => axiosClient.post('/pharmacy/medicines/import/confirm', data),

  // 5. Stock & Excel Import
  getStock: (params) => axiosClient.get('/pharmacy/stock', { params }),
  addStock: (data) => axiosClient.post('/pharmacy/stock', data),
  previewStockImport: (data, config) => axiosClient.post('/pharmacy/stock/import/preview', data, config),
  confirmStockImport: (data) => axiosClient.post('/pharmacy/stock/import/confirm', data),
  getImportHistory: () => axiosClient.get('/pharmacy/stock/import/history'),
  getImportBatchDetail: (batchId) => axiosClient.get(`/pharmacy/stock/import/${batchId}`),

  // 6. Stock Alerts
  getLowStock: (params) => axiosClient.get('/pharmacy/stock/low-stock', { params }),
  getExpiringStock: (params) => axiosClient.get('/pharmacy/stock/expiring', { params }),
  getExpiredStock: (params) => axiosClient.get('/pharmacy/stock/expired', { params }),
  getOutOfStock: (params) => axiosClient.get('/pharmacy/stock/out-of-stock', { params }),

  // 7. Transactions & Adjustments
  getStockTransactions: (params) => axiosClient.get('/pharmacy/stock/transactions', { params }),
  createStockAdjustment: (data) => axiosClient.post('/pharmacy/stock/adjustments', data),
  getStockAdjustments: (params) => axiosClient.get('/pharmacy/stock/adjustments', { params }),
  approveStockAdjustment: (id) => axiosClient.post(`/pharmacy/stock/adjustments/${id}/approve`),
  rejectStockAdjustment: (id) => axiosClient.post(`/pharmacy/stock/adjustments/${id}/reject`),

  // 8. Medicine Returns
  createMedicineReturn: (data) => axiosClient.post('/pharmacy/returns', data),
  getMedicineReturns: (params) => axiosClient.get('/pharmacy/returns', { params }),

  // 9. Dispensing History & Patient Search
  getDispensingHistory: (params) => axiosClient.get('/pharmacy/dispensing/history', { params }),
  searchPatients: (params) => axiosClient.get('/pharmacy/patients/search', { params }),

  // 10. Pharmacy Profile
  getProfile: () => axiosClient.get('/pharmacy/profile'),
  updateProfile: (data) => axiosClient.put('/pharmacy/profile', data),
};

export const reportsApi = {
  getPatientReport: () => axiosClient.get('/reports/patients'),
  getRevenueReport: () => axiosClient.get('/reports/revenue'),
  getTargetReport: (params) => axiosClient.get('/reports/target', { params }),
  getExecutiveReport: () => axiosClient.get('/reports/executive'),
  getPharmacyReport: () => axiosClient.get('/reports/pharmacy'),
  getCrmReport: () => axiosClient.get('/reports/crm'),
};

export const logsApi = {
  getAuditLogs: (params) => axiosClient.get('/logs/audit', { params }),
  getLoginLogs: (params) => axiosClient.get('/logs/login', { params }),
};

export const settingsApi = {
  getPermissionsMatrix: () => axiosClient.get('/settings/permissions-matrix'),
  updatePermissionsMatrix: (data) => axiosClient.post('/settings/permissions-matrix', data),
  getHospitalSettings: () => axiosClient.get('/settings/hospital'),
  updateHospitalSettings: (data) => axiosClient.put('/settings/hospital', data),
  getMasterData: (type) => axiosClient.get(`/settings/masters/${type}`),
  addMasterData: (type, data) => axiosClient.post(`/settings/masters/${type}`, data),
};

export const receptionistApi = {
  getDashboard: () => axiosClient.get('/receptionist/dashboard'),
  searchPatients: (params) => axiosClient.get('/receptionist/patients/search', { params }),
  getPatientOverview: (id) => axiosClient.get(`/receptionist/patients/${id}/overview`),
  registerPatient: (data) => axiosClient.post('/receptionist/patients/register', data),
  getEnquiries: (params) => axiosClient.get('/receptionist/enquiries', { params }),
  createEnquiry: (data) => axiosClient.post('/receptionist/enquiries', data),
  getEmployeeReferrals: (params) => axiosClient.get('/receptionist/referrals/employee', { params }),
  createEmployeeReferral: (data) => axiosClient.post('/receptionist/referrals/employee', data),
  getPatientReferrals: (params) => axiosClient.get('/receptionist/referrals/patient', { params }),
  createPatientReferral: (data) => axiosClient.post('/receptionist/referrals/patient', data),
  getEmployees: (params) => axiosClient.get('/receptionist/employees', { params }),
  getExecutiveLeads: (params) => axiosClient.get('/receptionist/leads', { params }),
  openExecutiveLead: (id) => axiosClient.post(`/receptionist/leads/${id}/open`),
  assignExecutiveLeadDoctor: (id, data) => axiosClient.post(`/receptionist/leads/${id}/assign`, data),
  getActiveDoctors: (params) => axiosClient.get('/receptionist/doctors', { params }),
  getAppointments: (params) => axiosClient.get('/receptionist/appointments', { params }),
  createAppointment: (data) => axiosClient.post('/receptionist/appointments', data),
  rescheduleAppointment: (id, data) => axiosClient.post(`/receptionist/appointments/${id}/reschedule`, data),
  cancelAppointment: (id, data) => axiosClient.post(`/receptionist/appointments/${id}/cancel`, data),
  getConsultationBills: (params) => axiosClient.get('/receptionist/billing/bills', { params }),
  getPatientInvoices: (id) => axiosClient.get(`/receptionist/patients/${id}/invoices`),
  createConsultationBill: (data) => axiosClient.post('/receptionist/billing/bills', data),
  checkinAppointment: (id) => axiosClient.post(`/receptionist/appointments/${id}/checkin`),
  getWaitingQueue: () => axiosClient.get('/receptionist/checkin/waiting'),
  renewRegistration: (data) => axiosClient.post('/receptionist/renewals', data),
  getDuePatients: (params) => axiosClient.get('/receptionist/due-patients', { params }),
  collectDuePayment: (id, data) => axiosClient.post(`/receptionist/due-patients/${id}/collect`, data),
  getCallRecords: (params) => axiosClient.get('/receptionist/crm/calls', { params }),
  logCallRecord: (data) => axiosClient.post('/receptionist/crm/calls', data),
  getMyTasks: (params) => axiosClient.get('/receptionist/my-tasks', { params }),
  completeTask: (id) => axiosClient.post(`/receptionist/my-tasks/${id}/complete`),
  rescheduleTask: (id, data) => axiosClient.post(`/receptionist/my-tasks/${id}/reschedule`, data),
};

export const doctorApi = {
  // Dashboard
  getDashboard: () => axiosClient.get('/doctor/dashboard'),

  // Appointments & Queue
  getTodayAppointments: (params) => axiosClient.get('/doctor/appointments/today', { params }),
  getPatientQueue: () => axiosClient.get('/doctor/queue'),

  // Patients
  getPatients: (params) => axiosClient.get('/doctor/patients', { params }),
  getPatientOverview: (id) => axiosClient.get(`/doctor/patients/${id}/overview`),

  // Consultation Lifecycle
  startConsultation: (data) => axiosClient.post('/doctor/consultations/start', data),
  updateConsultation: (id, data) => axiosClient.put(`/doctor/consultations/${id}`, data),
  getConsultationSummary: (id) => axiosClient.get(`/doctor/consultations/${id}/summary`),
  saveDraft: (id) => axiosClient.post(`/doctor/consultations/${id}/save-draft`, {}),
  completeConsultation: (data) => axiosClient.post('/doctor/consultations/complete', data),
  getConsultationHistory: (params) => axiosClient.get('/doctor/consultations', { params }),
  getConsultationDetails: (id) => axiosClient.get(`/doctor/consultations/${id}`),

  // Prescriptions
  createPrescription: (data) => axiosClient.post('/doctor/prescriptions', data),
  getMyPrescriptions: (params) => axiosClient.get('/doctor/prescriptions/mine', { params }),
  getPrescriptionDetails: (id) => axiosClient.get(`/doctor/prescriptions/${id}`),

  // Treatment Plans
  createTreatmentPlan: (data) => axiosClient.post('/doctor/treatment-plans', data),
  getMyTreatmentPlans: (params) => axiosClient.get('/doctor/treatment-plans/mine', { params }),
  getTreatmentPlanDetails: (id) => axiosClient.get(`/doctor/treatment-plans/${id}`),
  updateTreatmentPlan: (id, data) => axiosClient.put(`/doctor/treatment-plans/${id}`, data),

  // Diagnosis Search
  searchDiagnoses: (q) => axiosClient.get('/doctor/diagnoses/search', { params: { q } }),

  // Targets (view-only)
  getMyTargets: (params) => axiosClient.get('/doctor/targets/mine', { params }),

  // Profile & Schedule
  getProfile: () => axiosClient.get('/doctor/profile'),
  updateProfile: (data) => axiosClient.put('/doctor/profile', data),
  getSchedule: () => axiosClient.get('/doctor/schedule'),

  // Leaves
  applyLeave: (data) => axiosClient.post('/doctor/leaves', data),
  getMyLeaves: () => axiosClient.get('/doctor/leaves/mine'),

  // Prescription Clarifications
  getClarifications: (params) => axiosClient.get('/doctor/clarifications', { params }),
  respondToClarification: (id, data) => axiosClient.post(`/doctor/clarifications/${id}/respond`, data),
};

export const executiveApi = {
  getDashboard: () => axiosClient.get('/executive/dashboard'),
  searchPatientInbound: (params) => axiosClient.get('/executive/patients/search', { params }),
  searchPatientInboundPost: (data) => axiosClient.post('/executive/inbound/search', data),
  createLead: (data) => axiosClient.post('/executive/leads', data),
  updateLead: (id, data) => axiosClient.put(`/executive/leads/${id}`, data),
  updateOutboundLead: (id, data) => axiosClient.put(`/executive/outbound/leads/${id}`, data),
  importOutboundLeads: (data) => axiosClient.post('/executive/outbound/import', data),
  getOutboundQueue: () => axiosClient.get('/executive/outbound/queue'),
  recordCallOutcome: (data) => axiosClient.post('/executive/calls/outcome', data),
  updateCallRecord: (id, data) => axiosClient.put(`/executive/calls/${id}`, data),
  getCallbacks: () => axiosClient.get('/executive/callbacks'),
  getLeads: (params) => axiosClient.get('/executive/leads', { params }),
  getLeadDetails: (id) => axiosClient.get(`/executive/leads/${id}`),
  getCallHistory: (params) => axiosClient.get('/executive/calls/history', { params }),
  getIncentives: (params) => axiosClient.get('/executive/incentives', { params }),
  getExecutivePerformanceReport: (params) => axiosClient.get('/executive/performance', { params }),
};

export const proApi = {
  // 1. Dashboard
  getDashboard: () => axiosClient.get('/pro/dashboard'),

  // 2. Patient Queue & Search
  getPatientQueue: (params) => axiosClient.get('/pro/queue', { params }),
  searchPatients: (params) => axiosClient.get('/pro/patients/search', { params }),

  // 3. Patient Overview (360°)
  getPatientOverview: (id) => axiosClient.get(`/pro/patients/${id}/overview`),

  // 4. Counselling
  createCounselling: (data) => axiosClient.post('/pro/counselling', data),
  getCounsellingHistory: (params) => axiosClient.get('/pro/counselling', { params }),

  // 5. Packages / Plans
  createPackage: (data) => axiosClient.post('/pro/packages', data),
  getPackages: (params) => axiosClient.get('/pro/packages', { params }),
  updatePackageStatus: (id, data) => axiosClient.put(`/pro/packages/${id}/status`, data),

  // 6. Prescription Review & Modification
  getPrescriptionDetails: (id) => axiosClient.get(`/pro/prescriptions/${id}`),
  modifyPrescriptionItem: (itemId, data) => axiosClient.post(`/pro/prescriptions/items/${itemId}/modify`, data),
  getPrescriptionItemModifications: (itemId) => axiosClient.get(`/pro/prescriptions/items/${itemId}/modifications`),

  // 7. Billing
  createBill: (data) => axiosClient.post('/pro/bills', data),
  getPendingBills: (params) => axiosClient.get('/pro/bills/pending', { params }),
  getPaidBills: (params) => axiosClient.get('/pro/bills/paid', { params }),
  getPartialDueBills: (params) => axiosClient.get('/pro/bills/partial-due', { params }),
  getBillingHistory: (params) => axiosClient.get('/pro/bills/history', { params }),

  // 8. Payments
  recordPayment: (data) => axiosClient.post('/pro/payments', data),
  refundPayment: (id) => axiosClient.post(`/pro/payments/${id}/refund`),
  getTodayPayments: (params) => axiosClient.get('/pro/payments/today', { params }),
  getDueCollections: (params) => axiosClient.get('/pro/payments/due-collection', { params }),
  getPaymentHistory: (params) => axiosClient.get('/pro/payments/history', { params }),

  // 9. CRM / Calling & Renewals & Dues & ACQ & OC/NR
  createCall: (data) => axiosClient.post('/pro/calls', data),
  getTodayCalls: (params) => axiosClient.get('/pro/calls', { params }),
  createFollowup: (data) => axiosClient.post('/pro/followups', data),
  getFollowups: (params) => axiosClient.get('/pro/followups', { params }),
  updateFollowupStatus: (id, data) => axiosClient.put(`/pro/followups/${id}/status`, data),
  completeFollowup: (id, data) => axiosClient.post(`/pro/followups/${id}/complete`, data),
  getRenewalsQueue: (params) => axiosClient.get('/pro/renewals/queue', { params }),
  createRenewal: (data) => axiosClient.post('/pro/renewals', data),
  getDuePatients: (params) => axiosClient.get('/pro/due-patients', { params }),
  getACQPatients: (params) => axiosClient.get('/pro/acq', { params }),
  updateACQPatient: (id, data) => axiosClient.put(`/pro/acq/${id}`, data),
  getOCNRPatients: (params) => axiosClient.get('/pro/ocnr', { params }),
  createOCNRPatient: (data) => axiosClient.post('/pro/ocnr', data),

  // 10. My Tasks
  getMyTasks: (params) => axiosClient.get('/pro/my-tasks', { params }),
  completeTask: (callId, data) => axiosClient.post(`/pro/my-tasks/${callId}/complete`, data),
  rescheduleTask: (callId, data) => axiosClient.post(`/pro/my-tasks/${callId}/reschedule`, data),

  // 11. Accountant / Cash Management
  getOpeningBalance: (params) => axiosClient.get('/pro/accountant/opening-balance', { params }),
  getCashRevenue: (params) => axiosClient.get('/pro/accountant/cash-revenue', { params }),
  createExpenditure: (data) => axiosClient.post('/pro/accountant/expenditure', data),
  getClosingBalance: (params) => axiosClient.get('/pro/accountant/closing-balance', { params }),
  depositCash: (data) => axiosClient.post('/pro/accountant/deposit', data),
  getDailyCashSummary: (params) => axiosClient.get('/pro/accountant/daily-summary', { params }),
  getGrandTotal: (params) => axiosClient.get('/pro/accountant/grand-total', { params }),

  // 12. Feedback & Complaints
  createFeedback: (data) => axiosClient.post('/pro/feedback', data),
  getFeedback: (params) => axiosClient.get('/pro/feedback', { params }),
  createComplaint: (data) => axiosClient.post('/pro/complaints', data),
  updateComplaint: (id, data) => axiosClient.put(`/pro/complaints/${id}`, data),
  getComplaints: (params) => axiosClient.get('/pro/complaints', { params }),

  // 13. PRO Completion & History
  getPROChecklist: (patientId) => axiosClient.get(`/pro/patients/${patientId}/pro-checklist`),
  completePRO: (patientId) => axiosClient.post(`/pro/patients/${patientId}/complete-pro`),
  getPatientHistory: (patientId) => axiosClient.get(`/pro/patients/${patientId}/history`),

  // 13b. Invoice / Bill Details & Reports
  getBillDetails: (billId) => axiosClient.get(`/pro/bills/${billId}`),
  getOperationalReports: (params) => axiosClient.get('/pro/reports/operational', { params }),

  // 14. PRO Profile
  getProfile: () => axiosClient.get('/pro/profile'),
  updateProfile: (data) => axiosClient.put('/pro/profile', data)
};
