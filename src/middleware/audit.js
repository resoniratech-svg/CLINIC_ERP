const db = require('../db');
const { parseUserAgent } = require('../utils/helpers');

function auditLogger(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const originalSend = res.send;
    res.send = function (body) {
      res.send = originalSend;
      const response = res.send(body);

      // Asynchronously log audit entry after sending response
      process.nextTick(async () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 400 && req.user) {
            const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
            const ua = req.headers['user-agent'] || '';
            const { browser, device } = parseUserAgent(ua);
            const auditCustom = res.locals.auditEntry || {};

            const moduleName = auditCustom.module || req.baseUrl.split('/')[3] || 'general';
            const actionName = auditCustom.action || `${req.method} ${req.originalUrl}`;
            const recordId = auditCustom.recordId ? String(auditCustom.recordId) : (req.params.id || null);
            const oldValue = auditCustom.oldValue ? JSON.stringify(auditCustom.oldValue) : null;
            const newValue = auditCustom.newValue ? JSON.stringify(auditCustom.newValue) : (req.body ? JSON.stringify(req.body) : null);

            await db.query(`
              INSERT INTO audit_logs (
                user_id, role, action, module, record_id, old_value, new_value, ip_address, device, browser, branch_id, remarks
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
              req.user.user_id,
              req.user.role,
              actionName,
              moduleName,
              recordId,
              oldValue,
              newValue,
              ip,
              device,
              browser,
              req.user.branch_id || 1,
              auditCustom.remarks || null
            ]);
          }
        } catch (err) {
          console.error('Audit logging error:', err);
        }
      });

      return response;
    };
  }
  next();
}

module.exports = { auditLogger };
