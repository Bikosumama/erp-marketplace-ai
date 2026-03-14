const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// GET all categories (flat list with parent info for tree building in client)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, p.name AS parent_name
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY c.parent_id NULLS FIRST, c.name
    `);
    res.json({ categories: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create category
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Kategori adı gerekli' });
    const result = await pool.query(
      `INSERT INTO categories (name, parent_id) VALUES ($1, $2)
       ON CONFLICT (name, parent_id) DO UPDATE SET name=EXCLUDED.name RETURNING *`,
      [name, parent_id || null]
    );
    res.status(201).json({ message: 'Kategori oluşturuldu', category: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST find or create category by path (e.g. "Elektronik > Telefon > Aksesuar")
router.post('/resolve-path', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'Kategori yolu gerekli' });

    const parts = path.split('>').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return res.status(400).json({ error: 'Geçersiz kategori yolu' });

    await client.query('BEGIN');
    let parentId = null;
    let lastCategory = null;
    for (const part of parts) {
      const result = await client.query(
        `INSERT INTO categories (name, parent_id) VALUES ($1, $2)
         ON CONFLICT (name, parent_id) DO UPDATE SET name=EXCLUDED.name RETURNING *`,
        [part, parentId]
      );
      lastCategory = result.rows[0];
      parentId = lastCategory.id;
    }
    await client.query('COMMIT');
    res.json({ category: lastCategory });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE category
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kategori bulunamadı' });
    }
    res.json({ message: 'Kategori silindi', id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
