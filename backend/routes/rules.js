const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');

const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { sendWorkbook } = require('../services/excelExport');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

function toNullableNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const normalized = String(value).replace(',', '.').trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function toNullableText(value) {
  if (value === '' || value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'evet', 'aktif', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'hayır', 'hayir', 'pasif', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeSheetName(value) {
  return normalizeKey(value).replace(/_/g, '');
}

function formatDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isBlankRow(values) {
  return Object.values(values).every((value) => {
    if (value === null || value === undefined) return true;
    return String(value).trim() === '';
  });
}

function worksheetToObjects(worksheet) {
  if (!worksheet || worksheet.rowCount < 2) return [];

  const headerRow = worksheet.getRow(1);
  const headers = [];

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeKey(cell.value);
  });

  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = {};

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      const cellValue =
        cell.value && typeof cell.value === 'object' && cell.value.text
          ? cell.value.text
          : cell.value;
      values[key] = cellValue;
    });

    if (!isBlankRow(values)) {
      rows.push({ rowNumber, values });
    }
  }

  return rows;
}

function pickValue(values, ...keys) {
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (Object.prototype.hasOwnProperty.call(values, normalized)) {
      return values[normalized];
    }
  }
  return undefined;
}

function findWorksheet(workbook, aliases) {
  const normalizedAliases = aliases.map(normalizeSheetName);
  return workbook.worksheets.find((worksheet) =>
    normalizedAliases.includes(normalizeSheetName(worksheet.name))
  );
}

function normalizeShippingScope(marketplaceId) {
  return marketplaceId ? 'marketplace' : 'general';
}

async function resolveMarketplaceId(client, values) {
  const directId = toNullableNumber(
    pickValue(values, 'marketplace_id', 'pazaryeri_id')
  );
  if (directId) return directId;

  const marketplaceName = toNullableText(
    pickValue(values, 'marketplace_name', 'marketplace', 'pazaryeri_adi', 'pazaryeri')
  );
  if (!marketplaceName) return null;

  const result = await client.query(
    'SELECT id FROM marketplaces WHERE LOWER(marketplace_name) = LOWER($1) LIMIT 1',
    [marketplaceName]
  );
  return result.rows[0]?.id || null;
}

async function resolveCategoryId(client, values) {
  const directId = toNullableNumber(pickValue(values, 'category_id', 'kategori_id'));
  if (directId) return directId;

  const categoryName = toNullableText(
    pickValue(values, 'category_name', 'category', 'kategori_adi', 'kategori')
  );
  if (!categoryName) return null;

  const result = await client.query(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [categoryName]
  );
  return result.rows[0]?.id || null;
}

async function resolveProductId(client, values) {
  const directId = toNullableNumber(pickValue(values, 'product_id', 'urun_id'));
  if (directId) return directId;

  const stockCode = toNullableText(
    pickValue(values, 'product_stock_code', 'stock_code', 'stok_kodu')
  );
  if (stockCode) {
    const byStockCode = await client.query(
      'SELECT id FROM products WHERE LOWER(stock_code) = LOWER($1) LIMIT 1',
      [stockCode]
    );
    if (byStockCode.rows[0]?.id) return byStockCode.rows[0].id;
  }

  const productName = toNullableText(
    pickValue(values, 'product_name', 'product', 'urun_adi', 'urun')
  );
  if (!productName) return null;

  const byName = await client.query(
    'SELECT id FROM products WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [productName]
  );
  return byName.rows[0]?.id || null;
}

async function resolveMarketplaceRuleId(client, values) {
  const directId = toNullableNumber(
    pickValue(values, 'marketplace_rule_id', 'pazaryeri_kurali_id')
  );
  if (directId) return directId;

  const scopeType = toNullableText(
    pickValue(values, 'marketplace_rule_scope', 'scope_type', 'scope', 'kural_kapsami')
  );
  const marketplaceId = await resolveMarketplaceId(client, values);

  if (!scopeType) return null;

  const result = await client.query(
    `SELECT mr.id
       FROM marketplace_rules mr
      WHERE LOWER(mr.scope_type) = LOWER($1)
        AND (
          ($2::int IS NULL AND mr.marketplace_id IS NULL)
          OR mr.marketplace_id = $2
        )
      ORDER BY mr.priority DESC, mr.id DESC
      LIMIT 1`,
    [scopeType, marketplaceId]
  );

  return result.rows[0]?.id || null;
}

