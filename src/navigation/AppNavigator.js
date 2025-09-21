import React, { useState, useEffect, useRef } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Dimensions, View, TouchableOpacity, Text } from 'react-native';
import { scale, verticalScale, getBottomSafeArea, isIOS, isAndroid } from '../utils/responsive';
import { colors } from '../constants/colors';
import GlobalMenu from '../components/GlobalMenu';
import apiService from '../services/api';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import MapScreen from '../screens/MapScreen';
import ChatScreen from '../screens/ChatScreen';
import LocalChatScreen from '../screens/LocalChatScreen';
import PrivateChatScreen from '../screens/PrivateChatScreen';
import PhotoScreen from '../screens/PhotoScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SecurityScreen from '../screens/SecurityScreen';
import ConfessionScreen from '../screens/ConfessionScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Ana Tab Navigator - Alt navigasyon menüsü
function MainTabNavigator({ onLogout, navigation }) {
  const { height: screenHeight } = Dimensions.get('window');
  const bottomSafeArea = getBottomSafeArea();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const tabNavigatorRef = useRef(null);
  
  const handleMenuNavigate = (screenName) => {
    // GlobalMenu'den gelen navigation isteğini işle
    console.log('Navigating to:', screenName);
    
    if (screenName === 'Confession') {
      // Confession screen için Stack Navigator'a navigate et
      const stackNavigation = navigation.getParent();
      if (stackNavigation) {
        stackNavigation.navigate(screenName);
      }
    } else {
      // Tab Navigator içindeki ekranlara doğrudan navigasyon yap
      if (tabNavigatorRef.current) {
        tabNavigatorRef.current.navigate(screenName);
      }
    }
  };
  
  return (
    <>
    <Tab.Navigator
      ref={tabNavigatorRef}
      listeners={{
        state: (e) => {
          // Tab Navigator'ın state değişikliklerini dinle
          console.log('Tab Navigator state changed:', e.data.state);
        }
      }}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Menu') {
            iconName = focused ? 'menu' : 'menu-outline';
          } else if (route.name === 'Photo') {
            iconName = focused ? 'camera' : 'camera-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <Ionicons 
              name={iconName} 
              size={focused ? scale(26) : scale(24)} 
              color={color} 
            />
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: scale(70) + bottomSafeArea,
          paddingBottom: bottomSafeArea + scale(8),
          paddingTop: scale(8),
          paddingHorizontal: scale(16),
          shadowColor: colors.shadow.dark,
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          borderTopLeftRadius: scale(20),
          borderTopRightRadius: scale(20),
        },
        tabBarLabelStyle: {
          fontSize: scale(11),
          fontWeight: '600',
          marginTop: scale(2),
        },
        tabBarItemStyle: {
          paddingVertical: scale(4),
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Map" 
        component={MapScreen} 
        options={{ title: 'Harita' }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ title: 'Sohbet' }}
      />
      <Tab.Screen 
        name="Menu" 
        options={{ title: 'Menü' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            setIsMenuVisible(true);
          },
        }}
      >
        {() => <View style={{ flex: 1, backgroundColor: colors.background }} />}
      </Tab.Screen>
      <Tab.Screen 
        name="Photo" 
        component={PhotoScreen} 
        options={{ title: 'Fotoğraf' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profil' }}
        initialParams={{ onLogout }}
      />
    </Tab.Navigator>
    
    <GlobalMenu 
      isVisible={isMenuVisible}
      onClose={() => setIsMenuVisible(false)}
      onNavigate={handleMenuNavigate}
    />
    </>
  );
}

// Ana App Navigator
export default function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Token kontrolü yap
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      // AsyncStorage'dan token'ı al
      const token = await apiService.getStoredToken();
      
      if (token) {
        // Token'ı API servisine set et
        apiService.setToken(token);
        
        // Token'ı doğrula - profil endpoint'ini kullan
        const response = await apiService.verifyToken();
        
        if (response.success) {
          setIsAuthenticated(true);
        } else {
          // Token geçersizse temizle
          apiService.clearToken();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      
      // Token geçersizse kullanıcıyı bilgilendir
      if (error.message.includes('Token geçersiz') || error.message.includes('Geçersiz token')) {
        console.log('Token geçersiz, kullanıcı login sayfasına yönlendiriliyor');
      }
      
      // Hata durumunda token'ı temizle ve login'e yönlendir
      apiService.clearToken();
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Authentication state'ini güncellemek için fonksiyon
  const handleAuthentication = (authenticated) => {
    setIsAuthenticated(authenticated);
  };

  if (isLoading) {
    return null; // Loading screen burada gösterilebilir
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main">
            {(props) => <MainTabNavigator {...props} navigation={props.navigation} onLogout={() => setIsAuthenticated(false)} />}
          </Stack.Screen>
          <Stack.Screen name="Confession">
            {(props) => <ConfessionScreen {...props} />}
          </Stack.Screen>
          <Stack.Screen name="Settings">
            {(props) => <SettingsScreen {...props} />}
          </Stack.Screen>
          <Stack.Screen name="Security">
            {(props) => <SecurityScreen {...props} />}
          </Stack.Screen>
          <Stack.Screen name="NotificationCenter">
            {(props) => <NotificationCenterScreen {...props} />}
          </Stack.Screen>
          <Stack.Screen name="LocalChat">
            {(props) => <LocalChatScreen {...props} />}
          </Stack.Screen>
          <Stack.Screen name="PrivateChat">
            {(props) => <PrivateChatScreen {...props} />}
          </Stack.Screen>
        </>
      ) : (
        <>
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onAuthentication={handleAuthentication} />}
          </Stack.Screen>
          <Stack.Screen name="Register">
            {(props) => <RegisterScreen {...props} onAuthentication={handleAuthentication} />}
          </Stack.Screen>
          <Stack.Screen name="EmailVerification">
            {(props) => <EmailVerificationScreen {...props} />}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );
}
