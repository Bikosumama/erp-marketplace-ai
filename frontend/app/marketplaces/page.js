'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function MarketplacesPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [marketplaces, setMarketplaces] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ marketplace_name: '', api_key: '', api_secret: '' });
  const [syncStatus, setSyncStatus] = useState({});

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user && token) fetchMarketplaces();
  }, [user, token]);

  const fetchMarketplaces = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/marketplaces`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMarketplaces(data.marketplaces || []);
    } catch {
      setError('Pazaryerleri yüklenemedi');
    } finally {
      setFetching(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/marketplaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ marketplace_name: '', api_key: '', api_secret: '' });
        setShowForm(false);
        fetchMarketplaces();
      }
    } catch {
      setError('Pazaryeri eklenemedi');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu pazaryerini silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`${API_URL}/api/marketplaces/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMarketplaces();
    } catch {
      setError('Pazaryeri silinemedi');
    }
  };

  const handleSync = async (id) => {
    setSyncStatus((prev) => ({ ...prev, [id]: 'syncing' }));
    try {
      const res = await fetch(`${API_URL}/api/marketplaces/${id}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await res.json();
      setSyncStatus((prev) => ({ ...prev, [id]: 'done' }));
      setTimeout(() => setSyncStatus((prev) => ({ ...prev, [id]: null })), 2000);
    } catch {
      setSyncStatus((prev) => ({ ...prev, [id]: 'error' }));
    }
  };

  if (loading) return <div style={styles.loading}>Yükleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.heading}>🏪 Pazaryerleri</h1>
          <button onClick={() => setShowForm(!showForm)} style={styles.btn}>
            {showForm ? 'İptal' : '+ Yeni Pazaryeri'}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} style={styles.form}>
            <input
              placeholder="Pazaryeri Adı (ör: Trendyol)"
              required
              value={form.marketplace_name}
              onChange={(e) => setForm({ ...form, marketplace_name: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="API Key"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="API Secret"
              type="password"
              value={form.api_secret}
              onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
              style={styles.input}
            />
            <button type="submit" style={styles.submitBtn}>Kaydet</button>
          </form>
        )}

        {fetching ? (
          <div style={styles.loading}>Pazaryerleri yükleniyor...</div>
        ) : marketplaces.length === 0 ? (
          <div style={styles.empty}>Henüz pazaryeri eklenmemiş.</div>
        ) : (
          <div style={styles.grid}>
            {marketplaces.map((m) => (
              <div key={m.id} style={styles.card}>
                <div style={styles.cardName}>{m.marketplace_name || m.name}</div>
                <div style={styles.cardStatus}>
                  {m.is_active ? '🟢 Aktif' : '🔴 Pasif'}
                </div>
                <div style={styles.cardActions}>
                  <button
                    onClick={() => handleSync(m.id)}
                    style={styles.syncBtn}
                    disabled={syncStatus[m.id] === 'syncing'}
                  >
                    {syncStatus[m.id] === 'syncing'
                      ? 'Senkronize ediliyor...'
                      : syncStatus[m.id] === 'done'
                      ? '✅ Tamamlandı'
                      : '🔄 Senkronize Et'}
                  </button>
                  <button onClick={() => handleDelete(m.id)} style={styles.deleteBtn}>
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#fff', padding: '24px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  cardName: { fontSize: '18px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '8px' },
  cardStatus: { fontSize: '14px', color: '#7f8c8d', marginBottom: '16px' },
  cardActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  syncBtn: { padding: '8px 14px', backgroundColor: '#9b59b6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px' },
  deleteBtn: { padding: '8px 14px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px' },
};
