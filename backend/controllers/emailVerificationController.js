const EmailVerification = require('../models/EmailVerification');
const User = require('../models/User');
const emailService = require('../services/emailService');

// Doğrulama kodu gönder
const sendVerificationCode = async (req, res) => {
  try {
    const { email, code_type = 'registration' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email adresi gerekli'
      });
    }

    // Email formatını kontrol et
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Geçerli bir email adresi giriniz'
      });
    }

    // Kullanıcıyı bul
    const user = await User.findByEmail(email);
    
    if (code_type === 'registration' && user) {
      return res.status(409).json({
        success: false,
        message: 'Bu email adresi zaten kayıtlı'
      });
    }

    if (code_type === 'password_reset' && !user) {
      return res.status(404).json({
        success: false,
        message: 'Bu email adresi ile kayıtlı kullanıcı bulunamadı'
      });
    }

    // Kullanıcının mevcut aktif kodlarını temizle
    if (user) {
      await EmailVerification.clearUserCodes(user.id, code_type);
    }

    // Yeni doğrulama kodu oluştur
    const verification_code = EmailVerification.generateVerificationCode();
    const expires_at = EmailVerification.getExpirationTime();

    // Kodu veritabanına kaydet
    const verificationData = {
      user_id: user ? user.id : null,
      email,
      verification_code,
      code_type,
      expires_at
    };

    await EmailVerification.create(verificationData);

    // Email gönder (şimdilik sadece log)
    if (emailService.isConfigured) {
      const userName = user ? `${user.first_name} ${user.last_name}` : 'Kullanıcı';
      await emailService.sendVerificationCode(email, verification_code, userName);
    } else {
      console.log(`📧 Doğrulama kodu (SMTP yapılandırılmamış): ${verification_code}`);
    }

    res.json({
      success: true,
      message: 'Doğrulama kodu gönderildi',
      data: {
        email,
        code_type,
        expires_in: 600 // 10 dakika
      }
    });

  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Doğrulama kodunu doğrula
const verifyCode = async (req, res) => {
  try {
    const { email, code, code_type = 'registration' } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email ve doğrulama kodu gerekli'
      });
    }

    // Doğrulama kodunu kontrol et
    const verification = await EmailVerification.findActiveCode(email, code, code_type);

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veya süresi dolmuş doğrulama kodu'
      });
    }

    // Kodu kullanılmış olarak işaretle
    await EmailVerification.markAsUsed(verification.id);

    // Email doğrulama işlemi ise email_verified'i true yap
    if (code_type === 'registration' || code_type === 'email_verification') {
      if (verification.user_id) {
        // Kullanıcı zaten oluşturulmuş, sadece email_verified'i güncelle
        await User.update(verification.user_id, { email_verified: true });
        console.log(`✅ Email doğrulandı (${code_type}) - Kullanıcı ID: ${verification.user_id}`);
      } else {
        // Kullanıcı henüz oluşturulmamış, email ile kullanıcıyı bul ve güncelle
        const user = await User.findByEmail(verification.email);
        if (user) {
          await User.update(user.id, { email_verified: true });
          console.log(`✅ Email doğrulandı (${code_type}) - Kullanıcı ID: ${user.id}`);
        } else {
          console.log(`⚠️ Email doğrulandı ama kullanıcı bulunamadı: ${verification.email}`);
        }
      }
    }

    res.json({
      success: true,
      message: 'Doğrulama kodu başarıyla doğrulandı',
      data: {
        email: verification.email,
        code_type: verification.code_type,
        verified_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Test email gönder
const sendTestEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email adresi gerekli'
      });
    }

    if (!emailService.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Email servisi yapılandırılmamış'
      });
    }

    await emailService.sendTestEmail(email);

    res.json({
      success: true,
      message: 'Test emaili gönderildi'
    });

  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Email gönderme hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Email servis durumunu kontrol et
const getEmailServiceStatus = async (req, res) => {
  res.json({
    success: true,
    data: {
      is_configured: emailService.isConfigured,
      message: emailService.isConfigured ? 'Email servisi aktif' : 'Email servisi yapılandırılmamış'
    }
  });
};

module.exports = {
  sendVerificationCode,
  verifyCode,
  sendTestEmail,
  getEmailServiceStatus
};
