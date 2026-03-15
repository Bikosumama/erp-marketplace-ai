const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        user: process.env.DB_USER || 'user',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'mydatabase',
        password: process.env.DB_PASSWORD || 'password',
        port: parseInt(process.env.DB_PORT || '5432', 10),
      }
);

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (name, parent_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplaces (
        id SERIAL PRIMARY KEY,
        marketplace_name VARCHAR(100) NOT NULL UNIQUE,
        api_key TEXT,
        api_secret TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        stock_code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        barcode VARCHAR(100),
        brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        cost NUMERIC(15, 4),
        sale_price NUMERIC(15, 4),
        list_price NUMERIC(15, 4),
        currency VARCHAR(10) DEFAULT 'TRY',
        vat_rate NUMERIC(5, 2) DEFAULT 18,
        status VARCHAR(20) DEFAULT 'active',
        attributes JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_stock_code ON products(stock_code);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_name ON brands (LOWER(name));
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_parent 
      ON categories (LOWER(name), COALESCE(parent_id, -1));
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_marketplace_identifiers (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        marketplace_id INTEGER NOT NULL REFERENCES marketplaces(id) ON DELETE CASCADE,
        marketplace_barcode VARCHAR(200),
        marketplace_sku VARCHAR(200),
        marketplace_product_id VARCHAR(200),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (marketplace_id, marketplace_barcode),
        UNIQUE (marketplace_id, marketplace_sku)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pmi_product_id ON product_marketplace_identifiers(product_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_accounts (
        id SERIAL PRIMARY KEY,
        platform_name VARCHAR(50) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        order_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Tables created/verified successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', err);
  } finally {
    client.release();
    // pool.end() KALDIRILDI - server.js pool'u kullanmaya devam edecek
  }
}

module.exports = init;
