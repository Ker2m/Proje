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

export default function EmailVerificationScreen({ navigation, route }) {
  const { email } = route?.params || {};
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Debug: Log route params
  console.log('EmailVerificationScreen - route:', route);
  console.log('EmailVerificationScreen - email:', email);

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Hata', 'Lütfen 6 haneli doğrulama kodunu giriniz');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.verifyCode(email, verificationCode, 'registration');
      
      if (response.success) {
        Alert.alert(
          'Başarılı',
          'Email adresiniz başarıyla doğrulandı! Şimdi giriş yapabilirsiniz.',
          [
            { text: 'Tamam', onPress: () => {
              // Login ekranına geri dön
              navigation.goBack();
            }}
          ]
        );
      }
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Hata', error.message || 'Doğrulama kodu hatalı');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      Alert.alert('Hata', 'Email adresi bulunamadı');
      return;
    }

    setIsResending(true);

    try {
      const response = await apiService.sendVerificationCode(email, 'registration');
      
      if (response.success) {
        Alert.alert('Başarılı', 'Yeni doğrulama kodu gönderildi');
      }
    } catch (error) {
      console.error('Resend error:', error);
      Alert.alert('Hata', error.message || 'Kod gönderilirken bir hata oluştu');
    } finally {
      setIsResending(false);
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
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              
              <View style={styles.logoContainer}>
                <Ionicons name="mail" size={60} color={colors.text.primary} />
              </View>
              <Text style={styles.title}>Email Doğrulama</Text>
              <Text style={styles.subtitle}>
                {email ? `${email} adresine gönderilen doğrulama kodunu giriniz` : 'Doğrulama kodu giriniz'}
              </Text>
            </View>

            {/* Verification Form */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="keypad" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="6 haneli doğrulama kodu"
                  placeholderTextColor={colors.text.tertiary}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]}
                onPress={handleVerifyCode}
                disabled={isLoading || verificationCode.length !== 6}
              >
                <Text style={styles.verifyButtonText}>
                  {isLoading ? 'Doğrulanıyor...' : 'Doğrula'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.resendButton}
                onPress={handleResendCode}
                disabled={isResending}
              >
                <Text style={styles.resendButtonText}>
                  {isResending ? 'Gönderiliyor...' : 'Kodu Yeniden Gönder'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Help Text */}
            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                • Doğrulama kodu 10 dakika geçerlidir
              </Text>
              <Text style={styles.helpText}>
                • Email kutunuzu kontrol edin
              </Text>
              <Text style={styles.helpText}>
                • Spam klasörünü de kontrol etmeyi unutmayın
              </Text>
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
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: 10,
    zIndex: 1,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  title: {
    fontSize: scaleFont(28),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 25,
    marginBottom: 20,
    paddingHorizontal: 20,
    height: 50,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 2,
  },
  verifyButton: {
    backgroundColor: colors.text.primary,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  verifyButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  verifyButtonText: {
    color: colors.background,
    fontSize: scaleFont(16),
    fontWeight: 'bold',
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendButtonText: {
    color: colors.text.primary,
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  helpContainer: {
    alignItems: 'center',
  },
  helpText: {
    color: colors.text.tertiary,
    fontSize: scaleFont(14),
    textAlign: 'center',
    marginBottom: 5,
  },
});
