const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
// Tüm mantığı servisten alıyoruz
const { analyzeSingleProduct } = require('../services/priceAnalyzer');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const ExcelJS = require('exceljs');

router.use(authMiddleware);

// EXCEL IMPORT ENDPOINT
router.post('/import-and-analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi' });
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1);
        const sonuclar = [];
        const actorName = req.user?.email || 'excel_user';

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const stockCode = worksheet.getRow(i).getCell(2).value;
            if (!stockCode) continue;

            const productRes = await pool.query('SELECT * FROM products WHERE stock_code = $1', [stockCode]);
            
            if (productRes.rows.length > 0) {
                try {
                    // Servisteki fonksiyonu çağırıyoruz
                    await analyzeSingleProduct(productRes.rows[0], null, actorName);
                    sonuclar.push({ stockCode, status: 'Başarılı' });
                } catch (err) {
                    sonuclar.push({ stockCode, status: 'Hata', message: err.message });
                }
            } else {
                sonuclar.push({ stockCode, status: 'Bulunamadı' });
            }
        }
        res.json({ message: 'İşlem tamamlandı', count: sonuclar.length, details: sonuclar });
    } catch (err) {
        res.status(500).json({ error: 'Sistem Hatası: ' + err.message });
    }
});

// Diğer standart rotalar (summary, recommendations vb. sadece pool.query içermeli)
router.get('/summary', async (req, res) => { /* mevcut basit query kodun */ });

// EN KRİTİK SATIR: Bu dosya bir router'dır!
module.exports = router;
