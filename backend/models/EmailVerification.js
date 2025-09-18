const { pool } = require('../config/database');

class EmailVerification {
  // Doğrulama kodu oluştur
  static async create(verificationData) {
    const { user_id, email, verification_code, code_type, expires_at } = verificationData;
    
    const query = `
      INSERT INTO email_verifications (user_id, email, verification_code, code_type, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, email, verification_code, code_type, expires_at, created_at
    `;
    
    const values = [user_id, email, verification_code, code_type, expires_at];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Aktif doğrulama kodunu bul
  static async findActiveCode(email, code, code_type = 'registration') {
    const query = `
      SELECT * FROM email_verifications 
      WHERE email = $1 AND verification_code = $2 AND code_type = $3 
      AND is_used = false AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    try {
      const result = await pool.query(query, [email, code, code_type]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Kullanıcının aktif doğrulama kodunu bul
  static async findUserActiveCode(user_id, code_type = 'registration') {
    const query = `
      SELECT * FROM email_verifications 
      WHERE user_id = $1 AND code_type = $2 
      AND is_used = false AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    try {
      const result = await pool.query(query, [user_id, code_type]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Doğrulama kodunu kullanılmış olarak işaretle
  static async markAsUsed(id) {
    const query = `
      UPDATE email_verifications 
      SET is_used = true
      WHERE id = $1
      RETURNING id, email, code_type
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Kullanıcının tüm doğrulama kodlarını temizle
  static async clearUserCodes(user_id, code_type = 'registration') {
    const query = `
      UPDATE email_verifications 
      SET is_used = true
      WHERE user_id = $1 AND code_type = $2 AND is_used = false
    `;
    
    try {
      await pool.query(query, [user_id, code_type]);
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Süresi dolmuş kodları temizle
  static async cleanupExpiredCodes() {
    const query = `
      DELETE FROM email_verifications 
      WHERE expires_at < NOW() AND is_used = false
    `;
    
    try {
      const result = await pool.query(query);
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }

  // 6 haneli rastgele kod oluştur
  static generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Kod süresini hesapla (10 dakika)
  static getExpirationTime() {
    const now = new Date();
    return new Date(now.getTime() + 10 * 60 * 1000); // 10 dakika sonra
  }
}

module.exports = EmailVerification;
