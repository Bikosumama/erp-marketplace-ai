-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cost DECIMAL(10, 2) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  stock INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketplace Accounts
CREATE TABLE marketplace_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  marketplace_name VARCHAR(100) NOT NULL,
  api_key VARCHAR(500),
  api_secret VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Marketplace Listings
CREATE TABLE product_marketplace_listings (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  marketplace_account_id INT NOT NULL REFERENCES marketplace_accounts(id),
  marketplace_product_id VARCHAR(255),
  price DECIMAL(10, 2),
  stock INT,
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  marketplace_account_id INT NOT NULL REFERENCES marketplace_accounts(id),
  marketplace_order_id VARCHAR(255),
  total_amount DECIMAL(10, 2),
  status VARCHAR(50),
  shipping_cost DECIMAL(10, 2),
  commission DECIMAL(10, 2),
  other_costs DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT,
  unit_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing Rules
CREATE TABLE pricing_rules (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  marketplace_id INT REFERENCES marketplace_accounts(id),
  rule_type VARCHAR(100),
  minimum_profit_margin DECIMAL(5, 2),
  markup_percentage DECIMAL(5, 2),
  condition JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price History
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  product_marketplace_listing_id INT NOT NULL REFERENCES product_marketplace_listings(id),
  price DECIMAL(10, 2),
  competitor_price DECIMAL(10, 2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Costs Table
CREATE TABLE product_costs (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  marketplace_id INT REFERENCES marketplace_accounts(id),
  base_cost DECIMAL(10, 2),
  shipping_cost DECIMAL(10, 2),
  commission_percentage DECIMAL(5, 2),
  other_costs JSON,
  effective_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_marketplace_accounts_user_id ON marketplace_accounts(user_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at);