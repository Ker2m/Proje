const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '2580',
  database: process.env.DB_NAME || 'caddate_db',
});

async function testUsers() {
  try {
    console.log('Veritabanına bağlanıyor...');
    
    // Tüm kullanıcıları getir
    const result = await pool.query(`
      SELECT 
        id, 
        first_name, 
        last_name, 
        email, 
        is_active,
        email_verified
      FROM users 
      ORDER BY id
    `);
    
    console.log('Toplam kullanıcı sayısı:', result.rows.length);
    console.log('Kullanıcılar:');
    result.rows.forEach(user => {
      console.log(`- ID: ${user.id}, İsim: ${user.first_name} ${user.last_name}, Email: ${user.email}, Aktif: ${user.is_active}, Email Doğrulanmış: ${user.email_verified}`);
    });
    
    // Aktif kullanıcıları getir
    const activeResult = await pool.query(`
      SELECT 
        id, 
        first_name, 
        last_name, 
        email
      FROM users 
      WHERE is_active = true 
        AND email_verified = true
      ORDER BY id
    `);
    
    console.log('\nAktif ve doğrulanmış kullanıcı sayısı:', activeResult.rows.length);
    console.log('Aktif kullanıcılar:');
    activeResult.rows.forEach(user => {
      console.log(`- ID: ${user.id}, İsim: ${user.first_name} ${user.last_name}, Email: ${user.email}`);
    });
    
  } catch (error) {
    console.error('Hata:', error);
  } finally {
    await pool.end();
  }
}

testUsers();
