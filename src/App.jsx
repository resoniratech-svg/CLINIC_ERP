import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PermissionGate } from './components/common/PermissionGate';

// Layouts
import { SuperAdminLayout } from './components/layout/SuperAdminLayout';
import { ReceptionistLayout } from './components/layout/ReceptionistLayout';
import { ExecutiveLayout } from './components/layout/ExecutiveLayout';
import { DoctorLayout } from './components/layout/DoctorLayout';
import { PROLayout } from './components/layout/PROLayout';
import { PharmacyLayout } from './components/layout/PharmacyLayout';

// PRO Pages
import { PRODashboard } from './pages/pro/PRODashboard';
import { PROPatientQueuePage } from './pages/pro/PROPatientQueuePage';
import { PROPatientOverviewPage } from './pages/pro/PROPatientOverviewPage';
import { PROPackagesPage } from './pages/pro/PROPackagesPage';
import { PROPrescriptionPage } from './pages/pro/PROPrescriptionPage';
import { PROBillingPage } from './pages/pro/PROBillingPage';
import { PROPaymentsPage } from './pages/pro/PROPaymentsPage';
import { PROAccountantPage } from './pages/pro/PROAccountantPage';
import { PROCRMPage } from './pages/pro/PROCRMPage';
import { PROTasksPage } from './pages/pro/PROTasksPage';
import { PROFeedbackPage } from './pages/pro/PROFeedbackPage';
import { PROComplaintsPage } from './pages/pro/PROComplaintsPage';
import { PROProfilePage } from './pages/pro/PROProfilePage';

// Doctor Pages
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { PatientQueuePage } from './pages/doctor/PatientQueuePage';
import { DoctorAppointmentsPage } from './pages/doctor/DoctorAppointmentsPage';
import { DoctorPatientsPage } from './pages/doctor/DoctorPatientsPage';
import { ConsultationPage } from './pages/doctor/ConsultationPage';
import { ConsultationHistoryPage } from './pages/doctor/ConsultationHistoryPage';
import { DoctorPrescriptionsPage } from './pages/doctor/DoctorPrescriptionsPage';
import { TreatmentPlansPage } from './pages/doctor/TreatmentPlansPage';
import { DoctorTargetsPage } from './pages/doctor/DoctorTargetsPage';
import { DoctorLeavesPage } from './pages/doctor/DoctorLeavesPage';
import { DoctorProfilePage } from './pages/doctor/DoctorProfilePage';

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
// Super Admin Pharmacy Pages
import { MedicineMasterPage } from './pages/pharmacy/MedicineMasterPage';
import { StockMonitoringPage } from './pages/pharmacy/StockMonitoringPage';

