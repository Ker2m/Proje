const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const { authenticateToken } = require('../middleware/auth');

// Kayıt sırasında 2FA doğrulama kodu gönder (authentication gerektirmez)
router.post('/send-registration-2fa', securityController.sendRegistration2FA);

// Kayıt sırasında 2FA doğrulama kodunu doğrula (authentication gerektirmez)
router.post('/verify-registration-2fa', securityController.verifyRegistration2FA);

// Diğer tüm güvenlik route'ları authentication gerektirir
router.use(authenticateToken);

// Şifre değiştir
router.post('/change-password', securityController.changePassword);

// Email doğrulama kodu gönder
router.post('/send-email-verification', securityController.sendEmailVerification);

// Email doğrulama kodunu doğrula
router.post('/verify-email-code', securityController.verifyEmailCode);

// 2FA'yı etkinleştir/devre dışı bırak
router.post('/toggle-2fa', securityController.toggle2FA);

// Aktif oturumları getir
router.get('/active-sessions', securityController.getActiveSessions);

// Tüm oturumları sonlandır
router.post('/end-all-sessions', securityController.endAllSessions);

// Güvenlik geçmişini getir
router.get('/history', securityController.getSecurityHistory);

// Güvenlik ayarlarını güncelle
router.put('/settings', securityController.updateSecuritySettings);

module.exports = router;
