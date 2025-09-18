import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  StatusBar,
  TextInput,
  Dimensions,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api';
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
  isLargeScreen,
  getBottomSafeArea
} from '../utils/responsive';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const bottomSafeArea = getBottomSafeArea();

export default function ProfileScreen({ onLogout, navigation }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [userInfo, setUserInfo] = useState({
    first_name: '',
    last_name: '',
    email: '',
    birth_date: '',
    gender: '',
    phone: '',
    profile_picture: '',
  });
  const [editData, setEditData] = useState({});

  // İstatistikler ve hızlı erişim verileri
  const stats = [
    { label: 'Arkadaş', value: '24', icon: 'people' },
    { label: 'Mesaj', value: '156', icon: 'chatbubbles' },
    { label: 'Fotoğraf', value: '89', icon: 'camera' },
  ];


  const menuItems = [
    {
      id: '1',
      title: 'Profil Ayarları',
      icon: 'person-outline',
      color: colors.primary,
      onPress: () => Alert.alert('Bilgi', 'Profil ayarları yakında eklenecek'),
    },
    {
      id: '2',
      title: 'Abonelik Planım',
      icon: 'diamond-outline',
      color: colors.secondary,
      onPress: () => Alert.alert('Bilgi', 'Abonelik planları yakında eklenecek'),
    },
    {
      id: '3',
      title: 'Güvenlik',
      icon: 'shield-outline',
      color: colors.accent,
      onPress: () => Alert.alert('Bilgi', 'Güvenlik ayarları yakında eklenecek'),
    },
    {
      id: '4',
      title: 'Bildirimler',
      icon: 'notifications-outline',
      color: colors.success,
      onPress: () => Alert.alert('Bilgi', 'Bildirim ayarları yakında eklenecek'),
    },
    {
      id: '5',
      title: 'Gizlilik',
      icon: 'lock-closed-outline',
      color: colors.warning,
      onPress: () => Alert.alert('Bilgi', 'Gizlilik ayarları yakında eklenecek'),
    },
    {
      id: '6',
      title: 'Yardım & Destek',
      icon: 'help-circle-outline',
      color: colors.info,
      onPress: () => Alert.alert('Bilgi', 'Yardım ve destek yakında eklenecek'),
    },
    {
      id: '7',
      title: 'Hakkında',
      icon: 'information-circle-outline',
      color: colors.primary,
      onPress: () => Alert.alert('Hakkında', 'Caddate v1.0.0\nBağdat Caddesi\'nin sosyal uygulaması'),
    },
  ];

  // Profil bilgilerini yükle
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        if (onLogout) {
          onLogout();
        }
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      const response = await apiService.getProfile();
      
      if (response.success) {
        setUserInfo(response.data.user);
        setEditData(response.data.user);
      }
    } catch (error) {
      console.error('Profile load error:', error);
      
      // Hata mesajını daha detaylı göster
      let errorMessage = 'Profil bilgileri yüklenirken bir hata oluştu';
      
      if (error.message.includes('deaktif')) {
        errorMessage = 'Hesabınız deaktif durumda. Lütfen yönetici ile iletişime geçin.';
      } else if (error.message.includes('Sunucuya bağlanılamıyor')) {
        errorMessage = 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.';
      } else if (error.message.includes('Token süresi dolmuş') || error.message.includes('Erişim token')) {
        errorMessage = 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
        // Token süresi dolmuşsa çıkış yap
        apiService.clearToken();
        if (onLogout) {
          onLogout();
        }
        return;
      }
      
      Alert.alert('Hata', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditData({ ...userInfo });
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.updateProfile(editData);
      
      if (response.success) {
        setUserInfo(response.data.user);
        setIsEditing(false);
        Alert.alert('Başarılı', 'Profil başarıyla güncellendi');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Hata', error.message || 'Profil güncellenirken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({ ...userInfo });
  };

  const handleImagePicker = () => {
    setShowImagePicker(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        await uploadProfilePicture(imageUri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu');
    } finally {
      setShowImagePicker(false);
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        await uploadProfilePicture(imageUri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Hata', 'Fotoğraf çekilirken bir hata oluştu');
    } finally {
      setShowImagePicker(false);
    }
  };

  const uploadProfilePicture = async (imageUri) => {
    try {
      setIsUploading(true);
      
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      // FormData oluştur
      const formData = new FormData();
      formData.append('profile_picture', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });

      console.log('Uploading profile picture...');
      console.log('Image URI:', imageUri);
      console.log('Token:', token);
      console.log('FormData keys:', Object.keys(formData));
      
      const response = await apiService.uploadProfilePicture(formData);
      
      console.log('Upload response:', response);
      
      if (response.success) {
        console.log('Profile picture URL:', response.data.profile_picture);
        console.log('User info before update:', userInfo);
        
        // State'i güncelle
        const newUserInfo = { ...userInfo, profile_picture: response.data.profile_picture };
        const newEditData = { ...editData, profile_picture: response.data.profile_picture };
        
        setUserInfo(newUserInfo);
        setEditData(newEditData);
        
        console.log('User info after update:', newUserInfo);
        Alert.alert('Başarılı', 'Profil fotoğrafı güncellendi');
      } else {
        Alert.alert('Hata', response.message || 'Fotoğraf yüklenirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      Alert.alert('Hata', error.message || 'Fotoğraf yüklenirken bir hata oluştu');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkış Yap', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await apiService.logout();
              apiService.clearToken();
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('Logout error:', error);
              // Hata olsa bile çıkış yap
              apiService.clearToken();
              if (onLogout) {
                onLogout();
              }
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Hesabı Sil', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await apiService.deleteAccount();
              apiService.clearToken();
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('Delete account error:', error);
              Alert.alert('Hata', error.message || 'Hesap silinirken bir hata oluştu');
            }
          }
        }
      ]
    );
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };


  const renderStat = (stat, index) => (
    <View key={index} style={styles.statCard}>
      <Ionicons name={stat.icon} size={24} color={colors.primary} />
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
    </View>
  );

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={item.onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={24} color={colors.text.primary} />
      </View>
      <Text style={styles.menuTitle}>{item.title}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
    </View>
  );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <LinearGradient
            colors={colors.gradients.primary}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={isEditing ? handleCancel : handleEdit}
              >
                <Ionicons 
                  name={isEditing ? "close" : "create-outline"} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.profileImageContainer}
                onPress={isEditing ? handleImagePicker : null}
                onLongPress={() => setShowImagePreview(true)}
                disabled={!isEditing && !userInfo.profile_picture}
              >
                <Image
                  source={{ 
                    uri: userInfo.profile_picture || 'https://via.placeholder.com/120x120/cccccc/666666?text=Profil' 
                  }}
                  style={styles.profileImage}
                  onError={(error) => {
                    console.log('Image load error:', error);
                  }}
                />
                {isEditing && (
                  <View style={styles.imageEditOverlay}>
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                  </View>
                )}
                {isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.settingsButton}
                onPress={() => navigation.navigate('Settings')}
              >
                <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {userInfo.first_name} {userInfo.last_name}
              </Text>
              <Text style={styles.userAge}>
                {calculateAge(userInfo.birth_date)} yaşında
              </Text>
              <Text style={styles.userEmail}>{userInfo.email}</Text>
            </View>
          </LinearGradient>

          {/* Stats */}
          <View style={styles.statsContainer}>
            {stats.map(renderStat)}
          </View>


          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Son Aktiviteler</Text>
            <View style={styles.activityCard}>
              <View style={styles.activityItem}>
                <Ionicons name="chatbubble" size={20} color={colors.secondary} />
                <Text style={styles.activityText}>Yeni mesaj aldın</Text>
                <Text style={styles.activityTime}>2 dk önce</Text>
              </View>
              <View style={styles.activityItem}>
                <Ionicons name="heart" size={20} color={colors.primary} />
                <Text style={styles.activityText}>Fotoğrafın beğenildi</Text>
                <Text style={styles.activityTime}>15 dk önce</Text>
              </View>
              <View style={styles.activityItem}>
                <Ionicons name="person-add" size={20} color={colors.accent} />
                <Text style={styles.activityText}>Yeni arkadaş eklendi</Text>
                <Text style={styles.activityTime}>1 saat önce</Text>
              </View>
            </View>
          </View>


          {/* Profile Form */}
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Profil Bilgileri</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ad</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editData.first_name || ''}
                  onChangeText={(text) => setEditData({...editData, first_name: text})}
                  placeholder="Adınız"
                />
              ) : (
                <Text style={styles.value}>{userInfo.first_name}</Text>
              )}
              </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Soyad</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editData.last_name || ''}
                  onChangeText={(text) => setEditData({...editData, last_name: text})}
                  placeholder="Soyadınız"
                />
              ) : (
                <Text style={styles.value}>{userInfo.last_name}</Text>
              )}
          </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>E-posta</Text>
              <Text style={styles.value}>{userInfo.email}</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Doğum Tarihi</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editData.birth_date || ''}
                  onChangeText={(text) => setEditData({...editData, birth_date: text})}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <Text style={styles.value}>{userInfo.birth_date}</Text>
              )}
          </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cinsiyet</Text>
              {isEditing ? (
                <View style={styles.genderContainer}>
                  {['male', 'female', 'other'].map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={[
                        styles.genderOption,
                        editData.gender === gender && styles.genderOptionSelected
                      ]}
                      onPress={() => setEditData({...editData, gender})}
                    >
                      <Text style={[
                        styles.genderText,
                        editData.gender === gender && styles.genderTextSelected
                      ]}>
                        {gender === 'male' ? 'Erkek' : gender === 'female' ? 'Kadın' : 'Diğer'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.value}>
                  {userInfo.gender === 'male' ? 'Erkek' : 
                   userInfo.gender === 'female' ? 'Kadın' : 
                   userInfo.gender === 'other' ? 'Diğer' : userInfo.gender}
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Telefon</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editData.phone || ''}
                  onChangeText={(text) => setEditData({...editData, phone: text})}
                  placeholder="Telefon numarası"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.value}>{userInfo.phone || 'Belirtilmemiş'}</Text>
              )}
          </View>

            {isEditing && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>
                    {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
              <Text style={styles.logoutText}>Çıkış Yap</Text>
            </TouchableOpacity>

                <TouchableOpacity 
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={20} color="#FF4444" />
              <Text style={[styles.actionText, styles.deleteText]}>Hesabı Sil</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
        </SafeAreaView>

        {/* Image Picker Modal */}
        <Modal
          visible={showImagePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowImagePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Profil Fotoğrafı Seç</Text>
              
              <TouchableOpacity style={styles.modalOption} onPress={pickImage}>
                <Ionicons name="image-outline" size={24} color={colors.primary} />
                <Text style={styles.modalOptionText}>Galeriden Seç</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.modalOptionText}>Fotoğraf Çek</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalCancel} 
                onPress={() => setShowImagePicker(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Image Preview Modal */}
        <Modal
          visible={showImagePreview}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowImagePreview(false)}
        >
          <View style={styles.imagePreviewOverlay}>
            <TouchableOpacity 
              style={styles.imagePreviewCloseButton}
              onPress={() => setShowImagePreview(false)}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Image
              source={{ 
                uri: userInfo.profile_picture || 'https://via.placeholder.com/400x400/cccccc/666666?text=Profil' 
              }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          </View>
        </Modal>
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
    paddingTop: isAndroid ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    paddingBottom: bottomSafeArea + scale(90), // Alt navbar için boşluk
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
  },
  header: {
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(30),
    paddingTop: isAndroid ? verticalScale(20) : verticalScale(40),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(20),
    backgroundColor: colors.surface,
    marginHorizontal: getResponsivePadding(20),
    marginTop: verticalScale(-20),
    borderRadius: scale(15),
    shadowColor: colors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: scaleFont(isTablet ? 24 : 20),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: verticalScale(5),
  },
  statLabel: {
    fontSize: scaleFont(12),
    color: colors.text.secondary,
    marginTop: verticalScale(2),
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: getResponsivePadding(20),
    marginTop: verticalScale(30),
  },
  sectionTitle: {
    fontSize: scaleFont(isTablet ? 24 : 20),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(15),
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: scale(15),
    padding: getResponsivePadding(20),
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  activityText: {
    flex: 1,
    fontSize: scaleFont(14),
    color: colors.text.primary,
    marginLeft: scale(15),
  },
  activityTime: {
    fontSize: scaleFont(12),
    color: colors.text.tertiary,
  },
  editButton: {
    padding: scale(10),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsButton: {
    padding: scale(10),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileImageContainer: {
    alignItems: 'center',
  },
  profileImage: {
    width: scale(isTablet ? 120 : 100),
    height: scale(isTablet ? 120 : 100),
    borderRadius: scale(isTablet ? 60 : 50),
    borderWidth: scale(4),
    borderColor: '#FFFFFF',
  },
  userInfo: {
    alignItems: 'center',
    paddingHorizontal: getResponsivePadding(20),
    marginTop: verticalScale(20),
  },
  userName: {
    fontSize: scaleFont(isTablet ? 28 : 24),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: verticalScale(5),
  },
  userAge: {
    fontSize: scaleFont(16),
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: verticalScale(5),
  },
  userEmail: {
    fontSize: scaleFont(14),
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: getResponsivePadding(20),
    marginTop: verticalScale(30),
    padding: getResponsivePadding(20),
    borderRadius: scale(15),
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: verticalScale(15),
  },
  label: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: verticalScale(5),
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: scale(8),
    padding: getResponsivePadding(12),
    fontSize: scaleFont(16),
    backgroundColor: colors.background,
    color: colors.text.primary,
  },
  value: {
    fontSize: scaleFont(16),
    color: colors.text.primary,
    paddingVertical: verticalScale(12),
  },
  buttonContainer: {
    marginTop: verticalScale(20),
  },
  button: {
    padding: getResponsivePadding(15),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  actionsContainer: {
    paddingHorizontal: getResponsivePadding(20),
    paddingBottom: verticalScale(20),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: getResponsivePadding(15),
    borderRadius: scale(8),
    marginBottom: verticalScale(10),
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutButton: {
    borderWidth: 2,
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  actionText: {
    marginLeft: scale(8),
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: colors.primary,
  },
  logoutText: {
    marginLeft: scale(8),
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#FF6B6B',
  },
  deleteText: {
    color: '#FF4444',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(15),
    borderRadius: scale(15),
    marginBottom: verticalScale(10),
    shadowColor: colors.shadow.light,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  menuIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(15),
  },
  menuTitle: {
    flex: 1,
    fontSize: scaleFont(16),
    color: colors.text.primary,
  },
  // Profil fotoğrafı stilleri
  imageEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: scale(15),
    width: scale(30),
    height: scale(30),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: scale(isTablet ? 60 : 50),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Cinsiyet seçimi stilleri
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(5),
  },
  genderOption: {
    flex: 1,
    paddingVertical: verticalScale(12),
    paddingHorizontal: getResponsivePadding(15),
    marginHorizontal: scale(5),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  genderOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderText: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
    fontWeight: '500',
  },
  genderTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Modal stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: scale(20),
    padding: getResponsivePadding(25),
    width: screenWidth * 0.8,
    maxWidth: scale(300),
  },
  modalTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: verticalScale(20),
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(15),
    paddingHorizontal: getResponsivePadding(20),
    borderRadius: scale(12),
    backgroundColor: colors.background,
    marginBottom: verticalScale(10),
  },
  modalOptionText: {
    fontSize: scaleFont(16),
    color: colors.text.primary,
    marginLeft: scale(15),
    fontWeight: '500',
  },
  modalCancel: {
    paddingVertical: verticalScale(15),
    alignItems: 'center',
    marginTop: verticalScale(10),
  },
  modalCancelText: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    fontWeight: '500',
  },
  // Image Preview Modal stilleri
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewCloseButton: {
    position: 'absolute',
    top: isAndroid ? StatusBar.currentHeight + scale(20) : scale(50),
    right: scale(20),
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: scale(20),
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.7,
    maxWidth: scale(400),
    maxHeight: scale(600),
  },
});