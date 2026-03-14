'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kayıt başarısız');
        return;
      }
      router.push('/login');
    } catch {
      setError('Sunucuya bağlanılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>ERP Marketplace AI</h1>
        <h2 style={styles.subtitle}>Kayıt Ol</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Ad Soyad</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={styles.input}
            placeholder="Adınız Soyadınız"
          />
          <label style={styles.label}>E-posta</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={styles.input}
            placeholder="ornek@sirket.com"
          />
          <label style={styles.label}>Şifre</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={styles.input}
            placeholder="En az 6 karakter"
          />
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
          </button>
        </form>
        <p style={styles.link}>
          Zaten hesabınız var mı?{' '}
          <Link href="/login" style={styles.linkText}>
            Giriş Yap
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f6fa',
  },
  card: {
    backgroundColor: '#fff',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    textAlign: 'center',
    color: '#3498db',
    marginBottom: '8px',
    fontSize: '22px',
  },
  subtitle: {
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: '24px',
    fontSize: '18px',
    fontWeight: 'normal',
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
  },
  btn: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: '500',
  },
  link: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '14px',
    color: '#6b7280',
  },
  linkText: {
    color: '#3498db',
    fontWeight: '500',
  },
};
