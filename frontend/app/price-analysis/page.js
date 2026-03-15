'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const formatPrice = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `₺${number.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `%${number.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
};

export default function PriceAnalysisPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const initialProductId = '';

  const [summary, setSummary] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('recommendations');
  const [selectedProductId, setSelectedProductId] = useState(initialProductId);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [applyStatus, setApplyStatus] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchSummary = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/price-analysis/summary`, { headers: authHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Özet yüklenemedi');
    setSummary(data.summary || null);
  }, [authHeader]);

  const fetchRecommendations = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (selectedProductId) params.set('product_id', selectedProductId);

    const res = await fetch(`${API_URL}/api/price-analysis/recommendations?${params.toString()}`, {
      headers: authHeader(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Öneriler yüklenemedi');
    setRecommendations(data.recommendations || []);
  }, [authHeader, selectedProductId, statusFilter]);

  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedProductId) params.set('product_id', selectedProductId);
    const res = await fetch(`${API_URL}/api/price-analysis/history?${params.toString()}`, {
      headers: authHeader(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Geçmiş yüklenemedi');
    setHistory(data.history || []);
  }, [authHeader, selectedProductId]);

  const fetchAlerts = useCallback(async () => {
    const params = new URLSearchParams({ open_only: 'true' });
    if (selectedProductId) params.set('product_id', selectedProductId);
    const res = await fetch(`${API_URL}/api/price-analysis/alerts?${params.toString()}`, {
      headers: authHeader(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Uyarılar yüklenemedi');
    setAlerts(data.alerts || []);
  }, [authHeader, selectedProductId]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    setError('');
    try {
      await Promise.all([fetchSummary(), fetchRecommendations(), fetchHistory(), fetchAlerts()]);
    } catch (err) {
      setError(err.message || 'Veriler yüklenemedi');
    } finally {
      setFetching(false);
    }
  }, [token, fetchSummary, fetchRecommendations, fetchHistory, fetchAlerts]);

  useEffect(() => {
    if (user && token) fetchAll();
  }, [user, token, fetchAll]);

  const handleAnalyze = async (productId = '') => {
    setAnalyzing(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/price-analysis/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify(productId ? { product_id: Number(productId) } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analiz başlatılamadı');
      setSuccess(data.message || 'Analiz tamamlandı');
      if (productId) {
        setSelectedProductId(String(productId));
      }
      await fetchAll();
      setActiveTab('recommendations');
    } catch (err) {
      setError(err.message || 'Analiz başlatılamadı');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async (recommendationId) => {
    setApplyStatus((prev) => ({ ...prev, [recommendationId]: 'applying' }));
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/price-analysis/recommendations/${recommendationId}/apply`, {
        method: 'POST',
        headers: authHeader(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uygulama başarısız');
      setApplyStatus((prev) => ({ ...prev, [recommendationId]: 'done' }));
      setSuccess(data.message || 'Öneri uygulandı');
      await fetchAll();
    } catch (err) {
      setApplyStatus((prev) => ({ ...prev, [recommendationId]: 'error' }));
      setError(err.message || 'Uygulama başarısız');
    }
  };

  const handleReject = async (recommendationId) => {
    setRejectingId(recommendationId);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/price-analysis/recommendations/${recommendationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ reason: 'Panel üzerinden reddedildi' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reddetme başarısız');
      setSuccess(data.message || 'Öneri reddedildi');
      await fetchAll();
    } catch (err) {
      setError(err.message || 'Reddetme başarısız');
    } finally {
      setRejectingId(null);
    }
  };

  const visibleRecommendations = useMemo(() => recommendations, [recommendations]);

  if (loading) return <div style={styles.loading}>Yükleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.heading}>🤖 RadarAnaliz / Fiyat Analizi</h1>
            <p style={styles.subheading}>Ürün bazlı öneriler, risk uyarıları ve uygulama geçmişi tek ekranda.</p>
          </div>
          <div style={styles.headerActions}>
            <button onClick={() => handleAnalyze(selectedProductId)} style={styles.btnPrimary} disabled={analyzing}>
              {analyzing ? 'Analiz çalışıyor...' : selectedProductId ? 'Seçili ürünü analiz et' : 'Toplu analizi başlat'}
            </button>
            <button onClick={() => fetchAll()} style={styles.btnSecondary}>Yenile</button>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.summaryGrid}>
          <SummaryCard title="Bekleyen öneri" value={summary?.recommendations?.pending ?? 0} hint="Henüz uygulanmamış fiyat kararları" />
          <SummaryCard title="Uygulanan öneri" value={summary?.recommendations?.applied ?? 0} hint="Sistemde fiyatı güncellenmiş kayıtlar" />
          <SummaryCard title="Yüksek risk" value={summary?.recommendations?.high_risk ?? 0} hint="Manuel takip gerektiren öneriler" />
          <SummaryCard title="Açık uyarı" value={summary?.alerts?.open ?? 0} hint={`Kritik: ${summary?.alerts?.critical ?? 0}`} />
        </div>

        <div style={styles.filterBar}>
          <label style={styles.filterLabel}>
            Ürün ID
            <input
              type="number"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              placeholder="Tüm ürünler"
              style={styles.input}
            />
          </label>
          <label style={styles.filterLabel}>
            Öneri Durumu
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.input}>
              <option value="pending">Bekleyen</option>
              <option value="applied">Uygulanan</option>
              <option value="rejected">Reddedilen</option>
              <option value="">Tümü</option>
            </select>
          </label>
          <button onClick={() => fetchAll()} style={styles.btnSecondary}>Filtreyi uygula</button>
          <button onClick={() => { setSelectedProductId(''); setStatusFilter('pending'); }} style={styles.btnGhost}>Sıfırla</button>
        </div>

        <div style={styles.tabs}>
          {[
            ['recommendations', 'Öneriler'],
            ['history', 'Geçmiş'],
            ['alerts', 'Uyarılar'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              style={{ ...styles.tab, ...(activeTab === value ? styles.activeTab : {}) }}
            >
              {label}
            </button>
          ))}
        </div>

        {fetching ? (
          <div style={styles.loading}>Fiyat analizi verileri yükleniyor...</div>
        ) : activeTab === 'recommendations' ? (
          visibleRecommendations.length === 0 ? (
            <div style={styles.empty}>Bu filtreyle eşleşen öneri bulunamadı.</div>
          ) : (
            <div style={styles.grid}>
              {visibleRecommendations.map((r) => (
                <div key={r.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={styles.cardTitle}>{r.product_name || `Ürün #${r.product_id}`}</div>
                      <div style={styles.cardMeta}>#{r.product_id} • {r.stock_code || 'Stok kodu yok'} • {r.marketplace_name || 'Pazaryeri yok'}</div>
                    </div>
                    <RiskBadge risk={r.risk_level} />
                  </div>

                  <div style={styles.metricGrid}>
                    <MetricRow label="Mevcut fiyat" value={formatPrice(r.current_price)} />
                    <MetricRow label="Önerilen fiyat" value={formatPrice(r.recommended_price)} valueStyle={styles.metricAccent} />
                    <MetricRow label="Taban fiyat" value={formatPrice(r.floor_price)} />
                    <MetricRow label="Hedef fiyat" value={formatPrice(r.target_price)} />
                    <MetricRow label="Rakip fiyat" value={r.competitor_price == null ? '—' : formatPrice(r.competitor_price)} />
                    <MetricRow label="Firma min fiyat" value={formatPrice(r.brand_min_price)} />
                    <MetricRow label="Korunan taban" value={formatPrice(r.protected_floor)} />
                    <MetricRow label="İndirim düzeltilmiş" value={formatPrice(r.discount_adjusted_protected_price)} />
                    <MetricRow label="Müşteri fiyatı" value={formatPrice(r.customer_seen_price)} />
                    <MetricRow label="Kargo" value={formatPrice(r.shipping_cost)} />
                    <MetricRow label="Komisyon" value={formatPrice(r.commission_amount)} />
                    <MetricRow label="Ek kesintiler" value={formatPrice(r.extra_deductions_total)} />
                    <MetricRow label="Mevcut marj" value={formatPercent(r.current_margin_rate)} />
                    <MetricRow label="Beklenen marj" value={formatPercent(r.projected_margin_rate)} />
                    <MetricRow label="Güven" value={`${Math.round((Number(r.confidence) || 0) * 100)}%`} />
                  </div>

                  <div style={styles.reasonBox}>
                    <div>{r.reason || 'Açıklama üretilmedi.'}</div>
                    {Array.isArray(r.reasons) && r.reasons.length > 0 && (
                      <ul style={styles.reasonList}>
                        {r.reasons.slice(0, 8).map((item, idx) => <li key={idx}>{item}</li>)}
                      </ul>
                    )}
                    {(r.metadata?.shipping_rule_scope || r.metadata?.marketplace_rule_scope) && (
                      <div style={styles.ruleMeta}>
                        Fiyat kuralı: <strong>{r.metadata?.marketplace_rule_scope || '—'}</strong> · Kargo kuralı: <strong>{r.metadata?.shipping_rule_scope || '—'}</strong>
                      </div>
                    )}
                  </div>

                  <div style={styles.badgeRow}>
                    <span style={styles.typeBadge}>{translateType(r.recommendation_type)}</span>
                    <span style={styles.statusBadge}>{translateStatus(r.status)}</span>
                    <span style={styles.qualityBadge}>Kalite Skoru: {r.quality_score ?? 0}</span>
                  </div>

                  <div style={styles.cardActions}>
                    <button onClick={() => handleAnalyze(r.product_id)} style={styles.smallBtn}>Ürünü yeniden analiz et</button>
                    {r.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApply(r.id)}
                          style={styles.applyBtn}
                          disabled={applyStatus[r.id] === 'applying'}
                        >
                          {applyStatus[r.id] === 'applying' ? 'Uygulanıyor...' : applyStatus[r.id] === 'done' ? '✅ Uygulandı' : 'Öneriyi uygula'}
                        </button>
                        <button
                          onClick={() => handleReject(r.id)}
                          style={styles.rejectBtn}
                          disabled={rejectingId === r.id}
                        >
                          {rejectingId === r.id ? 'Reddediliyor...' : 'Reddet'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'history' ? (
          history.length === 0 ? (
            <div style={styles.empty}>Fiyat geçmişi bulunamadı.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Ürün</th>
                    <th style={styles.th}>Eski Fiyat</th>
                    <th style={styles.th}>Yeni Fiyat</th>
                    <th style={styles.th}>Neden</th>
                    <th style={styles.th}>Uygulayan</th>
                    <th style={styles.th}>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} style={styles.tr}>
                      <td style={styles.td}>{item.product_name} <div style={styles.tableSub}>#{item.product_id} • {item.stock_code || '—'}</div></td>
                      <td style={styles.td}>{formatPrice(item.old_price)}</td>
                      <td style={styles.td}>{formatPrice(item.new_price)}</td>
                      <td style={styles.td}>{item.change_reason || '—'}</td>
                      <td style={styles.td}>{item.changed_by || '—'}</td>
                      <td style={styles.td}>{item.date ? new Date(item.date).toLocaleString('tr-TR') : '—'}</td>
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
          )
        ) : alerts.length === 0 ? (
          <div style={styles.empty}>Açık uyarı bulunamadı.</div>
        ) : (
          <div style={styles.alertList}>
            {alerts.map((alert) => (
              <div key={alert.id} style={styles.alertCard}>
                <div style={styles.alertHeader}>
                  <div>
                    <div style={styles.alertTitle}>{alert.title}</div>
                    <div style={styles.cardMeta}>{alert.product_name || 'Ürün yok'} • {alert.stock_code || 'Stok kodu yok'} • {alert.marketplace_name || 'Pazaryeri yok'}</div>
                  </div>
                  <span style={{ ...styles.alertSeverity, ...(alert.severity === 'high' ? styles.alertHigh : styles.alertMedium) }}>
                    {alert.severity === 'high' ? 'Yüksek' : 'Orta'}
                  </span>
                </div>
                <div style={styles.reasonBox}>{alert.message}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function SummaryCard({ title, value, hint }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryTitle}>{title}</div>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summaryHint}>{hint}</div>
    </div>
  );
}

function MetricRow({ label, value, valueStyle }) {
  return (
    <div style={styles.metricRow}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, ...(valueStyle || {}) }}>{value}</span>
    </div>
  );
}

function RiskBadge({ risk }) {
  const style = risk === 'high' ? styles.riskHigh : risk === 'medium' ? styles.riskMedium : styles.riskLow;
  return <span style={{ ...styles.riskBadge, ...style }}>{translateRisk(risk)}</span>;
}

function translateRisk(risk) {
  if (risk === 'high') return 'Yüksek Risk';
  if (risk === 'medium') return 'Orta Risk';
  return 'Düşük Risk';
}

function translateType(type) {
  if (type === 'increase') return 'Fiyat artışı';
  if (type === 'decrease') return 'Fiyat indirimi';
  if (type === 'manual_review') return 'Manuel inceleme';
  return 'Korunsun';
}

function translateStatus(status) {
  if (status === 'applied') return 'Uygulandı';
  if (status === 'rejected') return 'Reddedildi';
  return 'Bekliyor';
}

const styles = {
  loading: { padding: '40px', textAlign: 'center', fontSize: '18px' },
  main: { padding: '32px', maxWidth: '1400px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap' },
  heading: { fontSize: '30px', color: '#1f2937', margin: 0 },
  subheading: { margin: '8px 0 0', color: '#6b7280', fontSize: '14px' },
  headerActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  btnPrimary: { padding: '10px 18px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  btnSecondary: { padding: '10px 18px', backgroundColor: '#0f766e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  btnGhost: { padding: '10px 18px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  error: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' },
  success: { backgroundColor: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' },
  summaryCard: { backgroundColor: '#fff', borderRadius: '14px', padding: '18px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)' },
  summaryTitle: { fontSize: '13px', color: '#6b7280', marginBottom: '10px' },
  summaryValue: { fontSize: '30px', fontWeight: 700, color: '#111827', marginBottom: '8px' },
  summaryHint: { fontSize: '12px', color: '#6b7280' },
  filterBar: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px', backgroundColor: '#fff', padding: '16px', borderRadius: '14px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)' },
  filterLabel: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#374151', minWidth: '180px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', minWidth: '160px' },
  tabs: { display: 'flex', gap: '10px', marginBottom: '18px' },
  tab: { padding: '10px 18px', borderRadius: '999px', border: 'none', backgroundColor: '#e5e7eb', color: '#374151', cursor: 'pointer' },
  activeTab: { backgroundColor: '#1d4ed8', color: '#fff' },
  empty: { backgroundColor: '#fff', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#6b7280', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '14px' },
  cardTitle: { fontSize: '18px', fontWeight: 700, color: '#111827' },
  cardMeta: { marginTop: '6px', fontSize: '12px', color: '#6b7280' },
  riskBadge: { padding: '6px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' },
  riskHigh: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  riskMedium: { backgroundColor: '#fef3c7', color: '#92400e' },
  riskLow: { backgroundColor: '#dcfce7', color: '#166534' },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginBottom: '14px' },
  metricRow: { backgroundColor: '#f8fafc', borderRadius: '10px', padding: '10px 12px' },
  metricLabel: { display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' },
  metricValue: { fontSize: '15px', color: '#111827', fontWeight: 600 },
  metricAccent: { color: '#059669' },
  reasonBox: { backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', fontSize: '13px', color: '#334155', lineHeight: 1.5 },
  reasonList: { margin: '8px 0 0 18px', padding: 0 },
  ruleMeta: { marginTop: '8px', fontSize: '12px', color: '#475569' },
  badgeRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' },
  typeBadge: { backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '6px 10px', borderRadius: '999px', fontSize: '12px' },
  statusBadge: { backgroundColor: '#ede9fe', color: '#6d28d9', padding: '6px 10px', borderRadius: '999px', fontSize: '12px' },
  qualityBadge: { backgroundColor: '#e5e7eb', color: '#374151', padding: '6px 10px', borderRadius: '999px', fontSize: '12px' },
  cardActions: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' },
  smallBtn: { padding: '9px 12px', border: 'none', backgroundColor: '#e5e7eb', color: '#1f2937', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  applyBtn: { padding: '9px 12px', border: 'none', backgroundColor: '#16a34a', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  rejectBtn: { padding: '9px 12px', border: 'none', backgroundColor: '#dc2626', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  tableWrap: { overflowX: 'auto', backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 14px', textAlign: 'left', backgroundColor: '#111827', color: '#fff', fontSize: '13px' },
  tr: { borderBottom: '1px solid #e5e7eb' },
  td: { padding: '12px 14px', fontSize: '13px', color: '#111827', verticalAlign: 'top' },
  tableSub: { color: '#6b7280', marginTop: '4px', fontSize: '12px' },
  alertList: { display: 'grid', gap: '14px' },
  alertCard: { backgroundColor: '#fff', borderRadius: '14px', padding: '18px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)' },
  alertHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' },
  alertTitle: { fontSize: '16px', fontWeight: 700, color: '#111827' },
  alertSeverity: { padding: '6px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 },
  alertHigh: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  alertMedium: { backgroundColor: '#fef3c7', color: '#92400e' },
};
