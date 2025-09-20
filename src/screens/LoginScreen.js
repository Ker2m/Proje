import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Dimensions,
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
  isIOS,
  isAndroid,
  isTablet,
  isSmallScreen
} from '../utils/responsive';

export default function LoginScreen({ navigation, onAuthentication }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    // Email formatını kontrol et
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Hata', 'Geçerli bir email adresi giriniz');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.login(email, password);
      
      if (response.success) {
        // Token'ı kaydet
        apiService.setToken(response.data.token);
        
        Alert.alert('Başarılı', response.message, [
          { text: 'Tamam', onPress: () => {
            // Authentication state'ini güncelle
            if (onAuthentication) {
              onAuthentication(true);
            }
          }}
        ]);
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Email doğrulama hatası kontrolü
      if (error.message && error.message.includes('Email adresinizi doğrulamanız gerekiyor')) {
        Alert.alert(
          'Email Doğrulama Gerekli',
          'Giriş yapabilmek için email adresinizi doğrulamanız gerekiyor. Doğrulama kodu göndermek ister misiniz?',
          [
            { text: 'İptal', style: 'cancel' },
            { 
              text: 'Kodu Gönder', 
              onPress: () => handleResendVerificationEmail() 
            }
          ]
        );
      } else {
        Alert.alert('Hata', error.message || 'Giriş yapılırken bir hata oluştu');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!email) {
      Alert.alert('Hata', 'Lütfen email adresinizi giriniz');
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.sendVerificationCode(email, 'registration');
      
      if (response.success) {
        Alert.alert(
          'Doğrulama Kodu Gönderildi',
          `Email adresinize (${email}) doğrulama kodu gönderildi. Lütfen email kutunuzu kontrol edin.`,
          [
            { text: 'Tamam', onPress: () => {
              // Email doğrulama ekranına yönlendir
              console.log('Navigating to EmailVerification with email:', email);
              navigation.navigate('EmailVerification', { email });
            }}
          ]
        );
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      Alert.alert('Hata', error.message || 'Doğrulama kodu gönderilirken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={colors.gradients.primary}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            {/* Logo ve Başlık */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Ionicons name="location" size={60} color={colors.text.primary} />
              </View>
              <Text style={styles.title}>Caddate</Text>
              <Text style={styles.subtitle}>Bağdat Caddesi'nin Sosyal Uygulaması</Text>
            </View>

            {/* Giriş Formu */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="E-posta adresiniz"
                  placeholderTextColor={colors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Şifreniz"
                  placeholderTextColor={colors.text.tertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
              </TouchableOpacity>
            </View>

            {/* Kayıt Ol Linki */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Hesabınız yok mu? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Kayıt Ol</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 20,
    height: 50,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  eyeIcon: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: colors.text.primary,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: colors.shadow.light,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotPasswordText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  registerLink: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
