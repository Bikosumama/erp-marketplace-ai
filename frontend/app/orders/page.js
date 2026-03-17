'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const STATUS_LABELS = {
  pending: 'Beklemede',
  processing: 'Isleniyor',
  shipped: 'Kargoda',
  delivered: 'Teslim Edildi',
  cancelled: 'Iptal',
};

export default function OrdersPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setError('Siparisler yuklenemedi');
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDelete = async (id) => {
    if (!confirm('Bu siparisi silmek istediginize emin misiniz?')) return;
    try {
      await fetch(`${API_URL}/api/orders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchOrders();
    } catch {
      setError('Siparis silinemedi');
    }
  };

  if (loading) return <div style={styles.loading}>Yukleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.heading}>Siparisler</h1>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {fetching ? (
          <div style={styles.loading}>Siparisler yukleniyor...</div>
        ) : orders.length === 0 ? (
          <div style={styles.empty}>Henuz siparis bulunmuyor.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Siparis ID</th>
                <th style={styles.th}>Pazaryeri</th>
                <th style={styles.th}>Musteri</th>
                <th style={styles.th}>Tutar</th>
                <th style={styles.th}>Durum</th>
                <th style={styles.th}>Tarih</th>
                <th style={styles.th}>Islem</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={styles.tr}>
                  <td style={styles.td}>#{o.id}</td>
                  <td style={styles.td}>{o.marketplace || '—'}</td>
                  <td style={styles.td}>{o.customer || '—'}</td>
                  <td style={styles.td}>{o.total ? `${o.total} TL` : '—'}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: getStatusColor(o.status) }}>
                      {STATUS_LABELS[o.status] || o.status || '—'}
                    </span>
                  </td>
                  <td style={styles.td}>{o.created_at ? new Date(o.created_at).toLocaleDateString('tr-TR') : '—'}</td>
                  <td style={styles.td}>
                    <button onClick={() => handleDelete(o.id)} style={styles.deleteBtn}>Sil</button>
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

function getStatusColor(status) {
  const colors = {
    pending: '#f39c12',
    processing: '#3498db',
    shipped: '#9b59b6',
    delivered: '#27ae60',
    cancelled: '#e74c3c',
  };
  return colors[status] || '#7f8c8d';
}

const styles = {
  loading: { padding: '40px', textAlign: 'center', fontSize: '18px' },
  main: { padding: '32px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  heading: { fontSize: '28px', color: '#2c3e50' },
  error: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px' },
  empty: { textAlign: 'center', color: '#7f8c8d', padding: '40px' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  th: { backgroundColor: '#2c3e50', color: '#fff', padding: '12px 16px', textAlign: 'left', fontSize: '14px' },
  tr: { borderBottom: '1px solid #f1f2f6' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#2c3e50' },
  badge: { display: 'inline-block', padding: '4px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px' },
  deleteBtn: { padding: '6px 12px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' },
};
