'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function BrandsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [brands, setBrands] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [newBrand, setNewBrand] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchBrands = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/brands`, { headers: authHeader() });
      const data = await res.json();
      setBrands(data.brands || []);
    } catch {
      setError('Markalar yüklenemedi');
    } finally {
      setFetching(false);
    }
  }, [token, authHeader]);

  useEffect(() => {
    if (user && token) fetchBrands();
  }, [user, token, fetchBrands]);

  const handleAdd = async () => {
    if (!newBrand.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name: newBrand.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eklenemedi'); return; }
      setSuccess(`"${newBrand}" eklendi`);
      setNewBrand('');
      fetchBrands();
    } catch {
      setError('Eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" markasını silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/brands/${id}`, { method: 'DELETE', headers: authHeader() });
      if (res.ok) { setSuccess(`"${name}" silindi`); fetchBrands(); }
      else { const d = await res.json(); setError(d.error || 'Silinemedi'); }
    } catch {
      setError('Silinemedi');
    }
  };

  if (loading) return <div style={s.loading}>Yükleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={s.main}>
        <h1 style={s.heading}>🏷️ Marka Yönetimi</h1>

        {error && <div style={s.error}>{error} <button onClick={() => setError('')} style={s.clearBtn}>✕</button></div>}
        {success && <div style={s.success}>{success} <button onClick={() => setSuccess('')} style={s.clearBtn}>✕</button></div>}

        {/* Yeni Marka Ekle */}
        <div style={s.card}>
          <h2 style={s.subTitle}>➕ Yeni Marka Ekle</h2>
          <div style={s.addRow}>
            <input
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Marka adı yazın..."
              style={s.input}
            />
            <button onClick={handleAdd} disabled={saving || !newBrand.trim()} style={s.addBtn}>
              {saving ? 'Ekleniyor...' : '+ Ekle'}
            </button>
          </div>
        </div>

        {/* Marka Listesi */}
        <div style={s.card}>
          <h2 style={s.subTitle}>📋 Markalar ({brands.length})</h2>
          {fetching ? (
            <div style={s.loading}>Yükleniyor...</div>
          ) : brands.length === 0 ? (
            <div style={s.empty}>Henüz marka eklenmemiş.</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Marka Adı</th>
                  <th style={s.th}>Eklenme Tarihi</th>
                  <th style={s.th}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b, i) => (
                  <tr key={b.id} style={s.tr}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={s.td}><strong>{b.name}</strong></td>
                    <td style={s.td}>{new Date(b.created_at).toLocaleDateString('tr-TR')}</td>
                    <td style={s.td}>
                      <button onClick={() => handleDelete(b.id, b.name)} style={s.deleteBtn}>🗑 Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}

const s = {
  loading: { padding: '40px', textAlign: 'center', fontSize: '18px' },
  main: { padding: '32px', maxWidth: '900px', margin: '0 auto' },
  heading: { fontSize: '28px', color: '#2c3e50', marginBottom: '24px' },
  subTitle: { fontSize: '18px', color: '#2c3e50', marginBottom: '16px' },
  card: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '24px' },
  addRow: { display: 'flex', gap: '12px', alignItems: 'center' },
  input: { flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  addBtn: { padding: '10px 24px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  error: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' },
  success: { backgroundColor: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { backgroundColor: '#2c3e50', color: '#fff', padding: '10px 12px', textAlign: 'left' },
  tr: { borderBottom: '1px solid #f1f2f6' },
  td: { padding: '10px 12px', color: '#2c3e50' },
  empty: { textAlign: 'center', color: '#7f8c8d', padding: '40px' },
  deleteBtn: { padding: '5px 12px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' },
};
