import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function ProductsPage() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: '',
    stock: '',
    category: '',
    description: ''
  });
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
    }
  }, [token, loading, router]);

  useEffect(() => {
    if (token) {
      fetchProducts();
    }
  }, [token]);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          sku: formData.sku,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock),
          category: formData.category,
          description: formData.description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert('Hata: ' + data.error);
        return;
      }

      setProducts([data, ...products]);
      setFormData({
        name: '',
        sku: '',
        price: '',
        stock: '',
        category: '',
        description: ''
      });
      setShowForm(false);
      alert('Ürün başarıyla eklendi!');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        alert('Silme hatası');
        return;
      }

      setProducts(products.filter(p => p.id !== id));
      alert('Ürün silindi');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  if (loading || fetchLoading) {
    return <div style={styles.loading}>Yükleniyor...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logoContainer}>
          <span style={styles.logo}>🛒</span>
          <h1>ERP Marketplace</h1>
        </div>
        <nav style={styles.nav}>
          <a href="/dashboard" style={styles.navLink}>Dashboard</a>
          <a href="/products" style={styles.navLink}>Products</a>
          <a href="/orders" style={styles.navLink}>Orders</a>
          <a href="/marketplaces" style={styles.navLink}>Marketplaces</a>
          <a href="/price-analysis" style={styles.navLink}>Price Analysis</a>
        </nav>
      </div>

      <div style={styles.main}>
        <div style={styles.titleBar}>
          <h2>Ürünler</h2>
          <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
            + Ürün Ekle
          </button>
        </div>

        {showForm && (
          <div style={styles.formCard}>
            <h3>Yeni Ürün Ekle</h3>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="text"
                name="name"
                placeholder="Ürün Adı"
                value={formData.name}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="text"
                name="sku"
                placeholder="SKU"
                value={formData.sku}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="number"
                name="price"
                placeholder="Fiyat"
                value={formData.price}
                onChange={handleChange}
                required
                step="0.01"
                style={styles.input}
              />
              <input
                type="number"
                name="stock"
                placeholder="Stok"
                value={formData.stock}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="text"
                name="category"
                placeholder="Kategori"
                value={formData.category}
                onChange={handleChange}
                style={styles.input}
              />
              <textarea
                name="description"
                placeholder="Açıklama"
                value={formData.description}
                onChange={handleChange}
                style={styles.textarea}
              />
              <button type="submit" style={styles.submitBtn}>Kaydet</button>
            </form>
          </div>
        )}

        <div style={styles.tableContainer}>
          {products.length === 0 ? (
            <p style={styles.emptyMessage}>Henüz ürün eklenmemiş</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th>ID</th>
                  <th>Adı</th>
                  <th>SKU</th>
                  <th>Fiyat</th>
                  <th>Stok</th>
                  <th>Kategori</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} style={styles.tableRow}>
                    <td>{product.id}</td>
                    <td>{product.name}</td>
                    <td>{product.sku}</td>
                    <td>₺{product.price}</td>
                    <td>{product.stock}</td>
                    <td>{product.category}</td>
                    <td>
                      <button
                        onClick={() => handleDelete(product.id)}
                        style={styles.deleteBtn}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#008b8b', color: 'white', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logoContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: { fontSize: '32px' },
  nav: { display: 'flex', gap: '20px' },
  navLink: { color: 'white', textDecoration: 'none' },
  main: { padding: '40px', maxWidth: '1200px', margin: '0 auto' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  titleBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  addBtn: { padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  formCard: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' },
  textarea: { padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', minHeight: '80px', gridColumn: 'span 2' },
  submitBtn: { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', gridColumn: 'span 2' },
  tableContainer: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeader: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
  tableRow: { borderBottom: '1px solid #ddd' },
  deleteBtn: { padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  emptyMessage: { padding: '40px', textAlign: 'center', color: '#999' }
};