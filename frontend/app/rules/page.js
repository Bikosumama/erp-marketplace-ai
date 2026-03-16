'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
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
  marketplace_id: '',
  min_price: 0,
  max_price: '',
  min_desi: 0,
  max_desi: '',
  shipping_cost: 0,
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
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function formatBool(value) {
  return value ? 'Evet' : 'Hayır';
}

function getErrorMessage(err) {
  return err?.message || 'İşlem sırasında hata oluştu';
}

function buildCategoryOptions(categories = []) {
  return (categories || [])
    .map((item) => ({
      id: item.id,
      label: item.name || item.category_name || `Kategori #${item.id}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

function buildProductOptions(products = []) {
  return (products || [])
    .map((item) => ({
      id: item.id,
      label: item.stock_code
        ? `${item.stock_code} - ${item.name || item.product_name || `Ürün #${item.id}`}`
        : item.name || item.product_name || `Ürün #${item.id}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

function lookupLabel(options, value, fallback = '—') {
  const found = options.find((item) => String(item.id) === String(value));
  return found?.label || fallback;
}

function Field({
  label,
  children,
  hint,
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
      {hint ? <span style={styles.fieldHint}>{hint}</span> : null}
    </label>
  );
}

function TextInput(props) {
  return <input {...props} style={{ ...styles.input, ...(props.style || {}) }} />;
}

function SelectInput({ children, ...props }) {
  return (
    <select {...props} style={{ ...styles.input, ...(props.style || {}) }}>
      {children}
    </select>
  );
}

function TextArea(props) {
  return <textarea {...props} style={{ ...styles.textarea, ...(props.style || {}) }} />;
}

function SectionCard({ title, children, right }) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function RulesPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('marketplace');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showShippingHelp, setShowShippingHelp] = useState(false);

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
  }, [loading, user, router]);

  const authHeader = useCallback(() => {
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);
  const productOptions = useMemo(() => buildProductOptions(products), [products]);
  const marketplaceRuleOptions = useMemo(() => {
    return marketplaceRules.map((rule) => ({
      id: rule.id,
      label: `#${rule.id} | ${rule.marketplace_name || 'General'} | ${rule.scope_type || 'general'}`,
    }));
  }, [marketplaceRules]);

  const fetchAll = useCallback(async () => {
    if (!token) return;

    setLoadingData(true);
    setError('');

    try {
      const [
        marketplacesRes,
        categoriesRes,
        productsRes,
        marketplaceRulesRes,
        shippingRulesRes,
        profitTargetsRes,
        extraDeductionsRes,
      ] = await Promise.all([
        fetch(`${API_URL}/api/marketplaces`, { headers: authHeader() }),
        fetch(`${API_URL}/api/categories`, { headers: authHeader() }),
        fetch(`${API_URL}/api/products`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/marketplace`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/shipping`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/profit-targets`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/extra-deductions`, { headers: authHeader() }),
      ]);

      const [
        marketplacesData,
        categoriesData,
        productsData,
        marketplaceRulesData,
        shippingRulesData,
        profitTargetsData,
        extraDeductionsData,
      ] = await Promise.all([
        marketplacesRes.json(),
        categoriesRes.json(),
        productsRes.json(),
        marketplaceRulesRes.json(),
        shippingRulesRes.json(),
        profitTargetsRes.json(),
        extraDeductionsRes.json(),
      ]);

      if (!marketplacesRes.ok) throw new Error(marketplacesData.error || 'Pazaryerleri yüklenemedi');
      if (!categoriesRes.ok) throw new Error(categoriesData.error || 'Kategoriler yüklenemedi');
      if (!productsRes.ok) throw new Error(productsData.error || 'Ürünler yüklenemedi');
      if (!marketplaceRulesRes.ok) throw new Error(marketplaceRulesData.error || 'Pazaryeri kuralları yüklenemedi');
      if (!shippingRulesRes.ok) throw new Error(shippingRulesData.error || 'Kargo kuralları yüklenemedi');
      if (!profitTargetsRes.ok) throw new Error(profitTargetsData.error || 'Kâr hedefleri yüklenemedi');
      if (!extraDeductionsRes.ok) throw new Error(extraDeductionsData.error || 'Ek kesintiler yüklenemedi');

      setMarketplaces(marketplacesData.marketplaces || []);
      setCategories(categoriesData.categories || []);
      setProducts(productsData.products || []);
      setMarketplaceRules(marketplaceRulesData.rules || []);
      setShippingRules(shippingRulesData.rules || []);
      setProfitTargets(profitTargetsData.rules || []);
      setExtraDeductions(extraDeductionsData.rules || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingData(false);
    }
  }, [authHeader, token]);

  useEffect(() => {
    if (user && token) {
      fetchAll();
    }
  }, [user, token, fetchAll]);

  async function submitForm(url, method, payload, successMessage) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'İşlem başarısız');
      }

      setSuccess(successMessage);
      await fetchAll();
      return data;
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(url, successMessage) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: authHeader(),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Silme başarısız');
      }

      setSuccess(successMessage);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    try {
      await downloadExcelFile({
        url: `${API_URL}/api/rules/export`,
        token,
        method: 'GET',
        defaultFilename: 'rules-export.xlsx',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleTemplateDownload() {
    try {
      await downloadExcelFile({
        url: `${API_URL}/api/rules/template`,
        token,
        method: 'GET',
        defaultFilename: 'rules-template.xlsx',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleImport(file) {
    if (!file) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/rules/import`, {
        method: 'POST',
        headers: {
          ...authHeader(),
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Excel içe aktarma başarısız');
      }

      setSuccess('Rules Excel içe aktarma tamamlandı');
      await fetchAll();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function resetMarketplaceForm() {
    setMarketplaceForm(emptyMarketplaceRule);
    setEditingMarketplaceRuleId(null);
  }

  function resetShippingForm() {
    setShippingForm(emptyShippingRule);
    setEditingShippingRuleId(null);
  }

  function resetProfitForm() {
    setProfitForm(emptyProfitTarget);
    setEditingProfitTargetId(null);
  }

  function resetExtraForm() {
    setExtraForm(emptyExtraDeduction);
    setEditingExtraDeductionId(null);
  }

  function startEditMarketplaceRule(rule) {
    setEditingMarketplaceRuleId(rule.id);
    setMarketplaceForm({
      scope_type: rule.scope_type || 'general',
      marketplace_id: rule.marketplace_id ?? '',
      category_id: rule.category_id ?? '',
      product_id: rule.product_id ?? '',
      priority: normalizeNumber(rule.priority) || 0,
      commission_rate: normalizeNumber(rule.commission_rate) || 0,
      commission_base: rule.commission_base || 'net_ex_vat',
      vat_rate: normalizeNumber(rule.vat_rate) || 20,
      fixed_fee: normalizeNumber(rule.fixed_fee) || 0,
      marketplace_discount_rate: normalizeNumber(rule.marketplace_discount_rate) || 0,
      marketplace_discount_funded: Boolean(rule.marketplace_discount_funded),
      rounding_ending: normalizeNumber(rule.rounding_ending) || 0.9,
      min_margin_rate: normalizeNumber(rule.min_margin_rate ?? rule.minimum_profit_margin) || 10,
      target_margin_rate: normalizeNumber(rule.target_margin_rate ?? rule.target_profit_margin) || 18,
      is_active: Boolean(rule.is_active),
      notes: rule.notes || '',
    });
    setActiveTab('marketplace');
  }

  function startEditShippingRule(rule) {
    setEditingShippingRuleId(rule.id);
    setShippingForm({
      marketplace_id: rule.marketplace_id ?? '',
      min_price: normalizeNumber(rule.min_price) || 0,
      max_price: rule.max_price ?? '',
      min_desi: normalizeNumber(rule.min_desi) || 0,
      max_desi: rule.max_desi ?? '',
      shipping_cost: normalizeNumber(rule.shipping_cost) || 0,
      is_active: Boolean(rule.is_active),
      notes: rule.notes || '',
    });
    setActiveTab('shipping');
  }

  function startEditProfitTarget(rule) {
    setEditingProfitTargetId(rule.id);
    setProfitForm({
      scope_type: rule.scope_type || 'general',
      marketplace_id: rule.marketplace_id ?? '',
      category_id: rule.category_id ?? '',
      product_id: rule.product_id ?? '',
      priority: normalizeNumber(rule.priority) || 0,
      min_margin_rate: normalizeNumber(rule.min_margin_rate ?? rule.min_profit_margin) || 10,
      target_margin_rate: normalizeNumber(rule.target_margin_rate ?? rule.target_profit_margin) || 18,
      is_active: Boolean(rule.is_active),
      notes: rule.notes || '',
    });
    setActiveTab('profit');
  }

  function startEditExtraDeduction(rule) {
    setEditingExtraDeductionId(rule.id);
    setExtraForm({
      marketplace_rule_id: rule.marketplace_rule_id ?? '',
      name: rule.name || 'Ek Kesinti',
      deduction_type: rule.deduction_type || 'other',
      calculation_type: rule.calculation_type || 'percentage',
      base_amount_type: rule.base_amount_type || 'net_ex_vat',
      rate: normalizeNumber(rule.rate) || 0,
      fixed_amount: normalizeNumber(rule.fixed_amount) || 0,
      priority: normalizeNumber(rule.priority) || 0,
      is_active: Boolean(rule.is_active),
      notes: rule.notes || '',
    });
    setActiveTab('deductions');
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
      resetMarketplaceForm();
    } catch (err) {
      setError(getErrorMessage(err));
    }
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
      resetShippingForm();
    } catch (err) {
      setError(getErrorMessage(err));
    }
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
      resetProfitForm();
    } catch (err) {
      setError(getErrorMessage(err));
    }
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
      resetExtraForm();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (loading) {
    return <div style={styles.centered}>Yükleniyor...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Navigation />

      <div style={styles.page}>
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>⚙️ Kurallar Merkezi</h1>
            <p style={styles.pageSubtitle}>
              Genel fallback, pazaryeri bazlı istisnalar, kargo baremleri, kâr hedefleri ve ek kesintiler bu ekrandan yönetilir.
            </p>
          </div>

          <div style={styles.toolbar}>
            <button type="button" onClick={fetchAll} style={styles.secondaryButton} disabled={loadingData || saving}>
              Yenile
            </button>

            <button type="button" onClick={handleExport} style={styles.secondaryButton} disabled={loadingData || saving}>
              Excel Dışa Aktar
            </button>

            <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.secondaryButton} disabled={loadingData || saving}>
              Excel İçe Aktar
            </button>

            <button type="button" onClick={handleTemplateDownload} style={styles.primaryButton} disabled={loadingData || saving}>
              Şablon İndir
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                handleImport(file);
              }}
            />
          </div>
        </div>

        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {success ? <div style={styles.successBox}>{success}</div> : null}

        <div style={styles.tabs}>
          {[
            ['marketplace', 'Pazaryeri Kuralları'],
            ['shipping', 'Kargo Kuralları'],
            ['profit', 'Kâr Hedefleri'],
            ['deductions', 'Ek Kesintiler'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                ...styles.tabButton,
                ...(activeTab === key ? styles.tabButtonActive : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingData ? (
          <div style={styles.centered}>Kurallar yükleniyor...</div>
        ) : (
          <>
            {activeTab === 'marketplace' && (
              <div style={styles.grid}>
                <SectionCard title="Pazaryeri Kural Formu">
                  <form onSubmit={handleMarketplaceSubmit} style={styles.formGrid}>
                    <Field label="Kapsam">
                      <SelectInput
                        value={marketplaceForm.scope_type}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, scope_type: e.target.value }))}
                      >
                        <option value="general">General</option>
                        <option value="marketplace">Pazaryeri</option>
                        <option value="category">Kategori</option>
                        <option value="product">Ürün</option>
                      </SelectInput>
                    </Field>

                    <Field label="Pazaryeri">
                      <SelectInput
                        value={marketplaceForm.marketplace_id}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, marketplace_id: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {marketplaces.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.marketplace_name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Kategori">
                      <SelectInput
                        value={marketplaceForm.category_id}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, category_id: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {categoryOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Ürün">
                      <SelectInput
                        value={marketplaceForm.product_id}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, product_id: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {productOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Öncelik">
                      <TextInput
                        type="number"
                        value={marketplaceForm.priority}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, priority: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Komisyon Oranı (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.commission_rate}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, commission_rate: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Komisyon Bazı">
                      <SelectInput
                        value={marketplaceForm.commission_base}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, commission_base: e.target.value }))}
                      >
                        <option value="net_ex_vat">KDV Hariç Net</option>
                        <option value="gross_price">Brüt Fiyat</option>
                      </SelectInput>
                    </Field>

                    <Field label="KDV Oranı (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.vat_rate}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, vat_rate: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Sabit Ücret">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.fixed_fee}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, fixed_fee: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Pazaryeri İndirim Oranı (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.marketplace_discount_rate}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({ ...prev, marketplace_discount_rate: normalizeNumber(e.target.value) }))
                        }
                      />
                    </Field>

                    <Field label="Pazaryeri İndirimi Fonluyor mu?">
                      <SelectInput
                        value={marketplaceForm.marketplace_discount_funded ? '1' : '0'}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            marketplace_discount_funded: e.target.value === '1',
                          }))
                        }
                      >
                        <option value="0">Hayır</option>
                        <option value="1">Evet</option>
                      </SelectInput>
                    </Field>

                    <Field label="Yuvarlama Sonu">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.rounding_ending}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, rounding_ending: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Min Marj (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.min_margin_rate}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, min_margin_rate: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Hedef Marj (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.target_margin_rate}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({ ...prev, target_margin_rate: normalizeNumber(e.target.value) }))
                        }
                      />
                    </Field>

                    <Field label="Aktif mi">
                      <SelectInput
                        value={marketplaceForm.is_active ? '1' : '0'}
                        onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, is_active: e.target.value === '1' }))}
                      >
                        <option value="1">Evet</option>
                        <option value="0">Hayır</option>
                      </SelectInput>
                    </Field>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Not">
                        <TextArea
                          rows={3}
                          value={marketplaceForm.notes}
                          onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, notes: e.target.value }))}
                        />
                      </Field>
                    </div>

                    <div style={styles.formActions}>
                      <button type="submit" style={styles.primaryButton} disabled={saving}>
                        {editingMarketplaceRuleId ? 'Güncelle' : 'Kaydet'}
                      </button>
                      <button type="button" style={styles.secondaryButton} onClick={resetMarketplaceForm} disabled={saving}>
                        Temizle
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Pazaryeri Kuralları Listesi">
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Kapsam</th>
                          <th>Pazaryeri</th>
                          <th>Kategori</th>
                          <th>Ürün</th>
                          <th>Komisyon</th>
                          <th>Min Marj</th>
                          <th>Hedef Marj</th>
                          <th>Aktif</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketplaceRules.map((rule) => (
                          <tr key={rule.id}>
                            <td>{rule.scope_type || 'general'}</td>
                            <td>{rule.marketplace_name || 'General'}</td>
                            <td>{rule.category_name || '—'}</td>
                            <td>{rule.product_stock_code ? `${rule.product_stock_code} - ${rule.product_name || ''}` : (rule.product_name || '—')}</td>
                            <td>{rule.commission_rate ?? 0}</td>
                            <td>{rule.min_margin_rate ?? rule.minimum_profit_margin ?? 0}</td>
                            <td>{rule.target_margin_rate ?? rule.target_profit_margin ?? 0}</td>
                            <td>{formatBool(rule.is_active)}</td>
                            <td>
                              <div style={styles.rowActions}>
                                <button type="button" style={styles.linkButton} onClick={() => startEditMarketplaceRule(rule)}>
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  style={styles.linkDangerButton}
                                  onClick={() =>
                                    deleteRule(`${API_URL}/api/rules/marketplace/${rule.id}`, 'Pazaryeri kuralı silindi')
                                      .catch((err) => setError(getErrorMessage(err)))
                                  }
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {marketplaceRules.length === 0 && (
                          <tr>
                            <td colSpan={9} style={styles.emptyCell}>Kayıt yok</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div style={styles.grid}>
                <SectionCard
                  title="Kargo Kural Formu"
                  right={
                    <div
                      style={styles.infoWrap}
                      onMouseEnter={() => setShowShippingHelp(true)}
                      onMouseLeave={() => setShowShippingHelp(false)}
                    >
                      <button
                        type="button"
                        style={styles.infoButton}
                        onClick={() => setShowShippingHelp((prev) => !prev)}
                      >
                        i
                      </button>
                      {showShippingHelp && (
                        <div style={styles.infoPopover}>
                          Sistem önce pazaryerine özel kargo kurallarını kontrol eder.
                          Uygun kayıt bulunamazsa genel kuralları uygular.
                          Eşleşme hem fiyat aralığına hem desi aralığına göre yapılır.
                          Pazaryeri boş bırakılırsa kayıt genel kural kabul edilir.
                        </div>
                      )}
                    </div>
                  }
                >
                  <form onSubmit={handleShippingSubmit} style={styles.formGrid}>
                    <Field
                      label="Pazaryeri"
                      hint="Boş bırakılırsa genel kural olarak değerlendirilir."
                    >
                      <SelectInput
                        value={shippingForm.marketplace_id}
                        onChange={(e) => setShippingForm((prev) => ({ ...prev, marketplace_id: e.target.value }))}
                      >
                        <option value="">Genel</option>
                        {marketplaces.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.marketplace_name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Min Tutar (TL)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.min_price}
                        onChange={(e) => setShippingForm((prev) => ({ ...prev, min_price: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Max Tutar (TL)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.max_price}
                        onChange={(e) => setShippingForm((prev) => ({ ...prev, max_price: normalizeNumber(e.target.value) }))}
                        placeholder="Boş = üst sınır yok"
                      />
                    </Field>

                    <Field label="Min Desi">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.min_desi}
                        onChange={(e) => setShippingForm((prev) => ({ ...prev, min_desi: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Max Desi">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.max_desi}
                        onChange={(e) => setShippingForm((prev) => ({ ...prev, max_desi: normalizeNumber(e.target.value) }))}
                        placeholder="Boş = üst sınır yok"
                      />
                    </Field>

                    <Field label="Kargo Ücreti (TL)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.shipping_cost}
                        onChange={(e) => setShippingForm((prev) => ({ ...prev, shipping_cost: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Aktif mi">
                      <SelectInput
                        value={shippingForm.is_active ? '1' : '0'}
                        onChange={(e) => setShippingForm((prev) => ({ ...prev, is_active: e.target.value === '1' }))}
                      >
                        <option value="1">Evet</option>
                        <option value="0">Hayır</option>
                      </SelectInput>
                    </Field>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Not">
                        <TextArea
                          rows={3}
                          value={shippingForm.notes}
                          onChange={(e) => setShippingForm((prev) => ({ ...prev, notes: e.target.value }))}
                        />
                      </Field>
                    </div>

                    <div style={styles.formActions}>
                      <button type="submit" style={styles.primaryButton} disabled={saving}>
                        {editingShippingRuleId ? 'Güncelle' : 'Kaydet'}
                      </button>
                      <button type="button" style={styles.secondaryButton} onClick={resetShippingForm} disabled={saving}>
                        Temizle
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Kargo Kuralları Listesi">
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Pazaryeri</th>
                          <th>Min Tutar</th>
                          <th>Max Tutar</th>
                          <th>Min Desi</th>
                          <th>Max Desi</th>
                          <th>Kargo Ücreti</th>
                          <th>Aktif</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shippingRules.map((rule) => (
                          <tr key={rule.id}>
                            <td>{rule.marketplace_name || 'Genel'}</td>
                            <td>{rule.min_price ?? 0}</td>
                            <td>{rule.max_price ?? '—'}</td>
                            <td>{rule.min_desi ?? 0}</td>
                            <td>{rule.max_desi ?? '—'}</td>
                            <td>{rule.shipping_cost ?? 0}</td>
                            <td>{formatBool(rule.is_active)}</td>
                            <td>
                              <div style={styles.rowActions}>
                                <button type="button" style={styles.linkButton} onClick={() => startEditShippingRule(rule)}>
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  style={styles.linkDangerButton}
                                  onClick={() =>
                                    deleteRule(`${API_URL}/api/rules/shipping/${rule.id}`, 'Kargo kuralı silindi')
                                      .catch((err) => setError(getErrorMessage(err)))
                                  }
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {shippingRules.length === 0 && (
                          <tr>
                            <td colSpan={8} style={styles.emptyCell}>Kayıt yok</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'profit' && (
              <div style={styles.grid}>
                <SectionCard title="Kâr Hedefi Formu">
                  <form onSubmit={handleProfitSubmit} style={styles.formGrid}>
                    <Field label="Kapsam">
                      <SelectInput
                        value={profitForm.scope_type}
                        onChange={(e) => setProfitForm((prev) => ({ ...prev, scope_type: e.target.value }))}
                      >
                        <option value="general">General</option>
                        <option value="marketplace">Pazaryeri</option>
                        <option value="category">Kategori</option>
                        <option value="product">Ürün</option>
                      </SelectInput>
                    </Field>

                    <Field label="Pazaryeri">
                      <SelectInput
                        value={profitForm.marketplace_id}
                        onChange={(e) => setProfitForm((prev) => ({ ...prev, marketplace_id: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {marketplaces.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.marketplace_name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Kategori">
                      <SelectInput
                        value={profitForm.category_id}
                        onChange={(e) => setProfitForm((prev) => ({ ...prev, category_id: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {categoryOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Ürün">
                      <SelectInput
                        value={profitForm.product_id}
                        onChange={(e) => setProfitForm((prev) => ({ ...prev, product_id: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {productOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Öncelik">
                      <TextInput
                        type="number"
                        value={profitForm.priority}
                        onChange={(e) => setProfitForm((prev) => ({ ...prev, priority: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Min Marj (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={profitForm.min_margin_rate}
                        onChange={(e) => setProfitForm((prev) => ({ ...prev, min_margin_rate: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Hedef Marj (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={profitForm.target_margin_rate}
                        onChange={(e) => setProfitForm((prev) => ({ ...prev, target_margin_rate: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Aktif mi">
                      <SelectInput
                        value={profitForm.is_active ? '1' : '0'}
                        onChange={(e) => setProfitForm((prev) => ({ ...prev, is_active: e.target.value === '1' }))}
                      >
                        <option value="1">Evet</option>
                        <option value="0">Hayır</option>
                      </SelectInput>
                    </Field>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Not">
                        <TextArea
                          rows={3}
                          value={profitForm.notes}
                          onChange={(e) => setProfitForm((prev) => ({ ...prev, notes: e.target.value }))}
                        />
                      </Field>
                    </div>

                    <div style={styles.formActions}>
                      <button type="submit" style={styles.primaryButton} disabled={saving}>
                        {editingProfitTargetId ? 'Güncelle' : 'Kaydet'}
                      </button>
                      <button type="button" style={styles.secondaryButton} onClick={resetProfitForm} disabled={saving}>
                        Temizle
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Kâr Hedefleri Listesi">
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Kapsam</th>
                          <th>Pazaryeri</th>
                          <th>Kategori</th>
                          <th>Ürün</th>
                          <th>Min Marj</th>
                          <th>Hedef Marj</th>
                          <th>Aktif</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitTargets.map((rule) => (
                          <tr key={rule.id}>
                            <td>{rule.scope_type || 'general'}</td>
                            <td>{rule.marketplace_name || 'General'}</td>
                            <td>{rule.category_name || '—'}</td>
                            <td>{rule.product_stock_code ? `${rule.product_stock_code} - ${rule.product_name || ''}` : (rule.product_name || '—')}</td>
                            <td>{rule.min_margin_rate ?? rule.min_profit_margin ?? 0}</td>
                            <td>{rule.target_margin_rate ?? rule.target_profit_margin ?? 0}</td>
                            <td>{formatBool(rule.is_active)}</td>
                            <td>
                              <div style={styles.rowActions}>
                                <button type="button" style={styles.linkButton} onClick={() => startEditProfitTarget(rule)}>
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  style={styles.linkDangerButton}
                                  onClick={() =>
                                    deleteRule(`${API_URL}/api/rules/profit-targets/${rule.id}`, 'Kâr hedefi silindi')
                                      .catch((err) => setError(getErrorMessage(err)))
                                  }
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {profitTargets.length === 0 && (
                          <tr>
                            <td colSpan={8} style={styles.emptyCell}>Kayıt yok</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'deductions' && (
              <div style={styles.grid}>
                <SectionCard title="Ek Kesinti Formu">
                  <form onSubmit={handleExtraSubmit} style={styles.formGrid}>
                    <Field label="Pazaryeri Kuralı">
                      <SelectInput
                        value={extraForm.marketplace_rule_id}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, marketplace_rule_id: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {marketplaceRuleOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Ad">
                      <TextInput
                        value={extraForm.name}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </Field>

                    <Field label="Kesinti Tipi">
                      <SelectInput
                        value={extraForm.deduction_type}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, deduction_type: e.target.value }))}
                      >
                        <option value="withholding">Stopaj</option>
                        <option value="other">Diğer</option>
                        <option value="service">Hizmet</option>
                      </SelectInput>
                    </Field>

                    <Field label="Hesaplama Tipi">
                      <SelectInput
                        value={extraForm.calculation_type}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, calculation_type: e.target.value }))}
                      >
                        <option value="percentage">Yüzde</option>
                        <option value="fixed">Sabit</option>
                      </SelectInput>
                    </Field>

                    <Field label="Baz Tutar Tipi">
                      <SelectInput
                        value={extraForm.base_amount_type}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, base_amount_type: e.target.value }))}
                      >
                        <option value="net_ex_vat">Net (KDV Hariç)</option>
                        <option value="gross_price">Brüt Fiyat</option>
                        <option value="net_after_commission">Komisyon Sonrası Net</option>
                      </SelectInput>
                    </Field>

                    <Field label="Oran (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={extraForm.rate}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, rate: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Sabit Tutar">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={extraForm.fixed_amount}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, fixed_amount: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Öncelik">
                      <TextInput
                        type="number"
                        value={extraForm.priority}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, priority: normalizeNumber(e.target.value) }))}
                      />
                    </Field>

                    <Field label="Aktif mi">
                      <SelectInput
                        value={extraForm.is_active ? '1' : '0'}
                        onChange={(e) => setExtraForm((prev) => ({ ...prev, is_active: e.target.value === '1' }))}
                      >
                        <option value="1">Evet</option>
                        <option value="0">Hayır</option>
                      </SelectInput>
                    </Field>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Not">
                        <TextArea
                          rows={3}
                          value={extraForm.notes}
                          onChange={(e) => setExtraForm((prev) => ({ ...prev, notes: e.target.value }))}
                        />
                      </Field>
                    </div>

                    <div style={styles.formActions}>
                      <button type="submit" style={styles.primaryButton} disabled={saving}>
                        {editingExtraDeductionId ? 'Güncelle' : 'Kaydet'}
                      </button>
                      <button type="button" style={styles.secondaryButton} onClick={resetExtraForm} disabled={saving}>
                        Temizle
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Ek Kesintiler Listesi">
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Ad</th>
                          <th>Kural</th>
                          <th>Tip</th>
                          <th>Hesaplama</th>
                          <th>Oran</th>
                          <th>Sabit</th>
                          <th>Aktif</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraDeductions.map((rule) => (
                          <tr key={rule.id}>
                            <td>{rule.name || '—'}</td>
                            <td>{rule.marketplace_name || rule.marketplace_rule_scope || '—'}</td>
                            <td>{rule.deduction_type || '—'}</td>
                            <td>{rule.calculation_type || '—'}</td>
                            <td>{rule.rate ?? 0}</td>
                            <td>{rule.fixed_amount ?? 0}</td>
                            <td>{formatBool(rule.is_active)}</td>
                            <td>
                              <div style={styles.rowActions}>
                                <button type="button" style={styles.linkButton} onClick={() => startEditExtraDeduction(rule)}>
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  style={styles.linkDangerButton}
                                  onClick={() =>
                                    deleteRule(`${API_URL}/api/rules/extra-deductions/${rule.id}`, 'Ek kesinti silindi')
                                      .catch((err) => setError(getErrorMessage(err)))
                                  }
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {extraDeductions.length === 0 && (
                          <tr>
                            <td colSpan={8} style={styles.emptyCell}>Kayıt yok</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

const styles = {
  page: {
    padding: '24px',
    maxWidth: 1600,
    margin: '0 auto',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  pageTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: '#0f172a',
  },
  pageSubtitle: {
    margin: '8px 0 0',
    color: '#475569',
    lineHeight: 1.5,
  },
  toolbar: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    height: 40,
    padding: '0 16px',
    borderRadius: 10,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    height: 40,
    padding: '0 16px',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    marginBottom: 16,
  },
  successBox: {
    padding: 12,
    borderRadius: 10,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    marginBottom: 16,
  },
  tabs: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  tabButton: {
    height: 40,
    padding: '0 16px',
    borderRadius: 999,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 600,
  },
  tabButtonActive: {
    background: '#0f172a',
    color: '#fff',
    borderColor: '#0f172a',
  },
  centered: {
    padding: 40,
    textAlign: 'center',
    color: '#475569',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 480px) minmax(0, 1fr)',
    gap: 20,
    alignItems: 'start',
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 8px 30px rgba(15, 23, 42, 0.04)',
    position: 'relative',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#0f172a',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
  },
  fieldHint: {
    fontSize: 12,
    color: '#64748b',
  },
  input: {
    height: 40,
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    padding: '0 12px',
    outline: 'none',
    background: '#fff',
    color: '#0f172a',
  },
  textarea: {
    minHeight: 86,
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    padding: 12,
    outline: 'none',
    resize: 'vertical',
    background: '#fff',
    color: '#0f172a',
  },
  formActions: {
    display: 'flex',
    gap: 10,
    gridColumn: '1 / -1',
    marginTop: 4,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  emptyCell: {
    textAlign: 'center',
    color: '#64748b',
    padding: 20,
  },
  rowActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  linkButton: {
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    cursor: 'pointer',
    padding: 0,
    fontWeight: 600,
  },
  linkDangerButton: {
    border: 'none',
    background: 'transparent',
    color: '#dc2626',
    cursor: 'pointer',
    padding: 0,
    fontWeight: 600,
  },
  infoWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
  },
  infoPopover: {
    position: 'absolute',
    top: 34,
    right: 0,
    width: 320,
    padding: 12,
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#334155',
    fontSize: 13,
    lineHeight: 1.5,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
    zIndex: 20,
  },
};

if (typeof window !== 'undefined') {
  const styleId = 'rules-page-table-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      table th, table td {
        border-bottom: 1px solid #e2e8f0;
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
        white-space: nowrap;
      }
      table thead th {
        background: #f8fafc;
        color: #334155;
        font-weight: 700;
        position: sticky;
        top: 0;
      }
      @media (max-width: 1200px) {
        .rules-grid-responsive {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}