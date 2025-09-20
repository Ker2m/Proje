const { Pool } = require('pg');
require('dotenv').config({ path: './config.env' });

// Veritabanı bağlantısı
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function updateDatabase() {
  try {
    console.log('🔄 Veritabanı güncelleniyor...');

    // Notifications tablosunu oluştur
    const notificationsTable = `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        is_sent BOOLEAN DEFAULT false,
        sent_at TIMESTAMP NULL,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(notificationsTable);
    console.log('✅ Notifications tablosu oluşturuldu');

    // Notifications indexlerini oluştur
    const notificationsIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id);',
      'CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);',
      'CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);',
      'CREATE INDEX IF NOT EXISTS idx_notifications_is_sent ON notifications(is_sent);'
    ];

    for (const indexQuery of notificationsIndexes) {
      await pool.query(indexQuery);
    }
    console.log('✅ Notifications indexleri oluşturuldu');

    // User profiles tablosuna yeni alanları ekle
    const alterUserProfiles = `
      ALTER TABLE user_profiles 
      ADD COLUMN IF NOT EXISTS occupation VARCHAR(255),
      ADD COLUMN IF NOT EXISTS education VARCHAR(255),
      ADD COLUMN IF NOT EXISTS height INTEGER,
      ADD COLUMN IF NOT EXISTS relationship_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS looking_for VARCHAR(100),
      ADD COLUMN IF NOT EXISTS languages TEXT[],
      ADD COLUMN IF NOT EXISTS hobbies TEXT[],
      ADD COLUMN IF NOT EXISTS personality_traits TEXT[],
      ADD COLUMN IF NOT EXISTS lifestyle_preferences JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT '{}';
    `;

    await pool.query(alterUserProfiles);
    console.log('✅ User profiles tablosu güncellendi');

    // Notifications trigger'ını oluştur
    const notificationsTrigger = `
      CREATE TRIGGER update_notifications_updated_at 
      BEFORE UPDATE ON notifications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    try {
      await pool.query(notificationsTrigger);
      console.log('✅ Notifications trigger oluşturuldu');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Notifications trigger zaten mevcut');
      } else {
        throw error;
      }
    }

    console.log('🎉 Veritabanı güncellemesi tamamlandı!');

  } catch (error) {
    console.error('❌ Veritabanı güncelleme hatası:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Script'i çalıştır
if (require.main === module) {
  updateDatabase()
    .then(() => {
      console.log('✅ Veritabanı başarıyla güncellendi');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Hata:', error);
      process.exit(1);
    });
}

module.exports = { updateDatabase };
