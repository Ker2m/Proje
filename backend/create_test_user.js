const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function createTestUser() {
  try {
    const email = 'test@example.com';
    const password = '123456';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Test kullanıcısını oluştur/güncelle
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, email_verified, 
                         location_latitude, location_longitude, location_accuracy, 
                         location_is_sharing, location_last_updated) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       ON CONFLICT (email) DO UPDATE SET 
         password = $2, email_verified = $5,
         location_latitude = $6, location_longitude = $7, 
         location_accuracy = $8, location_is_sharing = $9, 
         location_last_updated = $10`,
      [
        email, hashedPassword, 'Test', 'User', true,
        41.0082, 28.9784, 10, true, new Date() // İstanbul koordinatları
      ]
    );

    // İkinci test kullanıcısı ekle
    const email2 = 'test2@example.com';
    const result2 = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, email_verified, 
                         location_latitude, location_longitude, location_accuracy, 
                         location_is_sharing, location_last_updated) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       ON CONFLICT (email) DO UPDATE SET 
         password = $2, email_verified = $5,
         location_latitude = $6, location_longitude = $7, 
         location_accuracy = $8, location_is_sharing = $9, 
         location_last_updated = $10`,
      [
        email2, hashedPassword, 'Test2', 'User2', true,
        41.0092, 28.9794, 15, true, new Date() // Yakın koordinatlar
      ]
    );
    
    console.log('Test user created/updated');
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

createTestUser();