// Dedicated Pharmacy Portal Pages
import { PharmacyDashboard } from './pages/pharmacy/PharmacyDashboard';
import { PrescriptionQueuePage } from './pages/pharmacy/PrescriptionQueuePage';
import { ProcessPrescriptionPage } from './pages/pharmacy/ProcessPrescriptionPage';
import { PharmacyDispensingHubPage } from './pages/pharmacy/PharmacyDispensingHubPage';
import { PharmacyInventoryHubPage } from './pages/pharmacy/PharmacyInventoryHubPage';
import { StockTransactionsPage } from './pages/pharmacy/StockTransactionsPage';
import { MedicineReturnsPage } from './pages/pharmacy/MedicineReturnsPage';
import { StockAdjustmentsPage } from './pages/pharmacy/StockAdjustmentsPage';
import { PrescriptionClarificationsPage } from './pages/pharmacy/PrescriptionClarificationsPage';
import { PharmacyPatientsPage } from './pages/pharmacy/PharmacyPatientsPage';
import { PharmacyProfilePage } from './pages/pharmacy/PharmacyProfilePage';
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

            {/* Pharmacy Master (Super Admin) */}
            <Route path="pharmacy-master" element={<Navigate to="/pharmacy-master/medicine-formularies" replace />} />
            <Route path="pharmacy-master/medicine-formularies" element={<MedicineMasterPage />} />
            <Route path="pharmacy-master/medicines" element={<Navigate to="/pharmacy-master/medicine-formularies" replace />} />
            <Route path="pharmacy-master/stock" element={<StockMonitoringPage />} />

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

            {/* Patient Registration — permission: registration */}
            <Route path="patients" element={
              <PermissionGate permission="registration">
                <PatientSearchPage />
              </PermissionGate>
            } />
            <Route path="patients/register" element={
              <PermissionGate permission="registration">
                <NewRegistrationPage />
              </PermissionGate>
            } />

            {/* Renewals — permission: renewal */}
            <Route path="renewals" element={
              <PermissionGate permission="renewal">
                <RenewalsPage />
              </PermissionGate>
            } />

            {/* Enquiries & Leads — permission: enquiry */}
            <Route path="enquiries" element={
              <PermissionGate permission="enquiry">
                <EnquiriesPage />
              </PermissionGate>
            } />
            <Route path="leads" element={
              <PermissionGate permission="enquiry">
                <ExecutiveLeadsQueuePage />
              </PermissionGate>
            } />

            {/* Referrals — no separate permission gate (tied to general receptionist access) */}
            <Route path="referrals/employee" element={<EmployeeReferralsPage />} />
            <Route path="referrals/patient" element={<PatientReferralsPage />} />

            {/* Appointments — permission: appointment */}
            <Route path="appointments" element={
              <PermissionGate permission="appointment">
                <ReceptionistAppointmentsPage />
              </PermissionGate>
            } />

            {/* Check-in — permission: checkin */}
            <Route path="check-in" element={
              <PermissionGate permission="checkin">
                <CheckinQueuePage />
              </PermissionGate>
            } />

            {/* Consultation Billing — permission: consultation_fee_billing */}
            <Route path="billing" element={
              <PermissionGate permission="consultation_fee_billing">
                <ConsultationBillingPage />
              </PermissionGate>
            } />

            {/* Due Patients — permission: due_management */}
            <Route path="due-patients" element={
              <PermissionGate permission="due_management">
                <DuePatientsPage />
              </PermissionGate>
            } />

            {/* CRM — permission: crm_calling */}
            <Route path="crm" element={
              <PermissionGate permission="crm_calling">
                <ReceptionistCrmPage />
              </PermissionGate>
            } />

            {/* Tasks / Follow-ups — permission: followup */}
            <Route path="tasks" element={
              <PermissionGate permission="followup">
                <MyTasksPage />
              </PermissionGate>
            } />

            {/* Profile — always accessible */}
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


          {/* Protected Doctor Portal Routes */}
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<Navigate to="/doctor/dashboard" replace />} />
            <Route path="dashboard" element={<DoctorDashboard />} />

            {/* Consultation Workflow */}
            <Route path="queue" element={<PatientQueuePage />} />
            <Route path="appointments" element={<DoctorAppointmentsPage />} />
            <Route path="consultation/:id" element={<ConsultationPage />} />

            {/* Patients */}
            <Route path="patients" element={<DoctorPatientsPage />} />

            {/* Clinical Records */}
            <Route path="consultations" element={<ConsultationHistoryPage />} />
            <Route path="prescriptions" element={<DoctorPrescriptionsPage />} />
            <Route path="treatment-plans" element={<TreatmentPlansPage />} />

            {/* Targets (view-only) */}
            <Route path="targets" element={<DoctorTargetsPage />} />

            {/* Leaves */}
            <Route path="leaves" element={<DoctorLeavesPage />} />

            {/* Profile */}
            <Route path="profile" element={<DoctorProfilePage />} />
          </Route>

          {/* Protected PRO / Manager Portal Routes */}
          <Route path="/pro" element={<PROLayout />}>
            <Route index element={<Navigate to="/pro/dashboard" replace />} />
            <Route path="dashboard" element={<PRODashboard />} />
            <Route path="queue" element={<PROPatientQueuePage />} />
            <Route path="patients" element={<PROPatientOverviewPage />} />
            <Route path="patients/:id" element={<PROPatientOverviewPage />} />
            <Route path="counselling" element={<Navigate to="/pro/queue" replace />} />
            <Route path="packages" element={<PROPackagesPage />} />
            <Route path="prescriptions" element={<PROPrescriptionPage />} />
            <Route path="prescriptions/:id" element={<PROPrescriptionPage />} />
            <Route path="prescriptions/:id/modify" element={<PROPrescriptionPage defaultEdit={true} />} />
            <Route path="billing" element={<Navigate to="/pro/billing/new" replace />} />
            <Route path="billing/new" element={<PROBillingPage />} />
            <Route path="billing/pending" element={<PROBillingPage />} />
            <Route path="billing/paid" element={<PROBillingPage />} />
            <Route path="billing/partial-due" element={<PROBillingPage />} />
            <Route path="billing/history" element={<PROBillingPage />} />
            <Route path="payments" element={<Navigate to="/pro/payments/today" replace />} />
            <Route path="payments/today" element={<PROPaymentsPage />} />
            <Route path="payments/due-collection" element={<PROPaymentsPage />} />
            <Route path="payments/history" element={<PROPaymentsPage />} />
            <Route path="accountant" element={<Navigate to="/pro/accountant/daily-summary" replace />} />
            <Route path="accountant/daily-summary" element={<PROAccountantPage />} />
            <Route path="accountant/opening-balance" element={<PROAccountantPage />} />
            <Route path="accountant/cash-revenue" element={<PROAccountantPage />} />
            <Route path="accountant/expenditure" element={<PROAccountantPage />} />
            <Route path="accountant/closing-balance" element={<PROAccountantPage />} />
            <Route path="accountant/deposit" element={<PROAccountantPage />} />
            <Route path="accountant/grand-total" element={<PROAccountantPage />} />
            <Route path="crm" element={<Navigate to="/pro/crm/calls" replace />} />
            <Route path="crm/calls" element={<PROCRMPage />} />
            <Route path="crm/followups" element={<PROCRMPage />} />
            <Route path="crm/renewals" element={<PROCRMPage />} />
            <Route path="crm/dues" element={<PROCRMPage />} />
            <Route path="crm/acq" element={<PROCRMPage />} />
            <Route path="crm/ocnr" element={<PROCRMPage />} />
            <Route path="tasks" element={<PROTasksPage />} />
            <Route path="feedback" element={<PROFeedbackPage />} />
            <Route path="complaints" element={<PROComplaintsPage />} />
            <Route path="profile" element={<PROProfilePage />} />
          </Route>

          {/* Protected Pharmacy Portal Routes */}
          <Route path="/pharmacy" element={<PharmacyLayout />}>
            <Route index element={<Navigate to="/pharmacy/dashboard" replace />} />
            <Route path="dashboard" element={<PharmacyDashboard />} />
            <Route path="queue" element={<PrescriptionQueuePage />} />
            <Route path="prescriptions/:id/process" element={<ProcessPrescriptionPage />} />

            {/* Dispensing Hub */}
            <Route path="dispensing" element={<Navigate to="/pharmacy/dispensing/pending" replace />} />
            <Route path="dispensing/:tab" element={<PharmacyDispensingHubPage />} />

            {/* Inventory Hub */}
            <Route path="inventory" element={<Navigate to="/pharmacy/inventory/medicines" replace />} />
            <Route path="inventory/:tab" element={<PharmacyInventoryHubPage />} />

            {/* Auxiliary Operations */}
            <Route path="transactions" element={<StockTransactionsPage />} />
            <Route path="returns" element={<MedicineReturnsPage />} />
            <Route path="adjustments" element={<StockAdjustmentsPage />} />
            <Route path="clarifications" element={<PrescriptionClarificationsPage />} />
            <Route path="patients" element={<PharmacyPatientsPage />} />
            <Route path="profile" element={<PharmacyProfilePage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
