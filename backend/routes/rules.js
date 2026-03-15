const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

function toNullableNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNullableText(value) {
  if (value === '' || value === undefined || value === null) return null;
  return String(value);
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return Boolean(value);
}

router.get('/marketplace', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mr.*, m.marketplace_name, c.name AS category_name, p.name AS product_name
       FROM marketplace_rules mr
       LEFT JOIN marketplaces m ON m.id = mr.marketplace_id
       LEFT JOIN categories c ON c.id = mr.category_id
       LEFT JOIN products p ON p.id = mr.product_id
       ORDER BY mr.scope_type, COALESCE(m.marketplace_name, 'General'), mr.priority DESC, mr.id DESC`
    );
    res.json({ rules: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/marketplace', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `INSERT INTO marketplace_rules (
        scope_type, marketplace_id, category_id, product_id, priority,
        minimum_profit_margin, target_profit_margin, min_margin_rate, target_margin_rate,
        commission_rate, commission_base, vat_rate, fixed_fee,
        marketplace_discount_rate, marketplace_discount_funded, rounding_ending,
        is_active, valid_from, valid_to, notes
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,$12,$13,
        $14,$15,$16,
        $17,$18,$19,$20
      ) RETURNING *`,
      [
        body.scope_type || 'marketplace',
        toNullableNumber(body.marketplace_id),
        toNullableNumber(body.category_id),
        toNullableNumber(body.product_id),
        toNullableNumber(body.priority) ?? 0,
        toNullableNumber(body.minimum_profit_margin ?? body.min_margin_rate) ?? 10,
        toNullableNumber(body.target_profit_margin ?? body.target_margin_rate) ?? 18,
        toNullableNumber(body.min_margin_rate) ?? 10,
        toNullableNumber(body.target_margin_rate) ?? 18,
        toNullableNumber(body.commission_rate) ?? 0,
        body.commission_base || 'net_ex_vat',
        toNullableNumber(body.vat_rate) ?? 20,
        toNullableNumber(body.fixed_fee) ?? 0,
        toNullableNumber(body.marketplace_discount_rate) ?? 0,
        toBoolean(body.marketplace_discount_funded, false),
        toNullableNumber(body.rounding_ending) ?? 0.90,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
      ]
    );
    res.status(201).json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/marketplace/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `UPDATE marketplace_rules SET
        scope_type = $1,
        marketplace_id = $2,
        category_id = $3,
        product_id = $4,
        priority = $5,
        minimum_profit_margin = $6,
        target_profit_margin = $7,
        min_margin_rate = $8,
        target_margin_rate = $9,
        commission_rate = $10,
        commission_base = $11,
        vat_rate = $12,
        fixed_fee = $13,
        marketplace_discount_rate = $14,
        marketplace_discount_funded = $15,
        rounding_ending = $16,
        is_active = $17,
        valid_from = $18,
        valid_to = $19,
        notes = $20,
        updated_at = NOW()
       WHERE id = $21
       RETURNING *`,
      [
        body.scope_type || 'marketplace',
        toNullableNumber(body.marketplace_id),
        toNullableNumber(body.category_id),
        toNullableNumber(body.product_id),
        toNullableNumber(body.priority) ?? 0,
        toNullableNumber(body.minimum_profit_margin ?? body.min_margin_rate) ?? 10,
        toNullableNumber(body.target_profit_margin ?? body.target_margin_rate) ?? 18,
        toNullableNumber(body.min_margin_rate) ?? 10,
        toNullableNumber(body.target_margin_rate) ?? 18,
        toNullableNumber(body.commission_rate) ?? 0,
        body.commission_base || 'net_ex_vat',
        toNullableNumber(body.vat_rate) ?? 20,
        toNullableNumber(body.fixed_fee) ?? 0,
        toNullableNumber(body.marketplace_discount_rate) ?? 0,
        toBoolean(body.marketplace_discount_funded, false),
        toNullableNumber(body.rounding_ending) ?? 0.90,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
        Number(req.params.id),
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Kural bulunamadı' });
    res.json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/marketplace/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM marketplace_rules WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: 'Kural bulunamadı' });
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/shipping', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sr.*, m.marketplace_name
       FROM shipping_rules sr
       LEFT JOIN marketplaces m ON m.id = sr.marketplace_id
       ORDER BY sr.scope_type, COALESCE(m.marketplace_name, 'General'), sr.min_price ASC, sr.priority DESC, sr.id DESC`
    );
    res.json({ rules: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/shipping', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `INSERT INTO shipping_rules (
        scope_type, marketplace_id, min_price, max_price, shipping_cost, priority,
        is_active, valid_from, valid_to, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        body.scope_type || 'marketplace',
        toNullableNumber(body.marketplace_id),
        toNullableNumber(body.min_price) ?? 0,
        toNullableNumber(body.max_price),
        toNullableNumber(body.shipping_cost) ?? 0,
        toNullableNumber(body.priority) ?? 0,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
      ]
    );
    res.status(201).json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/shipping/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `UPDATE shipping_rules SET
        scope_type = $1,
        marketplace_id = $2,
        min_price = $3,
        max_price = $4,
        shipping_cost = $5,
        priority = $6,
        is_active = $7,
        valid_from = $8,
        valid_to = $9,
        notes = $10,
        updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        body.scope_type || 'marketplace',
        toNullableNumber(body.marketplace_id),
        toNullableNumber(body.min_price) ?? 0,
        toNullableNumber(body.max_price),
        toNullableNumber(body.shipping_cost) ?? 0,
        toNullableNumber(body.priority) ?? 0,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
        Number(req.params.id),
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Kargo kuralı bulunamadı' });
    res.json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/shipping/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM shipping_rules WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: 'Kargo kuralı bulunamadı' });
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profit-targets', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pt.*, m.marketplace_name, c.name AS category_name, p.name AS product_name
       FROM profit_targets pt
       LEFT JOIN marketplaces m ON m.id = pt.marketplace_id
       LEFT JOIN categories c ON c.id = pt.category_id
       LEFT JOIN products p ON p.id = pt.product_id
       ORDER BY pt.scope_type, COALESCE(m.marketplace_name, 'General'), pt.priority DESC, pt.id DESC`
    );
    res.json({ rules: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/profit-targets', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `INSERT INTO profit_targets (
        scope_type, marketplace_id, category_id, product_id, priority,
        min_profit_margin, target_profit_margin, min_margin_rate, target_margin_rate,
        is_active, valid_from, valid_to, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        body.scope_type || 'category',
        toNullableNumber(body.marketplace_id),
        toNullableNumber(body.category_id),
        toNullableNumber(body.product_id),
        toNullableNumber(body.priority) ?? 0,
        toNullableNumber(body.min_profit_margin ?? body.min_margin_rate) ?? 10,
        toNullableNumber(body.target_profit_margin ?? body.target_margin_rate) ?? 18,
        toNullableNumber(body.min_margin_rate) ?? 10,
        toNullableNumber(body.target_margin_rate) ?? 18,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
      ]
    );
    res.status(201).json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/profit-targets/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `UPDATE profit_targets SET
        scope_type = $1,
        marketplace_id = $2,
        category_id = $3,
        product_id = $4,
        priority = $5,
        min_profit_margin = $6,
        target_profit_margin = $7,
        min_margin_rate = $8,
        target_margin_rate = $9,
        is_active = $10,
        valid_from = $11,
        valid_to = $12,
        notes = $13,
        updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        body.scope_type || 'category',
        toNullableNumber(body.marketplace_id),
        toNullableNumber(body.category_id),
        toNullableNumber(body.product_id),
        toNullableNumber(body.priority) ?? 0,
        toNullableNumber(body.min_profit_margin ?? body.min_margin_rate) ?? 10,
        toNullableNumber(body.target_profit_margin ?? body.target_margin_rate) ?? 18,
        toNullableNumber(body.min_margin_rate) ?? 10,
        toNullableNumber(body.target_margin_rate) ?? 18,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
        Number(req.params.id),
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Kâr hedefi bulunamadı' });
    res.json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/profit-targets/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM profit_targets WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: 'Kâr hedefi bulunamadı' });
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/extra-deductions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT med.*, mr.scope_type AS marketplace_rule_scope, m.marketplace_name
       FROM marketplace_extra_deductions med
       LEFT JOIN marketplace_rules mr ON mr.id = med.marketplace_rule_id
       LEFT JOIN marketplaces m ON m.id = mr.marketplace_id
       ORDER BY med.priority ASC, med.id DESC`
    );
    res.json({ rules: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/extra-deductions', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `INSERT INTO marketplace_extra_deductions (
        marketplace_rule_id, name, deduction_type, calculation_type, base_amount_type,
        rate, fixed_amount, priority, is_active, valid_from, valid_to, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        toNullableNumber(body.marketplace_rule_id),
        body.name || 'Ek Kesinti',
        body.deduction_type || 'other',
        body.calculation_type || 'percentage',
        body.base_amount_type || 'net_ex_vat',
        toNullableNumber(body.rate) ?? 0,
        toNullableNumber(body.fixed_amount) ?? 0,
        toNullableNumber(body.priority) ?? 0,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
      ]
    );
    res.status(201).json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/extra-deductions/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `UPDATE marketplace_extra_deductions SET
        marketplace_rule_id = $1,
        name = $2,
        deduction_type = $3,
        calculation_type = $4,
        base_amount_type = $5,
        rate = $6,
        fixed_amount = $7,
        priority = $8,
        is_active = $9,
        valid_from = $10,
        valid_to = $11,
        notes = $12,
        updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        toNullableNumber(body.marketplace_rule_id),
        body.name || 'Ek Kesinti',
        body.deduction_type || 'other',
        body.calculation_type || 'percentage',
        body.base_amount_type || 'net_ex_vat',
        toNullableNumber(body.rate) ?? 0,
        toNullableNumber(body.fixed_amount) ?? 0,
        toNullableNumber(body.priority) ?? 0,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
        Number(req.params.id),
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ek kesinti bulunamadı' });
    res.json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/extra-deductions/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM marketplace_extra_deductions WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) return res.status(404).json({ error: 'Ek kesinti bulunamadı' });
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
