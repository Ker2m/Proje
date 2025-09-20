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
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import apiService from '../services/api';
import socketService from '../services/socketService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function NotificationCenterScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, unread, friend_request, message, like, comment, system

  useEffect(() => {
    loadNotifications();
    loadStats();
    setupSocketListeners();
    
    return () => {
      // Socket listener'ları temizle
      socketService.off('new_notification', handleNewNotification);
    };
  }, []);

  const setupSocketListeners = () => {
    // Yeni bildirim geldiğinde
    socketService.on('new_notification', handleNewNotification);
  };

  const handleNewNotification = (notification) => {
    console.log('Yeni bildirim alındı:', notification);
    
    // Bildirimi listeye ekle
    setNotifications(prev => [notification, ...prev]);
    
    // İstatistikleri güncelle
    loadStats();
  };

  const loadNotifications = async (pageNum = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const unreadOnly = filterType === 'unread';
      const response = await apiService.getNotifications(pageNum, 20, unreadOnly);
      
      if (response.success) {
        const newNotifications = response.data.notifications;
        
        if (pageNum === 1) {
          setNotifications(newNotifications);
        } else {
          setNotifications(prev => [...prev, ...newNotifications]);
        }
        
        setHasMore(response.data.pagination.hasNextPage);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Bildirimler yüklenirken hata:', error);
      Alert.alert('Hata', 'Bildirimler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.getNotificationStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Bildirim istatistikleri yüklenirken hata:', error);
    }
  };

  const handleRefresh = () => {
    loadNotifications(1, true);
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      loadNotifications(page + 1);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await apiService.markNotificationAsRead(notificationId);
      if (response.success) {
        // Bildirimi güncelle
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, isRead: true, readAt: new Date().toISOString() }
              : notif
          )
        );
        
        // İstatistikleri güncelle
        loadStats();
      }
    } catch (error) {
      console.error('Bildirim okundu olarak işaretlenirken hata:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await apiService.markAllNotificationsAsRead();
      if (response.success) {
        // Tüm bildirimleri okundu olarak işaretle
        setNotifications(prev => 
          prev.map(notif => ({ 
            ...notif, 
            isRead: true, 
            readAt: new Date().toISOString() 
          }))
        );
        
        // İstatistikleri güncelle
        loadStats();
        
        Alert.alert('Başarılı', 'Tüm bildirimler okundu olarak işaretlendi');
      }
    } catch (error) {
      console.error('Tüm bildirimler işaretlenirken hata:', error);
      Alert.alert('Hata', 'Bildirimler işaretlenirken bir hata oluştu');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await apiService.deleteNotification(notificationId);
      if (response.success) {
        // Bildirimi listeden kaldır
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        
        // İstatistikleri güncelle
        loadStats();
      }
    } catch (error) {
      console.error('Bildirim silinirken hata:', error);
      Alert.alert('Hata', 'Bildirim silinirken bir hata oluştu');
    }
  };

  const deleteReadNotifications = async () => {
    Alert.alert(
      'Okunmuş Bildirimleri Sil',
      'Tüm okunmuş bildirimleri silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.deleteReadNotifications();
              if (response.success) {
                // Okunmuş bildirimleri listeden kaldır
                setNotifications(prev => prev.filter(notif => !notif.isRead));
                
                // İstatistikleri güncelle
                loadStats();
                
                Alert.alert('Başarılı', `${response.data.deletedCount} bildirim silindi`);
              }
            } catch (error) {
              console.error('Okunmuş bildirimler silinirken hata:', error);
              Alert.alert('Hata', 'Bildirimler silinirken bir hata oluştu');
            }
          }
        }
      ]
    );
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'friend_request':
        return 'person-add';
      case 'friend_accepted':
        return 'checkmark-circle';
      case 'message':
        return 'chatbubble';
      case 'like':
        return 'heart';
      case 'comment':
        return 'chatbubble-outline';
      case 'system':
        return 'information-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'friend_request':
        return '#4CAF50';
      case 'friend_accepted':
        return '#2196F3';
      case 'message':
        return '#FF9800';
      case 'like':
        return '#E91E63';
      case 'comment':
        return '#9C27B0';
      case 'system':
        return '#607D8B';
      default:
        return colors.primary;
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Az önce';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} dakika önce`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} saat önce`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} gün önce`;
    } else {
      return time.toLocaleDateString('tr-TR');
    }
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.isRead && styles.unreadNotification
      ]}
      onPress={() => !item.isRead && markAsRead(item.id)}
      onLongPress={() => {
        Alert.alert(
          'Bildirim',
          'Bu bildirimi silmek istediğinizden emin misiniz?',
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Sil',
              style: 'destructive',
              onPress: () => deleteNotification(item.id)
            }
          ]
        );
      }}
    >
      <View style={styles.notificationContent}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={getNotificationIcon(item.type)}
            size={scale(24)}
            color={getNotificationColor(item.type)}
          />
        </View>
        
        <View style={styles.notificationText}>
          <Text style={[
            styles.notificationTitle,
            !item.isRead && styles.unreadText
          ]}>
            {item.title}
          </Text>
          <Text style={styles.notificationMessage}>
            {item.message}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
        
        {!item.isRead && (
          <View style={styles.unreadDot} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={scale(24)} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Bildirimler</Text>
            {stats && (
              <Text style={styles.headerSubtitle}>
                {stats.unreadCount} okunmamış bildirim
              </Text>
            )}
          </View>
          
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter" size={scale(24)} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={markAllAsRead}
            disabled={!stats || stats.unreadCount === 0}
          >
            <Ionicons name="checkmark-done" size={scale(20)} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Tümünü Okundu İşaretle</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={deleteReadNotifications}
          >
            <Ionicons name="trash" size={scale(20)} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Okunmuşları Sil</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off" size={scale(64)} color={colors.text.tertiary} />
      <Text style={styles.emptyStateTitle}>Bildirim Yok</Text>
      <Text style={styles.emptyStateText}>
        Henüz hiç bildiriminiz yok. Yeni etkileşimler olduğunda burada görünecek.
      </Text>
    </View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModal}>
          <Text style={styles.filterTitle}>Filtrele</Text>
          
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'unread', label: 'Okunmamışlar' },
            { key: 'friend_request', label: 'Arkadaşlık İstekleri' },
            { key: 'message', label: 'Mesajlar' },
            { key: 'like', label: 'Beğeniler' },
            { key: 'comment', label: 'Yorumlar' },
            { key: 'system', label: 'Sistem' }
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterOption,
                filterType === filter.key && styles.selectedFilter
              ]}
              onPress={() => {
                setFilterType(filter.key);
                setShowFilterModal(false);
                loadNotifications(1, true);
              }}
            >
              <Text style={[
                styles.filterOptionText,
                filterType === filter.key && styles.selectedFilterText
              ]}>
                {filter.label}
              </Text>
              {filterType === filter.key && (
                <Ionicons name="checkmark" size={scale(20)} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={styles.closeFilterButton}
            onPress={() => setShowFilterModal(false)}
          >
            <Text style={styles.closeFilterText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      {renderHeader()}
      
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderNotification}
        contentContainerStyle={styles.notificationsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={() => 
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
      
      {renderFilterModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? getBottomSafeArea() : 0,
    paddingBottom: verticalScale(20),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(15),
  },
  backButton: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerText: {
    flex: 1,
    marginLeft: scale(15),
  },
  headerTitle: {
    fontSize: scaleFont(24),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: scaleFont(14),
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: verticalScale(2),
  },
  filterButton: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: getResponsivePadding(20),
    gap: scale(10),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: verticalScale(12),
    paddingHorizontal: getResponsivePadding(16),
    borderRadius: scale(25),
    gap: scale(8),
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  notificationsList: {
    flexGrow: 1,
  },
  notificationItem: {
    backgroundColor: colors.surface,
    marginHorizontal: getResponsivePadding(16),
    marginVertical: verticalScale(4),
    borderRadius: scale(12),
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: getResponsivePadding(16),
  },
  iconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: verticalScale(4),
  },
  unreadText: {
    fontWeight: 'bold',
  },
  notificationMessage: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
    lineHeight: scaleFont(20),
    marginBottom: verticalScale(6),
  },
  notificationTime: {
    fontSize: scaleFont(12),
    color: colors.text.tertiary,
  },
  unreadDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: colors.primary,
    marginTop: scale(8),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    marginTop: verticalScale(16),
  },
  loadingMore: {
    paddingVertical: verticalScale(20),
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: getResponsivePadding(40),
  },
  emptyStateTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: verticalScale(16),
    marginBottom: verticalScale(8),
  },
  emptyStateText: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: scaleFont(24),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModal: {
    backgroundColor: colors.surface,
    borderRadius: scale(20),
    padding: getResponsivePadding(24),
    width: screenWidth * 0.8,
    maxHeight: screenHeight * 0.6,
  },
  filterTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(20),
    textAlign: 'center',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(16),
    paddingHorizontal: getResponsivePadding(16),
    borderRadius: scale(12),
    marginBottom: verticalScale(8),
    backgroundColor: colors.background,
  },
  selectedFilter: {
    backgroundColor: colors.primary + '20',
  },
  filterOptionText: {
    fontSize: scaleFont(16),
    color: colors.text.primary,
  },
  selectedFilterText: {
    color: colors.primary,
    fontWeight: '600',
  },
  closeFilterButton: {
    marginTop: verticalScale(20),
    paddingVertical: verticalScale(16),
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: scale(12),
  },
  closeFilterText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
