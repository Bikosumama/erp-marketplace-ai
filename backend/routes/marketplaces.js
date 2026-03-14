const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// In-memory marketplace store (replace with DB in production)
let marketplaces = [];
let nextId = 1;

// GET all marketplace accounts
router.get('/', authMiddleware, async (req, res) => {
  try {
    res.json({ marketplaces });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add marketplace account
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { marketplace_name, api_key, api_secret } = req.body;
    if (!marketplace_name) return res.status(400).json({ error: 'Pazaryeri adı gerekli' });
    const marketplace = {
      id: nextId++,
      marketplace_name,
      api_key: api_key || '',
      api_secret: api_secret || '',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    marketplaces.push(marketplace);
    res.status(201).json({ message: 'Pazaryeri hesabı eklendi', marketplace });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE marketplace account
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const idx = marketplaces.findIndex((m) => m.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Pazaryeri bulunamadı' });
    marketplaces.splice(idx, 1);
    res.json({ message: 'Pazaryeri silindi', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST sync products with marketplace
router.post('/:id/sync', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const marketplace = marketplaces.find((m) => m.id === id);
    if (!marketplace) return res.status(404).json({ error: 'Pazaryeri bulunamadı' });
    res.json({ message: 'Ürünler senkronize ediliyor', marketplace_id: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;