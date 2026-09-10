const crypto = require('crypto');
const db = require('../db');
const { formatResponse } = require('../utils/helpers');

/**
 * Helper: Generate a unique coupon code with collision retries.
 * Format: REF-[INITIALS_OR_CLEAN]-[5_CHAR_ALPHANUM] or REF-8K4P2M
 */
async function generateUniqueCouponCode(prefix = 'REF') {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without confusing 0/O, 1/I
  for (let attempt = 0; attempt < 10; attempt++) {
    let rand = '';
    const bytes = crypto.randomBytes(5);
    for (let i = 0; i < 5; i++) {
      rand += chars[bytes[i] % chars.length];
    }
    const cleanPrefix = (prefix || 'REF').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const code = `${cleanPrefix}-${rand}`;

    const existing = await db.query('SELECT 1 FROM coupons WHERE coupon_code = $1', [code]);
    if (existing.rows.length === 0) {
      return code;
    }
  }
  // Fallback timestamp-based code if collision persists
  return `REF-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * GET /api/v1/coupons/generate-code
 */
async function getGeneratedCode(req, res) {
  try {
    const { patient_name } = req.query;
    let prefix = 'REF';
    if (patient_name && typeof patient_name === 'string') {
      const parts = patient_name.trim().split(/\s+/);
      const clean = parts[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
      if (clean.length > 0) {
        prefix = `REF-${clean}`;
      }
    }
    const code = await generateUniqueCouponCode(prefix);
    return res.json(formatResponse(true, { coupon_code: code }, 'Coupon code generated successfully'));
  } catch (err) {
    console.error('getGeneratedCode error:', err);
    return res.status(500).json(formatResponse(false, null, 'Failed to generate unique coupon code'));
  }
}

/**
 * GET /api/v1/coupons/patients/search
 * Search patients by name, mobile, or UHID for autocomplete selectors.
 */
async function searchPatientsForCoupon(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json(formatResponse(true, [], 'Please enter at least 2 characters to search'));
    }

    const query = `
      SELECT patient_id, registration_id, registration_id as uhid, full_name, mobile_number, gender, patient_type, village, mandal
      FROM patients
      WHERE full_name ILIKE $1 
         OR mobile_number ILIKE $1 
         OR registration_id ILIKE $1
         OR patient_id::text = $2
      ORDER BY patient_id DESC
      LIMIT 20
    `;
    const result = await db.query(query, [`%${q}%`, isNaN(Number(q)) ? -1 : Number(q)]);
    return res.json(formatResponse(true, result.rows, 'Patients found'));
  } catch (err) {
    console.error('searchPatientsForCoupon error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while searching patients'));
  }
}

/**
 * GET /api/v1/coupons
 * Paginated list of coupons with referring patient, referred patient, and creator info.
 */
async function listCoupons(req, res) {
  try {
    const {
      search,
      status,
      discount_type,
      from_date,
      to_date,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const queryLimit = Math.max(1, parseInt(limit, 10));

    // First auto-mark expired coupons if still active
    await db.query(`
      UPDATE coupons 
      SET status = 'expired', updated_at = now() 
      WHERE status = 'active' AND valid_until < CURRENT_DATE
    `);

    const whereClauses = [];
    const params = [];
    let pIdx = 1;

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push(`(
        c.coupon_code ILIKE $${pIdx} OR
        ref_p.full_name ILIKE $${pIdx} OR
        ref_p.mobile_number ILIKE $${pIdx} OR
        ref_p.registration_id ILIKE $${pIdx} OR
        tgt_p.full_name ILIKE $${pIdx} OR
        tgt_p.mobile_number ILIKE $${pIdx}
      )`);
      params.push(term);
      pIdx++;
    }

    if (status && status !== 'all') {
      whereClauses.push(`c.status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    if (discount_type && discount_type !== 'all') {
      whereClauses.push(`c.discount_type = $${pIdx}`);
      params.push(discount_type);
      pIdx++;
    }

    if (from_date) {
      whereClauses.push(`c.valid_from >= $${pIdx}`);
      params.push(from_date);
      pIdx++;
    }

    if (to_date) {
      whereClauses.push(`c.valid_until <= $${pIdx}`);
      params.push(to_date);
      pIdx++;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total matching
    const countQuery = `
      SELECT COUNT(*) as total
      FROM coupons c
      LEFT JOIN patients ref_p ON c.referring_patient_id = ref_p.patient_id
      LEFT JOIN patients tgt_p ON c.referred_patient_id = tgt_p.patient_id
      ${whereStr}
    `;
    const countRes = await db.query(countQuery, params);
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    // Fetch records
    const dataQuery = `
      SELECT 
        c.*,
        ref_p.full_name as referring_patient_name,
        ref_p.mobile_number as referring_patient_mobile,
        ref_p.registration_id as referring_patient_uhid,
        ref_p.registration_id as referring_patient_registration_id,
        tgt_p.full_name as referred_patient_name,
        tgt_p.mobile_number as referred_patient_mobile,
        tgt_p.registration_id as referred_patient_uhid,
        tgt_p.registration_id as referred_patient_registration_id,
        u.full_name as created_by_name,
        u.role as created_by_role,
        (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) as redemption_count
      FROM coupons c
      LEFT JOIN patients ref_p ON c.referring_patient_id = ref_p.patient_id
      LEFT JOIN patients tgt_p ON c.referred_patient_id = tgt_p.patient_id
      LEFT JOIN users u ON c.created_by = u.user_id
      ${whereStr}
      ORDER BY c.id DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;
    const dataRes = await db.query(dataQuery, [...params, queryLimit, offset]);

    // KPI Metrics Summary
    const statsQuery = `
      SELECT 
        COUNT(*) as total_coupons,
        COUNT(*) FILTER (WHERE status = 'active') as active_coupons,
        COUNT(*) FILTER (WHERE status = 'redeemed') as redeemed_coupons,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_coupons,
        COALESCE(SUM(cr.discount_amount), 0) as total_discount_given
      FROM coupons c
      LEFT JOIN coupon_redemptions cr ON c.id = cr.coupon_id
    `;
    const statsRes = await db.query(statsQuery);
    const stats = statsRes.rows[0] || {};

    return res.json(formatResponse(true, {
      items: dataRes.rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: queryLimit,
        totalPages: Math.ceil(total / queryLimit) || 1
      },
      stats: {
        total_coupons: parseInt(stats.total_coupons, 10) || 0,
        active_coupons: parseInt(stats.active_coupons, 10) || 0,
        redeemed_coupons: parseInt(stats.redeemed_coupons, 10) || 0,
        expired_coupons: parseInt(stats.expired_coupons, 10) || 0,
        total_discount_given: parseFloat(stats.total_discount_given) || 0
      }
    }, 'Coupons retrieved successfully'));

  } catch (err) {
    console.error('listCoupons error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while retrieving coupons'));
  }
}

/**
 * GET /api/v1/coupons/:id
 */
async function getCouponById(req, res) {
  try {
    const couponId = parseInt(req.params.id, 10);
    if (isNaN(couponId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid coupon ID'));
    }

    const query = `
      SELECT 
        c.*,
        ref_p.full_name as referring_patient_name,
        ref_p.mobile_number as referring_patient_mobile,
        ref_p.registration_id as referring_patient_uhid,
        tgt_p.full_name as referred_patient_name,
        tgt_p.mobile_number as referred_patient_mobile,
        tgt_p.registration_id as referred_patient_uhid,
        u.full_name as created_by_name,
        u.role as created_by_role
      FROM coupons c
      LEFT JOIN patients ref_p ON c.referring_patient_id = ref_p.patient_id
      LEFT JOIN patients tgt_p ON c.referred_patient_id = tgt_p.patient_id
      LEFT JOIN users u ON c.created_by = u.user_id
      WHERE c.id = $1
    `;
    const result = await db.query(query, [couponId]);
    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Coupon not found'));
    }

    const coupon = result.rows[0];

    // Fetch redemptions history
    const redemptionsQuery = `
      SELECT 
        cr.*,
        p.full_name as redeemed_by_patient_name,
        p.registration_id as redeemed_by_patient_uhid,
        u.full_name as redeemed_by_user_name
      FROM coupon_redemptions cr
      LEFT JOIN patients p ON cr.patient_id = p.patient_id
      LEFT JOIN users u ON cr.redeemed_by = u.user_id
      WHERE cr.coupon_id = $1
      ORDER BY cr.id DESC
    `;
    const redRes = await db.query(redemptionsQuery, [couponId]);
    coupon.redemptions = redRes.rows;

    return res.json(formatResponse(true, coupon, 'Coupon details retrieved successfully'));
  } catch (err) {
    console.error('getCouponById error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while fetching coupon details'));
  }
}

/**
 * POST /api/v1/coupons
 * Create a new coupon.
 */
async function createCoupon(req, res) {
  try {
    const {
      coupon_code,
      discount_type,
      discount_value,
      max_discount_limit,
      referring_patient_id,
      referred_patient_id,
      valid_from,
      valid_until,
      remarks
    } = req.body;

    // 1. Validation: Discount Type
    if (!['percentage', 'cash'].includes(discount_type)) {
      return res.status(400).json(formatResponse(false, null, 'Discount type must be either "percentage" or "cash"'));
    }

    // 2. Validation: Discount Value
    const numValue = parseFloat(discount_value);
    if (isNaN(numValue) || numValue <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Discount value must be a positive number greater than zero'));
    }

    if (discount_type === 'percentage' && numValue > 100) {
      return res.status(400).json(formatResponse(false, null, 'Percentage discount cannot exceed 100%'));
    }

    // 3. Validation: Referring Patient
    const refId = parseInt(referring_patient_id, 10);
    if (isNaN(refId)) {
      return res.status(400).json(formatResponse(false, null, 'Referring Patient (Coupon Owner) is required'));
    }

    const refPatientRes = await db.query('SELECT * FROM patients WHERE patient_id = $1', [refId]);
    if (refPatientRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Referring Patient with ID ${refId} does not exist`));
    }

    // 4. Validation: Referred Patient
    let tgtId = null;
    if (referred_patient_id !== undefined && referred_patient_id !== null && referred_patient_id !== '') {
      tgtId = parseInt(referred_patient_id, 10);
      if (isNaN(tgtId)) {
        return res.status(400).json(formatResponse(false, null, 'Invalid Referred Patient ID'));
      }
      if (tgtId === refId) {
        return res.status(400).json(formatResponse(
          false, 
          null, 
          'Referring patient and referred patient cannot be the same individual. Please select a different patient.'
        ));
      }
      const tgtPatientRes = await db.query('SELECT * FROM patients WHERE patient_id = $1', [tgtId]);
      if (tgtPatientRes.rows.length === 0) {
        return res.status(404).json(formatResponse(false, null, `Referred Patient with ID ${tgtId} does not exist`));
      }
    }

    // 5. Validation: Dates
    const vFrom = valid_from ? new Date(valid_from) : new Date();
    if (!valid_until) {
      return res.status(400).json(formatResponse(false, null, 'Valid Until date is required'));
    }
    const vUntil = new Date(valid_until);
    if (isNaN(vUntil.getTime())) {
      return res.status(400).json(formatResponse(false, null, 'Invalid Valid Until date format'));
    }
    if (vUntil < vFrom) {
      return res.status(400).json(formatResponse(false, null, 'Valid Until date cannot be earlier than Valid From date'));
    }

    // 6. Validation / Generation: Coupon Code
    let code = (coupon_code || '').trim().toUpperCase();
    if (!code) {
      const refName = refPatientRes.rows[0].full_name || 'REF';
      const clean = refName.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
      code = await generateUniqueCouponCode(`REF-${clean || 'REWARD'}`);
    } else {
      // Validate uniqueness
      const existing = await db.query('SELECT 1 FROM coupons WHERE LOWER(coupon_code) = LOWER($1)', [code]);
      if (existing.rows.length > 0) {
        return res.status(409).json(formatResponse(
          false, 
          null, 
          `Coupon code "${code}" already exists in the system. Please specify or generate a unique code.`
        ));
      }
    }

    const maxLimit = max_discount_limit ? parseFloat(max_discount_limit) : null;
    const branchId = req.user.branch_id || 1;
    const createdBy = req.user.user_id;

    const insertQuery = `
      INSERT INTO coupons (
        coupon_code, discount_type, discount_value, max_discount_limit,
        referring_patient_id, referred_patient_id, valid_from, valid_until,
        status, remarks, branch_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11)
      RETURNING *
    `;
    const insertRes = await db.query(insertQuery, [
      code,
      discount_type,
      numValue,
      maxLimit,
      refId,
      tgtId,
      vFrom.toISOString().split('T')[0],
      vUntil.toISOString().split('T')[0],
      remarks || null,
      branchId,
      createdBy
    ]);

    const createdCoupon = insertRes.rows[0];
    createdCoupon.coupon_id = createdCoupon.id;

    // Audit Log Entry
    res.locals.auditEntry = {
      module: 'Coupon Management',
      action: 'Create Coupon',
      recordId: createdCoupon.id,
      newValue: createdCoupon,
      remarks: `Coupon ${createdCoupon.coupon_code} created for Patient ID ${refId} (${discount_type}: ${numValue})`
    };

    return res.status(201).json(formatResponse(true, createdCoupon, 'Coupon created successfully'));
  } catch (err) {
    console.error('createCoupon error:', err);
    if (err.code === '23505') {
      return res.status(409).json(formatResponse(false, null, 'A coupon with this code already exists. Please choose another code.'));
    }
    return res.status(500).json(formatResponse(false, null, 'Internal server error while creating coupon'));
  }
}

