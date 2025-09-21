const User = require('../models/User');
const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  INTERESTS,
  PERSONALITY_TRAITS,
  LANGUAGES,
  RELATIONSHIP_STATUS,
  LOOKING_FOR,
  LIFESTYLE_PREFERENCES,
  OCCUPATIONS,
  EDUCATION_LEVELS
} = require('../constants/profileOptions');

// Multer konfigürasyonu
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir'), false);
    }
  }
});

// Kullanıcı profili getir
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Profil fotoğrafı URL'ini tam URL olarak oluştur
    if (user.profile_picture) {
      const protocol = req.protocol;
      const host = req.get('host');
      user.profile_picture = `${protocol}://${host}${user.profile_picture}`;
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Kullanıcı profili güncelle
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Güncellenebilir alanları filtrele
    const allowedFields = ['first_name', 'last_name', 'birth_date', 'gender'];
    const filteredData = {};

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Güncellenecek alan bulunamadı'
      });
    }

    const updatedUser = await User.update(userId, filteredData);

    res.json({
      success: true,
      message: 'Profil başarıyla güncellendi',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      updateData: req.body
    });
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Kullanıcı hesabını sil
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const deletedUser = await User.delete(userId);

    res.json({
      success: true,
      message: 'Hesap başarıyla silindi',
      data: { user: deletedUser }
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Diğer kullanıcıları listele (keşfet)
const discoverUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    // Kendi hesabını hariç tut
    const users = await User.findAll(parseInt(limit), parseInt(offset));
    const filteredUsers = users.filter(user => user.id !== userId);

    res.json({
      success: true,
      data: { 
        users: filteredUsers,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: filteredUsers.length
        }
      }
    });

  } catch (error) {
    console.error('Discover users error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Belirli bir kullanıcının profilini getir
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Kullanıcı ayarlarını getir
const getSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Varsayılan ayarlar
    const defaultSettings = {
      notifications: true,
      locationSharing: false,
      darkMode: false,
      privacy: {
        profileVisibility: 'public',
        showOnlineStatus: true,
        allowMessages: true,
        showLocation: false
      }
    };

    // Kullanıcının ayarlarını al (varsayılan değerlerle birleştir)
    const userSettings = user.settings || {};
    const settings = {
      ...defaultSettings,
      ...userSettings
    };

    res.json({
      success: true,
      data: { settings }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Kullanıcı ayarlarını güncelle
const updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Güncellenebilir ayar alanları
    const allowedFields = ['notifications', 'locationSharing', 'darkMode', 'privacy'];
    const filteredData = {};

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Güncellenecek ayar bulunamadı'
      });
    }

    const updatedUser = await User.updateSettings(userId, filteredData);

    res.json({
      success: true,
      message: 'Ayarlar başarıyla güncellendi',
      data: { settings: updatedUser.settings }
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Profil fotoğrafı yükle
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Dosya yüklenmedi'
      });
    }

    const userId = req.user.id;
    const profilePicturePath = `/uploads/profiles/${req.file.filename}`;
    
    // Dinamik URL oluştur
    const protocol = req.protocol;
    const host = req.get('host');
    const fullImageUrl = `${protocol}://${host}${profilePicturePath}`;

    // Kullanıcının profil fotoğrafını güncelle
    const updatedUser = await User.update(userId, { profile_picture: profilePicturePath });

    res.json({
      success: true,
      message: 'Profil fotoğrafı başarıyla yüklendi',
      data: { 
        user: updatedUser,
        profile_picture: fullImageUrl
      }
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Gelişmiş kullanıcı arama ve filtreleme
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Arama sorgusu en az 2 karakter olmalıdır'
      });
    }

    console.log('Search request received:', { q, userId: req.user.id });

    // İsme göre arama yap
    const searchQuery = `
      SELECT 
        id, 
        first_name, 
        last_name, 
        email
      FROM users
      WHERE id != $1 
        AND is_active = true
        AND (LOWER(first_name) LIKE LOWER($2) OR LOWER(last_name) LIKE LOWER($2))
      LIMIT 10
    `;

    console.log('Search query:', searchQuery);
    console.log('Search params:', [req.user.id, `%${q}%`]);

    const result = await pool.query(searchQuery, [req.user.id, `%${q}%`]);

    console.log('Search result:', result.rows);

    const users = result.rows.map(user => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      profilePicture: null,
      gender: null,
      age: null,
      bio: null,
      interests: [],
      locationSharing: false,
      mutualFriendsCount: 0,
      createdAt: null
    }));

    console.log('Formatted users:', users);

    res.json({
      success: true,
      data: users,
      message: `${users.length} kullanıcı bulundu`
    });

  } catch (error) {
    console.error('Kullanıcı arama hatası:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı arama sırasında bir hata oluştu',
      error: error.message
    });
  }
};

