const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const emailService = require('../services/emailService');
const { generateVerificationCode } = require('../utils/helpers');

class SecurityController {
  // Şifre değiştir
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;
      console.log('=== PASSWORD CHANGE REQUEST ===');
      console.log('User ID:', userId);
      console.log('Current password provided:', !!currentPassword);
      console.log('New password provided:', !!newPassword);
      console.log('Request body:', req.body);

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Mevcut şifre ve yeni şifre gereklidir'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Yeni şifre en az 6 karakter olmalıdır'
        });
      }

      // Kullanıcıyı veritabanından al
      const userResult = await pool.query(
        'SELECT password FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Kullanıcı bulunamadı'
        });
      }

      const user = userResult.rows[0];

      // Mevcut şifreyi doğrula
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Mevcut şifre hatalı'
        });
      }

      // Yeni şifreyi hashle
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Şifreyi güncelle
      console.log('Updating password for user:', userId);
      console.log('Hashed password length:', hashedNewPassword.length);
      
      const updateResult = await pool.query(
        `UPDATE users SET password = '${hashedNewPassword}', last_password_change = CURRENT_TIMESTAMP WHERE id = ${userId}`
      );
      
      console.log('Password update result:', updateResult.rowCount);

      // Güvenlik geçmişine kaydet
      try {
        await pool.query(
          'INSERT INTO security_history (user_id, activity_type, description, ip_address) VALUES ($1, $2, $3, $4)',
          [userId, 'password_change', 'Şifre değiştirildi', req.ip]
        );
        console.log('Security activity logged successfully');
      } catch (logError) {
        console.error('Failed to log security activity:', logError.message);
        // Log hatası şifre değiştirme işlemini durdurmasın
      }

      res.json({
        success: true,
        message: 'Şifre başarıyla değiştirildi'
      });

    } catch (error) {
      console.error('Password change error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        detail: error.detail
      });
      res.status(500).json({
        success: false,
        message: 'Şifre değiştirilirken bir hata oluştu',
        error: error.message,
        details: {
          name: error.name,
          code: error.code,
          detail: error.detail,
          stack: error.stack
        }
      });
    }
  }

  // Email doğrulama kodu gönder
  async sendEmailVerification(req, res) {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;

      // Kullanıcının email'i zaten doğrulanmış mı kontrol et
      const userResult = await pool.query(
        'SELECT email_verified FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Kullanıcı bulunamadı'
        });
      }

      if (userResult.rows[0].email_verified) {
        return res.status(400).json({
          success: false,
          message: 'Email adresi zaten doğrulanmış'
        });
      }

      // Doğrulama kodu oluştur
      const verificationCode = generateVerificationCode(6);

      // Kodu veritabanına kaydet
      await pool.query(
        'INSERT INTO email_verifications (user_id, email, verification_code, code_type, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'10 minutes\')',
        [userId, userEmail, verificationCode, 'email_verification']
      );

      // Email gönder
      const userName = `${req.user.first_name} ${req.user.last_name}`;
      await emailService.sendVerificationCode(userEmail, verificationCode, userName);

      res.json({
        success: true,
        message: 'Doğrulama kodu email adresinize gönderildi'
      });

    } catch (error) {
      console.error('Email verification send error:', error);
      res.status(500).json({
        success: false,
        message: 'Doğrulama kodu gönderilirken bir hata oluştu'
      });
    }
  }

  // Email doğrulama kodunu doğrula
  async verifyEmailCode(req, res) {
    try {
      const { code } = req.body;
      const userId = req.user.id;

      if (!code || code.length !== 6) {
        return res.status(400).json({
          success: false,
          message: 'Geçerli bir 6 haneli kod girin'
        });
      }

      // Kodu veritabanından kontrol et
      const codeResult = await pool.query(
        'SELECT * FROM email_verifications WHERE user_id = $1 AND verification_code = $2 AND code_type = $3 AND expires_at > NOW() AND used = false ORDER BY created_at DESC LIMIT 1',
        [userId, code, 'email_verification']
      );

      if (codeResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Geçersiz veya süresi dolmuş kod'
        });
      }

      // Kodu kullanılmış olarak işaretle
      await pool.query(
        'UPDATE email_verifications SET used = true WHERE id = $1',
        [codeResult.rows[0].id]
      );

      // Kullanıcının email'ini doğrulanmış olarak işaretle
      await pool.query(
        'UPDATE users SET email_verified = true WHERE id = $1',
        [userId]
      );

      // Güvenlik geçmişine kaydet
      try {
        await pool.query(
          'INSERT INTO security_history (user_id, activity_type, description, ip_address) VALUES ($1, $2, $3, $4)',
          [userId, 'email_verification', 'Email adresi doğrulandı', req.ip]
        );
      } catch (logError) {
        console.error('Failed to log security activity:', logError.message);
      }

      res.json({
        success: true,
        message: 'Email adresi başarıyla doğrulandı'
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Email doğrulama sırasında bir hata oluştu'
      });
    }
  }

  // Kayıt sırasında 2FA doğrulama kodu gönder
  async sendRegistration2FA(req, res) {
    try {
      const { email, firstName, lastName } = req.body;

      if (!email || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: 'Email, ad ve soyad gereklidir'
        });
      }

      // Kullanıcının kayıtlı olup olmadığını kontrol et
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Bu email adresi zaten kayıtlı'
        });
      }

      // 2FA doğrulama kodu oluştur
      const verificationCode = generateVerificationCode(6);

      // Kodu veritabanına kaydet (user_id olmadan)
      await pool.query(
        'INSERT INTO email_verifications (email, verification_code, code_type, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'10 minutes\')',
        [email, verificationCode, 'registration_2fa']
      );

      // Email gönder
      const userName = `${firstName} ${lastName}`;
      await emailService.sendVerificationCode(email, verificationCode, userName);

      res.json({
        success: true,
        message: '2FA doğrulama kodu email adresinize gönderildi'
      });

    } catch (error) {
      console.error('Registration 2FA send error:', error);
      res.status(500).json({
        success: false,
        message: '2FA doğrulama kodu gönderilirken bir hata oluştu'
      });
    }
  }

  // Kayıt sırasında 2FA doğrulama kodunu doğrula
  async verifyRegistration2FA(req, res) {
    try {
      const { email, code } = req.body;

      if (!email || !code || code.length !== 6) {
        return res.status(400).json({
          success: false,
          message: 'Email ve geçerli bir 6 haneli kod girin'
        });
      }

      // Kodu veritabanından kontrol et
      const codeResult = await pool.query(
        'SELECT * FROM email_verifications WHERE email = $1 AND verification_code = $2 AND code_type = $3 AND expires_at > NOW() AND used = false ORDER BY created_at DESC LIMIT 1',
        [email, code, 'registration_2fa']
      );

      if (codeResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Geçersiz veya süresi dolmuş kod'
        });
      }

      // Kodu kullanılmış olarak işaretle
      await pool.query(
        'UPDATE email_verifications SET used = true WHERE id = $1',
        [codeResult.rows[0].id]
      );

      res.json({
        success: true,
        message: '2FA doğrulama kodu doğrulandı'
      });

    } catch (error) {
      console.error('Registration 2FA verification error:', error);
      res.status(500).json({
        success: false,
        message: '2FA doğrulama kodu doğrulanırken bir hata oluştu'
      });
    }
  }

  // 2FA'yı etkinleştir/devre dışı bırak
  async toggle2FA(req, res) {
    try {
      const { enabled } = req.body;
      const userId = req.user.id;

      // 2FA durumunu güncelle
      await pool.query(
        'UPDATE users SET two_factor_enabled = $1 WHERE id = $2',
        [enabled, userId]
      );

      // Güvenlik geçmişine kaydet
      try {
        await pool.query(
          'INSERT INTO security_history (user_id, activity_type, description, ip_address) VALUES ($1, $2, $3, $4)',
          [userId, '2fa_toggle', `İki faktörlü kimlik doğrulama ${enabled ? 'etkinleştirildi' : 'devre dışı bırakıldı'}`, req.ip]
        );
      } catch (logError) {
        console.error('Failed to log security activity:', logError.message);
      }

      res.json({
        success: true,
        message: `İki faktörlü kimlik doğrulama ${enabled ? 'etkinleştirildi' : 'devre dışı bırakıldı'}`
      });

    } catch (error) {
      console.error('2FA toggle error:', error);
      res.status(500).json({
        success: false,
        message: '2FA ayarı değiştirilirken bir hata oluştu'
      });
    }
  }

  // Aktif oturumları getir
  async getActiveSessions(req, res) {
    try {
      const userId = req.user.id;

      // Aktif oturumları getir (basit implementasyon)
      const sessions = [
        {
          id: 1,
          device: 'iPhone 15 Pro',
          location: 'İstanbul, Türkiye',
          last_activity: 'Şu anda',
          is_current: true
        },
        {
          id: 2,
          device: 'MacBook Pro',
          location: 'Ankara, Türkiye',
          last_activity: '2 saat önce',
          is_current: false
        }
      ];

      res.json({
        success: true,
        data: { sessions }
      });

    } catch (error) {
      console.error('Get active sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Aktif oturumlar alınırken bir hata oluştu'
      });
    }
  }

  // Tüm oturumları sonlandır
  async endAllSessions(req, res) {
    try {
      const userId = req.user.id;

      // Burada gerçek implementasyon için session store kullanılmalı
      // Şimdilik sadece güvenlik geçmişine kaydediyoruz
      try {
        await pool.query(
          'INSERT INTO security_history (user_id, activity_type, description, ip_address) VALUES ($1, $2, $3, $4)',
          [userId, 'end_all_sessions', 'Tüm oturumlar sonlandırıldı', req.ip]
        );
      } catch (logError) {
        console.error('Failed to log security activity:', logError.message);
      }

      res.json({
        success: true,
        message: 'Tüm oturumlar sonlandırıldı'
      });

    } catch (error) {
      console.error('End all sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Oturumlar sonlandırılırken bir hata oluştu'
      });
    }
  }

  // Güvenlik geçmişini getir
  async getSecurityHistory(req, res) {
    try {
      const userId = req.user.id;

      // Güvenlik geçmişini getir
      const historyResult = await pool.query(
        'SELECT * FROM security_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
        [userId]
      );

      const history = historyResult.rows.map(row => ({
        id: row.id,
        type: row.activity_type,
        title: this.getActivityTitle(row.activity_type),
        description: row.description,
        timestamp: new Date(row.created_at).toLocaleString('tr-TR')
      }));

      res.json({
        success: true,
        data: { history }
      });

    } catch (error) {
      console.error('Get security history error:', error);
      res.status(500).json({
        success: false,
        message: 'Güvenlik geçmişi alınırken bir hata oluştu'
      });
    }
  }

  // Güvenlik ayarlarını güncelle
  async updateSecuritySettings(req, res) {
    try {
      const { loginNotifications, suspiciousActivityAlerts } = req.body;
      const userId = req.user.id;

      // Güvenlik ayarlarını güncelle
      await pool.query(
        'UPDATE users SET login_notifications = $1, suspicious_activity_alerts = $2 WHERE id = $3',
        [loginNotifications, suspiciousActivityAlerts, userId]
      );

      res.json({
        success: true,
        message: 'Güvenlik ayarları güncellendi'
      });

    } catch (error) {
      console.error('Update security settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Güvenlik ayarları güncellenirken bir hata oluştu'
      });
    }
  }


  // Aktivite başlığını getir
  getActivityTitle(activityType) {
    const titles = {
      'login': 'Giriş Yapıldı',
      'password_change': 'Şifre Değiştirildi',
      'email_verification': 'Email Doğrulandı',
      '2fa_toggle': '2FA Ayarı Değiştirildi',
      'end_all_sessions': 'Tüm Oturumlar Sonlandırıldı',
      'suspicious': 'Şüpheli Aktivite'
    };
    return titles[activityType] || 'Bilinmeyen Aktivite';
  }
}

module.exports = new SecurityController();