/**
 * PUT /api/v1/coupons/:id
 * Update coupon remarks, valid dates, or max limit (only for unredeemed coupons).
 */
async function updateCoupon(req, res) {
  try {
    const couponId = parseInt(req.params.id, 10);
    if (isNaN(couponId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid coupon ID'));
    }

    const existingRes = await db.query('SELECT * FROM coupons WHERE id = $1', [couponId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Coupon not found'));
    }

    const oldCoupon = existingRes.rows[0];
    if (oldCoupon.status === 'redeemed') {
      return res.status(400).json(formatResponse(false, null, 'Redeemed coupons cannot be modified to preserve financial and audit integrity'));
    }

    const { valid_until, remarks, max_discount_limit, status } = req.body;

    let newStatus = oldCoupon.status;
    if (status && ['active', 'inactive', 'cancelled'].includes(status)) {
      newStatus = status;
    }

    let newValidUntil = oldCoupon.valid_until;
    if (valid_until) {
      const vUntil = new Date(valid_until);
      if (!isNaN(vUntil.getTime())) {
        newValidUntil = vUntil.toISOString().split('T')[0];
      }
    }

    const newMaxLimit = max_discount_limit !== undefined 
      ? (max_discount_limit ? parseFloat(max_discount_limit) : null)
      : oldCoupon.max_discount_limit;

    const newRemarks = remarks !== undefined ? remarks : oldCoupon.remarks;

    const updateRes = await db.query(`
      UPDATE coupons SET
        valid_until = $1,
        remarks = $2,
        max_discount_limit = $3,
        status = $4,
        updated_by = $5,
        updated_at = now()
      WHERE id = $6
      RETURNING *
    `, [newValidUntil, newRemarks, newMaxLimit, newStatus, req.user.user_id, couponId]);

    const updated = updateRes.rows[0];

    res.locals.auditEntry = {
      module: 'Coupon Management',
      action: 'Update Coupon',
      recordId: couponId,
      oldValue: oldCoupon,
      newValue: updated,
      remarks: `Updated coupon ${oldCoupon.coupon_code}`
    };

    return res.json(formatResponse(true, updated, 'Coupon updated successfully'));
  } catch (err) {
    console.error('updateCoupon error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while updating coupon'));
  }
}

/**
 * PATCH /api/v1/coupons/:id/status
 * Transition status: active, inactive, cancelled.
 */
async function updateCouponStatus(req, res) {
  try {
    const couponId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!['active', 'inactive', 'cancelled'].includes(status)) {
      return res.status(400).json(formatResponse(false, null, 'Status must be active, inactive, or cancelled'));
    }

    const existingRes = await db.query('SELECT * FROM coupons WHERE id = $1', [couponId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, 'Coupon not found'));
    }

    const coupon = existingRes.rows[0];
    if (coupon.status === 'redeemed') {
      return res.status(400).json(formatResponse(false, null, 'Redeemed coupons cannot be modified or re-activated'));
    }

    const updateRes = await db.query(`
      UPDATE coupons SET status = $1, updated_by = $2, updated_at = now()
      WHERE id = $3 RETURNING *
    `, [status, req.user.user_id, couponId]);

    res.locals.auditEntry = {
      module: 'Coupon Management',
      action: `Set Coupon Status: ${status}`,
      recordId: couponId,
      oldValue: { status: coupon.status },
      newValue: { status },
      remarks: `Status changed from ${coupon.status} to ${status}`
    };

    return res.json(formatResponse(true, updateRes.rows[0], `Coupon status updated to ${status}`));
  } catch (err) {
    console.error('updateCouponStatus error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while updating coupon status'));
  }
}

