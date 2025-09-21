const { Pool } = require('pg');
const { testConnection } = require('../config/database');
const { createNotification } = require('./notificationController');

// Veritabanı bağlantısı
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Arkadaş listesini getir
const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture,
        u.birth_date,
        u.is_active,
        f.status,
        f.created_at as friendship_created_at,
        f.updated_at as friendship_updated_at
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.user_id = $1 THEN u.id = f.friend_id
          WHEN f.friend_id = $1 THEN u.id = f.user_id
        END
      )
      WHERE (f.user_id = $1 OR f.friend_id = $1)
        AND f.status = 'accepted'
        AND u.is_active = true
      ORDER BY f.updated_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    
    const friends = result.rows.map(friend => {
      // Yaş hesaplama
      let age = null;
      if (friend.birth_date) {
        const today = new Date();
        const birthDate = new Date(friend.birth_date);
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      return {
        id: friend.id,
        firstName: friend.first_name,
        lastName: friend.last_name,
        email: friend.email,
        profilePicture: friend.profile_picture,
        age: age,
        isActive: friend.is_active,
        status: friend.status,
        friendshipCreatedAt: friend.friendship_created_at,
        friendshipUpdatedAt: friend.friendship_updated_at
      };
    });
    
    res.json({
      success: true,
      data: {
        friends,
        totalCount: friends.length
      }
    });
    
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaş listesi alınırken hata oluştu'
    });
  }
};

// Arkadaş isteklerini getir (gelen ve giden)
const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Gelen arkadaşlık istekleri
    const incomingQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture,
        f.created_at as request_created_at
      FROM friendships f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = $1 
        AND f.status = 'pending'
        AND u.is_active = true
      ORDER BY f.created_at DESC
    `;
    
    // Giden arkadaşlık istekleri
    const outgoingQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture,
        f.created_at as request_created_at
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1 
        AND f.status = 'pending'
        AND u.is_active = true
      ORDER BY f.created_at DESC
    `;
    
    const [incomingResult, outgoingResult] = await Promise.all([
      pool.query(incomingQuery, [userId]),
      pool.query(outgoingQuery, [userId])
    ]);
    
    const incomingRequests = incomingResult.rows.map(request => ({
      id: request.id,
      firstName: request.first_name,
      lastName: request.last_name,
      email: request.email,
      profilePicture: request.profile_picture,
      requestCreatedAt: request.request_created_at
    }));
    
    const outgoingRequests = outgoingResult.rows.map(request => ({
      id: request.id,
      firstName: request.first_name,
      lastName: request.last_name,
      email: request.email,
      profilePicture: request.profile_picture,
      requestCreatedAt: request.request_created_at
    }));
    
    res.json({
      success: true,
      data: {
        incomingRequests,
        outgoingRequests,
        incomingCount: incomingRequests.length,
        outgoingCount: outgoingRequests.length
      }
    });
    
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaşlık istekleri alınırken hata oluştu'
    });
  }
};

// Arkadaş ekle
const addFriend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;
    
    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Arkadaş ID gerekli'
      });
    }
    
    if (userId === friendId) {
      return res.status(400).json({
        success: false,
        message: 'Kendinizi arkadaş olarak ekleyemezsiniz'
      });
    }
    
    // Hedef kullanıcının var olup olmadığını kontrol et
    const userCheckQuery = 'SELECT id, is_active FROM users WHERE id = $1';
    const userCheckResult = await pool.query(userCheckQuery, [friendId]);
    
    if (userCheckResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }
    
    if (!userCheckResult.rows[0].is_active) {
      return res.status(400).json({
        success: false,
        message: 'Bu kullanıcı aktif değil'
      });
    }
    
    // Mevcut arkadaşlık durumunu kontrol et
    const existingFriendshipQuery = `
      SELECT id, status FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) 
         OR (user_id = $2 AND friend_id = $1)
    `;
    const existingResult = await pool.query(existingFriendshipQuery, [userId, friendId]);
    
    if (existingResult.rows.length > 0) {
      const existingFriendship = existingResult.rows[0];
      
      if (existingFriendship.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Bu kullanıcı zaten arkadaşınız'
        });
      } else if (existingFriendship.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Bu kullanıcıya zaten arkadaşlık isteği gönderilmiş'
        });
      } else if (existingFriendship.status === 'blocked') {
        return res.status(400).json({
          success: false,
          message: 'Bu kullanıcı engellenmiş'
        });
      }
    }
    
    // Arkadaşlık isteği oluştur
    const insertQuery = `
      INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
      VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `;
    
    const result = await pool.query(insertQuery, [userId, friendId]);
    
    // Kullanıcı bilgilerini al (bildirim için)
    const userQuery = 'SELECT first_name, last_name FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0];
    
    // Bildirim oluştur
    await createNotification(
      friendId,
      'friend_request',
      'Yeni Arkadaşlık İsteği',
      `${user.first_name} ${user.last_name} size arkadaşlık isteği gönderdi`,
      { 
        friendshipId: result.rows[0].id,
        senderId: userId,
        senderName: `${user.first_name} ${user.last_name}`
      },
      userId
    );
    
    res.json({
      success: true,
      message: 'Arkadaşlık isteği gönderildi',
      data: {
        friendshipId: result.rows[0].id,
        createdAt: result.rows[0].created_at
      }
    });
    
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaş eklenirken hata oluştu'
    });
  }
};

