'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/lib/api';
import ProductForm from '@/components/ProductForm';
import SuccessNotification from '@/components/SuccessNotification';
import ErrorAlert from '@/components/ErrorAlert';
import { PageLoader } from '@/components/LoadingSpinner';
import type { ProductFormData } from '@/types';

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = use(params);
  const productId = parseInt(id, 10);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: product,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => productsApi.getById(productId),
    enabled: !isNaN(productId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProductFormData) => productsApi.update(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSuccessMessage('Product updated successfully!');
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
    await updateMutation.mutateAsync(data);
  };

  if (isNaN(productId)) {
    return (
      <div className="space-y-4">
        <ErrorAlert message="Invalid product ID." />
        <Link href="/products" className="text-sm text-teal-600 hover:underline">
          ← Back to Products
        </Link>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  if (fetchError || !product) {
    return (
      <div className="space-y-4">
        <ErrorAlert
          message={
            fetchError
              ? (fetchError as Error).message
              : 'Product not found.'
          }
        />
        <Link href="/products" className="text-sm text-teal-600 hover:underline">
          ← Back to Products
        </Link>
      </div>
    );
  }

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
        <span className="text-gray-900 font-medium">Edit: {product.name}</span>
      </nav>

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update product information for <strong>{product.name}</strong>.
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
        title="Edit Product Details"
        initialData={product}
        onSubmit={handleSubmit}
        isSubmitting={updateMutation.isPending}
        submitLabel="Update Product"
      />
    </div>
  );
}
