import React, { useState } from 'react';
import { Menu, LogOut, ShieldCheck, MapPin, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChangePasswordModal } from '../../pages/auth/ChangePasswordModal';

export const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 lg:px-8 py-3 flex items-center justify-between shadow-2xs">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand & Branch Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs font-semibold">
          <img src="/assets/wecare_logo.png" alt="WeCare" className="w-4 h-4 object-contain" />
          <span className="font-bold text-slate-800">Karimnagar Main Branch</span>
          <span className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
            KRM001
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-5">
        {/* Super Admin Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-extrabold shadow-xs tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SUPER ADMIN</span>
        </div>

        {/* User profile info */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-900">{user?.full_name || 'Super Admin'}</div>
            <div className="text-[11px] text-slate-400 font-mono">{user?.employee_id || 'EMP000'}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-red-600 p-0.5 shadow-xs">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center text-blue-800 font-black text-sm">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'W'}
            </div>
          </div>

          <button
            onClick={() => setIsPasswordModalOpen(true)}
            title="Change Account Password"
            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          <button
            onClick={logout}
            title="Logout"
            className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors ml-0.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
};
