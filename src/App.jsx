import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Layouts
import { SuperAdminLayout } from './components/layout/SuperAdminLayout';
import { ReceptionistLayout } from './components/layout/ReceptionistLayout';
import { ExecutiveLayout } from './components/layout/ExecutiveLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';

// Executive Pages
import { ExecutiveDashboard } from './pages/executive/ExecutiveDashboard';
import { InboundCallsPage } from './pages/executive/InboundCallsPage';
import { OutboundQueuePage } from './pages/executive/OutboundQueuePage';
import { ExcelImportPage } from './pages/executive/ExcelImportPage';
import { OutboundHistoryPage } from './pages/executive/OutboundHistoryPage';
import { ExecutiveLeadsPage } from './pages/executive/ExecutiveLeadsPage';
import { CallbacksPage } from './pages/executive/CallbacksPage';
import { ExecutiveCallHistoryPage } from './pages/executive/ExecutiveCallHistoryPage';
import { ExecutiveIncentivesPage } from './pages/executive/ExecutiveIncentivesPage';
import { ExecutivePatientsPage } from './pages/executive/ExecutivePatientsPage';
import { ExecutiveProfilePage } from './pages/executive/ExecutiveProfilePage';

// Super Admin Pages
import { SuperAdminDashboard } from './pages/dashboard/SuperAdminDashboard';
import { AllUsersPage } from './pages/users/AllUsersPage';
import { PasswordResetsPage } from './pages/users/PasswordResetsPage';
import { DoctorsListPage } from './pages/doctors/DoctorsListPage';
import { PatientsMonitoringPage } from './pages/patients/PatientsMonitoringPage';
import { AppointmentsPage } from './pages/appointments/AppointmentsPage';
import { TargetManagementPage } from './pages/targets/TargetManagementPage';
import { DoctorPerformancePage } from './pages/targets/DoctorPerformancePage';
import { BillingConfigPage } from './pages/billing/BillingConfigPage';
import { RevenueSummaryPage } from './pages/billing/RevenueSummaryPage';
import { CashLedgerPage } from './pages/billing/CashLedgerPage';
import { CRMManagementPage } from './pages/crm/CRMManagementPage';
import { AcqPatientsPage } from './pages/crm/AcqPatientsPage';
import { OcNrPatientsPage } from './pages/crm/OcNrPatientsPage';
import { CallCenterPage } from './pages/callcenter/CallCenterPage';
import { MedicineMasterPage } from './pages/pharmacy/MedicineMasterPage';
import { StockMonitoringPage } from './pages/pharmacy/StockMonitoringPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { RolesPermissionsPage } from './pages/settings/RolesPermissionsPage';
import { HospitalSettingsPage } from './pages/settings/HospitalSettingsPage';
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage';
import { AuditLogsPage } from './pages/logs/AuditLogsPage';
import { LoginHistoryPage } from './pages/logs/LoginHistoryPage';

