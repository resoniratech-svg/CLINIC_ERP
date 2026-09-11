import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { SuperAdminDepositNotification } from '../notifications/SuperAdminDepositNotification';

export const SuperAdminLayout = () => {
  const { token, user, isSuperAdmin, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner label="Authenticating Super Admin..." size="lg" />
      </div>
    );
  }

  // Not logged in -> Redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not super admin -> unauthorized
  if (user && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md">
          <h2 className="text-xl font-bold text-rose-600 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-600 mb-6">
            You are logged in as <span className="font-semibold">{user.role}</span>. You do not have permission to access the Super Admin Portal.
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 cursor-pointer"
          >
            Login with Super Admin Credentials
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        isMobileOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Header onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
        <SuperAdminDepositNotification />
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
