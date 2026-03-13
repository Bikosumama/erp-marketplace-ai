// database/seed.js

const knex = require('knex')({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database'
  }
});

const seed = async () => {
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('products');

  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('name');
    table.decimal('price', 10, 2);
    table.integer('stock');
  });

  await knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().references('id').inTable('products');
    table.integer('quantity');
    table.timestamp('order_date').defaultTo(knex.fn.now());
  });

  // Inserting sample data
  await knex('products').insert([  
    { name: 'Sample Product 1', price: 10.99, stock: 100 },  
    { name: 'Sample Product 2', price: 15.99, stock: 50 },  
    { name: 'Sample Product 3', price: 7.99, stock: 150 },
  ]);

  await knex('orders').insert([
    { product_id: 1, quantity: 1 },
    { product_id: 1, quantity: 2 },
    { product_id: 2, quantity: 1 }
  ]);

  console.log('Seeding complete');
  await knex.destroy();
};

seed();