# CaddateApp Backend API

CaddateApp için Node.js, Express ve PostgreSQL kullanılarak geliştirilmiş backend API.

## 🚀 Özellikler

- **Kimlik Doğrulama**: JWT tabanlı güvenli giriş/kayıt sistemi
- **Email Doğrulama**: 2FA için SMTP ile email doğrulama kodu gönderme
- **Kullanıcı Yönetimi**: Profil oluşturma, güncelleme ve silme
- **Güvenlik**: Helmet, CORS, bcrypt ile şifre hashleme
- **Veritabanı**: PostgreSQL ile güvenli veri saklama

## 📋 Gereksinimler

- Node.js (v14 veya üzeri)
- PostgreSQL (v12 veya üzeri)
- SMTP sunucusu (email doğrulama için)

## 🛠️ Kurulum

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Ortam Değişkenlerini Yapılandırın
`config.env` dosyasını düzenleyin:

```env
# Veritabanı Ayarları
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME=caddate_db

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# Server Ayarları
PORT=3000
NODE_ENV=development

# CORS Ayarları
FRONTEND_URL=http://localhost:19006

# SMTP Ayarları (Email Servisi)
SMTP_HOST=your_smtp_host_here
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username_here
SMTP_PASS=your_smtp_password_here
SMTP_FROM=noreply@caddateapp.com

# Email Doğrulama Ayarları
EMAIL_VERIFICATION_ENABLED=false
VERIFICATION_CODE_EXPIRY_MINUTES=10
```

### 3. Veritabanını Oluşturun
```sql
CREATE DATABASE caddate_db;
```

### 4. Veritabanı Şemasını Çalıştırın
```bash
psql -U postgres -d caddate_db -f database/schema.sql
```

### 5. Sunucuyu Başlatın
```bash
# Geliştirme modu
npm run dev

# Üretim modu
npm start
```

## 📊 API Endpoints

### Kimlik Doğrulama
- `POST /api/auth/register` - Kullanıcı kayıt
- `POST /api/auth/login` - Kullanıcı giriş
- `GET /api/auth/verify` - Token doğrulama
- `POST /api/auth/logout` - Kullanıcı çıkış

### Kullanıcı Yönetimi
- `GET /api/users/profile` - Profil getir
- `PUT /api/users/profile` - Profil güncelle
- `DELETE /api/users/profile` - Hesabı sil
- `GET /api/users/discover` - Diğer kullanıcıları keşfet
- `GET /api/users/:id` - Belirli kullanıcının profilini getir

### Email Doğrulama
- `POST /api/email/send-code` - Doğrulama kodu gönder
- `POST /api/email/verify-code` - Doğrulama kodunu doğrula
- `POST /api/email/test` - Test emaili gönder
- `GET /api/email/status` - Email servis durumu

### Sistem
- `GET /` - API bilgileri
- `GET /health` - Sistem durumu

## 🔧 Geliştirme

### Veritabanı Migrasyonları
Yeni tablo veya alan eklerken `database/schema.sql` dosyasını güncelleyin.

### Yeni Controller Ekleme
1. `controllers/` klasöründe yeni controller oluşturun
2. `routes/` klasöründe route dosyası oluşturun
3. `server.js` dosyasında route'u kaydedin

### Email Servisi
SMTP bilgilerini `config.env` dosyasında yapılandırın. Email servisi yapılandırılmadığında kodlar konsola yazdırılır.

## 🛡️ Güvenlik

- JWT token'lar 7 gün geçerlidir
- Şifreler bcrypt ile hashlenir (12 salt rounds)
- CORS yapılandırması frontend URL'i ile sınırlı
- Helmet ile güvenlik başlıkları
- SQL injection koruması (parametreli sorgular)

## 📝 Notlar

- Email doğrulama şu anda opsiyonel (`EMAIL_VERIFICATION_ENABLED=false`)
- SMTP yapılandırılmadığında doğrulama kodları konsola yazdırılır
- Geliştirme modunda detaylı hata mesajları gösterilir
