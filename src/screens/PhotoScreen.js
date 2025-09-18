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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PhotoScreen() {
  const [photos, setPhotos] = useState([
    {
      id: '1',
      uri: 'https://picsum.photos/300/400?random=1',
      user: 'Ahmet Y.',
      time: '2 saat önce',
      likes: 12,
      comments: 3,
      location: 'Bağdat Caddesi',
    },
    {
      id: '2',
      uri: 'https://picsum.photos/300/400?random=2',
      user: 'Elif K.',
      time: '4 saat önce',
      likes: 8,
      comments: 1,
      location: 'Moda Sahili',
    },
    {
      id: '3',
      uri: 'https://picsum.photos/300/400?random=3',
      user: 'Mehmet A.',
      time: '6 saat önce',
      likes: 15,
      comments: 5,
      location: 'Kadıköy',
    },
  ]);
  const [selectedTab, setSelectedTab] = useState('feed');

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
      const newPhoto = {
        id: Date.now().toString(),
        uri: result.assets[0].uri,
        user: 'Sen',
        time: 'Şimdi',
        likes: 0,
        comments: 0,
        location: 'Bağdat Caddesi',
      };
      setPhotos(prev => [newPhoto, ...prev]);
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
      const newPhoto = {
        id: Date.now().toString(),
        uri: result.assets[0].uri,
        user: 'Sen',
        time: 'Şimdi',
        likes: 0,
        comments: 0,
        location: 'Bağdat Caddesi',
      };
      setPhotos(prev => [newPhoto, ...prev]);
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

  const renderPhoto = ({ item }) => (
    <View style={styles.photoCard}>
      <Image source={{ uri: item.uri }} style={styles.photo} />
      <View style={styles.photoOverlay}>
        <View style={styles.photoHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={scale(16)} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.userName}>{item.user}</Text>
              <Text style={styles.photoTime}>{item.time}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={scale(20)} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.photoFooter}>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={scale(16)} color="#FFFFFF" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="heart" size={scale(20)} color="#FFFFFF" />
              <Text style={styles.actionText}>{item.likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble" size={scale(20)} color="#FFFFFF" />
              <Text style={styles.actionText}>{item.comments}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="share" size={scale(20)} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

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

        {/* Tab Bar */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'feed' && styles.activeTab]}
            onPress={() => setSelectedTab('feed')}
          >
            <Text style={[styles.tabText, selectedTab === 'feed' && styles.activeTabText]}>
              Akış
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'nearby' && styles.activeTab]}
            onPress={() => setSelectedTab('nearby')}
          >
            <Text style={[styles.tabText, selectedTab === 'nearby' && styles.activeTabText]}>
              Yakındakiler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'my' && styles.activeTab]}
            onPress={() => setSelectedTab('my')}
          >
            <Text style={[styles.tabText, selectedTab === 'my' && styles.activeTabText]}>
              Benimkiler
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.photosGrid}
          showsVerticalScrollIndicator={false}
        />

        {/* Floating Action Button */}
        <TouchableOpacity style={styles.fab} onPress={showImageOptions}>
          <Ionicons name="camera" size={scale(24)} color="#FFFFFF" />
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(10),
    borderBottomWidth: isIOS ? 0.5 : 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    paddingVertical: verticalScale(12),
    alignItems: 'center',
    borderRadius: scale(20),
    marginHorizontal: scale(2),
  },
  activeTab: {
    backgroundColor: colors.primary,
    ...getPlatformShadow(2),
  },
  tabText: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: isIOS ? '600' : '500',
    color: colors.text.secondary,
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  activeTabText: {
    color: colors.text.primary,
    fontWeight: isIOS ? '700' : 'bold',
  },
  photosGrid: {
    padding: scale(10),
    paddingBottom: getBottomSafeArea() + verticalScale(100),
  },
  photoCard: {
    flex: 1,
    margin: scale(5),
    borderRadius: scale(15),
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...getPlatformShadow(3),
    borderWidth: isIOS ? 0.5 : 1,
    borderColor: colors.border.light,
  },
  photo: {
    width: '100%',
    height: verticalScale(isTablet ? 250 : 200),
    resizeMode: 'cover',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayLight,
    justifyContent: 'space-between',
    padding: scale(15),
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: scale(isTablet ? 36 : 30),
    height: scale(isTablet ? 36 : 30),
    borderRadius: scale(isTablet ? 18 : 15),
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(10),
    ...getPlatformShadow(1),
  },
  userName: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: isIOS ? '600' : '500',
    color: colors.text.primary,
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  photoTime: {
    fontSize: getResponsiveFontSize(12),
    color: colors.text.secondary,
    fontFamily: isIOS ? 'System' : 'Roboto',
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
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    fontSize: getResponsiveFontSize(12),
    color: colors.text.primary,
    marginLeft: scale(5),
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scale(15),
    padding: scale(5),
    minWidth: getMinTouchTarget(),
    minHeight: getMinTouchTarget(),
    justifyContent: 'center',
  },
  actionText: {
    fontSize: getResponsiveFontSize(12),
    color: colors.text.primary,
    marginLeft: scale(5),
    fontFamily: isIOS ? 'System' : 'Roboto',
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
});
