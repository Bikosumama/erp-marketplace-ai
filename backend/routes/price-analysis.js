const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { buildRecommendation, toNumber } = require('../services/priceAnalyzer');
const { sendWorkbook } = require('../services/excelExport');

// Excel Okumak için Gerekli Kütüphaneler
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const ExcelJS = require('exceljs');

router.use(authMiddleware);

// --- YARDIMCI FONKSİYONLAR (Senin mevcut fonksiyonların) ---
function parseRecommendationMetadata(metadata) {
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata;
    try { return JSON.parse(metadata); } catch (e) { return {}; }
}

function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

// ... (Burada senin paylaştığın buildRecommendationResponseRow, fetchRecommendationRows vb. fonksiyonların var olduğunu varsayıyoruz)
// Not: Kodun çok uzun olmaması için senin diğer yardımcı fonksiyonlarını (fetchRecommendationRows, analyzeSingleProduct vb.) 
// aynen koruduğunu varsayıyorum. Aşağıya kritik YENİ bölümleri ekliyorum.

// --- EXPORT (Dışa Aktar) ---
router.get('/export', async (req, res) => {
    try {
        const recommendations = await fetchRecommendationRows({
            status: req.query.status,
            productId: req.query.product_id,
        });

        if (!recommendations.length) {
            return res.status(404).json({ error: 'Dışa aktarılacak kayıt bulunamadı' });
        }

        const now = new Date();
        const filename = `fiyat-analizi-${now.toISOString().split('T')[0]}.xlsx`;

        await sendWorkbook(res, {
            filename,
            sheets: [{
                name: 'Fiyat Analizi',
                columns: [
                    { header: 'Ürün ID', key: 'product_id', width: 10 },
                    { header: 'Stok Kodu', key: 'stock_code', width: 20 },
                    { header: 'Ürün Adı', key: 'product_name', width: 30 },
                    { header: 'Pazaryeri', key: 'marketplace_name', width: 15 },
                    { header: 'Güncel Fiyat', key: 'current_price', width: 15 },
                    { header: 'Önerilen Fiyat', key: 'recommended_price', width: 15 }
                ],
                rows: recommendations
            }]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- IMPORT & ANALYZE (Excel Yükle ve Analiz Et) ---
// Bu yeni eklediğimiz rota
router.post('/import-and-analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Lütfen bir Excel dosyası yükleyin' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1); // 1. sayfayı oku

        const sonuclar = [];
        const actorName = req.user?.email || 'excel_user';

        // Excel satırlarını dönüyoruz
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const stockCode = row.getCell(2).value; // 2. sütun: Stok Kodu

            if (!stockCode) continue;

            // Veritabanında ürünü bul
            const productRes = await pool.query('SELECT * FROM products WHERE stock_code = $1', [stockCode]);
            
            if (productRes.rows.length > 0) {
                const product = productRes.rows[0];
                try {
                    // Senin mevcut analiz motorunu çalıştırıyoruz
                    // Not: analyzeSingleProduct fonksiyonunun yukarıda tanımlı olduğundan emin ol
                    const result = await analyzeSingleProduct(product, null, actorName);
                    sonuclar.push({ stock_code: stockCode, durum: 'Başarılı', id: result.id });
                } catch (err) {
                    sonuclar.push({ stock_code: stockCode, durum: 'Hata', mesaj: err.message });
                }
            } else {
                sonuclar.push({ stock_code: stockCode, durum: 'Bulunamadı' });
            }
        }

        res.json({
            message: 'İşlem tamamlandı',
            count: sonuclar.length,
            details: sonuclar
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Excel işlenirken bir hata oluştu: ' + error.message });
    }
});

// Senin diğer route tanımların (analyze, apply, reject vb.) buraya gelecek...

module.exports = router;
