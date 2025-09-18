const { Pool } = require('pg');
require('dotenv').config({ path: './config.env' });

// PostgreSQL'e bağlan (veritabanı olmadan)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres', // Varsayılan postgres veritabanına bağlan
});

async function createDatabase() {
  try {
    console.log('🔄 Veritabanı oluşturuluyor...');
    
    // Veritabanının var olup olmadığını kontrol et
    const checkDb = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME || 'caddate_db']
    );
    
    if (checkDb.rows.length > 0) {
      console.log('✅ Veritabanı zaten mevcut!');
    } else {
      // Veritabanını oluştur
      await pool.query(`CREATE DATABASE ${process.env.DB_NAME || 'caddate_db'}`);
      console.log('✅ Veritabanı başarıyla oluşturuldu!');
    }
    
  } catch (error) {
    console.error('❌ Veritabanı oluşturma hatası:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Veritabanını oluştur
createDatabase();
