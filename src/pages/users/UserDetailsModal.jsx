import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { usersApi } from '../../api';

export const UserDetailsModal = ({ isOpen, onClose, userId }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      usersApi
        .getUserById(userId)
        .then((res) => {
          if (res.success) setUser(res.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setUser(null);
    }
  }, [isOpen, userId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hospital Staff Profile & Permissions" maxWidth="max-w-2xl">
      {loading || !user ? (
        <LoadingSpinner label="Fetching user details..." />
      ) : (
        <div className="space-y-6 text-xs text-slate-700">
          {/* Header Profile */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-red-600 text-white font-bold text-lg flex items-center justify-center shadow-xs">
              {user.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{user.full_name}</h3>
                <Badge variant={user.role}>{user.role}</Badge>
                <Badge variant={user.status}>{user.status}</Badge>
              </div>
              <p className="text-slate-500 mt-0.5">
                Employee ID: <span className="font-mono font-bold text-slate-800">{user.employee_id}</span> • Username: <span className="font-mono font-bold text-slate-800">{user.username}</span>
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-400 text-[11px] block">Mobile Number</span>
              <span className="font-semibold text-slate-800">{user.mobile_number || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Email Address</span>
              <span className="font-semibold text-slate-800">{user.email || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Department</span>
              <span className="font-semibold text-slate-800">{user.department || 'General'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Designation</span>
              <span className="font-semibold text-slate-800">{user.designation || 'Staff'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Date of Joining</span>
              <span className="font-semibold text-slate-800">
                {user.date_of_joining ? new Date(user.date_of_joining).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Last Login</span>
              <span className="font-semibold text-slate-800">
                {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>

          {/* Role specific info */}
          {user.doctor_details && (
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/70 space-y-2">
              <h4 className="font-bold text-blue-950 uppercase text-[11px]">Doctor Clinical Specifics</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>Specialization: <span className="font-bold text-slate-900">{user.doctor_details.specialization}</span></div>
                <div>Reg No: <span className="font-bold text-slate-900">{user.doctor_details.medical_registration_number || 'N/A'}</span></div>
                <div>Experience: <span className="font-bold text-slate-900">{user.doctor_details.experience_years} years</span></div>
                <div>New Fee: <span className="font-bold text-blue-700">₹{user.doctor_details.new_consultation_fee}</span></div>
                <div>Renewal Fee: <span className="font-bold text-blue-700">₹{user.doctor_details.renewal_consultation_fee}</span></div>
                <div>Follow-up Fee: <span className="font-bold text-blue-700">₹{user.doctor_details.followup_consultation_fee}</span></div>
              </div>
            </div>
          )}

          {user.executive_details && (
            <div className="p-4 bg-sky-50/50 rounded-2xl border border-sky-200/70 space-y-2">
              <h4 className="font-bold text-sky-950 uppercase text-[11px]">Executive Incentive Rules</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>Per Lead Incentive: <span className="font-bold text-blue-700">₹{user.executive_details.per_lead_incentive}</span></div>
                <div>Trigger: <span className="font-bold capitalize text-slate-900">{user.executive_details.incentive_trigger}</span></div>
              </div>
            </div>
          )}

          {user.permissions && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-800 uppercase text-[11px]">Configured Role Permissions</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(user.permissions).map(([k, v]) => {
                  if (['id', 'user_id', 'created_at', 'updated_at'].includes(k)) return null;
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${v ? 'bg-blue-600' : 'bg-slate-300'}`} />
                      <span className="capitalize text-[11px] font-medium">{k.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
