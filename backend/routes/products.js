const express = require('express');
const router = express.Router();

// GET all products
router.get('/', async (req, res) => {
  try {
    // Query database for products
    res.json({ message: 'Tüm ürünler' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new product
router.post('/', async (req, res) => {
  try {
    const { name, description, cost, sku } = req.body;
    // Insert product to database
    res.json({ message: 'Ürün oluşturuldu', data: req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Update product in database
    res.json({ message: 'Ürün güncellendi', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Delete product from database
    res.json({ message: 'Ürün silindi', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;