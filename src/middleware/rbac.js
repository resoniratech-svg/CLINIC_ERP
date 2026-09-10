const db = require('../db');
const { formatResponse } = require('../utils/helpers');

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatResponse(false, null, 'Unauthenticated'));
    }

    if (req.user.role === 'super_admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json(formatResponse(false, null, 'Permission denied for this role'));
  };
}

function checkPermission(moduleName) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatResponse(false, null, 'Unauthenticated'));
    }

    // Super Admin always has full access
    if (req.user.role === 'super_admin') {
      return next();
    }

    try {
      const result = await db.query(
        `SELECT access_level FROM role_permissions_matrix 
         WHERE role = $1 AND LOWER(module) = LOWER($2)`,
        [req.user.role, moduleName]
      );

      if (result.rows.length > 0) {
        const access = result.rows[0].access_level;
        if (access === 'none') {
          return res.status(403).json(
            formatResponse(false, null, `Access denied: ${moduleName} permission is set to No Access for ${req.user.role}`)
          );
        }
        if (access === 'restricted') {
          return res.status(403).json(
            formatResponse(false, null, `Access denied: ${moduleName} permission is restricted for ${req.user.role}`)
          );
        }
        if (access === 'view' && req.method !== 'GET') {
          return res.status(403).json(
            formatResponse(false, null, `Access denied: Read-only access for ${moduleName}`)
          );
        }
      }

      return next();
    } catch (err) {
      console.error('checkPermission error:', err);
      return res.status(500).json(formatResponse(false, null, 'Internal server error during permission check'));
    }
  };
}

/**
 * requireReceptionistPermission(permKey)
 *
 * Granular per-user permission check for Receptionist role.
 * Reads permissions embedded in JWT payload by auth.controller login().
 *
 * - super_admin: always passes through
 * - receptionist: checks req.user.receptionist_permissions[permKey] === true
 * - any other role: 403 (should not hit receptionist-only routes anyway)
 *
 * @param {string} permKey - one of: registration, enquiry, appointment, checkin,
 *   consultation_fee_billing, payment_collection, crm_calling, followup, renewal, due_management
 */
function requireReceptionistPermission(permKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatResponse(false, null, 'Unauthenticated'));
    }

    // Super Admin always has full access — never restrict
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Only applies to receptionist role
    if (req.user.role !== 'receptionist') {
      return res.status(403).json(formatResponse(false, null, 'Access denied: not a receptionist'));
    }

    const perms = req.user.receptionist_permissions;

    if (!perms) {
      // No permissions object in JWT — deny access to be safe
      return res.status(403).json(
        formatResponse(false, null, `Access denied: receptionist permissions not loaded. Please log out and log back in.`)
      );
    }

    if (perms[permKey] !== true) {
      return res.status(403).json(
        formatResponse(false, null, `Access denied: you do not have the '${permKey}' permission.`)
      );
    }

    return next();
  };
}

/**
 * requireCouponPermission()
 *
 * Granular RBAC check for Coupon Management module.
 * - super_admin: always allowed
 * - receptionist: checks coupon_management permission
 * - pro_manager: checks coupon_management permission
 * - doctor: checks coupon_management permission
 * - all other roles: 403 Access Denied
 */
function requireCouponPermission() {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatResponse(false, null, 'Unauthenticated'));
    }

    const { role, user_id } = req.user;

    // Super Admin always has full access
    if (role === 'super_admin') {
      return next();
    }

    // Role must be receptionist, pro_manager, or doctor
    if (!['receptionist', 'pro_manager', 'doctor'].includes(role)) {
      return res.status(403).json(
        formatResponse(false, null, `Access denied: Role '${role}' is not authorized for Coupon Management.`)
      );
    }

    // 1. Check permissions in JWT payload
    const tokenPerms = req.user.permissions ||
                       req.user.receptionist_permissions ||
                       req.user.pro_manager_permissions ||
                       req.user.doctor_permissions;

    if (tokenPerms && typeof tokenPerms === 'object' && tokenPerms.coupon_management !== undefined) {
      if (tokenPerms.coupon_management === true) {
        return next();
      }
      return res.status(403).json(
        formatResponse(false, null, `Access denied: you do not have Coupon Management permission.`)
      );
    }

    // 2. Authoritative database check if not embedded in token
    try {
      let allowed = false;
      if (role === 'receptionist') {
        const r = await db.query('SELECT coupon_management FROM receptionist_permissions WHERE user_id = $1', [user_id]);
        allowed = r.rows.length > 0 && r.rows[0].coupon_management === true;
      } else if (role === 'pro_manager') {
        const r = await db.query('SELECT coupon_management FROM pro_manager_permissions WHERE user_id = $1', [user_id]);
        allowed = r.rows.length > 0 && r.rows[0].coupon_management === true;
      } else if (role === 'doctor') {
        const r = await db.query('SELECT coupon_management FROM doctor_permissions WHERE user_id = $1', [user_id]);
        allowed = r.rows.length > 0 && r.rows[0].coupon_management === true;
      }

      if (allowed) {
        return next();
      }

      return res.status(403).json(
        formatResponse(false, null, `Access denied: you do not have Coupon Management permission.`)
      );
    } catch (err) {
      console.error('requireCouponPermission error:', err);
      return res.status(500).json(formatResponse(false, null, 'Internal server error during permission check'));
    }
  };
}

module.exports = { authorizeRoles, checkPermission, requireReceptionistPermission, requireCouponPermission };