/**
 * GET /api/v1/coupons/validate
 * Validates a coupon code for a given bill amount and patient, computing discount accurately.
 */
async function validateCoupon(req, res) {
  try {
    const data = req.method === 'POST' ? req.body : req.query;
    const code = data.code || data.coupon_code;
    const patient_id = data.patient_id;
    const bill_amount = data.bill_amount;

    if (!code || !String(code).trim()) {
      return res.status(400).json(formatResponse(false, null, 'Coupon code is required'));
    }

    const numBill = parseFloat(bill_amount);
    if (isNaN(numBill) || numBill < 0) {
      return res.status(400).json(formatResponse(false, null, 'Bill amount must be a non-negative number'));
    }

    const cleanCode = code.trim();
    const query = `
      SELECT c.*, ref_p.full_name as referring_patient_name, tgt_p.full_name as referred_patient_name
      FROM coupons c
      LEFT JOIN patients ref_p ON c.referring_patient_id = ref_p.patient_id
      LEFT JOIN patients tgt_p ON c.referred_patient_id = tgt_p.patient_id
      WHERE LOWER(c.coupon_code) = LOWER($1)
    `;
    const result = await db.query(query, [cleanCode]);
    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Coupon code "${cleanCode}" was not found`));
    }

    const coupon = result.rows[0];

    // Status checks
    if (coupon.status === 'redeemed') {
      return res.status(400).json(formatResponse(false, null, 'This coupon has already been redeemed and cannot be reused'));
    }
    if (coupon.status === 'cancelled') {
      return res.status(400).json(formatResponse(false, null, 'This coupon has been cancelled by the hospital administration'));
    }
    if (coupon.status === 'inactive') {
      return res.status(400).json(formatResponse(false, null, 'This coupon is currently inactive'));
    }

    // Validity date checks
    const vFromStr = coupon.valid_from instanceof Date ? coupon.valid_from.toISOString().split('T')[0] : String(coupon.valid_from).split('T')[0];
    const vUntilStr = coupon.valid_until instanceof Date ? coupon.valid_until.toISOString().split('T')[0] : String(coupon.valid_until).split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    if (vFromStr > today) {
      return res.status(400).json(formatResponse(false, null, `This coupon is not valid until ${vFromStr}`));
    }
    if (vUntilStr < today) {
      await db.query(`UPDATE coupons SET status = 'expired' WHERE id = $1`, [coupon.id]);
      return res.status(400).json(formatResponse(false, null, `This coupon expired on ${vUntilStr}`));
    }

    // Patient eligibility check (if patient_id is provided)
    if (patient_id) {
      const pId = parseInt(patient_id, 10);
      // If the coupon was designated for a specific referred patient, or if it belongs to referring patient
      const isOwner = coupon.referring_patient_id === pId;
      const isReferred = coupon.referred_patient_id === pId;
      if (!isOwner && !isReferred) {
        // Warning: coupon is tied to specific patients
        return res.status(400).json(formatResponse(
          false, 
          null, 
          `This referral coupon is issued for Patient #${coupon.referring_patient_id} (${coupon.referring_patient_name || 'Owner'}) and cannot be applied to this patient`
        ));
      }
    }

    // Calculate Discount
    let calculatedDiscount = 0;
    const discountVal = parseFloat(coupon.discount_value);

    if (coupon.discount_type === 'percentage') {
      calculatedDiscount = (numBill * discountVal) / 100;
      if (coupon.max_discount_limit && parseFloat(coupon.max_discount_limit) > 0) {
        calculatedDiscount = Math.min(calculatedDiscount, parseFloat(coupon.max_discount_limit));
      }
    } else {
      // Cash discount
      calculatedDiscount = discountVal;
    }

    // Never allow discount to exceed the bill amount, and never allow final payable < 0
    const applicableDiscount = Math.round(Math.min(calculatedDiscount, numBill) * 100) / 100;
    const finalPayable = Math.round(Math.max(0, numBill - applicableDiscount) * 100) / 100;

    return res.json(formatResponse(true, {
      coupon: {
        id: coupon.id,
        coupon_code: coupon.coupon_code,
        discount_type: coupon.discount_type,
        discount_value: discountVal,
        max_discount_limit: coupon.max_discount_limit ? parseFloat(coupon.max_discount_limit) : null,
        referring_patient_name: coupon.referring_patient_name,
        referred_patient_name: coupon.referred_patient_name,
        valid_until: coupon.valid_until
      },
      bill_amount: numBill,
      discount_amount: applicableDiscount,
      final_payable: finalPayable
    }, 'Coupon is valid'));

  } catch (err) {
    console.error('validateCoupon error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while validating coupon'));
  }
}

