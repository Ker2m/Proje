const express = require('express');
const { 
  sendVerificationCode, 
  verifyCode, 
  sendTestEmail, 
  getEmailServiceStatus 
} = require('../controllers/emailVerificationController');

const router = express.Router();

// POST /api/email/send-code - Doğrulama kodu gönder
router.post('/send-code', sendVerificationCode);

// POST /api/email/verify-code - Doğrulama kodunu doğrula
router.post('/verify-code', verifyCode);

// POST /api/email/test - Test emaili gönder
router.post('/test', sendTestEmail);

// GET /api/email/status - Email servis durumu
router.get('/status', getEmailServiceStatus);

module.exports = router;
