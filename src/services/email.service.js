const nodemailer = require('nodemailer');

/**
 * Creates and returns a Nodemailer transporter based on environment configuration.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;
  const user = process.env.SMTP_USER || 'wecarehomeopathyknr@gmail.com';
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';

  if (!pass) {
    // In automated tests or environments where SMTP_PASSWORD is not yet configured,
    // we allow an in-memory transport or mock if explicit TEST_MODE is set.
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_REAL_EMAIL) {
      return {
        isMock: true,
        sendMail: async (mailOptions) => {
          return {
            messageId: `mock-${Date.now()}`,
            response: '250 Mock email accepted for delivery',
            accepted: [mailOptions.to],
            mailOptions
          };
        }
      };
    }
    throw new Error('SMTP credentials not configured. Please set SMTP_PASSWORD in environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false // Allow TLS in various server environments
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

/**
 * Sends the Super Admin temporary password recovery email.
 *
 * @param {Object} options
 * @param {string} options.to - Destination email address
 * @param {string} options.tempPassword - Generated temporary password
 * @param {Date|string} [options.requestedAt] - Timestamp of request
 * @param {number} [options.expiryMinutes=20] - Minutes until temporary password expires
 * @param {string} [options.ip] - Requester IP address
 * @returns {Promise<Object>} SendMail delivery result
 */
async function sendSuperAdminRecoveryEmail({ to, tempPassword, requestedAt = new Date(), expiryMinutes = 20, ip = '127.0.0.1' }) {
  const transporter = createTransporter();
  const fromAddress = process.env.SMTP_FROM || '"WeCare Homoeopathy Clinics" <wecarehomeopathyknr@gmail.com>';
  const loginUrl = process.env.ERP_LOGIN_URL || process.env.FRONTEND_URL || 'https://wecare-wecare-frontend.n1ogh.easypanel.host/login';
  const formattedTime = new Date(requestedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const subject = 'WeCare ERP — Super Admin Temporary Password';

  const textContent = `
WeCare Homoeopathy Clinics
Super Admin Password Recovery

A password recovery request was received for your Super Admin ERP account.

Temporary Password:
${tempPassword}

Important:
- This temporary password is valid for ${expiryMinutes} minutes only.
- It can be used only once.
- After login, you must create a new permanent password.
- Do not share this password with anyone.

ERP Login URL:
${loginUrl}

Recovery Requested At:
${formattedTime}
Request IP: ${ip}

For security, if you did not initiate this request, investigate the account immediately.
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #1d4ed8; background: linear-gradient(135deg, #1e40af, #2563eb); padding: 28px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
    .body { padding: 32px; }
    .intro { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .code-box { background: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .code-label { font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    .code-value { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 26px; font-weight: 800; letter-spacing: 0.12em; color: #0f172a; word-break: break-all; }
    .rules { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 14px 16px; margin: 24px 0; font-size: 13px; color: #991b1b; line-height: 1.5; }
    .rules ul { margin: 6px 0 0 0; padding-left: 20px; }
    .rules li { margin-bottom: 4px; }
    .button-container { text-align: center; margin: 28px 0; }
    .login-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
    .meta-table { width: 100%; border-top: 1px solid #e2e8f0; margin-top: 28px; padding-top: 16px; font-size: 12px; color: #64748b; }
    .meta-table td { padding: 4px 0; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>WeCare Homoeopathy Clinics</h1>
      <p>Super Admin Password Recovery</p>
    </div>
    <div class="body">
      <p class="intro">
        Hello <strong>Super Admin</strong>,<br>
        A password recovery request was received for your administrator account on the Hospital ERP system.
      </p>

      <div class="code-box">
        <div class="code-label">Your One-Time Temporary Password</div>
        <div class="code-value">${tempPassword}</div>
      </div>

      <div class="rules">
        <strong>Important Security Instructions:</strong>
        <ul>
          <li>This temporary password is valid for <strong>${expiryMinutes} minutes</strong> only.</li>
          <li>It is strictly <strong>single-use</strong> and will be invalidated immediately after use.</li>
          <li>Upon signing in, you will be prompted to <strong>create a new permanent password</strong>.</li>
          <li>Do not share or forward this temporary credential.</li>
        </ul>
      </div>

      <div class="button-container">
        <a href="${loginUrl}" class="login-btn" target="_blank">Open ERP Login Portal &rarr;</a>
      </div>

      <table class="meta-table">
        <tr>
          <td><strong>Requested At:</strong></td>
          <td>${formattedTime}</td>
        </tr>
        <tr>
          <td><strong>Requester IP:</strong></td>
          <td>${ip}</td>
        </tr>
      </table>
    </div>
    <div class="footer">
      This is an automated security message from WeCare Homoeopathy Clinic ERP.<br>
      If you did not request this password recovery, please inspect the system audit logs immediately.
    </div>
  </div>
</body>
</html>
`.trim();

  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    text: textContent,
    html: htmlContent
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
}

module.exports = {
  createTransporter,
  sendSuperAdminRecoveryEmail
};
