const db = require('../config/database');

async function addSecurityTables() {
  try {
    console.log('🔐 Güvenlik tabloları ekleniyor...');

    // Users tablosuna güvenlik alanları ekle
    console.log('📝 Users tablosuna güvenlik alanları ekleniyor...');
    
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP,
      ADD COLUMN IF NOT EXISTS login_notifications BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS suspicious_activity_alerts BOOLEAN DEFAULT true
    `);

    // Email verifications tablosunu güncelle
    console.log('📧 Email verifications tablosu güncelleniyor...');
    
    await db.query(`
      ALTER TABLE email_verifications 
      ALTER COLUMN code_type TYPE VARCHAR(20),
      DROP CONSTRAINT IF EXISTS email_verifications_code_type_check
    `);

    await db.query(`
      ALTER TABLE email_verifications 
      ADD CONSTRAINT email_verifications_code_type_check 
      CHECK (code_type IN ('registration', 'password_reset', 'email_change', 'email_verification', 'registration_2fa'))
    `);

    await db.query(`
      ALTER TABLE email_verifications 
      RENAME COLUMN is_used TO used
    `);

    // Security history tablosu oluştur
    console.log('🛡️ Security history tablosu oluşturuluyor...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS security_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexler oluştur
    console.log('📊 Indexler oluşturuluyor...');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_security_history_user ON security_history(user_id)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_security_history_created_at ON security_history(created_at)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_security_history_type ON security_history(activity_type)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON email_verifications(verification_code)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON email_verifications(expires_at)
    `);

    console.log('✅ Güvenlik tabloları başarıyla eklendi!');
    
    // Mevcut kullanıcılar için güvenlik geçmişi oluştur
    console.log('👥 Mevcut kullanıcılar için güvenlik geçmişi oluşturuluyor...');
    
    const usersResult = await db.query('SELECT id, email, created_at FROM users');
    
    for (const user of usersResult.rows) {
      await db.query(`
        INSERT INTO security_history (user_id, activity_type, description, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [user.id, 'account_created', 'Hesap oluşturuldu', user.created_at]);
    }

    console.log('✅ Migration tamamlandı!');
    
  } catch (error) {
    console.error('❌ Migration hatası:', error);
    throw error;
  }
}

// Script doğrudan çalıştırılıyorsa migration'ı başlat
if (require.main === module) {
  addSecurityTables()
    .then(() => {
      console.log('🎉 Migration başarıyla tamamlandı!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration başarısız:', error);
      process.exit(1);
    });
}

module.exports = addSecurityTables;
