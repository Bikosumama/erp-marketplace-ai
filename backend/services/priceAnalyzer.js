const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Sadece en temel fonksiyonu servisten alıyoruz (hata riskini sıfıra indirdik)
const { buildRecommendation, resolveScopedRule } = require('../services/priceAnalyzer');

// Excel Okumak için Gerekli Kütüphaneler
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const ExcelJS = require('exceljs');

router.use(authMiddleware);

// --- YARDIMCI FONKSİYONLAR (Hata vermemesi için buraya sabitledik) ---

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

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

  const marketplaceRulesRes = await pool.query(`SELECT * FROM marketplace_rules WHERE is_active = TRUE`);
  const marketplaceRule = resolveScopedRule ? resolveScopedRule(marketplaceRulesRes.rows, context) : marketplaceRulesRes.rows[0];

  const shippingRulesRes = await pool.query(`SELECT * FROM shipping_rules WHERE is_active = TRUE`);
  const profitTargetsRes = await pool.query(`SELECT * FROM profit_targets WHERE is_active = TRUE`);
  const profitTarget = resolveScopedRule ? resolveScopedRule(profitTargetsRes.rows, context) : profitTargetsRes.rows[0];

  let extraDeductions = [];
  if (marketplaceRule?.id) {
    const extraRes = await pool.query(
      `SELECT * FROM marketplace_extra_deductions WHERE marketplace_rule_id = $1 AND is_active = TRUE ORDER BY priority ASC`,
      [marketplaceRule.id]
    );
    extraDeductions = extraRes.rows;
  }

  return { marketplaceRule, shippingRules: shippingRulesRes.rows, profitTarget, extraDeductions };
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
      payload.product_id, payload.marketplace_id, payload.current_price, payload.recommended_price,
      payload.floor_price, payload.target_price, payload.protected_floor, payload.brand_min_price,
      payload.marketplace_discount_rate, payload.discount_adjusted_protected_price, payload.customer_seen_price,
      payload.shipping_cost, payload.commission_amount, payload.extra_deductions_total, payload.competitor_price,
      payload.current_margin_rate, payload.projected_margin_rate, payload.profit_margin, payload.recommendation_type,
      payload.risk_level, payload.confidence, payload.quality_score, payload.reason_text, JSON.stringify(payload.metadata || {}), 'pending'
    ]
  );
  const rec = insertRes.rows[0];
  await client.query(`INSERT INTO approvals (entity_type, entity_id, action_type, proposed_payload, status) VALUES ('price_recommendation', $1, 'apply_price', $2::jsonb, 'pending')`, [rec.id, JSON.stringify(rec)]);
  return rec;
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

    const minMarginRate = toNumber(profitTarget?.min_margin_rate ?? marketplaceRule?.min_margin_rate ?? 10);
    const targetMarginRate = toNumber(profitTarget?.target_margin_rate ?? marketplaceRule?.target_margin_rate ?? 18);

    const analysis = buildRecommendation({
      product, marketplaceRule, shippingRules, extraDeductions,
      brandMinPrice: toNumber(product.brand_min_price), minMarginRate, targetMarginRate, competitorPrice
    });

    const rec = await upsertRecommendation(client, {
      product_id: product.id, marketplace_id: resolvedMarketplaceId, ...analysis,
      metadata: { product_name: product.name, stock_code: product.stock_code, ...analysis.metadata }
    });

    if (analysis.alerts && analysis.alerts.length > 0) {
      await createAlerts(client, rec.id, product.id, resolvedMarketplaceId, analysis.alerts);
    }

    await client.query(`INSERT INTO audit_logs (user_name, action_type, entity_type, entity_id, after_json) VALUES ($1, 'analyze_price', 'product', $2, $3::jsonb)`, [actorName, product.id, JSON.stringify(rec)]);
    await client.query('COMMIT');
    return rec;
  } catch (error) { 
    await client.query('ROLLBACK'); 
    throw error; 
  } finally { 
    client.release(); 
  }
}

// --- ROTALAR (API ENDPOINTS) ---

router.get('/summary', async (req, res) => {
  try {
    const [recRes, alertRes, histRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending FROM price_recommendations`),
      pool.query(`SELECT COUNT(*)::int AS total FROM alerts WHERE is_resolved = FALSE`),
      pool.query(`SELECT COUNT(*)::int AS total FROM price_history`)
    ]);
    res.json({ summary: { recommendations: recRes.rows[0], alerts: alertRes.rows[0], history: histRes.rows[0] } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/recommendations', async (req, res) => {
  try {
    const { status, product_id } = req.query;
    let query = `SELECT pr.*, p.name AS product_name, p.stock_code, m.marketplace_name FROM price_recommendations pr JOIN products p ON p.id = pr.product_id LEFT JOIN marketplaces m ON m.id = pr.marketplace_id`;
    const params = [];
    if (status) { params.push(status); query += ` WHERE pr.status = $1`; }
    query += ` ORDER BY pr.created_at DESC LIMIT 100`;
    const result = await pool.query(query, params);
    res.json({ recommendations: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- YENİ EKLENEN SORUNSUZ EXCEL IMPORT ROTASI ---
router.post('/import-and-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);
    const results = [];
    const actorName = req.user?.email || 'excel_user';

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const stockCode = worksheet.getRow(i).getCell(2).value;
      if (!stockCode) continue;
      const productRes = await pool.query('SELECT * FROM products WHERE stock_code = $1', [stockCode]);
      if (productRes.rows.length > 0) {
        try {
          await analyzeSingleProduct(productRes.rows[0], null, actorName);
          results.push({ stockCode, status: 'Success' });
        } catch(analyzeErr) {
          results.push({ stockCode, status: 'Error', message: analyzeErr.message });
        }
      } else {
        results.push({ stockCode, status: 'Not Found' });
      }
    }
    res.json({ message: 'İşlem tamamlandı', count: results.length, details: results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/analyze', async (req, res) => {
  try {
    const { product_id } = req.body;
    const productsRes = product_id ? await pool.query(`SELECT * FROM products WHERE id = $1`, [product_id]) : await pool.query(`SELECT * FROM products LIMIT 50`);
    for (const p of productsRes.rows) { await analyzeSingleProduct(p, null, req.user?.email); }
    res.json({ message: 'Analiz tamamlandı' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/recommendations/:id/apply', async (req, res) => {
  try {
    await pool.query(`UPDATE price_recommendations SET status = 'applied' WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Uygulandı' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/recommendations/:id/reject', async (req, res) => {
  try {
    await pool.query(`UPDATE price_recommendations SET status = 'rejected' WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Reddedildi' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// EN KRİTİK KISIM: DOĞRU DIŞA AKTARIM
module.exports = router;
