export interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description?: string;
  marketplace?: string;
  status?: 'active' | 'inactive' | 'pending';
  created_at?: string;
  updated_at?: string;
}

export interface ProductFormData {
  name: string;
  sku: string;
  price: number | string;
  stock: number | string;
  category: string;
  description?: string;
  marketplace?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductsResponse {
  products?: Product[];
  data?: Product[];
  meta?: PaginationMeta;
  total?: number;
}

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
}
