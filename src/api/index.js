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
  getMedicines: (params) => axiosClient.get('/pharmacy/medicines', { params }),
  createMedicine: (data) => axiosClient.post('/pharmacy/medicines', data),
  getStock: (params) => axiosClient.get('/pharmacy/stock', { params }),
  addStock: (data) => axiosClient.post('/pharmacy/stock', data),
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
