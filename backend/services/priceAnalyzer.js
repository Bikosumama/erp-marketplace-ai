const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { buildRecommendation, toNumber, resolveScopedRule } = require('../services/priceAnalyzer');

router.use(authMiddleware);

async function getMarketplaceIdForProduct(productId, preferredMarketplaceId = null) {
  if (preferredMarketplaceId) return Number(preferredMarketplaceId);
  const identifierRes = await pool.query(
    `SELECT marketplace_id FROM product_marketplace_identifiers
     WHERE product_id = $1 AND is_active = TRUE
     ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`,
    [productId]
  );
  if (identifierRes.rows.length) return identifierRes.rows[0].marketplace_id;
  const fallbackRes = await pool.query(
    `SELECT id FROM marketplaces WHERE is_active = TRUE ORDER BY id ASC LIMIT 1`
  );
  return fallbackRes.rows[0]?.id || null;
}

async function getRuleBundle(product, marketplaceId) {
  const context = {
    marketplaceId,
    categoryId: product.category_id || null,
    productId: product.id,
  };

  // Tüm marketplace rules çek, scope'a göre en iyisini seç
  const marketplaceRulesRes = await pool.query(
    `SELECT * FROM marketplace_rules WHERE is_active = TRUE`
  );
  const marketplaceRule = resolveScopedRule(marketplaceRulesRes.rows, context);

  // Tüm shipping rules çek
  const shippingRulesRes = await pool.query(
    `SELECT * FROM shipping_rules WHERE is_active = TRUE`
  );
  const shippingRules = shippingRulesRes.rows;

  // Profit targets çek
  const profitTargetsRes = await pool.query(
    `SELECT * FROM profit_targets WHERE is_active = TRUE`
  );
  const profitTarget = resolveScopedRule(profitTargetsRes.rows, context);

  // Extra deductions çek
  let extraDeductions = [];
  if (marketplaceRule?.id) {
    const extraRes = await pool.query(
      `SELECT * FROM marketplace_extra_deductions
       WHERE marketplace_rule_id = $1 AND is_active = TRUE
       ORDER BY priority ASC`,
      [marketplaceRule.id]
    );
    extraDeductions = extraRes.rows;
  }

  return { marketplaceRule, shippingRules, profitTarget, extraDeductions };
}

async function getLatestCompetitorPrice(productId, marketplaceId) {
  const result = await pool.query(
    `SELECT competitor_price FROM competitor_prices
     WHERE product_id = $1 AND ($2::int IS NULL OR marketplace_id = $2)
     ORDER BY observed_at DESC, id DESC LIMIT 1`,
    [productId, marketplaceId]
  );
  return result.rows[0]?.competitor_price ?? null;
}

async function upsertRecommendation(client, payload) {
  const insertRes = await client.query(
    `INSERT INTO price_recommendations (
       product_id, marketplace_id, current_price, recommended_price, floor_price, target_price,
       protected_floor, brand_min_price, marketplace_discount_rate, discount_adjusted_protected_price,
       customer_seen_price, shipping_cost, commission_amount, extra_deductions_total,
       competitor_price, current_margin_rate, projected_margin_rate, profit_margin,
       recommendation_type, risk_level, confidence, quality_score, reason_text, metadata, status
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25
     ) RETURNING *`,
    [
      payload.product_id, payload.marketplace_id,
      payload.current_price, payload.recommended_price,
      payload.floor_price, payload.target_price,
      payload.protected_floor, payload.brand_min_price,
      payload.marketplace_discount_rate, payload.discount_adjusted_protected_price,
      payload.customer_seen_price, payload.shipping_cost,
      payload.commission_amount, payload.extra_deductions_total,
      payload.competitor_price, payload.current_margin_rate,
      payload.projected_margin_rate, payload.profit_margin,
      payload.recommendation_type, payload.risk_level,
      payload.confidence, payload.quality_score,
      payload.reason_text, JSON.stringify(payload.metadata || {}), 'pending',
    ]
  );

  const recommendation = insertRes.rows[0];

  await client.query(
    `INSERT INTO approvals (entity_type, entity_id, action_type, proposed_payload, status)
     VALUES ('price_recommendation', $1, 'apply_price', $2::jsonb, 'pending')`,
    [recommendation.id, JSON.stringify(recommendation)]
  );

  return recommendation;
}

