import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const router = useRouter();
  const { user, token, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
    }
  }, [token, loading, router]);

  if (loading) {
    return <div style={styles.loading}>Yükleniyor...</div>;
  }

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
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
          <button onClick={handleLogout} style={styles.logoutBtn}>Çıkış Yap</button>
        </nav>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        <div style={styles.welcomeCard}>
          <h2>Hoşgeldiniz, {user.full_name || user.username}!</h2>
          <p>ERP Marketplace sisteminize giriş yaptınız.</p>
        </div>

        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📦</div>
            <div style={styles.statContent}>
              <h3>Ürünler</h3>
              <p style={styles.statNumber}>0</p>
              <a href="/products" style={styles.statLink}>Ürünleri Yönet →</a>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>📋</div>
            <div style={styles.statContent}>
              <h3>Siparişler</h3>
              <p style={styles.statNumber}>0</p>
              <a href="/orders" style={styles.statLink}>Siparişleri Yönet →</a>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>🛒</div>
            <div style={styles.statContent}>
              <h3>Pazaryerleri</h3>
              <p style={styles.statNumber}>0</p>
              <a href="/marketplaces" style={styles.statLink}>Pazaryerleri Yönet →</a>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>💰</div>
            <div style={styles.statContent}>
              <h3>Fiyat Analizi</h3>
              <p style={styles.statNumber}>0</p>
              <a href="/price-analysis" style={styles.statLink}>Analiz Yap →</a>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div style={styles.userCard}>
          <h3>Kullanıcı Bilgileri</h3>
          <p><strong>Ad Soyad:</strong> {user.full_name || '-'}</p>
          <p><strong>Kullanıcı Adı:</strong> {user.username}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Rol:</strong> {user.role}</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: '#008b8b',
    color: 'white',
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logo: {
    fontSize: '32px'
  },
  nav: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center'
  },
  navLink: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '14px',
    cursor: 'pointer'
  },
  logoutBtn: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  main: {
    padding: '40px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    fontSize: '18px'
  },
  welcomeCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '30px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    display: 'flex',
    gap: '15px'
  },
  statIcon: {
    fontSize: '40px'
  },
  statContent: {
    flex: 1
  },
  statNumber: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '10px 0'
  },
  statLink: {
    color: '#008b8b',
    textDecoration: 'none',
    fontSize: '12px',
    cursor: 'pointer'
  },
  userCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  }
};