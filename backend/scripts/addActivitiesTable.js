const { pool } = require('../config/database');

async function addActivitiesTable() {
  let client;
  
  try {
    // Mevcut database config'i kullan
    client = await pool.connect();

    console.log('🔌 Veritabanına bağlanıldı');

    // Activities tablosunu oluştur
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    await client.query(createTableQuery);
    console.log('✅ Activities tablosu oluşturuldu');

    // Indexleri oluştur
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type)'
    ];

    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }
    console.log('✅ Indexler oluşturuldu');

    // Tabloyu kontrol et
    const result = await client.query('SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1', ['activities']);
    console.log('📋 Activities tablosu yapısı:');
    console.table(result.rows);

    console.log('🎉 Activities tablosu başarıyla eklendi!');

  } catch (error) {
    console.error('❌ Hata:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Script'i çalıştır
if (require.main === module) {
  addActivitiesTable()
    .then(() => {
      console.log('✅ Migration tamamlandı');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration hatası:', error);
      process.exit(1);
    });
}

module.exports = addActivitiesTable;
