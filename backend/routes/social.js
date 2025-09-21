const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  recordProfileVisit,
  getProfileVisitStats,
  getRecentVisitors,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStats,
  getFriendsList
} = require('../controllers/socialController');

// Tüm route'lar authentication gerektirir
router.use(authenticateToken);

// Profil ziyaret işlemleri
router.post('/visit/:profileId', recordProfileVisit);
router.get('/visit-stats', getProfileVisitStats);
router.get('/recent-visitors', getRecentVisitors);

// Takip işlemleri
router.post('/follow/:userId', followUser);
router.delete('/follow/:userId', unfollowUser);
router.get('/followers', getFollowers);
router.get('/following', getFollowing);
router.get('/follow-stats', getFollowStats);

// Arkadaş listesi
router.get('/friends', getFriendsList);

module.exports = router;
