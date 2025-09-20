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
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api';
import socketService from '../services/socketService';
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

export default function ProfileScreen({ route, navigation }) {
  const { onLogout } = route.params || {};
  const stackNavigation = useNavigation();
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
    profile_picture: '',
    is_verified: false,
    email_verified: false,
  });
  const [editData, setEditData] = useState({});
  const [userStats, setUserStats] = useState({
    friends: 0,
    messages: 0,
    photos: 0
  });
  const [activities, setActivities] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);


  const menuItems = [
    {
      id: '1',
      title: 'Profil Ayarları',
      icon: 'person-outline',
      color: colors.primary,
      onPress: () => stackNavigation.navigate('Settings'),
    },
    {
      id: '2',
      title: 'Abonelik Planım',
      icon: 'diamond-outline',
      color: colors.secondary,
      onPress: () => Alert.alert('Abonelik Planım', 'Şu anda ücretsiz plandasınız.\n\nPremium özellikler yakında eklenecek.'),
    },
    {
      id: '3',
      title: 'Güvenlik',
      icon: 'shield-outline',
      color: colors.accent,
      onPress: () => Alert.alert('Güvenlik', 'Şifre değiştirme ve güvenlik seçenekleri yakında eklenecek.'),
    },
    {
      id: '4',
      title: 'Yardım & Destek',
      icon: 'help-circle-outline',
      color: colors.info,
      onPress: () => Alert.alert('Yardım & Destek', 'Sorularınız için:\n\n📧 Email: destek@caddate.com\n\nYakında canlı destek eklenecek.'),
    },
    {
      id: '5',
      title: 'Hakkında',
      icon: 'information-circle-outline',
      color: colors.primary,
      onPress: () => Alert.alert('Hakkında', 'Caddate v1.0.0\nBağdat Caddesi\'nin sosyal uygulaması'),
    },
  ];

  // Profil bilgilerini yükle
  useEffect(() => {
    loadProfile();
    loadUserStats();
    loadActivities();
    loadFriends();

    // Socket bağlantısını başlat
    socketService.connect();

    // İstatistikleri her 30 saniyede bir güncelle
    const statsInterval = setInterval(() => {
      loadUserStats();
    }, 30000);

    return () => {
      clearInterval(statsInterval);
      // Socket event listener'larını temizle
      socketService.off('new_activity');
      socketService.off('activities_list');
    };
  }, []);

  // Ekran focus olduğunda istatistikleri yenile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserStats();
      loadActivities();
    });

    return unsubscribe;
  }, [navigation]);

  // Socket event listener'ları
  useEffect(() => {
    // Yeni aktivite geldiğinde
    const handleNewActivity = (activity) => {
      console.log('Yeni aktivite alındı:', activity);
      setActivities(prevActivities => [activity, ...prevActivities.slice(0, 4)]); // Son 5 aktiviteyi tut
      
      // Bildirim göster
      setNotificationMessage(activity.title);
      setShowNotification(true);
      
      // 3 saniye sonra bildirimi gizle
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    };

    // Aktivite listesi geldiğinde
    const handleActivitiesList = (activitiesList) => {
      console.log('Aktivite listesi alındı:', activitiesList);
      setActivities(activitiesList);
    };

    // Event listener'ları ekle
    socketService.on('new_activity', handleNewActivity);
    socketService.on('activities_list', handleActivitiesList);

    return () => {
      // Cleanup
      socketService.off('new_activity', handleNewActivity);
      socketService.off('activities_list', handleActivitiesList);
    };
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

  const loadUserStats = async () => {
    try {
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('No token found for stats loading');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      console.log('Loading user stats...');
      const response = await apiService.getUserStats();
      
      if (response.success) {
        console.log('User stats loaded successfully:', response.data);
        setUserStats(response.data);
      } else {
        console.error('Failed to load user stats:', response.message);
      }
    } catch (error) {
      console.error('User stats load error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      // İstatistik yükleme hatası kritik değil, sessizce devam et
      // Ancak varsayılan değerleri kullan
      setUserStats({
        friends: 0,
        messages: 0,
        photos: 0
      });
    }
  };

  const loadActivities = async () => {
    try {
      console.log('Loading activities...');
      // Socket üzerinden aktivite listesini iste
      socketService.requestActivities();
    } catch (error) {
      console.error('Activities load error:', error);
      // Hata durumunda boş liste kullan
      setActivities([]);
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

  const formatActivityTime = (timestamp) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Az önce';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} dk önce`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} saat önce`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} gün önce`;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'message':
        return 'chatbubble';
      case 'photo':
        return 'heart';
      case 'friend_request':
        return 'person-add';
      case 'like':
        return 'thumbs-up';
      default:
        return 'notifications';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'message':
        return colors.secondary;
      case 'photo':
        return colors.primary;
      case 'friend_request':
        return colors.accent;
      case 'like':
        return colors.success;
      default:
        return colors.text.secondary;
    }
  };

  // Email doğrulama kodu gönder
  const sendEmailVerification = async () => {
    try {
      setIsVerifyingEmail(true);
      
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      const response = await apiService.sendVerificationCode(userInfo.email, 'email_verification');
      
      if (response.success) {
        setShowVerificationModal(true);
        Alert.alert('Başarılı', 'Doğrulama kodu e-posta adresinize gönderildi');
      } else {
        Alert.alert('Hata', response.message || 'Doğrulama kodu gönderilemedi');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      Alert.alert('Hata', error.message || 'Doğrulama kodu gönderilirken bir hata oluştu');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  // Email doğrulama kodunu doğrula
  const verifyEmailCode = async () => {
    try {
      if (!verificationCode.trim()) {
        Alert.alert('Hata', 'Lütfen doğrulama kodunu girin');
        return;
      }

      setIsVerifyingEmail(true);
      
      const response = await apiService.verifyCode(userInfo.email, verificationCode, 'email_verification');
      
      if (response.success) {
        setShowVerificationModal(false);
        setVerificationCode('');
        
        // Kullanıcı bilgilerini güncelle
        setUserInfo({...userInfo, email_verified: true, is_verified: true});
        
        Alert.alert('Başarılı', 'E-posta adresiniz başarıyla doğrulandı');
      } else {
        Alert.alert('Hata', response.message || 'Doğrulama kodu hatalı');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      Alert.alert('Hata', error.message || 'Doğrulama sırasında bir hata oluştu');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  // Arkadaş listesini yükle
  const loadFriends = async () => {
    try {
      setIsLoadingFriends(true);
      
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('No token found for friends loading');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      const response = await apiService.getFriends();
      
      if (response.success) {
        setFriends(response.data);
      } else {
        console.error('Failed to load friends:', response.message);
      }
    } catch (error) {
      console.error('Friends load error:', error);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // Arkadaş çıkar
  const removeFriend = async (friendId, friendName) => {
    Alert.alert(
      'Arkadaş Çıkar',
      `${friendName} arkadaş listenizden çıkarılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.removeFriend(friendId);
              
              if (response.success) {
                // Arkadaş listesini güncelle
                setFriends(friends.filter(friend => friend.id !== friendId));
                // İstatistikleri güncelle
                setUserStats(prev => ({...prev, friends: prev.friends - 1}));
                Alert.alert('Başarılı', 'Arkadaş listeden çıkarıldı');
              } else {
                Alert.alert('Hata', response.message || 'Arkadaş çıkarılırken bir hata oluştu');
              }
            } catch (error) {
              console.error('Remove friend error:', error);
              Alert.alert('Hata', error.message || 'Arkadaş çıkarılırken bir hata oluştu');
            }
          }
        }
      ]
    );
  };


  const renderStat = (stat, index) => (
    <TouchableOpacity 
      key={index} 
      style={styles.statCard}
      onPress={() => {
        if (stat.label === 'Arkadaş') {
          setShowFriendsModal(true);
        } else {
          Alert.alert('Bilgi', `${stat.label} detayları yakında eklenecek`);
        }
      }}
    >
      <Ionicons name={stat.icon} size={24} color={colors.primary} />
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
    </TouchableOpacity>
  );

  // İstatistikler ve hızlı erişim verileri - gerçek verilerle
  const stats = [
    { label: 'Arkadaş', value: userStats.friends.toString(), icon: 'people' },
    { label: 'Mesaj', value: userStats.messages.toString(), icon: 'chatbubbles' },
    { label: 'Fotoğraf', value: userStats.photos.toString(), icon: 'camera' },
  ];

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
              {activities.length > 0 ? (
                activities.map((activity, index) => (
                  <View key={activity.id || index} style={styles.activityItem}>
                    <Ionicons 
                      name={getActivityIcon(activity.type)} 
                      size={20} 
                      color={getActivityColor(activity.type)} 
                    />
                    <Text style={styles.activityText}>{activity.title}</Text>
                    <Text style={styles.activityTime}>{formatActivityTime(activity.timestamp)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.noActivityContainer}>
                  <Ionicons name="time-outline" size={24} color={colors.text.tertiary} />
                  <Text style={styles.noActivityText}>Henüz aktivite bulunmuyor</Text>
                </View>
              )}
            </View>
          </View>


          {/* Profile Form - Modern Design */}
          <View style={styles.formContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <Ionicons name="person-circle" size={24} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Profil Bilgileri</Text>
            </View>
            
            {/* Personal Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
                <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
              </View>
              
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="person" size={16} color={colors.text.secondary} />
                    <Text style={styles.label}>Ad</Text>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={styles.modernInput}
                      value={editData.first_name || ''}
                      onChangeText={(text) => setEditData({...editData, first_name: text})}
                      placeholder="Adınız"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  ) : (
                    <View style={styles.valueContainer}>
                      <Text style={styles.value}>{userInfo.first_name || 'Belirtilmemiş'}</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="person" size={16} color={colors.text.secondary} />
                    <Text style={styles.label}>Soyad</Text>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={styles.modernInput}
                      value={editData.last_name || ''}
                      onChangeText={(text) => setEditData({...editData, last_name: text})}
                      placeholder="Soyadınız"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  ) : (
                    <View style={styles.valueContainer}>
                      <Text style={styles.value}>{userInfo.last_name || 'Belirtilmemiş'}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Contact Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="mail-outline" size={20} color={colors.secondary} />
                <Text style={styles.cardTitle}>İletişim Bilgileri</Text>
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name="mail" size={16} color={colors.text.secondary} />
                  <Text style={styles.label}>E-posta</Text>
                </View>
                <View style={styles.valueContainer}>
                  <Text style={styles.value}>{userInfo.email}</Text>
                  {userInfo.email_verified ? (
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.verifiedIcon} />
                  ) : (
                    <TouchableOpacity 
                      style={styles.verifyButton}
                      onPress={sendEmailVerification}
                      disabled={isVerifyingEmail}
                    >
                      <Ionicons 
                        name="mail-unread" 
                        size={16} 
                        color={colors.warning} 
                        style={styles.verifyIcon} 
                      />
                      <Text style={styles.verifyText}>
                        {isVerifyingEmail ? 'Gönderiliyor...' : 'Doğrula'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

            </View>

            {/* Personal Details Card */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                <Text style={styles.cardTitle}>Kişisel Detaylar</Text>
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name="calendar" size={16} color={colors.text.secondary} />
                  <Text style={styles.label}>Doğum Tarihi</Text>
                </View>
                {isEditing ? (
                  <TextInput
                    style={styles.modernInput}
                    value={editData.birth_date || ''}
                    onChangeText={(text) => setEditData({...editData, birth_date: text})}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text.tertiary}
                  />
                ) : (
                  <View style={styles.valueContainer}>
                    <Text style={styles.value}>
                      {userInfo.birth_date ? 
                        userInfo.birth_date.split('T')[0].split('-').reverse().join('/') : 
                        'Belirtilmemiş'
                      }
                    </Text>
                    {userInfo.birth_date && (
                      <Text style={styles.ageText}>({calculateAge(userInfo.birth_date)} yaşında)</Text>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name="male-female" size={16} color={colors.text.secondary} />
                  <Text style={styles.label}>Cinsiyet</Text>
                </View>
                {isEditing ? (
                  <View style={styles.genderContainer}>
                    {[
                      { value: 'male', label: 'Erkek', icon: 'male' },
                      { value: 'female', label: 'Kadın', icon: 'female' },
                      { value: 'other', label: 'Diğer', icon: 'transgender' }
                    ].map((gender) => (
                      <TouchableOpacity
                        key={gender.value}
                        style={[
                          styles.genderOption,
                          editData.gender === gender.value && styles.genderOptionSelected
                        ]}
                        onPress={() => setEditData({...editData, gender: gender.value})}
                      >
                        <Ionicons 
                          name={gender.icon} 
                          size={18} 
                          color={editData.gender === gender.value ? '#FFFFFF' : colors.text.secondary} 
                        />
                        <Text style={[
                          styles.genderText,
                          editData.gender === gender.value && styles.genderTextSelected
                        ]}>
                          {gender.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.valueContainer}>
                    <Ionicons 
                      name={userInfo.gender === 'male' ? 'male' : userInfo.gender === 'female' ? 'female' : 'transgender'} 
                      size={16} 
                      color={colors.primary} 
                    />
                    <Text style={styles.value}>
                      {userInfo.gender === 'male' ? 'Erkek' : 
                       userInfo.gender === 'female' ? 'Kadın' : 
                       userInfo.gender === 'other' ? 'Diğer' : userInfo.gender || 'Belirtilmemiş'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {isEditing && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}
                  disabled={isLoading}
                >
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>
                    {isLoading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancel}
                  disabled={isLoading}
                >
                  <Ionicons name="close" size={20} color={colors.text.secondary} />
                  <Text style={styles.cancelButtonText}>İptal</Text>
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

        {/* Email Doğrulama Modal */}
        <Modal
          visible={showVerificationModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowVerificationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.verificationModalContent}>
              <Text style={styles.verificationModalTitle}>E-posta Doğrulama</Text>
              <Text style={styles.verificationModalSubtitle}>
                {userInfo.email} adresine gönderilen doğrulama kodunu girin
              </Text>
              
              <TextInput
                style={styles.verificationInput}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Doğrulama kodu"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus={true}
              />
              
              <View style={styles.verificationButtonContainer}>
                <TouchableOpacity
                  style={[styles.verificationButton, styles.cancelVerificationButton]}
                  onPress={() => {
                    setShowVerificationModal(false);
                    setVerificationCode('');
                  }}
                >
                  <Text style={styles.cancelVerificationButtonText}>İptal</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.verificationButton, styles.confirmVerificationButton]}
                  onPress={verifyEmailCode}
                  disabled={isVerifyingEmail || !verificationCode.trim()}
                >
                  <Text style={styles.confirmVerificationButtonText}>
                    {isVerifyingEmail ? 'Doğrulanıyor...' : 'Doğrula'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Arkadaş Listesi Modal */}
        <Modal
          visible={showFriendsModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowFriendsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.friendsModalContent}>
              <View style={styles.friendsModalHeader}>
                <Text style={styles.friendsModalTitle}>Arkadaşlarım</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowFriendsModal(false)}
                >
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              
              {isLoadingFriends ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Arkadaşlar yükleniyor...</Text>
                </View>
              ) : friends.length > 0 ? (
                <ScrollView style={styles.friendsList}>
                  {friends.map((friend) => (
                    <View key={friend.id} style={styles.friendItem}>
                      <Image
                        source={{ 
                          uri: friend.profile_picture || 'https://via.placeholder.com/50x50/cccccc/666666?text=Profil' 
                        }}
                        style={styles.friendAvatar}
                      />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <Text style={styles.friendEmail}>{friend.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeFriendButton}
                        onPress={() => removeFriend(friend.id, friend.name)}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.warning} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.noFriendsContainer}>
                  <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
                  <Text style={styles.noFriendsText}>Henüz arkadaşınız yok</Text>
                  <Text style={styles.noFriendsSubtext}>Yeni arkadaşlar ekleyerek sosyal ağınızı genişletin</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Notification Toast */}
        {showNotification && (
          <View style={styles.notificationContainer}>
            <View style={styles.notificationContent}>
              <Ionicons name="notifications" size={20} color="#FFFFFF" />
              <Text style={styles.notificationText}>{notificationMessage}</Text>
            </View>
          </View>
        )}
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
    marginHorizontal: getResponsivePadding(20),
    marginTop: verticalScale(30),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(20),
    paddingHorizontal: getResponsivePadding(5),
  },
  sectionIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: scale(16),
    padding: getResponsivePadding(20),
    marginBottom: verticalScale(16),
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border.light + '20',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    paddingBottom: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light + '30',
  },
  cardTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: colors.text.primary,
    marginLeft: scale(8),
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputGroup: {
    marginBottom: verticalScale(16),
  },
  halfWidth: {
    width: '48%',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  label: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: colors.text.secondary,
    marginLeft: scale(6),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modernInput: {
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: scale(12),
    paddingHorizontal: getResponsivePadding(16),
    paddingVertical: verticalScale(14),
    fontSize: scaleFont(15),
    backgroundColor: colors.background,
    color: colors.text.primary,
    fontFamily: 'System',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: getResponsivePadding(4),
  },
  value: {
    fontSize: scaleFont(15),
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  verifiedIcon: {
    marginLeft: scale(8),
  },
  ageText: {
    fontSize: scaleFont(13),
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginLeft: scale(8),
  },
  buttonContainer: {
    marginTop: verticalScale(24),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(14),
    borderRadius: scale(12),
    flex: 1,
    marginHorizontal: scale(4),
  },
  saveButton: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border.light,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(15),
    fontWeight: '700',
    marginLeft: scale(8),
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontSize: scaleFont(15),
    fontWeight: '600',
    marginLeft: scale(8),
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
    marginTop: verticalScale(8),
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: getResponsivePadding(12),
    marginHorizontal: scale(4),
    borderRadius: scale(12),
    borderWidth: 1.5,
    borderColor: colors.border.light,
    backgroundColor: colors.background,
  },
  genderOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  genderText: {
    fontSize: scaleFont(13),
    color: colors.text.secondary,
    fontWeight: '600',
    marginLeft: scale(6),
  },
  genderTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  // Aktivite stilleri
  noActivityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(20),
  },
  noActivityText: {
    fontSize: scaleFont(14),
    color: colors.text.tertiary,
    marginLeft: scale(10),
    fontStyle: 'italic',
  },
  // Bildirim stilleri
  notificationContainer: {
    position: 'absolute',
    top: isAndroid ? StatusBar.currentHeight + scale(20) : scale(60),
    left: scale(20),
    right: scale(20),
    zIndex: 1000,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: getResponsivePadding(15),
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: scaleFont(14),
    fontWeight: '500',
    marginLeft: scale(10),
    flex: 1,
  },
  // Doğrulama butonları
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  verifyIcon: {
    marginRight: scale(4),
  },
  verifyText: {
    fontSize: scaleFont(12),
    color: colors.warning,
    fontWeight: '600',
  },
  // Doğrulama modal stilleri
  verificationModalContent: {
    backgroundColor: colors.surface,
    borderRadius: scale(20),
    padding: getResponsivePadding(25),
    width: screenWidth * 0.9,
    maxWidth: scale(350),
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  verificationModalTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: verticalScale(10),
  },
  verificationModalSubtitle: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: verticalScale(20),
    lineHeight: scaleFont(20),
  },
  verificationInput: {
    borderWidth: 2,
    borderColor: colors.border.light,
    borderRadius: scale(12),
    paddingHorizontal: getResponsivePadding(16),
    paddingVertical: verticalScale(14),
    fontSize: scaleFont(18),
    textAlign: 'center',
    backgroundColor: colors.background,
    color: colors.text.primary,
    marginBottom: verticalScale(20),
    letterSpacing: scale(2),
  },
  verificationButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  verificationButton: {
    flex: 1,
    paddingVertical: verticalScale(12),
    borderRadius: scale(12),
    marginHorizontal: scale(4),
  },
  cancelVerificationButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  confirmVerificationButton: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelVerificationButtonText: {
    color: colors.text.secondary,
    fontSize: scaleFont(15),
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmVerificationButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(15),
    fontWeight: '700',
    textAlign: 'center',
  },
  // Arkadaş listesi modal stilleri
  friendsModalContent: {
    backgroundColor: colors.surface,
    borderRadius: scale(20),
    padding: getResponsivePadding(20),
    width: screenWidth * 0.95,
    maxHeight: screenHeight * 0.8,
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  friendsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(20),
    paddingBottom: verticalScale(15),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light + '30',
  },
  friendsModalTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  closeButton: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: colors.background,
  },
  friendsList: {
    maxHeight: screenHeight * 0.6,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: getResponsivePadding(15),
    backgroundColor: colors.background,
    borderRadius: scale(12),
    marginBottom: verticalScale(8),
    shadowColor: colors.shadow.light,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  friendAvatar: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    marginRight: scale(15),
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: verticalScale(2),
  },
  friendEmail: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
  },
  removeFriendButton: {
    padding: scale(8),
    borderRadius: scale(8),
    backgroundColor: colors.warning + '20',
  },
  noFriendsContainer: {
    alignItems: 'center',
    paddingVertical: verticalScale(40),
  },
  noFriendsText: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: verticalScale(15),
    marginBottom: verticalScale(8),
  },
  noFriendsSubtext: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: scaleFont(20),
  },
});