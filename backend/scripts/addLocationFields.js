const { pool } = require('../config/database');

async function addLocationFields() {
  try {
    console.log('Konum alanları ekleniyor...');

    // Konum alanlarını ekle
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS location_accuracy DECIMAL(8, 2),
      ADD COLUMN IF NOT EXISTS location_is_sharing BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS location_last_updated TIMESTAMP,
      ADD COLUMN IF NOT EXISTS privacy JSONB DEFAULT '{"showLocation": false, "profileVisibility": "public", "showOnlineStatus": true, "allowMessages": true}'
    `);

    console.log('Konum alanları başarıyla eklendi!');

    // Mevcut kullanıcılar için varsayılan değerleri ayarla
    await pool.query(`
      UPDATE users 
      SET privacy = '{"showLocation": false, "profileVisibility": "public", "showOnlineStatus": true, "allowMessages": true}'
      WHERE privacy IS NULL
    `);

    console.log('Mevcut kullanıcılar için varsayılan değerler ayarlandı!');

  } catch (error) {
    console.error('Konum alanları eklenirken hata:', error);
    throw error;
  }
}

// Script çalıştırılıyorsa
if (require.main === module) {
  addLocationFields()
    .then(() => {
      console.log('Migration tamamlandı!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration hatası:', error);
      process.exit(1);
    });
}

module.exports = addLocationFields;
