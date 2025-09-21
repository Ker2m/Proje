const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './config.env' });

// Import database connection
const { testConnection } = require('./config/database');

// Import email service
const emailService = require('./services/emailService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const emailVerificationRoutes = require('./routes/emailVerification');
const photoRoutes = require('./routes/photos');
const securityRoutes = require('./routes/security');
const locationRoutes = require('./routes/location');
const friendshipRoutes = require('./routes/friendships');
const notificationRoutes = require('./routes/notifications');
const socialRoutes = require('./routes/social');
const chatRoutes = require('./routes/chat');

// Import models
const Activity = require('./models/Activity');

// Import notification controller
const { createNotification, sendNotification } = require('./controllers/notificationController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:19006", 
      "http://localhost:19000",
      "http://127.0.0.1:19006",
      "http://127.0.0.1:19000",
      "http://192.168.1.2:19006", 
      "exp://192.168.1.2:19000",
      "https://*.exp.direct",
      "https://*.exp.direct:443",
      "https://*.exp.direct:80",
      "https://*.exp.direct:19000",
      "https://*.exp.direct:19006",
      "exp://*.exp.direct",
      "exp://*.exp.direct:443",
      "exp://*.exp.direct:80",
      "exp://*.exp.direct:19000",
      "exp://*.exp.direct:19006"
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: [
    "http://localhost:19006", 
    "http://localhost:19000",
    "http://127.0.0.1:19006",
    "http://127.0.0.1:19000",
    "http://192.168.1.2:19006", 
    "exp://192.168.1.2:19000",
    "https://*.exp.direct",
    "https://*.exp.direct:443",
    "https://*.exp.direct:80",
    "https://*.exp.direct:19000",
    "https://*.exp.direct:19006",
    "exp://*.exp.direct",
    "exp://*.exp.direct:443",
    "exp://*.exp.direct:80",
    "exp://*.exp.direct:19000",
    "exp://*.exp.direct:19006"
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'CaddateApp Backend API', 
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      health: '/health'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io middleware for authentication
io.use(async (socket, next) => {
  try {
    console.log('🔐 Socket authentication attempt:', socket.handshake.auth);
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('❌ No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    console.log('🔍 Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userEmail = decoded.email;
    console.log('✅ Token verified for user:', decoded.email);
    next();
  } catch (err) {
    console.log('❌ Token verification failed:', err.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

  // Online kullanıcıları takip et
  const onlineUsers = new Map();
  
  // Kullanıcı bilgilerini sakla
  const userInfo = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.userEmail} (${socket.id})`);

  // Kullanıcıyı genel odaya ekle
  socket.join('general');
  console.log(`📝 User ${socket.userEmail} joined general room`);

  // Online kullanıcıları map'e ekle
  onlineUsers.set(socket.userId, {
    userId: socket.userId,
    userEmail: socket.userEmail,
    socketId: socket.id,
    joinedAt: new Date().toISOString()
  });

  // Kullanıcı bilgilerini al ve sakla
  const User = require('./models/User');
  User.findById(socket.userId).then(user => {
    if (user) {
      socket.userFirstName = user.first_name;
      socket.userLastName = user.last_name;
      userInfo.set(socket.userId, {
        firstName: user.first_name,
        lastName: user.last_name,
        profilePicture: user.profile_picture
      });
    }
  });

  console.log(`👥 Total online users: ${onlineUsers.size}`);

  // Bağlantı durumunu bildir
  socket.emit('connection_status', { connected: true });
  console.log(`✅ Connection status sent to ${socket.userEmail}`);
  
  // Yeni kullanıcıya mevcut online kullanıcıları gönder
  const currentOnlineUsers = Array.from(onlineUsers.values());
  socket.emit('online_users_list', currentOnlineUsers);
  console.log(`📋 Online users list sent to ${socket.userEmail}:`, currentOnlineUsers.length, 'users');
  
  // Diğer kullanıcılara yeni kullanıcının katıldığını bildir
  socket.broadcast.to('general').emit('user_joined', {
    userId: socket.userId,
    userEmail: socket.userEmail,
    socketId: socket.id
  });
  console.log(`📢 User joined notification sent to other users`);
  
  // Tüm kullanıcılara güncel online kullanıcı listesini gönder
  const updatedOnlineUsers = Array.from(onlineUsers.values());
  io.emit('online_users_list', updatedOnlineUsers);
  console.log(`📋 Updated online users list sent to all users:`, updatedOnlineUsers.length, 'users');

  // Mesaj gönderme
  socket.on('send_message', (data) => {
    console.log(`💬 Message received from ${socket.userEmail}: ${data.message}`);
    const messageData = {
      message: data.message,
      senderId: socket.userId,
      senderEmail: socket.userEmail,
      timestamp: new Date().toISOString(),
      room: data.room || 'general'
    };

    // Mesajı tüm kullanıcılara gönder (genel sohbet için)
    if (data.room === 'general' || !data.room) {
      io.emit('message_received', messageData);
      console.log(`📤 Message broadcasted to all users in general chat`);
    } else {
      // Özel odalar için sadece o odaya gönder
      io.to(data.room).emit('message_received', messageData);
      console.log(`📤 Message broadcasted to room ${data.room}`);
    }
  });

  // Özel mesaj gönderme
  socket.on('send_private_message', (data) => {
    console.log(`💬 Private message received from ${socket.userEmail} to friend ${data.friendId}: ${data.message}`);
    const messageData = {
      message: data.message,
      senderId: socket.userId,
      senderEmail: socket.userEmail,
      timestamp: new Date().toISOString(),
      room: data.room,
      friendId: data.friendId
    };

    // Özel odaya mesajı gönder
    if (data.room) {
      io.to(data.room).emit('private_message_received', messageData);
      console.log(`📤 Private message broadcasted to room ${data.room}`);
    } else {
      console.log(`❌ Private message room not specified`);
    }
  });

  // Oda değiştirme
  socket.on('join_room', (room) => {
    socket.leave('general');
    socket.join(room);
    console.log(`${socket.userEmail} joined room: ${room}`);
  });

  // Oda bırakma
  socket.on('leave_room', (room) => {
    socket.leave(room);
    socket.join('general');
    console.log(`${socket.userEmail} left room: ${room}`);
  });

  // Ayarları güncelleme
  socket.on('update_settings', (data) => {
    console.log(`Settings updated by ${socket.userEmail}:`, data.settings);
    // Burada ayarları veritabanına kaydedebilirsiniz
  });

  // Bildirim ayarlarını güncelleme
  socket.on('update_notification_settings', (data) => {
    console.log(`Notification settings updated by ${socket.userEmail}:`, data.notificationSettings);
    // Burada bildirim ayarlarını veritabanına kaydedebilirsiniz
  });

  // Kullanıcı durumu güncelleme
  socket.on('update_user_status', (data) => {
    console.log(`User status updated by ${socket.userEmail}:`, data.status);
    socket.broadcast.to('general').emit('user_status_updated', {
      userId: socket.userId,
      status: data.status,
      timestamp: new Date().toISOString()
    });
  });

  // Fotoğraf paylaşımı
  socket.on('photo_shared', (data) => {
    console.log(`Photo shared by ${socket.userEmail}:`, data.photoId);
    socket.broadcast.to('general').emit('new_photo', {
      photoId: data.photoId,
      userId: socket.userId,
      userEmail: socket.userEmail,
      timestamp: new Date().toISOString()
    });
  });

  // Fotoğraf beğenisi
  socket.on('photo_liked', (data) => {
    console.log(`Photo liked by ${socket.userEmail}:`, data.photoId);
    socket.broadcast.to('general').emit('photo_like_updated', {
      photoId: data.photoId,
      userId: socket.userId,
      userEmail: socket.userEmail,
      liked: data.liked,
      timestamp: new Date().toISOString()
    });
  });

  // Yeni aktivite oluşturma
  socket.on('create_activity', async (data) => {
    try {
      console.log(`Activity created by ${socket.userEmail}:`, data.type);
      
      // Veritabanına aktiviteyi kaydet
      const activity = await Activity.create(
        socket.userId,
        data.type,
        data.title,
        data.description,
        data.metadata || {}
      );

      // Kullanıcı bilgilerini al
      const activityData = {
        id: activity.id,
        type: activity.type,
        userId: socket.userId,
        userEmail: socket.userEmail,
        title: activity.title,
        description: activity.description,
        timestamp: activity.created_at,
        metadata: activity.metadata
      };

      // Tüm kullanıcılara yeni aktiviteyi bildir
      io.emit('new_activity', activityData);
      console.log(`📢 New activity broadcasted: ${data.type}`);
      
    } catch (error) {
      console.error('Error creating activity:', error);
      socket.emit('activity_error', { message: 'Aktivite oluşturulamadı' });
    }
  });

  // Aktivite listesi isteme
  socket.on('request_activities', async (data) => {
    try {
      console.log(`Activities requested by ${socket.userEmail}`);
      
      // Kullanıcının aktivitelerini veritabanından al
      const activities = await Activity.getByUserId(socket.userId, 10, 0);
      
      // Aktivite verilerini formatla
      const formattedActivities = activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        userId: activity.user_id,
        userEmail: socket.userEmail,
        title: activity.title,
        description: activity.description,
        timestamp: activity.created_at,
        metadata: activity.metadata
      }));

      socket.emit('activities_list', formattedActivities);
      console.log(`📋 ${formattedActivities.length} activities sent to ${socket.userEmail}`);
      
    } catch (error) {
      console.error('Error getting activities:', error);
      socket.emit('activities_error', { message: 'Aktiviteler yüklenemedi' });
    }
  });

  // Bildirim gönderme
  socket.on('send_notification', async (data) => {
    try {
      console.log(`📱 Notification request from ${socket.userEmail}:`, data);
      
      const { targetUserId, type, title, message, data: notificationData } = data;
      
      if (!targetUserId || !type || !title || !message) {
        socket.emit('notification_error', { message: 'Gerekli alanlar eksik' });
        return;
      }
      
      // Bildirim oluştur
      const notificationResult = await createNotification(
        targetUserId,
        type,
        title,
        message,
        notificationData || {},
        socket.userId
      );
      
      if (notificationResult.success) {
        // Hedef kullanıcıya gerçek zamanlı bildirim gönder
        const targetUserSocket = Array.from(onlineUsers.values())
          .find(user => user.userId === targetUserId);
        
        if (targetUserSocket) {
          io.to(targetUserSocket.socketId).emit('new_notification', {
            id: notificationResult.data.id,
            type,
            title,
            message,
            data: notificationData,
            createdAt: notificationResult.data.createdAt,
            senderId: socket.userId,
            senderEmail: socket.userEmail
          });
          console.log(`📱 Real-time notification sent to user ${targetUserId}`);
        }
        
        socket.emit('notification_sent', {
          success: true,
          notificationId: notificationResult.data.id
        });
      } else {
        socket.emit('notification_error', { message: 'Bildirim oluşturulamadı' });
      }
      
    } catch (error) {
      console.error('Error sending notification:', error);
      socket.emit('notification_error', { message: 'Bildirim gönderilirken hata oluştu' });
    }
  });

  // Bildirim listesi isteme
  socket.on('request_notifications', async (data) => {
    try {
      console.log(`📱 Notifications requested by ${socket.userEmail}`);
      
      // Bu endpoint'i notificationController'dan çağırabiliriz
      // Şimdilik basit bir response gönderelim
      socket.emit('notifications_list', {
        success: true,
        message: 'Bildirimler yüklendi'
      });
      
    } catch (error) {
      console.error('Error getting notifications:', error);
      socket.emit('notifications_error', { message: 'Bildirimler yüklenirken hata oluştu' });
    }
  });

  // Push token kaydetme
  socket.on('register_push_token', async (data) => {
    try {
      console.log(`📱 Push token registration from ${socket.userEmail}`);
      
      const { pushToken, deviceType } = data;
      
      if (!pushToken) {
        socket.emit('push_token_error', { message: 'Push token gerekli' });
        return;
      }
      
      // Push token'ı veritabanına kaydet (users tablosuna eklenebilir)
      // Şimdilik sadece log'layalım
      console.log(`📱 Push token registered for ${socket.userEmail}: ${pushToken}`);
      
      socket.emit('push_token_registered', {
        success: true,
        message: 'Push token kaydedildi'
      });
      
    } catch (error) {
      console.error('Error registering push token:', error);
      socket.emit('push_token_error', { message: 'Push token kaydedilirken hata oluştu' });
    }
  });

  // Konum güncellemesi
  socket.on('location_update', async (data) => {
    try {
      console.log(`📍 Location update from ${socket.userEmail}:`, data.location);
      
      const { location } = data;
      
      if (!location || !location.latitude || !location.longitude) {
        socket.emit('location_error', { message: 'Geçersiz konum verisi' });
        return;
      }
      
      // Konumu diğer kullanıcılara yayınla
      socket.broadcast.emit('user_location_update', {
        userId: socket.userId,
        userEmail: socket.userEmail,
        firstName: socket.userFirstName || 'Kullanıcı', // Kullanıcı adını ekle
        lastName: socket.userLastName || '',
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        },
        timestamp: new Date().toISOString(),
        isOnline: true
      });
      
      console.log(`📍 Location broadcasted to other users for ${socket.userEmail}`);
      
    } catch (error) {
      console.error('Error handling location update:', error);
      socket.emit('location_error', { message: 'Konum güncellenirken hata oluştu' });
    }
  });

  // Yakındaki kullanıcıları iste
  socket.on('request_nearby_users', async (data) => {
    try {
      console.log(`📍 Nearby users requested by ${socket.userEmail}`);
      
      const { radius = 5000, limit = 100 } = data;
      
      // Kullanıcının konumunu al
      const User = require('./models/User');
      const user = await User.findById(socket.userId);
      
      if (!user || !user.location_latitude || !user.location_longitude || !user.location_is_sharing) {
        socket.emit('nearby_users_list', {
          success: true,
          users: [],
          radius: radius,
          limit: limit,
          message: 'Konum paylaşımı kapalı veya konum bulunamadı'
        });
        return;
      }

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

      const userLat = user.location_latitude;
      const userLng = user.location_longitude;

      console.log(`📍 Found ${allUsers.length} users with location sharing enabled`);
      console.log(`📍 Current user location: ${userLat}, ${userLng}`);

      // Yakındaki kullanıcıları filtrele
      const nearbyUsers = allUsers
        .filter(u => u.id !== socket.userId)
        .map(u => {
          const distance = calculateDistance(
            userLat, userLng,
            u.location_latitude, u.location_longitude
          );
          console.log(`📍 User ${u.first_name} at distance: ${Math.round(distance)}m`);
          // Online durumu: Son 30 saniye içinde konum güncellemesi varsa online
          const now = new Date();
          const lastUpdate = new Date(u.location_last_updated);
          const isOnline = (now - lastUpdate) < 30 * 1000; // 30 saniye içinde güncellenmişse online
          
          return {
            userId: u.id,
            firstName: u.first_name,
            lastName: u.last_name,
            profilePicture: u.profile_picture,
            location: {
              latitude: u.location_latitude,
              longitude: u.location_longitude,
              accuracy: u.location_accuracy
            },
            lastSeen: u.location_last_updated,
            distance: Math.round(distance),
            isOnline: isOnline
          };
        })
        .filter(u => u.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
      
      socket.emit('nearby_users_list', {
        success: true,
        users: nearbyUsers,
        radius: radius,
        limit: limit,
        message: `${nearbyUsers.length} kullanıcı bulundu`
      });
      
      console.log(`📍 ${nearbyUsers.length} nearby users sent to ${socket.userEmail}`);
      
    } catch (error) {
      console.error('Error getting nearby users:', error);
      socket.emit('nearby_users_error', { message: 'Yakındaki kullanıcılar alınırken hata oluştu' });
    }
  });

  // Bağlantı kesildiğinde
  socket.on('disconnect', (reason) => {
    console.log(`🔌 User disconnected: ${socket.userEmail} (${socket.id}) - Reason: ${reason}`);
    
    // Online kullanıcıları map'ten çıkar
    onlineUsers.delete(socket.userId);
    console.log(`👥 Remaining online users: ${onlineUsers.size}`);
    
    socket.broadcast.to('general').emit('user_left', {
      userId: socket.userId,
      userEmail: socket.userEmail,
      socketId: socket.id
    });
    console.log(`📢 User left notification sent to other users`);
    
    // Tüm kullanıcılara güncel online kullanıcı listesini gönder
    const updatedOnlineUsers = Array.from(onlineUsers.values());
    io.emit('online_users_list', updatedOnlineUsers);
    console.log(`📋 Updated online users list sent to all users:`, updatedOnlineUsers.length, 'users');
  });

  // Hata durumunda
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.userEmail}:`, error);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/email', emailVerificationRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/friendships', friendshipRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/chat', chatRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Veritabanı bağlantısını test et ve sunucuyu başlat
const startServer = async () => {
  try {
    // Veritabanı bağlantısını test et
    await testConnection();
    
    // Email servisini yapılandır (opsiyonel)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        emailService.configure({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        });
        console.log('✅ Email servisi başarıyla yapılandırıldı');
      } catch (error) {
        console.error('❌ Email servisi yapılandırılamadı:', error.message);
      }
    } else {
      console.log('⚠️  Email servisi yapılandırılmamış (SMTP bilgileri eksik)');
      console.log('SMTP_HOST:', process.env.SMTP_HOST);
      console.log('SMTP_USER:', process.env.SMTP_USER);
      console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'SET' : 'NOT SET');
    }
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📧 Email Service: ${emailService.isConfigured ? 'Aktif' : 'Pasif'}`);
      console.log(`🔌 Socket.io: Aktif`);
      console.log(`📊 API Endpoints:`);
      console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
      console.log(`   - Users: http://localhost:${PORT}/api/users`);
      console.log(`   - Location: http://localhost:${PORT}/api/location`);
      console.log(`   - Photos: http://localhost:${PORT}/api/photos`);
      console.log(`   - Security: http://localhost:${PORT}/api/security`);
      console.log(`   - Email: http://localhost:${PORT}/api/email`);
      console.log(`   - Health: http://localhost:${PORT}/health`);
      console.log(`   - Socket.io: ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server başlatılamadı:', error.message);
    process.exit(1);
  }
};

startServer();
