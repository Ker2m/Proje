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
  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Socket.io entegrasyonu
  useEffect(() => {
    initializeSocket();
    loadSettings();
    
    return () => {
      // Cleanup
      socketService.removeAllListeners();
    };
  }, []);

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
      if (settings.darkMode !== undefined) setDarkMode(settings.darkMode);
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
    
    if (pushNotifications) {
      // Bildirim göster
      Notifications.scheduleNotificationAsync({
        content: {
          title: data.title || 'Caddate',
          body: data.message || 'Yeni bildirim',
          sound: soundEnabled,
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
      const settings = await AsyncStorage.getItem('userSettings');
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        setNotifications(parsedSettings.notifications ?? true);
        setLocationSharing(parsedSettings.locationSharing ?? false);
        setDarkMode(parsedSettings.darkMode ?? false);
        setEmailNotifications(parsedSettings.emailNotifications ?? true);
        setPushNotifications(parsedSettings.pushNotifications ?? true);
        setSoundEnabled(parsedSettings.soundEnabled ?? true);
        setVibrationEnabled(parsedSettings.vibrationEnabled ?? true);
      }
    } catch (error) {
      console.error('Settings load error:', error);
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
      const currentSettings = {
        notifications,
        locationSharing,
        darkMode,
        emailNotifications,
        pushNotifications,
        soundEnabled,
        vibrationEnabled,
        ...newSettings
      };
      
      // Local storage'a kaydet
      await saveSettingsToLocal(currentSettings);
      
      // Sunucuya gönder
      await socketService.updateSettings(currentSettings);
      
      // Bildirim ayarlarını uygula
      await applyNotificationSettings(currentSettings);
      
      setLastSync(new Date().toLocaleTimeString());
      console.log('Settings saved:', currentSettings);
    } catch (error) {
      console.error('Settings save error:', error);
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir hata oluştu');
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
      if (!pushNotifications) {
        Alert.alert('Bilgi', 'Push bildirimleri kapalı. Önce bildirimleri açın.');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Caddate Test Bildirimi",
          body: "Bildirim ayarlarınız çalışıyor! 🎉",
          sound: soundEnabled,
        },
        trigger: { seconds: 1 },
      });

      Alert.alert('Başarılı', 'Test bildirimi gönderildi!');
    } catch (error) {
      console.error('Test notification error:', error);
      Alert.alert('Hata', 'Test bildirimi gönderilemedi');
    }
  };

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
      title: 'Gizlilik',
      icon: 'lock-closed-outline',
      color: colors.warning,
      onPress: () => Alert.alert('Bilgi', 'Gizlilik ayarları yakında eklenecek'),
    },
    {
      id: '5',
      title: 'Yardım & Destek',
      icon: 'help-circle-outline',
      color: colors.info,
      onPress: () => Alert.alert('Bilgi', 'Yardım ve destek yakında eklenecek'),
    },
    {
      id: '6',
      title: 'Hakkında',
      icon: 'information-circle-outline',
      color: colors.primary,
      onPress: () => Alert.alert('Hakkında', 'Caddate v1.0.0\nBağdat Caddesi\'nin sosyal uygulaması'),
    },
    {
      id: '7',
      title: 'Bildirim Testi',
      icon: 'notifications',
      color: colors.success,
      onPress: () => sendTestNotification(),
    },
    {
      id: '8',
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
        onValueChange={onValueChange}
        trackColor={{ false: colors.border.light, true: color }}
        thumbColor={value ? colors.text.primary : colors.text.primary}
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

          {/* Bildirim Ayarları */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bildirim Ayarları</Text>
            
            {renderSettingItem(
              'notifications',
              'Bildirimler',
              notifications,
              setNotifications,
              colors.success
            )}

            {renderSettingItem(
              'mail',
              'E-posta Bildirimleri',
              emailNotifications,
              setEmailNotifications,
              colors.info
            )}

            {renderSettingItem(
              'phone-portrait',
              'Push Bildirimleri',
              pushNotifications,
              setPushNotifications,
              colors.primary
            )}

            {renderSettingItem(
              'volume-high',
              'Ses',
              soundEnabled,
              setSoundEnabled,
              colors.secondary
            )}

            {renderSettingItem(
              'phone-portrait',
              'Titreşim',
              vibrationEnabled,
              setVibrationEnabled,
              colors.accent
            )}
          </View>

          {/* Konum Ayarları */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Konum Ayarları</Text>
            
            {renderSettingItem(
              'location',
              'Konum Paylaşımı',
              locationSharing,
              setLocationSharing,
              colors.primary
            )}
          </View>

          {/* Görünüm Ayarları */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Görünüm Ayarları</Text>
            
            {renderSettingItem(
              'moon',
              'Karanlık Mod',
              darkMode,
              setDarkMode,
              colors.secondary
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
});
