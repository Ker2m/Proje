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
    this.listeners = {};
  }

  // Socket bağlantısını başlat
  async connect() {
    try {
      console.log('SocketService: Bağlantı başlatılıyor...');
      let token = await apiService.getStoredToken();
      
      // Eğer token yoksa, API servisinden al
      if (!token) {
        console.log('SocketService: Stored token bulunamadı, API servisinden alınıyor...');
        token = apiService.token;
      }
      
      if (!token) {
        console.log('SocketService: Token bulunamadı, socket bağlantısı atlanıyor');
        return;
      }
      
      console.log('SocketService: Token bulundu, bağlantı kuruluyor...');
      console.log('SocketService: Token (first 20 chars):', token.substring(0, 20) + '...');

      // Mevcut bağlantıyı kapat
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
        this.isConnected = false;
      }

      // Backend URL'ini al (API servisinden)
      const baseURL = apiService.getBaseURL();
      // API URL'den base URL'i çıkar (http://192.168.1.2:3000/api -> http://192.168.1.2:3000)
      const socketURL = baseURL.replace('/api', '');
      console.log('SocketService: Socket URL:', socketURL);
      
      // Tunnel URL kontrolü
      if (socketURL.includes('ngrok.io') || socketURL.includes('exp.direct')) {
        console.log('SocketService: Using tunnel connection');
      } else {
        console.log('SocketService: Using local connection');
      }

      this.socket = io(socketURL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 30000, // 30 saniye timeout
        forceNew: true,
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        maxReconnectionAttempts: 5
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
      this.emitLocal('connection_status', { connected: true });
      
      // Online kullanıcı listesini iste
      this.emitToSocket('request_online_users');
      console.log('SocketService: Online kullanıcı listesi istendi');
    });

    // Bağlantı kesildi
    this.socket.on('disconnect', (reason) => {
      console.log('SocketService: Socket bağlantısı kesildi, sebep:', reason);
      this.isConnected = false;
      this.emitLocal('connection_status', { connected: false, reason });
      
      if (reason === 'io server disconnect') {
        // Sunucu tarafından kesildi, yeniden bağlanma
        this.handleReconnect();
      }
    });

    // Bağlantı hatası
    this.socket.on('connect_error', (error) => {
      console.error('SocketService: Socket bağlantı hatası:', error);
      this.isConnected = false;
      this.emitLocal('connection_error', error);
      
      // WebSocket hatası için özel mesaj
      if (error.message && error.message.includes('websocket error')) {
        console.log('SocketService: WebSocket hatası, polling ile yeniden denenecek...');
      }
      
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
      this.emitLocal('message_received', data);
    });

    // Özel mesaj alındı
    this.socket.on('private_message_received', (data) => {
      console.log('SocketService: Özel mesaj alındı:', data);
      this.emitLocal('private_message_received', data);
    });

    // Kullanıcı katıldı
    this.socket.on('user_joined', (data) => {
      console.log('SocketService: Kullanıcı katıldı:', data);
      this.emitLocal('user_joined', data);
    });

    // Kullanıcı ayrıldı
    this.socket.on('user_left', (data) => {
      console.log('SocketService: Kullanıcı ayrıldı:', data);
      this.emitLocal('user_left', data);
    });

    // Online kullanıcı listesi
    this.socket.on('online_users_list', (data) => {
      console.log('SocketService: Online kullanıcı listesi alındı:', data);
      this.emitLocal('online_users_list', data);
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

      this.socket.on('nearby_users_error', (error) => {
        console.error('SocketService: Yakındaki kullanıcılar hatası:', error);
        this.emit('nearby_users_error', error);
      });

      this.socket.on('location_error', (error) => {
        console.error('SocketService: Konum hatası:', error);
        this.emit('location_error', error);
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
      this.emitToSocket('update_settings', {
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
      this.emitToSocket('update_notification_settings', {
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
      this.emitToSocket('send_message', {
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

  // Özel mesaj gönder
  sendPrivateMessage(message, friendId, room) {
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, private message not sent');
      return false;
    }

    try {
      this.emitToSocket('send_private_message', {
        message: message,
        friendId: friendId,
        room: room,
        timestamp: new Date().toISOString()
      });
      console.log('Private message sent:', message, 'to friend:', friendId);
      return true;
    } catch (error) {
      console.error('Error sending private message:', error);
      return false;
    }
  }

  // Odaya katıl
  joinRoom(room) {
    console.log('SocketService: joinRoom çağrıldı, room:', room);
    console.log('SocketService: Socket connected:', this.isConnected);
    console.log('SocketService: Socket exists:', !!this.socket);
    
    if (!this.socket || !this.isConnected) {
      console.log('Socket not connected, cannot join room');
      return false;
    }

    try {
      console.log('SocketService: join_room event gönderiliyor:', room);
      this.emitToSocket('join_room', room);
      console.log('SocketService: join_room event gönderildi, room:', room);
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
      this.emitToSocket('leave_room', room);
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
      console.log('SocketService: Socket not connected, cannot request nearby users');
      console.log('SocketService: Socket exists:', !!this.socket);
      console.log('SocketService: Is connected:', this.isConnected);
      return false;
    }

    try {
      console.log('SocketService: Requesting nearby users with radius:', radius, 'limit:', limit);
      this.socket.emit('request_nearby_users', {
        radius: radius,
        limit: limit
      });
      console.log('SocketService: Nearby users request sent');
      return true;
    } catch (error) {
      console.error('SocketService: Error requesting nearby users:', error);
      return false;
    }
  }

  // Socket ID'yi al
  getSocketId() {
    return this.socket ? this.socket.id : null;
  }

  // Event listener ekle (component'lardan)
  on(event, callback) {
    console.log('SocketService: Event listener eklendi:', event);
    console.log('SocketService: Callback type:', typeof callback);
    console.log('SocketService: Callback function name:', callback.name || 'anonymous');
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    // Duplicate callback'leri önle
    if (!this.listeners[event].includes(callback)) {
      this.listeners[event].push(callback);
      console.log('SocketService: Callback eklendi, toplam:', this.listeners[event].length);
      console.log('SocketService: Listeners for', event, ':', this.listeners[event].length);
    } else {
      console.log('SocketService: Callback zaten mevcut, eklenmedi');
    }
  }

  // Event listener kaldır (component'lardan)
  off(event, callback) {
    console.log('SocketService: Event listener kaldırıldı:', event);
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  // Event emit et (socket'e gönder)
  emitToSocket(event, data) {
    if (this.socket) {
      console.log('SocketService: Socket\'e emit ediliyor:', event, data);
      this.socket.emit(event, data);
    } else {
      console.log('SocketService: Socket yok, emit edilemedi:', event);
    }
  }

  // Local event emit et (component'lara)
  emitLocal(event, data) {
    console.log('SocketService: Local event emit ediliyor:', event, data);
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback, index) => {
        try {
          console.log(`SocketService: Callback ${index} çağrılıyor:`, event, typeof callback);
          console.log('SocketService: Callback function name:', callback.name || 'anonymous');
          console.log('SocketService: Data before callback:', JSON.stringify(data, null, 2));
          callback(data);
          console.log(`SocketService: Callback ${index} başarılı:`, event);
        } catch (error) {
          console.error(`SocketService: Event callback ${index} hatası:`, error);
          console.error('SocketService: Event:', event);
          console.error('SocketService: Data:', JSON.stringify(data, null, 2));
          console.error('SocketService: Callback function:', callback.toString());
          console.error('SocketService: Error stack:', error.stack);
        }
      });
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