'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function CategoriesPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Yeni kategori formu
  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch(`${API_URL}/api/categories`, { headers: authHeader() });
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      setError('Kategoriler yüklenemedi');
    } finally {
      setFetching(false);
    }
  }, [token, authHeader]);

  useEffect(() => {
    if (user && token) fetchCategories();
  }, [user, token, fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name: newName.trim(), parent_id: parentId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Eklenemedi'); return; }
      setSuccess(`"${newName}" eklendi`);
      setNewName('');
      setParentId('');
      fetchCategories();
    } catch {
      setError('Eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" kategorisini silmek istediğinize emin misiniz?\nAlt kategoriler de etkilenebilir.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/categories/${id}`, { method: 'DELETE', headers: authHeader() });
      if (res.ok) { setSuccess(`"${name}" silindi`); fetchCategories(); }
      else { const d = await res.json(); setError(d.error || 'Silinemedi'); }
    } catch {
      setError('Silinemedi');
    }
  };

  const tree = buildTree(categories);

  if (loading) return <div style={s.loading}>Yükleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={s.main}>
        <h1 style={s.heading}>📁 Kategori Yönetimi</h1>

        {error && <div style={s.error}>{error} <button onClick={() => setError('')} style={s.clearBtn}>✕</button></div>}
        {success && <div style={s.success}>{success} <button onClick={() => setSuccess('')} style={s.clearBtn}>✕</button></div>}

        {/* Yeni Kategori Ekle */}
        <div style={s.card}>
          <h2 style={s.subTitle}>➕ Yeni Kategori Ekle</h2>
          <div style={s.addRow}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Kategori adı..."
              style={s.input}
            />
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={s.select}>
              <option value="">— Üst kategori yok (Ana kategori) —</option>
              {buildFlatList(categories).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <button onClick={handleAdd} disabled={saving || !newName.trim()} style={s.addBtn}>
              {saving ? 'Ekleniyor...' : '+ Ekle'}
            </button>
          </div>
        </div>

        {/* Kategori Ağacı */}
        <div style={s.card}>
          <h2 style={s.subTitle}>🌳 Kategori Ağacı ({categories.length} kategori)</h2>
          {fetching ? (
            <div style={s.loading}>Yükleniyor...</div>
          ) : tree.length === 0 ? (
            <div style={s.empty}>Henüz kategori eklenmemiş.</div>
          ) : (
            <div style={s.treeWrap}>
              {tree.map((node) => (
                <TreeNode key={node.id} node={node} onDelete={handleDelete} onAddChild={(id) => setParentId(String(id))} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function TreeNode({ node, depth = 0, onDelete, onAddChild }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div style={s.treeRow}>
        <button onClick={() => setExpanded(!expanded)} style={s.expandBtn}>
          {hasChildren ? (expanded ? '▼' : '▶') : '•'}
        </button>
        <span style={s.treeName}>
          {depth > 0 && <span style={{ color: '#94a3b8', marginRight: '4px' }}>└</span>}
          {node.name}
        </span>
        <span style={s.treeCount}>{hasChildren ? `${node.children.length} alt kategori` : ''}</span>
        <div style={s.treeActions}>
          <button onClick={() => onAddChild(node.id)} style={s.addChildBtn} title="Alt kategori ekle">+ Alt</button>
          <button onClick={() => onDelete(node.id, node.name)} style={s.deleteBtn} title="Sil">🗑</button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onDelete={onDelete} onAddChild={onAddChild} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildTree(categories, parentId = null) {
  return categories
    .filter((c) => (parentId === null ? !c.parent_id : parseInt(c.parent_id) === parentId))
    .map((c) => ({ ...c, children: buildTree(categories, c.id) }));
}

function buildFlatList(categories, parentId = null, depth = 0) {
  return categories
    .filter((c) => (parentId === null ? !c.parent_id : parseInt(c.parent_id) === parentId))
    .flatMap((c) => [
      { id: c.id, label: '  '.repeat(depth) + (depth > 0 ? '└ ' : '') + c.name },
      ...buildFlatList(categories, c.id, depth + 1),
    ]);
}

const s = {
  loading: { padding: '40px', textAlign: 'center', fontSize: '18px' },
  main: { padding: '32px', maxWidth: '900px', margin: '0 auto' },
  heading: { fontSize: '28px', color: '#2c3e50', marginBottom: '24px' },
  subTitle: { fontSize: '18px', color: '#2c3e50', marginBottom: '16px' },
  card: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '24px' },
  addRow: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '200px', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  select: { flex: 2, minWidth: '200px', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  addBtn: { padding: '10px 24px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  error: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' },
  success: { backgroundColor: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' },
  empty: { textAlign: 'center', color: '#7f8c8d', padding: '40px' },
  treeWrap: { padding: '8px 0' },
  treeRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', marginBottom: '2px', backgroundColor: '#f8fafc' },
  expandBtn: { width: '24px', height: '24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#64748b', flexShrink: 0 },
  treeName: { flex: 1, fontSize: '14px', color: '#2c3e50', fontWeight: '500' },
  treeCount: { fontSize: '12px', color: '#94a3b8' },
  treeActions: { display: 'flex', gap: '6px' },
  addChildBtn: { padding: '3px 10px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' },
  deleteBtn: { padding: '3px 10px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' },
};