async function buildShippingRulePayload(client, values) {
  const marketplaceId = await resolveMarketplaceId(client, values);

  const minPrice =
    toNullableNumber(
      pickValue(values, 'min_price', 'min_fiyat', 'min_tutar', 'min_tutar_tl')
    ) ?? 0;

  const maxPrice = toNullableNumber(
    pickValue(values, 'max_price', 'max_fiyat', 'max_tutar', 'max_tutar_tl')
  );

  const minDesi =
    toNullableNumber(
      pickValue(values, 'min_desi', 'min_desi_degeri')
    ) ?? 0;

  const maxDesi = toNullableNumber(
    pickValue(values, 'max_desi', 'max_desi_degeri')
  );

  const shippingCost =
    toNullableNumber(
      pickValue(values, 'shipping_cost', 'kargo_maliyeti', 'kargo_ucreti', 'kargo_ucreti_tl')
    ) ?? 0;

  const isActive = toBoolean(
    pickValue(values, 'is_active', 'aktif_mi'),
    true
  );

  const notes = toNullableText(pickValue(values, 'notes', 'notlar'));

  if (maxPrice !== null && maxPrice < minPrice) {
    throw new Error('Max Tutar, Min Tutar değerinden küçük olamaz');
  }

  if (maxDesi !== null && maxDesi < minDesi) {
    throw new Error('Max Desi, Min Desi değerinden küçük olamaz');
  }

  if (shippingCost < 0) {
    throw new Error('Kargo Ücreti 0’dan küçük olamaz');
  }

  return {
    scopeType: normalizeShippingScope(marketplaceId),
    marketplaceId,
    minPrice,
    maxPrice,
    minDesi,
    maxDesi,
    shippingCost,
    isActive,
    notes,
    validFrom: formatDate(pickValue(values, 'valid_from', 'gecerlilik_baslangici')),
    validTo: formatDate(pickValue(values, 'valid_to', 'gecerlilik_bitis')),
  };
}

async function ensureNoShippingOverlap(client, payload, excludeId = null) {
  const maxPrice = payload.maxPrice ?? 999999999;
  const maxDesi = payload.maxDesi ?? 999999999;

  const result = await client.query(
    `
    SELECT
      sr.id,
      COALESCE(m.marketplace_name, 'Genel') AS marketplace_name,
      sr.min_price,
      sr.max_price,
      sr.min_desi,
      sr.max_desi
    FROM shipping_rules sr
    LEFT JOIN marketplaces m ON m.id = sr.marketplace_id
    WHERE
      (
        ($1::int IS NULL AND sr.marketplace_id IS NULL)
        OR sr.marketplace_id = $1
      )
      AND COALESCE(sr.min_price, 0) <= $3
      AND COALESCE(sr.max_price, 999999999) >= $2
      AND COALESCE(sr.min_desi, 0) <= $5
      AND COALESCE(sr.max_desi, 999999999) >= $4
      AND ($6::int IS NULL OR sr.id <> $6)
      AND COALESCE(sr.is_active, true) = true
    LIMIT 1
    `,
    [
      payload.marketplaceId,
      payload.minPrice,
      maxPrice,
      payload.minDesi,
      maxDesi,
      excludeId,
    ]
  );

  if (result.rows[0]) {
    const row = result.rows[0];
    throw new Error(
      `Çakışan kargo kuralı bulundu: #${row.id} | ${row.marketplace_name} | ` +
      `${row.min_price ?? 0}-${row.max_price ?? '∞'} TL | ` +
      `${row.min_desi ?? 0}-${row.max_desi ?? '∞'} desi`
    );
  }
}

async function getMarketplaceRules() {
  const result = await pool.query(`
    SELECT
      mr.*,
      m.marketplace_name,
      c.name AS category_name,
      p.name AS product_name,
      p.stock_code AS product_stock_code
    FROM marketplace_rules mr
    LEFT JOIN marketplaces m ON m.id = mr.marketplace_id
    LEFT JOIN categories c ON c.id = mr.category_id
    LEFT JOIN products p ON p.id = mr.product_id
    ORDER BY mr.scope_type, COALESCE(m.marketplace_name, 'General'), mr.priority DESC, mr.id DESC
  `);
  return result.rows;
}

async function getShippingRules() {
  const result = await pool.query(`
    SELECT
      sr.id,
      sr.scope_type,
      sr.marketplace_id,
      COALESCE(m.marketplace_name, '') AS marketplace_name,
      sr.min_price,
      sr.max_price,
      sr.min_desi,
      sr.max_desi,
      sr.shipping_cost,
      sr.is_active,
      sr.valid_from,
      sr.valid_to,
      sr.notes,
      sr.created_at,
      sr.updated_at
    FROM shipping_rules sr
    LEFT JOIN marketplaces m ON m.id = sr.marketplace_id
    ORDER BY
      CASE WHEN sr.marketplace_id IS NULL THEN 2 ELSE 1 END,
      COALESCE(m.marketplace_name, 'General'),
      sr.min_price ASC,
      sr.min_desi ASC,
      sr.id DESC
  `);
  return result.rows;
}

