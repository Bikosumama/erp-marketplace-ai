const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

const authenticateToken = require('./middleware/auth');

function createApp() {
  const app = express();

  app.use(helmet());

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://erp-marketplace-ai.vercel.app',
      ];

  const allowedOriginPatterns = [/^https:\/\/erp-marketplace-ai.*\.vercel\.app$/];

  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        allowedOriginPatterns.some((pattern) => pattern.test(origin));

      if (isAllowed) return callback(null, true);
      return callback(new Error(`CORS: ${origin} adresine izin verilmiyor`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));

  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));

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

  app.get('/api/health', async (req, res) => {
    try {
      const pool = require('./config/database');
      await pool.query('SELECT 1');
      res.json({ status: 'OK', message: 'Server is running', db: 'connected' });
    } catch (err) {
      res
        .status(503)
        .json({ status: 'ERROR', message: 'DB bağlantısı yok', db: 'disconnected' });
    }
  });

  app.use('/api/auth', authLimiter, require('./routes/auth'));
  app.use('/api/products/import', authenticateToken, require('./routes/product-import'));
  app.use('/api/products', authenticateToken, require('./routes/products'));
  app.use('/api/orders', authenticateToken, require('./routes/orders'));
  app.use('/api/marketplaces', authenticateToken, require('./routes/marketplaces'));
  app.use('/api/price-analysis', authenticateToken, require('./routes/price-analysis'));
  app.use('/api/brands', authenticateToken, require('./routes/brands'));
  app.use('/api/categories', authenticateToken, require('./routes/categories'));
  app.use('/api/rules', authenticateToken, require('./routes/rules'));

  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
  });

  app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] ${err.stack}`);

    if (err.message?.startsWith('CORS:')) {
      return res.status(403).json({ error: err.message });
    }

    const status = err.status || err.statusCode || 500;
    const message =
      process.env.NODE_ENV === 'production' ? 'Sunucu hatası' : err.message;
    res.status(status).json({ error: message });
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });

  return app;
}

module.exports = createApp();

