const request = require('supertest');
const app = require('../../app'); // Adjust the path to your app

describe('API Endpoints', () => {
  describe('GET /api/products', () => {
    it('should return a list of products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const newOrder = { productId: '123', quantity: 2 }; // Adjust based on your schema
      const res = await request(app).post('/api/orders').send(newOrder);
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('order');
      expect(res.body.order).toMatchObject(newOrder);
    });
  });
});