// Arkadaşlık isteğini kabul et
const acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;
    
    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Arkadaş ID gerekli'
      });
    }
    
    // Arkadaşlık isteğini bul ve güncelle
    const updateQuery = `
      UPDATE friendships 
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
      RETURNING id, updated_at
    `;
    
    const result = await pool.query(updateQuery, [friendId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Arkadaşlık isteği bulunamadı'
      });
    }
    
    // Kullanıcı bilgilerini al (bildirim için)
    const userQuery = 'SELECT first_name, last_name FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);
    const user = userResult.rows[0];
    
    // Bildirim oluştur
    await createNotification(
      friendId,
      'friend_accepted',
      'Arkadaşlık İsteği Kabul Edildi',
      `${user.first_name} ${user.last_name} arkadaşlık isteğinizi kabul etti`,
      { 
        friendshipId: result.rows[0].id,
        acceptorId: userId,
        acceptorName: `${user.first_name} ${user.last_name}`
      },
      userId
    );
    
    res.json({
      success: true,
      message: 'Arkadaşlık isteği kabul edildi',
      data: {
        friendshipId: result.rows[0].id,
        acceptedAt: result.rows[0].updated_at
      }
    });
    
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaşlık isteği kabul edilirken hata oluştu'
    });
  }
};

// Arkadaşlık isteğini reddet
const declineFriendRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;
    
    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Arkadaş ID gerekli'
      });
    }
    
    // Arkadaşlık isteğini reddet
    const updateQuery = `
      UPDATE friendships 
      SET status = 'declined', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
      RETURNING id, updated_at
    `;
    
    const result = await pool.query(updateQuery, [friendId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Arkadaşlık isteği bulunamadı'
      });
    }
    
    res.json({
      success: true,
      message: 'Arkadaşlık isteği reddedildi',
      data: {
        friendshipId: result.rows[0].id,
        declinedAt: result.rows[0].updated_at
      }
    });
    
  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaşlık isteği reddedilirken hata oluştu'
    });
  }
};

// Arkadaşlığı kaldır
const removeFriend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    
    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Arkadaş ID gerekli'
      });
    }
    
    // Arkadaşlığı sil
    const deleteQuery = `
      DELETE FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) 
         OR (user_id = $2 AND friend_id = $1)
      RETURNING id
    `;
    
    const result = await pool.query(deleteQuery, [userId, friendId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Arkadaşlık bulunamadı'
      });
    }
    
    res.json({
      success: true,
      message: 'Arkadaşlık kaldırıldı',
      data: {
        removedFriendshipId: result.rows[0].id
      }
    });
    
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaş kaldırılırken hata oluştu'
    });
  }
};

// Kullanıcıyı engelle
const blockUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;
    
    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı ID gerekli'
      });
    }
    
    if (userId === friendId) {
      return res.status(400).json({
        success: false,
        message: 'Kendinizi engelleyemezsiniz'
      });
    }
    
    // Mevcut arkadaşlık durumunu kontrol et ve engelle
    const upsertQuery = `
      INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
      VALUES ($1, $2, 'blocked', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, friend_id) 
      DO UPDATE SET 
        status = 'blocked',
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, updated_at
    `;
    
    const result = await pool.query(upsertQuery, [userId, friendId]);
    
    res.json({
      success: true,
      message: 'Kullanıcı engellendi',
      data: {
        blockId: result.rows[0].id,
        blockedAt: result.rows[0].updated_at
      }
    });
    
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı engellenirken hata oluştu'
    });
  }
};

// Kullanıcının engelini kaldır
const unblockUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    
    if (!friendId) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı ID gerekli'
      });
    }
    
    // Engeli kaldır
    const deleteQuery = `
      DELETE FROM friendships 
      WHERE user_id = $1 AND friend_id = $2 AND status = 'blocked'
      RETURNING id
    `;
    
    const result = await pool.query(deleteQuery, [userId, friendId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Engellenen kullanıcı bulunamadı'
      });
    }
    
    res.json({
      success: true,
      message: 'Kullanıcının engeli kaldırıldı',
      data: {
        unblockedId: result.rows[0].id
      }
    });
    
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Engel kaldırılırken hata oluştu'
    });
  }
};

// Arkadaş istatistiklerini getir
const getFriendsStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as total_friends,
        COUNT(CASE WHEN status = 'pending' AND friend_id = $1 THEN 1 END) as incoming_requests,
        COUNT(CASE WHEN status = 'pending' AND user_id = $1 THEN 1 END) as outgoing_requests,
        COUNT(CASE WHEN status = 'blocked' AND user_id = $1 THEN 1 END) as blocked_users
      FROM friendships 
      WHERE user_id = $1 OR friend_id = $1
    `;
    
    const result = await pool.query(statsQuery, [userId]);
    const stats = result.rows[0];
    
    res.json({
      success: true,
      data: {
        totalFriends: parseInt(stats.total_friends) || 0,
        incomingRequests: parseInt(stats.incoming_requests) || 0,
        outgoingRequests: parseInt(stats.outgoing_requests) || 0,
        blockedUsers: parseInt(stats.blocked_users) || 0
      }
    });
    
  } catch (error) {
    console.error('Get friends stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaş istatistikleri alınırken hata oluştu'
    });
  }
};

module.exports = {
  getFriends,
  getFriendRequests,
  addFriend,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getFriendsStats
};
