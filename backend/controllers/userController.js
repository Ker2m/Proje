const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const allowedFields = ['first_name', 'last_name', 'birth_date', 'gender', 'phone'];
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

// Kullanıcı arama
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Arama sorgusu en az 2 karakter olmalıdır'
      });
    }

    const searchQuery = `
      SELECT 
        id, 
        first_name, 
        last_name, 
        email, 
        profile_picture,
        created_at
      FROM users 
      WHERE 
        (LOWER(first_name) LIKE LOWER($1) OR 
         LOWER(last_name) LIKE LOWER($1) OR 
         LOWER(email) LIKE LOWER($1) OR
         LOWER(CONCAT(first_name, ' ', last_name)) LIKE LOWER($1))
        AND id != $2
        AND is_verified = true
      ORDER BY 
        CASE 
          WHEN LOWER(first_name) LIKE LOWER($1) THEN 1
          WHEN LOWER(last_name) LIKE LOWER($1) THEN 2
          WHEN LOWER(CONCAT(first_name, ' ', last_name)) LIKE LOWER($1) THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT 20
    `;

    const searchTerm = `%${q.trim()}%`;
    const result = await db.query(searchQuery, [searchTerm, req.user.id]);

    const users = result.rows.map(user => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      profile_picture: user.profile_picture,
      mutual_friends: 0 // Bu özellik daha sonra eklenebilir
    }));

    res.json({
      success: true,
      data: users,
      message: `${users.length} kullanıcı bulundu`
    });

  } catch (error) {
    console.error('Kullanıcı arama hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı arama sırasında bir hata oluştu'
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

    const result = await db.query(query, [req.user.id]);

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
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [friend_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Zaten arkadaş olup olmadığını kontrol et
    const friendshipCheck = await db.query(
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
    const result = await db.query(
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
    const result = await db.query(
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
  getFriends,
  addFriend,
  removeFriend
};
