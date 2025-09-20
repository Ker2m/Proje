const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
  }

  // SMTP yapılandırması
  configure(config) {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure || false, // true for 465, false for other ports
        auth: {
          user: config.user,
          pass: config.pass
        },
        tls: {
          rejectUnauthorized: false // Self-signed certificate için
        }
      });

      this.isConfigured = true;
      console.log('✅ Email servisi yapılandırıldı');
    } catch (error) {
      console.error('❌ Email servisi yapılandırılamadı:', error.message);
      this.isConfigured = false;
    }
  }

  // Email gönderme
  async sendEmail(to, subject, html, text) {
    if (!this.isConfigured) {
      throw new Error('Email servisi yapılandırılmamış');
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@caddateapp.com',
        to: to,
        subject: subject,
        html: html,
        text: text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email gönderildi:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Email gönderme hatası:', error.message);
      throw error;
    }
  }

  // Doğrulama kodu emaili gönder
  async sendVerificationCode(email, code, userName) {
    const subject = 'CaddateApp - Email Doğrulama Kodu';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Doğrulama</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF6B6B, #4ECDC4); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { background: #FF6B6B; color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 CaddateApp'e Hoş Geldiniz!</h1>
          </div>
          <div class="content">
            <h2>Merhaba ${userName},</h2>
            <p>Hesabınızı doğrulamak için aşağıdaki kodu kullanın:</p>
            <div class="code">${code}</div>
            <p><strong>Bu kod 10 dakika geçerlidir.</strong></p>
            <p>Eğer bu işlemi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
            <p>İyi eğlenceler! 💕</p>
          </div>
          <div class="footer">
            <p>CaddateApp - Aşkı Bul, Hayatı Paylaş</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      CaddateApp - Email Doğrulama Kodu
      
      Merhaba ${userName},
      
      Hesabınızı doğrulamak için aşağıdaki kodu kullanın:
      
      ${code}
      
      Bu kod 10 dakika geçerlidir.
      
      Eğer bu işlemi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.
      
      İyi eğlenceler!
      
      CaddateApp - Aşkı Bul, Hayatı Paylaş
    `;

    return await this.sendEmail(email, subject, html, text);
  }

  // Şifre sıfırlama emaili gönder
  async sendPasswordResetCode(email, code, userName) {
    const subject = 'CaddateApp - Şifre Sıfırlama Kodu';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Şifre Sıfırlama</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF6B6B, #4ECDC4); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { background: #FF6B6B; color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Şifre Sıfırlama</h1>
          </div>
          <div class="content">
            <h2>Merhaba ${userName},</h2>
            <p>Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:</p>
            <div class="code">${code}</div>
            <p><strong>Bu kod 10 dakika geçerlidir.</strong></p>
            <p>Eğer bu işlemi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
          </div>
          <div class="footer">
            <p>CaddateApp - Aşkı Bul, Hayatı Paylaş</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      CaddateApp - Şifre Sıfırlama Kodu
      
      Merhaba ${userName},
      
      Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:
      
      ${code}
      
      Bu kod 10 dakika geçerlidir.
      
      Eğer bu işlemi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.
      
      CaddateApp - Aşkı Bul, Hayatı Paylaş
    `;

    return await this.sendEmail(email, subject, html, text);
  }

  // Test emaili gönder
  async sendTestEmail(to) {
    const subject = 'CaddateApp - Test Emaili';
    const html = '<h1>Test Emaili</h1><p>Email servisi çalışıyor!</p>';
    const text = 'Test Emaili - Email servisi çalışıyor!';
    
    return await this.sendEmail(to, subject, html, text);
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;
