const { Pool } = require('pg');

// PostgreSQL connection pool configuration
const pool = new Pool({
  user: 'your_username', // replace with your database username
  host: 'localhost', // replace with your database host
  database: 'your_database', // replace with your database name
  password: 'your_password', // replace with your database password
  port: 5432, // default PostgreSQL port
});

module.exports = pool;