const express = require('express');
const router = express.Router();

// GET all orders
router.get('/', async (req, res) => {
  try {
    res.json({ message: 'Tüm siparişler' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET order by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ message: 'Sipariş detayı', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update order
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ message: 'Sipariş güncellendi', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;