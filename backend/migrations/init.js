const pool = require('../config/database');

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) DEFAULT '',
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100) DEFAULT '';`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT '';`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100);`);

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
        brand_min_price NUMERIC(15, 4) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'TRY',
        vat_rate NUMERIC(5, 2) DEFAULT 18,
        status VARCHAR(20) DEFAULT 'active',
        attributes JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_code VARCHAR(100);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC(15, 4);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(15, 4);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS list_price NUMERIC(15, 4);`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_min_price NUMERIC(15, 4) DEFAULT 0;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TRY';`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) DEFAULT 18;`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);

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
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        order_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
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
      CREATE TABLE IF NOT EXISTS marketplace_rules (
        id SERIAL PRIMARY KEY,
        scope_type VARCHAR(30) DEFAULT 'marketplace',
        marketplace_id INTEGER REFERENCES marketplaces(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        priority INTEGER DEFAULT 0,
        minimum_profit_margin NUMERIC(8,2) DEFAULT 10,
        target_profit_margin NUMERIC(8,2) DEFAULT 15,
        min_margin_rate NUMERIC(8,2) DEFAULT 10,
        target_margin_rate NUMERIC(8,2) DEFAULT 15,
        commission_rate NUMERIC(8,2) DEFAULT 18,
        commission_base VARCHAR(30) DEFAULT 'net_ex_vat',
        vat_rate NUMERIC(8,2) DEFAULT 20,
        fixed_fee NUMERIC(12,2) DEFAULT 0,
        marketplace_discount_rate NUMERIC(8,2) DEFAULT 0,
        marketplace_discount_funded BOOLEAN DEFAULT FALSE,
        rounding_ending NUMERIC(8,2) DEFAULT 0.90,
        is_active BOOLEAN DEFAULT TRUE,
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS scope_type VARCHAR(30) DEFAULT 'marketplace';`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS min_margin_rate NUMERIC(8,2) DEFAULT 10;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS target_margin_rate NUMERIC(8,2) DEFAULT 15;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS commission_base VARCHAR(30) DEFAULT 'net_ex_vat';`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS marketplace_discount_rate NUMERIC(8,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS marketplace_discount_funded BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS rounding_ending NUMERIC(8,2) DEFAULT 0.90;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP;`);
    await client.query(`ALTER TABLE marketplace_rules ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await client.query(`ALTER TABLE marketplace_rules DROP CONSTRAINT IF EXISTS marketplace_rules_marketplace_id_key;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shipping_rules (
        id SERIAL PRIMARY KEY,
        scope_type VARCHAR(30) DEFAULT 'marketplace',
        marketplace_id INTEGER REFERENCES marketplaces(id) ON DELETE CASCADE,
        min_price NUMERIC(12,2) DEFAULT 0,
        max_price NUMERIC(12,2),
        shipping_cost NUMERIC(12,2) DEFAULT 0,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS scope_type VARCHAR(30) DEFAULT 'marketplace';`);
    await client.query(`ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;`);
    await client.query(`ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;`);
    await client.query(`ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP;`);
    await client.query(`ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS notes TEXT;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS profit_targets (
        id SERIAL PRIMARY KEY,
        scope_type VARCHAR(30) DEFAULT 'category',
        marketplace_id INTEGER REFERENCES marketplaces(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        priority INTEGER DEFAULT 0,
        min_profit_margin NUMERIC(8,2) DEFAULT 10,
        target_profit_margin NUMERIC(8,2) DEFAULT 18,
        min_margin_rate NUMERIC(8,2) DEFAULT 10,
        target_margin_rate NUMERIC(8,2) DEFAULT 18,
        is_active BOOLEAN DEFAULT TRUE,
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS scope_type VARCHAR(30) DEFAULT 'category';`);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS marketplace_id INTEGER REFERENCES marketplaces(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;`);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS min_margin_rate NUMERIC(8,2) DEFAULT 10;`);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS target_margin_rate NUMERIC(8,2) DEFAULT 18;`);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP;`);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP;`);
    await client.query(`ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await client.query(`ALTER TABLE profit_targets DROP CONSTRAINT IF EXISTS profit_targets_category_id_key;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_extra_deductions (
        id SERIAL PRIMARY KEY,
        marketplace_rule_id INTEGER REFERENCES marketplace_rules(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        deduction_type VARCHAR(50) DEFAULT 'other',
        calculation_type VARCHAR(30) DEFAULT 'percentage',
        base_amount_type VARCHAR(30) DEFAULT 'net_ex_vat',
        rate NUMERIC(8,4) DEFAULT 0,
        fixed_amount NUMERIC(12,2) DEFAULT 0,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS competitor_prices (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        marketplace_id INTEGER REFERENCES marketplaces(id) ON DELETE SET NULL,
        competitor_name VARCHAR(120),
        competitor_price NUMERIC(12,2) NOT NULL,
        source VARCHAR(120),
        observed_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS price_recommendations (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        marketplace_id INTEGER REFERENCES marketplaces(id) ON DELETE SET NULL,
        current_price NUMERIC(12,2) DEFAULT 0,
        recommended_price NUMERIC(12,2) DEFAULT 0,
        floor_price NUMERIC(12,2) DEFAULT 0,
        target_price NUMERIC(12,2) DEFAULT 0,
        protected_floor NUMERIC(12,2) DEFAULT 0,
        brand_min_price NUMERIC(12,2) DEFAULT 0,
        marketplace_discount_rate NUMERIC(8,2) DEFAULT 0,
        discount_adjusted_protected_price NUMERIC(12,2) DEFAULT 0,
        customer_seen_price NUMERIC(12,2) DEFAULT 0,
        shipping_cost NUMERIC(12,2) DEFAULT 0,
        commission_amount NUMERIC(12,2) DEFAULT 0,
        extra_deductions_total NUMERIC(12,2) DEFAULT 0,
        competitor_price NUMERIC(12,2),
        current_margin_rate NUMERIC(8,2) DEFAULT 0,
        projected_margin_rate NUMERIC(8,2) DEFAULT 0,
        profit_margin NUMERIC(12,2) DEFAULT 0,
        recommendation_type VARCHAR(30) DEFAULT 'hold',
        risk_level VARCHAR(20) DEFAULT 'low',
        confidence NUMERIC(5,2) DEFAULT 0,
        quality_score INTEGER DEFAULT 0,
        reason_text TEXT,
        metadata JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP,
        applied_at TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE price_recommendations ADD COLUMN IF NOT EXISTS protected_floor NUMERIC(12,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE price_recommendations ADD COLUMN IF NOT EXISTS brand_min_price NUMERIC(12,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE price_recommendations ADD COLUMN IF NOT EXISTS marketplace_discount_rate NUMERIC(8,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE price_recommendations ADD COLUMN IF NOT EXISTS discount_adjusted_protected_price NUMERIC(12,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE price_recommendations ADD COLUMN IF NOT EXISTS customer_seen_price NUMERIC(12,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE price_recommendations ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE price_recommendations ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE price_recommendations ADD COLUMN IF NOT EXISTS extra_deductions_total NUMERIC(12,2) DEFAULT 0;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        marketplace_id INTEGER REFERENCES marketplaces(id) ON DELETE SET NULL,
        old_price NUMERIC(12,2) DEFAULT 0,
        new_price NUMERIC(12,2) DEFAULT 0,
        change_reason TEXT,
        changed_by VARCHAR(120),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        marketplace_id INTEGER REFERENCES marketplaces(id) ON DELETE SET NULL,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        proposed_payload JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        approved_by VARCHAR(120),
        created_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP,
        rejected_reason TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(120) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        before_json JSONB DEFAULT '{}',
        after_json JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_stock_code ON products(stock_code);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_brand_min_price ON products(brand_min_price);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_name_lower ON brands (LOWER(name));`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_parent ON categories (LOWER(name), COALESCE(parent_id, -1));`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pmi_product_id ON product_marketplace_identifiers(product_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_competitor_prices_product_marketplace ON competitor_prices(product_id, marketplace_id, observed_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_rules_scope_lookup ON marketplace_rules(scope_type, marketplace_id, category_id, product_id, is_active);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shipping_rules_scope_lookup ON shipping_rules(scope_type, marketplace_id, is_active, min_price, max_price);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_profit_targets_scope_lookup ON profit_targets(scope_type, marketplace_id, category_id, product_id, is_active);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_extra_deductions_rule_lookup ON marketplace_extra_deductions(marketplace_rule_id, is_active, priority);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_price_recommendations_product_status ON price_recommendations(product_id, status, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_price_history_product_created_at ON price_history(product_id, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_product_status ON alerts(product_id, is_resolved, created_at DESC);`);

    // Varsayılan pazaryerleri
    await client.query(`
      INSERT INTO marketplaces (marketplace_name)
      VALUES ('Trendyol'), ('Hepsiburada'), ('Amazon'), ('Pazarama')
      ON CONFLICT (marketplace_name) DO NOTHING;
    `);

    // Varsayılan genel kural
    await client.query(`
      INSERT INTO marketplace_rules (
        scope_type, marketplace_id, priority, minimum_profit_margin, target_profit_margin,
        min_margin_rate, target_margin_rate, commission_rate, commission_base, vat_rate,
        fixed_fee, marketplace_discount_rate, marketplace_discount_funded, rounding_ending, is_active, notes
      )
      SELECT 'general', NULL, 0, 10, 18, 10, 18, 18, 'net_ex_vat', 20, 0, 0, FALSE, 0.90, TRUE, 'Varsayilan genel kural'
      WHERE NOT EXISTS (
        SELECT 1 FROM marketplace_rules WHERE scope_type = 'general' AND marketplace_id IS NULL
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
  }
}

module.exports = init;
