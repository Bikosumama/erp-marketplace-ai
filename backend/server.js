// Migration'ı otomatik çalıştır
require('./migrations/init.js');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'BULUNDU' : 'YOK');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

dotenv.config();
// Tabloları otomatik oluştur
const initDB = require('./migrations/init.js');
initDB().then(() => console.log('DB hazır')).catch(console.error);

const app = express();

// ✅ Güvenlik header'ları
app.use(helmet());

// ✅ CORS - sadece izin verilen originlere
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Postman/sunucu istekleri için origin olmayabilir
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: ${origin} adresine izin verilmiyor`));
    }
  },
  credentials: true,
}));

// ✅ Loglama
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '10mb' }));

// Rate limiter'lar
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderildi, lütfen bekleyin.' },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi, lütfen bekleyin.' },
});

// ✅ Auth middleware
const authenticateToken = require('./middleware/auth');

// Health check - DB bağlantısını da kontrol eder
app.get('/api/health', async (req, res) => {
  try {
    const { pool } = require('./db');
    await pool.query('SELECT 1');
    res.json({ status: 'OK', message: 'Server is running', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'ERROR', message: 'DB bağlantısı yok', db: 'disconnected' });
  }
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/products/import', authenticateToken, require('./routes/product-import')); // ✅ Auth eklendi
app.use('/api/products', authenticateToken, require('./routes/products'));
app.use('/api/orders', authenticateToken, require('./routes/orders'));
app.use('/api/marketplaces', authenticateToken, require('./routes/marketplaces'));
app.use('/api/price-analysis', authenticateToken, require('./routes/price-analysis'));
app.use('/api/brands', authenticateToken, require('./routes/brands'));
app.use('/api/categories', authenticateToken, require('./routes/categories'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// ✅ Global error handler - detaylı
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${err.stack}`);

  // CORS hatasını özel yakala
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }

  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Sunucu hatası'
    : err.message;

  res.status(status).json({ error: message });
});

// ✅ Unhandled hataları yakala - sunucu çökmesini önle
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// ✅ Graceful shutdown
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor [${process.env.NODE_ENV || 'development'}]`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM alındı, sunucu kapatılıyor...');
  server.close(() => {
    console.log('Sunucu kapatıldı.');
    process.exit(0);
  });
});

module.exports = app;
