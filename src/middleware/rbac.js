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

module.exports = { authorizeRoles, checkPermission, requireReceptionistPermission };
