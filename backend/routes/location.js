const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const {
  updateUserLocation,
  getNearbyUsers,
  getLocationHistory,
  stopLocationSharing,
  setUserOffline,
  getLocationSettings,
  updateLocationSettings
} = require('../controllers/locationController');

// Konum güncelleme validasyonu
const locationValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Geçerli bir enlem değeri giriniz (-90 ile 90 arası)'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Geçerli bir boylam değeri giriniz (-180 ile 180 arası)'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Doğruluk değeri pozitif bir sayı olmalıdır'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Geçerli bir tarih formatı giriniz')
];

// Konum ayarları validasyonu
const locationSettingsValidation = [
  body('isSharing')
    .optional()
    .isBoolean()
    .withMessage('Konum paylaşımı değeri true veya false olmalıdır'),
  body('privacy')
    .optional()
    .isObject()
    .withMessage('Gizlilik ayarları bir obje olmalıdır')
];

// @route   POST /api/location
// @desc    Kullanıcının konumunu güncelle
// @access  Private
router.post('/', authenticateToken, locationValidation, updateUserLocation);

// @route   GET /api/location/nearby
// @desc    Yakındaki kullanıcıları getir
// @access  Private
router.get('/nearby', authenticateToken, getNearbyUsers);

// @route   GET /api/location/history
// @desc    Konum geçmişini getir
// @access  Private
router.get('/history', authenticateToken, getLocationHistory);

// @route   POST /api/location/stop
// @desc    Konum paylaşımını durdur
// @access  Private
router.post('/stop', authenticateToken, stopLocationSharing);

// @route   POST /api/location/offline
// @desc    Kullanıcıyı offline olarak işaretle
// @access  Public (socket.io için)
router.post('/offline', setUserOffline);

// @route   GET /api/location/settings
// @desc    Konum ayarlarını getir
// @access  Private
router.get('/settings', authenticateToken, getLocationSettings);

// @route   PUT /api/location/settings
// @desc    Konum ayarlarını güncelle
// @access  Private
router.put('/settings', authenticateToken, locationSettingsValidation, updateLocationSettings);

module.exports = router;
