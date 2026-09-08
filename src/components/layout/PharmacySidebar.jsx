import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Pill,
  Boxes,
  ArrowLeftRight,
  RotateCcw,
  Sliders,
  HelpCircle,
  User,
  LogOut,
  Building
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const PharmacySidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
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
                Pharmacy Portal
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
          <NavLink to="/pharmacy/dashboard" className={navLinkClasses} onClick={onCloseMobile}>
            <LayoutDashboard className="w-4 h-4 text-[#1565C0]" />
            <span>Dashboard</span>
          </NavLink>

          {/* Prescription Queue */}
          <NavLink to="/pharmacy/queue" className={navLinkClasses} onClick={onCloseMobile}>
            <ClipboardList className="w-4 h-4 text-[#1565C0]" />
            <span>Prescription Queue</span>
          </NavLink>

          {/* Patients Search */}
          <NavLink to="/pharmacy/patients" className={navLinkClasses} onClick={onCloseMobile}>
            <Users className="w-4 h-4 text-[#1565C0]" />
            <span>Patients</span>
          </NavLink>

          {/* Dispensing - Single Direct Module */}
          <NavLink
            to="/pharmacy/dispensing"
            onClick={onCloseMobile}
            className={() => {
              const isActive =
                location.pathname.startsWith('/pharmacy/dispensing') ||
                location.pathname.startsWith('/pharmacy/prescriptions');
              return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`;
            }}
          >
            <Pill
              className={`w-4 h-4 transition-colors ${
                location.pathname.startsWith('/pharmacy/dispensing') ||
                location.pathname.startsWith('/pharmacy/prescriptions')
                  ? 'text-white'
                  : 'text-[#1565C0]'
              }`}
            />
            <span>Dispensing</span>
          </NavLink>

          {/* Inventory - Single Direct Module */}
          <NavLink
            to="/pharmacy/inventory"
            onClick={onCloseMobile}
            className={() => {
              const isActive = location.pathname.startsWith('/pharmacy/inventory');
              return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#1565C0] text-white shadow-md shadow-blue-900/20 border-l-4 border-[#D32F2F]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`;
            }}
          >
            <Boxes
              className={`w-4 h-4 transition-colors ${
                location.pathname.startsWith('/pharmacy/inventory')
                  ? 'text-white'
                  : 'text-[#1565C0]'
              }`}
            />
            <span>Inventory</span>
          </NavLink>

          {/* Stock Transactions */}
          <div className="pt-2">
            <NavLink to="/pharmacy/transactions" className={navLinkClasses} onClick={onCloseMobile}>
              <ArrowLeftRight className="w-4 h-4 text-[#1565C0]" />
              <span>Stock Transactions</span>
            </NavLink>
          </div>

          {/* Returns */}
          <NavLink to="/pharmacy/returns" className={navLinkClasses} onClick={onCloseMobile}>
            <RotateCcw className="w-4 h-4 text-[#1565C0]" />
            <span>Returns</span>
          </NavLink>

          {/* Stock Adjustments */}
          <NavLink to="/pharmacy/adjustments" className={navLinkClasses} onClick={onCloseMobile}>
            <Sliders className="w-4 h-4 text-[#1565C0]" />
            <span>Stock Adjustments</span>
          </NavLink>

          {/* Prescription Clarification */}
          <NavLink to="/pharmacy/clarifications" className={navLinkClasses} onClick={onCloseMobile}>
            <HelpCircle className="w-4 h-4 text-[#1565C0]" />
            <span>Prescription Clarification</span>
          </NavLink>

          {/* My Profile */}
          <div className="pt-2">
            <NavLink to="/pharmacy/profile" className={navLinkClasses} onClick={onCloseMobile}>
              <User className="w-4 h-4 text-[#1565C0]" />
              <span>My Profile</span>
            </NavLink>
          </div>
        </div>

        {/* User Footer Profile & Logout */}
        <div className="p-3 border-t border-slate-200/80 bg-white">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#1565C0] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user?.full_name || 'Pharmacist'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">Pharmacist</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
export default PharmacySidebar;