/**
 * POST /api/v1/coupons/redeem
 * Atomically marks coupon as redeemed and saves the audit context in coupon_redemptions.
 */
async function redeemCoupon(req, res) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { coupon_id, coupon_code, patient_id, bill_id, bill_amount, remarks } = req.body;
    const resolvedCouponId = req.params.id ? parseInt(req.params.id, 10) : (coupon_id ? parseInt(coupon_id, 10) : null);

    if (!resolvedCouponId && !coupon_code) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Coupon ID or Coupon Code is required'));
    }

    const pId = parseInt(patient_id, 10);
    if (isNaN(pId)) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Valid Patient ID is required for coupon redemption'));
    }

    const numBill = parseFloat(bill_amount);
    if (isNaN(numBill) || numBill <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'Bill amount must be greater than zero'));
    }

    // Select and lock coupon row
    const cRes = await client.query(`
      SELECT * FROM coupons 
      WHERE (id = $1 OR LOWER(coupon_code) = LOWER($2))
      FOR UPDATE
    `, [resolvedCouponId || -1, coupon_code || '']);

    if (cRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(formatResponse(false, null, 'Coupon not found'));
    }

    const coupon = cRes.rows[0];

    if (coupon.status === 'redeemed') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, 'This coupon has already been redeemed'));
    }

    if (coupon.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `Cannot redeem coupon with status "${coupon.status}"`));
    }

    const vUntilStr = coupon.valid_until instanceof Date ? coupon.valid_until.toISOString().split('T')[0] : String(coupon.valid_until).split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    if (vUntilStr < today) {
      await client.query(`UPDATE coupons SET status = 'expired' WHERE id = $1`, [coupon.id]);
      await client.query('ROLLBACK');
      return res.status(400).json(formatResponse(false, null, `This coupon expired on ${vUntilStr}`));
    }

    // Calculate discount
    const discountVal = parseFloat(coupon.discount_value);
    let rawDiscount = 0;
    if (coupon.discount_type === 'percentage') {
      rawDiscount = (numBill * discountVal) / 100;
      if (coupon.max_discount_limit && parseFloat(coupon.max_discount_limit) > 0) {
        rawDiscount = Math.min(rawDiscount, parseFloat(coupon.max_discount_limit));
      }
    } else {
      rawDiscount = discountVal;
    }

    const discountAmount = Math.round(Math.min(rawDiscount, numBill) * 100) / 100;
    const finalPayable = Math.round(Math.max(0, numBill - discountAmount) * 100) / 100;

    let validBillId = null;
    if (bill_id && !isNaN(parseInt(bill_id, 10))) {
      const bRes = await client.query('SELECT bill_id FROM bills WHERE bill_id = $1', [parseInt(bill_id, 10)]);
      if (bRes.rows.length > 0) {
        validBillId = bRes.rows[0].bill_id;
      }
    }
    const finalRemarks = remarks ? String(remarks) : (bill_id && !validBillId ? `Bill Ref: ${bill_id}` : null);

    // Record in coupon_redemptions
    const redRes = await client.query(`
      INSERT INTO coupon_redemptions (
        coupon_id, patient_id, bill_id, bill_amount, discount_amount, final_payable,
        redeemed_by, redeemed_at, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
      RETURNING *
    `, [
      coupon.id,
      pId,
      validBillId,
      numBill,
      discountAmount,
      finalPayable,
      req.user.user_id,
      finalRemarks
    ]);

    // Update coupon status to redeemed
    await client.query(`
      UPDATE coupons SET status = 'redeemed', updated_by = $1, updated_at = now()
      WHERE id = $2
    `, [req.user.user_id, coupon.id]);

    await client.query('COMMIT');

    const redemption = redRes.rows[0];

    res.locals.auditEntry = {
      module: 'Coupon Management',
      action: 'Redeem Coupon',
      recordId: coupon.id,
      newValue: redemption,
      remarks: `Redeemed coupon ${coupon.coupon_code} for Patient #${pId}: Discount applied ₹${discountAmount}, Final ₹${finalPayable}`
    };

    return res.json(formatResponse(true, {
      redemption,
      coupon_code: coupon.coupon_code,
      coupon_status: 'redeemed',
      discount_amount: discountAmount,
      final_payable: finalPayable
    }, 'Coupon redeemed successfully'));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('redeemCoupon error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while redeeming coupon'));
  } finally {
    client.release();
  }
}

