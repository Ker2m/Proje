const { pool } = require('../config/database');

// Profil ziyaret kaydet
const recordProfileVisit = async (req, res) => {
  try {
    const { profileId } = req.params;
    const visitorId = req.user.id;

    // Kendi profilini ziyaret etmeyi engelle
    if (parseInt(profileId) === visitorId) {
      return res.json({
        success: true,
        message: 'Kendi profilinizi ziyaret ettiniz'
      });
    }

    // Bugün daha önce ziyaret edilmiş mi kontrol et
    const today = new Date().toISOString().split('T')[0];
    const existingVisit = await pool.query(
      `SELECT id FROM profile_visits 
       WHERE visitor_id = $1 AND profile_id = $2 AND DATE(created_at) = $3`,
      [visitorId, profileId, today]
    );

    if (existingVisit.rows.length === 0) {
      // Yeni ziyaret kaydet
      await pool.query(
        'INSERT INTO profile_visits (visitor_id, profile_id) VALUES ($1, $2)',
        [visitorId, profileId]
      );
    }

    res.json({
      success: true,
      message: 'Profil ziyareti kaydedildi'
    });
  } catch (error) {
    console.error('Profil ziyaret kaydetme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Profil ziyareti kaydedilemedi'
    });
  }
};

// Profil ziyaretçi sayısını getir
const getProfileVisitStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_visits,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_visits,
        COUNT(CASE WHEN DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_visits,
        COUNT(CASE WHEN DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_visits
      FROM profile_visits 
      WHERE profile_id = $1
    `, [userId]);

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        totalVisits: parseInt(stats.total_visits) || 0,
        todayVisits: parseInt(stats.today_visits) || 0,
        weekVisits: parseInt(stats.week_visits) || 0,
        monthVisits: parseInt(stats.month_visits) || 0
      }
    });
  } catch (error) {
    console.error('Profil ziyaret istatistikleri hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Ziyaret istatistikleri alınamadı'
    });
  }
};

// Son ziyaretçileri getir
const getRecentVisitors = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const result = await pool.query(`
      SELECT DISTINCT ON (pv.visitor_id)
        pv.visitor_id,
        u.first_name,
        u.last_name,
        u.profile_picture,
        pv.created_at as last_visit
      FROM profile_visits pv
      JOIN users u ON pv.visitor_id = u.id
      WHERE pv.profile_id = $1 AND pv.visitor_id != $1
      ORDER BY pv.visitor_id, pv.created_at DESC
      LIMIT $2
    `, [userId, parseInt(limit)]);

    const visitors = result.rows.map(visitor => ({
      id: visitor.visitor_id,
      name: `${visitor.first_name} ${visitor.last_name}`,
      profilePicture: visitor.profile_picture,
      lastVisit: visitor.last_visit
    }));

    res.json({
      success: true,
      data: visitors
    });
  } catch (error) {
    console.error('Son ziyaretçiler hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Ziyaretçiler alınamadı'
    });
  }
};

// Kullanıcıyı takip et
const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    // Kendi kendini takip etmeyi engelle
    if (parseInt(userId) === followerId) {
      return res.status(400).json({
        success: false,
        message: 'Kendinizi takip edemezsiniz'
      });
    }

    // Zaten takip ediliyor mu kontrol et
    const existingFollow = await pool.query(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, userId]
    );

    if (existingFollow.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Bu kullanıcıyı zaten takip ediyorsunuz'
      });
    }

    // Takip et
    await db.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [followerId, userId]
    );

    res.json({
      success: true,
      message: 'Kullanıcı takip edildi'
    });
  } catch (error) {
    console.error('Takip etme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Takip işlemi başarısız'
    });
  }
};

// Kullanıcıyı takipten çıkar
const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    const result = await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bu kullanıcıyı takip etmiyorsunuz'
      });
    }

    res.json({
      success: true,
      message: 'Takip edilenden çıkarıldı'
    });
  } catch (error) {
    console.error('Takibi bırakma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Takip işlemi başarısız'
    });
  }
};

// Takipçi listesini getir
const getFollowers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT 
        f.follower_id,
        u.first_name,
        u.last_name,
        u.profile_picture,
        u.is_active,
        f.created_at as followed_at
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);

    const followers = result.rows.map(follower => ({
      id: follower.follower_id,
      name: `${follower.first_name} ${follower.last_name}`,
      profilePicture: follower.profile_picture,
      isActive: follower.is_active,
      followedAt: follower.followed_at
    }));

    res.json({
      success: true,
      data: followers
    });
  } catch (error) {
    console.error('Takipçi listesi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Takipçi listesi alınamadı'
    });
  }
};

// Takip edilen listesini getir
const getFollowing = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT 
        f.following_id,
        u.first_name,
        u.last_name,
        u.profile_picture,
        u.is_active,
        f.created_at as followed_at
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);

    const following = result.rows.map(user => ({
      id: user.following_id,
      name: `${user.first_name} ${user.last_name}`,
      profilePicture: user.profile_picture,
      isActive: user.is_active,
      followedAt: user.followed_at
    }));

    res.json({
      success: true,
      data: following
    });
  } catch (error) {
    console.error('Takip edilen listesi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Takip edilen listesi alınamadı'
    });
  }
};

// Takip istatistiklerini getir
const getFollowStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following_count
    `, [userId]);

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        followersCount: parseInt(stats.followers_count) || 0,
        followingCount: parseInt(stats.following_count) || 0
      }
    });
  } catch (error) {
    console.error('Takip istatistikleri hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Takip istatistikleri alınamadı'
    });
  }
};

// Arkadaş listesini getir (friendships tablosundan)
const getFriendsList = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT 
        f.friend_id,
        u.first_name,
        u.last_name,
        u.profile_picture,
        u.is_active,
        f.created_at as friends_since
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = $1 AND f.status = 'accepted'
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);

    const friends = result.rows.map(friend => ({
      id: friend.friend_id,
      name: `${friend.first_name} ${friend.last_name}`,
      profilePicture: friend.profile_picture,
      isActive: friend.is_active,
      friendsSince: friend.friends_since
    }));

    res.json({
      success: true,
      data: friends
    });
  } catch (error) {
    console.error('Arkadaş listesi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaş listesi alınamadı'
    });
  }
};

module.exports = {
  recordProfileVisit,
  getProfileVisitStats,
  getRecentVisitors,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStats,
  getFriendsList
};
