import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Building, ShieldCheck, UserPlus, Search, PhoneCall } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ReceptionistHeader = ({ onToggleMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* Left: Mobile Toggle & Brand Indicator */}
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
            WeCare Homeopathy ERP
          </span>
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <Building className="w-3 h-3 text-blue-600" />
            <span>{user?.branch_name ? `${user.branch_name} (${user.branch_code || 'KRM001'})` : 'Karimnagar Main Branch (KRM001)'}</span>
          </span>
        </div>
      </div>

      {/* Center/Right: Quick Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Fast Action Buttons */}
        <Link
          to="/receptionist/patients/register"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ New Patient</span>
        </Link>

        <Link
          to="/receptionist/patients"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
        </Link>

        {/* Role Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span className="uppercase">RECEPTIONIST</span>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="font-bold text-xs text-slate-900 leading-tight">
              {user?.full_name || 'Staff User'}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {user?.employee_id || 'REC001'}
            </span>
          </div>

          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
