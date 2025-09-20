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
      console.log('SocketService: Bağlantı başlatılıyor...');
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('SocketService: Token bulunamadı, socket bağlantısı atlanıyor');
        return;
      }

      // Backend URL'ini al (API servisinden)
      const baseURL = apiService.getBaseURL();
      // API URL'den base URL'i çıkar (http://192.168.1.2:3000/api -> http://192.168.1.2:3000)
      const socketURL = baseURL.replace('/api', '');
      console.log('SocketService: Socket URL:', socketURL);

      this.socket = io(socketURL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        autoConnect: true
      });

      console.log('SocketService: Socket instance oluşturuldu');
      console.log('SocketService: Token:', token ? 'Mevcut' : 'Yok');
      this.setupEventListeners();
      
    } catch (error) {
      console.error('SocketService: Socket bağlantı hatası:', error);
    }
  }

  // Event listener'ları ayarla
  setupEventListeners() {
    if (!this.socket) return;

    // Bağlantı başarılı
    this.socket.on('connect', () => {
      console.log('SocketService: Socket bağlandı, ID:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connection_status', { connected: true });
    });

    // Bağlantı kesildi
    this.socket.on('disconnect', (reason) => {
      console.log('SocketService: Socket bağlantısı kesildi, sebep:', reason);
      this.isConnected = false;
      this.emit('connection_status', { connected: false, reason });
      
      if (reason === 'io server disconnect') {
        // Sunucu tarafından kesildi, yeniden bağlanma
        this.handleReconnect();
      }
    });

    // Bağlantı hatası
    this.socket.on('connect_error', (error) => {
      console.error('SocketService: Socket bağlantı hatası:', error);
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
      console.log('SocketService: Mesaj alındı:', data);
      this.emit('message_received', data);
    });

    // Kullanıcı katıldı
    this.socket.on('user_joined', (data) => {
      console.log('SocketService: Kullanıcı katıldı:', data);
      this.emit('user_joined', data);
    });

    // Kullanıcı ayrıldı
    this.socket.on('user_left', (data) => {
      console.log('SocketService: Kullanıcı ayrıldı:', data);
      this.emit('user_left', data);
    });

    // Online kullanıcı listesi
    this.socket.on('online_users_list', (data) => {
      console.log('SocketService: Online kullanıcı listesi alındı:', data);
      this.emit('online_users_list', data);
    });

    // Yeni aktivite
    this.socket.on('new_activity', (data) => {
      console.log('SocketService: Yeni aktivite alındı:', data);
      this.emit('new_activity', data);
    });

    // Aktivite listesi
    this.socket.on('activities_list', (data) => {
      console.log('SocketService: Aktivite listesi alındı:', data);
      this.emit('activities_list', data);
    });

    // Kullanıcı konum güncellemesi
    this.socket.on('user_location_update', (data) => {
      console.log('SocketService: Kullanıcı konum güncellemesi alındı:', data);
      this.emit('user_location_update', data);
    });

    // Yakındaki kullanıcılar listesi
    this.socket.on('nearby_users_list', (data) => {
      console.log('SocketService: Yakındaki kullanıcılar listesi alındı:', data);
      this.emit('nearby_users_list', data);
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

  // Aktivite oluştur
  createActivity(type, title, description, metadata = {}) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, activity not created');
      return false;
    }

    try {
      this.socket.emit('create_activity', {
        type: type,
        title: title,
        description: description,
        metadata: metadata,
        timestamp: new Date().toISOString()
      });
      console.log('Activity created:', type);
      return true;
    } catch (error) {
      console.error('Error creating activity:', error);
      return false;
    }
  }

  // Aktivite listesi iste
  requestActivities() {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, cannot request activities');
      return false;
    }

    try {
      this.socket.emit('request_activities', {});
      console.log('Activities requested');
      return true;
    } catch (error) {
      console.error('Error requesting activities:', error);
      return false;
    }
  }

  // Konum güncellemesi gönder
  sendLocationUpdate(locationData) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, location not sent');
      return false;
    }

    try {
      this.socket.emit('location_update', {
        location: locationData,
        timestamp: new Date().toISOString()
      });
      console.log('Location update sent:', locationData);
      return true;
    } catch (error) {
      console.error('Error sending location update:', error);
      return false;
    }
  }

  // Yakındaki kullanıcıları iste
  requestNearbyUsers(radius = 5000, limit = 100) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, cannot request nearby users');
      return false;
    }

    try {
      this.socket.emit('request_nearby_users', {
        radius: radius,
        limit: limit
      });
      console.log('Nearby users requested');
      return true;
    } catch (error) {
      console.error('Error requesting nearby users:', error);
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