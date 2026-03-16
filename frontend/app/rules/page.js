'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Navigation from '../../components/Navigation';
import ExcelToolbar from '../../components/ExcelToolbar';
import { useAuth } from '../../context/AuthContext';
import { downloadExcelFile } from '../../lib/downloadExcel';

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

function buildCategoryTree(categories, parentId = null, depth = 0) {
  return categories
    .filter((category) => {
      if (category.parent_id === null || category.parent_id === undefined) {
        return parentId === null;
      }
      return Number(category.parent_id) === Number(parentId);
    })
    .flatMap((category) => [
      {
        id: category.id,
        label: `${depth > 0 ? `${' '.repeat(depth * 2)}└ ` : ''}${category.name}`,
      },
      ...buildCategoryTree(categories, category.id, depth + 1),
    ]);
}

function formatPercent(value) {
  if (value === '' || value === null || value === undefined) return '0%';
  const number = Number(value);
  return `${Number.isFinite(number) ? number : 0}%`;
}

function boolText(value) {
  return value ? 'Evet' : 'Hayır';
}

function errorMessageFrom(error) {
  return error?.message || 'İşlem sırasında hata oluştu';
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
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, router, user]);

  const authHeaders = useCallback(
    (extra = {}) => ({
      Authorization: `Bearer ${token}`,
      ...extra,
    }),
    [token]
  );

  const fetchJson = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...authHeaders(),
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'İstek başarısız');
      }
      return data;
    },
    [authHeaders]
  );

  const fetchAll = useCallback(async () => {
    if (!token) return;

    setLoadingData(true);
    setError('');

    try {
      const [
        marketplacesData,
        categoriesData,
        productsData,
        marketplaceRulesData,
        shippingRulesData,
        profitTargetsData,
        extraDeductionsData,
      ] = await Promise.all([
        fetchJson(`${API_URL}/api/marketplaces`, { method: 'GET' }),
        fetchJson(`${API_URL}/api/categories`, { method: 'GET' }),
        fetchJson(`${API_URL}/api/products`, { method: 'GET' }),
        fetchJson(`${API_URL}/api/rules/marketplace`, { method: 'GET' }),
        fetchJson(`${API_URL}/api/rules/shipping`, { method: 'GET' }),
        fetchJson(`${API_URL}/api/rules/profit-targets`, { method: 'GET' }),
        fetchJson(`${API_URL}/api/rules/extra-deductions`, { method: 'GET' }),
      ]);

      setMarketplaces(marketplacesData.marketplaces || []);
      setCategories(categoriesData.categories || []);
      setProducts(productsData.products || []);
      setMarketplaceRules(marketplaceRulesData.rules || []);
      setShippingRules(shippingRulesData.rules || []);
      setProfitTargets(profitTargetsData.rules || []);
      setExtraDeductions(extraDeductionsData.rules || []);
    } catch (fetchError) {
      setError(errorMessageFrom(fetchError));
    } finally {
      setLoadingData(false);
    }
  }, [fetchJson, token]);

  useEffect(() => {
    if (user && token) {
      fetchAll();
    }
  }, [fetchAll, token, user]);

  const categoryOptions = useMemo(() => buildCategoryTree(categories), [categories]);
  const productOptions = useMemo(
    () => products.slice(0, 200).map((product) => [String(product.id), `${product.stock_code} - ${product.name}`]),
    [products]
  );
  const marketplaceOptions = useMemo(
    () => marketplaces.map((marketplace) => [String(marketplace.id), marketplace.marketplace_name]),
    [marketplaces]
  );

  async function submitForm(url, method, payload, successMessage) {
    setError('');
    setSuccess('');
    await fetchJson(url, {
      method,
      body: JSON.stringify(payload),
    });
    setSuccess(successMessage);
    await fetchAll();
  }

  async function deleteRule(url, successMessage) {
    setError('');
    setSuccess('');
    await fetchJson(url, { method: 'DELETE' });
    setSuccess(successMessage);
    await fetchAll();
  }

  async function handleExport() {
    await downloadExcelFile({
      url: `${API_URL}/api/rules/export`,
      token,
      method: 'GET',
      defaultFilename: 'rules-export.xlsx',
    });
  }

  async function handleTemplateDownload() {
    await downloadExcelFile({
      url: `${API_URL}/api/rules/template`,
      token,
      method: 'GET',
      defaultFilename: 'rules-template.xlsx',
    });
  }

  async function handleImportFile(file) {
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/rules/import`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Excel içe aktarma başarısız');
    }

    const report = data.report || {};
    const summary = report.summary || {};
    const message = `İçe aktarma tamamlandı. Oluşturulan: ${summary.created || 0}, güncellenen: ${summary.updated || 0}, hatalı: ${summary.failed || 0}.`;

    setSuccess(message);

    if ((summary.failed || 0) > 0 && Array.isArray(report.errors) && report.errors.length > 0) {
      const detail = report.errors
        .slice(0, 6)
        .map((item) => `${item.sheet} / satır ${item.row}: ${item.message}`)
        .join(' | ');
      setError(`Bazı satırlar işlenemedi: ${detail}`);
    }

    await fetchAll();
  }

  async function handleMarketplaceSubmit(event) {
    event.preventDefault();
    try {
      await submitForm(
        `${API_URL}/api/rules/marketplace${editingMarketplaceRuleId ? `/${editingMarketplaceRuleId}` : ''}`,
        editingMarketplaceRuleId ? 'PUT' : 'POST',
        marketplaceForm,
        editingMarketplaceRuleId ? 'Pazaryeri kuralı güncellendi' : 'Pazaryeri kuralı eklendi'
      );
      setMarketplaceForm(emptyMarketplaceRule);
      setEditingMarketplaceRuleId(null);
    } catch (submitError) {
      setError(errorMessageFrom(submitError));
    }
  }

  async function handleShippingSubmit(event) {
    event.preventDefault();
    try {
      await submitForm(
        `${API_URL}/api/rules/shipping${editingShippingRuleId ? `/${editingShippingRuleId}` : ''}`,
        editingShippingRuleId ? 'PUT' : 'POST',
        shippingForm,
        editingShippingRuleId ? 'Kargo kuralı güncellendi' : 'Kargo kuralı eklendi'
      );
      setShippingForm(emptyShippingRule);
      setEditingShippingRuleId(null);
    } catch (submitError) {
      setError(errorMessageFrom(submitError));
    }
  }

  async function handleProfitSubmit(event) {
    event.preventDefault();
    try {
      await submitForm(
        `${API_URL}/api/rules/profit-targets${editingProfitTargetId ? `/${editingProfitTargetId}` : ''}`,
        editingProfitTargetId ? 'PUT' : 'POST',
        profitForm,
        editingProfitTargetId ? 'Kâr hedefi güncellendi' : 'Kâr hedefi eklendi'
      );
      setProfitForm(emptyProfitTarget);
      setEditingProfitTargetId(null);
    } catch (submitError) {
      setError(errorMessageFrom(submitError));
    }
  }

  async function handleExtraSubmit(event) {
    event.preventDefault();
    try {
      await submitForm(
        `${API_URL}/api/rules/extra-deductions${editingExtraDeductionId ? `/${editingExtraDeductionId}` : ''}`,
        editingExtraDeductionId ? 'PUT' : 'POST',
        extraForm,
        editingExtraDeductionId ? 'Ek kesinti güncellendi' : 'Ek kesinti eklendi'
      );
      setExtraForm(emptyExtraDeduction);
      setEditingExtraDeductionId(null);
    } catch (submitError) {
      setError(errorMessageFrom(submitError));
    }
  }

  if (loading) {
    return <div style={styles.loading}>Yükleniyor...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Navigation />
      <main style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.heading}>⚙️ Kurallar Merkezi</h1>
            <p style={styles.subheading}>
              General fallback, pazaryeri bazlı baremler, ek kesintiler ve kâr hedefleri bu ekrandan yönetilir.
            </p>
          </div>
          <button type="button" style={styles.refreshButton} onClick={fetchAll}>
            Yenile
          </button>
        </div>

        <ExcelToolbar
          onExport={handleExport}
          onImportFile={handleImportFile}
          onTemplateDownload={handleTemplateDownload}
        />

        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {success ? <div style={styles.successBox}>{success}</div> : null}

        <div style={styles.tabs}>
          {[
            ['marketplace', 'Pazaryeri Kuralları'],
            ['shipping', 'Kargo Baremleri'],
            ['profit', 'Kâr Hedefleri'],
            ['deductions', 'Ek Kesintiler'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                ...styles.tab,
                ...(activeTab === key ? styles.activeTab : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingData ? <div style={styles.loadingCard}>Kurallar yükleniyor...</div> : null}

        {!loadingData && activeTab === 'marketplace' ? (
          <div style={styles.sectionGrid}>
            <Card title={editingMarketplaceRuleId ? 'Pazaryeri Kuralını Düzenle' : 'Yeni Pazaryeri Kuralı'}>
              <form onSubmit={handleMarketplaceSubmit}>
                <div style={styles.formGrid}>
                  <SelectField
                    label="Kapsam"
                    value={marketplaceForm.scope_type}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, scope_type: value }))}
                    options={[
                      ['general', 'General'],
                      ['marketplace', 'Pazaryeri'],
                      ['category', 'Kategori'],
                      ['product', 'Ürün'],
                    ]}
                  />
                  <SelectField
                    label="Pazaryeri"
                    value={marketplaceForm.marketplace_id}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, marketplace_id: value }))}
                    options={[['', '—'], ...marketplaceOptions]}
                  />
                  <SelectField
                    label="Kategori"
                    value={marketplaceForm.category_id}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, category_id: value }))}
                    options={[['', '—'], ...categoryOptions.map((item) => [String(item.id), item.label])]}
                  />
                  <SelectField
                    label="Ürün"
                    value={marketplaceForm.product_id}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, product_id: value }))}
                    options={[['', '—'], ...productOptions]}
                  />
                  <NumberField
                    label="Öncelik"
                    value={marketplaceForm.priority}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, priority: value }))}
                    step="1"
                  />
                  <NumberField
                    label="Komisyon Oranı"
                    value={marketplaceForm.commission_rate}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, commission_rate: value }))}
                  />
                  <SelectField
                    label="Komisyon Bazı"
                    value={marketplaceForm.commission_base}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, commission_base: value }))}
                    options={[
                      ['net_ex_vat', 'KDV Hariç'],
                      ['gross_price', 'Brüt Fiyat'],
                    ]}
                  />
                  <NumberField
                    label="KDV Oranı"
                    value={marketplaceForm.vat_rate}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, vat_rate: value }))}
                  />
                  <NumberField
                    label="Sabit Ücret"
                    value={marketplaceForm.fixed_fee}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, fixed_fee: value }))}
                  />
                  <NumberField
                    label="Min. Marj %"
                    value={marketplaceForm.min_margin_rate}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, min_margin_rate: value }))}
                  />
                  <NumberField
                    label="Hedef Marj %"
                    value={marketplaceForm.target_margin_rate}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, target_margin_rate: value }))}
                  />
                  <NumberField
                    label="Pazaryeri İndirim %"
                    value={marketplaceForm.marketplace_discount_rate}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, marketplace_discount_rate: value }))}
                  />
                  <NumberField
                    label="Yuvarlama Sonu"
                    value={marketplaceForm.rounding_ending}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, rounding_ending: value }))}
                  />
                  <CheckboxField
                    label="Pazaryeri indirimi fonluyor"
                    checked={Boolean(marketplaceForm.marketplace_discount_funded)}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, marketplace_discount_funded: value }))}
                  />
                  <CheckboxField
                    label="Aktif"
                    checked={Boolean(marketplaceForm.is_active)}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, is_active: value }))}
                  />
                  <TextAreaField
                    label="Notlar"
                    value={marketplaceForm.notes}
                    onChange={(value) => setMarketplaceForm((current) => ({ ...current, notes: value }))}
                    full
                  />
                </div>
                <FormActions
                  submitLabel={editingMarketplaceRuleId ? 'Güncelle' : 'Kaydet'}
                  onReset={() => {
                    setMarketplaceForm(emptyMarketplaceRule);
                    setEditingMarketplaceRuleId(null);
                  }}
                />
              </form>
            </Card>

            <Card title="Pazaryeri Kuralları Listesi">
              <SimpleTable
                headers={[
                  'Kapsam',
                  'Pazaryeri',
                  'Kategori',
                  'Ürün',
                  'Komisyon',
                  'Min. Marj',
                  'Hedef Marj',
                  'İndirim',
                  'Aktif',
                  'İşlemler',
                ]}
                rows={marketplaceRules.map((row) => [
                  row.scope_type,
                  row.marketplace_name || 'General',
                  row.category_name || '—',
                  row.product_name || '—',
                  formatPercent(row.commission_rate),
                  formatPercent(row.min_margin_rate ?? row.minimum_profit_margin),
                  formatPercent(row.target_margin_rate ?? row.target_profit_margin),
                  formatPercent(row.marketplace_discount_rate),
                  boolText(row.is_active),
                  <ActionButtons
                    key={`marketplace-${row.id}`}
                    onEdit={() => {
                      setEditingMarketplaceRuleId(row.id);
                      setMarketplaceForm({
                        ...emptyMarketplaceRule,
                        ...row,
                        marketplace_id: row.marketplace_id ? String(row.marketplace_id) : '',
                        category_id: row.category_id ? String(row.category_id) : '',
                        product_id: row.product_id ? String(row.product_id) : '',
                      });
                    }}
                    onDelete={async () => {
                      try {
                        await deleteRule(`${API_URL}/api/rules/marketplace/${row.id}`, 'Pazaryeri kuralı silindi');
                      } catch (deleteError) {
                        setError(errorMessageFrom(deleteError));
                      }
                    }}
                  />,
                ])}
                emptyText="Henüz pazaryeri kuralı yok."
              />
            </Card>
          </div>
        ) : null}

        {!loadingData && activeTab === 'shipping' ? (
          <div style={styles.sectionGrid}>
            <Card title={editingShippingRuleId ? 'Kargo Kuralını Düzenle' : 'Yeni Kargo Kuralı'}>
              <form onSubmit={handleShippingSubmit}>
                <div style={styles.formGrid}>
                  <SelectField
                    label="Kapsam"
                    value={shippingForm.scope_type}
                    onChange={(value) => setShippingForm((current) => ({ ...current, scope_type: value }))}
                    options={[
                      ['general', 'General'],
                      ['marketplace', 'Pazaryeri'],
                    ]}
                  />
                  <SelectField
                    label="Pazaryeri"
                    value={shippingForm.marketplace_id}
                    onChange={(value) => setShippingForm((current) => ({ ...current, marketplace_id: value }))}
                    options={[['', '—'], ...marketplaceOptions]}
                  />
                  <NumberField
                    label="Min. Fiyat"
                    value={shippingForm.min_price}
                    onChange={(value) => setShippingForm((current) => ({ ...current, min_price: value }))}
                  />
                  <NumberField
                    label="Max. Fiyat"
                    value={shippingForm.max_price}
                    onChange={(value) => setShippingForm((current) => ({ ...current, max_price: value }))}
                  />
                  <NumberField
                    label="Kargo Maliyeti"
                    value={shippingForm.shipping_cost}
                    onChange={(value) => setShippingForm((current) => ({ ...current, shipping_cost: value }))}
                  />
                  <NumberField
                    label="Öncelik"
                    value={shippingForm.priority}
                    onChange={(value) => setShippingForm((current) => ({ ...current, priority: value }))}
                    step="1"
                  />
                  <CheckboxField
                    label="Aktif"
                    checked={Boolean(shippingForm.is_active)}
                    onChange={(value) => setShippingForm((current) => ({ ...current, is_active: value }))}
                  />
                  <TextAreaField
                    label="Notlar"
                    value={shippingForm.notes}
                    onChange={(value) => setShippingForm((current) => ({ ...current, notes: value }))}
                    full
                  />
                </div>
                <FormActions
                  submitLabel={editingShippingRuleId ? 'Güncelle' : 'Kaydet'}
                  onReset={() => {
                    setShippingForm(emptyShippingRule);
                    setEditingShippingRuleId(null);
                  }}
                />
              </form>
            </Card>

            <Card title="Kargo Baremleri">
              <SimpleTable
                headers={['Kapsam', 'Pazaryeri', 'Min. Fiyat', 'Max. Fiyat', 'Kargo', 'Aktif', 'İşlemler']}
                rows={shippingRules.map((row) => [
                  row.scope_type,
                  row.marketplace_name || 'General',
                  row.min_price,
                  row.max_price ?? '—',
                  row.shipping_cost,
                  boolText(row.is_active),
                  <ActionButtons
                    key={`shipping-${row.id}`}
                    onEdit={() => {
                      setEditingShippingRuleId(row.id);
                      setShippingForm({
                        ...emptyShippingRule,
                        ...row,
                        marketplace_id: row.marketplace_id ? String(row.marketplace_id) : '',
                      });
                    }}
                    onDelete={async () => {
                      try {
                        await deleteRule(`${API_URL}/api/rules/shipping/${row.id}`, 'Kargo kuralı silindi');
                      } catch (deleteError) {
                        setError(errorMessageFrom(deleteError));
                      }
                    }}
                  />,
                ])}
                emptyText="Henüz kargo kuralı yok."
              />
            </Card>
          </div>
        ) : null}

        {!loadingData && activeTab === 'profit' ? (
          <div style={styles.sectionGrid}>
            <Card title={editingProfitTargetId ? 'Kâr Hedefini Düzenle' : 'Yeni Kâr Hedefi'}>
              <form onSubmit={handleProfitSubmit}>
                <div style={styles.formGrid}>
                  <SelectField
                    label="Kapsam"
                    value={profitForm.scope_type}
                    onChange={(value) => setProfitForm((current) => ({ ...current, scope_type: value }))}
                    options={[
                      ['general', 'General'],
                      ['marketplace', 'Pazaryeri'],
                      ['category', 'Kategori'],
                      ['product', 'Ürün'],
                    ]}
                  />
                  <SelectField
                    label="Pazaryeri"
                    value={profitForm.marketplace_id}
                    onChange={(value) => setProfitForm((current) => ({ ...current, marketplace_id: value }))}
                    options={[['', '—'], ...marketplaceOptions]}
                  />
                  <SelectField
                    label="Kategori"
                    value={profitForm.category_id}
                    onChange={(value) => setProfitForm((current) => ({ ...current, category_id: value }))}
                    options={[['', '—'], ...categoryOptions.map((item) => [String(item.id), item.label])]}
                  />
                  <SelectField
                    label="Ürün"
                    value={profitForm.product_id}
                    onChange={(value) => setProfitForm((current) => ({ ...current, product_id: value }))}
                    options={[['', '—'], ...productOptions]}
                  />
                  <NumberField
                    label="Min. Marj %"
                    value={profitForm.min_margin_rate}
                    onChange={(value) => setProfitForm((current) => ({ ...current, min_margin_rate: value }))}
                  />
                  <NumberField
                    label="Hedef Marj %"
                    value={profitForm.target_margin_rate}
                    onChange={(value) => setProfitForm((current) => ({ ...current, target_margin_rate: value }))}
                  />
                  <NumberField
                    label="Öncelik"
                    value={profitForm.priority}
                    onChange={(value) => setProfitForm((current) => ({ ...current, priority: value }))}
                    step="1"
                  />
                  <CheckboxField
                    label="Aktif"
                    checked={Boolean(profitForm.is_active)}
                    onChange={(value) => setProfitForm((current) => ({ ...current, is_active: value }))}
                  />
                  <TextAreaField
                    label="Notlar"
                    value={profitForm.notes}
                    onChange={(value) => setProfitForm((current) => ({ ...current, notes: value }))}
                    full
                  />
                </div>
                <FormActions
                  submitLabel={editingProfitTargetId ? 'Güncelle' : 'Kaydet'}
                  onReset={() => {
                    setProfitForm(emptyProfitTarget);
                    setEditingProfitTargetId(null);
                  }}
                />
              </form>
            </Card>

            <Card title="Kâr Hedefleri Listesi">
              <SimpleTable
                headers={['Kapsam', 'Pazaryeri', 'Kategori', 'Ürün', 'Min. Marj', 'Hedef Marj', 'Aktif', 'İşlemler']}
                rows={profitTargets.map((row) => [
                  row.scope_type,
                  row.marketplace_name || 'General',
                  row.category_name || '—',
                  row.product_name || '—',
                  formatPercent(row.min_margin_rate ?? row.min_profit_margin),
                  formatPercent(row.target_margin_rate ?? row.target_profit_margin),
                  boolText(row.is_active),
                  <ActionButtons
                    key={`profit-${row.id}`}
                    onEdit={() => {
                      setEditingProfitTargetId(row.id);
                      setProfitForm({
                        ...emptyProfitTarget,
                        ...row,
                        marketplace_id: row.marketplace_id ? String(row.marketplace_id) : '',
                        category_id: row.category_id ? String(row.category_id) : '',
                        product_id: row.product_id ? String(row.product_id) : '',
                      });
                    }}
                    onDelete={async () => {
                      try {
                        await deleteRule(`${API_URL}/api/rules/profit-targets/${row.id}`, 'Kâr hedefi silindi');
                      } catch (deleteError) {
                        setError(errorMessageFrom(deleteError));
                      }
                    }}
                  />,
                ])}
                emptyText="Henüz kâr hedefi yok."
              />
            </Card>
          </div>
        ) : null}

        {!loadingData && activeTab === 'deductions' ? (
          <div style={styles.sectionGrid}>
            <Card title={editingExtraDeductionId ? 'Ek Kesintiyi Düzenle' : 'Yeni Ek Kesinti'}>
              <form onSubmit={handleExtraSubmit}>
                <div style={styles.formGrid}>
                  <SelectField
                    label="Pazaryeri Kuralı"
                    value={extraForm.marketplace_rule_id}
                    onChange={(value) => setExtraForm((current) => ({ ...current, marketplace_rule_id: value }))}
                    options={[
                      ['', '—'],
                      ...marketplaceRules.map((rule) => [
                        String(rule.id),
                        `#${rule.id} ${rule.scope_type} / ${rule.marketplace_name || 'General'}`,
                      ]),
                    ]}
                  />
                  <TextField
                    label="Ad"
                    value={extraForm.name}
                    onChange={(value) => setExtraForm((current) => ({ ...current, name: value }))}
                  />
                  <SelectField
                    label="Kesinti Tipi"
                    value={extraForm.deduction_type}
                    onChange={(value) => setExtraForm((current) => ({ ...current, deduction_type: value }))}
                    options={[
                      ['withholding', 'Stopaj'],
                      ['service_fee', 'Hizmet Bedeli'],
                      ['campaign_fee', 'Kampanya Katkısı'],
                      ['other', 'Diğer'],
                    ]}
                  />
                  <SelectField
                    label="Hesaplama Tipi"
                    value={extraForm.calculation_type}
                    onChange={(value) => setExtraForm((current) => ({ ...current, calculation_type: value }))}
                    options={[
                      ['percentage', 'Yüzde'],
                      ['fixed', 'Sabit Tutar'],
                    ]}
                  />
                  <SelectField
                    label="Baz Tutar Tipi"
                    value={extraForm.base_amount_type}
                    onChange={(value) => setExtraForm((current) => ({ ...current, base_amount_type: value }))}
                    options={[
                      ['net_ex_vat', 'KDV Hariç'],
                      ['gross_price', 'Brüt Fiyat'],
                      ['net_after_commission', 'Komisyon Sonrası'],
                    ]}
                  />
                  <NumberField
                    label="Oran"
                    value={extraForm.rate}
                    onChange={(value) => setExtraForm((current) => ({ ...current, rate: value }))}
                  />
                  <NumberField
                    label="Sabit Tutar"
                    value={extraForm.fixed_amount}
                    onChange={(value) => setExtraForm((current) => ({ ...current, fixed_amount: value }))}
                  />
                  <NumberField
                    label="Öncelik"
                    value={extraForm.priority}
                    onChange={(value) => setExtraForm((current) => ({ ...current, priority: value }))}
                    step="1"
                  />
                  <CheckboxField
                    label="Aktif"
                    checked={Boolean(extraForm.is_active)}
                    onChange={(value) => setExtraForm((current) => ({ ...current, is_active: value }))}
                  />
                  <TextAreaField
                    label="Notlar"
                    value={extraForm.notes}
                    onChange={(value) => setExtraForm((current) => ({ ...current, notes: value }))}
                    full
                  />
                </div>
                <FormActions
                  submitLabel={editingExtraDeductionId ? 'Güncelle' : 'Kaydet'}
                  onReset={() => {
                    setExtraForm(emptyExtraDeduction);
                    setEditingExtraDeductionId(null);
                  }}
                />
              </form>
            </Card>

            <Card title="Ek Kesintiler Listesi">
              <SimpleTable
                headers={['Ad', 'Kural', 'Hesaplama', 'Baz', 'Oran', 'Sabit', 'Aktif', 'İşlemler']}
                rows={extraDeductions.map((row) => [
                  row.name,
                  `${row.marketplace_rule_scope || '—'} / ${row.marketplace_name || 'General'}`,
                  row.calculation_type,
                  row.base_amount_type,
                  row.rate,
                  row.fixed_amount,
                  boolText(row.is_active),
                  <ActionButtons
                    key={`deduction-${row.id}`}
                    onEdit={() => {
                      setEditingExtraDeductionId(row.id);
                      setExtraForm({
                        ...emptyExtraDeduction,
                        ...row,
                        marketplace_rule_id: row.marketplace_rule_id ? String(row.marketplace_rule_id) : '',
                      });
                    }}
                    onDelete={async () => {
                      try {
                        await deleteRule(`${API_URL}/api/rules/extra-deductions/${row.id}`, 'Ek kesinti silindi');
                      } catch (deleteError) {
                        setError(errorMessageFrom(deleteError));
                      }
                    }}
                  />,
                ])}
                emptyText="Henüz ek kesinti yok."
              />
            </Card>
          </div>
        ) : null}
      </main>
    </>
  );
}

