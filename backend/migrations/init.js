const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mydatabase',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Brands
    await client.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Categories (self-referencing tree)
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (name, parent_id)
      );
    `);

    // Marketplaces
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

    // Products (ERP master)
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
     -- Brands tablosu için unique index
      CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_name ON brands (LOWER(name));

     -- Categories tablosu için NULL-safe unique index
     CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_parent 
     ON categories (LOWER(name), COALESCE(parent_id, -1));
    // Product marketplace identifiers (0..N per product per marketplace)
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

    // Marketplace accounts (legacy compat: kept for existing orders/accounts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_accounts (
        id SERIAL PRIMARY KEY,
        platform_name VARCHAR(50) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Orders
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
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

init();