/**
 * GET /api/v1/coupons/:id/redemptions
 */
async function getCouponRedemptions(req, res) {
  try {
    const couponId = parseInt(req.params.id, 10);
    const query = `
      SELECT cr.*, p.full_name as patient_name, p.registration_id as uhid, u.full_name as redeemed_by_user_name
      FROM coupon_redemptions cr
      LEFT JOIN patients p ON cr.patient_id = p.patient_id
      LEFT JOIN users u ON cr.redeemed_by = u.user_id
      WHERE cr.coupon_id = $1
      ORDER BY cr.id DESC
    `;
    const result = await db.query(query, [couponId]);
    return res.json(formatResponse(true, result.rows, 'Redemptions retrieved successfully'));
  } catch (err) {
    console.error('getCouponRedemptions error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error'));
  }
}

/**
 * GET /api/v1/coupons/patient/:patientId
 * Returns the coupon wallet for a referring patient with deterministic sorting (newest first)
 * and server-side eligibility checks for PRO billing.
 */
async function getPatientCoupons(req, res) {
  try {
    const patientId = parseInt(req.params.patientId, 10);
    if (isNaN(patientId) || patientId <= 0) {
      return res.status(400).json(formatResponse(false, null, 'Valid Patient ID is required'));
    }

    // Verify patient exists
    const ptRes = await db.query(
      `SELECT patient_id, full_name, registration_id as uhid, mobile_number, patient_type 
       FROM patients WHERE patient_id = $1`,
      [patientId]
    );
    if (ptRes.rows.length === 0) {
      return res.status(404).json(formatResponse(false, null, `Patient #${patientId} not found`));
    }
    const patient = ptRes.rows[0];

    const today = new Date().toISOString().split('T')[0];

    // Fetch all coupons owned by this patient with joins for referred patient & redemption details
    // Ordered strictly by created_at DESC, id DESC (newest first!)
    const query = `
      SELECT 
        c.*,
        ref_p.full_name as referring_patient_name,
        ref_p.registration_id as referring_patient_uhid,
        ref_p.mobile_number as referring_patient_mobile,
        tgt_p.full_name as referred_patient_name,
        tgt_p.registration_id as referred_patient_uhid,
        tgt_p.mobile_number as referred_patient_mobile,
        u.full_name as created_by_name,
        cr.id as redemption_id,
        cr.bill_id as redemption_bill_id,
        cr.bill_amount as redemption_bill_amount,
        cr.discount_amount as redemption_discount_amount,
        cr.final_payable as redemption_final_payable,
        cr.redeemed_at as redemption_redeemed_at,
        red_u.full_name as redemption_redeemed_by_name
      FROM coupons c
      LEFT JOIN patients ref_p ON c.referring_patient_id = ref_p.patient_id
      LEFT JOIN patients tgt_p ON c.referred_patient_id = tgt_p.patient_id
      LEFT JOIN users u ON c.created_by = u.user_id
      LEFT JOIN coupon_redemptions cr ON c.id = cr.coupon_id
      LEFT JOIN users red_u ON cr.redeemed_by = red_u.user_id
      WHERE c.referring_patient_id = $1
      ORDER BY c.created_at DESC, c.id DESC
    `;

    const result = await db.query(query, [patientId]);
    const items = result.rows.map((row) => {
      const vFrom = row.valid_from instanceof Date ? row.valid_from.toISOString().split('T')[0] : String(row.valid_from).split('T')[0];
      const vUntil = row.valid_until instanceof Date ? row.valid_until.toISOString().split('T')[0] : String(row.valid_until).split('T')[0];

      let isEligible = true;
      let ineligibleReason = null;

      if (row.status === 'redeemed') {
        isEligible = false;
        ineligibleReason = 'Already redeemed';
      } else if (row.status === 'cancelled') {
        isEligible = false;
        ineligibleReason = 'Cancelled';
      } else if (row.status === 'inactive') {
        isEligible = false;
        ineligibleReason = 'Inactive';
      } else if (vUntil < today) {
        isEligible = false;
        ineligibleReason = 'Expired';
      } else if (vFrom > today) {
        isEligible = false;
        ineligibleReason = `Valid from ${vFrom}`;
      }

      return {
        id: row.id,
        coupon_id: row.id,
        coupon_code: row.coupon_code,
        referring_patient_id: row.referring_patient_id,
        referring_patient_name: row.referring_patient_name,
        referring_patient_uhid: row.referring_patient_uhid,
        referring_patient_mobile: row.referring_patient_mobile,
        referred_patient_id: row.referred_patient_id,
        referred_patient_name: row.referred_patient_name,
        referred_patient_uhid: row.referred_patient_uhid,
        referred_patient_mobile: row.referred_patient_mobile,
        discount_type: row.discount_type,
        discount_value: parseFloat(row.discount_value),
        max_discount_limit: row.max_discount_limit ? parseFloat(row.max_discount_limit) : null,
        valid_from: vFrom,
        valid_until: vUntil,
        status: row.status,
        remarks: row.remarks,
        created_at: row.created_at,
        created_by_name: row.created_by_name,
        eligible_for_use: isEligible,
        is_eligible: isEligible,
        ineligible_reason: ineligibleReason,
        ineligibility_reason: ineligibleReason,
        redemption: row.redemption_id ? {
          redemption_id: row.redemption_id,
          bill_id: row.redemption_bill_id,
          bill_amount: parseFloat(row.redemption_bill_amount),
          discount_amount: parseFloat(row.redemption_discount_amount),
          final_payable: parseFloat(row.redemption_final_payable),
          redeemed_at: row.redemption_redeemed_at,
          redeemed_by_name: row.redemption_redeemed_by_name
        } : null
      };
    });

    const activeEligible = items.filter(c => c.eligible_for_use);
    const redeemed = items.filter(c => c.status === 'redeemed');
    const totalDiscountGiven = redeemed.reduce((sum, c) => sum + (c.redemption?.discount_amount || 0), 0);

    return res.json(formatResponse(true, {
      patient: {
        patient_id: patient.patient_id,
        full_name: patient.full_name,
        uhid: patient.uhid,
        mobile_number: patient.mobile_number
      },
      stats: {
        total_coupons: items.length,
        active_eligible_coupons: activeEligible.length,
        redeemed_coupons: redeemed.length,
        total_discount_given: totalDiscountGiven
      },
      coupons: items,
      active_eligible_coupons: activeEligible
    }, 'Patient coupon wallet retrieved successfully'));

  } catch (err) {
    console.error('getPatientCoupons error:', err);
    return res.status(500).json(formatResponse(false, null, 'Internal server error while fetching patient coupons'));
  }
}

module.exports = {
  getGeneratedCode,
  searchPatientsForCoupon,
  getPatientCoupons,
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  updateCouponStatus,
  validateCoupon,
  redeemCoupon,
  getCouponRedemptions
};
