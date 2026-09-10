import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Package,
  Receipt,
  CreditCard,
  Calculator,
  PhoneCall,
  CheckSquare,
  Star,
  AlertTriangle,
  User,
  LogOut,
  Building,
  Ticket
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const PROSidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const navLinkClasses = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
      isActive
        ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#F5F6FA] border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand Header */}
        <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
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
                <span className="font-black text-sm tracking-tight text-[#1565C0]">We</span>
                <span className="font-black text-sm tracking-tight text-[#D32F2F]">Care</span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase block">
                PRO / Manager Portal
              </span>
            </div>
          </div>
        </div>

        {/* Branch Identifier Banner */}
        <div className="px-4 py-2 bg-white border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
            <Building className="w-3.5 h-3.5 text-[#1565C0]" />
            <span className="truncate">{user?.branch_name || 'Karimnagar Main'}</span>
          </div>
          <span className="text-[10px] font-mono font-bold bg-blue-50 text-[#1565C0] border border-blue-200/60 px-1.5 py-0.5 rounded">
            {user?.branch_code || 'KRM001'}
          </span>
        </div>

        {/* Navigation Links (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
          {/* Dashboard */}
          <NavLink to="/pro/dashboard" className={navLinkClasses}>
            <LayoutDashboard className="w-4 h-4 text-[#1565C0]" />
            <span>Dashboard</span>
          </NavLink>

          {/* Patient Queue */}
          <NavLink to="/pro/queue" className={navLinkClasses}>
            <Users className="w-4 h-4 text-[#1565C0]" />
            <span>Patient Queue</span>
          </NavLink>

          {/* Patients 360 */}
          <NavLink to="/pro/patients" className={navLinkClasses}>
            <UserCheck className="w-4 h-4 text-[#1565C0]" />
            <span>Patient 360° Overview</span>
          </NavLink>

          {/* Packages / Plans */}
          <NavLink to="/pro/packages" className={navLinkClasses}>
            <Package className="w-4 h-4 text-[#1565C0]" />
            <span>Packages / Plans</span>
          </NavLink>

          {/* Billing - Single Direct Module */}
          <NavLink
            to="/pro/billing/new"
            onClick={onCloseMobile}
            className={() => {
              const isActive = location.pathname.startsWith('/pro/billing');
              return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`;
            }}
          >
            <Receipt
              className={`w-4 h-4 transition-colors ${
                location.pathname.startsWith('/pro/billing') ? 'text-white' : 'text-[#1565C0]'
              }`}
            />
            <span>Billing</span>
          </NavLink>

          {/* Payments - Single Direct Module */}
          <NavLink
            to="/pro/payments/today"
            onClick={onCloseMobile}
            className={() => {
              const isActive = location.pathname.startsWith('/pro/payments');
              return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`;
            }}
          >
            <CreditCard
              className={`w-4 h-4 transition-colors ${
                location.pathname.startsWith('/pro/payments') ? 'text-white' : 'text-[#1565C0]'
              }`}
            />
            <span>Payments</span>
          </NavLink>

          {/* Accountant - Single Direct Module */}
          <NavLink
            to="/pro/accountant/daily-summary"
            onClick={onCloseMobile}
            className={() => {
              const isActive = location.pathname.startsWith('/pro/accountant');
              return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`;
            }}
          >
            <Calculator
              className={`w-4 h-4 transition-colors ${
                location.pathname.startsWith('/pro/accountant') ? 'text-white' : 'text-[#1565C0]'
              }`}
            />
            <span>Accountant</span>
          </NavLink>

          {/* Coupon Management — requires: coupon_management */}
          {hasPermission('coupon_management') && (
            <NavLink
              to="/pro/coupons"
              onClick={onCloseMobile}
              className={navLinkClasses}
            >
              <Ticket className="w-4 h-4 text-[#1565C0]" />
              <span>Coupon Management</span>
            </NavLink>
          )}

          {/* CRM / Calling - Single Direct Module */}
          <NavLink
            to="/pro/crm/calls"
            onClick={onCloseMobile}
            className={() => {
              const isActive = location.pathname.startsWith('/pro/crm');
              return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`;
            }}
          >
            <PhoneCall
              className={`w-4 h-4 transition-colors ${
                location.pathname.startsWith('/pro/crm') ? 'text-white' : 'text-[#1565C0]'
              }`}
            />
            <span>CRM / Calling</span>
          </NavLink>

          {/* My Tasks */}
          <NavLink to="/pro/tasks" className={navLinkClasses}>
            <CheckSquare className="w-4 h-4 text-[#1565C0]" />
            <span>My Tasks</span>
          </NavLink>

          {/* Feedback */}
          <NavLink to="/pro/feedback" className={navLinkClasses}>
            <Star className="w-4 h-4 text-[#1565C0]" />
            <span>Patient Feedback</span>
          </NavLink>

          {/* Complaints / Escalations */}
          <NavLink to="/pro/complaints" className={navLinkClasses}>
            <AlertTriangle className="w-4 h-4 text-[#D32F2F]" />
            <span>Complaints</span>
          </NavLink>

          {/* My Profile */}
          <NavLink to="/pro/profile" className={navLinkClasses}>
            <User className="w-4 h-4 text-[#1565C0]" />
            <span>My Profile</span>
          </NavLink>
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-200/80 bg-white">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#1565C0] text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                {user?.full_name?.charAt(0) || 'P'}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-800 truncate">{user?.full_name || 'PRO Manager'}</div>
                <div className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ') || 'PRO / Manager'}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-[#D32F2F] hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
