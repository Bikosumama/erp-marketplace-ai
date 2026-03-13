// trendyolService.js

// Trendyol Marketplace API Integration

class TrendyolService {
    constructor(apiClient) {
        this.apiClient = apiClient;
    }

    // Method to sync products
    async syncProducts(products) {
        try {
            const response = await this.apiClient.post('/products/sync', { products });
            return response.data;
        } catch (error) {
            console.error('Error syncing products:', error);
            throw error;
        }
    }

    // Method to manage orders
    async manageOrders(orderId, action) {
        try {
            const response = await this.apiClient.post(`/orders/${orderId}/${action}`);
            return response.data;
        } catch (error) {
            console.error('Error managing order:', error);
            throw error;
        }
    }

    // Method to update product prices
    async updatePrices(productId, newPrice) {
        try {
            const response = await this.apiClient.put(`/products/${productId}/price`, { price: newPrice });
            return response.data;
        } catch (error) {
            console.error('Error updating price:', error);
            throw error;
        }
    }
}

module.exports = TrendyolService;