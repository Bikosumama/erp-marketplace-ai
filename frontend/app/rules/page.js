'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const emptyMarketplaceRule = {
  scope_type: 'general',
  marketplace_id: '',
  category_id: '',
  product_id: '',
  priority: 0,
  commission_rate: 18,
  commission_base: 'net_ex_vat',
  vat_rate: 20,
  fixed_fee: 0,
  marketplace_discount_rate: 0,
  marketplace_discount_funded: false,
  rounding_ending: 0.9,
  min_margin_rate: 10,
  target_margin_rate: 18,
  is_active: true,
  notes: '',
};

const emptyShippingRule = {
  scope_type: 'general',
  marketplace_id: '',
  min_price: 0,
  max_price: '',
  shipping_cost: 0,
  priority: 0,
  is_active: true,
  notes: '',
};

const emptyProfitTarget = {
  scope_type: 'general',
  marketplace_id: '',
  category_id: '',
  product_id: '',
  priority: 0,
  min_margin_rate: 10,
  target_margin_rate: 18,
  is_active: true,
  notes: '',
};

const emptyExtraDeduction = {
  marketplace_rule_id: '',
  name: 'Stopaj',
  deduction_type: 'withholding',
  calculation_type: 'percentage',
  base_amount_type: 'net_ex_vat',
  rate: 1,
  fixed_amount: 0,
  priority: 0,
  is_active: true,
  notes: '',
};

function normalizeNumber(value) {
  return value === '' || value === null || value === undefined ? '' : Number(value);
}

