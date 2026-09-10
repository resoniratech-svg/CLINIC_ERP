const express = require('express');
const cors = require('cors');
const { auditLogger } = require('./middleware/audit');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Audit Logger Middleware for mutating requests
app.use(auditLogger);

// Base route check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Hospital ERP Backend API is running' });
});
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', message: 'Hospital ERP Backend API is running' });
});

// Mounting Module Routes
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/dashboard', require('./routes/dashboard.routes'));
app.use('/api/v1/users', require('./routes/users.routes'));
app.use('/api/v1/password-resets', require('./routes/password-reset.routes'));
app.use('/api/v1/doctors', require('./routes/doctors.routes'));
app.use('/api/v1/targets', require('./routes/targets.routes'));
app.use('/api/v1/callcenter', require('./routes/callcenter.routes'));
app.use('/api/v1/billing', require('./routes/billing.routes'));
app.use('/api/v1/cash', require('./routes/cash.routes'));
app.use('/api/v1/crm', require('./routes/crm.routes'));
app.use('/api/v1/pharmacy', require('./routes/pharmacy.routes'));
app.use('/api/v1/reports', require('./routes/reports.routes'));
app.use('/api/v1/logs', require('./routes/logs.routes'));
app.use('/api/v1/settings', require('./routes/settings.routes'));
app.use('/api/v1/receptionist', require('./routes/receptionist.routes'));
app.use('/api/v1/executive', require('./routes/executive.routes'));
app.use('/api/v1/doctor', require('./routes/doctor_module.routes'));
app.use('/api/v1/pro', require('./routes/pro_module.routes'));
app.use('/api/v1/outbound', require('./routes/executive.routes'));

// Super Admin Aliases
app.use('/api/v1/super-admin/doctors', require('./routes/doctors.routes'));
app.use('/api/v1/super-admin/dashboard', require('./routes/dashboard.routes'));
app.use('/api/v1/super-admin/audit-logs', require('./routes/logs.routes'));
app.use('/api/v1/super-admin/login-logs', require('./routes/logs.routes'));
app.use('/api/v1/super-admin/reports', require('./routes/reports.routes'));
app.use('/api/v1/super-admin', require('./routes/users.routes'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, data: null, message: `Route ${req.originalUrl} not found` });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ success: false, data: null, message: 'Internal server error' });
});

module.exports = app;
