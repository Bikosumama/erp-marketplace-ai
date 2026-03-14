'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PriceAnalysisPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [recommendations, setRecommendations] = useState([]);
  const [history, setHistory] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [applyStatus, setApplyStatus] = useState({});
  const [activeTab, setActiveTab] = useState('recommendations');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user && token) {
      fetchRecommendations();
      fetchHistory();
    }
  }, [user, token]);

  const fetchRecommendations = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/price-analysis/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch {
      setError('Fiyat önerileri yüklenemedi');
    } finally {
      setFetching(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/price-analysis/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      // ignore
    }
  };

  const handleAnalyze = async () => {
    try {
      await fetch(`${API_URL}/api/price-analysis/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      fetchRecommendations();
    } catch {
      setError('Analiz başlatılamadı');
    }
  };

  const handleApply = async (id) => {
    setApplyStatus((prev) => ({ ...prev, [id]: 'applying' }));
    try {
      await fetch(`${API_URL}/api/price-analysis/${id}/apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setApplyStatus((prev) => ({ ...prev, [id]: 'done' }));
      setTimeout(() => setApplyStatus((prev) => ({ ...prev, [id]: null })), 2000);
    } catch {
      setApplyStatus((prev) => ({ ...prev, [id]: 'error' }));
    }
  };

  if (loading) return <div style={styles.loading}>Yükleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.heading}>🤖 Fiyat Analizi</h1>
          <button onClick={handleAnalyze} style={styles.btn}>
            🔍 Analiz Başlat
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'recommendations' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('recommendations')}
          >
            Fiyat Önerileri
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'history' ? styles.activeTab : {}) }}
            onClick={() => setActiveTab('history')}
          >
            Fiyat Geçmişi
          </button>
        </div>

        {activeTab === 'recommendations' && (
          fetching ? (
            <div style={styles.loading}>Öneriler yükleniyor...</div>
          ) : recommendations.length === 0 ? (
            <div style={styles.empty}>Henüz fiyat önerisi bulunmuyor. Analiz başlatın.</div>
          ) : (
            <div style={styles.grid}>
              {recommendations.map((r) => (
                <div key={r.product_id || r.id} style={styles.card}>
                  <div style={styles.cardTitle}>Ürün #{r.product_id || r.id}</div>
                  <div style={styles.priceRow}>
                    <span style={styles.priceLabel}>Mevcut:</span>
                    <span style={styles.priceOld}>₺{r.current_price}</span>
                  </div>
                  <div style={styles.priceRow}>
                    <span style={styles.priceLabel}>Önerilen:</span>
                    <span style={styles.priceNew}>₺{r.recommended_price}</span>
                  </div>
                  <div style={styles.reason}>{r.reason}</div>
                  <div style={styles.confidence}>
                    Güven: {Math.round((r.confidence || 0) * 100)}%
                  </div>
                  <button
                    onClick={() => handleApply(r.product_id || r.id)}
                    style={styles.applyBtn}
                    disabled={applyStatus[r.product_id || r.id] === 'applying'}
                  >
                    {applyStatus[r.product_id || r.id] === 'applying'
                      ? 'Uygulanıyor...'
                      : applyStatus[r.product_id || r.id] === 'done'
                      ? '✅ Uygulandı'
                      : 'Uygula'}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          history.length === 0 ? (
            <div style={styles.empty}>Fiyat geçmişi bulunamadı.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Ürün ID</th>
                  <th style={styles.th}>Eski Fiyat</th>
                  <th style={styles.th}>Yeni Fiyat</th>
                  <th style={styles.th}>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>#{h.product_id}</td>
                    <td style={styles.td}>₺{h.old_price}</td>
                    <td style={styles.td}>₺{h.new_price}</td>
                    <td style={styles.td}>{h.date ? new Date(h.date).toLocaleDateString('tr-TR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
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
  btn: { padding: '10px 20px', backgroundColor: '#e67e22', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px' },
  error: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '24px' },
  tab: { padding: '10px 20px', border: 'none', borderRadius: '6px', fontSize: '14px', backgroundColor: '#ecf0f1', color: '#2c3e50' },
  activeTab: { backgroundColor: '#3498db', color: '#fff' },
  empty: { textAlign: 'center', color: '#7f8c8d', padding: '40px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#fff', padding: '24px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: '16px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '12px' },
  priceRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  priceLabel: { fontSize: '14px', color: '#7f8c8d' },
  priceOld: { fontSize: '14px', color: '#e74c3c', textDecoration: 'line-through' },
  priceNew: { fontSize: '14px', color: '#27ae60', fontWeight: 'bold' },
  reason: { fontSize: '13px', color: '#7f8c8d', margin: '10px 0' },
  confidence: { fontSize: '12px', color: '#3498db', marginBottom: '12px' },
  applyBtn: { width: '100%', padding: '10px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  th: { backgroundColor: '#2c3e50', color: '#fff', padding: '12px 16px', textAlign: 'left', fontSize: '14px' },
  tr: { borderBottom: '1px solid #f1f2f6' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#2c3e50' },
};