export default function RulesPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('marketplace');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [marketplaces, setMarketplaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [marketplaceRules, setMarketplaceRules] = useState([]);
  const [shippingRules, setShippingRules] = useState([]);
  const [profitTargets, setProfitTargets] = useState([]);
  const [extraDeductions, setExtraDeductions] = useState([]);

  const [editingMarketplaceRuleId, setEditingMarketplaceRuleId] = useState(null);
  const [editingShippingRuleId, setEditingShippingRuleId] = useState(null);
  const [editingProfitTargetId, setEditingProfitTargetId] = useState(null);
  const [editingExtraDeductionId, setEditingExtraDeductionId] = useState(null);

  const [marketplaceForm, setMarketplaceForm] = useState(emptyMarketplaceRule);
  const [shippingForm, setShippingForm] = useState(emptyShippingRule);
  const [profitForm, setProfitForm] = useState(emptyProfitTarget);
  const [extraForm, setExtraForm] = useState(emptyExtraDeduction);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoadingData(true);
    setError('');
    try {
      const [marketplacesRes, categoriesRes, productsRes, mrRes, srRes, ptRes, edRes] = await Promise.all([
        fetch(`${API_URL}/api/marketplaces`, { headers: authHeader() }),
        fetch(`${API_URL}/api/categories`, { headers: authHeader() }),
        fetch(`${API_URL}/api/products`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/marketplace`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/shipping`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/profit-targets`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/extra-deductions`, { headers: authHeader() }),
      ]);

      const [marketplacesData, categoriesData, productsData, mrData, srData, ptData, edData] = await Promise.all([
        marketplacesRes.json(),
        categoriesRes.json(),
        productsRes.json(),
        mrRes.json(),
        srRes.json(),
        ptRes.json(),
        edRes.json(),
      ]);

      setMarketplaces(marketplacesData.marketplaces || []);
      setCategories(categoriesData.categories || []);
      setProducts(productsData.products || []);
      setMarketplaceRules(mrData.rules || []);
      setShippingRules(srData.rules || []);
      setProfitTargets(ptData.rules || []);
      setExtraDeductions(edData.rules || []);
    } catch (err) {
      setError(err.message || 'Kural verileri yüklenemedi');
    } finally {
      setLoadingData(false);
    }
  }, [token, authHeader]);

  useEffect(() => {
    if (user && token) fetchAll();
  }, [user, token, fetchAll]);

  const categoryOptions = useMemo(() => buildCategoryTree(categories), [categories]);

  async function submitForm(url, method, payload, successMessage) {
    setError('');
    setSuccess('');
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'İşlem başarısız');
    setSuccess(successMessage);
    await fetchAll();
    return data;
  }

  async function deleteRule(url, successMessage) {
    setError('');
    setSuccess('');
    const res = await fetch(url, { method: 'DELETE', headers: authHeader() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Silme başarısız');
    setSuccess(successMessage);
    await fetchAll();
  }

  async function handleMarketplaceSubmit(e) {
    e.preventDefault();
    try {
      await submitForm(
        `${API_URL}/api/rules/marketplace${editingMarketplaceRuleId ? `/${editingMarketplaceRuleId}` : ''}`,
        editingMarketplaceRuleId ? 'PUT' : 'POST',
        marketplaceForm,
        editingMarketplaceRuleId ? 'Pazaryeri kuralı güncellendi' : 'Pazaryeri kuralı eklendi'
      );
      setMarketplaceForm(emptyMarketplaceRule);
      setEditingMarketplaceRuleId(null);
    } catch (err) { setError(err.message); }
  }

  async function handleShippingSubmit(e) {
    e.preventDefault();
    try {
      await submitForm(
        `${API_URL}/api/rules/shipping${editingShippingRuleId ? `/${editingShippingRuleId}` : ''}`,
        editingShippingRuleId ? 'PUT' : 'POST',
        shippingForm,
        editingShippingRuleId ? 'Kargo kuralı güncellendi' : 'Kargo kuralı eklendi'
      );
      setShippingForm(emptyShippingRule);
      setEditingShippingRuleId(null);
    } catch (err) { setError(err.message); }
  }

  async function handleProfitSubmit(e) {
    e.preventDefault();
    try {
      await submitForm(
        `${API_URL}/api/rules/profit-targets${editingProfitTargetId ? `/${editingProfitTargetId}` : ''}`,
        editingProfitTargetId ? 'PUT' : 'POST',
        profitForm,
        editingProfitTargetId ? 'Kâr hedefi güncellendi' : 'Kâr hedefi eklendi'
      );
      setProfitForm(emptyProfitTarget);
      setEditingProfitTargetId(null);
    } catch (err) { setError(err.message); }
  }

  async function handleExtraSubmit(e) {
    e.preventDefault();
    try {
      await submitForm(
        `${API_URL}/api/rules/extra-deductions${editingExtraDeductionId ? `/${editingExtraDeductionId}` : ''}`,
        editingExtraDeductionId ? 'PUT' : 'POST',
        extraForm,
        editingExtraDeductionId ? 'Ek kesinti güncellendi' : 'Ek kesinti eklendi'
      );
      setExtraForm(emptyExtraDeduction);
      setEditingExtraDeductionId(null);
    } catch (err) { setError(err.message); }
  }

  if (loading) return <div style={styles.loading}>Yükleniyor...</div>;
  if (!user) return null;

  return (
    <>
      <Navigation />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.heading}>⚙️ Kurallar Merkezi</h1>
            <p style={styles.subheading}>General fallback, pazaryeri bazlı baremler, ek kesintiler ve kâr hedefleri bu ekrandan yönetilir.</p>
          </div>
          <button onClick={fetchAll} style={styles.refreshBtn}>Yenile</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.tabs}>
          {[
            ['marketplace', 'Pazaryeri Kuralları'],
            ['shipping', 'Kargo Baremleri'],
            ['profit', 'Kâr Hedefleri'],
            ['deductions', 'Ek Kesintiler'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{ ...styles.tab, ...(activeTab === key ? styles.activeTab : {}) }}>
              {label}
            </button>
          ))}
        </div>

        {loadingData ? <div style={styles.loading}>Kurallar yükleniyor...</div> : (
          <div style={styles.sectionWrap}>
            {activeTab === 'marketplace' && (
              <>
                <RuleFormCard title={editingMarketplaceRuleId ? 'Pazaryeri Kuralını Düzenle' : 'Yeni Pazaryeri Kuralı'}>
                  <form onSubmit={handleMarketplaceSubmit} style={styles.formGrid}>
                    <SelectField label="Kapsam" value={marketplaceForm.scope_type} onChange={(value) => setMarketplaceForm((f) => ({ ...f, scope_type: value }))} options={[['general','General'],['marketplace','Pazaryeri'],['category','Kategori'],['product','Ürün']]} />
                    <SelectField label="Pazaryeri" value={marketplaceForm.marketplace_id} onChange={(value) => setMarketplaceForm((f) => ({ ...f, marketplace_id: value }))} options={[['','—'], ...marketplaces.map((m) => [String(m.id), m.marketplace_name])]} />
                    <SelectField label="Kategori" value={marketplaceForm.category_id} onChange={(value) => setMarketplaceForm((f) => ({ ...f, category_id: value }))} options={[['','—'], ...categoryOptions.map((c) => [String(c.id), c.label])]} />
                    <SelectField label="Ürün" value={marketplaceForm.product_id} onChange={(value) => setMarketplaceForm((f) => ({ ...f, product_id: value }))} options={[['','—'], ...products.slice(0, 200).map((p) => [String(p.id), `${p.stock_code} - ${p.name}`])]} />
                    <NumberField label="Öncelik" value={marketplaceForm.priority} onChange={(value) => setMarketplaceForm((f) => ({ ...f, priority: value }))} />
                    <NumberField label="Komisyon %" value={marketplaceForm.commission_rate} onChange={(value) => setMarketplaceForm((f) => ({ ...f, commission_rate: value }))} />
                    <SelectField label="Komisyon Tabanı" value={marketplaceForm.commission_base} onChange={(value) => setMarketplaceForm((f) => ({ ...f, commission_base: value }))} options={[['net_ex_vat','KDV Hariç'],['gross_price','Brüt Fiyat']]} />
                    <NumberField label="KDV %" value={marketplaceForm.vat_rate} onChange={(value) => setMarketplaceForm((f) => ({ ...f, vat_rate: value }))} />
                    <NumberField label="Sabit Ücret" value={marketplaceForm.fixed_fee} onChange={(value) => setMarketplaceForm((f) => ({ ...f, fixed_fee: value }))} />
                    <NumberField label="Minimum Marj %" value={marketplaceForm.min_margin_rate} onChange={(value) => setMarketplaceForm((f) => ({ ...f, min_margin_rate: value }))} />
                    <NumberField label="Hedef Marj %" value={marketplaceForm.target_margin_rate} onChange={(value) => setMarketplaceForm((f) => ({ ...f, target_margin_rate: value }))} />
                    <NumberField label="Pazaryeri İndirimi %" value={marketplaceForm.marketplace_discount_rate} onChange={(value) => setMarketplaceForm((f) => ({ ...f, marketplace_discount_rate: value }))} />
                    <NumberField label=",90 Yuvarlama" step="0.01" value={marketplaceForm.rounding_ending} onChange={(value) => setMarketplaceForm((f) => ({ ...f, rounding_ending: value }))} />
                    <CheckboxField label="İndirim korumaya dahil" checked={marketplaceForm.marketplace_discount_funded} onChange={(value) => setMarketplaceForm((f) => ({ ...f, marketplace_discount_funded: value }))} />
                    <CheckboxField label="Aktif" checked={marketplaceForm.is_active} onChange={(value) => setMarketplaceForm((f) => ({ ...f, is_active: value }))} />
                    <TextField label="Not" value={marketplaceForm.notes} onChange={(value) => setMarketplaceForm((f) => ({ ...f, notes: value }))} full />
                    <FormActions onCancel={() => { setMarketplaceForm(emptyMarketplaceRule); setEditingMarketplaceRuleId(null); }} />
                  </form>
                </RuleFormCard>
                <RuleTableCard title="Kayıtlı Pazaryeri Kuralları">
                  <SimpleTable headers={['Scope','Pazaryeri','Kategori','Ürün','Komisyon','Min %','Hedef %','İndirim %','Aktif','İşlem']} rows={marketplaceRules.map((row) => [
                    row.scope_type,
                    row.marketplace_name || 'General',
                    row.category_name || '—',
                    row.product_name || '—',
                    `${normalizeNumber(row.commission_rate) || 0}%`,
                    `${normalizeNumber(row.min_margin_rate ?? row.minimum_profit_margin) || 0}%`,
                    `${normalizeNumber(row.target_margin_rate ?? row.target_profit_margin) || 0}%`,
                    `${normalizeNumber(row.marketplace_discount_rate) || 0}%`,
                    row.is_active ? 'Evet' : 'Hayır',
                    <ActionButtons onEdit={() => { setEditingMarketplaceRuleId(row.id); setMarketplaceForm({ ...emptyMarketplaceRule, ...row, marketplace_id: row.marketplace_id || '', category_id: row.category_id || '', product_id: row.product_id || '' }); }} onDelete={async () => { try { await deleteRule(`${API_URL}/api/rules/marketplace/${row.id}`, 'Pazaryeri kuralı silindi'); } catch (err) { setError(err.message); } }} />,
                  ])} />
                </RuleTableCard>
              </>
            )}

            {activeTab === 'shipping' && (
              <>
                <RuleFormCard title={editingShippingRuleId ? 'Kargo Baremini Düzenle' : 'Yeni Kargo Baremi'}>
                  <form onSubmit={handleShippingSubmit} style={styles.formGrid}>
                    <SelectField label="Kapsam" value={shippingForm.scope_type} onChange={(value) => setShippingForm((f) => ({ ...f, scope_type: value }))} options={[['general','General'],['marketplace','Pazaryeri']]} />
                    <SelectField label="Pazaryeri" value={shippingForm.marketplace_id} onChange={(value) => setShippingForm((f) => ({ ...f, marketplace_id: value }))} options={[['','—'], ...marketplaces.map((m) => [String(m.id), m.marketplace_name])]} />
                    <NumberField label="Min Fiyat" value={shippingForm.min_price} onChange={(value) => setShippingForm((f) => ({ ...f, min_price: value }))} />
                    <NumberField label="Max Fiyat" value={shippingForm.max_price} onChange={(value) => setShippingForm((f) => ({ ...f, max_price: value }))} />
                    <NumberField label="Kargo Ücreti" value={shippingForm.shipping_cost} onChange={(value) => setShippingForm((f) => ({ ...f, shipping_cost: value }))} />
                    <NumberField label="Öncelik" value={shippingForm.priority} onChange={(value) => setShippingForm((f) => ({ ...f, priority: value }))} />
                    <CheckboxField label="Aktif" checked={shippingForm.is_active} onChange={(value) => setShippingForm((f) => ({ ...f, is_active: value }))} />
                    <TextField label="Not" value={shippingForm.notes} onChange={(value) => setShippingForm((f) => ({ ...f, notes: value }))} full />
                    <FormActions onCancel={() => { setShippingForm(emptyShippingRule); setEditingShippingRuleId(null); }} />
                  </form>
                </RuleFormCard>
                <RuleTableCard title="Kayıtlı Kargo Baremleri">
                  <SimpleTable headers={['Scope','Pazaryeri','Min Fiyat','Max Fiyat','Kargo','Aktif','İşlem']} rows={shippingRules.map((row) => [
                    row.scope_type,
                    row.marketplace_name || 'General',
                    row.min_price,
                    row.max_price ?? '∞',
                    row.shipping_cost,
                    row.is_active ? 'Evet' : 'Hayır',
                    <ActionButtons onEdit={() => { setEditingShippingRuleId(row.id); setShippingForm({ ...emptyShippingRule, ...row, marketplace_id: row.marketplace_id || '' }); }} onDelete={async () => { try { await deleteRule(`${API_URL}/api/rules/shipping/${row.id}`, 'Kargo baremi silindi'); } catch (err) { setError(err.message); } }} />,
                  ])} />
                </RuleTableCard>
              </>
            )}

            {activeTab === 'profit' && (
              <>
                <RuleFormCard title={editingProfitTargetId ? 'Kâr Hedefini Düzenle' : 'Yeni Kâr Hedefi'}>
                  <form onSubmit={handleProfitSubmit} style={styles.formGrid}>
                    <SelectField label="Kapsam" value={profitForm.scope_type} onChange={(value) => setProfitForm((f) => ({ ...f, scope_type: value }))} options={[['general','General'],['marketplace','Pazaryeri'],['category','Kategori'],['product','Ürün']]} />
                    <SelectField label="Pazaryeri" value={profitForm.marketplace_id} onChange={(value) => setProfitForm((f) => ({ ...f, marketplace_id: value }))} options={[['','—'], ...marketplaces.map((m) => [String(m.id), m.marketplace_name])]} />
                    <SelectField label="Kategori" value={profitForm.category_id} onChange={(value) => setProfitForm((f) => ({ ...f, category_id: value }))} options={[['','—'], ...categoryOptions.map((c) => [String(c.id), c.label])]} />
                    <SelectField label="Ürün" value={profitForm.product_id} onChange={(value) => setProfitForm((f) => ({ ...f, product_id: value }))} options={[['','—'], ...products.slice(0, 200).map((p) => [String(p.id), `${p.stock_code} - ${p.name}`])]} />
                    <NumberField label="Minimum Marj %" value={profitForm.min_margin_rate} onChange={(value) => setProfitForm((f) => ({ ...f, min_margin_rate: value }))} />
                    <NumberField label="Hedef Marj %" value={profitForm.target_margin_rate} onChange={(value) => setProfitForm((f) => ({ ...f, target_margin_rate: value }))} />
                    <NumberField label="Öncelik" value={profitForm.priority} onChange={(value) => setProfitForm((f) => ({ ...f, priority: value }))} />
                    <CheckboxField label="Aktif" checked={profitForm.is_active} onChange={(value) => setProfitForm((f) => ({ ...f, is_active: value }))} />
                    <TextField label="Not" value={profitForm.notes} onChange={(value) => setProfitForm((f) => ({ ...f, notes: value }))} full />
                    <FormActions onCancel={() => { setProfitForm(emptyProfitTarget); setEditingProfitTargetId(null); }} />
                  </form>
                </RuleFormCard>
                <RuleTableCard title="Kayıtlı Kâr Hedefleri">
                  <SimpleTable headers={['Scope','Pazaryeri','Kategori','Ürün','Min %','Hedef %','Aktif','İşlem']} rows={profitTargets.map((row) => [
                    row.scope_type,
                    row.marketplace_name || 'General',
                    row.category_name || '—',
                    row.product_name || '—',
                    `${normalizeNumber(row.min_margin_rate ?? row.min_profit_margin) || 0}%`,
                    `${normalizeNumber(row.target_margin_rate ?? row.target_profit_margin) || 0}%`,
                    row.is_active ? 'Evet' : 'Hayır',
                    <ActionButtons onEdit={() => { setEditingProfitTargetId(row.id); setProfitForm({ ...emptyProfitTarget, ...row, marketplace_id: row.marketplace_id || '', category_id: row.category_id || '', product_id: row.product_id || '' }); }} onDelete={async () => { try { await deleteRule(`${API_URL}/api/rules/profit-targets/${row.id}`, 'Kâr hedefi silindi'); } catch (err) { setError(err.message); } }} />,
                  ])} />
                </RuleTableCard>
              </>
            )}

            {activeTab === 'deductions' && (
              <>
                <RuleFormCard title={editingExtraDeductionId ? 'Ek Kesintiyi Düzenle' : 'Yeni Ek Kesinti'}>
                  <form onSubmit={handleExtraSubmit} style={styles.formGrid}>
                    <SelectField label="Bağlı Fiyat Kuralı" value={extraForm.marketplace_rule_id} onChange={(value) => setExtraForm((f) => ({ ...f, marketplace_rule_id: value }))} options={[['','—'], ...marketplaceRules.map((r) => [String(r.id), `#${r.id} ${r.scope_type} / ${r.marketplace_name || 'General'}`])]} />
                    <TextField label="Ad" value={extraForm.name} onChange={(value) => setExtraForm((f) => ({ ...f, name: value }))} />
                    <SelectField label="Tür" value={extraForm.deduction_type} onChange={(value) => setExtraForm((f) => ({ ...f, deduction_type: value }))} options={[['withholding','Stopaj'],['service_fee','Hizmet Bedeli'],['campaign_fee','Kampanya Katkısı'],['other','Diğer']]} />
                    <SelectField label="Hesap Tipi" value={extraForm.calculation_type} onChange={(value) => setExtraForm((f) => ({ ...f, calculation_type: value }))} options={[['percentage','Yüzde'],['fixed','Sabit Tutar']]} />
                    <SelectField label="Hesap Tabanı" value={extraForm.base_amount_type} onChange={(value) => setExtraForm((f) => ({ ...f, base_amount_type: value }))} options={[['net_ex_vat','KDV Hariç'],['gross_price','Brüt Fiyat'],['net_after_commission','Komisyon Sonrası']]} />
                    <NumberField label="Oran %" value={extraForm.rate} onChange={(value) => setExtraForm((f) => ({ ...f, rate: value }))} />
                    <NumberField label="Sabit Tutar" value={extraForm.fixed_amount} onChange={(value) => setExtraForm((f) => ({ ...f, fixed_amount: value }))} />
                    <NumberField label="Öncelik" value={extraForm.priority} onChange={(value) => setExtraForm((f) => ({ ...f, priority: value }))} />
                    <CheckboxField label="Aktif" checked={extraForm.is_active} onChange={(value) => setExtraForm((f) => ({ ...f, is_active: value }))} />
                    <TextField label="Not" value={extraForm.notes} onChange={(value) => setExtraForm((f) => ({ ...f, notes: value }))} full />
                    <FormActions onCancel={() => { setExtraForm(emptyExtraDeduction); setEditingExtraDeductionId(null); }} />
                  </form>
                </RuleFormCard>
                <RuleTableCard title="Kayıtlı Ek Kesintiler">
                  <SimpleTable headers={['Ad','Kural','Tip','Taban','Oran','Sabit','Aktif','İşlem']} rows={extraDeductions.map((row) => [
                    row.name,
                    `${row.marketplace_rule_scope || '—'} / ${row.marketplace_name || 'General'}`,
                    row.calculation_type,
                    row.base_amount_type,
                    row.rate,
                    row.fixed_amount,
                    row.is_active ? 'Evet' : 'Hayır',
                    <ActionButtons onEdit={() => { setEditingExtraDeductionId(row.id); setExtraForm({ ...emptyExtraDeduction, ...row, marketplace_rule_id: row.marketplace_rule_id || '' }); }} onDelete={async () => { try { await deleteRule(`${API_URL}/api/rules/extra-deductions/${row.id}`, 'Ek kesinti silindi'); } catch (err) { setError(err.message); } }} />,
                  ])} />
                </RuleTableCard>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function buildCategoryTree(categories, parentId = null, depth = 0) {
  return categories
    .filter((c) => (c.parent_id === null || c.parent_id === undefined ? parentId === null : parseInt(c.parent_id, 10) === parentId))
    .flatMap((c) => [
      { id: c.id, label: '  '.repeat(depth) + (depth > 0 ? '└ ' : '') + c.name },
      ...buildCategoryTree(categories, c.id, depth + 1),
    ]);
}

function RuleFormCard({ title, children }) {
  return <section style={styles.card}><h2 style={styles.cardTitle}>{title}</h2>{children}</section>;
}
function RuleTableCard({ title, children }) {
  return <section style={styles.card}><h2 style={styles.cardTitle}>{title}</h2>{children}</section>;
}
function TextField({ label, value, onChange, full = false }) {
  return <label style={{ ...styles.field, ...(full ? styles.fullWidth : {}) }}><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} /></label>;
}
function NumberField({ label, value, onChange, step = '0.01' }) {
  return <label style={styles.field}><span>{label}</span><input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} /></label>;
}
function SelectField({ label, value, onChange, options }) {
  return <label style={styles.field}><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>{options.map(([v, l]) => <option key={`${label}-${v}`} value={v}>{l}</option>)}</select></label>;
}
function CheckboxField({ label, checked, onChange }) {
  return <label style={styles.checkbox}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}
function FormActions({ onCancel }) {
  return <div style={styles.actions}><button type="submit" style={styles.saveBtn}>Kaydet</button><button type="button" onClick={onCancel} style={styles.cancelBtn}>Temizle</button></div>;
}
function ActionButtons({ onEdit, onDelete }) {
  return <div style={styles.rowActions}><button type="button" onClick={onEdit} style={styles.editBtn}>Düzenle</button><button type="button" onClick={onDelete} style={styles.deleteBtn}>Sil</button></div>;
}
function SimpleTable({ headers, rows }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead><tr>{headers.map((h) => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={`${i}-${j}`} style={styles.td}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  loading: { padding: '40px', textAlign: 'center', fontSize: '18px' },
  main: { padding: '32px', maxWidth: '1500px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' },
  heading: { fontSize: '30px', margin: 0, color: '#1f2937' },
  subheading: { marginTop: '8px', color: '#6b7280', fontSize: '14px' },
  refreshBtn: { padding: '10px 18px', border: 'none', borderRadius: '8px', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer' },
  error: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' },
  success: { backgroundColor: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' },
  tabs: { display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' },
  tab: { padding: '10px 18px', borderRadius: '999px', border: 'none', backgroundColor: '#e5e7eb', cursor: 'pointer' },
  activeTab: { backgroundColor: '#1d4ed8', color: '#fff' },
  sectionWrap: { display: 'grid', gap: '18px' },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)' },
  cardTitle: { marginTop: 0, marginBottom: '16px', color: '#111827' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#374151' },
  fullWidth: { gridColumn: '1 / -1' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' },
  checkbox: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151', paddingTop: '28px' },
  actions: { display: 'flex', gap: '10px', alignItems: 'center', gridColumn: '1 / -1', marginTop: '6px' },
  saveBtn: { padding: '10px 18px', border: 'none', borderRadius: '8px', backgroundColor: '#16a34a', color: '#fff', cursor: 'pointer' },
  cancelBtn: { padding: '10px 18px', border: 'none', borderRadius: '8px', backgroundColor: '#9ca3af', color: '#fff', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { backgroundColor: '#111827', color: '#fff', padding: '12px 14px', textAlign: 'left', fontSize: '13px' },
  td: { borderBottom: '1px solid #e5e7eb', padding: '12px 14px', fontSize: '13px', verticalAlign: 'top' },
  rowActions: { display: 'flex', gap: '8px' },
  editBtn: { padding: '8px 12px', border: 'none', borderRadius: '8px', backgroundColor: '#f59e0b', color: '#fff', cursor: 'pointer' },
  deleteBtn: { padding: '8px 12px', border: 'none', borderRadius: '8px', backgroundColor: '#dc2626', color: '#fff', cursor: 'pointer' },
};
