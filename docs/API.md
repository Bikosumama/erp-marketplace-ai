# API Dokumentasyonu

## Base URL
```
http://localhost:5000/api
```

## Endpoints

### Ürünler (Products)

#### Tüm Ürünleri Listele
```
GET /products
```

Response:
```json
{
  "message": "Tüm ürünler",
  "products": []
}
```

#### Yeni Ürün Oluştur
```
POST /products
```

Body:
```json
{
  "name": "Ürün Adı",
  "description": "Ürün Açıklaması",
  "cost": 50.00,
  "sku": "SKU123"
}
```

#### Ürün Güncelle
```
PUT /products/:id
```

#### Ürün Sil
```
DELETE /products/:id
```

---

### Siparişler (Orders)

#### Tüm Siparişleri Listele
```
GET /orders
```

#### Sipariş Detayı
```
GET /orders/:id
```

#### Sipariş Güncelle
```
PUT /orders/:id
```

Body:
```json
{
  "status": "shipped",
  "tracking_number": "TR123456"
}
```

---

### Pazaryerleri (Marketplaces)

#### Pazaryeri Hesaplarını Listele
```
GET /marketplaces
```

Response:
```json
{
  "message": "Pazaryeri hesapları",
  "marketplaces": ["Trendyol", "Hepsiburada", "Amazon Türkiye", "N11", "İdefix", "Pazarama"]
}
```

#### Pazaryeri Hesabı Ekle
```
POST /marketplaces
```

Body:
```json
{
  "marketplace_name": "Trendyol",
  "api_key": "your_api_key",
  "api_secret": "your_api_secret"
}
```

#### Ürünleri Senkronize Et
```
POST /marketplaces/:id/sync
```

---

### Fiyat Analizi (Price Analysis)

#### Fiyat Önerileri Al
```
GET /price-analysis/recommendations
```

Response:
```json
{
  "message": "Fiyat önerileri",
  "recommendations": [
    {
      "product_id": 1,
      "current_price": 100,
      "recommended_price": 105,
      "reason": "Kar marjı artırılabilir",
      "confidence": 0.85
    }
  ]
}
```

#### Fiyat Geçmişi Al
```
GET /price-analysis/history
```

#### Fiyat Analizi Yap
```
POST /price-analysis/analyze
```

Body:
```json
{
  "product_id": 1,
  "marketplace_id": 1
}
```

---

## Error Codes

| Code | Message |
|------|---------|
| 200 | OK |
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Server Error |

## Authentication

Henüz JWT token desteği eklenmedi. Sonraki versiyonda eklenecektir.