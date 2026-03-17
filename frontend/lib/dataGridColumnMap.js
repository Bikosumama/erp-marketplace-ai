/**
 * DataGrid.xlsx kolon isimleri -> API alan eşlemesi.
 * Hem grid kolon seçicisinde hem Excel'den yapıştır import'ta kullanılır.
 */
export const DATA_GRID_TO_API = {
  Ad: 'name',
  'Fatura Ad': 'name', // alternatif
  Kod: 'stock_code',
  Barkod: 'barcode',
  Marka: 'brand_name',
  Kategori: 'category_name',
  Açıklama: 'description',
  'Satış Fiyat': 'sale_price',
  'Fatura Fiyat': 'list_price',
  'Alış Fiyat': 'cost',
  'Alış Fiyat (Kdvli)': 'cost',
  Desi: 'desi',
  'Satış Kdv': 'vat_rate',
  'Fatura Kdv': 'vat_rate',
  Birim: 'currency',
  'Satış Döviz': 'currency',
  'Döviz (Web)': 'currency',
  Aktif: 'status',
  Miktar: 'quantity',
  Giren: 'quantity_in',
  Çıkan: 'quantity_out',
  'Üretici Kodu': 'stock_code',
  Id: 'external_id',
  'Kısa Açıklama': 'description',
  Envanter: 'quantity',
  Maliyet: 'cost',
  'Kar Marjı': 'margin',
  'Web Fiyatı': 'sale_price',
  'Liste Fiyatı': 'list_price',
  'Sabit Fiyat': 'brand_min_price',
  // API alan adları aynen kullanılabilsin
  name: 'name',
  stock_code: 'stock_code',
  barcode: 'barcode',
  brand_name: 'brand_name',
  category_name: 'category_name',
  description: 'description',
  cost: 'cost',
  sale_price: 'sale_price',
  list_price: 'list_price',
  brand_min_price: 'brand_min_price',
  desi: 'desi',
  vat_rate: 'vat_rate',
  currency: 'currency',
  status: 'status',
};

/** Grid'de gösterilebilir kolonlar (DataGrid.xlsx ile uyumlu etiketler) */
export const GRID_COLUMNS = [
  { id: 'stock_code', label: 'Stok Kodu', excelNames: ['Kod', 'Üretici Kodu'] },
  { id: 'name', label: 'Ad', excelNames: ['Ad', 'Fatura Ad'] },
  { id: 'barcode', label: 'Barkod', excelNames: ['Barkod'] },
  { id: 'brand_name', label: 'Marka', excelNames: ['Marka'] },
  { id: 'category_name', label: 'Kategori', excelNames: ['Kategori'] },
  { id: 'description', label: 'Açıklama', excelNames: ['Açıklama', 'Kısa Açıklama'] },
  { id: 'cost', label: 'Alış Fiyat', excelNames: ['Alış Fiyat', 'Maliyet', 'Alış Fiyat (Kdvli)'] },
  { id: 'sale_price', label: 'Satış Fiyat', excelNames: ['Satış Fiyat', 'Web Fiyatı'] },
  { id: 'list_price', label: 'Liste Fiyatı', excelNames: ['Fatura Fiyat', 'Liste Fiyatı'] },
  { id: 'brand_min_price', label: 'Firma Min / Sabit Fiyat', excelNames: ['Sabit Fiyat'] },
  { id: 'desi', label: 'Desi', excelNames: ['Desi'] },
  { id: 'currency', label: 'Para Birimi', excelNames: ['Birim', 'Satış Döviz', 'Döviz (Web)'] },
  { id: 'vat_rate', label: 'KDV %', excelNames: ['Satış Kdv', 'Fatura Kdv'] },
  { id: 'status', label: 'Durum', excelNames: ['Aktif'] },
];

/**
 * Yapıştırılan Excel satırındaki başlıktan API alan adını bulur.
 * @param {string} header - Excel kolon başlığı
 * @returns {string|undefined} - API alan adı veya undefined
 */
export function excelHeaderToApiField(header) {
  const trimmed = String(header ?? '').trim();
  if (!trimmed) return undefined;
  if (DATA_GRID_TO_API[trimmed]) return DATA_GRID_TO_API[trimmed];
  const lower = trimmed.toLowerCase().replace(/\s+/g, '_');
  for (const [excelName, apiField] of Object.entries(DATA_GRID_TO_API)) {
    if (excelName.toLowerCase() === trimmed.toLowerCase()) return apiField;
    if (excelName.toLowerCase().replace(/\s+/g, '_') === lower) return apiField;
  }
  return undefined;
}
