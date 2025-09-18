import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './api';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  // Socket bağlantısını başlat
  async connect() {
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('No token found, skipping socket connection');
        return;
      }

      // Backend URL'ini al (API servisinden)
      const baseURL = apiService.getBaseURL();
      // API URL'den base URL'i çıkar (http://192.168.1.2:3000/api -> http://192.168.1.2:3000)
      const socketURL = baseURL.replace('/api', '');

      this.socket = io(socketURL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      this.setupEventListeners();
      
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }

  // Event listener'ları ayarla
  setupEventListeners() {
    if (!this.socket) return;

    // Bağlantı başarılı
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    // Bağlantı kesildi
    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      this.emit('connection_status', { connected: false, reason });
      
      if (reason === 'io server disconnect') {
        // Sunucu tarafından kesildi, yeniden bağlanma
        this.handleReconnect();
      }
    });

    // Bağlantı hatası
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnected = false;
      this.emit('connection_error', error);
      this.handleReconnect();
    });

    // Ayarlar güncellendi
    this.socket.on('settings_updated', (data) => {
      console.log('Settings updated from server:', data);
      this.handleSettingsUpdate(data);
    });

    // Bildirim geldi
    this.socket.on('notification', (data) => {
      console.log('Notification received:', data);
      this.handleNotification(data);
    });

    // Kullanıcı durumu güncellendi
    this.socket.on('user_status_updated', (data) => {
      console.log('User status updated:', data);
      this.handleUserStatusUpdate(data);
    });

    // Mesaj alındı
    this.socket.on('message_received', (data) => {
      console.log('Message received:', data);
      this.emit('message_received', data);
    });

    // Kullanıcı katıldı
    this.socket.on('user_joined', (data) => {
      console.log('User joined:', data);
      this.emit('user_joined', data);
    });

    // Kullanıcı ayrıldı
    this.socket.on('user_left', (data) => {
      console.log('User left:', data);
      this.emit('user_left', data);
    });
  }

  // Yeniden bağlanma işlemi
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Ayarları sunucuya gönder
  async updateSettings(settings) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, settings not synced');
      return;
    }

    try {
      this.socket.emit('update_settings', {
        settings: settings,
        timestamp: new Date().toISOString()
      });
      console.log('Settings sent to server:', settings);
    } catch (error) {
      console.error('Error sending settings to server:', error);
    }
  }

  // Bildirim ayarlarını sunucuya gönder
  async updateNotificationSettings(notificationSettings) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, notification settings not synced');
      return;
    }

    try {
      this.socket.emit('update_notification_settings', {
        notificationSettings: notificationSettings,
        timestamp: new Date().toISOString()
      });
      console.log('Notification settings sent to server:', notificationSettings);
    } catch (error) {
      console.error('Error sending notification settings to server:', error);
    }
  }

  // Sunucudan gelen ayar güncellemelerini işle
  handleSettingsUpdate(data) {
    // Bu fonksiyon SettingsScreen'de override edilecek
    if (this.onSettingsUpdate) {
      this.onSettingsUpdate(data);
    }
  }

  // Sunucudan gelen bildirimleri işle
  handleNotification(data) {
    // Bu fonksiyon SettingsScreen'de override edilecek
    if (this.onNotification) {
      this.onNotification(data);
    }
  }

  // Kullanıcı durumu güncellemelerini işle
  handleUserStatusUpdate(data) {
    // Bu fonksiyon SettingsScreen'de override edilecek
    if (this.onUserStatusUpdate) {
      this.onUserStatusUpdate(data);
    }
  }

  // Mesaj gönder
  sendMessage(message, room = 'general') {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, message not sent');
      return false;
    }

    try {
      this.socket.emit('send_message', {
        message: message,
        room: room,
        timestamp: new Date().toISOString()
      });
      console.log('Message sent:', message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  // Odaya katıl
  joinRoom(room) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, cannot join room');
      return false;
    }

    try {
      this.socket.emit('join_room', room);
      console.log('Joined room:', room);
      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      return false;
    }
  }

  // Odadan ayrıl
  leaveRoom(room) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, cannot leave room');
      return false;
    }

    try {
      this.socket.emit('leave_room', room);
      console.log('Left room:', room);
      return true;
    } catch (error) {
      console.error('Error leaving room:', error);
      return false;
    }
  }

  // Kullanıcı durumunu güncelle
  updateUserStatus(status) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, status not updated');
      return false;
    }

    try {
      this.socket.emit('update_user_status', {
        status: status,
        timestamp: new Date().toISOString()
      });
      console.log('User status updated:', status);
      return true;
    } catch (error) {
      console.error('Error updating user status:', error);
      return false;
    }
  }

  // Socket ID'yi al
  getSocketId() {
    return this.socket ? this.socket.id : null;
  }

  // Event listener ekle
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Event listener kaldır
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Event emit et
  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  // Bağlantı durumunu kontrol et
  isSocketConnected() {
    return this.socket && this.isConnected;
  }

  // Socket'i kapat
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('Socket disconnected');
    }
  }

  // Event listener'ları temizle
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;