async function getProfitTargets() {
  const result = await pool.query(`
    SELECT
      pt.*,
      m.marketplace_name,
      c.name AS category_name,
      p.name AS product_name,
      p.stock_code AS product_stock_code
    FROM profit_targets pt
    LEFT JOIN marketplaces m ON m.id = pt.marketplace_id
    LEFT JOIN categories c ON c.id = pt.category_id
    LEFT JOIN products p ON p.id = pt.product_id
    ORDER BY pt.scope_type, COALESCE(m.marketplace_name, 'General'), pt.priority DESC, pt.id DESC
  `);
  return result.rows;
}

async function getExtraDeductions() {
  const result = await pool.query(`
    SELECT
      med.*,
      mr.scope_type AS marketplace_rule_scope,
      m.marketplace_name
    FROM marketplace_extra_deductions med
    LEFT JOIN marketplace_rules mr ON mr.id = med.marketplace_rule_id
    LEFT JOIN marketplaces m ON m.id = mr.marketplace_id
    ORDER BY med.priority ASC, med.id DESC
  `);
  return result.rows;
}

function buildRulesExportSheets({ marketplaceRules, shippingRules, profitTargets, extraDeductions }) {
  return [
    {
      name: 'Pazaryeri Kuralları',
      columns: [
        { header: 'id', key: 'id' },
        { header: 'scope_type', key: 'scope_type' },
        { header: 'marketplace_id', key: 'marketplace_id' },
        { header: 'marketplace_name', key: 'marketplace_name' },
        { header: 'category_id', key: 'category_id' },
        { header: 'category_name', key: 'category_name' },
        { header: 'product_id', key: 'product_id' },
        { header: 'product_stock_code', key: 'product_stock_code' },
        { header: 'product_name', key: 'product_name' },
        { header: 'priority', key: 'priority' },
        { header: 'minimum_profit_margin', key: 'minimum_profit_margin' },
        { header: 'target_profit_margin', key: 'target_profit_margin' },
        { header: 'min_margin_rate', key: 'min_margin_rate' },
        { header: 'target_margin_rate', key: 'target_margin_rate' },
        { header: 'commission_rate', key: 'commission_rate' },
        { header: 'commission_base', key: 'commission_base' },
        { header: 'vat_rate', key: 'vat_rate' },
        { header: 'fixed_fee', key: 'fixed_fee' },
        { header: 'marketplace_discount_rate', key: 'marketplace_discount_rate' },
        { header: 'marketplace_discount_funded', key: 'marketplace_discount_funded' },
        { header: 'rounding_ending', key: 'rounding_ending' },
        { header: 'is_active', key: 'is_active' },
        { header: 'valid_from', key: 'valid_from' },
        { header: 'valid_to', key: 'valid_to' },
        { header: 'notes', key: 'notes', width: 30 },
      ],
      rows: marketplaceRules.map((row) => ({
        ...row,
        valid_from: formatDate(row.valid_from),
        valid_to: formatDate(row.valid_to),
      })),
    },
    {
      name: 'Kargo Kuralları',
      columns: [
        { header: 'id', key: 'id' },
        { header: 'marketplace_name', key: 'marketplace_name' },
        { header: 'min_price', key: 'min_price' },
        { header: 'max_price', key: 'max_price' },
        { header: 'min_desi', key: 'min_desi' },
        { header: 'max_desi', key: 'max_desi' },
        { header: 'shipping_cost', key: 'shipping_cost' },
        { header: 'is_active', key: 'is_active' },
        { header: 'notes', key: 'notes', width: 30 },
      ],
      rows: shippingRules.map((row) => ({
        ...row,
        marketplace_name: row.marketplace_name || '',
      })),
    },
    {
      name: 'Kar Hedefleri',
      columns: [
        { header: 'id', key: 'id' },
        { header: 'scope_type', key: 'scope_type' },
        { header: 'marketplace_id', key: 'marketplace_id' },
        { header: 'marketplace_name', key: 'marketplace_name' },
        { header: 'category_id', key: 'category_id' },
        { header: 'category_name', key: 'category_name' },
        { header: 'product_id', key: 'product_id' },
        { header: 'product_stock_code', key: 'product_stock_code' },
        { header: 'product_name', key: 'product_name' },
        { header: 'priority', key: 'priority' },
        { header: 'min_profit_margin', key: 'min_profit_margin' },
        { header: 'target_profit_margin', key: 'target_profit_margin' },
        { header: 'min_margin_rate', key: 'min_margin_rate' },
        { header: 'target_margin_rate', key: 'target_margin_rate' },
        { header: 'is_active', key: 'is_active' },
        { header: 'valid_from', key: 'valid_from' },
        { header: 'valid_to', key: 'valid_to' },
        { header: 'notes', key: 'notes', width: 30 },
      ],
      rows: profitTargets.map((row) => ({
        ...row,
        valid_from: formatDate(row.valid_from),
        valid_to: formatDate(row.valid_to),
      })),
    },
    {
      name: 'Ek Kesintiler',
      columns: [
        { header: 'id', key: 'id' },
        { header: 'marketplace_rule_id', key: 'marketplace_rule_id' },
        { header: 'marketplace_rule_scope', key: 'marketplace_rule_scope' },
        { header: 'marketplace_name', key: 'marketplace_name' },
        { header: 'name', key: 'name' },
        { header: 'deduction_type', key: 'deduction_type' },
        { header: 'calculation_type', key: 'calculation_type' },
        { header: 'base_amount_type', key: 'base_amount_type' },
        { header: 'rate', key: 'rate' },
        { header: 'fixed_amount', key: 'fixed_amount' },
        { header: 'priority', key: 'priority' },
        { header: 'is_active', key: 'is_active' },
        { header: 'valid_from', key: 'valid_from' },
        { header: 'valid_to', key: 'valid_to' },
        { header: 'notes', key: 'notes', width: 30 },
      ],
      rows: extraDeductions.map((row) => ({
        ...row,
        valid_from: formatDate(row.valid_from),
        valid_to: formatDate(row.valid_to),
      })),
    },
  ];
}

