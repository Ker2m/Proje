const { pool } = require('../config/database');

const addSocialTables = async () => {
  try {
    console.log('🚀 Social tabloları ekleniyor...');

    // Profile visits tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profile_visits (
        id SERIAL PRIMARY KEY,
        visitor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Profile visits için unique constraint ekle
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_visits_unique 
      ON profile_visits(visitor_id, profile_id, DATE(created_at))
    `);
    console.log('✅ profile_visits tablosu oluşturuldu');

    // Follows tablosu
    await pool.query(`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `);
    console.log('✅ follows tablosu oluşturuldu');

    // İndeksler
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_profile_visits_visitor ON profile_visits(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_profile_visits_profile ON profile_visits(profile_id);
      CREATE INDEX IF NOT EXISTS idx_profile_visits_created_at ON profile_visits(created_at);
      CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
      CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
      CREATE INDEX IF NOT EXISTS idx_follows_created_at ON follows(created_at);
    `);
    console.log('✅ İndeksler oluşturuldu');

    console.log('🎉 Social tabloları başarıyla eklendi!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Social tabloları eklenirken hata:', error);
    process.exit(1);
  }
};

addSocialTables();
