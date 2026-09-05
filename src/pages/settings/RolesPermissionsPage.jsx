import React, { useEffect, useState } from 'react';
import { settingsApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { ShieldCheck, Lock, CheckCircle2, Sliders, AlertCircle, RefreshCw } from 'lucide-react';

export const RolesPermissionsPage = () => {
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingCell, setUpdatingCell] = useState(null);

  const { showToast } = useToast();

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.getPermissionsMatrix();
      if (res.success) setMatrix(res.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load permissions matrix', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const handleAccessChange = async (role, module, newAccess) => {
    const cellKey = `${role}-${module}`;
    setUpdatingCell(cellKey);
    try {
      const res = await settingsApi.updatePermissionsMatrix({
        role,
        module,
        access_level: newAccess,
      });

      if (res.success) {
        showToast(`Updated ${module} access for ${role.replace('_', ' ')} to ${newAccess.toUpperCase()}`, 'success');
        // Update local state directly then sync
        setMatrix((prev) => {
          const filtered = prev.filter((item) => !(item.role === role && item.module === module));
          return [...filtered, res.data];
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to update permission', 'error');
      fetchMatrix();
    } finally {
      setUpdatingCell(null);
    }
  };

  const roles = [
    { key: 'super_admin', label: 'Super Admin' },
    { key: 'receptionist', label: 'Receptionist' },
    { key: 'doctor', label: 'Doctor' },
    { key: 'pro_manager', label: 'PRO / Manager' },
    { key: 'executive', label: 'Executive' },
    { key: 'pharmacy', label: 'Pharmacy' },
  ];

  const modules = [
    { name: 'Registration', desc: 'Patient onboarding, check-in, & reception desk' },
    { name: 'Consultation', desc: 'OPD queue, medical history, & case examination' },
    { name: 'Prescription', desc: 'E-prescriptions, potencies, & remedy plans' },
    { name: 'Billing', desc: 'Consultation bills, treatment packages, & cash closing' },
    { name: 'CRM', desc: 'Follow-ups, renewals, ACQ retention, & callback tasks' },
    { name: 'Inventory', desc: 'Medicine master formulary & stock dispensing' },
    { name: 'Targets', desc: 'Doctor quota performance & monthly revenue targets' },
    { name: 'User Management', desc: 'Staff directory, role assignments, & password resets' },
  ];

  // Map matrix to lookup
  const lookup = {};
  matrix.forEach((item) => {
    if (!lookup[item.role]) lookup[item.role] = {};
    lookup[item.role][item.module] = item.access_level;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <span>Role-Based Access Control (RBAC) Matrix</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Super Admin system-wide permission definitions across clinical, front desk, and executive modules
          </p>
        </div>

        <button
          type="button"
          onClick={fetchMatrix}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Matrix</span>
        </button>
      </div>

      {/* Policy banner */}
      <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl flex items-start gap-3">
        <Lock className="w-5 h-5 text-purple-700 mt-0.5 shrink-0" />
        <div className="space-y-1 text-purple-950 text-xs leading-relaxed">
          <span className="font-bold block">Hospital RBAC Security Policy</span>
          <p>
            • <strong>Super Admin:</strong> Holds immutable Full Access across all operational, clinical, and financial subsystems.<br />
            • Permission changes take effect immediately on next request/session synchronization with PostgreSQL persistence.
          </p>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading RBAC permission grid from database..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 min-w-[200px]">Module / Domain</th>
                  {roles.map((r) => (
                    <th key={r.key} className="py-3.5 px-3 text-center">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {modules.map((mod) => (
                  <tr key={mod.name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <div>{mod.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {mod.desc}
                      </div>
                    </td>

                    {roles.map((r) => {
                      const level = lookup[r.key]?.[mod.name] || (r.key === 'super_admin' ? 'full' : 'none');
                      const isSuper = r.key === 'super_admin';
                      const cellKey = `${r.key}-${mod.name}`;
                      const isCellUpdating = updatingCell === cellKey;

                      return (
                        <td key={r.key} className="py-3.5 px-3 text-center">
                          {isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                              <Lock className="w-3 h-3" />
                              <span>Full Access</span>
                            </span>
                          ) : (
                            <select
                              value={level}
                              disabled={isCellUpdating}
                              onChange={(e) => handleAccessChange(r.key, mod.name, e.target.value)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border focus:outline-none transition-all cursor-pointer ${
                                level === 'full'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : level === 'view'
                                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                                  : level === 'restricted' || level === 'partial'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              <option value="full">Full</option>
                              <option value="view">View Only</option>
                              <option value="restricted">Restricted</option>
                              <option value="none">No Access</option>
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