async function buildRulesTemplateSheets() {
  return [
    {
      name: 'Pazaryeri Kuralları',
      columns: [
        { header: 'id', key: 'id' },
        { header: 'scope_type', key: 'scope_type' },
        { header: 'marketplace_id', key: 'marketplace_id' },
        { header: 'marketplace_name', key: 'marketplace_name' },
        { header: 'category_id', key: 'category_id' },
        { header: 'category_name', key: 'category_name' },
        { header: 'product_id', key: 'product_id' },
        { header: 'product_stock_code', key: 'product_stock_code' },
        { header: 'product_name', key: 'product_name' },
        { header: 'priority', key: 'priority' },
        { header: 'min_margin_rate', key: 'min_margin_rate' },
        { header: 'target_margin_rate', key: 'target_margin_rate' },
        { header: 'commission_rate', key: 'commission_rate' },
        { header: 'commission_base', key: 'commission_base' },
        { header: 'vat_rate', key: 'vat_rate' },
        { header: 'fixed_fee', key: 'fixed_fee' },
        { header: 'marketplace_discount_rate', key: 'marketplace_discount_rate' },
        { header: 'marketplace_discount_funded', key: 'marketplace_discount_funded' },
        { header: 'rounding_ending', key: 'rounding_ending' },
        { header: 'is_active', key: 'is_active' },
        { header: 'notes', key: 'notes', width: 30 },
      ],
      rows: [
        {
          id: '',
          scope_type: 'general',
          marketplace_id: '',
          marketplace_name: '',
          category_id: '',
          category_name: '',
          product_id: '',
          product_stock_code: '',
          product_name: '',
          priority: 0,
          min_margin_rate: 10,
          target_margin_rate: 18,
          commission_rate: 0,
          commission_base: 'net_ex_vat',
          vat_rate: 20,
          fixed_fee: 0,
          marketplace_discount_rate: 0,
          marketplace_discount_funded: false,
          rounding_ending: 0.9,
          is_active: true,
          notes: 'Yeni satır ekleyin; mevcut satırı güncellemek için id kullanın.',
        },
      ],
    },
    {
      name: 'Kargo Kuralları',
      columns: [
        { header: 'id', key: 'id' },
        { header: 'marketplace_name', key: 'marketplace_name' },
        { header: 'min_price', key: 'min_price' },
        { header: 'max_price', key: 'max_price' },
        { header: 'min_desi', key: 'min_desi' },
        { header: 'max_desi', key: 'max_desi' },
        { header: 'shipping_cost', key: 'shipping_cost' },
        { header: 'is_active', key: 'is_active' },
        { header: 'notes', key: 'notes', width: 30 },
      ],
      rows: [
        {
          id: '',
          marketplace_name: '',
          min_price: 0,
          max_price: 299.99,
          min_desi: 4,
          max_desi: 6,
          shipping_cost: 65,
          is_active: true,
          notes: 'Pazaryeri boşsa genel kural kabul edilir.',
        },
        {
          id: '',
          marketplace_name: '',
          min_price: 300,
          max_price: '',
          min_desi: 4,
          max_desi: 6,
          shipping_cost: 100,
          is_active: true,
          notes: 'Aynı desi için farklı fiyat bareminde farklı kargo tanımlanabilir.',
        },
      ],
    },
    {
      name: 'Kar Hedefleri',
      columns: [
        { header: 'id', key: 'id' },
        { header: 'scope_type', key: 'scope_type' },
        { header: 'marketplace_id', key: 'marketplace_id' },
        { header: 'marketplace_name', key: 'marketplace_name' },
        { header: 'category_id', key: 'category_id' },
        { header: 'category_name', key: 'category_name' },
        { header: 'product_id', key: 'product_id' },
        { header: 'product_stock_code', key: 'product_stock_code' },
        { header: 'product_name', key: 'product_name' },
        { header: 'priority', key: 'priority' },
        { header: 'min_margin_rate', key: 'min_margin_rate' },
        { header: 'target_margin_rate', key: 'target_margin_rate' },
        { header: 'is_active', key: 'is_active' },
        { header: 'notes', key: 'notes', width: 30 },
      ],
      rows: [
        {
          id: '',
          scope_type: 'general',
          marketplace_id: '',
          marketplace_name: '',
          category_id: '',
          category_name: '',
          product_id: '',
          product_stock_code: '',
          product_name: '',
          priority: 0,
          min_margin_rate: 10,
          target_margin_rate: 18,
          is_active: true,
          notes: 'Kategori veya ürün bazlı hedefler için id ya da isim/stok kodu kullanın.',
        },
      ],
    },
    {
      name: 'Ek Kesintiler',
      columns: [
        { header: 'id', key: 'id' },
        { header: 'marketplace_rule_id', key: 'marketplace_rule_id' },
        { header: 'marketplace_rule_scope', key: 'marketplace_rule_scope' },
        { header: 'marketplace_name', key: 'marketplace_name' },
        { header: 'name', key: 'name' },
        { header: 'deduction_type', key: 'deduction_type' },
        { header: 'calculation_type', key: 'calculation_type' },
        { header: 'base_amount_type', key: 'base_amount_type' },
        { header: 'rate', key: 'rate' },
        { header: 'fixed_amount', key: 'fixed_amount' },
        { header: 'priority', key: 'priority' },
        { header: 'is_active', key: 'is_active' },
        { header: 'notes', key: 'notes', width: 30 },
      ],
      rows: [
        {
          id: '',
          marketplace_rule_id: '',
          marketplace_rule_scope: 'general',
          marketplace_name: '',
          name: 'Stopaj',
          deduction_type: 'withholding',
          calculation_type: 'percentage',
          base_amount_type: 'net_ex_vat',
          rate: 1,
          fixed_amount: 0,
          priority: 0,
          is_active: true,
          notes: 'marketplace_rule_id tercih edilir; yoksa scope + marketplace_name ile eşleştirme denenir.',
        },
      ],
    },
  ];
}

