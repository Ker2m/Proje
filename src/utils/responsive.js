import { Dimensions, Platform, StatusBar } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Base dimensions (iPhone 12 Pro)
const baseWidth = 390;
const baseHeight = 844;

// Responsive scaling functions
export const scale = (size) => (screenWidth / baseWidth) * size;
export const verticalScale = (size) => (screenHeight / baseHeight) * size;
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

// Font scaling
export const scaleFont = (size) => {
  const newSize = scale(size);
  if (Platform.OS === 'ios') {
    return Math.round(newSize);
  } else {
    return Math.round(newSize) - 1;
  }
};

// Responsive padding
export const getResponsivePadding = (size) => scale(size);

// Responsive font size
export const getResponsiveFontSize = (size) => scaleFont(size);

// Platform detection
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isTablet = screenWidth >= 768;
export const isSmallScreen = screenWidth < 375;
export const isLargeScreen = screenWidth > 414;

// Safe area helpers
export const getStatusBarHeight = () => {
  if (isIOS) {
    return StatusBar.currentHeight || 0;
  }
  return StatusBar.currentHeight || 0;
};

export const getBottomSafeArea = () => {
  // This would typically use react-native-safe-area-context
  // For now, return a default value based on device
  if (isIOS) {
    // iPhone X ve sonrası için home indicator yüksekliği
    return screenHeight > 800 ? 34 : 0;
  }
  return 0;
};

// Touch target helpers
export const getMinTouchTarget = () => scale(44);

// Platform-specific shadows
export const getPlatformShadow = (elevation = 2) => {
  if (isIOS) {
    return {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: elevation,
      },
      shadowOpacity: 0.1 + (elevation * 0.05),
      shadowRadius: elevation * 2,
    };
  } else {
    return {
      elevation: elevation,
    };
  }
};

// Grid helpers
export const getGridColumns = () => {
  if (isTablet) return 3;
  if (isSmallScreen) return 1;
  return 2;
};

// Responsive spacing
export const getResponsiveSpacing = (baseSpacing) => {
  if (isTablet) return baseSpacing * 1.5;
  if (isSmallScreen) return baseSpacing * 0.8;
  return baseSpacing;
};

// Responsive margins
export const getResponsiveMargin = (size) => scale(size);

// Responsive border radius
export const getResponsiveBorderRadius = (size) => scale(size);

// Responsive icon size
export const getResponsiveIconSize = (size) => scale(size);

// Responsive button height
export const getResponsiveButtonHeight = () => {
  if (isTablet) return scale(60);
  if (isSmallScreen) return scale(44);
  return scale(50);
};

// Responsive input height
export const getResponsiveInputHeight = () => {
  if (isTablet) return scale(56);
  if (isSmallScreen) return scale(44);
  return scale(50);
};

