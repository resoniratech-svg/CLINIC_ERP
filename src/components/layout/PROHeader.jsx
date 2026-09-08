import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Users, Building, Receipt, LogOut, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const PROHeader = ({ onToggleMobile }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isQueueActive = location.pathname === '/pro/queue';
  const isBillingActive = location.pathname.startsWith('/pro/billing');

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* Left: Mobile Toggle & Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobile}
          className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white p-0.5 border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
            <img
              src="/assets/wecare_logo.png"
              alt="WeCare Homeopathy"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-bold text-xs text-slate-800 hidden sm:inline">
            <span className="text-[#1565C0]">We</span>
            <span className="text-[#D32F2F]">Care</span>
            <span className="text-slate-700 ml-1">Homeopathy ERP</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50/60 text-slate-700 border border-blue-100">
            <Building className="w-3 h-3 text-[#1565C0]" />
            <span>{user?.branch_name ? `${user.branch_name} (${user.branch_code || 'KRM001'})` : 'Karimnagar Main Branch (KRM001)'}</span>
          </span>
        </div>
      </div>

      {/* Right: Quick Actions & Role Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/pro/queue"
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
            isQueueActive
              ? 'bg-[#D32F2F] text-white shadow-red-500/20'
              : 'bg-[#1565C0] hover:bg-[#0D47A1] text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Patient Queue</span>
        </Link>

        <Link
          to="/pro/billing/new"
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            isBillingActive
              ? 'bg-[#D32F2F] text-white shadow-xs shadow-red-500/20'
              : 'bg-blue-50/80 hover:bg-blue-100 text-[#1565C0] border border-blue-200'
          }`}
        >
          <Receipt className={`w-3.5 h-3.5 ${isBillingActive ? 'text-white' : 'text-[#1565C0]'}`} />
          <span>New Bill</span>
        </Link>

        {/* Role Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#1565C0] text-xs font-bold">
          <Briefcase className="w-3.5 h-3.5 text-[#1565C0]" />
          <span className="hidden sm:inline">PRO / MANAGER</span>
        </div>

        {/* User Name */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <div className="w-6 h-6 rounded-full bg-[#1565C0] text-white font-bold flex items-center justify-center text-[10px] shadow-2xs">
            {user?.full_name?.charAt(0) || 'P'}
          </div>
          <span className="truncate max-w-[120px]">{user?.full_name}</span>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Logout"
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
