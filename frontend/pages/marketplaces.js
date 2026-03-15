import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function MarketplacesPage() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [marketplaces, setMarketplaces] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    marketplace_name: '',
    api_key: '',
    api_secret: '',
    status: 'active'
  });
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
    }
  }, [token, loading, router]);

  useEffect(() => {
    if (token) {
      fetchMarketplaces();
    }
  }, [token]);

  const fetchMarketplaces = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/marketplaces`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMarketplaces(data);
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/marketplaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        alert('Hata: ' + data.error);
        return;
      }

      setMarketplaces([data, ...marketplaces]);
      setFormData({
        marketplace_name: '',
        api_key: '',
        api_secret: '',
        status: 'active'
      });
      setShowForm(false);
      alert('Pazaryeri başarıyla eklendi!');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const handleSync = async (id) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/marketplaces/${id}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        alert('Hata: ' + data.error);
        return;
      }

      alert('Senkronizasyon başlatıldı!');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/marketplaces/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        alert('Silme hatası');
        return;
      }

      setMarketplaces(marketplaces.filter(m => m.id !== id));
      alert('Pazaryeri silindi');
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
          <h2>Pazaryerleri</h2>
          <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
            + Pazaryeri Ekle
          </button>
        </div>

        {showForm && (
          <div style={styles.formCard}>
            <h3>Yeni Pazaryeri Ekle</h3>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="text"
                name="marketplace_name"
                placeholder="Pazaryeri Adı"
                value={formData.marketplace_name}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="text"
                name="api_key"
                placeholder="API Key"
                value={formData.api_key}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="password"
                name="api_secret"
                placeholder="API Secret"
                value={formData.api_secret}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
              <button type="submit" style={styles.submitBtn}>Kaydet</button>
            </form>
          </div>
        )}

        <div style={styles.gridContainer}>
          {marketplaces.length === 0 ? (
            <p style={styles.emptyMessage}>Henüz pazaryeri eklenmemiş</p>
          ) : (
            marketplaces.map(marketplace => (
              <div key={marketplace.id} style={styles.card}>
                <h3>{marketplace.marketplace_name}</h3>
                <p><strong>Durum:</strong> {marketplace.status === 'active' ? '✅ Aktif' : '❌ Pasif'}</p>
                <p><strong>Senkronizasyon:</strong> {marketplace.sync_status || 'Bekleme'}</p>
                {marketplace.last_sync && (
                  <p><strong>Son Senkronizasyon:</strong> {new Date(marketplace.last_sync).toLocaleString('tr-TR')}</p>
                )}
                <div style={styles.cardButtons}>
                  <button
                    onClick={() => handleSync(marketplace.id)}
                    style={styles.syncBtn}
                  >
                    Senkronize Et
                  </button>
                  <button
                    onClick={() => handleDelete(marketplace.id)}
                    style={styles.deleteBtn}
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))
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
  submitBtn: { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
  card: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  cardButtons: { display: 'flex', gap: '10px', marginTop: '15px' },
  syncBtn: { flex: 1, padding: '8px 12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  deleteBtn: { flex: 1, padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  emptyMessage: { padding: '40px', textAlign: 'center', color: '#999' }
};