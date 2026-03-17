const request = require('supertest');

jest.mock('../config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
}));

const app = require('../app');

describe('API Endpoints', () => {
  describe('GET /api/health', () => {
    it('should report server running', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'OK');
    });
  });
});