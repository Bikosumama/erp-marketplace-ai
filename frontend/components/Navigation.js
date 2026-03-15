'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const navItems = [
  const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/products', label: 'Ürünler' },
  { href: '/brands', label: 'Markalar' },
  { href: '/categories', label: 'Kategoriler' },
  { href: '/orders', label: 'Siparişler' },
  { href: '/marketplaces', label: 'Pazaryerleri' },
  { href: '/price-analysis', label: 'Fiyat Analizi' },
  { href: '/rules', label: '⚙️ Kurallar' },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <Link href="/dashboard" style={{ color: '#3498db', textDecoration: 'none' }}>ERP Marketplace AI</Link>
      </div>
      <ul style={styles.navList}>
        {navItems.map((item) => (
          <li key={item.href}>
            <Link href={item.href} style={{ ...styles.navLink, ...(pathname === item.href ? styles.activeLink : {}) }}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div style={styles.userSection}>
        {user && <span style={styles.userName}>{user.email || user.name}</span>}
        <button onClick={handleLogout} style={styles.logoutBtn}>Çıkış</button>
      </div>
    </nav>
  );
}

const styles = {
  nav: { display: 'flex', alignItems: 'center', backgroundColor: '#2c3e50', color: '#fff', padding: '0 24px', height: '60px', gap: '24px' },
  brand: { fontWeight: 'bold', fontSize: '18px', color: '#3498db', minWidth: '180px' },
  navList: { display: 'flex', listStyle: 'none', gap: '8px', flex: 1, flexWrap: 'wrap', margin: 0, padding: 0 },
  navLink: { display: 'block', padding: '8px 12px', borderRadius: '6px', color: '#ecf0f1', fontSize: '14px', textDecoration: 'none' },
  activeLink: { backgroundColor: '#3498db', color: '#fff' },
  userSection: { display: 'flex', alignItems: 'center', gap: '12px' },
  userName: { fontSize: '14px', color: '#bdc3c7' },
  logoutBtn: { padding: '6px 14px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
};
