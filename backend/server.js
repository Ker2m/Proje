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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:19006',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:19006',
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
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userEmail = decoded.email;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userEmail} (${socket.id})`);

  // Kullanıcıyı genel odaya ekle
  socket.join('general');

  // Bağlantı durumunu bildir
  socket.emit('connection_status', { connected: true });
  socket.broadcast.to('general').emit('user_joined', {
    userId: socket.userId,
    userEmail: socket.userEmail,
    socketId: socket.id
  });

  // Mesaj gönderme
  socket.on('send_message', (data) => {
    const messageData = {
      message: data.message,
      senderId: socket.userId,
      senderEmail: socket.userEmail,
      timestamp: new Date().toISOString(),
      room: data.room || 'general'
    };

    // Mesajı odaya gönder
    io.to(data.room || 'general').emit('message_received', messageData);
    console.log(`Message sent by ${socket.userEmail}: ${data.message}`);
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

  // Bağlantı kesildiğinde
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.userEmail} (${socket.id}) - Reason: ${reason}`);
    socket.broadcast.to('general').emit('user_left', {
      userId: socket.userId,
      userEmail: socket.userEmail,
      socketId: socket.id
    });
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
      emailService.configure({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      });
    } else {
      console.log('⚠️  Email servisi yapılandırılmamış (SMTP bilgileri eksik)');
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
