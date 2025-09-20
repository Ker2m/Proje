const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  getNotificationStats
} = require('../controllers/notificationController');

// Tüm route'lar authentication gerektirir
router.use(authenticateToken);

// Bildirimleri getir
router.get('/', getNotifications);

// Bildirim istatistiklerini getir
router.get('/stats', getNotificationStats);

// Bildirimi okundu olarak işaretle
router.patch('/:notificationId/read', markAsRead);

// Tüm bildirimleri okundu olarak işaretle
router.patch('/mark-all-read', markAllAsRead);

// Bildirimi sil
router.delete('/:notificationId', deleteNotification);

// Okunmuş bildirimleri sil
router.delete('/cleanup/read', deleteReadNotifications);

module.exports = router;
