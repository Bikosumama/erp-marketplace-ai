const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// In-memory price analysis store (replace with DB in production)
let priceHistory = [];

const defaultRecommendations = [
  {
    product_id: 1,
    current_price: 100,
    recommended_price: 105,
    reason: 'Kar marjı artırılabilir',
    confidence: 0.85,
  },
];

// GET price recommendations
router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    res.json({ recommendations: defaultRecommendations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET price history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    res.json({ history: priceHistory });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST analyze prices
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const { product_id, marketplace_id } = req.body;
    res.json({ message: 'Fiyat analizi yapılıyor', product_id, marketplace_id, recommendations: defaultRecommendations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST apply price recommendation
router.post('/:id/apply', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rec = defaultRecommendations.find((r) => r.product_id === id);
    if (rec) {
      priceHistory.push({
        product_id: id,
        old_price: rec.current_price,
        new_price: rec.recommended_price,
        date: new Date().toISOString(),
      });
    }
    res.json({ message: 'Fiyat önerisi uygulandı', product_id: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;