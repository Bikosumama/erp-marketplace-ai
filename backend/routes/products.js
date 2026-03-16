const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { sendWorkbook } = require('../services/excelExport');

async function fetchMarketplaces() {
  const result = await pool.query(
    'SELECT id, marketplace_name FROM marketplaces ORDER BY id ASC'
  );
  return result.rows;
}

async function fetchProductsWithDetails(filters = {}) {
  const { status, brandId, categoryId, marketplaceId } = filters;
  const params = [];
  const where = [];

  if (status) {
    params.push(status);
    where.push(`p.status = $${params.length}`);
  }

  if (brandId) {
    params.push(Number(brandId));
    where.push(`p.brand_id = $${params.length}`);
  }

  if (categoryId) {
    params.push(Number(categoryId));
    where.push(`p.category_id = $${params.length}`);
  }

  if (marketplaceId) {
    params.push(Number(marketplaceId));
    where.push(
      `EXISTS (
        SELECT 1
        FROM product_marketplace_identifiers pmi
        WHERE pmi.product_id = p.id
          AND pmi.marketplace_id = $${params.length}
      )`
    );
  }

  const result = await pool.query(
    `
      SELECT
        p.*, 
        b.name AS brand_name,
        c.name AS category_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.created_at DESC, p.id DESC
    `,
    params
  );

  return result.rows;
}

