import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function OrdersPage() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    order_number: '',
    customer_name: '',
    customer_email: '',
    total_price: '',
    status: 'pending',
    marketplace: '',
    items_count: '',
    notes: ''
  });
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
    }
  }, [token, loading, router]);

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
  }, [token]);

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Hata:', error);
    } finally {
      setFetchLoading(false);
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          total_price: parseFloat(formData.total_price),
          items_count: parseInt(formData.items_count) || 1
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert('Hata: ' + data.error);
        return;
      }

      setOrders([data, ...orders]);
      setFormData({
        order_number: '',
        customer_name: '',
        customer_email: '',
        total_price: '',
        status: 'pending',
        marketplace: '',
        items_count: '',
        notes: ''
      });
      setShowForm(false);
      alert('Sipariş başarıyla eklendi!');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        alert('Silme hatası');
        return;
      }

      setOrders(orders.filter(o => o.id !== id));
      alert('Sipariş silindi');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  if (loading || fetchLoading) {
    return <div style={styles.loading}>Yükleniyor...</div>;
  }

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
        </nav>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        <div style={styles.titleBar}>
          <h2>Siparişler</h2>
          <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
            + Sipariş Ekle
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div style={styles.formCard}>
            <h3>Yeni Sipariş Ekle</h3>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="text"
                name="order_number"
                placeholder="Sipariş Numarası"
                value={formData.order_number}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="text"
                name="customer_name"
                placeholder="Müşteri Adı"
                value={formData.customer_name}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="email"
                name="customer_email"
                placeholder="Müşteri Email"
                value={formData.customer_email}
                onChange={handleChange}
                required
                style={styles.input}
              />
              <input
                type="number"
                name="total_price"
                placeholder="Toplam Fiyat"
                value={formData.total_price}
                onChange={handleChange}
                required
                step="0.01"
                style={styles.input}
              />
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="pending">Beklemede</option>
                <option value="processing">İşleniyor</option>
                <option value="shipped">Gönderildi</option>
                <option value="delivered">Teslim Edildi</option>
                <option value="cancelled">İptal Edildi</option>
              </select>
              <input
                type="text"
                name="marketplace"
                placeholder="Pazaryeri"
                value={formData.marketplace}
                onChange={handleChange}
                style={styles.input}
              />
              <input
                type="number"
                name="items_count"
                placeholder="Ürün Sayısı"
                value={formData.items_count}
                onChange={handleChange}
                style={styles.input}
              />
              <textarea
                name="notes"
                placeholder="Notlar"
                value={formData.notes}
                onChange={handleChange}
                style={{ ...styles.textarea, gridColumn: 'span 2' }}
              />
              <button type="submit" style={styles.submitBtn}>Kaydet</button>
            </form>
          </div>
        )}

        {/* Orders Table */}
        <div style={styles.tableContainer}>
          {orders.length === 0 ? (
            <p style={styles.emptyMessage}>Henüz sipariş eklenmemiş</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th>Sipariş No</th>
                  <th>Müşteri</th>
                  <th>Fiyat</th>
                  <th>Durum</th>
                  <th>Pazaryeri</th>
                  <th>Ürün Sayısı</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} style={styles.tableRow}>
                    <td>{order.order_number}</td>
                    <td>{order.customer_name}</td>
                    <td>₺{order.total_price}</td>
                    <td>
                      <span style={getStatusStyle(order.status)}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td>{order.marketplace || '-'}</td>
                    <td>{order.items_count}</td>
                    <td>
                      <button
                        onClick={() => handleDelete(order.id)}
                        style={styles.deleteBtn}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusLabel(status) {
  const labels = {
    pending: 'Beklemede',
    processing: 'İşleniyor',
    shipped: 'Gönderildi',
    delivered: 'Teslim Edildi',
    cancelled: 'İptal Edildi'
  };
  return labels[status] || status;
}

function getStatusStyle(status) {
  const styles = {
    pending: { backgroundColor: '#ffc107', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' },
    processing: { backgroundColor: '#17a2b8', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' },
    shipped: { backgroundColor: '#007bff', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' },
    delivered: { backgroundColor: '#28a745', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' },
    cancelled: { backgroundColor: '#dc3545', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' }
  };
  return styles[status] || {};
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
    alignItems: 'center'
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
    gap: '20px'
  },
  navLink: {
    color: 'white',
    textDecoration: 'none'
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
    minHeight: '100vh'
  },
  titleBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  addBtn: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  formCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px'
  },
  input: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  textarea: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    minHeight: '80px'
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeader: {
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold'
  },
  tableRow: {
    borderBottom: '1px solid #ddd'
  },
  deleteBtn: {
    padding: '5px 10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  emptyMessage: {
    padding: '40px',
    textAlign: 'center',
    color: '#999'
  }
};