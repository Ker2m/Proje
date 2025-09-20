const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getFriends,
  getFriendRequests,
  addFriend,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getFriendsStats
} = require('../controllers/friendshipController');

// Tüm route'lar authentication gerektirir
router.use(authenticateToken);

// Arkadaş listesini getir
router.get('/', getFriends);

// Arkadaş istatistiklerini getir
router.get('/stats', getFriendsStats);

// Arkadaşlık isteklerini getir (gelen ve giden)
router.get('/requests', getFriendRequests);

// Arkadaş ekle (arkadaşlık isteği gönder)
router.post('/', addFriend);

// Arkadaşlık isteğini kabul et
router.post('/accept', acceptFriendRequest);

// Arkadaşlık isteğini reddet
router.post('/decline', declineFriendRequest);

// Kullanıcıyı engelle
router.post('/block', blockUser);

// Arkadaşlığı kaldır
router.delete('/:friendId', removeFriend);

// Kullanıcının engelini kaldır
router.delete('/unblock/:friendId', unblockUser);

module.exports = router;
