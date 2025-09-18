import React, { useState, useEffect } from 'react';
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
} from 'react-native';
// import MapView, { Marker } from 'expo-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '../constants/colors';
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
  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);

  useEffect(() => {
    getLocationPermission();
  }, []);

  const getLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        getCurrentLocation();
      } else {
        Alert.alert(
          'Konum İzni Gerekli',
          'Uygulamanın düzgün çalışması için konum iznine ihtiyacı var.',
          [{ text: 'Tamam' }]
        );
      }
    } catch (error) {
      console.error('Konum izni hatası:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);
    } catch (error) {
      console.error('Konum alınamadı:', error);
    }
  };

  const toggleLocationSharing = () => {
    if (!locationPermission) {
      Alert.alert('Konum İzni Gerekli', 'Önce konum iznini etkinleştirin.');
      return;
    }
    setIsLocationSharing(!isLocationSharing);
    // Burada gerçek konum paylaşımı işlemi yapılacak
  };

  const region = {
    latitude: location?.latitude || 40.9884, // Bağdat Caddesi koordinatları
    longitude: location?.longitude || 29.0255,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };


  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(255, 107, 107, 0.9)', 'rgba(255, 142, 142, 0.9)']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Harita</Text>
          <TouchableOpacity
            style={[
              styles.locationButton,
              isLocationSharing && styles.locationButtonActive
            ]}
            onPress={toggleLocationSharing}
          >
            <Ionicons
              name={isLocationSharing ? 'location' : 'location-outline'}
              size={24}
              color={isLocationSharing ? '#FFFFFF' : '#FF6B6B'}
            />
            <Text style={[
              styles.locationButtonText,
              isLocationSharing && styles.locationButtonTextActive
            ]}>
              {isLocationSharing ? 'Konum Paylaşılıyor' : 'Konum Paylaş'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Map Placeholder */}
        <View style={styles.map}>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={60} color="#8E8E93" />
            <Text style={styles.mapPlaceholderText}>Harita Yükleniyor...</Text>
            <Text style={styles.mapPlaceholderSubtext}>
              Konum: {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Konum alınıyor...'}
            </Text>
          </View>
        </View>

        {/* Alt Panel */}
        <View style={styles.bottomPanel}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.9)']}
            style={styles.panelContent}
          >
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="people" size={24} color="#FF6B6B" />
                <Text style={styles.statNumber}>{nearbyUsers.length}</Text>
                <Text style={styles.statLabel}>Yakındaki Kullanıcı</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="chatbubbles" size={24} color="#4ECDC4" />
                <Text style={styles.statNumber}>12</Text>
                <Text style={styles.statLabel}>Aktif Sohbet</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="camera" size={24} color="#45B7D1" />
                <Text style={styles.statNumber}>8</Text>
                <Text style={styles.statLabel}>Yeni Fotoğraf</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  locationButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  locationButtonText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  locationButtonTextActive: {
    color: '#FFFFFF',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 15,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 5,
    textAlign: 'center',
  },
  userMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  otherUserMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flex: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
});
