const request = require('supertest');
const app = require('../server'); // backend/server.js exports the Express app

describe('API Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return server health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'OK');
    });
  });

  describe('GET /api/products', () => {
    it('should return a list of products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });
  });

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      const newProduct = { name: 'Test Product', price: 99.99, stock: 10, description: 'A test product' };
      const res = await request(app).post('/api/products').send(newProduct);
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('product');
      expect(res.body.product).toMatchObject({ name: 'Test Product', price: 99.99, stock: 10 });
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/products').send({ description: 'Missing name/price/stock' });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete a product by id', async () => {
      const res = await request(app).delete('/api/products/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Ürün silindi');
      expect(res.body).toHaveProperty('id', '1');
    });
  });
});