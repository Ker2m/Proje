# Harita Kurulumu - CaddateApp

## 🗺️ Harita Servisleri

Bu uygulama platform bazlı harita servisleri kullanır:
- **iOS**: Apple Maps (ücretsiz)
- **Android**: Google Maps (API key gerekli)

## 🔑 Google Maps API Key Kurulumu

### 1. Google Cloud Console'a Giriş
1. [Google Cloud Console](https://console.cloud.google.com/) adresine gidin
2. Google hesabınızla giriş yapın
3. Yeni proje oluşturun veya mevcut projeyi seçin

### 2. Maps API'lerini Etkinleştirin
1. Sol menüden "APIs & Services" > "Library" seçin
2. Aşağıdaki API'leri arayın ve etkinleştirin:
   - **Maps SDK for Android**
   - **Maps SDK for iOS** (opsiyonel)
   - **Places API** (opsiyonel)
   - **Geocoding API** (opsiyonel)

### 3. API Key Oluşturun
1. "APIs & Services" > "Credentials" seçin
2. "Create Credentials" > "API Key" tıklayın
3. API key'inizi kopyalayın

### 4. API Key'i Uygulamaya Ekleyin
1. `app.json` dosyasını açın
2. `YOUR_GOOGLE_MAPS_API_KEY_HERE` yerine gerçek API key'inizi yazın:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-maps",
        {
          "googleMapsApiKey": "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        }
      ]
    ]
  }
}
```

### 5. API Key Güvenliği (Önerilen)
- API key'inizi sadece gerekli platformlarda kısıtlayın
- Android uygulaması için package name kısıtlaması ekleyin
- Günlük kullanım limitleri belirleyin

## 🚀 Test Etme

### Development Modunda
```bash
# Android için
npx expo run:android

# iOS için
npx expo run:ios
```

### Production Build
```bash
# Android APK
npx expo build:android

# iOS IPA
npx expo build:ios
```

## 📱 Platform Özellikleri

### iOS (Apple Maps)
- ✅ Ücretsiz kullanım
- ✅ Yerel Apple Maps entegrasyonu
- ✅ Siri entegrasyonu
- ✅ Offline harita desteği

### Android (Google Maps)
- ✅ Zengin harita özellikleri
- ✅ Trafik bilgisi
- ✅ Street View
- ✅ Google Places entegrasyonu

## 🔧 Sorun Giderme

### Yaygın Hatalar

1. **"RNMapsAirModule could not be found"**
   - Çözüm: `react-native-maps` yerine `expo-maps` kullanın

2. **"Google Maps API key not found"**
   - Çözüm: `app.json` dosyasında API key'i kontrol edin

3. **"Location permission denied"**
   - Çözüm: Cihaz ayarlarından konum iznini etkinleştirin

4. **Harita yüklenmiyor**
   - Çözüm: İnternet bağlantısını kontrol edin
   - API key'in doğru olduğundan emin olun

## 📞 Destek

Sorun yaşıyorsanız:
1. Expo dokümantasyonunu kontrol edin
2. Google Maps API dokümantasyonunu inceleyin
3. GitHub issues bölümünde sorun bildirin
