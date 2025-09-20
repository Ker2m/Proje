const { pool } = require('../config/database');

async function addLocationIndexes() {
  try {
    console.log('Konum indeksleri ekleniyor...');

    // Konum paylaşımı için indeks
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_location_sharing 
      ON users (location_is_sharing, location_last_updated) 
      WHERE location_is_sharing = true AND location_latitude IS NOT NULL
    `);

    // Konum koordinatları için indeks
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_location_coords 
      ON users (location_latitude, location_longitude) 
      WHERE location_is_sharing = true
    `);

    // Aktif kullanıcılar için indeks
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_active_location 
      ON users (is_active, location_is_sharing, location_last_updated)
    `);

    console.log('Konum indeksleri başarıyla eklendi!');

  } catch (error) {
    console.error('Konum indeksleri eklenirken hata:', error);
    throw error;
  }
}

// Script çalıştırılıyorsa
if (require.main === module) {
  addLocationIndexes()
    .then(() => {
      console.log('Index migration tamamlandı!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Index migration hatası:', error);
      process.exit(1);
    });
}

module.exports = addLocationIndexes;
