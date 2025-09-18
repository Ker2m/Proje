import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL
// Environment'a göre URL seçimi
const getApiBaseUrl = () => {
  // Development için
  if (__DEV__) {
    // Mobil uygulama için IP adresi kullan (localhost çalışmaz)
    // Bu IP'yi kendi bilgisayarınızın IP adresi ile değiştirin
    // Windows: ipconfig komutu ile IP adresinizi bulabilirsiniz
    // Mac/Linux: ifconfig komutu ile IP adresinizi bulabilirsiniz
    return 'http://192.168.1.2:3000/api'; // Bilgisayarınızın IP adresi
  }
  // Production için
  return 'https://your-production-api.com/api';
};

const API_BASE_URL = getApiBaseUrl();

// API servis sınıfı
class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
  }

  // Token'ı ayarla
  setToken(token) {
    this.token = token;
  }

  // Token'ı temizle
  clearToken() {
    this.token = null;
  }

  // Base URL'i al
  getBaseURL() {
    return this.baseURL;
  }

  // Token'ı AsyncStorage'a kaydet
  async saveToken(token) {
    try {
      await AsyncStorage.setItem('auth_token', token);
      this.token = token;
    } catch (error) {
      console.error('Token kaydetme hatası:', error);
    }
  }

  // Token'ı AsyncStorage'dan al
  async getStoredToken() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      return token;
    } catch (error) {
      console.error('Token alma hatası:', error);
      return null;
    }
  }

  // Token'ı AsyncStorage'dan sil
  async removeStoredToken() {
    try {
      await AsyncStorage.removeItem('auth_token');
      this.token = null;
    } catch (error) {
      console.error('Token silme hatası:', error);
    }
  }

  // HTTP isteği gönder
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Token varsa Authorization header'ına ekle
    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      
      // Response'un JSON olup olmadığını kontrol et
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      
      // Network hatası için özel mesaj
      if (error.message === 'Network request failed') {
        throw new Error('Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin ve API sunucusunun çalıştığından emin olun.');
      }
      
      throw error;
    }
  }

  // GET isteği
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST isteği
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT isteği
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE isteği
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Auth API'leri
  async register(userData) {
    const response = await this.post('/auth/register', userData);
    
    // Başarılı kayıtta token'ı kaydet
    if (response.success && response.data.token) {
      await this.saveToken(response.data.token);
    }
    
    return response;
  }

  async login(email, password) {
    const response = await this.post('/auth/login', { email, password });
    
    // Başarılı girişte token'ı kaydet
    if (response.success && response.data.token) {
      await this.saveToken(response.data.token);
    }
    
    return response;
  }

  async verifyToken() {
    return this.get('/auth/verify');
  }

  async logout() {
    try {
      // Backend'e logout isteği gönder
      await this.post('/auth/logout');
    } catch (error) {
      // Backend hatası olsa bile token'ı temizle
      console.error('Logout error:', error);
    } finally {
      // Her durumda token'ı temizle
      await this.removeStoredToken();
    }
  }

  // User API'leri
  async getProfile() {
    return this.get('/users/profile');
  }

  async updateProfile(userData) {
    return this.put('/users/profile', userData);
  }

  async deleteAccount() {
    return this.delete('/users/profile');
  }

  async discoverUsers(limit = 20, offset = 0) {
    return this.get(`/users/discover?limit=${limit}&offset=${offset}`);
  }

  async getUserById(id) {
    return this.get(`/users/${id}`);
  }

  // Email API'leri
  async sendVerificationCode(email, codeType = 'registration') {
    return this.post('/email/send-code', { email, code_type: codeType });
  }

  async verifyCode(email, code, codeType = 'registration') {
    return this.post('/email/verify-code', { email, code, code_type: codeType });
  }

  async getEmailServiceStatus() {
    return this.get('/email/status');
  }

  // Settings API'leri
  async getSettings() {
    return this.get('/users/settings');
  }

  async updateSettings(settingsData) {
    return this.put('/users/settings', settingsData);
  }

  // Profil fotoğrafı upload
  async uploadProfilePicture(formData) {
    const url = `${this.baseURL}/users/profile-picture`;
    
    console.log('API Service - Upload URL:', url);
    console.log('API Service - Token:', this.token);
    
    const config = {
      method: 'POST',
      headers: {
        // Content-Type'ı kaldırıyoruz, FormData otomatik ayarlar
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
      body: formData,
    };
    
    console.log('API Service - Config:', config);

    try {
      const response = await fetch(url, config);
      
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  }
}

// Singleton instance
const apiService = new ApiService();

export default apiService;
