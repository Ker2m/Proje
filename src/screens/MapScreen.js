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
  
  // Animasyon değerleri
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        await initializeMap();
        if (isMounted) {
          initializeSocket();
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      stopLocationTracking();
      socketService.removeAllListeners();
    };
  }, []);

  // Ekran focus olduğunda ayarları yenile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('MapScreen focused, reloading settings...');
      loadLocationSettings();
      loadNearbyUsers();
    });

    return unsubscribe;
  }, [navigation]);

  // Socket.io bağlantısı kurulduğunda yakındaki kullanıcıları iste
  useEffect(() => {
    if (isLocationSharing && socketService.isSocketConnected()) {
      // Socket.io ile yakındaki kullanıcıları anında iste
      socketService.requestNearbyUsers(5000, 100);
    }
  }, [isLocationSharing, socketService.isSocketConnected()]);

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
    // Socket event listener'larını ayarla
    socketService.onUserLocationUpdate = handleUserLocationUpdate;
    socketService.onUserJoined = handleUserJoined;
    socketService.onUserLeft = handleUserLeft;
    
    // Socket bağlantısını başlat
    socketService.connect();

    // Socket event listener'ları ekle - ANLIK GÜNCELLEMELER
    socketService.on('user_location_update', (data) => {
      console.log('Real-time location update received:', data);
      handleUserLocationUpdate(data);
    });
    
    socketService.on('nearby_users_list', (data) => {
      console.log('Real-time nearby users list received:', data);
      if (data.users) {
        setNearbyUsers(data.users);
      }
    });

    // Socket bağlantısı kurulduğunda yakındaki kullanıcıları iste
    socketService.on('connect', () => {
      console.log('Socket connected, requesting nearby users...');
      if (isLocationSharing) {
        socketService.requestNearbyUsers(5000, 100);
      }
    });
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
      
      if (response.success && response.data.users) {
        console.log('Nearby users loaded:', response.data.users.length);
        setNearbyUsers(response.data.users);
      }
    } catch (error) {
      console.error('Load nearby users error:', error);
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
            maximumAge: 2000,
            timeout: 3000,
          });
          
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
    }, 2000); // 2 saniyede bir güncelle
  }, [isLocationSharing, locationPermission, isTrackingLocation, shareLocationWithServer]);

  const stopLocationTracking = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    setIsTrackingLocation(false);
  }, []);

  const shareLocationWithServer = useCallback(async (coords) => {
    try {
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
        accuracy: coords.accuracy,
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
    if (location && mapRef.current) {
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

    console.log('User location update received:', data);

    setNearbyUsers(prevUsers => {
      const existingUserIndex = prevUsers.findIndex(user => user.userId === data.userId);
      
      if (existingUserIndex >= 0) {
        // Kullanıcıyı güncelle
        const updatedUsers = [...prevUsers];
        updatedUsers[existingUserIndex] = {
          ...updatedUsers[existingUserIndex],
          location: data.location,
          lastSeen: data.timestamp,
          isOnline: true
        };
        return updatedUsers;
      } else {
        // Yeni kullanıcı ekle
        return [...prevUsers, {
          userId: data.userId,
          location: data.location,
          lastSeen: data.timestamp,
          isOnline: true
        }];
      }
    });
  }, []);

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
              {location && (
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
                
                return (
                  <Marker
                    key={user.userId}
                    coordinate={{
                      latitude: user.location.latitude,
                      longitude: user.location.longitude,
                    }}
                    title={`Kullanıcı ${index + 1}`}
                    description={`Son görülme: ${new Date(user.lastSeen).toLocaleTimeString()}`}
                    pinColor={colors.secondary}
                  >
                    <View style={styles.otherUserMarker}>
                      <Ionicons name="person" size={isTablet ? 20 : 16} color="#FFFFFF" />
                    </View>
                  </Marker>
                );
              })}

              {/* Kullanıcının konum doğruluğu için daire */}
              {location && locationAccuracy && (
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
                  Konumunuz: {location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Alınıyor...'}
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
            onPress={() => setShowUserList(!showUserList)}
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
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)']}
              style={styles.userListContent}
            >
              <View style={styles.userListHeader}>
                <Text style={styles.userListTitle}>Yakındaki Kullanıcılar</Text>
                <TouchableOpacity onPress={() => setShowUserList(false)}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
              
              {nearbyUsers.length > 0 ? (
                nearbyUsers.map((user, index) => (
                  <View key={user.userId} style={styles.userItem}>
                      <View style={styles.userAvatar}>
                        <Ionicons name="person" size={isTablet ? 24 : 20} color="#FFFFFF" />
                      </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>Kullanıcı {index + 1}</Text>
                      <Text style={styles.userLastSeen}>
                        Son görülme: {new Date(user.lastSeen).toLocaleTimeString()}
                      </Text>
                    </View>
                    <View style={styles.userStatus}>
                      <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noUsersText}>Yakında kullanıcı bulunmuyor</Text>
              )}
            </LinearGradient>
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
    borderRadius: scale(isTablet ? 20 : 15),
    padding: scale(isTablet ? 20 : 15),
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  noUsersText: {
    fontSize: scaleFont(isTablet ? 20 : 16),
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: verticalScale(isTablet ? 30 : 20),
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
