const { Pool } = require('pg');

// Veritabanı bağlantı ayarları
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'caddate_db',
  max: 20, // Maksimum bağlantı sayısı
  idleTimeoutMillis: 30000, // Boşta kalma süresi
  connectionTimeoutMillis: 2000, // Bağlantı timeout süresi
});

// Bağlantı testi
pool.on('connect', () => {
  console.log('✅ PostgreSQL veritabanına bağlandı');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL bağlantı hatası:', err);
  process.exit(-1);
});

// Veritabanı bağlantısını test et
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('🔍 Veritabanı bağlantısı test ediliyor...');
    const result = await client.query('SELECT NOW()');
    console.log('✅ Veritabanı bağlantısı başarılı:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Veritabanı bağlantı testi başarısız:', err.message);
  }
};

module.exports = {
  pool,
  testConnection
};
