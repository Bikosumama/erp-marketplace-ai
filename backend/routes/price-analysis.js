const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { sendWorkbook } = require('../services/excelExport');

// SADECE buildRecommendation'ı alıyoruz. Hata veren 'toNumber' ve diğerlerini iptal ettik!
const { buildRecommendation } = require('../services/priceAnalyzer');

// Excel Okumak için Gerekli Kütüphaneler
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const ExcelJS = require('exceljs');

router.use(authMiddleware);

// --- HATA ALMAMAK İÇİN FONKSİYONLARI BURAYA ALDIK ---
function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseRecommendationMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try { return JSON.parse(metadata); } catch (error) { return {}; }
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildRecommendationResponseRow(row) {
  const metadata = parseRecommendationMetadata(row.metadata);
  const reasons = Array.isArray(metadata.reasons) ? metadata.reasons : [];
  const note = row.reason_text || '';
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_name,
    stock_code: row.stock_code,
    marketplace_id: row.marketplace_id,
    marketplace_name: row.marketplace_name,
    category_name: row.category_name || metadata.category_name || '',
    purchase_price: numberOrZero(row.purchase_price),
    cost: numberOrZero(row.purchase_price),
    current_price: numberOrZero(row.current_price),
    recommended_price: numberOrZero(row.recommended_price),
    final_listing_price: numberOrZero(row.recommended_price),
    floor_price: numberOrZero(row.floor_price),
    profit_floor: numberOrZero(row.floor_price),
    target_price: numberOrZero(row.target_price),
    protected_floor: numberOrZero(row.protected_floor || metadata.protected_floor),
    brand_min_price: numberOrZero(row.brand_min_price || row.product_brand_min_price || metadata.brand_min_price),
    marketplace_discount_rate: numberOrZero(row.marketplace_discount_rate || metadata.marketplace_discount_rate),
    discount_adjusted_protected_price: numberOrZero(row.discount_adjusted_protected_price || metadata.discount_adjusted_protected_price),
    customer_seen_price: numberOrZero(row.customer_seen_price || metadata.customer_seen_price),
    shipping_cost: numberOrZero(row.shipping_cost || metadata.shipping_cost),
    commission_amount: numberOrZero(row.commission_amount || metadata.commission_amount),
    extra_deductions_total: numberOrZero(row.extra_deductions_total || metadata.extra_deductions_total),
    competitor_price: row.competitor_price == null ? null : numberOrZero(row.competitor_price),
    current_margin_rate: numberOrZero(row.current_margin_rate),
    projected_margin_rate: numberOrZero(row.projected_margin_rate),
    profit_margin: numberOrZero(row.profit_margin),
    projected_profit: numberOrZero(row.profit_margin),
    recommendation_type: row.recommendation_type,
    risk_level: row.risk_level,
    confidence: numberOrZero(row.confidence),
    quality_score: row.quality_score,
    reason: row.reason_text,
    status: row.status,
    created_at: row.created_at,
    metadata,
    reasons,
    pricing_rule_scope: metadata.marketplace_rule_scope || metadata.pricing_rule_scope || '',
    shipping_rule_scope: metadata.shipping_rule_scope || '',
    note,
    warning: reasons.join(' | '),
  };
}

async function fetchRecommendationRows({ status, productId }) {
  const params = []; const where = [];
  if (status) { params.push(status); where.push(`pr.status = $${params.length}`); }
  if (productId) { params.push(Number(productId)); where.push(`pr.product_id = $${params.length}`); }
  const result = await pool.query(
    `SELECT pr.*, p.name AS product_name, p.stock_code, p.cost, p.brand_min_price AS product_brand_min_price,
     c.name AS category_name, m.marketplace_name FROM price_recommendations pr
     JOIN products p ON p.id = pr.product_id LEFT JOIN marketplaces m ON m.id = pr.marketplace_id
     LEFT JOIN categories c ON c.id = p.category_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY pr.created_at DESC, pr.id DESC LIMIT 1000`, params
  );
  return result.rows.map(buildRecommendationResponseRow);
}