async function upsertMarketplaceRule(client, values) {
  const id = toNullableNumber(pickValue(values, 'id'));
  const scopeType = toNullableText(pickValue(values, 'scope_type', 'scope', 'kural_kapsami')) || 'general';
  const marketplaceId = await resolveMarketplaceId(client, values);
  const categoryId = await resolveCategoryId(client, values);
  const productId = await resolveProductId(client, values);
  const minMarginRate =
    toNullableNumber(
      pickValue(values, 'min_margin_rate', 'minimum_profit_margin', 'minimum_kar_marji')
    ) ?? 10;
  const targetMarginRate =
    toNullableNumber(
      pickValue(values, 'target_margin_rate', 'target_profit_margin', 'hedef_kar_marji')
    ) ?? 18;

  const params = [
    scopeType,
    marketplaceId,
    categoryId,
    productId,
    toNullableNumber(pickValue(values, 'priority', 'oncelik')) ?? 0,
    minMarginRate,
    targetMarginRate,
    minMarginRate,
    targetMarginRate,
    toNullableNumber(pickValue(values, 'commission_rate', 'komisyon_orani')) ?? 0,
    toNullableText(pickValue(values, 'commission_base', 'komisyon_bazi')) || 'net_ex_vat',
    toNullableNumber(pickValue(values, 'vat_rate', 'kdv_orani')) ?? 20,
    toNullableNumber(pickValue(values, 'fixed_fee', 'sabit_ucret')) ?? 0,
    toNullableNumber(pickValue(values, 'marketplace_discount_rate', 'pazaryeri_indirim_orani')) ?? 0,
    toBoolean(pickValue(values, 'marketplace_discount_funded', 'pazaryeri_indirimi_fonluyor'), false),
    toNullableNumber(pickValue(values, 'rounding_ending', 'yuvarlama_sonu')) ?? 0.9,
    toBoolean(pickValue(values, 'is_active', 'aktif_mi'), true),
    formatDate(pickValue(values, 'valid_from', 'gecerlilik_baslangici')),
    formatDate(pickValue(values, 'valid_to', 'gecerlilik_bitis')),
    toNullableText(pickValue(values, 'notes', 'notlar')),
  ];

  if (id) {
    const result = await client.query(
      `UPDATE marketplace_rules
          SET scope_type = $1,
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
      [...params, id]
    );

    if (!result.rows.length) throw new Error('Pazaryeri kuralı bulunamadı');
    return 'updated';
  }

  await client.query(
    `INSERT INTO marketplace_rules (
        scope_type,
        marketplace_id,
        category_id,
        product_id,
        priority,
        minimum_profit_margin,
        target_profit_margin,
        min_margin_rate,
        target_margin_rate,
        commission_rate,
        commission_base,
        vat_rate,
        fixed_fee,
        marketplace_discount_rate,
        marketplace_discount_funded,
        rounding_ending,
        is_active,
        valid_from,
        valid_to,
        notes
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,$12,$13,
        $14,$15,$16,
        $17,$18,$19,$20
      )`,
    params
  );

  return 'created';
}

async function upsertShippingRule(client, values) {
  const id = toNullableNumber(pickValue(values, 'id'));
  const payload = await buildShippingRulePayload(client, values);

  await ensureNoShippingOverlap(client, payload, id || null);

  const params = [
    payload.scopeType,
    payload.marketplaceId,
    payload.minPrice,
    payload.maxPrice,
    payload.minDesi,
    payload.maxDesi,
    payload.shippingCost,
    payload.isActive,
    payload.validFrom,
    payload.validTo,
    payload.notes,
  ];

  if (id) {
    const result = await client.query(
      `
      UPDATE shipping_rules
      SET
        scope_type = $1,
        marketplace_id = $2,
        min_price = $3,
        max_price = $4,
        min_desi = $5,
        max_desi = $6,
        shipping_cost = $7,
        is_active = $8,
        valid_from = $9,
        valid_to = $10,
        notes = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING *
      `,
      [...params, id]
    );

    if (!result.rows.length) {
      throw new Error('Kargo kuralı bulunamadı');
    }

    return 'updated';
  }

  await client.query(
    `
    INSERT INTO shipping_rules (
      scope_type,
      marketplace_id,
      min_price,
      max_price,
      min_desi,
      max_desi,
      shipping_cost,
      is_active,
      valid_from,
      valid_to,
      notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `,
    params
  );

  return 'created';
}

async function upsertProfitTarget(client, values) {
  const id = toNullableNumber(pickValue(values, 'id'));
  const minMarginRate =
    toNullableNumber(
      pickValue(values, 'min_margin_rate', 'min_profit_margin', 'minimum_profit_margin')
    ) ?? 10;
  const targetMarginRate =
    toNullableNumber(
      pickValue(values, 'target_margin_rate', 'target_profit_margin')
    ) ?? 18;

  const params = [
    toNullableText(pickValue(values, 'scope_type', 'scope', 'kural_kapsami')) || 'general',
    await resolveMarketplaceId(client, values),
    await resolveCategoryId(client, values),
    await resolveProductId(client, values),
    toNullableNumber(pickValue(values, 'priority', 'oncelik')) ?? 0,
    minMarginRate,
    targetMarginRate,
    minMarginRate,
    targetMarginRate,
    toBoolean(pickValue(values, 'is_active', 'aktif_mi'), true),
    formatDate(pickValue(values, 'valid_from', 'gecerlilik_baslangici')),
    formatDate(pickValue(values, 'valid_to', 'gecerlilik_bitis')),
    toNullableText(pickValue(values, 'notes', 'notlar')),
  ];

  if (id) {
    const result = await client.query(
      `UPDATE profit_targets
          SET scope_type = $1,
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
      [...params, id]
    );

    if (!result.rows.length) throw new Error('Kâr hedefi bulunamadı');
    return 'updated';
  }

  await client.query(
    `INSERT INTO profit_targets (
        scope_type,
        marketplace_id,
        category_id,
        product_id,
        priority,
        min_profit_margin,
        target_profit_margin,
        min_margin_rate,
        target_margin_rate,
        is_active,
        valid_from,
        valid_to,
        notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    params
  );

  return 'created';
}

async function upsertExtraDeduction(client, values) {
  const id = toNullableNumber(pickValue(values, 'id'));
  const marketplaceRuleId = await resolveMarketplaceRuleId(client, values);

  const params = [
    marketplaceRuleId,
    toNullableText(pickValue(values, 'name', 'ad')) || 'Ek Kesinti',
    toNullableText(pickValue(values, 'deduction_type', 'kesinti_tipi')) || 'other',
    toNullableText(pickValue(values, 'calculation_type', 'hesaplama_tipi')) || 'percentage',
    toNullableText(pickValue(values, 'base_amount_type', 'baz_tutar_tipi')) || 'net_ex_vat',
    toNullableNumber(pickValue(values, 'rate', 'oran')) ?? 0,
    toNullableNumber(pickValue(values, 'fixed_amount', 'sabit_tutar')) ?? 0,
    toNullableNumber(pickValue(values, 'priority', 'oncelik')) ?? 0,
    toBoolean(pickValue(values, 'is_active', 'aktif_mi'), true),
    formatDate(pickValue(values, 'valid_from', 'gecerlilik_baslangici')),
    formatDate(pickValue(values, 'valid_to', 'gecerlilik_bitis')),
    toNullableText(pickValue(values, 'notes', 'notlar')),
  ];

  if (id) {
    const result = await client.query(
      `UPDATE marketplace_extra_deductions
          SET marketplace_rule_id = $1,
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
      [...params, id]
    );

    if (!result.rows.length) throw new Error('Ek kesinti bulunamadı');
    return 'updated';
  }

  await client.query(
    `INSERT INTO marketplace_extra_deductions (
        marketplace_rule_id,
        name,
        deduction_type,
        calculation_type,
        base_amount_type,
        rate,
        fixed_amount,
        priority,
        is_active,
        valid_from,
        valid_to,
        notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    params
  );

  return 'created';
}

router.get('/export', async (req, res) => {
  try {
    const [marketplaceRules, shippingRules, profitTargets, extraDeductions] = await Promise.all([
      getMarketplaceRules(),
      getShippingRules(),
      getProfitTargets(),
      getExtraDeductions(),
    ]);

    await sendWorkbook(res, {
      filename: 'rules-export.xlsx',
      sheets: buildRulesExportSheets({
        marketplaceRules,
        shippingRules,
        profitTargets,
        extraDeductions,
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/template', async (req, res) => {
  try {
    await sendWorkbook(res, {
      filename: 'rules-template.xlsx',
      sheets: await buildRulesTemplateSheets(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Excel dosyası gerekli' });
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);

  const client = await pool.connect();
  const report = {
    summary: { created: 0, updated: 0, failed: 0 },
    sheets: {
      marketplace: { name: 'Pazaryeri Kuralları', created: 0, updated: 0, failed: 0 },
      shipping: { name: 'Kargo Kuralları', created: 0, updated: 0, failed: 0 },
      profit: { name: 'Kar Hedefleri', created: 0, updated: 0, failed: 0 },
      deductions: { name: 'Ek Kesintiler', created: 0, updated: 0, failed: 0 },
    },
    errors: [],
  };

  const sheetConfigs = [
    {
      key: 'marketplace',
      aliases: ['Pazaryeri Kuralları', 'Marketplace Rules'],
      handler: upsertMarketplaceRule,
    },
    {
      key: 'shipping',
      aliases: ['Kargo Kuralları', 'Shipping Rules'],
      handler: upsertShippingRule,
    },
    {
      key: 'profit',
      aliases: ['Kar Hedefleri', 'Kâr Hedefleri', 'Profit Targets'],
      handler: upsertProfitTarget,
    },
    {
      key: 'deductions',
      aliases: ['Ek Kesintiler', 'Extra Deductions'],
      handler: upsertExtraDeduction,
    },
  ];

  try {
    for (const config of sheetConfigs) {
      const worksheet = findWorksheet(workbook, config.aliases);
      if (!worksheet) continue;

      const rows = worksheetToObjects(worksheet);
      for (const row of rows) {
        try {
          const result = await config.handler(client, row.values);
          report.summary[result] += 1;
          report.sheets[config.key][result] += 1;
        } catch (error) {
          report.summary.failed += 1;
          report.sheets[config.key].failed += 1;
          report.errors.push({
            sheet: worksheet.name,
            row: row.rowNumber,
            message: error.message,
          });
        }
      }
    }

    res.json({
      message: 'Rules Excel içe aktarma tamamlandı',
      report,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.get('/marketplace', async (req, res) => {
  try {
    const rules = await getMarketplaceRules();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/marketplace', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `INSERT INTO marketplace_rules (
          scope_type,
          marketplace_id,
          category_id,
          product_id,
          priority,
          minimum_profit_margin,
          target_profit_margin,
          min_margin_rate,
          target_margin_rate,
          commission_rate,
          commission_base,
          vat_rate,
          fixed_fee,
          marketplace_discount_rate,
          marketplace_discount_funded,
          rounding_ending,
          is_active,
          valid_from,
          valid_to,
          notes
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
        toNullableNumber(body.rounding_ending) ?? 0.9,
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
      `UPDATE marketplace_rules
          SET scope_type = $1,
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
        toNullableNumber(body.rounding_ending) ?? 0.9,
        toBoolean(body.is_active, true),
        body.valid_from || null,
        body.valid_to || null,
        toNullableText(body.notes),
        Number(req.params.id),
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Kural bulunamadı' });
    }

    res.json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/marketplace/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM marketplace_rules WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Kural bulunamadı' });
    }
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/shipping', async (req, res) => {
  try {
    const rules = await getShippingRules();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/shipping', async (req, res) => {
  const client = await pool.connect();

  try {
    const payload = await buildShippingRulePayload(client, req.body || {});
    await ensureNoShippingOverlap(client, payload, null);

    const result = await client.query(
      `
      INSERT INTO shipping_rules (
        scope_type,
        marketplace_id,
        min_price,
        max_price,
        min_desi,
        max_desi,
        shipping_cost,
        is_active,
        valid_from,
        valid_to,
        notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        payload.scopeType,
        payload.marketplaceId,
        payload.minPrice,
        payload.maxPrice,
        payload.minDesi,
        payload.maxDesi,
        payload.shippingCost,
        payload.isActive,
        payload.validFrom,
        payload.validTo,
        payload.notes,
      ]
    );

    res.status(201).json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.put('/shipping/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const ruleId = Number(req.params.id);
    const payload = await buildShippingRulePayload(client, req.body || {});
    await ensureNoShippingOverlap(client, payload, ruleId);

    const result = await client.query(
      `
      UPDATE shipping_rules
      SET
        scope_type = $1,
        marketplace_id = $2,
        min_price = $3,
        max_price = $4,
        min_desi = $5,
        max_desi = $6,
        shipping_cost = $7,
        is_active = $8,
        valid_from = $9,
        valid_to = $10,
        notes = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING *
      `,
      [
        payload.scopeType,
        payload.marketplaceId,
        payload.minPrice,
        payload.maxPrice,
        payload.minDesi,
        payload.maxDesi,
        payload.shippingCost,
        payload.isActive,
        payload.validFrom,
        payload.validTo,
        payload.notes,
        ruleId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Kargo kuralı bulunamadı' });
    }

    res.json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.delete('/shipping/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM shipping_rules WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Kargo kuralı bulunamadı' });
    }
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profit-targets', async (req, res) => {
  try {
    const rules = await getProfitTargets();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/profit-targets', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `INSERT INTO profit_targets (
          scope_type,
          marketplace_id,
          category_id,
          product_id,
          priority,
          min_profit_margin,
          target_profit_margin,
          min_margin_rate,
          target_margin_rate,
          is_active,
          valid_from,
          valid_to,
          notes
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
      `UPDATE profit_targets
          SET scope_type = $1,
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

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Kâr hedefi bulunamadı' });
    }

    res.json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/profit-targets/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM profit_targets WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Kâr hedefi bulunamadı' });
    }
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/extra-deductions', async (req, res) => {
  try {
    const rules = await getExtraDeductions();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/extra-deductions', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await pool.query(
      `INSERT INTO marketplace_extra_deductions (
          marketplace_rule_id,
          name,
          deduction_type,
          calculation_type,
          base_amount_type,
          rate,
          fixed_amount,
          priority,
          is_active,
          valid_from,
          valid_to,
          notes
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
      `UPDATE marketplace_extra_deductions
          SET marketplace_rule_id = $1,
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

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Ek kesinti bulunamadı' });
    }

    res.json({ rule: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/extra-deductions/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM marketplace_extra_deductions WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Ek kesinti bulunamadı' });
    }
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;