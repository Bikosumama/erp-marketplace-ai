'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Navigation from '../../components/Navigation';
import ExcelToolbar from '../../components/ExcelToolbar';
import { downloadExcelFile } from '../../lib/downloadExcel';
import ProductExcelGrid from '../../components/ProductExcelGrid';
import { excelHeaderToApiField } from '../../lib/dataGridColumnMap';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const emptyForm = {
  stock_code: '',
  name: '',
  description: '',
  barcode: '',
  brand_id: '',
  category_id: '',
  cost: '',
  sale_price: '',
  list_price: '',
  brand_min_price: '',
  currency: 'TRY',
  vat_rate: '18',
  status: 'active',
  marketplace_identifiers: [],
};

export default function ProductsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);

  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [tab, setTab] = useState('list');
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formTab, setFormTab] = useState('general');

  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importMapping, setImportMapping] = useState({});
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState(null);
  const [pasteResult, setPasteResult] = useState(null);
  const [pasteTransferring, setPasteTransferring] = useState(false);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const authHeader = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const [pRes, bRes, cRes, mRes] = await Promise.all([
        fetch(`${API_URL}/api/products`, { headers: authHeader() }),
        fetch(`${API_URL}/api/brands`, { headers: authHeader() }),
        fetch(`${API_URL}/api/categories`, { headers: authHeader() }),
        fetch(`${API_URL}/api/marketplaces`, { headers: authHeader() }),
      ]);
      const [pd, bd, cd, md] = await Promise.all([pRes.json(), bRes.json(), cRes.json(), mRes.json()]);
      setProducts(pd.products || []);
      setBrands(bd.brands || []);
      setCategories(cd.categories || []);
      setMarketplaces(md.marketplaces || []);
    } catch {
      setError('Veriler yüklenemedi');
    } finally {
      setFetching(false);
    }
  }, [token, authHeader]);

  useEffect(() => {
    if (user && token) fetchAll();
  }, [user, token, fetchAll]);

  const openCreate = () => {
    setEditProduct(null);
    setForm(emptyForm);
    setFormTab('general');
    setTab('form');
  };

  const openEdit = async (p) => {
    try {
      const res = await fetch(`${API_URL}/api/products/${p.id}`, { headers: authHeader() });
      const data = await res.json();
      const prod = data.product || p;
      setEditProduct(prod);
      setForm({
        stock_code: prod.stock_code || '',
        name: prod.name || '',
        description: prod.description || '',
        barcode: prod.barcode || '',
        brand_id: prod.brand_id || '',
        category_id: prod.category_id || '',
        cost: prod.cost || '',
        sale_price: prod.sale_price || '',
        list_price: prod.list_price || '',
        brand_min_price: prod.brand_min_price || '',
        currency: prod.currency || 'TRY',
        vat_rate: prod.vat_rate || '18',
        status: prod.status || 'active',
        marketplace_identifiers: prod.marketplace_identifiers || [],
      });
      setFormTab('general');
      setTab('form');
    } catch {
      setError('Ürün yüklenemedi');
    }
  };

  const handleFormChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const updateMI = (idx, field, value) => {
    const updated = form.marketplace_identifiers.map((mi, i) =>
      i === idx ? { ...mi, [field]: value } : mi
    );
    setForm((f) => ({ ...f, marketplace_identifiers: updated }));
  };

  const addMI = () => {
    setForm((f) => ({
      ...f,
      marketplace_identifiers: [
        ...f.marketplace_identifiers,
        { marketplace_id: '', marketplace_barcode: '', marketplace_sku: '', is_active: true },
      ],
    }));
  };

  const removeMI = (idx) => {
    setForm((f) => ({
      ...f,
      marketplace_identifiers: f.marketplace_identifiers.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const body = {
        ...form,
        brand_id: form.brand_id || null,
        category_id: form.category_id || null,
        cost: form.cost !== '' ? parseFloat(form.cost) : null,
        sale_price: form.sale_price !== '' ? parseFloat(form.sale_price) : null,
        list_price: form.list_price !== '' ? parseFloat(form.list_price) : null,
        brand_min_price: form.brand_min_price !== '' ? parseFloat(form.brand_min_price) : null,
        vat_rate: form.vat_rate !== '' ? parseFloat(form.vat_rate) : 18,
        marketplace_identifiers: form.marketplace_identifiers.filter((mi) => mi.marketplace_id),
      };

      const url = editProduct
        ? `${API_URL}/api/products/${editProduct.id}`
        : `${API_URL}/api/products`;
      const method = editProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kayıt başarısız');
        return;
      }
      setSuccess(editProduct ? 'Ürün güncellendi' : 'Ürün oluşturuldu');
      setTab('list');
      fetchAll();
    } catch {
      setError('Kayıt başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      if (res.ok) {
        setSuccess('Ürün silindi');
        fetchAll();
      }
    } catch {
      setError('Ürün silinemedi');
    }
  };

  const handleImportPreview = async () => {
    if (!importFile) return;
    setError('');
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const res = await fetch(`${API_URL}/api/products/import/preview`, {
        method: 'POST',
        headers: authHeader(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Önizleme başarısız'); return; }
      setImportPreview(data);
      const defaultMapping = {};
      const coreFields = ['stock_code','name','description','barcode','brand','category_path','cost','sale_price','list_price','brand_min_price','currency','vat_rate','status'];
      coreFields.forEach((f) => {
        const found = data.headers.find((h) => h.toLowerCase().replace(/\s/g,'_') === f);
        if (found) defaultMapping[f] = found;
      });
      setImportMapping(defaultMapping);
    } catch {
      setError('Önizleme başarısız');
    }
  };

  const handleImportCommit = async () => {
    if (!importFile) return;
    setImporting(true);
    setError('');
    setImportResult(null);

    const BATCH_SIZE = 100;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = [];
    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const fd = new FormData();
        fd.append('file', importFile);
        fd.append('mapping', JSON.stringify(importMapping));
        fd.append('offset', String(offset));
        fd.append('limit', String(BATCH_SIZE));

        const res = await fetch(`${API_URL}/api/products/import/commit`, {
          method: 'POST',
          headers: authHeader(),
          body: fd,
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'İçe aktarma başarısız');
          return;
        }

        totalCreated += data.created || 0;
        totalUpdated += data.updated || 0;
        totalErrors = [...totalErrors, ...(data.errors || [])];

        const processedCount = (data.created || 0) + (data.updated || 0) + (data.errors?.length || 0);
        hasMore = processedCount >= BATCH_SIZE;
        offset += BATCH_SIZE;

        setImportResult({
          created: totalCreated,
          updated: totalUpdated,
          errors: totalErrors,
          inProgress: hasMore,
          offset,
        });
      }

      fetchAll();
    } catch {
      setError('İçe aktarma başarısız');
    } finally {
      setImporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!token) return;
    setDownloadingExport(true);
    setError('');
    try {
      await downloadExcelFile({
        url: `${API_URL}/api/products/export`,
        token,
        defaultFilename: 'products.xlsx',
      });
    } catch (err) {
      setError(err.message || 'Excel dışa aktarma başarısız');
    } finally {
      setDownloadingExport(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!token) return;
    setDownloadingTemplate(true);
    setError('');
    try {
      await downloadExcelFile({
        url: `${API_URL}/api/products/template`,
        token,
        defaultFilename: 'products-template.xlsx',
      });
    } catch (err) {
      setError(err.message || 'Şablon indirilemedi');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleToolbarImport = (file) => {
    if (!file) return;
    setImportFile(file);
    setImportPreview(null);
    setImportResult(null);
    setPastePreview(null);
    setPasteResult(null);
    setPasteText('');
    setTab('import');
    setSuccess(`Dosya seçildi: ${file.name}`);
  };

  const parsePaste = () => {
    const text = String(pasteText || '').trim();
    if (!text) {
      setPastePreview(null);
      return;
    }
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setPastePreview(null);
      return;
    }
    const rawHeaders = lines[0].split(/\t/).map((h) => h.trim());
    const fieldIndexes = {};
    rawHeaders.forEach((h, idx) => {
      const apiField = excelHeaderToApiField(h);
      if (apiField && !fieldIndexes[apiField]) fieldIndexes[apiField] = idx;
    });
    if (!fieldIndexes.stock_code && fieldIndexes.barcode) fieldIndexes.stock_code = fieldIndexes.barcode;
    const numericFields = ['cost', 'sale_price', 'list_price', 'brand_min_price', 'desi', 'vat_rate', 'quantity', 'quantity_in', 'quantity_out', 'margin'];
    const parseNum = (v) => {
      if (v === undefined || v === null || v === '') return null;
      let s = String(v).trim().replace(/\s/g, '');
      const hasComma = s.includes(',');
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (hasComma && lastComma > (lastDot >= 0 ? lastDot : -1)) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else if (hasComma) {
        s = s.replace(',', '.');
      }
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };
    const apiRows = [];
    for (let r = 1; r < lines.length; r++) {
      const cells = lines[r].split(/\t/);
      const row = {};
      Object.entries(fieldIndexes).forEach(([field, idx]) => {
        const val = cells[idx];
        const str = val !== undefined && val !== null ? String(val).trim() : '';
        row[field] = numericFields.includes(field) ? (parseNum(str) ?? str) : str;
      });
      if (!row.stock_code && row.barcode) row.stock_code = row.barcode;
      if (row.stock_code || row.name) apiRows.push(row);
    }
    setPastePreview({ rawHeaders, apiRows, fieldIndexes });
    setPasteResult(null);
  };

  const handlePasteTransfer = async () => {
    if (!pastePreview?.apiRows?.length) return;
    setPasteTransferring(true);
    setError('');
    setPasteResult(null);
    try {
      const res = await fetch(`${API_URL}/api/products/bulk-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ rows: pastePreview.apiRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aktarım başarısız');
      setPasteResult(data);
      setSuccess(`${data.created} oluşturuldu, ${data.updated} güncellendi. ${data.errors?.length || 0} hata.`);
      fetchAll();
    } catch (err) {
      setError(err.message || 'Aktarım başarısız');
    } finally {
      setPasteTransferring(false);
    }
  };

  if (loading) return <div style={s.loading}>Yükleniyor...</div>;
  if (!user) return null;

  const categoryTree = buildCategoryTree(categories);

  return (
    <>
      <Navigation />
      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={s.heading}>Ürünler</h1>
            <p style={s.subheading}>Liste varsa export, yönetim ekranı varsa import standardını bu modülde başlatıyoruz.</p>
          </div>
          <div style={s.headerBtns}>
            <ExcelToolbar
              onExport={handleExportExcel}
              onTemplate={handleDownloadTemplate}
              onImportFileSelected={handleToolbarImport}
              exportLoading={downloadingExport}
              templateLoading={downloadingTemplate}
              importLoading={importing}
            />
            <button onClick={openCreate} style={s.btn}>+ Yeni Ürün</button>
          </div>
        </div>

        {error && <div style={s.error}>{error} <button onClick={() => setError('')} style={s.clearBtn}>✕</button></div>}
        {success && <div style={s.successBox}>{success} <button onClick={() => setSuccess('')} style={s.clearBtn}>✕</button></div>}

        <div style={s.tabs}>
          {['list','form','import'].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={tab === t ? s.activeTab : s.tabBtn}>
              {t === 'list' ? 'Liste' : t === 'form' ? (editProduct ? 'Düzenle' : 'Yeni') : 'İçe Aktar'}
            </button>
          ))}
        </div>

        {tab === 'list' && (
          fetching ? (
            <div style={s.loading}>Ürünler yükleniyor...</div>
          ) : products.length === 0 ? (
            <div style={s.empty}>Henüz ürün eklenmemiş.</div>
          ) : (
            <ProductExcelGrid
              rows={products}
              onOpenProduct={(p) => openEdit(p)}
              onSelectionChange={() => {}}
              initialVisibleColumnIds={[
                'stock_code',
                'name',
                'barcode',
                'brand_name',
                'category_name',
                'cost',
                'sale_price',
                'brand_min_price',
                'desi',
                'currency',
                'vat_rate',
                'status',
              ]}
            />
          )
        )}

        {tab === 'form' && (
          <div style={s.card}>
            <div style={s.formTabs}>
              {[['general','Genel'],['pricing','Fiyat'],['marketplaces','Pazaryerleri']].map(([t,label]) => (
                <button key={t} onClick={() => setFormTab(t)} style={formTab === t ? s.activeFormTab : s.formTabBtn}>{label}</button>
              ))}
            </div>
            <form onSubmit={handleSave}>
              {formTab === 'general' && (
                <div style={s.grid2}>
                  <label style={s.label}>Stok Kodu *<input required value={form.stock_code} onChange={(e) => handleFormChange('stock_code', e.target.value)} style={s.input} placeholder="STK-0001" /></label>
                  <label style={s.label}>Ürün Adı *<input required value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} style={s.input} placeholder="Ürün adı" /></label>
                  <label style={s.label}>Barkod (EAN/GTIN)<input value={form.barcode} onChange={(e) => handleFormChange('barcode', e.target.value)} style={s.input} placeholder="8690000000001" /></label>
                  <label style={s.label}>Marka
                    <select value={form.brand_id} onChange={(e) => handleFormChange('brand_id', e.target.value)} style={s.input}>
                      <option value="">— Marka seçin —</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </label>
                  <label style={s.label}>Kategori
                    <select value={form.category_id} onChange={(e) => handleFormChange('category_id', e.target.value)} style={s.input}>
                      <option value="">— Kategori seçin —</option>
                      {categoryTree.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <label style={s.label}>Durum
                    <select value={form.status} onChange={(e) => handleFormChange('status', e.target.value)} style={s.input}>
                      <option value="active">Aktif</option>
                      <option value="passive">Pasif</option>
                    </select>
                  </label>
                  <label style={{ ...s.label, gridColumn: '1 / -1' }}>Açıklama
                    <textarea value={form.description} onChange={(e) => handleFormChange('description', e.target.value)} style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} placeholder="Ürün açıklaması" />
                  </label>
                </div>
              )}
              {formTab === 'pricing' && (
                <div style={s.grid2}>
                  <label style={s.label}>Maliyet<input type="number" step="0.0001" min="0" value={form.cost} onChange={(e) => handleFormChange('cost', e.target.value)} style={s.input} placeholder="0.00" /></label>
                  <label style={s.label}>Satış Fiyatı<input type="number" step="0.0001" min="0" value={form.sale_price} onChange={(e) => handleFormChange('sale_price', e.target.value)} style={s.input} placeholder="0.00" /></label>
                  <label style={s.label}>Liste Fiyatı<input type="number" step="0.0001" min="0" value={form.list_price} onChange={(e) => handleFormChange('list_price', e.target.value)} style={s.input} placeholder="0.00" /></label>
                  <label style={s.label}>Firma Minimum Fiyatı<input type="number" step="0.0001" min="0" value={form.brand_min_price} onChange={(e) => handleFormChange('brand_min_price', e.target.value)} style={s.input} placeholder="4700.00" /></label>
                  <label style={s.label}>Para Birimi
                    <select value={form.currency} onChange={(e) => handleFormChange('currency', e.target.value)} style={s.input}>
                      {['TRY','USD','EUR','GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label style={s.label}>KDV Oranı (%)<input type="number" step="0.01" min="0" max="100" value={form.vat_rate} onChange={(e) => handleFormChange('vat_rate', e.target.value)} style={s.input} placeholder="18" /></label>
                </div>
              )}
              {formTab === 'marketplaces' && (
                <div>
                  {form.marketplace_identifiers.map((mi, idx) => (
                    <div key={idx} style={s.miRow}>
                      <select value={mi.marketplace_id} onChange={(e) => updateMI(idx, 'marketplace_id', e.target.value)} style={{ ...s.input, flex: '2' }}>
                        <option value="">— Pazaryeri —</option>
                        {marketplaces.map((m) => <option key={m.id} value={m.id}>{m.marketplace_name}</option>)}
                      </select>
                      <input value={mi.marketplace_barcode} onChange={(e) => updateMI(idx, 'marketplace_barcode', e.target.value)} style={{ ...s.input, flex: '2' }} placeholder="Pazaryeri Barkod" />
                      <input value={mi.marketplace_sku} onChange={(e) => updateMI(idx, 'marketplace_sku', e.target.value)} style={{ ...s.input, flex: '2' }} placeholder="Pazaryeri SKU" />
                      <input value={mi.marketplace_product_id || ''} onChange={(e) => updateMI(idx, 'marketplace_product_id', e.target.value)} style={{ ...s.input, flex: '2' }} placeholder="Pazaryeri Ürün ID" />
                      <button type="button" onClick={() => removeMI(idx)} style={s.removeMIBtn}>✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={addMI} style={s.addMIBtn}>+ Pazaryeri Ekle</button>
                </div>
              )}
              <div style={s.formActions}>
                <button type="submit" style={s.submitBtn}>{editProduct ? 'Güncelle' : 'Kaydet'}</button>
                <button type="button" onClick={() => setTab('list')} style={s.cancelBtn}>İptal</button>
              </div>
            </form>
          </div>
        )}

        {tab === 'import' && (
          <div style={s.card}>
            <h2 style={s.sectionTitle}>İçe Aktar</h2>
            <p style={s.hint}>DataGrid.xlsx ile uyumlu: Ad, Kod, Barkod, Marka, Kategori, Satış Fiyat, Alış Fiyat, Desi vb. Güncelleme anahtarı: <b>stock_code</b> (Kod).</p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={s.btn}
                onClick={() => { setImportFile(null); setImportPreview(null); setPastePreview(null); setPasteText(''); setPasteResult(null); document.getElementById('file-import')?.click(); }}
              >
                Dosya Seç (xlsx)
              </button>
              <input id="file-import" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setImportFile(e.target.files[0] || null); setImportPreview(null); setImportResult(null); setPastePreview(null); setPasteText(''); }} style={{ display: 'none' }} />
              <span style={{ alignSelf: 'center', color: '#6b7280' }}>veya</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Excel&apos;den Yapıştır (tab ile ayrılmış, ilk satır başlık)</label>
                <textarea
                  placeholder="Buraya Excel'den kopyaladığınız tabloyu yapıştırın (Ctrl+V). İlk satır kolon başlıkları olmalı."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  onBlur={parsePaste}
                  style={{ width: '100%', minHeight: 100, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  rows={4}
                />
                <button type="button" onClick={parsePaste} style={{ ...s.btn, marginTop: 8 }}>Önizle</button>
              </div>
            </div>

            {pastePreview && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={s.badgeActive}>AKTARILACAK: {pastePreview.apiRows?.length ?? 0}</span>
                  {pasteResult && (
                    <>
                      <span style={s.badgeActive}>AKTARILAN: {(pasteResult.created || 0) + (pasteResult.updated || 0)}</span>
                      {(pasteResult.errors?.length || 0) > 0 && (
                        <span style={s.marginDanger}>HATALI: {pasteResult.errors.length}</span>
                      )}
                    </>
                  )}
                </div>
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>#</th>
                        <th style={s.th}>Stok Kodu</th>
                        <th style={s.th}>Ad</th>
                        <th style={s.th}>Barkod</th>
                        <th style={s.th}>Alış Fiyat</th>
                        <th style={s.th}>Satış Fiyat</th>
                        <th style={s.th}>Desi</th>
                        {pasteResult?.errors?.length > 0 && <th style={s.th}>Aktarım Durumu</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(pastePreview.apiRows || []).slice(0, 50).map((row, i) => (
                        <tr key={i} style={s.tr}>
                          <td style={s.td}>{i + 1}</td>
                          <td style={s.td}>{row.stock_code || '—'}</td>
                          <td style={s.td}>{row.name || '—'}</td>
                          <td style={s.td}>{row.barcode || '—'}</td>
                          <td style={s.td}>{row.cost ?? '—'}</td>
                          <td style={s.td}>{row.sale_price ?? '—'}</td>
                          <td style={s.td}>{row.desi ?? '—'}</td>
                          {pasteResult?.errors?.length > 0 && (
                            <td style={s.td}>
                              {pasteResult.errors.find((e) => e.row === i + 1)?.error || '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pastePreview.apiRows?.length > 50 && <p style={s.hint}>İlk 50 satır gösteriliyor. Toplam: {pastePreview.apiRows.length}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={handlePasteTransfer} disabled={pasteTransferring || !pastePreview.apiRows?.length} style={{ ...s.btn, backgroundColor: '#16a34a' }}>
                    {pasteTransferring ? 'Aktarılıyor...' : 'Aktarımı Başlat'}
                  </button>
                  <button type="button" onClick={() => { setPastePreview(null); setPasteText(''); setPasteResult(null); }} style={s.cancelBtn}>Temizle</button>
                </div>
                {pasteResult?.errors?.length > 0 && (
                  <div style={s.importErrors}>
                    <strong>Hatalar ({pasteResult.errors.length}):</strong>
                    {pasteResult.errors.slice(0, 30).map((e, i) => (
                      <div key={i}>Satır {e.row} ({e.stock_code}): {e.error}</div>
                    ))}
                    {pasteResult.errors.length > 30 && <div>... ve {pasteResult.errors.length - 30} hata daha</div>}
                  </div>
                )}
              </div>
            )}

            <h3 style={s.subTitle}>Dosyadan İçe Aktar</h3>
            <div style={s.importSection}>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setImportFile(e.target.files[0]); setImportPreview(null); setImportResult(null); }} style={s.fileInput} />
              <button onClick={handleImportPreview} disabled={!importFile} style={s.btn}>Önizle</button>
            </div>
            {importPreview && (
              <div>
                <h3 style={s.subTitle}>Kolon Eşleme</h3>
                <p style={s.hint}>Dosyadan tespit edilen kolonları sistem alanlarına eşleyin.</p>
                <div style={s.mappingGrid}>
                  {[
                    ['stock_code','Stok Kodu *'],['name','Ad *'],['description','Açıklama'],
                    ['barcode','Barkod'],['brand','Marka'],['category_path','Kategori Yolu'],
                    ['cost','Maliyet'],['sale_price','Satış Fiyatı'],['list_price','Liste Fiyatı'],
                    ['brand_min_price','Firma Minimum Fiyatı'],['currency','Para Birimi'],['vat_rate','KDV %'],['status','Durum'],
                    ...marketplaces.flatMap((m) => [
                      [`marketplace_${m.id}_barcode`, `${m.marketplace_name} Barkod`],
                      [`marketplace_${m.id}_sku`, `${m.marketplace_name} SKU`],
                    ]),
                  ].map(([field, label]) => (
                    <label key={field} style={s.mappingLabel}>
                      <span style={s.mappingFieldName}>{label}</span>
                      <select value={importMapping[field] || ''} onChange={(e) => setImportMapping((m) => ({ ...m, [field]: e.target.value }))} style={s.input}>
                        <option value="">— eşleme yok —</option>
                        {importPreview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <h3 style={s.subTitle}>Örnek Satırlar</h3>
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>{importPreview.headers.map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {importPreview.sample_rows.map((row, i) => (
                        <tr key={i} style={s.tr}>
                          {importPreview.headers.map((h) => <td key={h} style={s.td}>{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={handleImportCommit} disabled={importing} style={{ ...s.btn, marginTop: '16px' }}>
                  {importing ? `⏳ İçe aktarılıyor... (${importResult?.offset || 0} / işlendi)` : '⬆ İçe Aktar'}
                </button>
              </div>
            )}
            {importResult && (
              <div style={s.importResult}>
                {importResult.inProgress && (
                  <div style={{ marginBottom: '8px' }}>⏳ İçe aktarılıyor... ({importResult.offset} satır işlendi)</div>
                )}
                <strong>Sonuç:</strong> {importResult.created} oluşturuldu, {importResult.updated} güncellendi.
                {importResult.errors?.length > 0 && (
                  <div style={s.importErrors}>
                    <strong>Hatalar ({importResult.errors.length}):</strong>
                    {importResult.errors.map((e, i) => (
                      <div key={i}>Satır {e.row}: {e.error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function buildCategoryTree(categories, parentId = null, depth = 0) {
  return categories
    .filter((c) => (c.parent_id === null || c.parent_id === undefined ? parentId === null : parseInt(c.parent_id) === parentId))
    .flatMap((c) => [
      { id: c.id, label: '  '.repeat(depth) + (depth > 0 ? '└ ' : '') + c.name },
      ...buildCategoryTree(categories, c.id, depth + 1),
    ]);
}

function renderMarginBadge(product) {
  const cost = Number(product?.cost || 0);
  const salePrice = Number(product?.sale_price || 0);

  if (!cost || !salePrice) {
    return <span style={s.marginUnknown}>Hesaplanamadı</span>;
  }

  const margin = ((salePrice - cost) / cost) * 100;
  if (!Number.isFinite(margin)) {
    return <span style={s.marginUnknown}>Hesaplanamadı</span>;
  }

  if (margin < 10) {
    return <span style={s.marginDanger}>%{margin.toFixed(1)}</span>;
  }

  if (margin < 20) {
    return <span style={s.marginWarn}>%{margin.toFixed(1)}</span>;
  }

  return <span style={s.marginGood}>%{margin.toFixed(1)}</span>;
}

const s = {
  loading: { padding: '40px', textAlign: 'center', fontSize: '18px' },
  main: { padding: '32px', maxWidth: '1400px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  heading: { fontSize: '28px', color: '#2c3e50', margin: 0 },
  subheading: { margin: '8px 0 0', color: '#6b7280', fontSize: '14px' },
  headerBtns: { display: 'flex', gap: '10px' },
  btn: { padding: '10px 20px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  importBtn: { padding: '10px 20px', backgroundColor: '#8e44ad', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  error: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  successBox: { backgroundColor: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'inherit' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '0' },
  tabBtn: { padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#6b7280', borderBottom: '2px solid transparent', marginBottom: '-2px' },
  activeTab: { padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#3498db', fontWeight: '700', borderBottom: '2px solid #3498db', marginBottom: '-2px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '13px' },
  th: { backgroundColor: '#2c3e50', color: '#fff', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1f2f6' },
  td: { padding: '10px 12px', color: '#2c3e50', whiteSpace: 'nowrap' },
  empty: { textAlign: 'center', color: '#7f8c8d', padding: '40px' },
  analyzeBtn: { padding: '5px 10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', marginRight: '6px' },
  editBtn: { padding: '5px 10px', backgroundColor: '#f39c12', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', marginRight: '6px' },
  deleteBtn: { padding: '5px 10px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' },
  badgeActive: { backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' },
  badgePassive: { backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' },
  marginGood: { backgroundColor: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 },
  marginWarn: { backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 },
  marginDanger: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 },
  marginUnknown: { backgroundColor: '#e5e7eb', color: '#374151', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 },
  card: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '24px' },
  formTabs: { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '0' },
  formTabBtn: { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#6b7280', borderBottom: '2px solid transparent', marginBottom: '-2px' },
  activeFormTab: { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#27ae60', fontWeight: '700', borderBottom: '2px solid #27ae60', marginBottom: '-2px' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' },
  label: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151', fontWeight: '500' },
  input: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  formActions: { display: 'flex', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' },
  submitBtn: { padding: '10px 24px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  cancelBtn: { padding: '10px 24px', backgroundColor: '#95a5a6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  miRow: { display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' },
  addMIBtn: { padding: '8px 16px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', marginTop: '8px' },
  removeMIBtn: { padding: '6px 10px', backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', flexShrink: 0 },
  sectionTitle: { fontSize: '20px', color: '#2c3e50', marginBottom: '8px' },
  subTitle: { fontSize: '16px', color: '#2c3e50', margin: '20px 0 8px' },
  hint: { fontSize: '13px', color: '#6b7280', marginBottom: '12px' },
  importSection: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' },
  fileInput: { border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px', fontSize: '13px' },
  mappingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '16px' },
  mappingLabel: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151', fontWeight: '500' },
  mappingFieldName: { fontSize: '12px', color: '#6b7280' },
  importResult: { marginTop: '16px', padding: '14px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '8px', fontSize: '14px' },
  importErrors: { marginTop: '8px', padding: '10px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '6px', fontSize: '13px' },
};