async function getMarketplaceIdForProduct(productId, preferredMarketplaceId = null) {
  if (preferredMarketplaceId) return Number(preferredMarketplaceId);
  const identifierRes = await pool.query(`SELECT marketplace_id FROM product_marketplace_identifiers WHERE product_id = $1 AND is_active = TRUE ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`, [productId]);
  if (identifierRes.rows.length) return identifierRes.rows[0].marketplace_id;
  const fallbackRes = await pool.query(`SELECT id FROM marketplaces WHERE is_active = TRUE ORDER BY id ASC LIMIT 1`);
  return fallbackRes.rows[0]?.id || null;
}

async function getRuleBundle(product, marketplaceId) {
  const marketplaceRuleRes = await pool.query(`SELECT * FROM marketplace_rules WHERE marketplace_id = $1 AND is_active = TRUE LIMIT 1`, [marketplaceId]);
  const shippingRuleRes = await pool.query(
    `SELECT * FROM shipping_rules WHERE marketplace_id = $1 AND is_active = TRUE AND COALESCE(min_price, 0) <= $2 AND (max_price IS NULL OR max_price >= $2) ORDER BY min_price DESC NULLS LAST, id DESC LIMIT 1`,
    [marketplaceId, toNumber(product?.sale_price || product?.list_price)]
  );
  let profitTargetRes = { rows: [] };
  if (product?.category_id) { profitTargetRes = await pool.query(`SELECT * FROM profit_targets WHERE category_id = $1 AND is_active = TRUE LIMIT 1`, [product.category_id]); }
  return { marketplaceRule: marketplaceRuleRes.rows[0] || null, shippingRule: shippingRuleRes.rows[0] || null, profitTarget: profitTargetRes.rows[0] || null };
}

async function getLatestCompetitorPrice(productId, marketplaceId) {
  const result = await pool.query(`SELECT competitor_price FROM competitor_prices WHERE product_id = $1 AND ($2::int IS NULL OR marketplace_id = $2) ORDER BY observed_at DESC, id DESC LIMIT 1`, [productId, marketplaceId]);
  return result.rows[0]?.competitor_price ?? null;
}

async function upsertRecommendation(client, payload) {
  const insertRes = await client.query(
    `INSERT INTO price_recommendations (product_id, marketplace_id, current_price, recommended_price, floor_price, target_price, competitor_price, current_margin_rate, projected_margin_rate, profit_margin, recommendation_type, risk_level, confidence, quality_score, reason_text, metadata, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17) RETURNING *`,
    [payload.product_id, payload.marketplace_id, payload.current_price, payload.recommended_price, payload.floor_price, payload.target_price, payload.competitor_price, payload.current_margin_rate, payload.projected_margin_rate, payload.profit_margin, payload.recommendation_type, payload.risk_level, payload.confidence, payload.quality_score, payload.reason_text, JSON.stringify(payload.metadata || {}), 'pending']
  );
  const recommendation = insertRes.rows[0];
  await client.query(`INSERT INTO approvals (entity_type, entity_id, action_type, proposed_payload, status) VALUES ('price_recommendation', $1, 'apply_price', $2::jsonb, 'pending')`, [recommendation.id, JSON.stringify(recommendation)]);
  return recommendation;
}

async function createAlerts(client, recommendationId, productId, marketplaceId, alertItems = []) {
  for (const alert of alertItems) {
    await client.query(`INSERT INTO alerts (product_id, marketplace_id, alert_type, severity, title, message) VALUES ($1,$2,$3,$4,$5,$6)`, [productId, marketplaceId, alert.type || 'generic_alert', alert.severity || 'medium', alert.title || 'Fiyat uyarısı', alert.message || 'Fiyat analizi sırasında uyarı üretildi.']);
  }
}

