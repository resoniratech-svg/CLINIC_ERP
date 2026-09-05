import React, { useEffect, useState } from 'react';
import { usersApi } from '../../api';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { CreateUserModal } from './CreateUserModal';
import { UserDetailsModal } from './UserDetailsModal';
import { EditUserModal } from './EditUserModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Users, UserPlus, Search, Filter, Eye, Edit3, UserCheck, UserX, Trash2, ShieldAlert } from 'lucide-react';

export const AllUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const { showToast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await usersApi.getUsers(params);
      if (res.success) {
        setUsers(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch staff members', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [roleFilter, statusFilter, searchTerm]);

  const handleStatusUpdate = async (userId, newStatus, userName) => {
    if (!window.confirm(`Are you sure you want to mark ${userName} as ${newStatus}?`)) return;
    try {
      const res = await usersApi.updateUserStatus(userId, newStatus);
      if (res.success) {
        showToast(`User ${userName} is now ${newStatus}`, 'success');
        fetchUsers();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update user status', 'error');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (userId === 1 || userName === 'admin') {
      showToast('The Primary Root Administrator account cannot be deleted', 'error');
      return;
    }
    if (currentUser && currentUser.user_id === userId) {
      showToast('You cannot delete your own logged-in account', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete staff member "${userName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await usersApi.deleteUser(userId);
      if (res.success) {
        showToast(res.message || `User ${userName} deleted successfully`, 'success');
        fetchUsers();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete user', 'warning', 60000, 'center');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Staff Directory & User Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Oversee hospital workforce, assign role permissions, and govern active personnel
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create New User</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, employee ID, mobile, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Hospital Roles</option>
            <option value="receptionist">Receptionist</option>
            <option value="doctor">Doctor</option>
            <option value="pro_manager">PRO / Manager</option>
            <option value="executive">Executive (Call Center)</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="super_admin">Super Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading staff registry..." />
        ) : users.length === 0 ? (
          <EmptyState
            title="No staff members found"
            description="Adjust your search filters or click 'Create New User' to onboard staff."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Last Login</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {u.employee_id} • @{u.username}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={u.role}>{u.role?.replace('_', ' ')}</Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">{u.mobile_number}</div>
                      <div className="text-[11px] text-slate-400">{u.email || '—'}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {u.department || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={u.status}>{u.status}</Badge>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => setSelectedUserId(u.user_id)}
                        title="View Details"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setEditingUser(u)}
                        title="Edit Staff Member"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {u.status === 'active' ? (
                        <button
                          onClick={() => handleStatusUpdate(u.user_id, 'inactive', u.full_name)}
                          title="Deactivate User"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusUpdate(u.user_id, 'active', u.full_name)}
                          title="Activate User"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}

                      {u.user_id !== 1 && u.username !== 'admin' && currentUser?.user_id !== u.user_id && (
                        <button
                          onClick={() => handleDeleteUser(u.user_id, u.full_name)}
                          title="Delete User"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onUserCreated={fetchUsers}
      />

      <EditUserModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
        onUserUpdated={fetchUsers}
      />

      <UserDetailsModal
        isOpen={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        userId={selectedUserId}
      />
    </div>
  );
};