async function createAlerts(client, recommendationId, productId, marketplaceId, alertItems = []) {
  for (const alert of alertItems) {
    await client.query(
      `INSERT INTO alerts (product_id, marketplace_id, alert_type, severity, title, message)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [productId, marketplaceId, alert.type || 'generic_alert', alert.severity || 'medium', alert.title || 'Fiyat uyarısı', alert.message || '']
    );
  }
}

async function analyzeSingleProduct(product, marketplaceId, actorName) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resolvedMarketplaceId = await getMarketplaceIdForProduct(product.id, marketplaceId);
    const { marketplaceRule, shippingRules, profitTarget, extraDeductions } = await getRuleBundle(product, resolvedMarketplaceId);
    const competitorPrice = await getLatestCompetitorPrice(product.id, resolvedMarketplaceId);

    const minMarginRate = toNumber(profitTarget?.min_margin_rate ?? marketplaceRule?.min_margin_rate ?? 10, 10);
    const targetMarginRate = toNumber(profitTarget?.target_margin_rate ?? marketplaceRule?.target_margin_rate ?? 18, 18);

    const analysis = buildRecommendation({
      product,
      marketplaceRule,
      shippingRules,
      extraDeductions,
      brandMinPrice: toNumber(product.brand_min_price, 0),
      minMarginRate,
      targetMarginRate,
      competitorPrice,
    });

    const recommendation = await upsertRecommendation(client, {
      product_id: product.id,
      marketplace_id: resolvedMarketplaceId,
      current_price: analysis.currentPrice,
      recommended_price: analysis.recommendedPrice,
      floor_price: analysis.floorPrice,
      target_price: analysis.targetPrice,
      protected_floor: analysis.metadata?.protected_floor || 0,
      brand_min_price: analysis.metadata?.brand_min_price || 0,
      marketplace_discount_rate: analysis.metadata?.marketplace_discount_rate || 0,
      discount_adjusted_protected_price: analysis.metadata?.discount_adjusted_protected_price || 0,
      customer_seen_price: analysis.metadata?.customer_seen_price || 0,
      shipping_cost: analysis.metadata?.shipping_cost || 0,
      commission_amount: analysis.metadata?.commission_amount || 0,
      extra_deductions_total: analysis.metadata?.extra_deductions_total || 0,
      competitor_price: analysis.competitorPrice,
      current_margin_rate: analysis.currentMarginRate,
      projected_margin_rate: analysis.projectedMarginRate,
      profit_margin: analysis.profitMargin,
      recommendation_type: analysis.recommendationType,
      risk_level: analysis.riskLevel,
      confidence: analysis.confidence,
      quality_score: analysis.qualityScore,
      reason_text: analysis.reasonText,
      metadata: {
        product_name: product.name,
        stock_code: product.stock_code,
        marketplace_rule_id: marketplaceRule?.id || null,
        profit_target_id: profitTarget?.id || null,
        reasons: analysis.reasons,
        ...analysis.metadata,
      },
    });

    await createAlerts(client, recommendation.id, product.id, resolvedMarketplaceId, analysis.alerts);

    await client.query(
      `INSERT INTO audit_logs (user_name, action_type, entity_type, entity_id, before_json, after_json)
       VALUES ($1, 'analyze_price', 'product', $2, '{}'::jsonb, $3::jsonb)`,
      [actorName || 'system', product.id, JSON.stringify(recommendation)]
    );

    await client.query('COMMIT');

    return {
      id: recommendation.id,
      product_id: recommendation.product_id,
      marketplace_id: recommendation.marketplace_id,
      product_name: product.name,
      stock_code: product.stock_code,
      current_price: Number(recommendation.current_price),
      recommended_price: Number(recommendation.recommended_price),
      floor_price: Number(recommendation.floor_price),
      target_price: Number(recommendation.target_price),
      protected_floor: Number(recommendation.protected_floor),
      customer_seen_price: Number(recommendation.customer_seen_price),
      competitor_price: recommendation.competitor_price == null ? null : Number(recommendation.competitor_price),
      current_margin_rate: Number(recommendation.current_margin_rate),
      projected_margin_rate: Number(recommendation.projected_margin_rate),
      profit_margin: Number(recommendation.profit_margin),
      recommendation_type: recommendation.recommendation_type,
      risk_level: recommendation.risk_level,
      confidence: Number(recommendation.confidence),
      quality_score: recommendation.quality_score,
      reason: recommendation.reason_text,
      status: recommendation.status,
      created_at: recommendation.created_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// GET /api/price-analysis/summary
router.get('/summary', async (req, res) => {
  try {
    const [recommendationsRes, alertsRes, historyRes] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'applied')::int AS applied,
          COUNT(*) FILTER (WHERE risk_level = 'high')::int AS high_risk
        FROM price_recommendations
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_resolved = FALSE)::int AS open,
          COUNT(*) FILTER (WHERE severity = 'high' AND is_resolved = FALSE)::int AS critical
        FROM alerts
      `),
      pool.query(`SELECT COUNT(*)::int AS total FROM price_history`),
    ]);
    res.json({ summary: { recommendations: recommendationsRes.rows[0], alerts: alertsRes.rows[0], history: historyRes.rows[0] } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/price-analysis/recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const { status, product_id } = req.query;
    const params = [];
    const where = [];
    if (status) { params.push(status); where.push(`pr.status = $${params.length}`); }
    if (product_id) { params.push(Number(product_id)); where.push(`pr.product_id = $${params.length}`); }

    const result = await pool.query(
      `SELECT pr.*, p.name AS product_name, p.stock_code, m.marketplace_name
       FROM price_recommendations pr
       JOIN products p ON p.id = pr.product_id
       LEFT JOIN marketplaces m ON m.id = pr.marketplace_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY pr.created_at DESC, pr.id DESC LIMIT 200`,
      params
    );

    res.json({
      recommendations: result.rows.map((row) => ({
        id: row.id,
        product_id: row.product_id,
        product_name: row.product_name,
        stock_code: row.stock_code,
        marketplace_id: row.marketplace_id,
        marketplace_name: row.marketplace_name,
        current_price: Number(row.current_price),
        recommended_price: Number(row.recommended_price),
        floor_price: Number(row.floor_price),
        target_price: Number(row.target_price),
        protected_floor: Number(row.protected_floor || 0),
        customer_seen_price: Number(row.customer_seen_price || 0),
        competitor_price: row.competitor_price == null ? null : Number(row.competitor_price),
        current_margin_rate: Number(row.current_margin_rate),
        projected_margin_rate: Number(row.projected_margin_rate),
        recommendation_type: row.recommendation_type,
        risk_level: row.risk_level,
        confidence: Number(row.confidence),
        quality_score: row.quality_score,
        reason: row.reason_text,
        status: row.status,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/price-analysis/history
router.get('/history', async (req, res) => {
  try {
    const { product_id } = req.query;
    const params = [];
    const where = [];
    if (product_id) { params.push(Number(product_id)); where.push(`ph.product_id = $${params.length}`); }

    const result = await pool.query(
      `SELECT ph.*, p.name AS product_name, p.stock_code, m.marketplace_name
       FROM price_history ph
       JOIN products p ON p.id = ph.product_id
       LEFT JOIN marketplaces m ON m.id = ph.marketplace_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ph.created_at DESC, ph.id DESC LIMIT 200`,
      params
    );

    res.json({
      history: result.rows.map((row) => ({
        id: row.id,
        product_id: row.product_id,
        product_name: row.product_name,
        stock_code: row.stock_code,
        marketplace_name: row.marketplace_name,
        old_price: Number(row.old_price),
        new_price: Number(row.new_price),
        change_reason: row.change_reason,
        changed_by: row.changed_by,
        date: row.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/price-analysis/alerts
router.get('/alerts', async (req, res) => {
  try {
    const { product_id, open_only } = req.query;
    const params = [];
    const where = [];
    if (product_id) { params.push(Number(product_id)); where.push(`a.product_id = $${params.length}`); }
    if (open_only === 'true') where.push(`a.is_resolved = FALSE`);

    const result = await pool.query(
      `SELECT a.*, p.name AS product_name, p.stock_code, m.marketplace_name
       FROM alerts a
       LEFT JOIN products p ON p.id = a.product_id
       LEFT JOIN marketplaces m ON m.id = a.marketplace_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.created_at DESC, a.id DESC LIMIT 100`,
      params
    );
    res.json({ alerts: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/price-analysis/analyze
router.post('/analyze', async (req, res) => {
  try {
    const { product_id, marketplace_id } = req.body || {};
    const actorName = req.user?.email || req.user?.name || 'system';

    const productsRes = product_id
      ? await pool.query(`SELECT * FROM products WHERE id = $1`, [Number(product_id)])
      : await pool.query(`SELECT * FROM products WHERE status = 'active' ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 100`);

    if (!productsRes.rows.length) return res.status(404).json({ error: 'Analiz edilecek ürün bulunamadı' });

    const recommendations = [];
    const errors = [];

    for (const product of productsRes.rows) {
      try {
        const recommendation = await analyzeSingleProduct(product, marketplace_id, actorName);
        recommendations.push(recommendation);
      } catch (err) {
        errors.push({ product_id: product.id, stock_code: product.stock_code, error: err.message });
      }
    }

    res.json({
      message: product_id ? 'Ürün analizi tamamlandı' : 'Toplu fiyat analizi tamamlandı',
      count: recommendations.length,
      errors,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/price-analysis/recommendations/:id/apply
router.post('/recommendations/:id/apply', async (req, res) => {
  const client = await pool.connect();
  try {
    const recommendationId = Number(req.params.id);
    if (!recommendationId) return res.status(400).json({ error: 'Geçersiz öneri ID' });

    await client.query('BEGIN');

    const recRes = await client.query(
      `SELECT pr.*, p.name AS product_name FROM price_recommendations pr
       JOIN products p ON p.id = pr.product_id WHERE pr.id = $1 LIMIT 1`,
      [recommendationId]
    );
    if (!recRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Öneri bulunamadı' }); }

    const recommendation = recRes.rows[0];
    if (recommendation.status === 'applied') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Bu öneri zaten uygulanmış' }); }

    const productBeforeRes = await client.query(`SELECT * FROM products WHERE id = $1`, [recommendation.product_id]);
    const productBefore = productBeforeRes.rows[0];

    await client.query(`UPDATE products SET sale_price = $1, updated_at = NOW() WHERE id = $2`, [recommendation.recommended_price, recommendation.product_id]);

    await client.query(
      `INSERT INTO price_history (product_id, marketplace_id, old_price, new_price, change_reason, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [recommendation.product_id, recommendation.marketplace_id, recommendation.current_price, recommendation.recommended_price,
       recommendation.reason_text || 'Fiyat analizi önerisi uygulandı', req.user?.email || 'system']
    );

    await client.query(`UPDATE price_recommendations SET status = 'applied', approved_at = NOW(), applied_at = NOW() WHERE id = $1`, [recommendationId]);

    await client.query(
      `UPDATE approvals SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE entity_type = 'price_recommendation' AND entity_id = $2 AND status = 'pending'`,
      [req.user?.email || 'system', recommendationId]
    );

    await client.query(
      `INSERT INTO audit_logs (user_name, action_type, entity_type, entity_id, before_json, after_json)
       VALUES ($1, 'apply_price_recommendation', 'product', $2, $3::jsonb, $4::jsonb)`,
      [req.user?.email || 'system', recommendation.product_id, JSON.stringify(productBefore || {}),
       JSON.stringify({ ...productBefore, sale_price: recommendation.recommended_price })]
    );

    if (recommendation.risk_level === 'high') {
      await client.query(
        `INSERT INTO alerts (product_id, marketplace_id, alert_type, severity, title, message, is_resolved)
         VALUES ($1,$2,'manual_followup','medium','Manuel takip önerisi','Yüksek riskli öneri uygulandı.',FALSE)`,
        [recommendation.product_id, recommendation.marketplace_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Fiyat önerisi uygulandı', recommendation_id: recommendationId, product_id: recommendation.product_id });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/price-analysis/recommendations/:id/reject
router.post('/recommendations/:id/reject', async (req, res) => {
  try {
    const recommendationId = Number(req.params.id);
    const reason = req.body?.reason || 'Kullanıcı tarafından reddedildi';
    await pool.query(`UPDATE price_recommendations SET status = 'rejected' WHERE id = $1 AND status = 'pending'`, [recommendationId]);
    await pool.query(
      `UPDATE approvals SET status = 'rejected', rejected_reason = $1, approved_by = $2, approved_at = NOW()
       WHERE entity_type = 'price_recommendation' AND entity_id = $3 AND status = 'pending'`,
      [reason, req.user?.email || 'system', recommendationId]
    );
    res.json({ message: 'Öneri reddedildi', recommendation_id: recommendationId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