async function analyzeSingleProduct(product, marketplaceId, actorName) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resolvedMarketplaceId = await getMarketplaceIdForProduct(product.id, marketplaceId);
    const { marketplaceRule, shippingRule, profitTarget } = await getRuleBundle(product, resolvedMarketplaceId);
    const competitorPrice = await getLatestCompetitorPrice(product.id, resolvedMarketplaceId);

    const analysis = buildRecommendation({ product, marketplaceRule, shippingRule, profitTarget, competitorPrice });

    const recommendation = await upsertRecommendation(client, {
      product_id: product.id, marketplace_id: resolvedMarketplaceId, current_price: analysis.currentPrice, recommended_price: analysis.recommendedPrice, floor_price: analysis.floorPrice, target_price: analysis.targetPrice, competitor_price: analysis.competitorPrice, current_margin_rate: analysis.currentMarginRate, projected_margin_rate: analysis.projectedMarginRate, profit_margin: analysis.profitMargin, recommendation_type: analysis.recommendationType, risk_level: analysis.riskLevel, confidence: analysis.confidence, quality_score: analysis.qualityScore, reason_text: analysis.reasonText, metadata: { product_name: product.name, stock_code: product.stock_code, marketplace_rule_id: marketplaceRule?.id || null, shipping_rule_id: shippingRule?.id || null, profit_target_id: profitTarget?.id || null, reasons: analysis.reasons, ...analysis.metadata }
    });

    await createAlerts(client, recommendation.id, product.id, resolvedMarketplaceId, analysis.alerts);
    await client.query(`INSERT INTO audit_logs (user_name, action_type, entity_type, entity_id, before_json, after_json) VALUES ($1, 'analyze_price', 'product', $2, '{}'::jsonb, $3::jsonb)`, [actorName || 'system', product.id, JSON.stringify(recommendation)]);
    await client.query('COMMIT');
    return recommendation;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

