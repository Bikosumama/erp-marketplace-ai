const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// GET all products (with brand + category info)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        b.name AS brand_name,
        c.name AS category_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
    `);
    res.json({ products: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single product with marketplace identifiers
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const productRes = await pool.query(`
      SELECT p.*,
        b.name AS brand_name,
        c.name AS category_name
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `, [id]);
    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }
    const identifiersRes = await pool.query(`
      SELECT pmi.*, m.marketplace_name
      FROM product_marketplace_identifiers pmi
      JOIN marketplaces m ON pmi.marketplace_id = m.id
      WHERE pmi.product_id = $1
    `, [id]);
    const product = { ...productRes.rows[0], marketplace_identifiers: identifiersRes.rows };
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
      stock_code, name, description, barcode,
      brand_id, category_id,
      cost, sale_price, list_price, brand_min_price, currency, vat_rate,
      status, attributes,
      marketplace_identifiers,
    } = req.body;

    if (!stock_code) return res.status(400).json({ error: 'Stok kodu gerekli' });
    if (!name) return res.status(400).json({ error: 'Ürün adı gerekli' });

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO products
        (stock_code, name, description, barcode, brand_id, category_id,
         cost, sale_price, list_price, brand_min_price, currency, vat_rate, status, attributes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      stock_code, name, description || null, barcode || null,
      brand_id || null, category_id || null,
      cost || null, sale_price || null, list_price || null, brand_min_price || null,
      currency || 'TRY', vat_rate != null ? vat_rate : 18,
      status || 'active',
      attributes ? JSON.stringify(attributes) : '{}',
    ]);

    const product = result.rows[0];

    if (Array.isArray(marketplace_identifiers)) {
      for (const mi of marketplace_identifiers) {
        if (!mi.marketplace_id) continue;
        try {
          await client.query(`
            INSERT INTO product_marketplace_identifiers
              (product_id, marketplace_id, marketplace_barcode, marketplace_sku, marketplace_product_id, is_active)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (marketplace_id, marketplace_barcode) DO UPDATE SET
              marketplace_sku = EXCLUDED.marketplace_sku,
              marketplace_product_id = EXCLUDED.marketplace_product_id,
              is_active = EXCLUDED.is_active,
              updated_at = NOW()
          `, [
            product.id, mi.marketplace_id,
            mi.marketplace_barcode || null,
            mi.marketplace_sku || null,
            mi.marketplace_product_id || null,
            mi.is_active !== false,
          ]);
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
      stock_code, name, description, barcode,
      brand_id, category_id,
      cost, sale_price, list_price, brand_min_price, currency, vat_rate,
      status, attributes,
      marketplace_identifiers,
    } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE products SET
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
    `, [
      stock_code || null, name || null,
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
    ]);

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
          await client.query(`
            INSERT INTO product_marketplace_identifiers
              (product_id, marketplace_id, marketplace_barcode, marketplace_sku, marketplace_product_id, is_active)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (marketplace_id, marketplace_barcode) DO UPDATE SET
              marketplace_sku = EXCLUDED.marketplace_sku,
              marketplace_product_id = EXCLUDED.marketplace_product_id,
              is_active = EXCLUDED.is_active,
              updated_at = NOW()
          `, [
            id, mi.marketplace_id,
            mi.marketplace_barcode || null,
            mi.marketplace_sku || null,
            mi.marketplace_product_id || null,
            mi.is_active !== false,
          ]);
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