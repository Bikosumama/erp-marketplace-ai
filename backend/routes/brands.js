const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// GET all brands
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands ORDER BY name');
    res.json({ brands: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create brand
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Marka adı gerekli' });
    const result = await pool.query(
      'INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING *',
      [name]
    );
    res.status(201).json({ message: 'Marka oluşturuldu', brand: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE brand
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM brands WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Marka bulunamadı' });
    }
    res.json({ message: 'Marka silindi', id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
