const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Database features will fail.');
}

// PostgreSQL connection pool using Render DATABASE_URL
// rejectUnauthorized: false is required for Render's managed Postgres SSL certificates.
// Set PGSSLMODE=disable only in local development without SSL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

module.exports = pool;