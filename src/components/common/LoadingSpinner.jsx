import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ label = 'Loading...', size = 'md' }) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
      <Loader2 className={`${sizeMap[size] || sizeMap.md} animate-spin text-blue-600 mb-3`} />
      <span className="text-xs font-semibold text-slate-600">{label}</span>
    </div>
  );
};
