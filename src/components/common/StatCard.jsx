import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) => {
  const colorSchemes = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition-shadow">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">{value}</div>
        </div>
        {Icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${colorSchemes[color] || colorSchemes.blue}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {(subtitle || trend) && (
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          {subtitle && <span className="text-slate-500 font-medium text-[11px]">{subtitle}</span>}
          {trend && (
            <span className={`font-bold text-[11px] ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
