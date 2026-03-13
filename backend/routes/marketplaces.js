const express = require('express');
const router = express.Router();

// GET all marketplace accounts
router.get('/', async (req, res) => {
  try {
    res.json({ 
      message: 'Pazaryeri hesapları',
      marketplaces: ['Trendyol', 'Hepsiburada', 'Amazon Türkiye', 'N11', 'İdefix', 'Pazarama']
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add marketplace account
router.post('/', async (req, res) => {
  try {
    const { marketplace_name, api_key, api_secret } = req.body;
    res.json({ message: 'Pazaryeri hesabı eklendi', data: req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST sync products with marketplace
router.post('/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ message: 'Ürünler senkronize ediliyor', marketplace_id: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;