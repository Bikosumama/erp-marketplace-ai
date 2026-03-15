import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function PriceAnalysisPage() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('recommendations');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    marketplace_id: '',
    current_price: '',
    competitor_price: ''
  });
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
    }
  }, [token, loading, router]);

  useEffect(() => {
    if (token) {
      fetchRecommendations();
      fetchHistory();
    }
  }, [token]);

  const fetchRecommendations = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/price-analysis/recommendations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/price-analysis/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Hata:', error);
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/price-analysis/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: parseInt(formData.product_id),
          marketplace_id: formData.marketplace_id ? parseInt(formData.marketplace_id) : null,
          current_price: parseFloat(formData.current_price),
          competitor_price: formData.competitor_price ? parseFloat(formData.competitor_price) : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert('Hata: ' + data.error);
        return;
      }

      setRecommendations([data, ...recommendations]);
      setFormData({
        product_id: '',
        marketplace_id: '',
        current_price: '',
        competitor_price: ''
      });
      setShowForm(false);
      alert('Fiyat analizi başarıyla yapıldı!');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const handleApply = async (id) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/price-analysis/${id}/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        alert('Hata: ' + data.error);
        return;
      }

      alert('Fiyat başarıyla uygulandı!');
      fetchRecommendations();
      fetchHistory();
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
          <h2>Fiyat Analizi</h2>
          <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
            + Yeni Analiz
          </button>
        </div>

        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab('recommendations')}
            style={{
              ...styles.tabBtn,
              borderBottomColor: activeTab === 'recommendations' ? '#008b8b' : '#ddd',
              color: activeTab === 'recommendations' ? '#008b8b' : '#666'
            }}
          >
            Öneriler
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              ...styles.tabBtn,
              borderBottomColor: activeTab === 'history' ? '#008b8b' : '#ddd',
              color: activeTab === 'history' ? '#008b8b' : '#666'
            }}
          >
            Geçmiş
          </button>
        </div>

        {showForm && (
          <div style={styles.formCard}>
            <h3>Yeni Fiyat Analizi</h3>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="number"
                name="product_id"
                placeholder="Ürün ID"
                value={formData.product_id}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="number"
                name="marketplace_id"
                placeholder="Pazaryeri ID (Opsiyonel)"
                value={formData.marketplace_id}
                onChange={handleChange}
                style={styles.input}
              />
              <input
                type="number"
                name="current_price"
                placeholder="Mevcut Fiyat"
                value={formData.current_price}
                onChange={handleChange}
                required
                step="0.01"
                style={styles.input}
              />
              <input
                type="number"
                name="competitor_price"
                placeholder="Rakip Fiyatı (Opsiyonel)"
                value={formData.competitor_price}
                onChange={handleChange}
                step="0.01"
                style={styles.input}
              />
              <button type="submit" style={styles.submitBtn}>Analiz Yap</button>
            </form>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div style={styles.tableContainer}>
            {recommendations.length === 0 ? (
              <p style={styles.emptyMessage}>Henüz öneri eklenmemiş</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th>Ürün ID</th>
                    <th>Mevcut Fiyat</th>
                    <th>Önerilen Fiyat</th>
                    <th>Değişim</th>
                    <th>Güven</th>
                    <th>Neden</th>
                    <th>Durum</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map(rec => (
                    <tr key={rec.id} style={styles.tableRow}>
                      <td>{rec.product_id}</td>
                      <td>₺{rec.current_price}</td>
                      <td>₺{rec.recommended_price}</td>
                      <td>
                        <span style={getChangeStyle(rec.recommended_price - rec.current_price)}>
                          {((rec.recommended_price - rec.current_price) / rec.current_price * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td>{(rec.confidence * 100).toFixed(0)}%</td>
                      <td>{rec.reason}</td>
                      <td>{rec.status}</td>
                      <td>
                        {rec.status === 'pending' && (
                          <button
                            onClick={() => handleApply(rec.id)}
                            style={styles.applyBtn}
                          >
                            Uygula
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div style={styles.tableContainer}>
            {history.length === 0 ? (
              <p style={styles.emptyMessage}>Henüz fiyat değişimi kaydedilmemiş</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th>Ürün ID</th>
                    <th>Eski Fiyat</th>
                    <th>Yeni Fiyat</th>
                    <th>Değişim %</th>
                    <th>Neden</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    <tr key={item.id} style={styles.tableRow}>
                      <td>{item.product_id}</td>
                      <td>₺{item.old_price}</td>
                      <td>₺{item.new_price}</td>
                      <td>
                        <span style={getChangeStyle(item.change_percentage)}>
                          {item.change_percentage}%
                        </span>
                      </td>
                      <td>{item.reason}</td>
                      <td>{new Date(item.created_at).toLocaleString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getChangeStyle(change) {
  if (change > 0) {
    return { color: '#28a745', fontWeight: 'bold' };
  } else if (change < 0) {
    return { color: '#dc3545', fontWeight: 'bold' };
  }
  return {};
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
  tabs: { display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #ddd' },
  tabBtn: { padding: '10px 20px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '16px', borderBottom: '2px solid transparent' },
  formCard: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' },
  submitBtn: { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  tableContainer: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeader: { backgroundColor: '#f8f9fa', fontWeight: 'bold' },
  tableRow: { borderBottom: '1px solid #ddd' },
  applyBtn: { padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  emptyMessage: { padding: '40px', textAlign: 'center', color: '#999' }
};