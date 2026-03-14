'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/lib/api';
import ProductForm from '@/components/ProductForm';
import SuccessNotification from '@/components/SuccessNotification';
import ErrorAlert from '@/components/ErrorAlert';
import type { ProductFormData } from '@/types';

export default function NewProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSuccessMessage('Product created successfully!');
      setTimeout(() => {
        router.push('/products');
      }, 1500);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const handleSubmit = async (data: ProductFormData) => {
    setErrorMessage(null);
    await createMutation.mutateAsync(data);
  };

  return (
    <div className="space-y-5">
      {successMessage && (
        <SuccessNotification
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/products" className="hover:text-teal-600 transition-colors">
          Products
        </Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">New Product</span>
      </nav>

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Product</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add a new product to your marketplace catalog.
        </p>
      </div>

      {errorMessage && (
        <ErrorAlert
          message={errorMessage}
          onRetry={() => setErrorMessage(null)}
          actionLabel="Dismiss"
        />
      )}

      <ProductForm
        title="New Product Details"
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
        submitLabel="Create Product"
      />
    </div>
  );
}
