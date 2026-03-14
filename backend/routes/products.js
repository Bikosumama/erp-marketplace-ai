const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// In-memory product store (replace with DB in production)
let products = [];
let nextId = 1;

// GET all products
router.get('/', authMiddleware, async (req, res) => {
  try {
    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new product
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, cost, sku } = req.body;
    if (!name) return res.status(400).json({ error: 'Ürün adı gerekli' });
    const product = { id: nextId++, name, description: description || '', cost: cost || null, sku: sku || '' };
    products.push(product);
    res.status(201).json({ message: 'Ürün oluşturuldu', product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update product
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Ürün bulunamadı' });
    products[idx] = { ...products[idx], ...req.body, id };
    res.json({ message: 'Ürün güncellendi', product: products[idx] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE product
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Ürün bulunamadı' });
    products.splice(idx, 1);
    res.json({ message: 'Ürün silindi', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;