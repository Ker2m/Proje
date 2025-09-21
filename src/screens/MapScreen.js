import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  AppState,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
// React Native Maps import'u
import MapView, { Marker, Circle, PROVIDER_APPLE, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/colors';
import apiService from '../services/api';
import socketService from '../services/socketService';
import { 
  scale, 
  verticalScale, 
  scaleFont, 
  getResponsivePadding, 
  isIOS,
  isAndroid,
  isTablet,
  isSmallScreen,
  getBottomSafeArea
} from '../utils/responsive';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapType, setMapType] = useState('standard');
  const [showUserList, setShowUserList] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [lastLocation, setLastLocation] = useState(null);
  const [lastLocationTime, setLastLocationTime] = useState(null);
  
  // Animasyon değerleri
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    let isMounted = true;
    let socketCleanup = null;
    
    const initialize = async () => {
      try {
        await initializeMap();
        if (isMounted) {
          socketCleanup = initializeSocket();
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      stopLocationTracking();
      
      // Socket cleanup
      if (socketCleanup) {
        socketCleanup();
      }
      
      // Kullanıcı uygulamayı kapatırken konum paylaşımını durdur
      if (isLocationSharing) {
        console.log('🚪 App closing, stopping location sharing...');
        stopLocationSharingOnExit();
      }
      
      socketService.removeAllListeners();
    };
  }, []);

  // Ekran focus olduğunda ayarları yenile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('MapScreen focused, reloading settings...');
      loadLocationSettings();
      loadNearbyUsers();
      
      // Eğer konum paylaşımı açıksa, hemen konum güncelle
      if (isLocationSharing && location) {
        console.log('📍 App focused, immediately sharing location...');
        shareLocationWithServer();
      }
    });

    return unsubscribe;
  }, [navigation, isLocationSharing, location, shareLocationWithServer]);

  // Socket.io bağlantısı kurulduğunda yakındaki kullanıcıları iste
  useEffect(() => {
    if (isLocationSharing && socketService.isSocketConnected()) {
      // Socket.io ile yakındaki kullanıcıları anında iste
      socketService.requestNearbyUsers(5000, 100);
    }
  }, [isLocationSharing, socketService.isSocketConnected()]);

  // AppState değişikliklerini dinle (uygulama arka plana geçtiğinde)
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log('📱 App state changed:', nextAppState);
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Uygulama arka plana geçtiğinde konum paylaşımını durdur
        if (isLocationSharing) {
          console.log('📱 App went to background, stopping location sharing...');
          stopLocationSharingOnExit();
        }
      } else if (nextAppState === 'active') {
        // Uygulama tekrar aktif olduğunda konum paylaşımını yeniden başlat
        if (isLocationSharing) {
          console.log('📱 App became active, restarting location sharing...');
          // Konum paylaşımını yeniden başlat
          setTimeout(() => {
            if (location) {
              shareLocationWithServer(location);
            }
          }, 1000);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [isLocationSharing, location, stopLocationSharingOnExit, shareLocationWithServer]);

  // Animasyonları başlat
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const initializeMap = async () => {
    try {
      setIsLoading(true);
      
      // Paralel olarak çalıştır
      await Promise.allSettled([
        getLocationPermission(),
        loadLocationSettings(),
        loadNearbyUsers()
      ]);
      
    } catch (error) {
      console.error('Map initialization error:', error);
    } finally {
      // Minimum loading süresi
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  const initializeSocket = () => {
    console.log('🔌 Initializing Socket.io connection...');
    
    // Socket event listener'larını ayarla
    socketService.onUserLocationUpdate = handleUserLocationUpdate;
    socketService.onUserJoined = handleUserJoined;
    socketService.onUserLeft = handleUserLeft;
    
    // Socket bağlantısını başlat
    socketService.connect();

    // Socket event listener'ları ekle - ANLIK GÜNCELLEMELER
    socketService.on('user_location_update', (data) => {
      console.log('📍 Real-time location update received:', data);
      handleUserLocationUpdate(data);
    });
    
    socketService.on('nearby_users_list', (data) => {
      console.log('👥 Real-time nearby users list received:', data);
      if (data && data.users) {
        console.log(`👥 Setting ${data.users.length} nearby users`);
        setNearbyUsers(data.users);
      } else {
        console.log('👥 No users in socket response, setting empty array');
        setNearbyUsers([]);
      }
    });

    // Kullanıcı offline olduğunda
    socketService.on('user_offline', (data) => {
      console.log('👋 User went offline:', data);
      if (data && data.userId) {
        setNearbyUsers(prevUsers => 
          prevUsers.filter(user => user.userId !== data.userId)
        );
      }
    });

    // Kullanıcı online olduğunda
    socketService.on('user_online', (data) => {
      console.log('👋 User came online:', data);
      // Online olan kullanıcıyı yakındaki kullanıcılar listesine ekle
      if (data && data.userId) {
        // Bu kullanıcı zaten listede varsa güncelle, yoksa ekle
        setNearbyUsers(prevUsers => {
          const existingIndex = prevUsers.findIndex(user => user.userId === data.userId);
          if (existingIndex >= 0) {
            // Güncelle
            const updatedUsers = [...prevUsers];
            updatedUsers[existingIndex] = {
              ...updatedUsers[existingIndex],
              isOnline: true,
              lastSeen: data.timestamp || new Date().toISOString()
            };
            return updatedUsers;
          } else {
            // Yeni kullanıcı ekle
            return [...prevUsers, {
              userId: data.userId,
              firstName: data.firstName || 'Kullanıcı',
              lastName: data.lastName || '',
              isOnline: true,
              lastSeen: data.timestamp || new Date().toISOString(),
              location: data.location || null
            }];
          }
        });
      }
    });

    // Socket bağlantısı kurulduğunda yakındaki kullanıcıları iste
    socketService.on('connect', () => {
      console.log('✅ Socket connected, requesting nearby users...');
      // Bağlantı kurulduktan sonra yakındaki kullanıcıları iste
      setTimeout(() => {
        if (isLocationSharing) {
          console.log('📍 Requesting nearby users via socket...');
          socketService.requestNearbyUsers(5000, 100);
          
          // Socket bağlandığında hemen konum güncelle
          if (location) {
            console.log('📍 Socket connected, immediately sharing location...');
            shareLocationWithServer();
          }
        }
      }, 1000);
    });

    // Socket bağlantı durumu kontrolü
    socketService.on('connection_status', (data) => {
      console.log('🔌 Socket connection status:', data);
    });

    // Socket hataları
    socketService.on('connection_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    socketService.on('nearby_users_error', (error) => {
      console.error('❌ Nearby users error:', error);
    });

    socketService.on('location_error', (error) => {
      console.error('❌ Location error:', error);
    });

    // Socket bağlantı durumunu kontrol et
    setTimeout(() => {
      const isConnected = socketService.isSocketConnected();
      console.log('🔍 Socket connection check:', isConnected);
      if (!isConnected) {
        console.log('⚠️ Socket not connected, retrying...');
        socketService.connect();
      }
    }, 2000);

    // Periyodik olarak socket bağlantısını kontrol et
    const socketCheckInterval = setInterval(() => {
      const isConnected = socketService.isSocketConnected();
      if (!isConnected && isLocationSharing) {
        console.log('🔄 Socket disconnected, attempting to reconnect...');
        socketService.connect();
      }
    }, 10000); // Her 10 saniyede bir kontrol et

    // Cleanup function
    return () => {
      clearInterval(socketCheckInterval);
    };
  };

  const loadLocationSettings = async () => {
    try {
      // Önce backend'den ayarları al
      const token = await apiService.getStoredToken();
      if (token) {
        apiService.setToken(token);
        const response = await apiService.getSettings();
        if (response.success && response.data.settings) {
          const settings = response.data.settings;
          setIsLocationSharing(settings.privacy?.showLocation || false);
          
          // Local storage'ı da güncelle
          await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
          return;
        }
      }
      
      // Backend'den alamazsa local storage'dan yükle
      const localSettings = await AsyncStorage.getItem('userSettings');
      if (localSettings) {
        const parsedSettings = JSON.parse(localSettings);
        setIsLocationSharing(parsedSettings.privacy?.showLocation || false);
      }
    } catch (error) {
      console.error('Settings load error:', error);
      // Hata durumunda local storage'dan yükle
      try {
        const localSettings = await AsyncStorage.getItem('userSettings');
        if (localSettings) {
          const parsedSettings = JSON.parse(localSettings);
          setIsLocationSharing(parsedSettings.privacy?.showLocation || false);
        }
      } catch (localError) {
        console.error('Local settings load error:', localError);
      }
    }
  };

  const loadNearbyUsers = async () => {
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('No token for loading nearby users');
        return;
      }

      apiService.setToken(token);
      const response = await apiService.getNearbyUsers(5000, 100); // 5km yarıçap, max 100 kullanıcı
      
      console.log('Nearby users API response:', response);
      
      if (response.success && response.data.users) {
        console.log('Nearby users loaded:', response.data.users.length);
        console.log('Users data:', response.data.users);
        setNearbyUsers(response.data.users);
      } else {
        console.log('No users found or API error:', response);
        setNearbyUsers([]);
      }
    } catch (error) {
      console.error('Load nearby users error:', error);
      setNearbyUsers([]);
    }
  };

  const getLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        await getCurrentLocation();
        startLocationTracking();
      } else {
        console.log('Konum izni verilmedi, harita placeholder modunda çalışacak');
        // İzin verilmediğinde de haritayı göstermeye devam et
        setLocationPermission(false);
      }
    } catch (error) {
      console.error('Konum izni hatası:', error);
      setLocationPermission(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 10000,
        timeout: 15000,
      });
      
      setLocation(location.coords);
      setLocationAccuracy(location.coords.accuracy);
      setLastLocationUpdate(new Date());
      
      // Konum paylaşımı aktifse sunucuya gönder
      if (isLocationSharing) {
        await shareLocationWithServer(location.coords);
      }
    } catch (error) {
      console.error('Konum alınamadı:', error);
      Alert.alert('Konum Hatası', 'Konumunuz alınamadı. Lütfen tekrar deneyin.');
    }
  };

  const locationIntervalRef = useRef(null);

  const startLocationTracking = useCallback(() => {
    if (isTrackingLocation || locationIntervalRef.current) return;
    
    setIsTrackingLocation(true);
    
    // Her 2 saniyede bir konum güncelle (çok hızlı)
    locationIntervalRef.current = setInterval(async () => {
      if (isLocationSharing && locationPermission) {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
            maximumAge: 1000, // 1 saniye - daha güncel veri
            timeout: 2000,    // 2 saniye timeout
          });
          
          // Hız hesapla
          const speed = calculateSpeed(location.coords);
          setCurrentSpeed(speed);
          
          // Önceki konum bilgilerini güncelle
          setLastLocation(location);
          setLastLocationTime(new Date().getTime());
          
          // State güncellemelerini batch'le
          setLocation(location.coords);
          setLocationAccuracy(location.coords.accuracy);
          setLastLocationUpdate(new Date());
          
          await shareLocationWithServer(location.coords);
        } catch (error) {
          console.error('Location tracking error:', error);
          // Hata durumunda tracking'i durdur
          if (error.code === 'E_LOCATION_SERVICES_DISABLED') {
            stopLocationTracking();
          }
        }
      }
        }, 1000); // 1 saniyede bir güncelle - normal hız
  }, [isLocationSharing, locationPermission, isTrackingLocation, shareLocationWithServer]);

  const stopLocationTracking = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    setIsTrackingLocation(false);
  }, []);

  // Uygulama kapanırken konum paylaşımını durdur
  const stopLocationSharingOnExit = useCallback(async () => {
    try {
      console.log('🚪 Stopping location sharing on app exit...');
      
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('No token available for stopping location sharing');
        return;
      }

      apiService.setToken(token);
      
      // Önce kullanıcı profilini al (userId için)
      const profileResponse = await apiService.getProfile();
      const userId = profileResponse.data?.id;
      
      if (userId) {
        // Backend'e kullanıcıyı offline olarak işaretle
        await apiService.setUserOffline(userId);
        
        // Socket ile diğer kullanıcılara offline olduğunu bildir
        if (socketService.isSocketConnected()) {
          socketService.emit('user_offline', {
            userId: userId,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Fallback: sadece konum paylaşımını durdur
        await apiService.stopLocationSharing();
      }
      
      console.log('✅ Location sharing stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping location sharing on exit:', error);
    }
  }, []);

  const shareLocationWithServer = useCallback(async (coords) => {
    try {
      // Konum verisi kontrolü
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        console.warn('Invalid location data:', coords);
        return;
      }

      const token = await apiService.getStoredToken();
      if (!token) {
        console.warn('No auth token available for location sharing');
        return;
      }

      apiService.setToken(token);
      
      // REST API ile konumu kaydet
      const response = await apiService.updateUserLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 0,
        timestamp: new Date().toISOString()
      });

      if (response.success) {
        console.log('Location saved to server:', response.data);
        
        // Socket.io ile diğer kullanıcılara gerçek zamanlı bildir
        if (socketService.isSocketConnected()) {
          socketService.sendLocationUpdate({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Location sharing error:', error);
      // Network hatası durumunda retry mekanizması eklenebilir
      if (error.message.includes('Network request failed')) {
        console.warn('Network error, location will be retried on next update');
      }
    }
  }, []);

  const toggleLocationSharing = async () => {
    if (!locationPermission) {
      Alert.alert('Konum İzni Gerekli', 'Önce konum iznini etkinleştirin.');
      return;
    }

    const newSharingState = !isLocationSharing;
    setIsLocationSharing(newSharingState);

    // Ayarları kaydet
    try {
      // Önce mevcut ayarları al
      const settings = await AsyncStorage.getItem('userSettings');
      const parsedSettings = settings ? JSON.parse(settings) : {};
      
      // Privacy ayarlarını güncelle
      parsedSettings.privacy = {
        ...parsedSettings.privacy,
        showLocation: newSharingState
      };
      
      // Local storage'a kaydet
      await AsyncStorage.setItem('userSettings', JSON.stringify(parsedSettings));
      
      // Sunucuya ayarları gönder
      const token = await apiService.getStoredToken();
      if (token) {
        apiService.setToken(token);
        const response = await apiService.updateSettings(parsedSettings);
        
        if (response.success) {
          console.log('Konum paylaşım ayarı başarıyla güncellendi:', newSharingState);
          
          // Başarılı mesajı göster
          Alert.alert(
            'Başarılı', 
            newSharingState ? 'Konum paylaşımı açıldı' : 'Konum paylaşımı kapatıldı'
          );
        } else {
          console.error('Settings update failed:', response.message);
          Alert.alert('Hata', 'Ayarlar güncellenirken bir hata oluştu');
          
          // Hata durumunda eski duruma geri döndür
          setIsLocationSharing(!newSharingState);
        }
      } else {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        setIsLocationSharing(!newSharingState);
      }
    } catch (error) {
      console.error('Settings save error:', error);
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir hata oluştu');
      
      // Hata durumunda eski duruma geri döndür
      setIsLocationSharing(!newSharingState);
    }

    // Konum paylaşımı açıldıysa ve konum varsa, hemen paylaş
    if (newSharingState && location) {
      await shareLocationWithServer(location);
    }
  };


  const centerOnUserLocation = useCallback(() => {
    if (location && location.latitude && location.longitude && mapRef.current) {
      try {
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      } catch (error) {
        console.error('Error centering map:', error);
      }
    }
  }, [location]);

  const toggleMapType = () => {
    setMapType(mapType === 'standard' ? 'satellite' : 'standard');
  };

  const handleUserLocationUpdate = useCallback((data) => {
    if (!data || !data.userId || !data.location) {
      console.warn('Invalid user location update data:', data);
      return;
    }

    console.log('📍 User location update received:', data);
    console.log('📍 Current location state:', location);

    setNearbyUsers(prevUsers => {
      const existingUserIndex = prevUsers.findIndex(user => user.userId === data.userId);
      
      if (existingUserIndex >= 0) {
        // Kullanıcıyı güncelle
        const updatedUsers = [...prevUsers];
        const existingUser = updatedUsers[existingUserIndex];
        
        // Mesafe hesapla (eğer kendi konumumuz varsa)
        let newDistance = existingUser.distance || 0;
        if (location && location.latitude && location.longitude && data.location && data.location.latitude && data.location.longitude) {
          newDistance = calculateDistance(
            location.latitude, location.longitude,
            parseFloat(data.location.latitude), parseFloat(data.location.longitude)
          );
          console.log(`📍 Updated distance for user ${data.userId}: ${Math.round(newDistance)}m`);
          console.log(`📍 My location: ${location.latitude}, ${location.longitude}`);
          console.log(`📍 Their location: ${data.location.latitude}, ${data.location.longitude}`);
        }
        
        updatedUsers[existingUserIndex] = {
          ...existingUser,
          location: data.location,
          lastSeen: data.timestamp,
          isOnline: true,
          distance: newDistance,
          firstName: data.firstName || existingUser.firstName,
          lastName: data.lastName || existingUser.lastName
        };
        return updatedUsers;
      } else {
        // Yeni kullanıcı ekle
        let newDistance = 0;
        if (location && location.latitude && location.longitude && data.location && data.location.latitude && data.location.longitude) {
          newDistance = calculateDistance(
            location.latitude, location.longitude,
            parseFloat(data.location.latitude), parseFloat(data.location.longitude)
          );
          console.log(`📍 New user ${data.userId} distance: ${Math.round(newDistance)}m`);
        }
        
        return [...prevUsers, {
          userId: data.userId,
          firstName: data.firstName || 'Kullanıcı',
          lastName: data.lastName || '',
          location: data.location,
          lastSeen: data.timestamp,
          isOnline: true,
          distance: newDistance
        }];
      }
    });
  }, [location]);

  // Mesafe hesaplama fonksiyonu
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

  // Hız hesaplama fonksiyonu
  const calculateSpeed = (newLocation) => {
    if (!newLocation || !lastLocation || !lastLocationTime) {
      return 0;
    }

    const now = new Date().getTime();
    const timeDiff = (now - lastLocationTime) / 1000; // saniye cinsinden

    if (timeDiff < 1) {
      return currentSpeed; // Çok hızlı güncelleme, önceki hızı koru
    }

    const distance = calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      newLocation.latitude,
      newLocation.longitude
    );

    if (distance < 1) {
      return 0; // Çok küçük mesafe, hız 0
    }

    const speedMs = distance / timeDiff; // m/s
    const speedKmh = speedMs * 3.6; // km/h

    // Maksimum hız sınırı (300 km/h)
    return Math.min(speedKmh, 300);
  };

  const handleUserJoined = (data) => {
    console.log('User joined:', data);
  };

  const handleUserLeft = (data) => {
    setNearbyUsers(prevUsers => 
      prevUsers.filter(user => user.userId !== data.userId)
    );
  };

  const region = {
    latitude: location?.latitude || 40.9884, // Bağdat Caddesi koordinatları
    longitude: location?.longitude || 29.0255,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };


  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Harita yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Modern Header */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.headerBackground}>
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <Ionicons name="map" size={24} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Harita</Text>
                  <Text style={styles.headerSubtitle}>
                    {location ? 'Konumunuz aktif' : 'Konum alınıyor...'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={[
                    styles.locationToggleButton,
                    isLocationSharing && styles.locationToggleButtonActive
                  ]}
                  onPress={toggleLocationSharing}
                >
                  <Ionicons
                    name={isLocationSharing ? 'location' : 'location-outline'}
                    size={18}
                    color={isLocationSharing ? '#FFFFFF' : colors.primary}
                  />
                </TouchableOpacity>
                
                <View style={styles.statusIndicator}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: isLocationSharing ? colors.success : colors.warning }
                  ]} />
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Map */}
        <View style={styles.map}>
          {Platform.OS === 'ios' ? (
            // iOS: Apple Maps
            <MapView
              ref={mapRef}
              style={styles.mapView}
              provider={PROVIDER_APPLE}
              mapType={mapType}
              initialRegion={region}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
              showsScale={true}
              showsBuildings={true}
              showsTraffic={false}
              showsIndoors={true}
              onRegionChangeComplete={(region) => {
                // Bölge değişikliklerini takip et
              }}
            >
              {/* Kullanıcının kendi konumu */}
              {location && location.latitude && location.longitude && (
                <Marker
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  title="Konumunuz"
                  description={`Doğruluk: ${locationAccuracy ? Math.round(locationAccuracy) : 'N/A'}m`}
                  pinColor={colors.primary}
                >
                  <View style={styles.userMarker}>
                    <Ionicons name="person" size={isTablet ? 24 : 20} color="#FFFFFF" />
                  </View>
                </Marker>
              )}


              {/* Diğer kullanıcıların konumları */}
              {nearbyUsers.map((user, index) => {
                // Sadece geçerli konum verilerine sahip kullanıcıları göster
                if (!user.location || !user.location.latitude || !user.location.longitude) {
                  return null;
                }
                
                console.log(`📍 User ${index} data:`, {
                  userId: user.userId,
                  firstName: user.firstName,
                  first_name: user.first_name,
                  lastName: user.lastName,
                  last_name: user.last_name,
                  location: user.location
                });
                
                return (
                  <Marker
                    key={user.userId}
                    coordinate={{
                      latitude: user.location.latitude,
                      longitude: user.location.longitude,
                    }}
                    title={`${user.firstName || user.first_name || `Kullanıcı ${index + 1}`} ${user.lastName || user.last_name || ''}`}
                    description={`${user.distance ? `${Math.round(user.distance)}m uzaklıkta` : 'Yakında'} • ${user.isOnline ? 'Çevrimiçi' : `Son görülme: ${new Date(user.lastSeen).toLocaleTimeString()}`}`}
                    pinColor={colors.secondary}
                  >
                    <View style={styles.otherUserMarker}>
                      <Ionicons name="person" size={isTablet ? 20 : 16} color="#FFFFFF" />
                    </View>
                  </Marker>
                );
              })}

              {/* Kullanıcının konum doğruluğu için daire */}
              {location && location.latitude && location.longitude && locationAccuracy && (
                <Circle
                  center={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  radius={locationAccuracy}
                  strokeColor={colors.primary + '40'}
                  fillColor={colors.primary + '20'}
                  strokeWidth={2}
                />
              )}
            </MapView>
          ) : (
            // Android: Placeholder
            <View style={[styles.mapView, styles.androidPlaceholder]}>
              <View style={styles.placeholderContent}>
                <Ionicons name="map-outline" size={64} color={colors.primary} />
                <Text style={styles.placeholderTitle}>Harita</Text>
                <Text style={styles.placeholderSubtitle}>
                  {Platform.OS === 'ios' ? 'iOS için harita yükleniyor...' : 'Android için harita özelliği yakında gelecek'}
                </Text>
                <Text style={styles.placeholderInfo}>
                  Konumunuz: {location && location.latitude && location.longitude ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Alınıyor...'}
                </Text>
                <Text style={styles.placeholderInfo}>
                  Yakındaki kullanıcılar: {nearbyUsers.length}
                </Text>
                <TouchableOpacity 
                  style={styles.placeholderButton}
                  onPress={toggleLocationSharing}
                >
                  <Ionicons 
                    name={isLocationSharing ? 'location' : 'location-outline'} 
                    size={20} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.placeholderButtonText}>
                    {isLocationSharing ? 'Konum Paylaşımını Durdur' : 'Konum Paylaşımını Başlat'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Hız Göstergesi - Sol Üst */}
        <View style={styles.speedIndicator}>
          <View style={styles.speedContainer}>
            <Text style={styles.speedValue}>{Math.round(currentSpeed)}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
          <View style={styles.speedStatus}>
            <View style={[
              styles.speedDot,
              { backgroundColor: currentSpeed > 5 ? colors.success : colors.warning }
            ]} />
            <Text style={styles.speedStatusText}>
              {currentSpeed > 5 ? 'Hareket Halinde' : 'Durmakta'}
            </Text>
          </View>
        </View>

        {/* Kontrol Butonları */}
        <Animated.View 
          style={[
            styles.controlButtons,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >

          {/* Konuma Odaklan Butonu */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={centerOnUserLocation}
          >
            <Ionicons name="locate" size={isTablet ? 28 : 24} color={colors.primary} />
          </TouchableOpacity>

          {/* Harita Türü Değiştir Butonu */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleMapType}
          >
            <Ionicons
              name={mapType === 'standard' ? 'map' : 'globe'}
              size={isTablet ? 28 : 24}
              color={colors.primary}
            />
          </TouchableOpacity>

          {/* Kullanıcı Listesi Butonu */}
          <TouchableOpacity
            style={[
              styles.controlButton,
              showUserList && styles.controlButtonActive
            ]}
            onPress={() => {
              const newShowUserList = !showUserList;
              setShowUserList(newShowUserList);
              
              // Eğer liste açılıyorsa ve socket bağlıysa yakındaki kullanıcıları iste
              if (newShowUserList && socketService.isSocketConnected()) {
                console.log('📍 User list opened, requesting nearby users...');
                console.log('📍 Socket connected:', socketService.isSocketConnected());
                socketService.requestNearbyUsers(5000, 100);
              } else if (newShowUserList && !socketService.isSocketConnected()) {
                console.log('⚠️ Socket not connected, trying to connect...');
                socketService.connect();
                // Bağlantı kurulduktan sonra yakındaki kullanıcıları iste
                setTimeout(() => {
                  if (socketService.isSocketConnected()) {
                    console.log('📍 Socket connected, requesting nearby users...');
                    socketService.requestNearbyUsers(5000, 100);
                  }
                }, 2000);
              }
            }}
          >
            <Ionicons name="people" size={isTablet ? 28 : 24} color={showUserList ? '#FFFFFF' : colors.primary} />
            {nearbyUsers.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{nearbyUsers.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Kullanıcı Listesi */}
        {showUserList && (
          <Animated.View 
            style={[
              styles.userList,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.userListContent}>
              <View style={styles.userListHeader}>
                <Text style={styles.userListTitle}>Yakındaki Kullanıcılar</Text>
                <TouchableOpacity onPress={() => setShowUserList(false)}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
              
              {nearbyUsers.length > 0 ? (
                nearbyUsers.map((user, index) => (
                  <View key={user.userId || index} style={styles.userItem}>
                    <View style={styles.userAvatar}>
                      <Ionicons name="person" size={isTablet ? 24 : 20} color="#FFFFFF" />
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>
                        {user.firstName || user.first_name || `Kullanıcı ${index + 1}`} {user.lastName || user.last_name || ''}
                      </Text>
                      <Text style={styles.userLastSeen}>
                        {user.distance ? `${Math.round(user.distance)}m uzaklıkta` : 'Yakında'}
                      </Text>
                      <Text style={styles.userLastSeen}>
                        {user.isOnline ? 'Çevrimiçi' : `Son görülme: ${user.lastSeen ? new Date(user.lastSeen).toLocaleTimeString() : 'Bilinmiyor'}`}
                      </Text>
                    </View>
                    <View style={styles.userStatus}>
                      <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                    </View>
                  </View>
                ))
              ) : (
              <View style={styles.noUsersContainer}>
                <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
                <Text style={styles.noUsersText}>Yakında kullanıcı bulunmuyor</Text>
                <Text style={styles.noUsersSubtext}>
                  Konum paylaşımı: {isLocationSharing ? 'Açık' : 'Kapalı'}
                </Text>
                <Text style={styles.noUsersSubtext}>
                  Socket: {socketService.isSocketConnected() ? 'Bağlı' : 'Bağlı değil'}
                </Text>
                <Text style={styles.noUsersSubtext}>
                  Debug: {nearbyUsers.length} kullanıcı bulundu
                </Text>
              </View>
              )}
            </View>
          </Animated.View>
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: scaleFont(18),
    color: colors.text.secondary,
    marginTop: verticalScale(15),
  },
  map: {
    flex: 1,
  },
  mapView: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24,
  },
  headerBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(20px)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(isTablet ? 24 : 16),
    paddingVertical: verticalScale(isTablet ? 16 : 12),
    minHeight: verticalScale(isTablet ? 70 : 56),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: scale(isTablet ? 44 : 36),
    height: scale(isTablet ? 44 : 36),
    borderRadius: scale(isTablet ? 22 : 18),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(isTablet ? 12 : 10),
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: scaleFont(isTablet ? 20 : 16),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: scaleFont(isTablet ? 12 : 10),
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 1,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationToggleButton: {
    width: scale(isTablet ? 40 : 34),
    height: scale(isTablet ? 40 : 34),
    borderRadius: scale(isTablet ? 20 : 17),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(isTablet ? 10 : 8),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  locationToggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusIndicator: {
    width: scale(isTablet ? 12 : 10),
    height: scale(isTablet ? 12 : 10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: scale(isTablet ? 10 : 8),
    height: scale(isTablet ? 10 : 8),
    borderRadius: scale(isTablet ? 5 : 4),
  },
  speedIndicator: {
    position: 'absolute',
    left: scale(isTablet ? 24 : 16),
    top: Platform.OS === 'ios' ? 44 + verticalScale(isTablet ? 90 : 70) : (StatusBar.currentHeight || 24) + verticalScale(isTablet ? 90 : 70),
    zIndex: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: scale(isTablet ? 16 : 12),
    padding: scale(isTablet ? 16 : 12),
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
    minWidth: scale(isTablet ? 120 : 100),
  },
  speedContainer: {
    alignItems: 'center',
    marginBottom: verticalScale(isTablet ? 8 : 6),
  },
  speedValue: {
    fontSize: scaleFont(isTablet ? 32 : 24),
    fontWeight: '700',
    color: colors.primary,
    lineHeight: scaleFont(isTablet ? 36 : 28),
  },
  speedUnit: {
    fontSize: scaleFont(isTablet ? 14 : 12),
    fontWeight: '500',
    color: colors.text.secondary,
    marginTop: verticalScale(isTablet ? -4 : -2),
  },
  speedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedDot: {
    width: scale(isTablet ? 8 : 6),
    height: scale(isTablet ? 8 : 6),
    borderRadius: scale(isTablet ? 4 : 3),
    marginRight: scale(isTablet ? 6 : 4),
  },
  speedStatusText: {
    fontSize: scaleFont(isTablet ? 12 : 10),
    fontWeight: '500',
    color: colors.text.secondary,
  },
  controlButtons: {
    position: 'absolute',
    right: scale(isTablet ? 24 : 16),
    top: Platform.OS === 'ios' ? 44 + verticalScale(isTablet ? 90 : 70) : (StatusBar.currentHeight || 24) + verticalScale(isTablet ? 90 : 70),
    zIndex: 1000,
  },
  controlButton: {
    width: scale(isTablet ? 60 : 50),
    height: scale(isTablet ? 60 : 50),
    borderRadius: scale(isTablet ? 30 : 25),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(isTablet ? 15 : 10),
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlButtonActive: {
    backgroundColor: colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.warning,
    borderRadius: scale(isTablet ? 12 : 10),
    minWidth: scale(isTablet ? 24 : 20),
    height: scale(isTablet ? 24 : 20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: scaleFont(isTablet ? 14 : 12),
    fontWeight: 'bold',
  },
  userList: {
    position: 'absolute',
    bottom: verticalScale(isTablet ? 40 : 20),
    left: getResponsivePadding(isTablet ? 30 : 20),
    right: getResponsivePadding(isTablet ? 30 : 20),
    maxHeight: verticalScale(isTablet ? 400 : 300),
    zIndex: 1000,
  },
  userListContent: {
    backgroundColor: colors.surface,
    borderRadius: scale(isTablet ? 20 : 15),
    padding: scale(isTablet ? 20 : 15),
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  userListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(isTablet ? 20 : 15),
  },
  userListTitle: {
    fontSize: scaleFont(isTablet ? 22 : 18),
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(isTablet ? 15 : 10),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  userAvatar: {
    width: scale(isTablet ? 50 : 40),
    height: scale(isTablet ? 50 : 40),
    borderRadius: scale(isTablet ? 25 : 20),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(isTablet ? 20 : 15),
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: scaleFont(isTablet ? 20 : 16),
    fontWeight: '600',
    color: colors.text.primary,
  },
  userLastSeen: {
    fontSize: scaleFont(isTablet ? 14 : 12),
    color: colors.text.secondary,
    marginTop: scale(isTablet ? 4 : 2),
  },
  userStatus: {
    alignItems: 'center',
  },
  statusDot: {
    width: scale(isTablet ? 16 : 12),
    height: scale(isTablet ? 16 : 12),
    borderRadius: scale(isTablet ? 8 : 6),
  },
  noUsersContainer: {
    alignItems: 'center',
    paddingVertical: verticalScale(isTablet ? 30 : 20),
  },
  noUsersText: {
    fontSize: scaleFont(isTablet ? 18 : 16),
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: verticalScale(10),
    fontWeight: '600',
  },
  noUsersSubtext: {
    fontSize: scaleFont(isTablet ? 14 : 12),
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: verticalScale(5),
    lineHeight: scaleFont(18),
  },
  userMarker: {
    width: scale(isTablet ? 50 : 40),
    height: scale(isTablet ? 50 : 40),
    borderRadius: scale(isTablet ? 25 : 20),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: isTablet ? 4 : 3,
    borderColor: '#FFFFFF',
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  otherUserMarker: {
    width: scale(isTablet ? 40 : 30),
    height: scale(isTablet ? 40 : 30),
    borderRadius: scale(isTablet ? 20 : 15),
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: isTablet ? 3 : 2,
    borderColor: '#FFFFFF',
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // Android placeholder styles
  androidPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContent: {
    alignItems: 'center',
    paddingHorizontal: getResponsivePadding(40),
  },
  placeholderTitle: {
    fontSize: scaleFont(24),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: verticalScale(20),
    marginBottom: verticalScale(10),
  },
  placeholderSubtitle: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: verticalScale(20),
    lineHeight: scaleFont(22),
  },
  placeholderInfo: {
    fontSize: scaleFont(14),
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: verticalScale(8),
  },
  placeholderButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: getResponsivePadding(24),
    paddingVertical: verticalScale(12),
    borderRadius: scale(25),
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(20),
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  placeholderButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(16),
    fontWeight: '600',
    marginLeft: scale(8),
  },
});
