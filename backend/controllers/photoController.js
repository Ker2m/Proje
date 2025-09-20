const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer konfigürasyonu - fotoğraflar için
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `photo-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir'), false);
    }
  }
});

// Fotoğraf yükle
const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Dosya yüklenmedi'
      });
    }

    const userId = req.user.id;
    const { caption = '', location } = req.body;
    const photoPath = `/uploads/photos/${req.file.filename}`;
    
    // Dinamik URL oluştur
    const protocol = req.protocol;
    const host = req.get('host');
    const fullPhotoUrl = `${protocol}://${host}${photoPath}`;

    // Fotoğrafı veritabanına kaydet
    const result = await pool.query(
      'INSERT INTO photos (user_id, photo_url, photo_type, is_primary, caption) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, photoPath, 'gallery', false, caption]
    );

    const photo = result.rows[0];

    res.json({
      success: true,
      message: 'Fotoğraf başarıyla yüklendi',
      data: { 
        photo: {
          id: photo.id,
          photo_url: fullPhotoUrl,
          user_id: photo.user_id,
          created_at: photo.created_at
        }
      }
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Fotoğrafları listele (feed)
const getPhotos = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    const query = `
      SELECT 
        p.id,
        p.photo_url,
        p.caption,
        p.created_at,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.profile_picture,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count
      FROM photos p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN photo_likes l ON p.id = l.photo_id
      LEFT JOIN photo_comments c ON p.id = c.photo_id
      WHERE p.photo_type = 'gallery'
      GROUP BY p.id, u.id, u.first_name, u.last_name, u.profile_picture, p.caption
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [parseInt(limit), parseInt(offset)]);
    
    // Fotoğraf URL'lerini tam URL olarak oluştur
    const photos = result.rows.map(photo => {
      const protocol = req.protocol;
      const host = req.get('host');
      
      return {
        id: photo.id,
        uri: `${protocol}://${host}${photo.photo_url}`,
        caption: photo.caption || '',
        user: `${photo.first_name} ${photo.last_name}`,
        user_id: photo.user_id,
        time: getTimeAgo(photo.created_at),
        likes: parseInt(photo.likes_count),
        comments: parseInt(photo.comments_count),
        location: 'Bağdat Caddesi', // Bu daha sonra location tablosundan gelecek
        profile_picture: photo.profile_picture ? `${protocol}://${host}${photo.profile_picture}` : null
      };
    });

    res.json({
      success: true,
      data: { photos },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: photos.length
      }
    });

  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Kullanıcının kendi fotoğraflarını getir
const getMyPhotos = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const query = `
      SELECT 
        p.id,
        p.photo_url,
        p.caption,
        p.created_at,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count
      FROM photos p
      LEFT JOIN photo_likes l ON p.id = l.photo_id
      LEFT JOIN photo_comments c ON p.id = c.photo_id
      WHERE p.user_id = $1 AND p.photo_type = 'gallery'
      GROUP BY p.id, p.caption
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [userId, parseInt(limit), parseInt(offset)]);
    
    const photos = result.rows.map(photo => {
      const protocol = req.protocol;
      const host = req.get('host');
      
      return {
        id: photo.id,
        uri: `${protocol}://${host}${photo.photo_url}`,
        caption: photo.caption || '',
        user: 'Sen',
        user_id: userId,
        time: getTimeAgo(photo.created_at),
        likes: parseInt(photo.likes_count),
        comments: parseInt(photo.comments_count),
        location: 'Bağdat Caddesi'
      };
    });

    res.json({
      success: true,
      data: { photos },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: photos.length
      }
    });

  } catch (error) {
    console.error('Get my photos error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Fotoğrafı güncelle
const updatePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const { caption } = req.body;
    const userId = req.user.id;

    // Fotoğrafın kullanıcıya ait olup olmadığını kontrol et
    const photoCheck = await pool.query(
      'SELECT * FROM photos WHERE id = $1 AND user_id = $2',
      [photoId, userId]
    );

    if (photoCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fotoğraf bulunamadı veya düzenleme yetkiniz yok'
      });
    }

    // Fotoğrafı güncelle
    const result = await pool.query(
      'UPDATE photos SET caption = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [caption, photoId]
    );

    res.json({
      success: true,
      message: 'Fotoğraf başarıyla güncellendi',
      data: { photo: result.rows[0] }
    });

  } catch (error) {
    console.error('Update photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Fotoğrafı sil
const deletePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;

    // Fotoğrafın kullanıcıya ait olup olmadığını kontrol et
    const photoCheck = await pool.query(
      'SELECT * FROM photos WHERE id = $1 AND user_id = $2',
      [photoId, userId]
    );

    if (photoCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fotoğraf bulunamadı veya silme yetkiniz yok'
      });
    }

    const photo = photoCheck.rows[0];

    // Dosyayı fiziksel olarak sil
    const filePath = path.join(__dirname, '..', photo.photo_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Veritabanından sil
    await pool.query('DELETE FROM photos WHERE id = $1', [photoId]);

    res.json({
      success: true,
      message: 'Fotoğraf başarıyla silindi'
    });

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Fotoğraf beğen/beğenme
const likePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;

    // Önce beğeni tablosunu oluştur (eğer yoksa)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS photo_likes (
        id SERIAL PRIMARY KEY,
        photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(photo_id, user_id)
      )
    `);

    // Zaten beğenilip beğenilmediğini kontrol et
    const existingLike = await pool.query(
      'SELECT id FROM photo_likes WHERE photo_id = $1 AND user_id = $2',
      [photoId, userId]
    );

    if (existingLike.rows.length > 0) {
      // Beğeniyi kaldır
      await pool.query(
        'DELETE FROM photo_likes WHERE photo_id = $1 AND user_id = $2',
        [photoId, userId]
      );
      
      res.json({
        success: true,
        message: 'Beğeni kaldırıldı',
        liked: false
      });
    } else {
      // Beğeni ekle
      await pool.query(
        'INSERT INTO photo_likes (photo_id, user_id) VALUES ($1, $2)',
        [photoId, userId]
      );
      
      res.json({
        success: true,
        message: 'Fotoğraf beğenildi',
        liked: true
      });
    }

  } catch (error) {
    console.error('Like photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Zaman hesaplama yardımcı fonksiyonu
const getTimeAgo = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Şimdi';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} dakika önce`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} saat önce`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} gün önce`;
  }
};

module.exports = {
  uploadPhoto,
  getPhotos,
  getMyPhotos,
  updatePhoto,
  deletePhoto,
  likePhoto,
  upload
};
