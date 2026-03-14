'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_in_production';

// In-memory user store (replace with DB in production)
const users = [];

// Register endpoint
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli' });
  }
  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = { id: users.length + 1, name: name || '', email, password: hashed };
  users.push(user);
  res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi' });
});

// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli' });
  }
  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Geçersiz e-posta veya şifre' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: '24h',
  });
  res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.status(200).json({ message: 'Başarıyla çıkış yapıldı' });
});

module.exports = router;