async function fetchMarketplaceIdentifiersMap(productIds) {
  if (!productIds.length) return new Map();

  const result = await pool.query(
    `
      SELECT
        pmi.*,
        m.marketplace_name
      FROM product_marketplace_identifiers pmi
      JOIN marketplaces m ON m.id = pmi.marketplace_id
      WHERE pmi.product_id = ANY($1::int[])
      ORDER BY pmi.product_id ASC, pmi.marketplace_id ASC, pmi.id ASC
    `,
    [productIds]
  );

  const map = new Map();

  for (const row of result.rows) {
    if (!map.has(row.product_id)) {
      map.set(row.product_id, []);
    }

    map.get(row.product_id).push(row);
  }

  return map;
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildExportColumns(marketplaces) {
  return [
    { header: 'id', key: 'id', width: 10 },
    { header: 'stock_code', key: 'stock_code', width: 20 },
    { header: 'name', key: 'name', width: 28 },
    { header: 'description', key: 'description', width: 36 },
    { header: 'barcode', key: 'barcode', width: 18 },
    { header: 'brand', key: 'brand', width: 20 },
    { header: 'category_path', key: 'category_path', width: 28 },
    { header: 'cost', key: 'cost', width: 14 },
    { header: 'sale_price', key: 'sale_price', width: 14 },
    { header: 'list_price', key: 'list_price', width: 14 },
    { header: 'brand_min_price', key: 'brand_min_price', width: 16 },
    { header: 'currency', key: 'currency', width: 12 },
    { header: 'vat_rate', key: 'vat_rate', width: 12 },
    { header: 'status', key: 'status', width: 14 },
    ...marketplaces.flatMap((marketplace) => [
      {
        header: `marketplace_${marketplace.id}_barcode`,
        key: `marketplace_${marketplace.id}_barcode`,
        width: 22,
      },
      {
        header: `marketplace_${marketplace.id}_sku`,
        key: `marketplace_${marketplace.id}_sku`,
        width: 22,
      },
    ]),
  ];
}

function buildExportRows(products, identifiersMap, marketplaces) {
  return products.map((product) => {
    const identifiers = identifiersMap.get(product.id) || [];

    const row = {
      id: product.id,
      stock_code: product.stock_code || '',
      name: product.name || '',
      description: product.description || '',
      barcode: product.barcode || '',
      brand: product.brand_name || '',
      category_path: product.category_name || '',
      cost: toNumberOrNull(product.cost),
      sale_price: toNumberOrNull(product.sale_price),
      list_price: toNumberOrNull(product.list_price),
      brand_min_price: toNumberOrNull(product.brand_min_price),
      currency: product.currency || 'TRY',
      vat_rate: toNumberOrNull(product.vat_rate),
      status: product.status || 'active',
    };

    for (const marketplace of marketplaces) {
      const match = identifiers.find(
        (identifier) => Number(identifier.marketplace_id) === Number(marketplace.id)
      );

      row[`marketplace_${marketplace.id}_barcode`] =
        match?.marketplace_barcode || '';
      row[`marketplace_${marketplace.id}_sku`] = match?.marketplace_sku || '';
    }

    return row;
  });
}

// GET all products (with brand + category info)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const products = await fetchProductsWithDetails();
    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/export
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const products = await fetchProductsWithDetails({
      status: req.query.status,
      brandId: req.query.brand_id,
      categoryId: req.query.category_id,
      marketplaceId: req.query.marketplace_id,
    });

    if (!products.length) {
      return res.status(404).json({ error: 'Dışa aktarılacak ürün bulunamadı' });
    }

    const marketplaces = await fetchMarketplaces();
    const identifiersMap = await fetchMarketplaceIdentifiersMap(
      products.map((product) => product.id)
    );
    const rows = buildExportRows(products, identifiersMap, marketplaces);

    await sendWorkbook(res, {
      filename: `products-${new Date().toISOString().split('T')[0]}.xlsx`,
      sheets: [
        {
          name: 'Ürünler',
          columns: buildExportColumns(marketplaces),
          rows,
        },
      ],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/template
router.get('/template', authMiddleware, async (req, res) => {
  try {
    const marketplaces = await fetchMarketplaces();
    const columns = buildExportColumns(marketplaces);

    await sendWorkbook(res, {
      filename: 'products-template.xlsx',
      sheets: [
        {
          name: 'Ürünler',
          columns,
          rows: [
            {
              stock_code: 'STK-0001',
              name: 'Örnek Ürün',
              description: 'Import şablonu örnek satırı',
              barcode: '8690000000001',
              brand: 'Örnek Marka',
              category_path: 'Elektronik > Telefon > Aksesuar',
              cost: 100,
              sale_price: 129.9,
              list_price: 149.9,
              brand_min_price: 119.9,
              currency: 'TRY',
              vat_rate: 20,
              status: 'active',
            },
          ],
        },
      ],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single product with marketplace identifiers
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const productRes = await pool.query(
      `
        SELECT p.*, b.name AS brand_name, c.name AS category_name
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = $1
      `,
      [id]
    );

    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }

    const identifiersRes = await pool.query(
      `
        SELECT pmi.*, m.marketplace_name
        FROM product_marketplace_identifiers pmi
        JOIN marketplaces m ON pmi.marketplace_id = m.id
        WHERE pmi.product_id = $1
      `,
      [id]
    );

    const product = {
      ...productRes.rows[0],
      marketplace_identifiers: identifiersRes.rows,
    };

    res.json({ product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create product
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      stock_code,
      name,
      description,
      barcode,
      brand_id,
      category_id,
      cost,
      sale_price,
      list_price,
      brand_min_price,
      currency,
      vat_rate,
      status,
      attributes,
      marketplace_identifiers,
    } = req.body;

    if (!stock_code) return res.status(400).json({ error: 'Stok kodu gerekli' });
    if (!name) return res.status(400).json({ error: 'Ürün adı gerekli' });

    await client.query('BEGIN');

    const result = await client.query(
      `
        INSERT INTO products (
          stock_code,
          name,
          description,
          barcode,
          brand_id,
          category_id,
          cost,
          sale_price,
          list_price,
          brand_min_price,
          currency,
          vat_rate,
          status,
          attributes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
      `,
      [
        stock_code,
        name,
        description || null,
        barcode || null,
        brand_id || null,
        category_id || null,
        cost || null,
        sale_price || null,
        list_price || null,
        brand_min_price || null,
        currency || 'TRY',
        vat_rate != null ? vat_rate : 18,
        status || 'active',
        attributes ? JSON.stringify(attributes) : '{}',
      ]
    );

    const product = result.rows[0];

    if (Array.isArray(marketplace_identifiers)) {
      for (const mi of marketplace_identifiers) {
        if (!mi.marketplace_id) continue;

        try {
          await client.query(
            `
              INSERT INTO product_marketplace_identifiers (
                product_id,
                marketplace_id,
                marketplace_barcode,
                marketplace_sku,
                marketplace_product_id,
                is_active
              )
              VALUES ($1,$2,$3,$4,$5,$6)
              ON CONFLICT (marketplace_id, marketplace_barcode)
              DO UPDATE SET
                marketplace_sku = EXCLUDED.marketplace_sku,
                marketplace_product_id = EXCLUDED.marketplace_product_id,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            `,
            [
              product.id,
              mi.marketplace_id,
              mi.marketplace_barcode || null,
              mi.marketplace_sku || null,
              mi.marketplace_product_id || null,
              mi.is_active !== false,
            ]
          );
        } catch (miError) {
          console.warn('Pazaryeri tanımlayıcısı eklenemedi:', miError.message);
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Ürün oluşturuldu', product });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Stok kodu zaten mevcut' });
    }
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// PUT update product
router.put('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      stock_code,
      name,
      description,
      barcode,
      brand_id,
      category_id,
      cost,
      sale_price,
      list_price,
      brand_min_price,
      currency,
      vat_rate,
      status,
      attributes,
      marketplace_identifiers,
    } = req.body;

    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE products
        SET
          stock_code = COALESCE($1, stock_code),
          name = COALESCE($2, name),
          description = $3,
          barcode = $4,
          brand_id = $5,
          category_id = $6,
          cost = $7,
          sale_price = $8,
          list_price = $9,
          brand_min_price = $10,
          currency = COALESCE($11, currency),
          vat_rate = COALESCE($12, vat_rate),
          status = COALESCE($13, status),
          attributes = COALESCE($14::jsonb, attributes),
          updated_at = NOW()
        WHERE id = $15
        RETURNING *
      `,
      [
        stock_code || null,
        name || null,
        description !== undefined ? description : null,
        barcode !== undefined ? barcode : null,
        brand_id !== undefined ? brand_id : null,
        category_id !== undefined ? category_id : null,
        cost !== undefined ? cost : null,
        sale_price !== undefined ? sale_price : null,
        list_price !== undefined ? list_price : null,
        brand_min_price !== undefined ? brand_min_price : null,
        currency || null,
        vat_rate !== undefined ? vat_rate : null,
        status || null,
        attributes ? JSON.stringify(attributes) : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }

    if (Array.isArray(marketplace_identifiers)) {
      await client.query(
        'DELETE FROM product_marketplace_identifiers WHERE product_id = $1',
        [id]
      );

      for (const mi of marketplace_identifiers) {
        if (!mi.marketplace_id) continue;

        try {
          await client.query(
            `
              INSERT INTO product_marketplace_identifiers (
                product_id,
                marketplace_id,
                marketplace_barcode,
                marketplace_sku,
                marketplace_product_id,
                is_active
              )
              VALUES ($1,$2,$3,$4,$5,$6)
              ON CONFLICT (marketplace_id, marketplace_barcode)
              DO UPDATE SET
                marketplace_sku = EXCLUDED.marketplace_sku,
                marketplace_product_id = EXCLUDED.marketplace_product_id,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            `,
            [
              id,
              mi.marketplace_id,
              mi.marketplace_barcode || null,
              mi.marketplace_sku || null,
              mi.marketplace_product_id || null,
              mi.is_active !== false,
            ]
          );
        } catch (miError) {
          console.warn('Pazaryeri tanımlayıcısı eklenemedi:', miError.message);
        }
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Ürün güncellendi', product: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Stok kodu zaten mevcut' });
    }
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE product
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }

    res.json({ message: 'Ürün silindi', id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
