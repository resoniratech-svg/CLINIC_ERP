const crypto = require('crypto');

function formatResponse(success, data = null, message = '') {
  return { success, data, message };
}

function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function parseUserAgent(ua = '') {
  let browser = 'Unknown';
  let device = 'Desktop';

  if (!ua) return { browser, device };

  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';

  return { browser, device };
}

module.exports = {
  formatResponse,
  generateTempPassword,
  parseUserAgent,
};
