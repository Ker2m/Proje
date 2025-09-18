const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './config.env' });

// Veritabanı bağlantısı
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'caddate_db',
});

async function runMigration() {
  try {
    console.log('🔄 Migration başlatılıyor...');
    
    // SQL dosyasını oku
    const sqlPath = path.join(__dirname, '../database/schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // SQL komutlarını çalıştır
    await pool.query(sqlContent);
    
    console.log('✅ Migration başarıyla tamamlandı!');
    console.log('📊 Oluşturulan tablolar:');
    console.log('   - users');
    console.log('   - user_profiles');
    console.log('   - messages');
    console.log('   - photos');
    console.log('   - matches');
    console.log('   - email_verifications');
    
  } catch (error) {
    console.error('❌ Migration hatası:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Migration'ı çalıştır
runMigration();
