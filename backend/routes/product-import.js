const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece XLSX, XLS veya CSV dosyaları desteklenir'));
    }
  },
});

async function parseFile(file) {
  const isCSV = file.originalname.match(/\.csv$/i) || file.mimetype === 'text/csv' || file.mimetype === 'text/plain';

  const workbook = new ExcelJS.Workbook();

  if (isCSV) {
    const stream = Readable.from(file.buffer.toString('utf-8'));
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(file.buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Dosyada sayfa bulunamadı');

  const headers = [];
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => headers.push(String(cell.value || '').trim()));
    } else if (rowNumber <= 21) {
      const rowData = {};
      headers.forEach((h, i) => {
        const cell = row.getCell(i + 1);
        rowData[h] = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
      });
      rows.push(rowData);
    }
  });

  return { headers, rows };
}

// POST /api/products/import/preview
// Accept file upload and return detected columns + sample rows
router.post('/preview', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya gerekli' });
    const { headers, rows } = await parseFile(req.file);
    res.json({ headers, sample_rows: rows });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/products/import/commit
// Accept mapping + file and write to DB
router.post('/commit', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya gerekli' });

    let mapping;
    try {
      mapping = JSON.parse(req.body.mapping || '{}');
    } catch {
      return res.status(400).json({ error: 'Geçersiz mapping JSON formatı' });
    }

    const workbook = new ExcelJS.Workbook();
    const isCSV = req.file.originalname.match(/\.csv$/i) || req.file.mimetype === 'text/csv' || req.file.mimetype === 'text/plain';

    if (isCSV) {
      const stream = Readable.from(req.file.buffer.toString('utf-8'));
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return res.status(400).json({ error: 'Dosyada sayfa bulunamadı' });

    const headers = [];
    const dataRows = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => headers.push(String(cell.value || '').trim()));
      } else {
        const rowData = {};
        headers.forEach((h, i) => {
          const cell = row.getCell(i + 1);
          rowData[h] = cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '';
        });
        dataRows.push(rowData);
      }
    });

    const get = (row, field) => {
      if (!mapping[field]) return '';
      return (row[mapping[field]] || '').trim();
    };

    // Collect marketplace column mappings (keys like "marketplace_<id>_barcode", "marketplace_<id>_sku")
    const marketplaceMappings = [];
    for (const [key, colName] of Object.entries(mapping)) {
      const m = key.match(/^marketplace_(\d+)_(barcode|sku)$/);
      if (m) {
        marketplaceMappings.push({ marketplace_id: parseInt(m[1], 10), field: m[2], colName });
      }
    }

    const client = await pool.connect();
    const results = { created: 0, updated: 0, errors: [] };

    try {
      for (const [rowIdx, row] of dataRows.entries()) {
        const stock_code = get(row, 'stock_code');
        const name = get(row, 'name');

        if (!stock_code || !name) {
          results.errors.push({ row: rowIdx + 2, error: 'stock_code ve name zorunlu' });
          continue;
        }

        try {
          await client.query('BEGIN');

          // Resolve brand
          let brand_id = null;
          const brandName = get(row, 'brand');
          if (brandName) {
            const bRes = await client.query(
              'INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
              [brandName]
            );
            brand_id = bRes.rows[0].id;
          }

          // Resolve category path
          let category_id = null;
          const categoryPath = get(row, 'category_path');
          if (categoryPath) {
            const parts = categoryPath.split('>').map((p) => p.trim()).filter(Boolean);
            let parentId = null;
            for (const part of parts) {
              const cRes = await client.query(
                `INSERT INTO categories (name, parent_id) VALUES ($1, $2)
                 ON CONFLICT (name, parent_id) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
                [part, parentId]
              );
              parentId = cRes.rows[0].id;
              category_id = parentId;
            }
          }

          const fields = {
            stock_code,
            name,
            description: get(row, 'description') || null,
            barcode: get(row, 'barcode') || null,
            brand_id,
            category_id,
            cost: get(row, 'cost') ? parseFloat(get(row, 'cost')) : null,
            sale_price: get(row, 'sale_price') ? parseFloat(get(row, 'sale_price')) : null,
            list_price: get(row, 'list_price') ? parseFloat(get(row, 'list_price')) : null,
            currency: get(row, 'currency') || 'TRY',
            vat_rate: get(row, 'vat_rate') ? parseFloat(get(row, 'vat_rate')) : 18,
            status: get(row, 'status') || 'active',
          };

          const existing = await client.query('SELECT id FROM products WHERE stock_code = $1', [stock_code]);

          let productId;
          if (existing.rows.length > 0) {
            productId = existing.rows[0].id;
            await client.query(`
              UPDATE products SET
                name=$1, description=$2, barcode=$3, brand_id=$4, category_id=$5,
                cost=$6, sale_price=$7, list_price=$8, currency=$9, vat_rate=$10,
                status=$11, updated_at=NOW()
              WHERE id=$12
            `, [
              fields.name, fields.description, fields.barcode, fields.brand_id, fields.category_id,
              fields.cost, fields.sale_price, fields.list_price, fields.currency, fields.vat_rate,
              fields.status, productId,
            ]);
            results.updated++;
          } else {
            const insRes = await client.query(`
              INSERT INTO products
                (stock_code, name, description, barcode, brand_id, category_id,
                 cost, sale_price, list_price, currency, vat_rate, status)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
              RETURNING id
            `, [
              fields.stock_code, fields.name, fields.description, fields.barcode,
              fields.brand_id, fields.category_id,
              fields.cost, fields.sale_price, fields.list_price,
              fields.currency, fields.vat_rate, fields.status,
            ]);
            productId = insRes.rows[0].id;
            results.created++;
          }

          // Handle marketplace identifiers
          for (const mp of marketplaceMappings) {
            const value = (row[mp.colName] || '').trim();
            if (!value) continue;
            if (mp.field === 'barcode') {
              await client.query(`
                INSERT INTO product_marketplace_identifiers (product_id, marketplace_id, marketplace_barcode)
                VALUES ($1,$2,$3)
                ON CONFLICT (marketplace_id, marketplace_barcode) DO UPDATE SET marketplace_barcode=EXCLUDED.marketplace_barcode
              `, [productId, mp.marketplace_id, value]);
            } else if (mp.field === 'sku') {
              await client.query(`
                INSERT INTO product_marketplace_identifiers (product_id, marketplace_id, marketplace_sku)
                VALUES ($1,$2,$3)
                ON CONFLICT (marketplace_id, marketplace_sku) DO UPDATE SET marketplace_sku=EXCLUDED.marketplace_sku
              `, [productId, mp.marketplace_id, value]);
            }
          }

          await client.query('COMMIT');
        } catch (rowError) {
          await client.query('ROLLBACK');
          results.errors.push({ row: rowIdx + 2, error: rowError.message });
        }
      }
    } finally {
      client.release();
    }

    res.json({
      message: 'İçe aktarma tamamlandı',
      created: results.created,
      updated: results.updated,
      errors: results.errors,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