function Card({ title, children }) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

function TextField({ label, value, onChange, full = false }) {
  return (
    <label style={{ ...styles.field, ...(full ? styles.fullWidth : {}) }}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} />
    </label>
  );
}

function NumberField({ label, value, onChange, step = '0.01' }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={styles.input}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.input}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={`${label}-${optionValue}`} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label style={styles.checkboxField}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function TextAreaField({ label, value, onChange, full = false }) {
  return (
    <label style={{ ...styles.field, ...(full ? styles.fullWidth : {}) }}>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} style={styles.textarea} rows={3} />
    </label>
  );
}

function FormActions({ submitLabel, onReset }) {
  return (
    <div style={styles.formActions}>
      <button type="submit" style={styles.saveButton}>
        {submitLabel}
      </button>
      <button type="button" style={styles.secondaryButton} onClick={onReset}>
        Temizle
      </button>
    </div>
  );
}

function ActionButtons({ onEdit, onDelete }) {
  return (
    <div style={styles.rowActions}>
      <button type="button" style={styles.editButton} onClick={onEdit}>
        Düzenle
      </button>
      <button type="button" style={styles.deleteButton} onClick={onDelete}>
        Sil
      </button>
    </div>
  );
}

function SimpleTable({ headers, rows, emptyText }) {
  if (!rows.length) {
    return <div style={styles.emptyState}>{emptyText}</div>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={styles.th}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`} style={styles.td}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  loading: {
    padding: '40px',
    textAlign: 'center',
    fontSize: '18px',
  },
  page: {
    padding: '32px',
    maxWidth: '1500px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '18px',
  },
  heading: {
    margin: 0,
    color: '#0f172a',
    fontSize: '30px',
  },
  subheading: {
    margin: '8px 0 0 0',
    color: '#64748b',
    fontSize: '14px',
  },
  refreshButton: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  successBox: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '18px',
  },
  tab: {
    padding: '10px 18px',
    borderRadius: '999px',
    border: 'none',
    backgroundColor: '#e2e8f0',
    color: '#0f172a',
    cursor: 'pointer',
    fontWeight: 600,
  },
  activeTab: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  },
  sectionGrid: {
    display: 'grid',
    gap: '18px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: '16px',
    color: '#0f172a',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    color: '#334155',
  },
  checkboxField: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingTop: '28px',
    color: '#334155',
    fontSize: '14px',
  },
  fullWidth: {
    gridColumn: '1 / -1',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    backgroundColor: '#ffffff',
  },
  textarea: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    resize: 'vertical',
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px',
  },
  saveButton: {
    padding: '10px 18px',
    border: 'none',
    borderRadius: '10px',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 18px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    textAlign: 'left',
    padding: '12px 14px',
    fontSize: '13px',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '13px',
    color: '#0f172a',
    verticalAlign: 'top',
  },
  rowActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  editButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#f59e0b',
    color: '#ffffff',
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    cursor: 'pointer',
  },
  emptyState: {
    padding: '18px',
    borderRadius: '12px',
    backgroundColor: '#f8fafc',
    color: '#64748b',
  },
};