// --- ROTALAR ---
router.get('/summary', async (req, res) => {
  try {
    const [recommendationsRes, alertsRes, historyRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending, COUNT(*) FILTER (WHERE status = 'applied')::int AS applied, COUNT(*) FILTER (WHERE risk_level = 'high')::int AS high_risk FROM price_recommendations`),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_resolved = FALSE)::int AS open, COUNT(*) FILTER (WHERE severity = 'high' AND is_resolved = FALSE)::int AS critical FROM alerts`),
      pool.query(`SELECT COUNT(*)::int AS total FROM price_history`)
    ]);
    res.json({ summary: { recommendations: recommendationsRes.rows[0], alerts: alertsRes.rows[0], history: historyRes.rows[0] } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/recommendations', async (req, res) => {
  try { const recommendations = await fetchRecommendationRows({ status: req.query.status, productId: req.query.product_id }); res.json({ recommendations }); } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/export', async (req, res) => {
  try {
    const recommendations = await fetchRecommendationRows({ status: req.query.status, productId: req.query.product_id });
    if (!recommendations.length) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    const now = new Date();
    await sendWorkbook(res, {
      filename: `fiyat-analizi-${now.toISOString().split('T')[0]}.xlsx`,
      sheets: [{
        name: 'Fiyat Analizi',
        columns: [
          { header: 'product_id', key: 'product_id', width: 10 },
          { header: 'stock_code', key: 'stock_code', width: 18 },
          { header: 'product_name', key: 'product_name', width: 28 },
          { header: 'marketplace_name', key: 'marketplace_name', width: 18 },
          { header: 'current_price', key: 'current_price', width: 14 },
          { header: 'purchase_price', key: 'purchase_price', width: 14 },
          { header: 'cost', key: 'cost', width: 14 },
          { header: 'brand_min_price', key: 'brand_min_price', width: 16 },
          { header: 'profit_floor', key: 'profit_floor', width: 14 },
          { header: 'protected_floor', key: 'protected_floor', width: 16 },
          { header: 'marketplace_discount_rate', key: 'marketplace_discount_rate', width: 18 },
          { header: 'discount_adjusted_protected_price', key: 'discount_adjusted_protected_price', width: 24 },
          { header: 'final_listing_price', key: 'final_listing_price', width: 16 },
          { header: 'customer_seen_price', key: 'customer_seen_price', width: 16 },
          { header: 'shipping_cost', key: 'shipping_cost', width: 14 },
          { header: 'commission_amount', key: 'commission_amount', width: 16 },
          { header: 'extra_deductions_total', key: 'extra_deductions_total', width: 18 },
          { header: 'projected_profit', key: 'projected_profit', width: 16 },
          { header: 'projected_margin_rate', key: 'projected_margin_rate', width: 18 },
          { header: 'pricing_rule_scope', key: 'pricing_rule_scope', width: 18 },
          { header: 'shipping_rule_scope', key: 'shipping_rule_scope', width: 18 },
          { header: 'recommended_price', key: 'recommended_price', width: 16 },
          { header: 'note', key: 'note', width: 36 },
          { header: 'warning', key: 'warning', width: 36 },
        ],
        rows: recommendations,
      }],
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/history', async (req, res) => {
  try {
    const { product_id } = req.query; const params = []; const where = [];
    if (product_id) { params.push(Number(product_id)); where.push(`ph.product_id = $${params.length}`); }
    const result = await pool.query(`SELECT ph.*, p.name AS product_name, p.stock_code, m.marketplace_name FROM price_history ph JOIN products p ON p.id = ph.product_id LEFT JOIN marketplaces m ON m.id = ph.marketplace_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ph.created_at DESC, ph.id DESC LIMIT 200`, params);
    res.json({ history: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/alerts', async (req, res) => {
  try {
    const { product_id, open_only } = req.query; const params = []; const where = [];
    if (product_id) { params.push(Number(product_id)); where.push(`a.product_id = $${params.length}`); }
    if (open_only === 'true') { where.push(`a.is_resolved = FALSE`); }
    const result = await pool.query(`SELECT a.*, p.name AS product_name, p.stock_code, m.marketplace_name FROM alerts a LEFT JOIN products p ON p.id = a.product_id LEFT JOIN marketplaces m ON m.id = a.marketplace_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.created_at DESC, a.id DESC LIMIT 100`, params);
    res.json({ alerts: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/analyze', async (req, res) => {
  try {
    const { product_id, marketplace_id } = req.body || {}; const actorName = req.user?.email || req.user?.name || 'system';
    const productsRes = product_id ? await pool.query(`SELECT * FROM products WHERE id = $1`, [Number(product_id)]) : await pool.query(`SELECT * FROM products ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 100`);
    if (!productsRes.rows.length) return res.status(404).json({ error: 'Ürün bulunamadı' });
    const recommendations = [];
    for (const product of productsRes.rows) { recommendations.push(await analyzeSingleProduct(product, marketplace_id, actorName)); }
    res.json({ message: 'Analiz tamamlandı', count: recommendations.length, recommendations });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/recommendations/:id/apply', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recRes = await client.query(`SELECT pr.*, p.name AS product_name FROM price_recommendations pr JOIN products p ON p.id = pr.product_id WHERE pr.id = $1 LIMIT 1`, [Number(req.params.id)]);
    if (!recRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Öneri bulunamadı' }); }
    const recommendation = recRes.rows[0];
    await client.query(`UPDATE products SET sale_price = $1, updated_at = NOW() WHERE id = $2`, [recommendation.recommended_price, recommendation.product_id]);
    await client.query(`UPDATE price_recommendations SET status = 'applied', approved_at = NOW(), applied_at = NOW() WHERE id = $1`, [Number(req.params.id)]);
    await client.query('COMMIT');
    res.json({ message: 'Fiyat önerisi uygulandı' });
  } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ error: error.message }); } finally { client.release(); }
});

router.post('/recommendations/:id/reject', async (req, res) => {
  try { await pool.query(`UPDATE price_recommendations SET status = 'rejected' WHERE id = $1 AND status = 'pending'`, [Number(req.params.id)]); res.json({ message: 'Öneri reddedildi' }); } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- İŞTE EKLENEN SORUNSUZ EXCEL IMPORT ROTASI ---
router.post('/import-and-analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Lütfen bir Excel dosyası yükleyin' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1); 
    const sonuclar = [];
    const actorName = req.user?.email || 'excel_user';

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const stockCode = row.getCell(2).value; 

      if (!stockCode) continue;

      const productRes = await pool.query('SELECT * FROM products WHERE stock_code = $1', [stockCode]);
      
      if (productRes.rows.length > 0) {
        try {
          const result = await analyzeSingleProduct(productRes.rows[0], null, actorName);
          sonuclar.push({ stockCode: stockCode, durum: 'Başarılı', id: result.id });
        } catch (err) {
          sonuclar.push({ stockCode: stockCode, durum: 'Hata', mesaj: err.message });
        }
      } else {
        sonuclar.push({ stockCode: stockCode, durum: 'Bulunamadı' });
      }
    }
    res.json({ message: 'Excel İşlemi Tamamlandı', count: sonuclar.length, details: sonuclar });
  } catch (error) {
    res.status(500).json({ error: 'Excel işlenirken hata oluştu: ' + error.message });
  }
});

module.exports = router;
