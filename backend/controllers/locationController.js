const User = require('../models/User');
const { validationResult } = require('express-validator');

// Kullanıcının konumunu güncelle
const updateUserLocation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veri',
        errors: errors.array()
      });
    }

    const { latitude, longitude, accuracy, timestamp } = req.body;
    const userId = req.user.id;

    // Konum verilerini doğrula
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Enlem ve boylam bilgileri gerekli'
      });
    }

    // Koordinat aralıklarını kontrol et
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz enlem değeri (-90 ile 90 arası olmalı)'
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz boylam değeri (-180 ile 180 arası olmalı)'
      });
    }

    // Doğruluk değerini kontrol et
    if (accuracy !== undefined && (isNaN(accuracy) || accuracy < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Doğruluk değeri pozitif bir sayı olmalıdır'
      });
    }

    // Kullanıcının konumunu güncelle
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Konum verilerini güncelle
    const locationData = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : null,
      isSharing: true
    };

    // Rate limiting kaldırıldı - 2 saniyede bir güncelleme için uygun
    // const now = new Date();
    // const lastUpdate = user.location_last_updated;
    // if (lastUpdate && (now - new Date(lastUpdate)) < 500) {
    //   return res.status(429).json({
    //     success: false,
    //     message: 'Konum çok sık güncelleniyor. Lütfen bekleyin.'
    //   });
    // }

    await User.updateLocation(userId, locationData);

    res.json({
      success: true,
      message: 'Konum başarıyla güncellendi',
      data: {
        userId: user.id,
        location: locationData
      }
    });

  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({
      success: false,
      message: 'Konum güncellenirken bir hata oluştu'
    });
  }
};

// Yakındaki kullanıcıları getir
const getNearbyUsers = async (req, res) => {
  try {
    const { radius = 1000, limit = 50 } = req.query;
    const userId = req.user.id;

    // Parametreleri doğrula
    const searchRadius = Math.min(Math.max(parseFloat(radius) || 1000, 100), 10000); // 100m - 10km arası
    const searchLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100); // 1-100 arası

    // Kullanıcının konumunu al
    const user = await User.findById(userId);
    if (!user || !user.location_latitude || !user.location_longitude || !user.location_is_sharing) {
      return res.json({
        success: true,
        data: {
          users: [],
          message: 'Konum paylaşımı kapalı veya konum bulunamadı'
        }
      });
    }

    const userLat = user.location_latitude;
    const userLng = user.location_longitude;

    // Haversine formülü ile mesafe hesaplama
    const calculateDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371000; // Dünya'nın yarıçapı (metre)
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      // GPS hatası düzeltmesi: Eğer mesafe 50 metreden azsa, çok daha az göster
      if (distance < 50) {
        return Math.max(distance * 0.2, 1); // GPS hatasını büyük oranda düzelt, minimum 1m
      }
      
      return distance;
    };

    // Tüm kullanıcıları al (konum paylaşımı açık olanlar)
    // Zaman filtresi kaldırıldı - tüm aktif kullanıcıları al
    const allUsers = await User.findUsersWithLocationSharing();
    
    console.log(`📍 API: Found ${allUsers.length} users with location sharing enabled`);
    console.log(`📍 API: Current user (${req.user.email}) location: ${userLat}, ${userLng}`);

    // Yakındaki kullanıcıları filtrele
    const nearbyUsers = allUsers
      .filter(user => user.id !== userId)
      .map(user => {
        const distance = calculateDistance(
          userLat, userLng,
          user.location_latitude, user.location_longitude
        );
        // Online kullanıcı kontrolü (basit versiyon - API'de onlineUsers map'i yok)
        const now = new Date();
        const lastUpdate = new Date(user.location_last_updated);
        const isOnline = (now - lastUpdate) < 30 * 1000; // 30 saniye içinde güncellenmişse online
        
        return {
          userId: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          profilePicture: user.profile_picture,
          location: {
            latitude: user.location_latitude,
            longitude: user.location_longitude,
            accuracy: user.location_accuracy
          },
          lastSeen: user.location_last_updated,
          distance: Math.round(distance),
          isOnline: isOnline
        };
      })
      .filter(user => user.distance <= searchRadius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, searchLimit);

    res.json({
      success: true,
      data: {
        users: nearbyUsers,
        total: nearbyUsers.length,
        radius: searchRadius,
        limit: searchLimit
      }
    });

  } catch (error) {
    console.error('Nearby users error:', error);
    res.status(500).json({
      success: false,
      message: 'Yakındaki kullanıcılar alınırken bir hata oluştu'
    });
  }
};

