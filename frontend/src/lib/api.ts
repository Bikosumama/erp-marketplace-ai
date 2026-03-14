import axios from 'axios';
import type { Product, ProductFormData, ProductsResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set. Please configure it in your .env.local file.'
  );
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 15000,
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// Products API
export const productsApi = {
  getAll: async (): Promise<Product[]> => {
    const response = await apiClient.get<ProductsResponse | Product[]>(
      '/api/products'
    );
    const data = response.data;
    // Handle various API response shapes
    if (Array.isArray(data)) return data;
    if ('products' in data && Array.isArray(data.products)) return data.products;
    if ('data' in data && Array.isArray(data.data)) return data.data;
    return [];
  },

  getById: async (id: number): Promise<Product> => {
    const response = await apiClient.get<Product | { data: Product }>(
      `/api/products/${id}`
    );
    const data = response.data;
    if ('data' in data && typeof (data as { data: Product }).data === 'object') {
      return (data as { data: Product }).data;
    }
    return data as Product;
  },

  create: async (productData: ProductFormData): Promise<Product> => {
    const response = await apiClient.post<Product | { data: Product }>(
      '/api/products',
      productData
    );
    const data = response.data;
    if ('data' in data && typeof (data as { data: Product }).data === 'object') {
      return (data as { data: Product }).data;
    }
    return data as Product;
  },

  update: async (id: number, productData: ProductFormData): Promise<Product> => {
    const response = await apiClient.put<Product | { data: Product }>(
      `/api/products/${id}`,
      productData
    );
    const data = response.data;
    if ('data' in data && typeof (data as { data: Product }).data === 'object') {
      return (data as { data: Product }).data;
    }
    return data as Product;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/products/${id}`);
  },
};
