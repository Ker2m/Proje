import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { 
  scale, 
  verticalScale, 
  moderateScale, 
  scaleFont, 
  getResponsivePadding, 
  getResponsiveFontSize,
  isIOS,
  isAndroid,
  isTablet,
  isSmallScreen,
  isLargeScreen,
  getStatusBarHeight,
  getBottomSafeArea,
  getMinTouchTarget,
  getPlatformShadow,
  getGridColumns
} from '../utils/responsive';
import { colors } from '../constants/colors';
import apiService from '../services/api';
import socketService from '../services/socketService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PhotoScreen() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Component mount olduğunda fotoğrafları yükle
  useEffect(() => {
    loadPhotos();
    setupSocketListeners();
    loadCurrentUser();
    
    return () => {
      // Cleanup socket listeners
      socketService.off('new_photo', handleNewPhoto);
      socketService.off('photo_like_updated', handlePhotoLikeUpdated);
    };
  }, []);

  // Tab değiştiğinde fotoğrafları yeniden yükle - artık sadece feed var
  useEffect(() => {
    loadPhotos();
  }, []);

  // Socket event listeners
  const setupSocketListeners = () => {
    socketService.on('new_photo', handleNewPhoto);
    socketService.on('photo_like_updated', handlePhotoLikeUpdated);
  };

  // Yeni fotoğraf geldiğinde
  const handleNewPhoto = (data) => {
    console.log('New photo received:', data);
    // Yeni fotoğrafı yükle
    loadPhotos();
  };

  // Fotoğraf beğenisi güncellendiğinde
  const handlePhotoLikeUpdated = (data) => {
    console.log('Photo like updated:', data);
    setPhotos(prevPhotos => 
      prevPhotos.map(photo => 
        photo.id === data.photoId 
          ? { ...photo, likes: data.liked ? photo.likes + 1 : Math.max(0, photo.likes - 1) }
          : photo
      )
    );
  };

  // Fotoğrafları yükle
  const loadPhotos = async () => {
    try {
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('Token bulunamadı, fotoğraflar yüklenemiyor');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      setLoading(true);
      const endpoint = '/photos/feed';
      const response = await apiService.get(endpoint);
      
      if (response.success) {
        setPhotos(response.data.photos || []);
      } else {
        Alert.alert('Hata', 'Fotoğraflar yüklenirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Load photos error:', error);
      Alert.alert('Hata', 'Fotoğraflar yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  };

  // Mevcut kullanıcı bilgisini yükle
  const loadCurrentUser = async () => {
    try {
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('Token bulunamadı, kullanıcı bilgisi yüklenemiyor');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      const response = await apiService.getProfile();
      if (response.success) {
        setCurrentUserId(response.data.user.id);
        console.log('Current user ID loaded:', response.data.user.id);
      }
    } catch (error) {
      console.error('Load current user error:', error);
      // Fallback olarak token'dan user ID'yi al
      try {
        const token = await apiService.getStoredToken();
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setCurrentUserId(payload.userId);
          console.log('Current user ID from token:', payload.userId);
        }
      } catch (tokenError) {
        console.error('Token parse error:', tokenError);
      }
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri iznine ihtiyacımız var.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });

    if (!result.canceled) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera iznine ihtiyacımız var.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });

    if (!result.canceled) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  // Fotoğraf yükleme fonksiyonu
  const uploadPhoto = async (uri) => {
    try {
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      setUploading(true);
      
      const formData = new FormData();
      formData.append('photo', {
        uri: uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      formData.append('caption', '');

      const response = await apiService.post('/photos/upload', formData);

      if (response.success) {
        // Socket ile yeni fotoğrafı bildir
        socketService.emit('photo_shared', {
          photoId: response.data.photo.id,
          timestamp: new Date().toISOString()
        });
        
        // Fotoğraf yükleme için aktivite oluştur
        socketService.createActivity(
          'photo',
          'Fotoğraf paylaşıldı',
          'Yeni fotoğraf paylaştınız',
          { 
            photoId: response.data.photo.id,
            hasCaption: false,
            captionLength: 0
          }
        );
        
        // Fotoğrafları yeniden yükle
        await loadPhotos();
        
        Alert.alert('Başarılı', 'Fotoğraf başarıyla yüklendi');
      } else {
        Alert.alert('Hata', 'Fotoğraf yüklenirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Upload photo error:', error);
      Alert.alert('Hata', 'Fotoğraf yüklenirken bir hata oluştu');
    } finally {
      setUploading(false);
    }
  };

  // Fotoğraf beğenme fonksiyonu
  const likePhoto = async (photoId) => {
    try {
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      const response = await apiService.post(`/photos/${photoId}/like`);
      
      if (response.success) {
        // Socket ile beğeniyi bildir
        socketService.emit('photo_liked', {
          photoId: photoId,
          liked: response.liked,
          timestamp: new Date().toISOString()
        });
        
        // Fotoğraf beğenme için aktivite oluştur
        if (response.liked) {
          socketService.createActivity(
            'like',
            'Fotoğraf beğenildi',
            'Bir fotoğrafı beğendiniz',
            { photoId: photoId, action: 'liked' }
          );
        }
        
        // Local state'i güncelle
        setPhotos(prevPhotos => 
          prevPhotos.map(photo => 
            photo.id === photoId 
              ? { 
                  ...photo, 
                  likes: response.liked ? photo.likes + 1 : Math.max(0, photo.likes - 1),
                  isLiked: response.liked
                }
              : photo
          )
        );
      }
    } catch (error) {
      console.error('Like photo error:', error);
      Alert.alert('Hata', 'Beğeni işlemi sırasında bir hata oluştu');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Fotoğraf Ekle',
      'Nasıl fotoğraf eklemek istiyorsunuz?',
      [
        { text: 'Kameradan Çek', onPress: takePhoto },
        { text: 'Galeriden Seç', onPress: pickImage },
        { text: 'İptal', style: 'cancel' },
      ]
    );
  };


  const showPhotoOptions = (photo) => {
    console.log('Photo options for:', photo);
    console.log('Current user ID:', currentUserId);
    console.log('Photo user ID:', photo.user_id);
    console.log('Photo user name:', photo.user);
    
    // Sadece kendi fotoğraflarında sil seçeneği göster
    const isMyPhoto = photo.user_id === currentUserId;
    
    console.log('Is my photo:', isMyPhoto);
    
    const options = [];
    
    if (isMyPhoto) {
      options.push(
        { text: 'Sil', onPress: () => deletePhoto(photo), style: 'destructive' }
      );
    } else {
      options.push(
        { text: 'Bilgi', onPress: () => Alert.alert('Bilgi', 'Bu fotoğrafı silemezsiniz') }
      );
    }
    
    options.push({ text: 'İptal', style: 'cancel' });
    
    Alert.alert(
      'Fotoğraf Seçenekleri',
      'Ne yapmak istiyorsunuz?',
      options
    );
  };


  const deletePhoto = async (photo) => {
    Alert.alert(
      'Fotoğrafı Sil',
      'Bu fotoğrafı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Token'ı kontrol et
              const token = await apiService.getStoredToken();
              if (!token) {
                Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
                return;
              }
              
              // Token'ı API servisine set et
              apiService.setToken(token);
              
              const response = await apiService.delete(`/photos/${photo.id}`);
              if (response.success) {
                Alert.alert('Başarılı', 'Fotoğraf silindi');
                await loadPhotos(); // Fotoğrafları yeniden yükle
              } else {
                Alert.alert('Hata', 'Fotoğraf silinirken bir hata oluştu');
              }
            } catch (error) {
              console.error('Delete photo error:', error);
              Alert.alert('Hata', 'Fotoğraf silinirken bir hata oluştu');
            }
          }
        }
      ]
    );
  };

  const renderPhoto = ({ item }) => {
    return (
      <View style={styles.photoCard}>
        <Image source={{ uri: item.uri }} style={styles.photo} />
        <View style={styles.photoOverlay}>
          <View style={styles.photoHeader}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                {item.profile_picture ? (
                  <Image source={{ uri: item.profile_picture }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={scale(16)} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{item.user}</Text>
                <Text style={styles.photoTime}>{item.time}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.moreButton}
              onPress={() => showPhotoOptions(item)}
            >
              <Ionicons name="ellipsis-horizontal" size={scale(20)} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.photoFooter}>
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={scale(14)} color="#FFFFFF" />
              <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
            </View>
            
            <View style={styles.actions}>
              <TouchableOpacity 
                style={[styles.actionButton, item.isLiked && styles.likedButton]}
                onPress={() => likePhoto(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={item.isLiked ? "heart" : "heart-outline"} 
                  size={scale(18)} 
                  color={item.isLiked ? "#FF6B6B" : "#FFFFFF"} 
                />
                <Text style={[styles.actionText, item.isLiked && styles.likedText]}>
                  {item.likes || 0}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                <Ionicons name="chatbubble-outline" size={scale(18)} color="#FFFFFF" />
                <Text style={styles.actionText}>{item.comments || 0}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                <Ionicons name="share-outline" size={scale(18)} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={isIOS ? "light-content" : "light-content"}
        backgroundColor={isAndroid ? colors.primary : "transparent"}
        translucent={isAndroid}
      />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <LinearGradient
          colors={colors.gradients.redBlack}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Fotoğraflar</Text>
          <TouchableOpacity style={styles.addButton} onPress={showImageOptions}>
            <Ionicons name="add" size={scale(24)} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>


        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fotoğraflar yükleniyor...</Text>
          </View>
        ) : (
          <FlatList
            data={photos}
            renderItem={renderPhoto}
            keyExtractor={item => item.id.toString()}
            numColumns={2}
            contentContainerStyle={styles.photosGrid}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
                title="Yenileniyor..."
                titleColor={colors.text.secondary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="camera-outline" size={scale(80)} color={colors.text.secondary} />
                </View>
                <Text style={styles.emptyText}>
                  Henüz fotoğraf paylaşılmamış
                </Text>
                <Text style={styles.emptySubText}>
                  İlk fotoğrafı siz paylaşarak başlayın! 📸
                </Text>
                <TouchableOpacity 
                  style={styles.emptyActionButton}
                  onPress={showImageOptions}
                >
                  <Ionicons name="camera" size={scale(20)} color="#FFFFFF" />
                  <Text style={styles.emptyActionText}>Fotoğraf Paylaş</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        {/* Floating Action Button */}
        <TouchableOpacity 
          style={[styles.fab, uploading && styles.fabDisabled]} 
          onPress={showImageOptions}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="camera" size={scale(24)} color="#FFFFFF" />
          )}
        </TouchableOpacity>


      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: isAndroid ? getStatusBarHeight() : 0,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(isIOS ? 20 : 16),
    paddingTop: isAndroid ? verticalScale(10) : verticalScale(20),
  },
  headerTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: isIOS ? '700' : 'bold',
    color: colors.text.primary,
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  addButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: getMinTouchTarget(),
    minHeight: getMinTouchTarget(),
    ...getPlatformShadow(2),
  },
  photosGrid: {
    padding: scale(8),
    paddingBottom: getBottomSafeArea() + verticalScale(100),
  },
  photoCard: {
    flex: 1,
    margin: scale(4),
    borderRadius: scale(20),
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...getPlatformShadow(4),
    borderWidth: 0,
    elevation: 6,
  },
  photo: {
    width: '100%',
    height: verticalScale(isTablet ? 280 : 220),
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'space-between',
    padding: scale(12),
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: scale(isTablet ? 40 : 32),
    height: scale(isTablet ? 40 : 32),
    borderRadius: scale(isTablet ? 20 : 16),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(8),
    ...getPlatformShadow(2),
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: isIOS ? '700' : 'bold',
    color: '#FFFFFF',
    fontFamily: isIOS ? 'System' : 'Roboto',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  photoTime: {
    fontSize: getResponsiveFontSize(12),
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: isIOS ? 'System' : 'Roboto',
    marginTop: scale(2),
  },
  moreButton: {
    padding: scale(5),
    minWidth: getMinTouchTarget(),
    minHeight: getMinTouchTarget(),
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(8),
  },
  locationText: {
    fontSize: getResponsiveFontSize(11),
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: scale(4),
    fontFamily: isIOS ? 'System' : 'Roboto',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scale(12),
    padding: scale(6),
    minWidth: getMinTouchTarget(),
    minHeight: getMinTouchTarget(),
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: scale(15),
  },
  likedButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  actionText: {
    fontSize: getResponsiveFontSize(12),
    color: '#FFFFFF',
    marginLeft: scale(4),
    fontFamily: isIOS ? 'System' : 'Roboto',
    fontWeight: isIOS ? '600' : '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  likedText: {
    color: '#FF6B6B',
  },
  fab: {
    position: 'absolute',
    bottom: verticalScale(20) + getBottomSafeArea(),
    right: scale(20),
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...getPlatformShadow(4),
  },
  fabDisabled: {
    backgroundColor: colors.text.secondary,
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(50),
  },
  loadingText: {
    fontSize: getResponsiveFontSize(16),
    color: colors.text.secondary,
    marginTop: verticalScale(10),
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(80),
    paddingHorizontal: getResponsivePadding(40),
  },
  emptyIconContainer: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  emptyText: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: isIOS ? '700' : 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: verticalScale(8),
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  emptySubText: {
    fontSize: getResponsiveFontSize(16),
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: verticalScale(30),
    fontFamily: isIOS ? 'System' : 'Roboto',
    lineHeight: getResponsiveFontSize(22),
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(12),
    borderRadius: scale(25),
    ...getPlatformShadow(3),
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: getResponsiveFontSize(16),
    fontWeight: isIOS ? '600' : '500',
    marginLeft: scale(8),
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: scale(isTablet ? 18 : 15),
  },
});
