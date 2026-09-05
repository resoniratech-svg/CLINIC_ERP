import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ExecutiveSidebar } from './ExecutiveSidebar';
import { ExecutiveHeader } from './ExecutiveHeader';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const ExecutiveLayout = () => {
  const { user, token, loading } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner label="Validating staff authentication..." />
      </div>
    );
  }

  // Allow executive or super_admin
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const isAuthorized = user.role === 'executive' || user.role === 'super_admin';
  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col">
      {/* Sidebar */}
      <ExecutiveSidebar
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main App Container */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <ExecutiveHeader onToggleMobile={() => setIsMobileOpen(!isMobileOpen)} />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
