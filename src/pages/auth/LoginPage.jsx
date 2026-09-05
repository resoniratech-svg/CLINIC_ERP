import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ShieldCheck, Lock, User, Loader2, ArrowRight } from 'lucide-react';

export const LoginPage = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('SuperAdmin@123');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isMustChangeOpen, setIsMustChangeOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const routeUser = (user) => {
    const userRole = user?.role;
    if (userRole === 'receptionist') {
      showToast(`Welcome back, ${user.full_name || 'Receptionist'}!`, 'success');
      navigate('/receptionist/dashboard');
    } else if (userRole === 'executive') {
      showToast(`Welcome back, ${user.full_name || 'Executive'}!`, 'success');
      navigate('/executive/dashboard');
    } else {
      showToast(`Authenticated as ${user?.full_name || 'Super Admin'}`, 'success');
      navigate('/dashboard');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showToast('Please enter both username and password', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.success) {
        if (res.user?.must_change_password) {
          setPendingUser(res.user);
          setIsMustChangeOpen(true);
          showToast('Temporary password detected. Please set a new permanent password.', 'info');
        } else {
          routeUser(res.user);
        }
      }
    } catch (err) {
      showToast(err.message || 'Authentication failed. Please verify your credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-red-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
          {/* Top Brand Banner */}
          <div className="p-8 pb-6 text-center border-b border-slate-100 bg-gradient-to-b from-blue-50/60 to-white">
            <div className="w-64 h-36 mx-auto mb-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center">
              <img
                src="/assets/wecare_logo.png"
                alt="WeCare Homeopathy"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-800 text-xs font-bold shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Hospital ERP Portal</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Username or Mobile
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-slate-600 font-medium">Remember session</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 text-white font-bold rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Single Branch Notice */}
          <div className="px-8 pb-6 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 font-medium">
              Active Location: <strong className="text-slate-800">Karimnagar Main Branch</strong> (KRM001)
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />

      <ChangePasswordModal
        isOpen={isMustChangeOpen}
        isForced={true}
        onSuccess={() => {
          setIsMustChangeOpen(false);
          routeUser(pendingUser);
        }}
      />
    </div>
  );
};
