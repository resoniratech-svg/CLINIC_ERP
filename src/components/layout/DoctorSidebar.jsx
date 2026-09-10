import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  HeartPulse,
  Users,
  ClipboardList,
  Pill,
  Activity,
  Target,
  CalendarOff,
  User,
  LogOut,
  Building,
  Ticket
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const DoctorSidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout, hasPermission } = useAuth();

  const navLinkClasses = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
      isActive
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand Header */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 to-white flex items-center justify-between">
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
                Doctor Portal
              </span>
            </div>
          </div>
        </div>

        {/* Branch Identifier Banner */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
            <Building className="w-3.5 h-3.5 text-emerald-600" />
            <span className="truncate">{user?.branch_name || 'Karimnagar Main'}</span>
          </div>
          <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
            {user?.branch_code || 'KRM001'}
          </span>
        </div>

        {/* Navigation Items (Scrollable - Exact 10 Flattened Items) */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
          {/* 1. Doctor Dashboard */}
          <NavLink to="/doctor/dashboard" className={navLinkClasses} onClick={onCloseMobile}>
            <LayoutDashboard className="w-4 h-4" />
            <span>Doctor Dashboard</span>
          </NavLink>

          {/* 2. Today's Appointments */}
          <NavLink to="/doctor/appointments" className={navLinkClasses} onClick={onCloseMobile}>
            <CalendarDays className="w-4 h-4" />
            <span>Today's Appointments</span>
          </NavLink>

          {/* 3. Patient Queue */}
          <NavLink to="/doctor/queue" className={navLinkClasses} onClick={onCloseMobile}>
            <HeartPulse className="w-4 h-4" />
            <span>Patient Queue</span>
          </NavLink>

          {/* 4. Patients */}
          <NavLink to="/doctor/patients" className={navLinkClasses} onClick={onCloseMobile}>
            <Users className="w-4 h-4" />
            <span>Patients</span>
          </NavLink>

          {/* 5. Consultations */}
          <NavLink to="/doctor/consultations" className={navLinkClasses} onClick={onCloseMobile}>
            <ClipboardList className="w-4 h-4" />
            <span>Consultations</span>
          </NavLink>

          {/* 6. Prescriptions */}
          <NavLink to="/doctor/prescriptions" className={navLinkClasses} onClick={onCloseMobile}>
            <Pill className="w-4 h-4" />
            <span>Prescriptions</span>
          </NavLink>

          {/* 7. Treatments */}
          <NavLink to="/doctor/treatment-plans" className={navLinkClasses} onClick={onCloseMobile}>
            <Activity className="w-4 h-4" />
            <span>Treatments</span>
          </NavLink>

          {/* 8. My Targets */}
          <NavLink to="/doctor/targets" className={navLinkClasses} onClick={onCloseMobile}>
            <Target className="w-4 h-4" />
            <span>My Targets</span>
          </NavLink>

          {/* 9. Leave Requests */}
          <NavLink to="/doctor/leaves" className={navLinkClasses} onClick={onCloseMobile}>
            <CalendarOff className="w-4 h-4" />
            <span>Leave Requests</span>
          </NavLink>

          {/* Coupon Management — requires: coupon_management */}
          {hasPermission('coupon_management') && (
            <NavLink to="/doctor/coupons" className={navLinkClasses} onClick={onCloseMobile}>
              <Ticket className="w-4 h-4" />
              <span>Coupon Management</span>
            </NavLink>
          )}

          {/* 10. My Profile */}
          <NavLink to="/doctor/profile" className={navLinkClasses} onClick={onCloseMobile}>
            <User className="w-4 h-4" />
            <span>My Profile</span>
          </NavLink>
        </nav>

        {/* Footer / User Profile & Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {user?.full_name?.charAt(0) || 'D'}
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-slate-900 text-xs truncate">
                  {user?.full_name || 'Doctor'}
                </div>
                <span className="text-[10px] text-slate-500 font-mono block truncate">
                  {user?.employee_id || '@doctor'}
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
