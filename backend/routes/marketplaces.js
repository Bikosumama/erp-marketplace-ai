const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// GET all marketplaces
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM marketplaces ORDER BY marketplace_name');
    res.json({ marketplaces: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add marketplace
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { marketplace_name, api_key, api_secret } = req.body;
    if (!marketplace_name) return res.status(400).json({ error: 'Pazaryeri adı gerekli' });
    const result = await pool.query(`
      INSERT INTO marketplaces (marketplace_name, api_key, api_secret)
      VALUES ($1, $2, $3)
      ON CONFLICT (marketplace_name) DO UPDATE SET
        api_key = EXCLUDED.api_key,
        api_secret = EXCLUDED.api_secret
      RETURNING *
    `, [marketplace_name, api_key || null, api_secret || null]);
    res.status(201).json({ message: 'Pazaryeri eklendi', marketplace: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE marketplace
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM marketplaces WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pazaryeri bulunamadı' });
    }
    res.json({ message: 'Pazaryeri silindi', id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST sync products with marketplace (stub)
router.post('/:id/sync', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM marketplaces WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pazaryeri bulunamadı' });
    }
    res.json({ message: 'Ürünler senkronize ediliyor', marketplace_id: parseInt(id, 10) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;