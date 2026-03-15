const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SQLite veritabanı bağlantısı
const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ SQLite bağlantı hatası:', err);
  }
});

// Veritabanı tablosunu oluştur
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      marketplace TEXT,
      items_count INTEGER DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Orders tablosu oluşturma hatası:', err);
    } else {
      console.log('✅ Orders tablosu hazır');
    }
  });
});

// GET all orders
router.get('/', (req, res) => {
  try {
    db.all('SELECT * FROM orders ORDER BY id DESC', (err, rows) => {
      if (err) {
        console.error('❌ GET /api/orders error:', err);
        return res.status(500).json({ error: err.message });
      }
      console.log('✅ GET /api/orders - Found', rows.length, 'orders');
      res.json(rows);
    });
  } catch (error) {
    console.error('❌ GET /api/orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new order
router.post('/', (req, res) => {
  try {
    const { order_number, customer_name, customer_email, total_price, status, marketplace, items_count, notes } = req.body;

    console.log('📝 POST /api/orders - Received:', req.body);

    // Validation
    if (!order_number || !customer_name || !customer_email || total_price === undefined) {
      return res.status(400).json({ 
        error: 'order_number, customer_name, customer_email, total_price are required' 
      });
    }

    const query = `
      INSERT INTO orders (order_number, customer_name, customer_email, total_price, status, marketplace, items_count, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      order_number,
      customer_name,
      customer_email,
      parseFloat(total_price),
      status || 'pending',
      marketplace || null,
      parseInt(items_count) || 1,
      notes || null
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('❌ POST /api/orders error:', err);
        return res.status(500).json({ error: err.message });
      }
      
      const newOrder = {
        id: this.lastID,
        ...req.body,
        total_price: parseFloat(total_price)
      };
      
      console.log('✅ POST /api/orders - Order created:', newOrder);
      res.status(201).json(newOrder);
    });
  } catch (error) {
    console.error('❌ POST /api/orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update order
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { order_number, customer_name, customer_email, total_price, status, marketplace, items_count, notes } = req.body;

    const updates = [];
    const values = [];

    if (order_number !== undefined) { updates.push('order_number = ?'); values.push(order_number); }
    if (customer_name !== undefined) { updates.push('customer_name = ?'); values.push(customer_name); }
    if (customer_email !== undefined) { updates.push('customer_email = ?'); values.push(customer_email); }
    if (total_price !== undefined) { updates.push('total_price = ?'); values.push(parseFloat(total_price)); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (marketplace !== undefined) { updates.push('marketplace = ?'); values.push(marketplace); }
    if (items_count !== undefined) { updates.push('items_count = ?'); values.push(parseInt(items_count)); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, values, function(err) {
      if (err) {
        console.error('❌ PUT /api/orders/:id error:', err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        console.log('✅ PUT /api/orders/:id - Order updated:', row);
        res.json(row);
      });
    });
  } catch (error) {
    console.error('❌ PUT /api/orders/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE order
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    db.run('DELETE FROM orders WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('❌ DELETE /api/orders/:id error:', err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      console.log('✅ DELETE /api/orders/:id - Order deleted:', id);
      res.json({ message: 'Order deleted', id });
    });
  } catch (error) {
    console.error('❌ DELETE /api/orders/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;