// Arkadaş listesi getir
const getFriends = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture,
        f.created_at as friendship_created_at
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.user_id = $1 THEN f.friend_id = u.id
          ELSE f.user_id = u.id
        END
      )
      WHERE (f.user_id = $1 OR f.friend_id = $1)
      AND f.status = 'accepted'
      ORDER BY f.created_at DESC
    `;

    const result = await pool.query(query, [req.user.id]);

    const friends = result.rows.map(friend => ({
      id: friend.id,
      first_name: friend.first_name,
      last_name: friend.last_name,
      name: `${friend.first_name} ${friend.last_name}`,
      email: friend.email,
      profile_picture: friend.profile_picture,
      mutual_friends: 0 // Bu özellik daha sonra eklenebilir
    }));

    res.json({
      success: true,
      data: friends,
      message: `${friends.length} arkadaş bulundu`
    });

  } catch (error) {
    console.error('Arkadaş listesi getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaş listesi getirilirken bir hata oluştu'
    });
  }
};

// Arkadaş ekle
const addFriend = async (req, res) => {
  try {
    const { friend_id } = req.body;

    if (!friend_id) {
      return res.status(400).json({
        success: false,
        message: 'Arkadaş ID gerekli'
      });
    }

    if (friend_id == req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Kendinizi arkadaş olarak ekleyemezsiniz'
      });
    }

    // Kullanıcının var olup olmadığını kontrol et
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [friend_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Zaten arkadaş olup olmadığını kontrol et
    const friendshipCheck = await pool.query(
      'SELECT id, status FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [req.user.id, friend_id]
    );

    if (friendshipCheck.rows.length > 0) {
      const friendship = friendshipCheck.rows[0];
      if (friendship.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Bu kullanıcı zaten arkadaşınız'
        });
      } else if (friendship.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Bu kullanıcıya zaten arkadaşlık isteği gönderilmiş'
        });
      }
    }

    // Arkadaşlık isteği oluştur
    const result = await pool.query(
      'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, friend_id, 'pending']
    );

    res.json({
      success: true,
      message: 'Arkadaşlık isteği gönderildi',
      data: { friendship_id: result.rows[0].id }
    });

  } catch (error) {
    console.error('Arkadaş ekleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaş eklenirken bir hata oluştu'
    });
  }
};

// Arkadaş çıkar
const removeFriend = async (req, res) => {
  try {
    const { friend_id } = req.params;

    if (!friend_id) {
      return res.status(400).json({
        success: false,
        message: 'Arkadaş ID gerekli'
      });
    }

    // Arkadaşlığı sil
    const result = await pool.query(
      'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [req.user.id, friend_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Arkadaşlık bulunamadı'
      });
    }

    res.json({
      success: true,
      message: 'Arkadaş listeden çıkarıldı'
    });

  } catch (error) {
    console.error('Arkadaş çıkarma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Arkadaş çıkarılırken bir hata oluştu'
    });
  }
};

// Kullanıcı istatistiklerini getir
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Getting stats for user ID:', userId);

    // Önce tabloların varlığını kontrol et
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('friendships', 'messages', 'photos')
    `;
    const tableCheck = await pool.query(tableCheckQuery);
    console.log('Available tables:', tableCheck.rows.map(r => r.table_name));

    // Arkadaş sayısını al
    let friendCount = 0;
    try {
      const friendsQuery = `
        SELECT COUNT(*) as friend_count 
        FROM friendships 
        WHERE (user_id = $1 OR friend_id = $1) 
        AND status = 'accepted'
      `;
      console.log('Executing friends query...');
      const friendsResult = await pool.query(friendsQuery, [userId]);
      friendCount = parseInt(friendsResult.rows[0].friend_count);
      console.log('Friends count:', friendCount);
    } catch (err) {
      console.error('Friends query error:', err.message);
    }

    // Mesaj sayısını al (gönderilen + alınan)
    let messageCount = 0;
    try {
      const messagesQuery = `
        SELECT COUNT(*) as message_count 
        FROM messages 
        WHERE sender_id = $1 OR receiver_id = $1
      `;
      console.log('Executing messages query...');
      const messagesResult = await pool.query(messagesQuery, [userId]);
      messageCount = parseInt(messagesResult.rows[0].message_count);
      console.log('Messages count:', messageCount);
    } catch (err) {
      console.error('Messages query error:', err.message);
    }

    // Fotoğraf sayısını al
    let photoCount = 0;
    try {
      const photosQuery = `
        SELECT COUNT(*) as photo_count 
        FROM photos 
        WHERE user_id = $1
      `;
      console.log('Executing photos query...');
      const photosResult = await pool.query(photosQuery, [userId]);
      photoCount = parseInt(photosResult.rows[0].photo_count);
      console.log('Photos count:', photoCount);
    } catch (err) {
      console.error('Photos query error:', err.message);
    }

    res.json({
      success: true,
      data: {
        friends: friendCount,
        messages: messageCount,
        photos: photoCount
      }
    });

  } catch (error) {
    console.error('Kullanıcı istatistikleri getirme hatası:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: 'İstatistikler getirilirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Yakındaki kullanıcıları bul
const getNearbyUsers = async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000, limit = 50 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Enlem ve boylam koordinatları gerekli'
      });
    }

    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture,
        u.gender,
        u.birth_date,
        u.location_latitude,
        u.location_longitude,
        u.created_at,
        up.bio,
        up.interests,
        (SELECT COUNT(*) FROM friendships f WHERE 
          (f.user_id = $1 AND f.friend_id = u.id AND f.status = 'accepted') OR
          (f.user_id = u.id AND f.friend_id = $1 AND f.status = 'accepted')
        ) as mutual_friends_count,
        (
          6371 * acos(
            cos(radians($2)) * cos(radians(u.location_latitude)) * 
            cos(radians(u.location_longitude) - radians($3)) + 
            sin(radians($2)) * sin(radians(u.location_latitude))
          )
        ) as distance_km
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE 
        u.id != $1
        AND u.is_active = true
        AND u.email_verified = true
        AND u.location_is_sharing = true
        AND u.location_latitude IS NOT NULL
        AND u.location_longitude IS NOT NULL
        AND (
          6371 * acos(
            cos(radians($2)) * cos(radians(u.location_latitude)) * 
            cos(radians(u.location_longitude) - radians($3)) + 
            sin(radians($2)) * sin(radians(u.location_latitude))
          )
        ) <= $4
      ORDER BY distance_km ASC
      LIMIT $5
    `;

    const result = await pool.query(query, [
      req.user.id,
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius) / 1000, // metre cinsinden radius'u km'ye çevir
      parseInt(limit)
    ]);

    const users = result.rows.map(user => {
      // Yaş hesapla
      let age = null;
      if (user.birth_date) {
        const today = new Date();
        const birthDate = new Date(user.birth_date);
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        profilePicture: user.profile_picture,
        gender: user.gender,
        age: age,
        bio: user.bio,
        interests: user.interests || [],
        distance: Math.round(user.distance_km * 1000), // km'den metre'ye çevir
        mutualFriendsCount: parseInt(user.mutual_friends_count) || 0,
        createdAt: user.created_at
      };
    });

    res.json({
      success: true,
      data: {
        users,
        totalCount: users.length,
        center: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        },
        radius: parseInt(radius)
      },
      message: `${users.length} yakındaki kullanıcı bulundu`
    });

  } catch (error) {
    console.error('Yakındaki kullanıcıları bulma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Yakındaki kullanıcılar alınırken hata oluştu'
    });
  }
};

// Profil seçeneklerini getir
const getProfileOptions = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        interests: INTERESTS,
        personalityTraits: PERSONALITY_TRAITS,
        languages: LANGUAGES,
        relationshipStatus: RELATIONSHIP_STATUS,
        lookingFor: LOOKING_FOR,
        lifestylePreferences: LIFESTYLE_PREFERENCES,
        occupations: OCCUPATIONS,
        educationLevels: EDUCATION_LEVELS
      }
    });
  } catch (error) {
    console.error('Profil seçenekleri getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Profil seçenekleri alınırken hata oluştu'
    });
  }
};

// Gelişmiş profil güncelleme
const updateAdvancedProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      bio,
      occupation,
      education,
      height,
      relationshipStatus,
      lookingFor,
      interests,
      languages,
      hobbies,
      personalityTraits,
      lifestylePreferences,
      socialMedia,
      additionalInfo
    } = req.body;

    // Veritabanında user_profiles kaydı var mı kontrol et
    const checkQuery = 'SELECT id FROM user_profiles WHERE user_id = $1';
    const checkResult = await pool.query(checkQuery, [userId]);

    if (checkResult.rows.length === 0) {
      // Yeni profil kaydı oluştur
      const insertQuery = `
        INSERT INTO user_profiles (
          user_id, bio, occupation, education, height, relationship_status, 
          looking_for, interests, languages, hobbies, personality_traits,
          lifestyle_preferences, social_media, additional_info, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const insertParams = [
        userId,
        bio || null,
        occupation || null,
        education || null,
        height || null,
        relationshipStatus || null,
        lookingFor || null,
        interests || [],
        languages || [],
        hobbies || [],
        personalityTraits || [],
        JSON.stringify(lifestylePreferences || {}),
        JSON.stringify(socialMedia || {}),
        JSON.stringify(additionalInfo || {})
      ];
      
      const result = await pool.query(insertQuery, insertParams);
      
      res.json({
        success: true,
        message: 'Profil başarıyla oluşturuldu',
        data: result.rows[0]
      });
    } else {
      // Mevcut profil kaydını güncelle
      const updateQuery = `
        UPDATE user_profiles SET
          bio = COALESCE($2, bio),
          occupation = COALESCE($3, occupation),
          education = COALESCE($4, education),
          height = COALESCE($5, height),
          relationship_status = COALESCE($6, relationship_status),
          looking_for = COALESCE($7, looking_for),
          interests = COALESCE($8, interests),
          languages = COALESCE($9, languages),
          hobbies = COALESCE($10, hobbies),
          personality_traits = COALESCE($11, personality_traits),
          lifestyle_preferences = COALESCE($12, lifestyle_preferences),
          social_media = COALESCE($13, social_media),
          additional_info = COALESCE($14, additional_info),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;
      
      const updateParams = [
        userId,
        bio,
        occupation,
        education,
        height,
        relationshipStatus,
        lookingFor,
        interests,
        languages,
        hobbies,
        personalityTraits,
        JSON.stringify(lifestylePreferences || {}),
        JSON.stringify(socialMedia || {}),
        JSON.stringify(additionalInfo || {})
      ];
      
      const result = await pool.query(updateQuery, updateParams);
      
      res.json({
        success: true,
        message: 'Profil başarıyla güncellendi',
        data: result.rows[0]
      });
    }
  } catch (error) {
    console.error('Gelişmiş profil güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Profil güncellenirken hata oluştu'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  deleteAccount,
  discoverUsers,
  getUserById,
  getSettings,
  updateSettings,
  uploadProfilePicture,
  upload,
  searchUsers,
  getNearbyUsers,
  getProfileOptions,
  updateAdvancedProfile,
  getFriends,
  addFriend,
  removeFriend,
  getUserStats
};
