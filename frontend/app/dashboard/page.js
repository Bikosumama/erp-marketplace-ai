'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) return <div style={styles.loading}>Yükleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={styles.main}>
        <h1 style={styles.heading}>Dashboard</h1>
        <div style={styles.grid}>
          <StatCard title="Toplam Ürün" value="—" icon="📦" color="#3498db" />
          <StatCard title="Aktif Sipariş" value="—" icon="🛒" color="#27ae60" />
          <StatCard title="Pazaryerleri" value="6" icon="🏪" color="#9b59b6" />
          <StatCard title="Fiyat Önerileri" value="—" icon="🤖" color="#e67e22" />
        </div>
        <div style={styles.welcome}>
          <h2>Hoş geldiniz{user.name ? `, ${user.name}` : ''}!</h2>
          <p>Sol menüden yönetmek istediğiniz bölümü seçin.</p>
        </div>
      </main>
    </>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <div style={styles.cardIcon}>{icon}</div>
      <div>
        <div style={styles.cardValue}>{value}</div>
        <div style={styles.cardTitle}>{title}</div>
      </div>
    </div>
  );
}

const styles = {
  loading: { padding: '40px', textAlign: 'center', fontSize: '18px' },
  main: { padding: '32px', maxWidth: '1200px', margin: '0 auto' },
  heading: { fontSize: '28px', marginBottom: '24px', color: '#2c3e50' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  card: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  cardIcon: { fontSize: '36px' },
  cardValue: { fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' },
  cardTitle: { fontSize: '14px', color: '#7f8c8d', marginTop: '4px' },
  welcome: {
    backgroundColor: '#fff',
    padding: '24px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
};
