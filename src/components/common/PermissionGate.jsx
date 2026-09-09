import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldOff } from 'lucide-react';

/**
 * PermissionGate
 *
 * Wraps a route or component and only renders children if the current user
 * has the specified permission. Otherwise shows an Unauthorized screen.
 *
 * Usage (in App.jsx route wrapping):
 *   <Route path="appointments" element={
 *     <PermissionGate permission="appointment">
 *       <ReceptionistAppointmentsPage />
 *     </PermissionGate>
 *   } />
 *
 * Usage (inline component guard):
 *   <PermissionGate permission="payment_collection">
 *     <CollectPaymentButton />
 *   </PermissionGate>
 *
 * @param {string}  permission  - The permission key to check (e.g. 'appointment')
 * @param {ReactNode} children  - Content to render when permitted
 * @param {boolean} redirect    - If true, redirects to dashboard instead of showing message
 */
export const PermissionGate = ({ permission, children, redirect = false }) => {
  const { hasPermission, user } = useAuth();

  // If no user at all, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check permission
  if (!hasPermission(permission)) {
    if (redirect) {
      return <Navigate to="/receptionist/dashboard" replace />;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
          <ShieldOff className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Access Denied</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          You do not have permission to access this module. Please contact your Super Admin if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return children;
};
