import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';
import { scale, verticalScale, scaleFont, getResponsivePadding } from '../utils/responsive';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function GlobalMenu({ isVisible, onClose, onNavigate }) {
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [fadeAnim] = useState(new Animated.Value(0));

  const menuItems = [
    {
      id: '1',
      title: 'İTİRAF',
      icon: 'chatbubbles',
      color: '#FF6B6B', // Red color for confession
      gradient: ['#FF6B6B', '#FF8E8E'],
      description: 'Anonim itiraflar',
    },
    {
      id: '2',
      title: 'LOCAL CHAT',
      icon: 'chatbubble-ellipses',
      color: '#10B981', // Green color for local chat
      gradient: ['#10B981', '#34D399'],
      description: 'Anlık mesajlaşma',
    },
    {
      id: '3',
      title: 'SUPPORT',
      icon: 'heart',
      color: '#8B5CF6', // Purple color like in the image
      gradient: ['#8B5CF6', '#A855F7'],
      description: 'Yardım ve destek',
    },
    {
      id: '4',
      title: 'CREW',
      icon: 'people',
      color: '#374151', // Dark gray
      gradient: ['#374151', '#4B5563'],
      description: 'Takım üyeleri',
    },
  ];

  const toggleMenu = () => {
    if (isVisible) {
      // Menüyü kapat
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
      });
    } else {
      // Menüyü aç
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // isVisible değiştiğinde animasyonu güncelle
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const handleMenuItemPress = (item) => {
    // Menüyü kapat
    toggleMenu();
    
    // İlgili sayfaya yönlendir
    if (onNavigate) {
      switch (item.id) {
        case '1': // İtiraf
          onNavigate('Confession');
          break;
        case '2': // Local Chat
          onNavigate('LocalChat');
          break;
        case '3': // Support
          onNavigate('NotificationCenter'); // Bildirim merkezine yönlendir
          break;
        case '4': // Crew
          onNavigate('Profile'); // Şimdilik Profile'a yönlendir
          break;
        default:
          break;
      }
    }
  };

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={() => handleMenuItemPress(item)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={item.gradient}
        style={styles.menuItemGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.menuItemContent}>
          <View style={styles.iconContainer}>
            <Ionicons name={item.icon} size={scale(32)} color="#FFFFFF" />
          </View>
          <Text style={styles.menuTitle}>{item.title}</Text>
          <Text style={styles.menuDescription}>{item.description}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={toggleMenu}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.backgroundOverlay,
            {
              opacity: fadeAnim
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.modalBackground} 
            activeOpacity={1} 
            onPress={toggleMenu}
          />
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.animatedMenu,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header */}
          <View style={styles.menuHeader}>
            <View style={styles.headerHandle} />
            <TouchableOpacity onPress={toggleMenu} style={styles.closeButton}>
              <Ionicons name="close" size={scale(24)} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          {/* Menu Content */}
          <ScrollView 
            style={styles.menuContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuContentContainer}
          >
            <View style={styles.menuTitleContainer}>
              <Text style={styles.menuMainTitle}>Menü</Text>
              <Text style={styles.menuSubTitle}>Seçeneklerden birini seçin</Text>
            </View>

            <View style={styles.menuGrid}>
              {menuItems.map(renderMenuItem)}
            </View>

            {/* Additional Info */}
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>Caddate v1.0.0</Text>
              <Text style={styles.infoSubText}>Bağdat Caddesi'nin sosyal uygulaması</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackground: {
    flex: 1,
  },
  animatedMenu: {
    backgroundColor: colors.background,
    borderTopLeftRadius: scale(25),
    borderTopRightRadius: scale(25),
    maxHeight: screenHeight * 0.7,
    minHeight: screenHeight * 0.4,
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: verticalScale(15),
    paddingBottom: verticalScale(10),
    position: 'relative',
  },
  headerHandle: {
    width: scale(40),
    height: scale(4),
    backgroundColor: colors.text.tertiary,
    borderRadius: scale(2),
  },
  closeButton: {
    position: 'absolute',
    right: getResponsivePadding(20),
    padding: scale(5),
    borderRadius: scale(20),
    backgroundColor: colors.surface,
  },
  menuContent: {
    flex: 1,
  },
  menuContentContainer: {
    paddingHorizontal: getResponsivePadding(20),
    paddingBottom: verticalScale(40),
  },
  menuTitleContainer: {
    alignItems: 'center',
    marginBottom: verticalScale(30),
    paddingTop: verticalScale(10),
  },
  menuMainTitle: {
    fontSize: scaleFont(28),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(5),
  },
  menuSubTitle: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: verticalScale(30),
  },
  menuItem: {
    width: (screenWidth - 60) / 2, // 2 columns with padding
    height: scale(140),
    marginBottom: verticalScale(20),
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItemGradient: {
    flex: 1,
    padding: getResponsivePadding(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(15),
  },
  menuTitle: {
    fontSize: scaleFont(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: verticalScale(5),
    textAlign: 'center',
  },
  menuDescription: {
    fontSize: scaleFont(12),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  infoContainer: {
    alignItems: 'center',
    paddingVertical: verticalScale(20),
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  infoText: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
    marginBottom: verticalScale(5),
  },
  infoSubText: {
    fontSize: scaleFont(12),
    color: colors.text.tertiary,
  },
});