// Receptionist Pages
import { ReceptionistDashboard } from './pages/receptionist/ReceptionistDashboard';
import { PatientSearchPage } from './pages/receptionist/PatientSearchPage';
import { NewRegistrationPage } from './pages/receptionist/NewRegistrationPage';
import { RenewalsPage } from './pages/receptionist/RenewalsPage';
import { EnquiriesPage } from './pages/receptionist/EnquiriesPage';
import { ExecutiveLeadsQueuePage } from './pages/receptionist/ExecutiveLeadsQueuePage';
import { EmployeeReferralsPage } from './pages/receptionist/EmployeeReferralsPage';
import { PatientReferralsPage } from './pages/receptionist/PatientReferralsPage';
import { ReceptionistAppointmentsPage } from './pages/receptionist/ReceptionistAppointmentsPage';
import { CheckinQueuePage } from './pages/receptionist/CheckinQueuePage';
import { ConsultationBillingPage } from './pages/receptionist/ConsultationBillingPage';
import { DuePatientsPage } from './pages/receptionist/DuePatientsPage';
import { ReceptionistCrmPage } from './pages/receptionist/ReceptionistCrmPage';
import { MyTasksPage } from './pages/receptionist/MyTasksPage';
import { ReceptionistProfilePage } from './pages/receptionist/ReceptionistProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Super Admin Portal Routes */}
          <Route path="/" element={<SuperAdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<SuperAdminDashboard />} />

            {/* Users */}
            <Route path="users" element={<AllUsersPage />} />
            <Route path="users/password-resets" element={<PasswordResetsPage />} />

            {/* Doctors */}
            <Route path="doctors" element={<DoctorsListPage />} />
            <Route path="doctors/transfer" element={<DoctorsListPage />} />

            {/* Patients & Appointments */}
            <Route path="patients" element={<PatientsMonitoringPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />

            {/* Targets */}
            <Route path="targets" element={<TargetManagementPage />} />
            <Route path="targets/doctor-performance" element={<DoctorPerformancePage />} />

            {/* Billing & Finance */}
            <Route path="billing" element={<Navigate to="/billing/config" replace />} />
            <Route path="billing/config" element={<BillingConfigPage />} />
            <Route path="billing/revenue" element={<RevenueSummaryPage />} />
            <Route path="billing/cash" element={<CashLedgerPage />} />

            {/* CRM */}
            <Route path="crm" element={<CRMManagementPage />} />
            <Route path="crm/acq" element={<AcqPatientsPage />} />
            <Route path="crm/ocnr" element={<OcNrPatientsPage />} />

            {/* Call Center */}
            <Route path="callcenter" element={<CallCenterPage />} />
            <Route path="callcenter/import" element={<CallCenterPage />} />
            <Route path="callcenter/incentives" element={<CallCenterPage />} />

            {/* Pharmacy */}
            <Route path="pharmacy" element={<MedicineMasterPage />} />
            <Route path="pharmacy/stock" element={<StockMonitoringPage />} />

            {/* Reports */}
            <Route path="reports" element={<ReportsPage />} />

            {/* Settings */}
            <Route path="settings/profile" element={<ProfileSettingsPage />} />
            <Route path="settings/permissions" element={<RolesPermissionsPage />} />
            <Route path="settings/hospital" element={<HospitalSettingsPage />} />

            {/* Logs */}
            <Route path="logs/audit" element={<AuditLogsPage />} />
            <Route path="logs/login" element={<LoginHistoryPage />} />
          </Route>

          {/* Protected Receptionist Portal Routes */}
          <Route path="/receptionist" element={<ReceptionistLayout />}>
            <Route index element={<Navigate to="/receptionist/dashboard" replace />} />
            <Route path="dashboard" element={<ReceptionistDashboard />} />

            {/* Patient Registration */}
            <Route path="patients" element={<PatientSearchPage />} />
            <Route path="patients/register" element={<NewRegistrationPage />} />
            <Route path="renewals" element={<RenewalsPage />} />

            {/* Enquiries & Leads */}
            <Route path="enquiries" element={<EnquiriesPage />} />
            <Route path="leads" element={<ExecutiveLeadsQueuePage />} />

            {/* Referrals */}
            <Route path="referrals/employee" element={<EmployeeReferralsPage />} />
            <Route path="referrals/patient" element={<PatientReferralsPage />} />

            {/* Appointments */}
            <Route path="appointments" element={<ReceptionistAppointmentsPage />} />
            <Route path="check-in" element={<CheckinQueuePage />} />

            {/* Billing & Dues */}
            <Route path="billing" element={<ConsultationBillingPage />} />
            <Route path="due-patients" element={<DuePatientsPage />} />

            {/* CRM & Tasks */}
            <Route path="crm" element={<ReceptionistCrmPage />} />
            <Route path="tasks" element={<MyTasksPage />} />

            {/* Profile */}
            <Route path="profile" element={<ReceptionistProfilePage />} />
          </Route>

          {/* Protected Executive / Call Center Portal Routes */}
          <Route path="/executive" element={<ExecutiveLayout />}>
            <Route index element={<Navigate to="/executive/dashboard" replace />} />
            <Route path="dashboard" element={<ExecutiveDashboard />} />

            {/* My Calls */}
            <Route path="calls/inbound" element={<InboundCallsPage />} />
            <Route path="calls/outbound" element={<OutboundQueuePage />} />
            <Route path="calls/today" element={<ExecutiveCallHistoryPage />} />
            <Route path="calls/history" element={<ExecutiveCallHistoryPage />} />

            {/* Outbound Data */}
            <Route path="outbound/queue" element={<OutboundQueuePage />} />
            <Route path="outbound/import" element={<ExcelImportPage />} />
            <Route path="outbound/history" element={<OutboundHistoryPage />} />

            {/* Leads */}
            <Route path="leads" element={<ExecutiveLeadsPage />} />
            <Route path="leads/new" element={<ExecutiveLeadsPage />} />
            <Route path="leads/interested" element={<ExecutiveLeadsPage />} />
            <Route path="leads/not-interested" element={<ExecutiveLeadsPage />} />
            <Route path="leads/history" element={<ExecutiveLeadsPage />} />

            {/* Callbacks */}
            <Route path="callbacks" element={<CallbacksPage />} />

            {/* Patients */}
            <Route path="patients" element={<ExecutivePatientsPage />} />

            {/* Incentives */}
            <Route path="incentives" element={<ExecutiveIncentivesPage />} />

            {/* Profile */}
            <Route path="profile" element={<ExecutiveProfilePage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
