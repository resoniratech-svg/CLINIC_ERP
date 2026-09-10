import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('clinic_token') || null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('clinic_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const response = await authApi.login({ username, password });
      if (response.success && response.data) {
        const { token: jwtToken, user: userData } = response.data;
        setToken(jwtToken);
        setUser(userData);
        localStorage.setItem('clinic_token', jwtToken);
        localStorage.setItem('clinic_user', JSON.stringify(userData));
        return { success: true, user: userData };
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await authApi.logout().catch(() => {});
      }
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('clinic_token');
      localStorage.removeItem('clinic_user');
    }
  };

  const updateUser = (updatedFields, newToken) => {
    setUser((prev) => {
      if (!prev) return updatedFields;
      const next = { ...prev, ...updatedFields };
      localStorage.setItem('clinic_user', JSON.stringify(next));
      return next;
    });
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('clinic_token', newToken);
    }
  };

  /**
   * hasPermission(key)
   *
   * Returns true if the current user is allowed to access the given module.
   *
   * Rules:
   *   - super_admin      → always true (unrestricted)
   *   - receptionist     → checks user.permissions[key] === true
   *   - all other roles  → always true (their access is controlled by role-level RBAC, not granular)
   *
   * @param {string} key - one of: registration, enquiry, appointment, checkin,
   *   consultation_fee_billing, payment_collection, crm_calling, followup, renewal, due_management
   * @returns {boolean}
   */
  const hasPermission = (key) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;

    // Check if permission key is explicitly defined in user.permissions
    if (user.permissions && typeof user.permissions === 'object') {
      if (user.permissions[key] !== undefined) {
        return user.permissions[key] === true;
      }
    }

    if (user.role === 'receptionist') {
      if (!user.permissions || typeof user.permissions !== 'object') return false;
      return user.permissions[key] === true;
    }

    // Coupon management is strictly gated by permission for non-super_admin users
    if (key === 'coupon_management') {
      return false;
    }

    // Other roles use role-level RBAC for their default features
    return true;
  };

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ token, user, isSuperAdmin, loading, login, logout, updateUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
