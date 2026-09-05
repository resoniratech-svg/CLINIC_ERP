import React from 'react';

export const Badge = ({ children, variant = 'default', size = 'sm' }) => {
  const styles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-blue-50 text-blue-700 border-blue-200',
    secondary: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    // Status mappings
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-600 border-slate-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
    // Role mappings
    super_admin: 'bg-gradient-to-r from-blue-50 to-red-50 text-blue-900 border-blue-200',
    receptionist: 'bg-blue-50 text-blue-700 border-blue-200',
    doctor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    pro_manager: 'bg-purple-50 text-purple-700 border-purple-200',
    executive: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    pharmacy: 'bg-red-50 text-red-700 border-red-200',
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${styles[variant] || styles.default} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  );
};
