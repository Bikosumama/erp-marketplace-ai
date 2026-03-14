const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// In-memory order store (replace with DB in production)
let orders = [];
let nextId = 1;

// GET all orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET order by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = orders.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create new order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { marketplace, customer, total, status } = req.body;
    const order = {
      id: nextId++,
      marketplace: marketplace || '',
      customer: customer || '',
      total: total || 0,
      status: status || 'pending',
      created_at: new Date().toISOString(),
    };
    orders.push(order);
    res.status(201).json({ message: 'Sipariş oluşturuldu', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update order
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    orders[idx] = { ...orders[idx], ...req.body, id };
    res.json({ message: 'Sipariş güncellendi', order: orders[idx] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE order
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    orders.splice(idx, 1);
    res.json({ message: 'Sipariş silindi', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;