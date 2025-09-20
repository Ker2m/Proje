import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { colors } from '../constants/colors';
import socketService from '../services/socketService';
import apiService from '../services/api';
import { 
  scale, 
  verticalScale, 
  scaleFont, 
  getResponsivePadding, 
  isIOS,
  isAndroid,
  isTablet,
  getBottomSafeArea
} from '../utils/responsive';

const { width: screenWidth } = Dimensions.get('window');
const bottomSafeArea = getBottomSafeArea();

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState({
    notifications: true,
    locationSharing: false,
    soundEnabled: true,
    vibrationEnabled: true,
    emailNotifications: true,
    privacy: {
      profileVisibility: 'public',
      showOnlineStatus: true,
      allowMessages: true,
      showLocation: false
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  // Socket.io entegrasyonu
  useEffect(() => {
    initializeSocket();
    loadSettings();
    initializeNotifications();
    
    return () => {
      // Cleanup
      socketService.removeAllListeners();
    };
  }, []);

  // Bildirimleri başlat
  const initializeNotifications = async () => {
    try {
      // Bildirim izinlerini kontrol et
      const { status } = await Notifications.getPermissionsAsync();
      
      if (status !== 'granted') {
        // İzin iste
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('Bildirim izni verilmedi');
          return;
        }
      }

      // Bildirim handler'ını ayarla
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: settings.soundEnabled,
          shouldSetBadge: true,
        }),
      });

      console.log('Bildirimler başlatıldı');
    } catch (error) {
      console.error('Bildirim başlatma hatası:', error);
    }
  };

  // Socket bağlantısını başlat
  const initializeSocket = async () => {
    try {
      // Socket event listener'larını ayarla
      socketService.onSettingsUpdate = handleSettingsUpdateFromServer;
      socketService.onNotification = handleNotificationFromServer;
      socketService.onUserStatusUpdate = handleUserStatusUpdateFromServer;
      
      // Socket'e bağlan
      await socketService.connect();
      
      // Bağlantı durumunu kontrol et
      const isConnected = socketService.isSocketConnected();
      setSocketConnected(isConnected);
      
      // Bağlantı durumunu periyodik olarak kontrol et
      const connectionCheckInterval = setInterval(() => {
        const connected = socketService.isSocketConnected();
        setSocketConnected(connected);
      }, 5000);
      
      return () => clearInterval(connectionCheckInterval);
    } catch (error) {
      console.error('Socket initialization error:', error);
    }
  };

  // Sunucudan gelen ayar güncellemelerini işle
  const handleSettingsUpdateFromServer = (data) => {
    console.log('Settings updated from server:', data);
    
    if (data.settings) {
      const { settings } = data;
      
      // State'i güncelle
      if (settings.notifications !== undefined) setNotifications(settings.notifications);
      if (settings.locationSharing !== undefined) setLocationSharing(settings.locationSharing);
      if (settings.emailNotifications !== undefined) setEmailNotifications(settings.emailNotifications);
      if (settings.pushNotifications !== undefined) setPushNotifications(settings.pushNotifications);
      if (settings.soundEnabled !== undefined) setSoundEnabled(settings.soundEnabled);
      if (settings.vibrationEnabled !== undefined) setVibrationEnabled(settings.vibrationEnabled);
      
      // Local storage'ı güncelle
      saveSettingsToLocal(settings);
      
      setLastSync(new Date().toLocaleTimeString());
      
      Alert.alert('Ayarlar Güncellendi', 'Ayarlarınız başka bir cihazdan güncellendi');
    }
  };

  // Sunucudan gelen bildirimleri işle
  const handleNotificationFromServer = (data) => {
    console.log('Notification from server:', data);
    
    if (settings.notifications) {
      // Bildirim göster
      Notifications.scheduleNotificationAsync({
        content: {
          title: data.title || 'Caddate',
          body: data.message || 'Yeni bildirim',
          sound: settings.soundEnabled ? true : false,
        },
        trigger: null, // Hemen göster
      });
    }
  };

  // Kullanıcı durumu güncellemelerini işle
  const handleUserStatusUpdateFromServer = (data) => {
    console.log('User status update from server:', data);
    // Burada kullanıcı durumu güncellemelerini işleyebilirsiniz
  };

  // Ayarları yükle
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        throw new Error('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      // Backend'den ayarları al
      const response = await apiService.getSettings();
      
      if (response.success) {
        setSettings(response.data.settings);
        setLastSync(new Date().toLocaleTimeString());
      } else {
        throw new Error(response.message || 'Ayarlar yüklenirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Settings load error:', error);
      setError(error.message);
      
      // Hata durumunda local storage'dan yükle
      try {
        const localSettings = await AsyncStorage.getItem('userSettings');
        if (localSettings) {
          const parsedSettings = JSON.parse(localSettings);
          setSettings(parsedSettings);
        }
      } catch (localError) {
        console.error('Local settings load error:', localError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Ayarları local storage'a kaydet
  const saveSettingsToLocal = async (settings) => {
    try {
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
      console.log('Settings saved to local storage:', settings);
    } catch (error) {
      console.error('Local storage save error:', error);
    }
  };

  // Ayarları kaydet (hem local hem server)
  const saveSettings = async (newSettings) => {
    try {
      setIsSaving(true);
      setError(null);
      
      const updatedSettings = {
        ...settings,
        ...newSettings
      };
      
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        throw new Error('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      // Backend'e gönder
      const response = await apiService.updateSettings(updatedSettings);
      
      if (response.success) {
        // State'i güncelle
        setSettings(updatedSettings);
        
        // Local storage'a kaydet
        await saveSettingsToLocal(updatedSettings);
        
        // Bildirim ayarlarını uygula
        await applyNotificationSettings(updatedSettings);
        
        setLastSync(new Date().toLocaleTimeString());
        console.log('Settings saved:', updatedSettings);
        
        Alert.alert('Başarılı', 'Ayarlar başarıyla kaydedildi');
      } else {
        throw new Error(response.message || 'Ayarlar kaydedilirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Settings save error:', error);
      setError(error.message);
      Alert.alert('Hata', error.message || 'Ayarlar kaydedilirken bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  // Bildirim ayarlarını uygula
  const applyNotificationSettings = async (settings) => {
    try {
      if (settings.pushNotifications) {
        // Bildirim izni iste
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Bildirim İzni', 'Bildirimler için izin verilmedi. Ayarlardan manuel olarak açabilirsiniz.');
          return;
        }

        // Bildirim ayarlarını yapılandır
        await Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: settings.soundEnabled,
            shouldSetBadge: true,
          }),
        });
      }
    } catch (error) {
      console.error('Notification settings error:', error);
    }
  };

  // Test bildirimi gönder
  const sendTestNotification = async () => {
    try {
      if (!settings.notifications) {
        Alert.alert('Bilgi', 'Push bildirimleri kapalı. Önce bildirimleri açın.');
        return;
      }

      // Bildirim izinlerini kontrol et
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Bildirim İzni', 'Bildirimler için izin verilmedi. Lütfen ayarlardan bildirim izinlerini açın.');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Caddate Test Bildirimi",
          body: "Bildirim ayarlarınız çalışıyor! 🎉",
          sound: settings.soundEnabled ? true : false,
        },
        trigger: { seconds: 1 },
      });

      Alert.alert('Başarılı', 'Test bildirimi gönderildi!');
    } catch (error) {
      console.error('Test notification error:', error);
      Alert.alert('Hata', 'Test bildirimi gönderilemedi: ' + error.message);
    }
  };

  // Profil ayarlarına git
  const goToProfileSettings = () => {
    navigation.navigate('Profile');
  };

  // Gizlilik ayarlarını göster
  const showPrivacySettings = () => {
    Alert.alert(
      'Gizlilik Ayarları',
      'Profil görünürlüğü ve diğer gizlilik ayarlarını buradan yönetebilirsiniz.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Ayarları Aç', 
          onPress: () => {
            // Gizlilik ayarları modal'ını aç
            setShowPrivacyModal(true);
          }
        }
      ]
    );
  };

  // Güvenlik ayarlarını göster
  const showSecuritySettings = () => {
    navigation.navigate('Security');
  };

  // Abonelik planını göster
  const showSubscriptionPlan = () => {
    Alert.alert(
      'Abonelik Planım',
      'Şu anda ücretsiz plandasınız.\n\nPremium özellikler yakında eklenecek.',
      [
        { text: 'Tamam', style: 'default' }
      ]
    );
  };

  // Yardım ve destek
  const showHelpSupport = () => {
    Alert.alert(
      'Yardım & Destek',
      'Sorularınız için:\n\n📧 Email: destek@caddate.com\n\nYakında canlı destek eklenecek.',
      [
        { text: 'Tamam', style: 'default' }
      ]
    );
  };

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const menuItems = [
    {
      id: '1',
      title: 'Abonelik Planım',
      icon: 'diamond-outline',
      color: colors.secondary,
      onPress: showSubscriptionPlan,
    },
    {
      id: '2',
      title: 'Güvenlik',
      icon: 'shield-outline',
      color: colors.accent,
      onPress: showSecuritySettings,
    },
    {
      id: '3',
      title: 'Yardım & Destek',
      icon: 'help-circle-outline',
      color: colors.info,
      onPress: showHelpSupport,
    },
    {
      id: '4',
      title: 'Hakkında',
      icon: 'information-circle-outline',
      color: colors.primary,
      onPress: () => Alert.alert('Hakkında', 'Caddate v1.0.0\nBağdat Caddesi\'nin sosyal uygulaması'),
    },
    {
      id: '5',
      title: 'Bildirim Testi',
      icon: 'notifications',
      color: colors.success,
      onPress: () => sendTestNotification(),
    },
    {
      id: '6',
      title: 'Socket Durumu',
      icon: socketConnected ? 'wifi' : 'wifi-off',
      color: socketConnected ? colors.success : colors.warning,
      onPress: () => Alert.alert(
        'Socket Durumu', 
        `Bağlantı: ${socketConnected ? 'Aktif' : 'Pasif'}\nSon Senkronizasyon: ${lastSync || 'Henüz yok'}`
      ),
    },
  ];

  const renderSettingItem = (icon, title, value, onValueChange, color = colors.primary) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => {
          onValueChange(newValue);
          // Otomatik kaydet - field mapping'i düzelt
          const fieldMap = {
            'Bildirimler': 'notifications',
            'Profil Görünürlüğü': 'privacy',
            'Online Durumu Göster': 'privacy',
            'Mesaj Alma İzni': 'privacy',
            'Konum Göster': 'privacy'
          };
          
          const fieldName = fieldMap[title] || title.toLowerCase().replace(/\s+/g, '');
          
          if (fieldName === 'privacy') {
            // Privacy ayarları için özel işlem
            const privacyField = title === 'Profil Görünürlüğü' ? 'profileVisibility' :
                                title === 'Online Durumu Göster' ? 'showOnlineStatus' :
                                title === 'Mesaj Alma İzni' ? 'allowMessages' :
                                title === 'Konum Göster' ? 'showLocation' : null;
            
            if (privacyField) {
              saveSettings({
                privacy: {
                  ...settings.privacy,
                  [privacyField]: newValue
                }
              });
            }
          } else {
            saveSettings({ [fieldName]: newValue });
          }
        }}
        trackColor={{ false: colors.border.light, true: color }}
        thumbColor={value ? colors.text.primary : colors.text.primary}
        disabled={isSaving}
      />
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
        <Text style={styles.loadingText}>Ayarlar yükleniyor...</Text>
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
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              
               <Text style={styles.headerTitle}>Ayarlar</Text>
               
               <View style={styles.headerRight}>
                 <View style={[
                   styles.connectionIndicator, 
                   { backgroundColor: socketConnected ? colors.success : colors.warning }
                 ]}>
                   <Ionicons 
                     name={socketConnected ? 'wifi' : 'wifi-off'} 
                     size={16} 
                     color="#FFFFFF" 
                   />
                 </View>
               </View>
            </View>
          </LinearGradient>

          {/* Hata mesajı */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Bildirim Ayarları */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bildirim Ayarları</Text>
            
            {renderSettingItem(
              'notifications',
              'Bildirimler',
              settings.notifications,
              (value) => setSettings({...settings, notifications: value}),
              colors.success
            )}
          </View>

          {/* Gizlilik Ayarları */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gizlilik Ayarları</Text>
            
            {renderSettingItem(
              'eye',
              'Profil Görünürlüğü',
              settings.privacy.profileVisibility === 'public',
              (value) => setSettings({
                ...settings, 
                privacy: {
                  ...settings.privacy, 
                  profileVisibility: value ? 'public' : 'private'
                }
              }),
              colors.warning
            )}

            {renderSettingItem(
              'wifi',
              'Online Durumu Göster',
              settings.privacy.showOnlineStatus,
              (value) => setSettings({
                ...settings, 
                privacy: {
                  ...settings.privacy, 
                  showOnlineStatus: value
                }
              }),
              colors.info
            )}

            {renderSettingItem(
              'chatbubble',
              'Mesaj Alma İzni',
              settings.privacy.allowMessages,
              (value) => setSettings({
                ...settings, 
                privacy: {
                  ...settings.privacy, 
                  allowMessages: value
                }
              }),
              colors.accent
            )}

            {renderSettingItem(
              'location',
              'Konum Paylaşımı',
              settings.privacy.showLocation,
              (value) => {
                const newSettings = {
                  ...settings, 
                  privacy: {
                    ...settings.privacy, 
                    showLocation: value
                  }
                };
                setSettings(newSettings);
                saveSettings(newSettings);
              },
              colors.primary
            )}
          </View>

          {/* Diğer Ayarlar */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Diğer Ayarlar</Text>
            {menuItems.map(renderMenuItem)}
          </View>

          {/* Alt boşluk */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
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
    paddingTop: isAndroid ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    paddingBottom: bottomSafeArea + scale(20),
  },
  header: {
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(20),
    paddingTop: isAndroid ? verticalScale(15) : verticalScale(25),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: scaleFont(isTablet ? 24 : 20),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: scale(40),
  },
  headerRight: {
    alignItems: 'center',
  },
  connectionIndicator: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: getResponsivePadding(20),
    marginTop: verticalScale(30),
  },
  sectionTitle: {
    fontSize: scaleFont(isTablet ? 20 : 18),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(15),
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: scaleFont(16),
    color: colors.text.primary,
    marginLeft: scale(15),
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
  bottomSpacer: {
    height: verticalScale(20),
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: getResponsivePadding(15),
    paddingVertical: verticalScale(12),
    marginHorizontal: getResponsivePadding(20),
    marginTop: verticalScale(20),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  errorText: {
    fontSize: scaleFont(14),
    color: colors.warning,
    marginLeft: scale(8),
    flex: 1,
  },
});
