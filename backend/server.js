const app = require('./app');

// DB başlat ve server'ı çalıştır
const PORT = process.env.PORT || 5000;
const initDB = require('./migrations/init.js');

initDB()
  .then(() => {
    console.log('DB hazır');

    const server = app.listen(PORT, () => {
      console.log(`Server ${PORT} portunda çalışıyor [${process.env.NODE_ENV || 'development'}]`);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM alındı, sunucu kapatılıyor...');
      server.close(() => {
        console.log('Sunucu kapatıldı.');
        process.exit(0);
      });
    });
  })
  .catch((err) => {
    console.error('DB başlatılamadı:', err);
    process.exit(1);
  });

module.exports = app;
