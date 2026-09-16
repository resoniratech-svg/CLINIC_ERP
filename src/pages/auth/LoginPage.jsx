import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import {
  ShieldCheck,
  Lock,
  User,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
  Users,
  Calendar,
  Pill,
  Cloud,
  BarChart3,
  ChevronDown
} from 'lucide-react';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isMustChangeOpen, setIsMustChangeOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const { login, user, token, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Unified single source of truth for branch assignment
  const activeBranchName = user?.branch_name || 'Karimnagar Main Branch';
  const activeBranchCode = user?.branch_code || 'KRM001';

  const routeUser = (user) => {
    const userRole = user?.role;
    if (userRole === 'receptionist') {
      showToast(`Welcome back, ${user.full_name || 'Receptionist'}!`, 'success');
      navigate('/receptionist/dashboard');
    } else if (userRole === 'executive') {
      showToast(`Welcome back, ${user.full_name || 'Executive'}!`, 'success');
      navigate('/executive/dashboard');
    } else if (userRole === 'doctor') {
      showToast(`Welcome back, Dr. ${user.full_name || 'Doctor'}!`, 'success');
      navigate('/doctor/dashboard');
    } else if (userRole === 'pro_manager') {
      showToast(`Welcome back, ${user.full_name || 'PRO Manager'}!`, 'success');
      navigate('/pro/dashboard');
    } else if (userRole === 'pharmacy') {
      showToast(`Welcome back, ${user.full_name || 'Pharmacist'}!`, 'success');
      navigate('/pharmacy/dashboard');
    } else {
      showToast(`Authenticated as ${user?.full_name || 'Super Admin'}`, 'success');
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    if (token && user) {
      routeUser(user);
    }
  }, [token, user]);

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
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col lg:flex-row bg-[#f4f7fb] font-sans text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* ========================================================================= */}
      {/* LEFT PANEL: BRAND & HEALTHCARE PLATFORM SHOWCASE                          */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-[54%] xl:w-[55%] relative flex-col justify-between p-12 xl:p-16 overflow-hidden select-none bg-[#09264c]">
        {/* Background Image: Stethoscope on Clinic Desk */}
        <div
          className="absolute inset-0 bg-cover bg-no-repeat bg-right"
          style={{ backgroundImage: "url('/assets/stethoscope_bg.jpg')" }}
        />

        {/* Gradient Blending Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#072142] via-[#0b2f5c]/95 to-[#0e3b6e]/70" />

        {/* Curved Wave Arc Overlay */}
        <svg
          className="absolute right-0 top-0 h-full w-48 text-[#0e3b6e]/40 pointer-events-none"
          viewBox="0 0 100 800"
          fill="none"
          preserveAspectRatio="none"
        >
          <path d="M100 0 C40 250, 20 450, 100 800 L100 0 Z" fill="currentColor" />
        </svg>

        {/* Watermark Calligraphy: "Healthy People Happier Communities" */}
        <div className="absolute top-24 right-10 xl:right-16 z-10 pointer-events-none select-none text-right">
          <div
            className="text-white/35 italic text-2xl xl:text-3xl leading-snug tracking-wider drop-shadow-xs transform -rotate-6 font-serif"
            style={{ fontFamily: "'Caveat', 'Dancing Script', 'Brush Script MT', cursive, serif" }}
          >
            Healthy<br />
            People<br />
            Happier<br />
            Communities
          </div>
        </div>

        {/* Top Branding Header */}
        <div className="relative z-10 flex justify-center">
          <img
            src="/assets/we_care.png"
            alt="WeCare Homeopathy"
            className="h-48 xl:h-56 2xl:h-64 w-auto object-contain drop-shadow-[0_0_35px_rgba(255,255,255,0.5)] drop-shadow-[0_14px_28px_rgba(0,0,0,0.5)] transition-all"
          />
        </div>

        {/* Main Content Area - Vertically Centered */}
        <div className="relative z-10 my-auto py-4 xl:py-6 max-w-xl">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0d3b66]/80 border border-white/20 text-blue-200 text-xs font-semibold tracking-wider uppercase mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Enterprise Healthcare Platform</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-3xl xl:text-4xl 2xl:text-[2.65rem] font-bold tracking-tight leading-[1.16] text-white mb-4">
            Smarter Healthcare.{' '}
            <span className="text-[#7dc4ff]">
              Connected Care.
            </span>
          </h1>

          {/* Supporting Paragraph */}
          <p className="text-sm xl:text-[15px] text-slate-200/90 leading-relaxed mb-8 font-normal max-w-lg">
            A centralized platform for managing clinic operations, patients, doctors, pharmacy,
            appointments, billing, reports, and administration across all clinic branches.
          </p>

          {/* 4 Feature Highlights Grid (2x2 Glassmorphism Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
            <div className="p-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 backdrop-blur-md transition-all shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white tracking-wide">Patient Management</h3>
                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">EHR, vitals & history</p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 backdrop-blur-md transition-all shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <Pill className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white tracking-wide">Pharmacy Management</h3>
                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">Inventory & dispensing</p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 backdrop-blur-md transition-all shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white tracking-wide">Appointments & Billing</h3>
                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">Queue tokens & ledger</p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 backdrop-blur-md transition-all shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white tracking-wide">Secure & Centralized</h3>
                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">Role-based controls</p>
                </div>
              </div>
            </div>
          </div>

          {/* Lower Indicators Row */}
          <div className="flex items-center justify-between text-xs text-slate-200/80 pt-5 border-t border-white/15">
            <div className="flex items-center gap-5 xl:gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-300" />
                <span>Multi-Branch Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-300" />
                <span>Cloud Enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-300" />
                <span>Better Patient Outcomes</span>
              </div>
            </div>

            <div className="text-[10px] tracking-widest text-blue-200/50 font-bold uppercase text-right leading-tight hidden xl:block shrink-0">
              <div>CARE</div>
              <div>MANAGE</div>
              <div>GROW</div>
              <div>TOGETHER</div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="relative z-10 pt-4 flex items-center justify-between text-xs text-slate-300/70">
          <span>&copy; {new Date().getFullYear()} WeCare Homeopathy ERP. All rights reserved.</span>
          <span className="text-[11px] text-slate-400">v2.4</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT PANEL: PREMIUM AUTHENTICATION SECTION                               */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[46%] xl:w-[45%] relative flex flex-col justify-center items-center px-4 py-8 sm:px-8 lg:px-12 bg-[#f4f7fb] min-h-screen overflow-hidden">
        {/* Decorative Wave Ribbon Background Graphics */}
        <svg
          className="absolute left-0 top-0 h-full w-56 pointer-events-none -translate-x-10 opacity-70"
          viewBox="0 0 200 800"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 0 C90 180, 190 320, 110 520 C60 660, 130 760, 180 800 L0 800 Z"
            fill="url(#wave-blue-gradient)"
          />
          <path
            d="M0 460 C90 530, 160 630, 110 750 C80 790, 40 800, 0 800 Z"
            fill="url(#wave-rose-gradient)"
            opacity="0.6"
          />
          <defs>
            <linearGradient id="wave-blue-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="wave-rose-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#fbcfe8" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Decorative Dotted Matrix (Top Right: 5x5 Grid) */}
        <div className="absolute top-8 right-8 grid grid-cols-5 gap-2 pointer-events-none opacity-40">
          {Array.from({ length: 25 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          ))}
        </div>

        {/* Faint Medical Cross Watermark (Bottom Right) */}
        <div className="absolute -bottom-10 -right-10 w-60 h-60 pointer-events-none opacity-[0.14] text-blue-400">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
          </svg>
        </div>

        {/* Authentication Card Container */}
        <div className="relative z-10 w-full max-w-[415px] min-w-0 mx-auto">
          {/* Mobile Top Branding */}
          <div className="lg:hidden text-center mb-5">
            <img
              src="/assets/wecare_logo.png"
              alt="WeCare Homeopathy"
              className="h-14 w-auto object-contain mx-auto mb-2"
            />
            <h1 className="text-base font-bold text-slate-800 tracking-tight">
              WeCare Homeopathy Clinic ERP
            </h1>
            <p className="text-xs text-slate-500">Smarter Healthcare • Connected Care</p>
          </div>

          {/* Refined Authentication Card */}
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_20px_50px_-10px_rgba(26,54,93,0.1),0_4px_12px_rgba(0,0,0,0.02)] p-7 sm:p-9 transition-all">
            {/* Header: Logo, Badge & Hierarchy */}
            <div className="flex flex-col items-center text-center">
              <div className="hidden lg:block mb-3.5">
                <img
                  src="/assets/wecare_logo.png"
                  alt="WeCare Homeopathy"
                  className="h-20 w-auto object-contain drop-shadow-2xs"
                />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Hospital ERP Portal</span>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Welcome back
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-normal">
                Sign in to securely access your clinic management dashboard.
              </p>

              {/* Security Indicator */}
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-medium mt-2.5">
                <Lock className="w-3 h-3 text-emerald-600" />
                <span>Secure clinic access</span>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Username or Mobile
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username or mobile"
                    className="w-full h-11 pl-10 pr-4 bg-slate-50/70 border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full h-11 pl-10 pr-10 bg-slate-50/70 border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
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
                  className="text-blue-600 hover:text-blue-700 font-semibold hover:underline cursor-pointer transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
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

            {/* Active Location Card - Matching User Reference */}
            <div className="mt-5 p-3 bg-blue-50/70 rounded-xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100/80 border border-blue-200 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Active Location
                  </div>
                  <div className="text-xs font-bold text-slate-900 leading-snug">
                    {activeBranchName}{' '}
                    <span className="text-slate-500 font-medium">({activeBranchCode})</span>
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-blue-500 shrink-0" />
            </div>

            {/* Micro-Information Note */}
            <p className="text-center text-[11px] text-slate-400 mt-2.5">
              Access is managed by your assigned clinic branch.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />

      <ChangePasswordModal
        isOpen={isMustChangeOpen}
        isForced={true}
        onSuccess={() => {
          setIsMustChangeOpen(false);
          if (updateUser) {
            updateUser({ must_change_password: false, requires_password_change: false });
          }
          routeUser({ ...(pendingUser || user), must_change_password: false });
        }}
      />
    </div>
  );
};
