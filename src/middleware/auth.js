const jwt = require('jsonwebtoken');
const { formatResponse } = require('../utils/helpers');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(formatResponse(false, null, 'Access token required'));
  }

  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123!', (err, user) => {
    if (err) {
      return res.status(403).json(formatResponse(false, null, 'Invalid or expired token'));
    }
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
