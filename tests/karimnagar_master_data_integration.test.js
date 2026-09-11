const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const fs = require('fs');
const path = require('path');
const { resolveOrCreateLocation } = require('../src/utils/locationResolver');

describe('Karimnagar District Master Registry Integration Suite', () => {
  let adminToken;

  const expectedMandals = {
    'Karimnagar': ['Karimnagar', 'Pothugal (Submerged)', 'Hasnapur (Submerged)'],
    'Kothapally': ['Malkapur', 'Kothapalli (Haveli)', 'Laxmipur', 'Sitarampur', 'Rekurthi', 'Nagulamallial', 'Chinthakunta', 'Khazipur', 'Asifnagar', 'Elgandal', 'Baddipalli', 'Kamanpur'],
    'Karimnagar Rural': ['Nagunur', 'Jublinagar', 'Fakeerpet', 'Chamanpalli', 'Taharakondapur', 'Cherlabuthkur', 'Maqdumpur', 'Irukulla', 'Elbotharam', 'Vallampahad', 'Durshed', 'Chegurthi', 'Bommakal', 'Arepalli'],
    'Manakondur': ['Lingapur', 'Veldi', 'Vegurupalle', 'Utoor', 'Pachunur', 'Maddikunta', 'Kelledu', 'Devampalle', 'Lalithapur', 'Annaram', 'Manakondur', 'Munjampalle', 'Edulagattepalle', 'Chenjerla', 'Gattududdenapalle', 'Vannaram', 'Gangipalle', 'Kondapalkala'],
    'Thimmapur': ['Vachunur', 'Thimmapur', 'Porandla', 'Mannempalle', 'Nustulapur', 'Nedunur', 'Renikunta', 'Kothapalle (P.N)', 'Nallagonda', 'Mallapur', 'Polampalle', 'Parlapalle', 'Mogilipalem', 'Alugunur'],
    'Ganneruvaram': ['Ganneruvaram', 'Paruvella', 'Kashimpet', 'Madhapur', 'Mailaram', 'Jangapalli', 'Sangem', 'Gopalpur', 'Gunukula Kondapur', 'Yaswada', 'Panthul Kondapur', 'Cherlapur'],
    'Gangadhara': ['Venkataipalle', 'Ryalapalle', 'Kachireddipalle', 'Kondaipalle', 'Burgupalle', 'Narasimhulapalle', 'Sarvareddipalle', 'Nagireddipur', 'Gangadhara', 'Narayanpur', 'Islampur', 'Mallapur', 'Uppara Mallial', 'Kurikial', 'Nyalakondapalle', 'Gattuboothkur', 'Garsekurthi', 'Achampalli', 'Oddyaram'],
    'Ramadugu': ['Thirmalapur', 'Sriramulapalle', 'Chippakurthi', 'Gundi', 'Laxmipur', 'Dathojipet', 'Ramadugu', 'Shanagar', 'Fakeerpet', 'Gopalraopet', 'Koratpalle', 'Rudraram', 'Mothe', 'Kistapur', 'Vedira', 'Velichal', 'Deshrajpalle', 'Kokkerakunta', 'Vannaram'],
    'Choppadandi': ['Ragampeta', 'Chityalpalle', 'Arnakonda', 'Choppadandi', 'Gumlapur', 'Katnepalle', 'Konerupalle', 'Rukmapur', 'Kolimikunta', 'Chakunta', 'Vedurughattu'],
    'Chigurumamidi': ['Mudimanikyam', 'Ramancha', 'Mulkanoor', 'Chigurumamidi', 'Rekonda', 'Bommanapalle', 'Sundaragiri', 'Indurthi', 'Nawabpeta', 'Kondapur', 'Ullampalle'],
    'Veenavanka': ['Mamidalapalle', 'Elbaka', 'Bonthupalle', 'Challoor', 'Ghanmukula', 'Korkal (Jangampalle)', 'Kondapaka', 'Pothireddipalle', 'Reddipalle', 'Brahmanpalle', 'Veenavanka', 'Kanparthi', 'Bethigal', 'Valbapur'],
    'V. Saidapur': ['Eklaspur', 'Somaram', 'Vennampalle', 'Ramchandrapur', 'Elabotharam', 'Godisala', 'Saidapur', 'Venkepalle', 'Duddenapalle', 'Akunur', 'Ghanpur', 'Raikal', 'Bommakal', 'Ammanagurthi'],
    'Shankarapatnam': ['Yeradpalle', 'Arkandla', 'Gaddapaka', 'Kalvala', 'Kachapur', 'Rajapur', 'Dharmaram', 'Kannapur', 'Mutharam', 'Thadikal', 'Ambalpur', 'Kareempet', 'Keshavapatnam', 'Kothagattu', 'Molangur', 'Amudalapalle', 'Metpalle'],
    'Huzurabad': ['Singapur', 'Sirsapalle', 'Pothireddipet', 'Chelpur', 'Jupaka', 'Huzurabad', 'Thummanapalle', 'Bornapalle', 'Katrepalle', 'Kandugula', 'Kanukulagidda', 'Dharmarajupalle'],
    'Jammikunta': ['Jammikunta', 'Korapalli', 'Saidabad', 'Vilasagar', 'Thanugula', 'Bijigirisharif', 'Vavilala', 'Dharmaram (P_B)', 'Madipalli'],
    'Ellandakunta': ['Ellandakunta', 'Chinnakomatpalli', 'Vanthadupula', 'Bujunoor', 'Rachapalli', 'Tekurthy', 'Sirsed', 'Patharlapalli', 'Mallial', 'Kanagarthy']
  };

  beforeAll(async () => {
    // Authenticate Super Admin for settings API testing
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'SuperAdmin@123' });
    adminToken = loginRes.body?.data?.token;
  });

  afterAll(async () => {
    // Keep pool open for subsequent test suites if any
  });

  describe('1. Database Structure & Exact Counts', () => {
    test('1.1 All 16 Karimnagar mandals exist and are marked active', async () => {
      const mandalNames = Object.keys(expectedMandals);
      expect(mandalNames.length).toBe(16);

      for (const mName of mandalNames) {
        const res = await db.query('SELECT * FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [mName]);
        expect(res.rows.length).toBe(1);
        expect(res.rows[0].status).toBe('active');
      }
    });

    test('1.2 Every mandal has its exact corresponding villages linked hierarchically', async () => {
      let grandTotalVillages = 0;

      for (const [mName, vList] of Object.entries(expectedMandals)) {
        const mRes = await db.query('SELECT * FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [mName]);
        expect(mRes.rows.length).toBe(1);
        const mandalId = mRes.rows[0].id;

        const vRes = await db.query('SELECT * FROM master_villages WHERE mandal_id = $1', [mandalId]);
        const foundVillages = vRes.rows.map(r => r.name);

        expect(foundVillages.length).toBe(vList.length);
        for (const vName of vList) {
          expect(foundVillages).toContain(vName);
        }

        // All villages under this mandal must be active
        vRes.rows.forEach(r => {
          expect(r.status).toBe('active');
          expect(r.mandal_id).toBe(mandalId);
        });

        grandTotalVillages += vList.length;
      }

      expect(grandTotalVillages).toBe(209);
    });

    test('1.3 Submerged villages and specific official designations are precisely preserved', async () => {
      const karimnagarRes = await db.query(`
        SELECT v.name FROM master_villages v
        JOIN master_mandals m ON v.mandal_id = m.id
        WHERE m.name = 'Karimnagar'
      `);
      const kNames = karimnagarRes.rows.map(r => r.name);
      expect(kNames).toContain('Pothugal (Submerged)');
      expect(kNames).toContain('Hasnapur (Submerged)');
      expect(kNames).toContain('Karimnagar');

      const gangadharaRes = await db.query(`
        SELECT v.name FROM master_villages v
        JOIN master_mandals m ON v.mandal_id = m.id
        WHERE m.name = 'Gangadhara'
      `);
      const gNames = gangadharaRes.rows.map(r => r.name);
      expect(gNames).toContain('Uppara Mallial');
    });

    test('1.4 Same-named villages across different mandals are isolated to their specific mandal_id', async () => {
      // e.g. Mallapur exists in Thimmapur and Gangadhara
      const mallapurRes = await db.query(`
        SELECT v.id, v.name, m.name as mandal_name
        FROM master_villages v
        JOIN master_mandals m ON v.mandal_id = m.id
        WHERE v.name = 'Mallapur'
      `);
      expect(mallapurRes.rows.length).toBe(2);
      const mandalNames = mallapurRes.rows.map(r => r.mandal_name);
      expect(mandalNames).toContain('Thimmapur');
      expect(mandalNames).toContain('Gangadhara');
    });
  });

  describe('2. Migration Idempotency Contract', () => {
    test('2.1 Re-applying karimnagar_district_master_data.sql does not create duplicates', async () => {
      const beforeMCount = await db.query('SELECT COUNT(*) FROM master_mandals');
      const beforeVCount = await db.query('SELECT COUNT(*) FROM master_villages');

      const sqlPath = path.join(__dirname, '../migrations/karimnagar_district_master_data.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await db.query(sql);

      const afterMCount = await db.query('SELECT COUNT(*) FROM master_mandals');
      const afterVCount = await db.query('SELECT COUNT(*) FROM master_villages');

      expect(afterMCount.rows[0].count).toBe(beforeMCount.rows[0].count);
      expect(afterVCount.rows[0].count).toBe(beforeVCount.rows[0].count);
    });
  });

  describe('3. Master Data REST API Validation', () => {
    test('3.1 GET /api/v1/settings/master/mandals returns active mandals including Karimnagar', async () => {
      const res = await request(app)
        .get('/api/v1/settings/master/mandals?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const names = res.body.data.map(m => m.name);
      expect(names).toContain('Karimnagar');
      expect(names).toContain('Kothapally');
      expect(names).toContain('Ellandakunta');
      expect(names).toContain('Shankarapatnam');
    });

    test('3.2 GET /api/v1/settings/master/villages returns villages with joined mandal_name', async () => {
      const res = await request(app)
        .get('/api/v1/settings/master/villages?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const pothugal = res.body.data.find(v => v.name === 'Pothugal (Submerged)');
      expect(pothugal).toBeDefined();
      expect(pothugal.mandal_name).toBe('Karimnagar');
    });

    test('3.3 GET /api/v1/settings/master/villages supports searching by mandal name', async () => {
      const res = await request(app)
        .get('/api/v1/settings/master/villages?q=Choppadandi')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(11);
      res.body.data.forEach(v => {
        const matchesVillage = v.name.toLowerCase().includes('choppadandi');
        const matchesMandal = (v.mandal_name || '').toLowerCase().includes('choppadandi');
        expect(matchesVillage || matchesMandal).toBe(true);
      });
    });

    test('3.4 GET /api/v1/settings/master/villages supports filtering by mandal_id', async () => {
      const mRes = await db.query("SELECT id FROM master_mandals WHERE name = 'Huzurabad'");
      const huzurabadId = mRes.rows[0].id;

      const res = await request(app)
        .get(`/api/v1/settings/master/villages?mandal_id=${huzurabadId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(12);
      res.body.data.forEach(v => {
        expect(v.mandal_id).toBe(huzurabadId);
        expect(v.mandal_name).toBe('Huzurabad');
      });
    });
  });

  describe('4. Dynamic Location Resolver Integration', () => {
    test('4.1 Explicit village_id resolves village name, mandal_id, and mandal_name', async () => {
      const vRes = await db.query("SELECT id FROM master_villages WHERE name = 'Pothugal (Submerged)'");
      const vId = vRes.rows[0].id;

      const resolution = await resolveOrCreateLocation(db, { village_id: vId });
      expect(resolution.error).toBeUndefined();
      expect(resolution.village).toBe('Pothugal (Submerged)');
      expect(resolution.mandal).toBe('Karimnagar');
      expect(resolution.village_id).toBe(vId);
      expect(resolution.mandal_id).toBeDefined();
    });

    test('4.2 "Village — Mandal" formatted string resolves without creating duplicates', async () => {
      const beforeVCount = await db.query('SELECT COUNT(*) FROM master_villages');
      const beforeMCount = await db.query('SELECT COUNT(*) FROM master_mandals');

      const resolution = await resolveOrCreateLocation(db, {
        village_mandal: 'Pothugal (Submerged) — Karimnagar'
      });

      expect(resolution.error).toBeUndefined();
      expect(resolution.village).toBe('Pothugal (Submerged)');
      expect(resolution.mandal).toBe('Karimnagar');

      const afterVCount = await db.query('SELECT COUNT(*) FROM master_villages');
      const afterMCount = await db.query('SELECT COUNT(*) FROM master_mandals');

      expect(afterVCount.rows[0].count).toBe(beforeVCount.rows[0].count);
      expect(afterMCount.rows[0].count).toBe(beforeMCount.rows[0].count);
    });

    test('4.3 Single mandal name resolves mandal without village', async () => {
      const resolution = await resolveOrCreateLocation(db, { village_mandal: 'Karimnagar' });
      expect(resolution.error).toBeUndefined();
      expect(resolution.mandal).toBe('Karimnagar');
      expect(resolution.village).toBeNull();
      expect(resolution.mandal_id).toBeDefined();
    });
  });
});
