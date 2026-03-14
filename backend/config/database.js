const { Pool } = require('pg');

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

let poolConfig;

if (hasDatabaseUrl) {
  // Render / production style
  // rejectUnauthorized: false is required for many managed Postgres SSL cert chains.
  // Set PGSSLMODE=disable only in local development without SSL.
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  };
} else {
  console.warn(
    'WARNING: DATABASE_URL is not set. Falling back to DB_* environment variables.',
  );

  // Local / legacy style (defaults aligned with .env.example)
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'erp_marketplace_ai',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  };
}

const pool = new Pool(poolConfig);

module.exports = pool;