import React from 'react';
import { useNavigate } from 'react-router-dom';

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue',
  to,
  filters,
  onClick,
  ariaLabel,
  disabled = false
}) => {
  const navigate = useNavigate();

  const colorSchemes = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
  };

  const getTargetUrl = () => {
    if (!to) return null;
    if (!filters || Object.keys(filters).length === 0) return to;
    const cleanParams = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleanParams.set(k, String(v));
      }
    });
    const qs = cleanParams.toString();
    return qs ? `${to}?${qs}` : to;
  };

  const targetUrl = getTargetUrl();
  const isClickable = !disabled && Boolean(targetUrl || onClick);

  const handleClick = (e) => {
    if (!isClickable) return;
    if (onClick) {
      onClick(e);
      return;
    }
    if (targetUrl) {
      if (e.ctrlKey || e.metaKey || e.button === 1) {
        window.open(targetUrl, '_blank');
      } else {
        navigate(targetUrl);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  };

  const aLabel = ariaLabel || `View ${title}: ${value}`;

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isClickable ? 'link' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? aLabel : undefined}
      className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs transition-all ${
        isClickable
          ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 group'
          : 'hover:shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span
            className={`text-[11px] font-bold text-slate-500 uppercase tracking-wider block transition-colors ${
              isClickable ? 'group-hover:text-blue-600' : ''
            }`}
          >
            {title}
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">{value}</div>
        </div>
        {Icon && (
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-transform ${
              colorSchemes[color] || colorSchemes.blue
            } ${isClickable ? 'group-hover:scale-105' : ''}`}
          >
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

