import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api';
import { colors } from '../constants/colors';
import { 
  scale, 
  verticalScale, 
  scaleFont, 
  getResponsivePadding, 
  getResponsiveFontSize,
  isIOS,
  isAndroid,
  isTablet,
  isSmallScreen,
  isLargeScreen,
  getBottomSafeArea
} from '../utils/responsive';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const bottomSafeArea = getBottomSafeArea();

export default function HomeScreen() {
  const [userInfo, setUserInfo] = useState(null);
  const [userStats, setUserStats] = useState({
    friends: 0,
    messages: 0,
    photos: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      setIsLoading(true);
      
      // Token'ı kontrol et ve yükle
      const token = await apiService.getStoredToken();
      if (!token) {
        console.error('No auth token found');
        setIsLoading(false);
        return;
      }
      
      // Token'ı API service'e ayarla
      apiService.setToken(token);
      
      // Profil bilgilerini ve istatistikleri paralel olarak yükle
      const [profileResponse, statsResponse] = await Promise.allSettled([
        apiService.getProfile(),
        apiService.getUserStats()
      ]);

      // Profil bilgilerini işle
      if (profileResponse.status === 'fulfilled' && profileResponse.value.success) {
        setUserInfo(profileResponse.value.data.user);
      } else {
        console.error('Profile load error:', profileResponse.reason);
      }

      // İstatistikleri işle
      if (statsResponse.status === 'fulfilled' && statsResponse.value.success) {
        setUserStats(statsResponse.value.data);
      } else {
        console.error('User stats load error:', statsResponse.reason);
        // Hata durumunda varsayılan değerler
        setUserStats({
          friends: 0,
          messages: 0,
          photos: 0
        });
      }

    } catch (error) {
      console.error('User info load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    {
      id: '1',
      title: 'Yakındakiler',
      subtitle: 'Çevrendeki insanları keşfet',
      icon: 'people',
      color: colors.primary,
      gradient: colors.gradients.primary,
    },
    {
      id: '2',
      title: 'Sohbet',
      subtitle: 'Yeni arkadaşlarla tanış',
      icon: 'chatbubbles',
      color: colors.secondary,
      gradient: colors.gradients.redBlack,
    },
    {
      id: '3',
      title: 'Fotoğraf Paylaş',
      subtitle: 'Anılarını paylaş',
      icon: 'camera',
      color: colors.accent,
      gradient: colors.gradients.darkRed,
    },
    {
      id: '4',
      title: 'Harita',
      subtitle: 'Konumunu paylaş',
      icon: 'map',
      color: colors.warning,
      gradient: colors.gradients.blackRed,
    },
  ];

  const stats = [
    { label: 'Arkadaş', value: userStats.friends.toString(), icon: 'people' },
    { label: 'Mesaj', value: userStats.messages.toString(), icon: 'chatbubbles' },
    { label: 'Fotoğraf', value: userStats.photos.toString(), icon: 'camera' },
  ];

  const renderQuickAction = (item) => (
    <TouchableOpacity key={item.id} style={styles.actionCard}>
      <LinearGradient
        colors={item.gradient}
        style={styles.actionGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.actionContent}>
          <View style={styles.actionIconContainer}>
            <Ionicons name={item.icon} size={28} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>{item.title}</Text>
            <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderStat = (stat, index) => (
    <View key={index} style={styles.statCard}>
      <Ionicons name={stat.icon} size={24} color={colors.primary} />
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
    </View>
  );

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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={colors.primary} 
        translucent={isAndroid}
      />
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
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>Hoş geldin,</Text>
                <Text style={styles.userName}>
                  {userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : 'Kullanıcı'}
                </Text>
                <Text style={styles.subtitle}>Bağdat Caddesi'nde neler oluyor?</Text>
              </View>
              <TouchableOpacity 
                style={styles.profileImageContainer}
                onPress={() => setShowProfileModal(true)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ 
                    uri: userInfo?.profile_picture || 'https://picsum.photos/80/80?random=profile' 
                  }}
                  style={styles.profileImage}
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Stats */}
          <View style={styles.statsContainer}>
            {stats.map(renderStat)}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map(renderQuickAction)}
            </View>
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
        </ScrollView>
      </SafeAreaView>

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profil Bilgileri</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowProfileModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Profile Content */}
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Profile Image and Basic Info */}
              <View style={styles.profileModalHeader}>
                <Image
                  source={{ 
                    uri: userInfo?.profile_picture || 'https://picsum.photos/120/120?random=profile' 
                  }}
                  style={styles.modalProfileImage}
                />
                <Text style={styles.modalUserName}>
                  {userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : 'Kullanıcı'}
                </Text>
                <Text style={styles.modalUserAge}>
                  {userInfo?.birth_date ? `${calculateAge(userInfo.birth_date)} yaşında` : ''}
                </Text>
                <Text style={styles.modalUserEmail}>{userInfo?.email || ''}</Text>
              </View>

              {/* Profile Details */}
              <View style={styles.profileDetailsContainer}>
                {/* Personal Info Card */}
                <View style={styles.detailCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="person-outline" size={20} color={colors.primary} />
                    <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="person" size={16} color={colors.text.secondary} />
                    <Text style={styles.detailLabel}>Ad:</Text>
                    <Text style={styles.detailValue}>{userInfo?.first_name || 'Belirtilmemiş'}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="person" size={16} color={colors.text.secondary} />
                    <Text style={styles.detailLabel}>Soyad:</Text>
                    <Text style={styles.detailValue}>{userInfo?.last_name || 'Belirtilmemiş'}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar" size={16} color={colors.text.secondary} />
                    <Text style={styles.detailLabel}>Doğum Tarihi:</Text>
                    <Text style={styles.detailValue}>
                      {userInfo?.birth_date ? 
                        userInfo.birth_date.split('T')[0].split('-').reverse().join('/') : 
                        'Belirtilmemiş'
                      }
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="male-female" size={16} color={colors.text.secondary} />
                    <Text style={styles.detailLabel}>Cinsiyet:</Text>
                    <Text style={styles.detailValue}>
                      {userInfo?.gender === 'male' ? 'Erkek' : 
                       userInfo?.gender === 'female' ? 'Kadın' : 
                       userInfo?.gender === 'other' ? 'Diğer' : userInfo?.gender || 'Belirtilmemiş'}
                    </Text>
                  </View>
                </View>

                {/* Contact Info Card */}
                <View style={styles.detailCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="mail-outline" size={20} color={colors.secondary} />
                    <Text style={styles.cardTitle}>İletişim Bilgileri</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="mail" size={16} color={colors.text.secondary} />
                    <Text style={styles.detailLabel}>E-posta:</Text>
                    <Text style={styles.detailValue}>{userInfo?.email || 'Belirtilmemiş'}</Text>
                    {userInfo?.email_verified && (
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    )}
                  </View>
                </View>

                {/* Stats Card */}
                <View style={styles.detailCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="stats-chart-outline" size={20} color={colors.accent} />
                    <Text style={styles.cardTitle}>İstatistikler</Text>
                  </View>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Ionicons name="people" size={20} color={colors.primary} />
                      <Text style={styles.statValue}>{stats[0].value}</Text>
                      <Text style={styles.statLabel}>Arkadaş</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="chatbubbles" size={20} color={colors.secondary} />
                      <Text style={styles.statValue}>{stats[1].value}</Text>
                      <Text style={styles.statLabel}>Mesaj</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="camera" size={20} color={colors.accent} />
                      <Text style={styles.statValue}>{stats[2].value}</Text>
                      <Text style={styles.statLabel}>Fotoğraf</Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
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
  welcomeContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    marginBottom: verticalScale(5),
  },
  userName: {
    fontSize: scaleFont(isTablet ? 28 : 24),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(5),
  },
  subtitle: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
  },
  profileImageContainer: {
    marginLeft: scale(15),
  },
  profileImage: {
    width: scale(isTablet ? 100 : 80),
    height: scale(isTablet ? 100 : 80),
    borderRadius: scale(isTablet ? 50 : 40),
    borderWidth: scale(3),
    borderColor: colors.text.primary,
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
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: isTablet ? (screenWidth - 80) / 3 : (screenWidth - 60) / 2,
    marginBottom: verticalScale(15),
    borderRadius: scale(15),
    overflow: 'hidden',
    shadowColor: colors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionGradient: {
    padding: getResponsivePadding(20),
    minHeight: verticalScale(isTablet ? 140 : 120),
  },
  actionContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  actionIconContainer: {
    width: scale(isTablet ? 60 : 50),
    height: scale(isTablet ? 60 : 50),
    borderRadius: scale(isTablet ? 30 : 25),
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(15),
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: scaleFont(isTablet ? 18 : 16),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(5),
  },
  actionSubtitle: {
    fontSize: scaleFont(12),
    color: colors.text.secondary,
    lineHeight: scaleFont(16),
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalContent: {
    backgroundColor: colors.surface,
    borderRadius: scale(20),
    width: screenWidth * 0.95,
    maxHeight: screenHeight * 0.85,
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(15),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light + '30',
  },
  modalTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  closeButton: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: colors.background,
  },
  modalScrollView: {
    maxHeight: screenHeight * 0.7,
  },
  profileModalHeader: {
    alignItems: 'center',
    paddingVertical: verticalScale(20),
    paddingHorizontal: getResponsivePadding(20),
  },
  modalProfileImage: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    borderWidth: scale(3),
    borderColor: colors.primary,
    marginBottom: verticalScale(15),
  },
  modalUserName: {
    fontSize: scaleFont(24),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(5),
    textAlign: 'center',
  },
  modalUserAge: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    marginBottom: verticalScale(5),
  },
  modalUserEmail: {
    fontSize: scaleFont(14),
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  profileDetailsContainer: {
    paddingHorizontal: getResponsivePadding(20),
    paddingBottom: verticalScale(20),
  },
  detailCard: {
    backgroundColor: colors.background,
    borderRadius: scale(15),
    padding: getResponsivePadding(15),
    marginBottom: verticalScale(15),
    shadowColor: colors.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
    paddingBottom: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light + '30',
  },
  cardTitle: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: scale(8),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light + '20',
  },
  detailLabel: {
    fontSize: scaleFont(14),
    fontWeight: '500',
    color: colors.text.secondary,
    marginLeft: scale(8),
    width: scale(100),
  },
  detailValue: {
    fontSize: scaleFont(14),
    color: colors.text.primary,
    flex: 1,
    marginLeft: scale(8),
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: verticalScale(10),
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
});
