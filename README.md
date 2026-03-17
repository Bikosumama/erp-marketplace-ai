# ERP Marketplace AI

Trendyol, Hepsiburada, Amazon Türkiye, N11, İdefix ve Pazarama'ya entegre olan, AI destekli dinamik fiyatlandırma özelliğine sahip bir ERP sistemi.

## Özellikler

### 📦 Ürün Yönetimi
- Ürün ekleme, düzenleme, silme
- Pazaryeri senkronizasyonu
- Stok takibi
- SKU yönetimi

### 📊 Sipariş Yönetimi
- Tüm pazaryerlerden sipariş takibi
- Sipariş durumu güncellemeleri
- Müşteri bilgileri

### 💰 Pazaryeri Entegrasyonu
- Trendyol
- Hepsiburada
- Amazon Türkiye
- N11
- İdefix
- Pazarama

### 🤖 AI Fiyat Analizi Robotu
- Rakip fiyat izleme
- Dinamik fiyatlandırma
- Kar/zarar analizi

### 📈 Kar/Zarar Hesabı
- Maliyetler (manuel, Excel, fatura girişleri)
- Kargo ücretleri
- Pazaryeri komisyonları

## Kurulum

### Gereksinimler
- Node.js 18+

### Otomatik Git push (isteğe bağlı)
Commit sonrası değişikliklerin otomatik GitHub'a gönderilmesi için proje kökünde:
- Windows (PowerShell): `copy scripts\git-hooks\post-commit .git\hooks\post-commit`
- macOS/Linux: `cp scripts/git-hooks/post-commit .git/hooks/post-commit && chmod +x .git/hooks/post-commit`

Bundan sonra her `git commit` sonrası `git push origin main` otomatik çalışır.

### Backend Kurulumu

```bash
cd backend
npm install
cp .env.example .env   # JWT_SECRET ve PORT ayarlarını yapılandır
npm run dev            # http://localhost:5000 üzerinde çalışır
```

**Backend Ortam Değişkenleri** (`backend/.env`):
| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `PORT` | Backend port numarası | `5000` |
| `JWT_SECRET` | JWT imzalama anahtarı (üretimde değiştirin) | — |
| `NODE_ENV` | Ortam (`development`/`production`) | `development` |
| `DB_HOST` | PostgreSQL sunucu adresi | `postgres` (docker) / `localhost` (yerel) |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Veritabanı adı | `mydatabase` |
| `DB_USER` | Veritabanı kullanıcısı | `user` |
| `DB_PASSWORD` | Veritabanı şifresi | `password` |

### Veritabanı Migrations

```bash
cd backend
# Tabloları oluştur (ilk kurulumda veya şema değişikliğinde çalıştır):
node migrations/init.js
```

Bu komut şu tabloları oluşturur:
- `users` – Kullanıcı hesapları
- `brands` – Markalar
- `categories` – Kategori ağacı (parent_id ile hiyerarşi)
- `marketplaces` – Pazaryerleri (Trendyol, Hepsiburada vb.)
- `products` – ERP ürün master (stock_code, barcode, brand_id, category_id, fiyat alanları, JSONB attributes)
- `product_marketplace_identifiers` – Ürün bazında pazaryeri barkod/SKU eşlemeleri
- `marketplace_accounts` – Pazaryeri hesapları (eski uyumluluk)
- `orders` – Siparişler

### Frontend Kurulumu (Next.js 15 App Router)

```bash
cd frontend
npm install
cp .env.example .env.local   # API URL ayarını yapılandır
npm run dev                   # http://localhost:3001 üzerinde çalışır
```

**Frontend Ortam Değişkenleri** (`frontend/.env.local`):
| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:5000` |

### Erişim

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:5000/api/health

### Sayfalar

| Sayfa | URL |
|---|---|
| Dashboard | `/dashboard` |
| Ürünler | `/products` |
| Siparişler | `/orders` |
| Pazaryerleri | `/marketplaces` |
| Fiyat Analizi | `/price-analysis` |
| Giriş | `/login` |
| Kayıt | `/register` |

### Backend API Endpointleri

| Method | Endpoint | Auth | Açıklama |
|---|---|---|---|
| POST | `/api/auth/register` | Hayır | Kullanıcı kaydı |
| POST | `/api/auth/login` | Hayır | Kullanıcı girişi (JWT döner) |
| GET | `/api/products` | Evet | Ürünleri listele (marka ve kategori bilgisiyle) |
| GET | `/api/products/:id` | Evet | Tekil ürün + pazaryeri eşlemeleri |
| POST | `/api/products` | Evet | Yeni ürün oluştur (stock_code, name zorunlu; marketplace_identifiers dizisi opsiyonel) |
| PUT | `/api/products/:id` | Evet | Ürün güncelle |
| DELETE | `/api/products/:id` | Evet | Ürün sil |
| GET | `/api/brands` | Evet | Markaları listele |
| POST | `/api/brands` | Evet | Marka oluştur |
| DELETE | `/api/brands/:id` | Evet | Marka sil |
| GET | `/api/categories` | Evet | Kategorileri listele (düz liste, ağaç istemci tarafında oluşturulur) |
| POST | `/api/categories` | Evet | Kategori oluştur |
| POST | `/api/categories/resolve-path` | Evet | "Elektronik > Telefon > Aksesuar" yoluyla kategori ağacı bul/oluştur |
| DELETE | `/api/categories/:id` | Evet | Kategori sil |
| POST | `/api/products/import/preview` | Evet | Excel/CSV dosyasını yükle, kolonlar + örnek satırlar döner |
| POST | `/api/products/import/commit` | Evet | Eşleme + dosyayla DB'ye yaz (oluştur veya güncelle) |
| GET | `/api/orders` | Evet | Siparişleri listele |
| POST | `/api/orders` | Evet | Yeni sipariş oluştur |
| PUT | `/api/orders/:id` | Evet | Sipariş güncelle |
| DELETE | `/api/orders/:id` | Evet | Sipariş sil |
| GET | `/api/marketplaces` | Evet | Pazaryerlerini listele |
| POST | `/api/marketplaces` | Evet | Pazaryeri ekle |
| DELETE | `/api/marketplaces/:id` | Evet | Pazaryeri sil |
| POST | `/api/marketplaces/:id/sync` | Evet | Pazaryeri senkronize et |
| GET | `/api/price-analysis/recommendations` | Evet | Fiyat önerileri |
| GET | `/api/price-analysis/history` | Evet | Fiyat geçmişi |
| POST | `/api/price-analysis/analyze` | Evet | Analiz başlat |
| POST | `/api/price-analysis/:id/apply` | Evet | Öneriyi uygula |

> **Not:** Auth gerektiren endpointler için `Authorization: Bearer <token>` header'ı gereklidir.

## Proje Yapısı

```
erp-marketplace-ai/
├── appsmith/              # Appsmith UI JSON dosyaları
├── backend/               # Node.js/Express API
│   ├── middleware/        # Auth middleware
│   ├── routes/            # API rotaları
│   └── server.js          # Ana sunucu dosyası
├── frontend/              # Next.js 15 App Router
│   ├── app/               # App Router sayfaları
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── marketplaces/
│   │   ├── price-analysis/
│   │   ├── login/
│   │   ├── register/
│   │   ├── layout.js      # Kök layout
│   │   └── providers.js   # Auth provider
│   ├── components/        # Paylaşılan bileşenler
│   └── context/           # Auth context
├── database/              # PostgreSQL şemaları
├── docs/                  # Dokümantasyon
└── README.md
```