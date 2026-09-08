import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, Stethoscope, Building, ShieldCheck, Users, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const DoctorHeader = ({ onToggleMobile }) => {
  const { user, logout } = useAuth();

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
            WeCare Homeopathy ERP
          </span>
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <Building className="w-3 h-3 text-emerald-600" />
            <span>{user?.branch_name ? `${user.branch_name} (${user.branch_code || 'KRM001'})` : 'Karimnagar Main Branch (KRM001)'}</span>
          </span>
        </div>
      </div>

      {/* Right: Quick Actions & Role Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/doctor/queue"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Patient Queue</span>
        </Link>

        {/* Role Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
          <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">DOCTOR</span>
        </div>

        {/* User Name */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
            {user?.full_name?.charAt(0) || 'D'}
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
