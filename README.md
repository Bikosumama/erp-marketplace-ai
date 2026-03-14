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
| GET | `/api/products` | Evet | Ürünleri listele |
| POST | `/api/products` | Evet | Yeni ürün oluştur |
| PUT | `/api/products/:id` | Evet | Ürün güncelle |
| DELETE | `/api/products/:id` | Evet | Ürün sil |
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