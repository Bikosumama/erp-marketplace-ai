'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ProductsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', cost: '', sku: '' });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user && token) fetchProducts();
  }, [user, token]);

  const fetchProducts = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setError('Ürünler yüklenemedi');
    } finally {
      setFetching(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: '', description: '', cost: '', sku: '' });
        setShowForm(false);
        fetchProducts();
      }
    } catch {
      setError('Ürün oluşturulamadı');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProducts();
    } catch {
      setError('Ürün silinemedi');
    }
  };

  if (loading) return <div style={styles.loading}>Yükleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.heading}>📦 Ürünler</h1>
          <button onClick={() => setShowForm(!showForm)} style={styles.btn}>
            {showForm ? 'İptal' : '+ Yeni Ürün'}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} style={styles.form}>
            <input
              placeholder="Ürün Adı"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="Açıklama"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="Maliyet (TL)"
              type="number"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              style={styles.input}
            />
            <button type="submit" style={styles.submitBtn}>Kaydet</button>
          </form>
        )}

        {fetching ? (
          <div style={styles.loading}>Ürünler yükleniyor...</div>
        ) : products.length === 0 ? (
          <div style={styles.empty}>Henüz ürün eklenmemiş.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Ad</th>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>Maliyet</th>
                <th style={styles.th}>Açıklama</th>
                <th style={styles.th}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={styles.tr}>
                  <td style={styles.td}>{p.name}</td>
                  <td style={styles.td}>{p.sku || '—'}</td>
                  <td style={styles.td}>{p.cost ? `₺${p.cost}` : '—'}</td>
                  <td style={styles.td}>{p.description || '—'}</td>
                  <td style={styles.td}>
                    <button onClick={() => handleDelete(p.id)} style={styles.deleteBtn}>
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}

const styles = {
  loading: { padding: '40px', textAlign: 'center', fontSize: '18px' },
  main: { padding: '32px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  heading: { fontSize: '28px', color: '#2c3e50' },
  btn: { padding: '10px 20px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px' },
  error: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px' },
  form: { backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' },
  input: { padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', flex: '1', minWidth: '160px' },
  submitBtn: { padding: '10px 20px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px' },
  empty: { textAlign: 'center', color: '#7f8c8d', padding: '40px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  th: { backgroundColor: '#2c3e50', color: '#fff', padding: '12px 16px', textAlign: 'left', fontSize: '14px' },
  tr: { borderBottom: '1px solid #f1f2f6' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#2c3e50' },
  deleteBtn: { padding: '6px 12px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px' },
};
