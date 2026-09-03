const request = require('supertest');
const app = require('../src/app');
const seed = require('../src/db/seed');

async function debug() {
  await seed();
  console.log('Seeded.');

  // Admin login
  const adminRes = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'SuperAdmin@123' });
  console.log('Admin login status:', adminRes.status);
  const adminToken = adminRes.body.data.token;

  // Rec login
  const recRes = await request(app).post('/api/v1/auth/login').send({ username: 'rita_rec', password: 'Password@123' });
  console.log('Rec login status:', recRes.status);
  const recToken = recRes.body.data.token;

  // Register walkin test
  const regRes = await request(app).post('/api/v1/receptionist/register-walkin').set('Authorization', `Bearer ${recToken}`).send({
    patient: { full_name: 'Debug Patient', mobile_number: '9998887776', age: 30, gender: 'male' },
    appointment: { doctor_id: 1, appointment_date: new Date().toISOString().split('T')[0], appointment_time: '06:45', appointment_type: 'new' },
    billing: { amount: 500, discount: 0, payment_mode: 'cash' }
  });

  console.log('Register walkin status:', regRes.status, regRes.body);
  process.exit(0);
}

debug().catch(err => {
  console.error('Debug error:', err);
  process.exit(1);
});
