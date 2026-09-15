const crypto = require('crypto');

function formatResponse(success, data = null, message = '') {
  return { success, data, message };
}

function generateTempPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous I, O
  const lower = 'abcdefghijkmnopqrstuvwxyz'; // exclude ambiguous l
  const digits = '23456789';                // exclude ambiguous 0, 1
  const special = '!@#$%&*';
  const allChars = upper + lower + digits + special;

  // Guarantee at least one from each character set
  const required = [
    upper.charAt(crypto.randomInt(0, upper.length)),
    lower.charAt(crypto.randomInt(0, lower.length)),
    digits.charAt(crypto.randomInt(0, digits.length)),
    special.charAt(crypto.randomInt(0, special.length))
  ];

  const remainingLength = Math.max(0, length - required.length);
  const remaining = [];
  for (let i = 0; i < remainingLength; i++) {
    remaining.push(allChars.charAt(crypto.randomInt(0, allChars.length)));
  }

  // Cryptographically shuffle the characters
  const combined = required.concat(remaining);
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = combined[i];
    combined[i] = combined[j];
    combined[j] = temp;
  }

  return combined.join('');
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
