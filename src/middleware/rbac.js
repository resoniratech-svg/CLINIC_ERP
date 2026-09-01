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

module.exports = { authorizeRoles };