// Konum geçmişini getir
const getLocationHistory = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Son N günün konum verilerini al
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    // Bu örnekte basit bir yapı kullanıyoruz
    // Gerçek uygulamada ayrı bir LocationHistory modeli olabilir
    const history = {
      currentLocation: {
        latitude: user.location_latitude,
        longitude: user.location_longitude,
        accuracy: user.location_accuracy
      },
      lastUpdated: user.location_last_updated,
      sharingEnabled: user.location_is_sharing || false
    };

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Location history error:', error);
    res.status(500).json({
      success: false,
      message: 'Konum geçmişi alınırken bir hata oluştu'
    });
  }
};

  // Konum paylaşımını durdur
  const stopLocationSharing = async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Kullanıcı bulunamadı'
        });
      }

      // Konum paylaşımını kapat
      await User.stopLocationSharing(userId);

      res.json({
        success: true,
        message: 'Konum paylaşımı durduruldu'
      });

    } catch (error) {
      console.error('Stop location sharing error:', error);
      res.status(500).json({
        success: false,
        message: 'Konum paylaşımı durdurulurken bir hata oluştu'
      });
    }
  };

  // Kullanıcı offline olduğunda konum paylaşımını durdur (socket.io için)
  const setUserOffline = async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Kullanıcı ID gerekli'
        });
      }

      // Konum paylaşımını kapat
      await User.stopLocationSharing(userId);

      res.json({
        success: true,
        message: 'Kullanıcı offline olarak işaretlendi'
      });

    } catch (error) {
      console.error('Set user offline error:', error);
      res.status(500).json({
        success: false,
        message: 'Kullanıcı offline işaretlenirken bir hata oluştu'
      });
    }
  };

// Konum ayarlarını getir
const getLocationSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    const settings = {
      isSharing: user.location_is_sharing || false,
      accuracy: user.location_accuracy || null,
      lastUpdated: user.location_last_updated || null,
      privacy: user.privacy ? (typeof user.privacy === 'string' ? JSON.parse(user.privacy) : user.privacy) : {}
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Location settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Konum ayarları alınırken bir hata oluştu'
    });
  }
};

// Konum ayarlarını güncelle
const updateLocationSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veri',
        errors: errors.array()
      });
    }

    const { isSharing, privacy } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Konum paylaşımını güncelle
    if (isSharing !== undefined) {
      const locationData = {
        latitude: user.location_latitude || 0,
        longitude: user.location_longitude || 0,
        accuracy: user.location_accuracy || null,
        isSharing: isSharing
      };
      await User.updateLocation(userId, locationData);
    }

    // Gizlilik ayarlarını güncelle
    if (privacy) {
      const currentPrivacy = user.privacy ? (typeof user.privacy === 'string' ? JSON.parse(user.privacy) : user.privacy) : {};
      const updatedPrivacy = { ...currentPrivacy, ...privacy };
      await User.updatePrivacy(userId, updatedPrivacy);
    }

    // Güncellenmiş kullanıcı verilerini al
    const updatedUser = await User.findById(userId);

    res.json({
      success: true,
      message: 'Konum ayarları güncellendi',
      data: {
        isSharing: updatedUser.location_is_sharing || false,
        privacy: updatedUser.privacy ? (typeof updatedUser.privacy === 'string' ? JSON.parse(updatedUser.privacy) : updatedUser.privacy) : {}
      }
    });

  } catch (error) {
    console.error('Update location settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Konum ayarları güncellenirken bir hata oluştu'
    });
  }
};

module.exports = {
  updateUserLocation,
  getNearbyUsers,
  getLocationHistory,
  stopLocationSharing,
  setUserOffline,
  getLocationSettings,
  updateLocationSettings
};
