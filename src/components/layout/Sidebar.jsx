import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  KeyRound,
  Stethoscope,
  Target,
  Receipt,
  CreditCard,
  Banknote,
  Layers,
  UserCheck,
  Headset,
  Pill,
  BarChart3,
  ShieldCheck,
  Sliders,
  ChevronDown,
  Calendar,
  Sparkles
} from 'lucide-react';

export const Sidebar = ({ isMobileOpen, onCloseMobile, isOpen, onClose }) => {
  const location = useLocation();
  const handleClose = onCloseMobile || onClose;
  const mobileVisible = isMobileOpen !== undefined ? isMobileOpen : isOpen;

  const [openSections, setOpenSections] = useState({
    users: location.pathname.startsWith('/users'),
    billing: location.pathname.startsWith('/billing'),
    crm: location.pathname.startsWith('/crm'),
    pharmacy: location.pathname.startsWith('/pharmacy-master'),
    settings: location.pathname.startsWith('/settings'),
    logs: location.pathname.startsWith('/logs') || true,
    targets: location.pathname.startsWith('/targets'),
  });

  const toggleSection = (sec) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const navLinkClasses = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  const subNavLinkClasses = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all pl-9 ${
      isActive
        ? 'text-blue-700 font-bold bg-blue-50 border-r-2 border-red-500'
        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
    }`;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileVisible && (
        <div
          onClick={handleClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header with WeCare Logo */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-blue-50/50 via-white to-red-50/30">
          <div className="w-11 h-11 rounded-xl bg-white p-1 border border-slate-200/80 shadow-xs flex items-center justify-center shrink-0">
            <img
              src="/assets/wecare_logo.png"
              alt="WeCare Homeopathy"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-sm text-blue-700 tracking-tight">We</span>
              <span className="font-extrabold text-sm text-red-600 tracking-tight">Care</span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
              Homeopathy ERP
            </p>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700 uppercase shrink-0">
            Admin
          </span>
        </div>

        {/* Single Branch Indicator */}
        <div className="px-3 pt-3 pb-1">
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Branch</span>
              <p className="text-xs font-bold text-slate-800 truncate">{user?.branch_name || 'Karimnagar Main'}</p>
            </div>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
              {user?.branch_code || 'KRM001'}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
          {/* Dashboard */}
          <NavLink to="/dashboard" onClick={handleClose} className={navLinkClasses}>
            <LayoutDashboard className="w-4 h-4 text-blue-500" />
            <span>Overview Dashboard</span>
          </NavLink>

          {/* User Management Submenu */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('users')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-slate-500" />
                <span>User Management</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform text-slate-400 ${
                  openSections.users ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSections.users && (
              <div className="mt-1 space-y-0.5">
                <NavLink to="/users" onClick={handleClose} className={subNavLinkClasses} end>
                  Staff Directory & Roles
                </NavLink>
                <NavLink to="/users/password-resets" onClick={handleClose} className={subNavLinkClasses}>
                  Password Reset Authorizations
                </NavLink>
              </div>
            )}
          </div>

          {/* Doctors */}
          <NavLink to="/doctors" onClick={handleClose} className={navLinkClasses}>
            <Stethoscope className="w-4 h-4 text-blue-500" />
            <span>Doctor Management</span>
          </NavLink>

          {/* Patients */}
          <NavLink to="/patients" onClick={handleClose} className={navLinkClasses}>
            <UserCheck className="w-4 h-4 text-slate-500" />
            <span>Patients Registry</span>
          </NavLink>

          {/* Appointments */}
          <NavLink to="/appointments" onClick={handleClose} className={navLinkClasses}>
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Appointment Registry</span>
          </NavLink>

          {/* Targets */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('targets')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-red-500" />
                <span>Target Management</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform text-slate-400 ${
                  openSections.targets ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSections.targets && (
              <div className="mt-1 space-y-0.5">
                <NavLink to="/targets" onClick={handleClose} className={subNavLinkClasses} end>
                  Monthly Targets Allocation
                </NavLink>
                <NavLink to="/targets/doctor-performance" onClick={handleClose} className={subNavLinkClasses}>
                  Doctor Quota Performance
                </NavLink>
              </div>
            )}
          </div>

          {/* Billing & Finance Submenu */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('billing')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Billing & Finance</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform text-slate-400 ${
                  openSections.billing ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSections.billing && (
              <div className="mt-1 space-y-0.5">
                <NavLink to="/billing/config" onClick={handleClose} className={subNavLinkClasses}>
                  Consultation Fees & Rules
                </NavLink>
                <NavLink to="/billing/revenue" onClick={handleClose} className={subNavLinkClasses}>
                  Grand Total Revenue
                </NavLink>
                <NavLink to="/billing/cash" onClick={handleClose} className={subNavLinkClasses}>
                  Cash Day Closing Ledger
                </NavLink>
              </div>
            )}
          </div>

          {/* CRM Submenu */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('crm')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-purple-500" />
                <span>CRM Management</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform text-slate-400 ${
                  openSections.crm ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSections.crm && (
              <div className="mt-1 space-y-0.5">
                <NavLink to="/crm" onClick={handleClose} className={subNavLinkClasses} end>
                  Follow-ups & Renewals
                </NavLink>
                <NavLink to="/crm/acq" onClick={handleClose} className={subNavLinkClasses}>
                  ACQ Monthly Care Plans
                </NavLink>
                <NavLink to="/crm/ocnr" onClick={handleClose} className={subNavLinkClasses}>
                  OC / NR Drop Patients
                </NavLink>
              </div>
            )}
          </div>

          {/* Call Center */}
          <NavLink to="/callcenter" onClick={handleClose} className={navLinkClasses}>
            <Headset className="w-4 h-4 text-blue-500" />
            <span>Call Center & Leads</span>
          </NavLink>

          {/* Pharmacy Submenu */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('pharmacy')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Pill className="w-4 h-4 text-red-500" />
                <span>Pharmacy Master</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform text-slate-400 ${
                  openSections.pharmacy ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSections.pharmacy && (
              <div className="mt-1 space-y-0.5">
                <NavLink to="/pharmacy-master/medicine-formularies" onClick={handleClose} className={subNavLinkClasses}>
                  Medicine Formularies
                </NavLink>
                <NavLink to="/pharmacy-master/stock" onClick={handleClose} className={subNavLinkClasses}>
                  Live Stock & Expiry
                </NavLink>
              </div>
            )}
          </div>

          {/* Reports */}
          <NavLink to="/reports" onClick={handleClose} className={navLinkClasses}>
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span>Reports & Analytics</span>
          </NavLink>

          {/* Settings & Governance */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('settings')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-slate-500" />
                <span>Hospital Settings</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform text-slate-400 ${
                  openSections.settings ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSections.settings && (
              <div className="mt-1 space-y-0.5">
                <NavLink to="/settings/profile" onClick={handleClose} className={subNavLinkClasses}>
                  Profile Settings
                </NavLink>
                <NavLink to="/settings/permissions" onClick={handleClose} className={subNavLinkClasses}>
                  Roles & Permissions (RBAC)
                </NavLink>
                <NavLink to="/settings/hospital" onClick={handleClose} className={subNavLinkClasses}>
                  Hospital Master Registries
                </NavLink>
              </div>
            )}
          </div>

          {/* Security Logs */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('logs')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span>Audit & Security Logs</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform text-slate-400 ${
                  openSections.logs ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSections.logs && (
              <div className="mt-1 space-y-0.5">
                <NavLink to="/logs/audit" onClick={handleClose} className={subNavLinkClasses}>
                  System Mutation Logs
                </NavLink>
                <NavLink to="/logs/login" onClick={handleClose} className={subNavLinkClasses}>
                  Login & Access History
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        {/* Footer Note */}
        <div className="p-3 border-t border-slate-100 text-center bg-slate-50/50">
          <div className="text-[10px] font-bold text-blue-950">We Care. We Heal. We Serve.</div>
          <div className="text-[9px] text-slate-400">Super Admin Console</div>
        </div>
      </aside>
    </>
  );
};
