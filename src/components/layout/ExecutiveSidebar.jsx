import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PhoneCall,
  PhoneIncoming,
  PhoneForwarded,
  Clock,
  History,
  Users2,
  CalendarClock,
  Coins,
  User,
  LogOut,
  ChevronDown,
  Building,
  Headphones
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ExecutiveSidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [openSections, setOpenSections] = useState({
    myCalls: true,
    leads: true,
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
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-white flex items-center justify-between">
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
                Executive Desk
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
          <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
            {user?.branch_code || 'KRM001'}
          </span>
        </div>

        {/* Navigation Links Scrollable Area */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 text-xs">
          {/* 1. Dashboard */}
          <NavLink
            to="/executive/dashboard"
            onClick={onCloseMobile}
            className={navLinkClasses}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </NavLink>

          {/* 2. My Calls Section */}
          <div className="pt-2">
            <button
              onClick={() => toggleSection('myCalls')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-blue-600" />
                <span>My Calls</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openSections.myCalls ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.myCalls && (
              <div className="mt-1 pl-2 space-y-0.5 border-l border-slate-100 ml-3">
                <NavLink
                  to="/executive/calls/inbound"
                  onClick={onCloseMobile}
                  className={subNavLinkClasses}
                >
                  <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Inbound Calls</span>
                </NavLink>

                <NavLink
                  to="/executive/calls/outbound"
                  onClick={onCloseMobile}
                  className={subNavLinkClasses}
                >
                  <PhoneForwarded className="w-3.5 h-3.5 text-blue-600" />
                  <span>Outbound Calls</span>
                </NavLink>

                <NavLink
                  to="/executive/calls/today"
                  onClick={onCloseMobile}
                  className={subNavLinkClasses}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Today's Calls</span>
                </NavLink>

                <NavLink
                  to="/executive/calls/history"
                  onClick={onCloseMobile}
                  className={subNavLinkClasses}
                >
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Call History</span>
                </NavLink>

                <NavLink
                  to="/executive/outbound/history"
                  onClick={onCloseMobile}
                  className={subNavLinkClasses}
                >
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Import History</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* 4. Leads Section */}
          <div className="pt-2">
            <button
              onClick={() => toggleSection('leads')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Users2 className="w-3.5 h-3.5 text-purple-600" />
                <span>Leads</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openSections.leads ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.leads && (
              <div className="mt-1 pl-2 space-y-0.5 border-l border-slate-100 ml-3">
                <NavLink
                  to="/executive/leads"
                  onClick={onCloseMobile}
                  className={subNavLinkClasses}
                >
                  <Users2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>My Leads</span>
                </NavLink>
              </div>
            )}
          </div>

          {/* 5. Callbacks */}
          <div className="pt-2">
            <NavLink
              to="/executive/callbacks"
              onClick={onCloseMobile}
              className={navLinkClasses}
            >
              <CalendarClock className="w-4 h-4 text-amber-500" />
              <span>Callbacks</span>
            </NavLink>
          </div>

          {/* 6. Incentives */}
          <div>
            <NavLink
              to="/executive/incentives"
              onClick={onCloseMobile}
              className={navLinkClasses}
            >
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>Incentives</span>
            </NavLink>
          </div>

          {/* 8. My Profile */}
          <div className="pt-2 border-t border-slate-100">
            <NavLink
              to="/executive/profile"
              onClick={onCloseMobile}
              className={navLinkClasses}
            >
              <User className="w-4 h-4" />
              <span>My Profile</span>
            </NavLink>
          </div>
        </nav>

        {/* User Footer Profile & Sign Out */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.full_name?.charAt(0) || 'E'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user?.full_name || 'Executive'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  {user?.employee_id || 'EX001'}
                </p>
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
