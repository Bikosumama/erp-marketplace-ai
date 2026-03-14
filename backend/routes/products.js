const express = require('express');
const router = express.Router();

// GET all products
router.get('/', async (req, res) => {
  try {
    // Query database for products
    res.json({ products: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new product
router.post('/', async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ error: 'name, price and stock are required' });
    }
    // Insert product to database
    const product = { id: Date.now(), name, description, price, stock };
    res.status(201).json({ message: 'Ürün oluşturuldu', product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock } = req.body;
    // Update product in database
    res.json({ message: 'Ürün güncellendi', product: { id, name, description, price, stock } });
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