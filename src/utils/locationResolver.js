/**
 * Location Resolver Utility for dynamic Village -> Mandal resolution & master data auto-creation.
 * Ensures consistent parsing, case-insensitivity, and deduplication scoped by parent mandal.
 */

async function resolveOrCreateLocation(client, params = {}) {
  const { village_mandal, village, mandal, village_id, mandal_id } = params;

  let vId = village_id ? parseInt(village_id, 10) : null;
  let mId = mandal_id ? parseInt(mandal_id, 10) : null;
  let vName = village && typeof village === 'string' ? village.trim() : null;
  let mName = mandal && typeof mandal === 'string' ? mandal.trim() : null;

  // 1. If explicit village_id is provided, resolve directly from master_villages
  if (vId && !isNaN(vId)) {
    const vRes = await client.query(`
      SELECT v.*, m.name as mandal_name
      FROM master_villages v
      LEFT JOIN master_mandals m ON v.mandal_id = m.id
      WHERE v.id = $1
    `, [vId]);
    if (vRes.rows.length > 0) {
      const row = vRes.rows[0];
      vName = row.name;
      mId = row.mandal_id || mId;
      mName = row.mandal_name || mName;
      return { village: vName, mandal: mName, village_id: vId, mandal_id: mId };
    }
  }

  // 2. If explicit mandal_id is provided without village
  if (mId && !isNaN(mId) && !vName) {
    const mRes = await client.query(`SELECT * FROM master_mandals WHERE id = $1`, [mId]);
    if (mRes.rows.length > 0) {
      mName = mRes.rows[0].name;
      return { village: null, mandal: mName, village_id: null, mandal_id: mId };
    }
  }

  // 3. Parse input string if village_mandal is provided and village/mandal are not both set
  let rawVillage = vName;
  let rawMandal = mName;

  if ((!rawVillage || !rawMandal) && village_mandal && typeof village_mandal === 'string') {
    const input = village_mandal.trim();
    if (input.includes(',')) {
      const parts = input.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        rawVillage = parts[0];
        rawMandal = parts.slice(1).join(', ').trim();
      } else if (parts.length === 1) {
        rawVillage = parts[0];
      }
    } else if (/\s+[-—]\s+/.test(input)) {
      const parts = input.split(/\s+[-—]\s+/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        rawVillage = parts[0];
        rawMandal = parts.slice(1).join(' ').trim();
      }
    } else {
      // Check if the entire input matches an existing Village or Mandal in master data
      const exactV = await client.query(`
        SELECT v.*, m.name as mandal_name
        FROM master_villages v
        LEFT JOIN master_mandals m ON v.mandal_id = m.id
        WHERE LOWER(TRIM(v.name)) = LOWER(TRIM($1))
      `, [input]);
      if (exactV.rows.length === 1) {
        return {
          village: exactV.rows[0].name,
          mandal: exactV.rows[0].mandal_name || null,
          village_id: exactV.rows[0].id,
          mandal_id: exactV.rows[0].mandal_id || null
        };
      }

      const exactM = await client.query(`
        SELECT * FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
      `, [input]);
      if (exactM.rows.length > 0) {
        return {
          village: null,
          mandal: exactM.rows[0].name,
          village_id: null,
          mandal_id: exactM.rows[0].id
        };
      }

      const words = input.split(/\s+/);
      if (words.length >= 2) {
        rawVillage = words[0];
        rawMandal = words.slice(1).join(' ');
      } else if (words.length === 1 && words[0].length > 0) {
        return {
          error: "Please specify both Village and Mandal in the format 'Village, Mandal' (e.g. 'Kachapur, Bhiknur')",
          village: words[0],
          mandal: null,
          village_id: null,
          mandal_id: null
        };
      }
    }
  }

  // 4. Resolve or atomically create Mandal
  if (rawMandal) {
    const cleanMandal = rawMandal.trim();
    let mCheck = await client.query(`
      SELECT * FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
    `, [cleanMandal]);

    if (mCheck.rows.length > 0) {
      mId = mCheck.rows[0].id;
      mName = mCheck.rows[0].name;
    } else {
      const newM = await client.query(`
        INSERT INTO master_mandals (name, status) VALUES ($1, 'active') RETURNING *
      `, [cleanMandal]);
      mId = newM.rows[0].id;
      mName = newM.rows[0].name;
    }
  }

  // 5. Resolve or atomically create Village under the Mandal
  if (rawVillage) {
    const cleanVillage = rawVillage.trim();
    if (mId) {
      let vCheck = await client.query(`
        SELECT * FROM master_villages
        WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND mandal_id = $2
      `, [cleanVillage, mId]);

      if (vCheck.rows.length > 0) {
        vId = vCheck.rows[0].id;
        vName = vCheck.rows[0].name;
      } else {
        const newV = await client.query(`
          INSERT INTO master_villages (name, mandal_id, status) VALUES ($1, $2, 'active') RETURNING *
        `, [cleanVillage, mId]);
        vId = newV.rows[0].id;
        vName = newV.rows[0].name;
      }
    } else {
      let vCheck = await client.query(`
        SELECT * FROM master_villages WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
      `, [cleanVillage]);

      if (vCheck.rows.length > 0) {
        vId = vCheck.rows[0].id;
        vName = vCheck.rows[0].name;
        mId = vCheck.rows[0].mandal_id || null;
      } else {
        const newV = await client.query(`
          INSERT INTO master_villages (name, status) VALUES ($1, 'active') RETURNING *
        `, [cleanVillage]);
        vId = newV.rows[0].id;
        vName = newV.rows[0].name;
      }
    }
  }

  return {
    village: vName || null,
    mandal: mName || null,
    village_id: vId || null,
    mandal_id: mId || null
  };
}

module.exports = {
  resolveOrCreateLocation,
};
