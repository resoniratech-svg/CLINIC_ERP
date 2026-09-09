import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Search,
  RotateCcw,
  HelpCircle,
  Users2,
  Calendar,
  UserCheck,
  Receipt,
  CreditCard,
  PhoneCall,
  CheckSquare,
  User,
  LogOut,
  ChevronDown,
  Building,
  HeartHandshake
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ReceptionistSidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const [openSections, setOpenSections] = useState({
    registration: true,
    enquiries: false,
    referrals: false,
    billing: false,
    crm: false,
  });

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const navLinkClasses = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
      isActive
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const subNavLinkClasses = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
      isActive
        ? 'text-blue-700 font-bold bg-blue-50/80 border-l-2 border-blue-600 pl-2.5'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
    }`;

  // Compute which top-level sections are permitted at all
  const canRegistration    = hasPermission('registration');
  const canRenewal         = hasPermission('renewal');
  const canEnquiry         = hasPermission('enquiry');
  const canAppointment     = hasPermission('appointment');
  const canCheckin         = hasPermission('checkin');
  const canBilling         = hasPermission('consultation_fee_billing');
  const canDueManagement   = hasPermission('due_management');
  const canCrmCalling      = hasPermission('crm_calling');
  const canFollowup        = hasPermission('followup');

  // Registration section is visible if either registration OR renewal is permitted
  const showRegistrationSection = canRegistration || canRenewal;
  // Enquiries section is visible if enquiry is permitted
  const showEnquiriesSection = canEnquiry;
  // Billing section is visible if billing OR due management is permitted
  const showBillingSection = canBilling || canDueManagement;
  // CRM section is visible if crm_calling is permitted
  const showCrmSection = canCrmCalling;

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand Header */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
              <img
                src="/assets/wecare_logo.png"
                alt="WeCare Homeopathy"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-black text-sm tracking-tight text-blue-700">We</span>
                <span className="font-black text-sm tracking-tight text-red-600">Care</span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase block">
                Receptionist Desk
              </span>
            </div>
          </div>
        </div>

        {/* Branch Identifier Banner */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
            <Building className="w-3.5 h-3.5 text-blue-600" />
            <span className="truncate">{user?.branch_name || 'Karimnagar Main'}</span>
          </div>
          <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
            {user?.branch_code || 'KRM001'}
          </span>
        </div>

        {/* Navigation Items (Scrollable) */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
          {/* Dashboard — always visible */}
          <NavLink to="/receptionist/dashboard" className={navLinkClasses} onClick={onCloseMobile}>
            <LayoutDashboard className="w-4 h-4" />
            <span>Reception Dashboard</span>
          </NavLink>

          {/* Patient Registration Group — requires: registration OR renewal */}
          {showRegistrationSection && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => toggleSection('registration')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>Patient Registration</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openSections.registration ? 'rotate-180 text-blue-600' : 'text-slate-400'
                  }`}
                />
              </button>
              {openSections.registration && (
                <div className="pl-6 pt-1 space-y-0.5">
                  {canRegistration && (
                    <NavLink to="/receptionist/patients" className={subNavLinkClasses} onClick={onCloseMobile}>
                      <span>👤 Patients</span>
                    </NavLink>
                  )}
                  {canRenewal && (
                    <NavLink to="/receptionist/renewals" className={subNavLinkClasses} onClick={onCloseMobile}>
                      <span>🔄 Registration Renewals</span>
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Enquiries & Leads Group — requires: enquiry */}
          {showEnquiriesSection && (
            <div>
              <button
                type="button"
                onClick={() => toggleSection('enquiries')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-sky-600" />
                  <span>Enquiries & Leads</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openSections.enquiries ? 'rotate-180 text-sky-600' : 'text-slate-400'
                  }`}
                />
              </button>
              {openSections.enquiries && (
                <div className="pl-6 pt-1 space-y-0.5">
                  <NavLink to="/receptionist/enquiries" className={subNavLinkClasses} onClick={onCloseMobile}>
                    <span>Patient Enquiries</span>
                  </NavLink>
                  <NavLink to="/receptionist/leads" className={subNavLinkClasses} onClick={onCloseMobile}>
                    <span>Executive Leads Queue</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {/* Referrals Group — visible to all receptionists (no separate permission) */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('referrals')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <HeartHandshake className="w-4 h-4 text-purple-600" />
                <span>Referrals</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openSections.referrals ? 'rotate-180 text-purple-600' : 'text-slate-400'
                }`}
              />
            </button>
            {openSections.referrals && (
              <div className="pl-6 pt-1 space-y-0.5">
                <NavLink to="/receptionist/referrals/employee" className={subNavLinkClasses} onClick={onCloseMobile}>
                  <span>Employee Referral</span>
                </NavLink>
                <NavLink to="/receptionist/referrals/patient" className={subNavLinkClasses} onClick={onCloseMobile}>
                  <span>Patient Referral</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* Appointments — requires: appointment */}
          {canAppointment && (
            <NavLink to="/receptionist/appointments" className={navLinkClasses} onClick={onCloseMobile}>
              <Calendar className="w-4 h-4" />
              <span>Doctor Appointments</span>
            </NavLink>
          )}

          {/* Check-in & Waiting Queue — requires: checkin */}
          {canCheckin && (
            <NavLink to="/receptionist/check-in" className={navLinkClasses} onClick={onCloseMobile}>
              <UserCheck className="w-4 h-4" />
              <span>Check-in & Waiting Queue</span>
            </NavLink>
          )}

          {/* Consultation Billing & Payments — requires: consultation_fee_billing OR due_management */}
          {showBillingSection && (
            <div>
              <button
                type="button"
                onClick={() => toggleSection('billing')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Consultation Billing</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openSections.billing ? 'rotate-180 text-emerald-600' : 'text-slate-400'
                  }`}
                />
              </button>
              {openSections.billing && (
                <div className="pl-6 pt-1 space-y-0.5">
                  {canBilling && (
                    <NavLink to="/receptionist/billing" className={subNavLinkClasses} onClick={onCloseMobile}>
                      <span>Consultation Bills</span>
                    </NavLink>
                  )}
                  {canDueManagement && (
                    <NavLink to="/receptionist/due-patients" className={subNavLinkClasses} onClick={onCloseMobile}>
                      <span>Due Patients & Collection</span>
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CRM & Calling — requires: crm_calling */}
          {showCrmSection && (
            <div>
              <button
                type="button"
                onClick={() => toggleSection('crm')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <PhoneCall className="w-4 h-4 text-red-600" />
                  <span>CRM & Calling</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openSections.crm ? 'rotate-180 text-red-600' : 'text-slate-400'
                  }`}
                />
              </button>
              {openSections.crm && (
                <div className="pl-6 pt-1 space-y-0.5">
                  <NavLink to="/receptionist/crm" className={subNavLinkClasses} onClick={onCloseMobile}>
                    <span>My Calls & Follow-ups</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {/* My Tasks — requires: followup */}
          {canFollowup && (
            <NavLink to="/receptionist/tasks" className={navLinkClasses} onClick={onCloseMobile}>
              <CheckSquare className="w-4 h-4" />
              <span>My Daily Tasks</span>
            </NavLink>
          )}

          {/* My Profile — always visible */}
          <NavLink to="/receptionist/profile" className={navLinkClasses} onClick={onCloseMobile}>
            <User className="w-4 h-4" />
            <span>My Profile & Password</span>
          </NavLink>
        </nav>

        {/* Footer / User Profile & Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {user?.full_name?.charAt(0) || 'R'}
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-slate-900 text-xs truncate">
                  {user?.full_name || 'Receptionist'}
                </div>
                <span className="text-[10px] text-slate-500 font-mono block truncate">
                  {user?.employee_id || '@staff'}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
